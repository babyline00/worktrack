import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/working-hours?from=2026-10-01&to=2026-10-31
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
        employee: { companyId: user.companyId },
      },
      include: { employee: true },
    });

    const byEmployee = new Map();
    for (const r of records) {
      if (!byEmployee.has(r.employeeId)) {
        byEmployee.set(r.employeeId, {
          employeeId: r.employee.empId,
          name: `${r.employee.firstName} ${r.employee.lastName}`,
          department: r.employee.departmentId,
          totalMins: 0,
          sessions: 0,
        });
      }
      const e = byEmployee.get(r.employeeId);
      e.totalMins += r.workingMins;
      e.sessions++;
    }

    return apiSuccess({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      employees: Array.from(byEmployee.values()).map((e: any) => ({
        ...e,
        totalHours: Math.round((e.totalMins / 60) * 10) / 10,
        avgHoursPerDay: e.sessions > 0 ? Math.round((e.totalMins / e.sessions / 60) * 10) / 10 : 0,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
