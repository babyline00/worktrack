import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/reports/generate
// Body: { type, from, to, format }
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const { type, from, to, format = "csv" } = body;

    if (!type || !from || !to) throw ERRORS.VALIDATION("type, from, to are required");

    // Create job record
    const job = await db.reportJob.create({
      data: {
        type,
        status: "PROCESSING",
        from: new Date(from),
        to: new Date(to),
        filters: JSON.stringify(body.filters ?? {}),
        resultFormat: format,
        requestedById: user.sub,
        companyId: user.companyId,
      },
    });

    // In a real system this would enqueue to Redis queue + worker.
    // Here we synchronously generate CSV and mark complete.
    let records: any[] = [];
    let csv = "";
    let fileName = `${type}-report-${from}-to-${to}.csv`;

    if (type === "daily" || type === "monthly" || type === "hours" || type === "project") {
      records = await db.attendance.findMany({
        where: {
          attendanceDate: { gte: new Date(from), lte: new Date(to) },
          employee: { companyId: user.companyId },
        },
        include: { employee: true, project: true },
        orderBy: { attendanceDate: "asc" },
      });
      csv = ["Date,Employee ID,Name,Project,Check-In,Check-Out,Working Mins,Status,Verification"];
      for (const r of records) {
        csv.push([
          r.attendanceDate.toISOString().split("T")[0],
          r.employee.empId,
          `${r.employee.firstName} ${r.employee.lastName}`,
          r.project?.name ?? "—",
          r.checkIn?.toISOString() ?? "",
          r.checkOut?.toISOString() ?? "",
          r.workingMins,
          r.attendanceStatus,
          r.verificationStatus,
        ].join(","));
      }
    } else if (type === "late") {
      records = await db.attendance.findMany({
        where: {
          attendanceDate: { gte: new Date(from), lte: new Date(to) },
          attendanceStatus: "LATE",
          employee: { companyId: user.companyId },
        },
        include: { employee: true },
        orderBy: { attendanceDate: "asc" },
      });
      csv = ["Date,Employee ID,Name,Late Minutes,Check-In"];
      for (const r of records) {
        csv.push([
          r.attendanceDate.toISOString().split("T")[0],
          r.employee.empId,
          `${r.employee.firstName} ${r.employee.lastName}`,
          r.lateMins,
          r.checkIn?.toISOString() ?? "",
        ].join(","));
      }
      fileName = `late-report-${from}-to-${to}.csv`;
    } else if (type === "absence") {
      const emps = await db.employee.findMany({ where: { companyId: user.companyId, status: "ACTIVE" } });
      const allRecs = await db.attendance.findMany({
        where: { attendanceDate: { gte: new Date(from), lte: new Date(to) }, employee: { companyId: user.companyId } },
      });
      const seen = new Set(allRecs.map((r) => `${r.employeeId}_${r.attendanceDate.toISOString().split("T")[0]}`));
      csv = ["Date,Employee ID,Name"];
      const days: Date[] = [];
      const cur = new Date(from); cur.setHours(0, 0, 0, 0);
      const endD = new Date(to);
      while (cur <= endD) {
        const d = cur.getDay();
        if (d !== 0 && d !== 6) days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      for (const day of days) {
        const dayStr = day.toISOString().split("T")[0];
        for (const emp of emps) {
          if (!seen.has(`${emp.id}_${dayStr}`)) {
            csv.push([dayStr, emp.empId, `${emp.firstName} ${emp.lastName}`].join(","));
          }
        }
      }
      fileName = `absence-report-${from}-to-${to}.csv`;
    }

    const csvContent = csv.join("\n");
    const resultUrl = `/api/v1/reports/jobs/${job.id}/download`;

    await db.reportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultUrl,
      },
    });

    // Store CSV content in memory (in production: S3/OSS)
    (globalThis as any).__reportCache = (globalThis as any).__reportCache ?? new Map();
    (globalThis as any).__reportCache.set(job.id, { csv: csvContent, fileName });

    return apiSuccess({
      jobId: job.id,
      status: "COMPLETED",
      downloadUrl: resultUrl,
      fileName,
      recordCount: records.length,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
