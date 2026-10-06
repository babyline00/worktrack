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

// GET /api/v1/dashboard/summary
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const { startOfDay } = nowInTimezone();

    const [totalEmployees, todayRecords, onLeave] = await Promise.all([
      db.employee.count({ where: { companyId: user.companyId, status: "ACTIVE" } }),
      db.attendance.findMany({
        where: { attendanceDate: startOfDay, employee: { companyId: user.companyId } },
      }),
      db.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          fromDate: { lte: startOfDay },
          toDate: { gte: startOfDay },
        },
      }),
    ]);

    const present = todayRecords.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").length;
    const workingNow = todayRecords.filter((a) => a.sessionStatus === "WORKING").length;
    const late = todayRecords.filter((a) => a.attendanceStatus === "LATE").length;
    const absent = Math.max(0, totalEmployees - present - onLeave.length);

    return apiSuccess({
      date: startOfDay.toISOString().split("T")[0],
      totalEmployees,
      present,
      workingNow,
      absent,
      late,
      onLeave: onLeave.length,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
