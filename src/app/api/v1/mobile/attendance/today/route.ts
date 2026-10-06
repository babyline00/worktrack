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

    const att = await db.attendance.findFirst({
      where: { employeeId: emp.id, attendanceDate: startOfDay },
      include: {
        project: true,
        photos: true,
        locations: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
    });

    if (!att) {
      return apiSuccess({
        status: "NOT_STARTED",
        attendance: null,
      });
    }

    return apiSuccess({
      status: att.sessionStatus,
      attendance: {
        id: att.id,
        project: att.project
          ? { id: att.project.id, name: att.project.name, code: att.project.code }
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
