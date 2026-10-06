import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  nowInTimezone,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/attendance/daily
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const projectId = url.searchParams.get("projectId");
    const { startOfDay } = nowInTimezone();
    const targetDate = date ? new Date(date) : startOfDay;
    targetDate.setHours(0, 0, 0, 0);

    const where: any = {
      attendanceDate: targetDate,
      employee: { companyId: user.companyId },
    };
    if (projectId) where.projectId = projectId;

    const records = await db.attendance.findMany({
      where,
      include: { employee: true, project: true },
      orderBy: { checkIn: "asc" },
    });

    return apiSuccess({
      date: targetDate.toISOString().split("T")[0],
      summary: {
        total: records.length,
        present: records.filter((r) => r.attendanceStatus === "PRESENT").length,
        late: records.filter((r) => r.attendanceStatus === "LATE").length,
        totalWorkingMins: records.reduce((sum, r) => sum + r.workingMins, 0),
      },
      records: records.map((r) => ({
        employeeId: r.employee.empId,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        project: r.project?.name ?? "—",
        checkIn: r.checkIn?.toISOString() ?? null,
        checkOut: r.checkOut?.toISOString() ?? null,
        workingMinutes: r.workingMins,
        sessionStatus: r.sessionStatus,
        attendanceStatus: r.attendanceStatus,
        verificationStatus: r.verificationStatus,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
