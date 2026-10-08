import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  formatTimeInTimezone,
  formatMins,
  nowInTimezone,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/dashboard
// Returns employee's current work state, today's attendance, project info
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN("Mobile dashboard is for employee accounts only");

    const { startOfDay } = nowInTimezone();

    const employee = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: {
        company: true,
        assignments: { where: { status: "ACTIVE" }, include: { project: true } },
      },
    });
    if (!employee) throw ERRORS.NOT_FOUND("Employee not found");

    // Today's attendance. An employee can work several sessions in one day, so
    // all of them are read: the live one drives the timer, and the closed ones
    // contribute to the day's total.
    const todaySessions = await db.attendance.findMany({
      where: { employeeId: employee.id, attendanceDate: startOfDay },
      orderBy: { checkIn: "desc" },
      include: { project: true },
    });
    const todayAttendance =
      todaySessions.find((s) => s.checkIn && !s.checkOut) ??
      todaySessions[0];
    const closedMinutes = todaySessions
      .filter((s) => s.checkIn && s.checkOut)
      .reduce((sum, s) => sum + (s.workingMins ?? 0), 0);

    let today: any = {
      date: startOfDay.toISOString().split("T")[0],
      status: "NOT_STARTED",
      project: null,
      checkIn: null,
      checkOut: null,
      workingMinutes: 0,
      sessionCount: 0,
    };

    if (todayAttendance) {
      today = {
        date: startOfDay.toISOString().split("T")[0],
        status: todayAttendance.sessionStatus,
        project: todayAttendance.project
          ? { id: todayAttendance.project.id, name: todayAttendance.project.name, code: todayAttendance.project.code }
          : null,
        checkIn: formatTimeInTimezone(todayAttendance.checkIn, employee.company.timezone),
        checkOut: formatTimeInTimezone(todayAttendance.checkOut, employee.company.timezone),
        // Sum of every closed session today. A session that is still open is
        // excluded because its time is still accruing — the app counts it live
        // from its check-in timestamp.
        workingMinutes: closedMinutes,
        sessionCount: todaySessions.length,
        attendanceId: todayAttendance.id,
        insideGeofence: todayAttendance.insideGeofence,
        verificationStatus: todayAttendance.verificationStatus,
      };
    }

    // Recent attendance (last 5 days)
    const recent = await db.attendance.findMany({
      where: { employeeId: employee.id },
      include: { project: true },
      orderBy: { attendanceDate: "desc" },
      take: 5,
    });

    return apiSuccess({
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.empId,
        avatarColor: employee.avatarColor,
        designation: employee.designation,
        department: employee.departmentId,
      },
      company: {
        name: employee.company.name,
        code: employee.company.code,
        timezone: employee.company.timezone,
      },
      today,
      projects: employee.assignments.map((a) => ({
        id: a.project.id,
        name: a.project.name,
        code: a.project.code,
        status: a.project.status,
        location: a.project.location,
        coords: { latitude: a.project.lat, longitude: a.project.lng },
        radius: a.project.radiusM,
      })),
      recentAttendance: recent.map((r) => ({
        date: r.attendanceDate.toISOString().split("T")[0],
        project: r.project?.name ?? "—",
        checkIn: formatTimeInTimezone(r.checkIn, employee.company.timezone),
        checkOut: formatTimeInTimezone(r.checkOut, employee.company.timezone),
        workingMinutes: r.workingMins,
        workingTime: formatMins(r.workingMins),
        status: r.sessionStatus,
        attendanceStatus: r.attendanceStatus,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/mobile/dashboard] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}
