import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  formatTimeInTimezone,
  formatMins,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/attendance/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const att = await db.attendance.findUnique({
      where: { id: (await params).id },
      include: {
        employee: true,
        project: true,
        photos: true,
        locations: { orderBy: { recordedAt: "desc" }, take: 20 },
        auditLogs: { include: { performedBy: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!att) throw ERRORS.NOT_FOUND("Attendance not found");
    if (att.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    return apiSuccess({
      id: att.id,
      date: att.attendanceDate.toISOString().split("T")[0],
      employee: {
        id: att.employee.id,
        employeeId: att.employee.empId,
        name: `${att.employee.firstName} ${att.employee.lastName}`,
        avatarColor: att.employee.avatarColor,
      },
      project: att.project
        ? { id: att.project.id, name: att.project.name, code: att.project.code, location: att.project.location }
        : null,
      checkIn: {
        time: formatTimeInTimezone(att.checkIn, "Asia/Karachi"),
        iso: att.checkIn?.toISOString() ?? null,
        capturedAt: att.checkInCapturedAt?.toISOString() ?? null,
        serverReceivedAt: att.checkInServerReceivedAt?.toISOString() ?? null,
        photo: att.photos.find((p) => p.type === "CHECK_IN")?.photoUrl ?? null,
        location: {
          latitude: att.checkInLat,
          longitude: att.checkInLng,
          accuracy: att.checkInAccuracy,
          insideGeofence: att.insideGeofence,
          distanceFromProject: att.distanceFromProject,
          name: att.checkInLocation,
        },
        deviceId: att.checkInDeviceId,
      },
      checkOut: att.checkOut
        ? {
            time: formatTimeInTimezone(att.checkOut, "Asia/Karachi"),
            iso: att.checkOut.toISOString(),
            capturedAt: att.checkOutCapturedAt?.toISOString() ?? null,
            serverReceivedAt: att.checkOutServerReceivedAt?.toISOString() ?? null,
            photo: att.photos.find((p) => p.type === "CHECK_OUT")?.photoUrl ?? null,
            location: {
              latitude: att.checkOutLat,
              longitude: att.checkOutLng,
              accuracy: att.checkOutAccuracy,
              name: att.checkOutLocation,
            },
            deviceId: att.checkOutDeviceId,
          }
        : null,
      workingMinutes: att.workingMins,
      workingTime: formatMins(att.workingMins),
      lateMinutes: att.lateMins,
      sessionStatus: att.sessionStatus,
      attendanceStatus: att.attendanceStatus,
      verificationStatus: att.verificationStatus,
      locationHistory: att.locations.map((l) => ({
        latitude: l.latitude,
        longitude: l.longitude,
        accuracy: l.accuracy,
        recordedAt: l.recordedAt.toISOString(),
        insideGeofence: l.insideGeofence,
        distanceFromProject: l.distanceFromProject,
      })),
      auditHistory: att.auditLogs.map((a) => ({
        action: a.action,
        performedBy: a.performedBy?.name ?? "System",
        oldValue: a.oldValue ? JSON.parse(a.oldValue) : null,
        newValue: a.newValue ? JSON.parse(a.newValue) : null,
        reason: a.reason,
        timestamp: a.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
