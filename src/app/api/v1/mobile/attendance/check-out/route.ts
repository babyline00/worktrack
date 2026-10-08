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
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import crypto from "crypto";

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

    // Find attendance
    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { project: true },
    });
    if (!attendance) throw ERRORS.NOT_FOUND("Attendance record not found");
    if (attendance.employeeId !== employee.id) throw ERRORS.FORBIDDEN();
    if (!attendance.checkIn) throw ERRORS.NOT_CHECKED_IN();
    if (attendance.checkOut) throw ERRORS.ALREADY_CHECKED_OUT();

    // Photo validation
    if (!photoFile.type.startsWith("image/")) throw ERRORS.VALIDATION("Photo must be an image");
    if (photoFile.size > 10 * 1024 * 1024) throw ERRORS.VALIDATION("Photo too large (max 10MB)");

    // Geofence check for check-out — block if outside project area
    const distance = attendance.project?.lat && attendance.project?.lng
      ? haversineMeters(attendance.project.lat, attendance.project.lng, latitude, longitude)
      : 0;
    const projectRadius = attendance.project?.radiusM ?? 200;
    const isOutside = distance > projectRadius;

    // Save photo
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const photoDir = join(process.cwd(), "public", "uploads", "attendance", String(y), m, d, employee.empId);
    mkdirSync(photoDir, { recursive: true });
    const photoId = crypto.randomUUID();
    const ext = photoFile.type === "image/png" ? "png" : "jpg";
    const fileName = `${photoId}-checkout.${ext}`;
    const filePath = join(photoDir, fileName);
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    writeFileSync(filePath, buffer);
    const photoUrl = `/uploads/attendance/${y}/${m}/${d}/${employee.empId}/${fileName}`;
    const storageKey = `attendance/${y}/${m}/${d}/${employee.empId}/${fileName}`;

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
    await db.attendancePhoto.create({
      data: {
        attendanceId: attendance.id,
        type: "CHECK_OUT",
        storageKey,
        photoUrl,
        mimeType: photoFile.type,
        fileSize: photoFile.size,
        capturedAt: capturedAt ? new Date(capturedAt) : serverReceivedAt,
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
        source: "MOBILE",
        insideGeofence: distance <= (attendance.project?.radiusM ?? 200),
        distanceFromProject: distance,
      },
    });

    // Notification
    await db.notification.create({
      data: {
        companyId: employee.companyId,
        type: "ATTENDANCE",
        title: `${employee.firstName} checked out`,
        description: `${formatTimeInTimezone(serverReceivedAt, employee.company.timezone)} • ${formatMins(workingMins)} worked`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    emitCheckout({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}` });

    const response = {
      success: true,
      data: {
        attendance: {
          id: updated.id,
          status: updated.sessionStatus,
          checkInAt: updated.checkIn?.toISOString(),
          checkOutAt: updated.checkOut?.toISOString(),
          workingMinutes: workingMins,
          workingTime: formatMins(workingMins),
          checkOutPhoto: photoUrl,
          insideGeofence: !isOutside,
          distanceFromProject: distance,
          verificationStatus: updated.verificationStatus,
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
