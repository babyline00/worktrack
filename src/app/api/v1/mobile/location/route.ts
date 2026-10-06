import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
} from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/mobile/location
// Live location tracking during work session
// Body: { attendanceId, latitude, longitude, accuracy, recordedAt }
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const body = await req.json().catch(() => ({}));
    const { attendanceId, latitude, longitude, accuracy, recordedAt } = body;

    if (!attendanceId || isNaN(latitude) || isNaN(longitude)) {
      throw ERRORS.VALIDATION("attendanceId, latitude, longitude are required");
    }

    // Verify attendance belongs to user & is WORKING
    const att = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { project: true },
    });
    if (!att) throw ERRORS.NOT_FOUND("Attendance not found");
    if (att.employeeId !== user.employeeId) throw ERRORS.FORBIDDEN();
    if (att.sessionStatus !== "WORKING") {
      throw new ApiError("NOT_WORKING", "Location updates only allowed during an active work session.", 400);
    }

    // Calculate geofence status
    let insideGeofence = true;
    let distance = 0;
    if (att.project?.lat && att.project?.lng) {
      distance = haversineMeters(att.project.lat, att.project.lng, latitude, longitude);
      insideGeofence = distance <= att.project.radiusM;
    }

    // Save location point
    await db.attendanceLocation.create({
      data: {
        attendanceId,
        latitude,
        longitude,
        accuracy: accuracy ?? 0,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        source: "MOBILE",
        insideGeofence,
        distanceFromProject: distance,
      },
    });

    // If outside geofence & was previously inside, flag + notify
    if (!insideGeofence && att.insideGeofence) {
      await db.attendance.update({
        where: { id: attendanceId },
        data: { insideGeofence: false, distanceFromProject: distance },
      });
      const emp = await db.employee.findUnique({ where: { id: user.employeeId } });
      await db.notification.create({
        data: {
          companyId: user.companyId,
          type: "ALERT",
          title: `${emp?.firstName ?? "Employee"} is outside project geofence`,
          description: `Currently ${distance}m away from ${att.project?.name ?? "project"}`,
          timeAgo: "Just now",
          unread: true,
        },
      });
    } else if (insideGeofence && !att.insideGeofence) {
      await db.attendance.update({
        where: { id: attendanceId },
        data: { insideGeofence: true, distanceFromProject: distance },
      });
    }

    return apiSuccess({
      insideGeofence,
      distanceFromProject: distance,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
