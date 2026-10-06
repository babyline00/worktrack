import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/attendance/monthly?month=2026-10
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // "2026-10"
    const projectId = url.searchParams.get("projectId");

    const now = new Date();
    const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam.split("-")[1]) - 1 : now.getMonth();
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const where: any = {
      attendanceDate: { gte: from, lte: to },
      employee: { companyId: user.companyId },
    };
    if (projectId) where.projectId = projectId;

    const records = await db.attendance.findMany({
      where,
      include: { employee: true, project: true },
      orderBy: [{ employeeId: "asc" }, { attendanceDate: "asc" }],
    });

    // Group by employee
    const byEmployee = new Map();
    for (const r of records) {
      const key = r.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: r.employee.empId,
          name: `${r.employee.firstName} ${r.employee.lastName}`,
          avatarColor: r.employee.avatarColor,
          days: 0,
          present: 0,
          late: 0,
          totalMins: 0,
          records: [],
        });
      }
      const e = byEmployee.get(key);
      e.days++;
      if (r.attendanceStatus === "PRESENT") e.present++;
      if (r.attendanceStatus === "LATE") e.late++;
      e.totalMins += r.workingMins;
      e.records.push({
        date: r.attendanceDate.toISOString().split("T")[0],
        checkIn: r.checkIn?.toISOString() ?? null,
        checkOut: r.checkOut?.toISOString() ?? null,
        workingMinutes: r.workingMins,
        status: r.attendanceStatus,
      });
    }

    return apiSuccess({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      summary: {
        totalEmployees: byEmployee.size,
        totalRecords: records.length,
        totalMins: records.reduce((s, r) => s + r.workingMins, 0),
      },
      employees: Array.from(byEmployee.values()),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
