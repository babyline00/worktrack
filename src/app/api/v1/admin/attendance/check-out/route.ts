import { db } from "@/lib/db";
import {
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
  formatTimeInTimezone,
  formatMins,
  auditLog,
} from "@/lib/v1";
import { emitCheckout } from "@/lib/realtime-server";
import { requireCompanyRole } from "@/lib/api-auth";

export const runtime = "nodejs";

// POST /api/v1/admin/attendance/check-out
// Body: { attendanceId, latitude, longitude, accuracy, notes? }
// Admin can check out any employee's open session
export async function POST(req: Request) {
  try {
    const auth = await requireCompanyRole(["SUPER_ADMIN", "ADMIN"]);
    if (auth.error) return auth.error;
    const user = { sub: auth.userId, companyId: auth.companyId, role: "ADMIN" };
    const body = await req.json().catch(() => ({}));
    const { attendanceId, latitude, longitude, accuracy, notes } = body;

    if (!attendanceId) throw ERRORS.VALIDATION("attendanceId is required");
    if (isNaN(latitude) || isNaN(longitude)) throw ERRORS.VALIDATION("Valid latitude and longitude are required");

    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { employee: { include: { company: true } }, project: true },
    });
    if (!attendance) throw ERRORS.NOT_FOUND("Attendance record not found");
    if (attendance.employee.companyId !== user.companyId) throw ERRORS.FORBIDDEN();
    if (!attendance.checkIn) throw ERRORS.NOT_CHECKED_IN();
    if (attendance.checkOut) throw ERRORS.ALREADY_CHECKED_OUT();

    // Geofence check
    const distance = attendance.project?.lat && attendance.project?.lng
      ? haversineMeters(attendance.project.lat, attendance.project.lng, latitude, longitude)
      : 0;
    const projectRadius = attendance.project?.radiusM ?? 200;
    const isOutside = distance > projectRadius;

    const serverReceivedAt = new Date();
    const workingMins = Math.max(0, Math.round((serverReceivedAt.getTime() - attendance.checkIn.getTime()) / 60000));

    // Update attendance
    const updated = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: serverReceivedAt,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutAccuracy: accuracy,
        checkOutLocation: attendance.project?.location ?? null,
        checkOutCapturedAt: serverReceivedAt,
        checkOutServerReceivedAt: serverReceivedAt,
        checkOutDeviceId: `ADMIN-${user.sub}`,
        workingMins,
        sessionStatus: "COMPLETED",
        insideGeofence: !isOutside,
        distanceFromProject: distance,
        verificationStatus: isOutside ? "FLAGGED" : "FLAGGED", // Admin check-out always flagged
        notes: (attendance.notes ? attendance.notes + "\n" : "") + (notes ?? `Admin check-out by ${user.email}`),
      },
    });

    // Save checkout location
    await db.attendanceLocation.create({
      data: {
        attendanceId: attendance.id,
        latitude,
        longitude,
        accuracy,
        recordedAt: serverReceivedAt,
        source: "ADMIN",
        insideGeofence: distance <= (attendance.project?.radiusM ?? 200),
        distanceFromProject: distance,
      },
    });

    // Notification
    await db.notification.create({
      data: {
        companyId: attendance.employee.companyId,
        type: "ATTENDANCE",
        title: `${attendance.employee.firstName} checked out by admin`,
        description: `${formatTimeInTimezone(serverReceivedAt, attendance.employee.company.timezone)} • ${formatMins(workingMins)} worked`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    emitCheckout({ employeeId: attendance.employeeId, employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}` });

    // Audit log
    await auditLog({
      action: "ADMIN_CHECK_OUT",
      entity: "attendance",
      entityId: attendance.id,
      performedById: user.sub,
      companyId: user.companyId,
      newValue: {
        checkOut: updated.checkOut?.toISOString(),
        workingMinutes: workingMins,
        latitude,
        longitude,
        accuracy,
      },
      reason: notes ?? `Admin check-out by ${user.email}`,
      req,
    });

    return apiSuccess({
      attendance: {
        id: updated.id,
        status: updated.sessionStatus,
        checkInAt: updated.checkIn?.toISOString(),
        checkOutAt: updated.checkOut?.toISOString(),
        workingMinutes: workingMins,
        workingTime: formatMins(workingMins),
        insideGeofence: !isOutside,
        distanceFromProject: distance,
        verificationStatus: updated.verificationStatus,
      },
      message: "Employee checked out successfully",
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/admin/check-out] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}