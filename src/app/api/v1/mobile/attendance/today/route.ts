import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  formatTimeInTimezone,
  nowInTimezone,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/attendance/today
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const { startOfDay } = nowInTimezone();
    const emp = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: { company: true },
    });
    if (!emp) throw ERRORS.NOT_FOUND("Employee not found");

    // All of today's sessions. More than one is normal — employees may work
    // split shifts — so the day's totals are aggregated rather than read off
    // whichever record happened to come back first.
    const todaysSessions = await db.attendance.findMany({
      where: { employeeId: emp.id, attendanceDate: startOfDay },
      orderBy: { checkIn: "desc" },
      include: {
        project: true,
        photos: true,
        locations: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
    });

    if (todaysSessions.length === 0) {
      return apiSuccess({
        status: "NOT_STARTED",
        attendance: null,
        totalWorkingMinutes: 0,
        sessionCount: 0,
      });
    }

    // The live session drives the timer and the check-out action; when every
    // session is closed the most recent one stands in for the day.
    const openSession = todaysSessions.find(
      (s) => s.checkIn && !s.checkOut,
    );
    const att = openSession ?? todaysSessions[0];

    const closedMinutes = todaysSessions
      .filter((s) => s.checkOut && s.checkIn)
      .reduce((sum, s) => sum + (s.workingMins ?? 0), 0);

    return apiSuccess({
      status: att.sessionStatus,
      // Day-level totals across every session, so "Total Time" reflects the
      // whole day rather than just the current or latest session. An open
      // session contributes 0 here — its duration is still accruing and the
      // app counts it live from the check-in timestamp.
      totalWorkingMinutes: closedMinutes,
      sessionCount: todaysSessions.length,
      attendance: {
        id: att.id,
        project: att.project
          ? {
              id: att.project.id,
              name: att.project.name,
              code: att.project.code,
              // Needed by the app to pre-check the geofence locally.
              latitude: att.project.lat,
              longitude: att.project.lng,
              radius: att.project.radiusM,
            }
          : null,
        checkInAt: att.checkIn?.toISOString() ?? null,
        checkOutAt: att.checkOut?.toISOString() ?? null,
        checkInTime: formatTimeInTimezone(att.checkIn, emp.company.timezone),
        checkOutTime: formatTimeInTimezone(att.checkOut, emp.company.timezone),
        workingMinutes: att.workingMins,
        lateMinutes: att.lateMins,
        sessionStatus: att.sessionStatus,
        attendanceStatus: att.attendanceStatus,
        verificationStatus: att.verificationStatus,
        insideGeofence: att.insideGeofence,
        distanceFromProject: att.distanceFromProject,
        checkInPhoto: att.photos.find((p) => p.type === "CHECK_IN")?.photoUrl ?? null,
        checkOutPhoto: att.photos.find((p) => p.type === "CHECK_OUT")?.photoUrl ?? null,
        lastLocation: att.locations[0]
          ? {
              latitude: att.locations[0].latitude,
              longitude: att.locations[0].longitude,
              accuracy: att.locations[0].accuracy,
              recordedAt: att.locations[0].recordedAt.toISOString(),
              insideGeofence: att.locations[0].insideGeofence,
            }
          : null,
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
