import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS, nowInTimezone } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/absence?from=&to=
// Returns employees with no attendance record on each working day in range
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const from = fromStr ? new Date(fromStr) : new Date(new Date().setDate(new Date().getDate() - 7));
    const to = toStr ? new Date(toStr) : new Date();
    to.setHours(23, 59, 59, 999);

    const employees = await db.employee.findMany({ where: { companyId: user.companyId, status: "ACTIVE" } });
    const records = await db.attendance.findMany({
      where: { attendanceDate: { gte: from, lte: to }, employee: { companyId: user.companyId } },
    });

    const recordsByEmpDay = new Set(records.map((r) => `${r.employeeId}_${r.attendanceDate.toISOString().split("T")[0]}`));

    // Build absence list
    const absences: any[] = [];
    const days: Date[] = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    while (cur <= to) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) days.push(new Date(cur)); // skip weekends
      cur.setDate(cur.getDate() + 1);
    }

    for (const day of days) {
      const dayStr = day.toISOString().split("T")[0];
      for (const emp of employees) {
        if (!recordsByEmpDay.has(`${emp.id}_${dayStr}`)) {
          absences.push({
            date: dayStr,
            employeeId: emp.empId,
            name: `${emp.firstName} ${emp.lastName}`,
            department: emp.departmentId,
          });
        }
      }
    }

    return apiSuccess({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      summary: {
        totalAbsences: absences.length,
        uniqueEmployees: new Set(absences.map((a) => a.employeeId)).size,
        workingDays: days.length,
      },
      absences,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
