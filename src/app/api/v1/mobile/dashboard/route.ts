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
    if (!user.companyId) throw ERRORS.FORBIDDEN("Token is not scoped to a company");

    const { startOfDay } = nowInTimezone();

    // These four reads used to be awaited one after another, so every request
    // paid four serialised database round-trips. None of them needs another's
    // result: the employee is looked up by `user.employeeId`, and the setting
    // by `user.companyId` — both are already on the verified token, not
    // discovered by an earlier query. Run them together.
    const [employee, accuracySetting, todaySessions, recent] = await Promise.all([
      db.employee.findUnique({
        where: { id: user.employeeId },
        include: {
          company: true,
          assignments: { where: { status: "ACTIVE" }, include: { project: true } },
        },
      }),
      // The accuracy ceiling check-in enforces. Read here so the app can warn
      // before spending an upload on a fix the server would reject anyway.
      db.setting.findUnique({
        where: { companyId_key: { companyId: user.companyId, key: "MAX_GPS_ACCURACY" } },
        select: { value: true },
      }),
      // Today's attendance. An employee can work several sessions in one day, so
      // all of them are read: the live one drives the timer, and the closed ones
      // contribute to the day's total.
      db.attendance.findMany({
        where: { employeeId: user.employeeId, attendanceDate: startOfDay },
        orderBy: { checkIn: "desc" },
        include: {
          project: true,
          // Same shape /mobile/attendance/today reads, so the app can build the
          // session from the dashboard alone.
          photos: { select: { type: true, photoUrl: true } },
          locations: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      }),
      // Recent attendance (last 5). Served from the `[employeeId,
      // attendanceDate]` index.
      db.attendance.findMany({
        where: { employeeId: user.employeeId },
        include: { project: true },
        orderBy: { attendanceDate: "desc" },
        take: 5,
      }),
    ]);

    if (!employee) throw ERRORS.NOT_FOUND("Employee not found");

    // Now that the reads have run in parallel, the employee's company has to be
    // reconciled against the token's. The setting above was already scoped to
    // the token's company, so without this an employee record belonging to a
    // different tenant would still get the rest of that tenant's data.
    if (employee.companyId !== user.companyId) {
      throw ERRORS.FORBIDDEN("Employee record does not belong to this company");
    }

    const maxGpsAccuracy = Number(accuracySetting?.value ?? 50) || 50;

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

        // The full session, in exactly the shape /mobile/attendance/today
        // returns. The app used to fetch that endpoint immediately after this
        // one purely to get the project coordinates, ISO timestamps and last
        // known fix — a second serialised request on every cold start, and
        // again after every check-in and check-out.
        attendance: {
          id: todayAttendance.id,
          project: todayAttendance.project
            ? {
                id: todayAttendance.project.id,
                name: todayAttendance.project.name,
                code: todayAttendance.project.code,
                latitude: todayAttendance.project.lat,
                longitude: todayAttendance.project.lng,
                radius: todayAttendance.project.radiusM,
              }
            : null,
          checkInAt: todayAttendance.checkIn?.toISOString() ?? null,
          checkOutAt: todayAttendance.checkOut?.toISOString() ?? null,
          checkInTime: formatTimeInTimezone(todayAttendance.checkIn, employee.company.timezone),
          checkOutTime: formatTimeInTimezone(todayAttendance.checkOut, employee.company.timezone),
          workingMinutes: todayAttendance.workingMins,
          lateMinutes: todayAttendance.lateMins,
          sessionStatus: todayAttendance.sessionStatus,
          attendanceStatus: todayAttendance.attendanceStatus,
          verificationStatus: todayAttendance.verificationStatus,
          insideGeofence: todayAttendance.insideGeofence,
          distanceFromProject: todayAttendance.distanceFromProject,
          checkInPhoto:
            todayAttendance.photos.find((p) => p.type === "CHECK_IN")?.photoUrl ?? null,
          checkOutPhoto:
            todayAttendance.photos.find((p) => p.type === "CHECK_OUT")?.photoUrl ?? null,
          lastLocation: todayAttendance.locations[0]
            ? {
                latitude: todayAttendance.locations[0].latitude,
                longitude: todayAttendance.locations[0].longitude,
                accuracy: todayAttendance.locations[0].accuracy,
                recordedAt: todayAttendance.locations[0].recordedAt.toISOString(),
                insideGeofence: todayAttendance.locations[0].insideGeofence,
              }
            : null,
        },
      };
    }

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
      // The client needs the same ceiling the server enforces, otherwise it
      // blocks a check-in the server would have accepted (or lets one through
      // only to have it rejected).
      maxGpsAccuracy: maxGpsAccuracy,
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