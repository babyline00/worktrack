import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/late?from=&to=
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const from = fromStr ? new Date(fromStr) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = toStr ? new Date(toStr) : new Date();
    to.setHours(23, 59, 59, 999);

    const records = await db.attendance.findMany({
      where: {
        attendanceDate: { gte: from, lte: to },
        attendanceStatus: "LATE",
        employee: { companyId: user.companyId },
      },
      include: { employee: true, project: true },
      orderBy: { attendanceDate: "desc" },
    });

    return apiSuccess({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      summary: {
        totalLate: records.length,
        totalLateMins: records.reduce((s, r) => s + r.lateMins, 0),
        uniqueEmployees: new Set(records.map((r) => r.employeeId)).size,
      },
      records: records.map((r) => ({
        date: r.attendanceDate.toISOString().split("T")[0],
        employeeId: r.employee.empId,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        project: r.project?.name ?? "—",
        checkIn: r.checkIn?.toISOString() ?? null,
        lateMinutes: r.lateMins,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
