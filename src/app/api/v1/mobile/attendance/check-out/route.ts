import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
  checkIdempotency,
  storeIdempotency,
  nowInTimezone,
  formatTimeInTimezone,
  formatMins,
} from "@/lib/v1";
import { emitCheckout } from "@/lib/realtime-server";
import { storeAttendancePhoto } from "@/lib/photo-storage";

export const runtime = "nodejs";

// POST /api/v1/mobile/attendance/check-out
// multipart/form-data: attendanceId, latitude, longitude, accuracy, capturedAt, deviceId, photo
export async function POST(req: Request) {
  let idempotencyKey: string | undefined;
  try {
    const idem = checkIdempotency(req);
    if (idem?.cached) return Response.json(idem.cached.body, { status: idem.cached.status });
    idempotencyKey = idem?.key;

    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const formData = await req.formData();
    const attendanceId = formData.get("attendanceId") as string;
    const latitude = parseFloat(formData.get("latitude") as string);
    const longitude = parseFloat(formData.get("longitude") as string);
    const accuracy = parseFloat(formData.get("accuracy") as string);
    const capturedAt = formData.get("capturedAt") as string;
    const deviceId = formData.get("deviceId") as string;
    const photoFile = formData.get("photo") as File | null;

    if (!attendanceId) throw ERRORS.VALIDATION("attendanceId is required");
    if (isNaN(latitude) || isNaN(longitude)) throw ERRORS.VALIDATION("Valid latitude and longitude are required");
    if (!photoFile) throw ERRORS.VALIDATION("Photo is required for check-out");

    const employee = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: { company: true },
    });
    if (!employee) throw ERRORS.NOT_FOUND("Employee not found");

    // Check-in refuses an inactive employee; check-out did not, so a session
    // opened while the account was still active could be closed after the
    // employee was deactivated, and the finalised hours would still be counted.
    if (employee.status !== "ACTIVE") throw ERRORS.EMPLOYEE_INACTIVE();

    // Find attendance
    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { project: true },
    });
    if (!attendance) throw ERRORS.NOT_FOUND("Attendance record not found");
    if (attendance.employeeId !== employee.id) throw ERRORS.FORBIDDEN();
    if (!attendance.checkIn) throw ERRORS.NOT_CHECKED_IN();
    if (attendance.checkOut) {
      // Session already completed - return existing record instead of error
      return apiSuccess({
        attendance: {
          id: attendance.id,
          status: attendance.sessionStatus,
          checkInAt: attendance.checkIn?.toISOString(),
          checkOutAt: attendance.checkOut?.toISOString(),
          workingMinutes: attendance.workingMins,
          workingTime: formatMins(attendance.workingMins),
          checkOutPhoto: attendance.checkOutPhotoId
            ? `/api/v1/attendance/photo/${attendance.checkOutPhotoId}`
            : null,
          insideGeofence: attendance.insideGeofence,
          distanceFromProject: attendance.distanceFromProject,
          verificationStatus: attendance.verificationStatus,
          message: "Session already completed",
        },
      });
    }

    // Photo validation
    if (!photoFile.type.startsWith("image/")) throw ERRORS.VALIDATION("Photo must be an image");
    if (photoFile.size > 10 * 1024 * 1024) throw ERRORS.VALIDATION("Photo too large (max 10MB)");

    // Geofence check for check-out — block if outside project area
    const distance = attendance.project?.lat && attendance.project?.lng
      ? haversineMeters(attendance.project.lat, attendance.project.lng, latitude, longitude)
      : 0;
    const projectRadius = attendance.project?.radiusM ?? 200;
    const isOutside = distance > projectRadius;

    // Pending photo buffer — persisted once the record is updated.
    const now = new Date();
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());

    const serverReceivedAt = new Date();
    const workingMins = Math.max(0, Math.round((serverReceivedAt.getTime() - attendance.checkIn.getTime()) / 60000));

    // Update attendance — mark verification as FLAGGED if outside geofence
    const updated = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: serverReceivedAt,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutAccuracy: accuracy,
        checkOutLocation: attendance.project?.location ?? null,
        checkOutCapturedAt: capturedAt ? new Date(capturedAt) : null,
        checkOutServerReceivedAt: serverReceivedAt,
        checkOutDeviceId: deviceId ?? null,
        workingMins,
        sessionStatus: "COMPLETED",
        insideGeofence: !isOutside,
        distanceFromProject: distance,
        // Flag if checked out outside geofence — admin can review
        verificationStatus: isOutside ? "FLAGGED" : attendance.verificationStatus,
      },
    });

    // Save checkout photo
    const storedPhoto = await storeAttendancePhoto({
      attendanceId: attendance.id,
      type: "CHECK_OUT",
      buffer: photoBuffer,
      mimeType: photoFile.type,
      employeeEmpId: employee.empId,
      capturedAt: capturedAt ? new Date(capturedAt) : serverReceivedAt,
    });

    // Independent writes grouped together: three sequential database round-trips
    // were sitting on the critical path of the request the user is watching a
    // spinner for. Same reasoning as the check-in route.
    await Promise.all([
      // Link the photo back to the session (see check-in route).
      db.attendance.update({
        where: { id: attendance.id },
        data: { checkOutPhotoId: storedPhoto.id },
      }),

      // Save checkout location
      db.attendanceLocation.create({
        data: {
          attendanceId: attendance.id,
          latitude,
          longitude,
          accuracy,
          recordedAt: serverReceivedAt,
          source: "MOBILE",
          insideGeofence: distance <= (attendance.project?.radiusM ?? 200),
          distanceFromProject: distance,
        },
      }),

      // Notification
      db.notification.create({
        data: {
          companyId: employee.companyId,
          type: "ATTENDANCE",
          title: `${employee.firstName} checked out`,
          description: `${formatTimeInTimezone(serverReceivedAt, employee.company.timezone)} • ${formatMins(workingMins)} worked`,
          timeAgo: "Just now",
          unread: true,
        },
      }),
    ]);

    emitCheckout({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}` });

    const response = {
      success: true,
      data: {
        attendance: {
          id: updated.id,
          employeeId: updated.employeeId,
          projectId: updated.projectId,
          shiftId: updated.shiftId,
          attendanceDate: updated.attendanceDate.toISOString(),
          checkIn: updated.checkIn?.toISOString() ?? null,
          checkOut: updated.checkOut?.toISOString() ?? null,
          checkInLat: updated.checkInLat,
          checkInLng: updated.checkInLng,
          checkInAccuracy: updated.checkInAccuracy,
          checkInLocation: updated.checkInLocation,
          checkInCapturedAt: updated.checkInCapturedAt?.toISOString() ?? null,
          checkInServerReceivedAt: updated.checkInServerReceivedAt?.toISOString() ?? null,
          checkOutLat: updated.checkOutLat,
          checkOutLng: updated.checkOutLng,
          checkOutAccuracy: updated.checkOutAccuracy,
          checkOutLocation: updated.checkOutLocation,
          checkOutCapturedAt: updated.checkOutCapturedAt?.toISOString() ?? null,
          checkOutServerReceivedAt: updated.checkOutServerReceivedAt?.toISOString() ?? null,
          workingMins: updated.workingMins,
          lateMins: updated.lateMins,
          sessionStatus: updated.sessionStatus,
          attendanceStatus: updated.attendanceStatus,
          verificationStatus: updated.verificationStatus,
          insideGeofence: updated.insideGeofence,
          distanceFromProject: updated.distanceFromProject,
          checkInPhotoId: updated.checkInPhotoId,
          checkOutPhotoId: updated.checkOutPhotoId,
        },
        geofenceWarning: isOutside
          ? `You checked out ${distance}m outside the project area (allowed: ${projectRadius}m). This has been flagged for admin review.`
          : null,
      },
    };

    if (idempotencyKey) storeIdempotency(idempotencyKey, 200, response);

    return Response.json(response, { status: 200 });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/mobile/check-out] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}
