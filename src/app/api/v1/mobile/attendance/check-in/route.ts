import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
  calculateLateMins,
  checkIdempotency,
  storeIdempotency,
  nowInTimezone,
  formatTimeInTimezone,
} from "@/lib/v1";
import { emitCheckin } from "@/lib/realtime-server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import crypto from "crypto";

export const runtime = "nodejs";

// POST /api/v1/mobile/attendance/check-in
// multipart/form-data: projectId, latitude, longitude, accuracy, capturedAt, deviceId, deviceModel, appVersion, photo
export async function POST(req: Request) {
  let idempotencyKey: string | undefined;
  try {
    // Idempotency check
    const idem = checkIdempotency(req);
    if (idem?.cached) {
      return Response.json(idem.cached.body, { status: idem.cached.status });
    }
    idempotencyKey = idem?.key;

    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN("Mobile check-in is for employee accounts only");

    const formData = await req.formData();
    const projectId = formData.get("projectId") as string;
    const latitude = parseFloat(formData.get("latitude") as string);
    const longitude = parseFloat(formData.get("longitude") as string);
    const accuracy = parseFloat(formData.get("accuracy") as string);
    const capturedAt = formData.get("capturedAt") as string;
    const deviceId = formData.get("deviceId") as string;
    const deviceModel = formData.get("deviceModel") as string;
    const appVersion = formData.get("appVersion") as string;
    const photoFile = formData.get("photo") as File | null;

    // ============================================================
    // VALIDATIONS (per spec §26)
    // ============================================================

    // 1. Required fields
    if (!projectId) throw ERRORS.VALIDATION("projectId is required");
    if (isNaN(latitude) || isNaN(longitude)) throw ERRORS.VALIDATION("Valid latitude and longitude are required");
    if (!photoFile) throw ERRORS.VALIDATION("Photo is required for check-in");

    // 2. Employee exists & active
    const employee = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: { company: true },
    });
    if (!employee) throw ERRORS.NOT_FOUND("Employee not found");
    if (employee.status !== "ACTIVE") throw ERRORS.EMPLOYEE_INACTIVE();

    // 3. Project exists & active
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw ERRORS.NOT_FOUND("Project not found");
    if (project.status !== "ACTIVE") {
      throw new ApiError("PROJECT_INACTIVE", "Project is not active.", 400);
    }
    if (project.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    // 4. Employee assigned to project
    const assignment = await db.assignment.findUnique({
      where: { employeeId_projectId: { employeeId: employee.id, projectId: project.id } },
    });
    if (!assignment || assignment.status !== "ACTIVE") {
      throw new ApiError("NOT_ASSIGNED", "You are not assigned to this project.", 403);
    }

    // 5. Not already checked in today
    const { startOfDay } = nowInTimezone();
    const existing = await db.attendance.findFirst({
      where: { employeeId: employee.id, attendanceDate: startOfDay },
    });
    if (existing?.checkIn) throw ERRORS.ALREADY_CHECKED_IN();

    // 6. GPS accuracy (use company setting)
    const maxAccuracySetting = await db.setting.findUnique({
      where: { companyId_key: { companyId: employee.companyId, key: "MAX_GPS_ACCURACY" } },
    });
    const maxAccuracy = maxAccuracySetting ? parseInt(maxAccuracySetting.value) : 50;
    if (accuracy > maxAccuracy) throw ERRORS.GPS_ACCURACY_TOO_LOW();

    // 7. Geofence check
    if (project.lat && project.lng) {
      const distance = haversineMeters(project.lat, project.lng, latitude, longitude);
      if (distance > project.radiusM) {
        throw ERRORS.OUTSIDE_GEOFENCE(distance, project.radiusM);
      }
    }

    // 8. Photo validation
    if (!photoFile.type.startsWith("image/")) {
      throw ERRORS.VALIDATION("Photo must be an image file");
    }
    if (photoFile.size > 10 * 1024 * 1024) {
      throw ERRORS.VALIDATION("Photo size must be less than 10MB");
    }

    // ============================================================
    // SAVE PHOTO TO DISK
    // ============================================================
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const photoDir = join(process.cwd(), "public", "uploads", "attendance", String(y), m, d, employee.empId);
    mkdirSync(photoDir, { recursive: true });
    const photoId = crypto.randomUUID();
    const ext = photoFile.type === "image/png" ? "png" : "jpg";
    const fileName = `${photoId}-checkin.${ext}`;
    const filePath = join(photoDir, fileName);
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    writeFileSync(filePath, buffer);
    const photoUrl = `/uploads/attendance/${y}/${m}/${d}/${employee.empId}/${fileName}`;
    const storageKey = `attendance/${y}/${m}/${d}/${employee.empId}/${fileName}`;

    // ============================================================
    // DETERMINE SHIFT & LATE STATUS
    // ============================================================
    let shiftId: string | null = null;
    let lateMins = 0;
    let attendanceStatus = "PRESENT";
    const shift = await db.shift.findFirst({ where: { companyId: employee.companyId } });
    if (shift) {
      shiftId = shift.id;
      lateMins = calculateLateMins(now, shift.startTime, shift.graceMins);
      if (lateMins > 0) attendanceStatus = "LATE";
    }

    // ============================================================
    // CREATE ATTENDANCE RECORD
    // ============================================================
    const serverReceivedAt = new Date();
    const distance = project.lat && project.lng ? haversineMeters(project.lat, project.lng, latitude, longitude) : 0;

    const attendance = await db.attendance.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        projectId: project.id,
        shiftId,
        attendanceDate: startOfDay,
        checkIn: serverReceivedAt,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInAccuracy: accuracy,
        checkInLocation: project.location,
        checkInCapturedAt: capturedAt ? new Date(capturedAt) : null,
        checkInServerReceivedAt: serverReceivedAt,
        checkInDeviceId: deviceId ?? null,
        sessionStatus: "WORKING",
        attendanceStatus,
        verificationStatus: photoFile ? "VERIFIED" : "PENDING",
        insideGeofence: distance <= project.radiusM,
        distanceFromProject: distance,
        lateMins,
        idempotencyKey,
      },
    });

    // Save photo record
    await db.attendancePhoto.create({
      data: {
        attendanceId: attendance.id,
        type: "CHECK_IN",
        storageKey,
        photoUrl,
        mimeType: photoFile.type,
        fileSize: photoFile.size,
        capturedAt: capturedAt ? new Date(capturedAt) : serverReceivedAt,
      },
    });

    // Save initial location
    await db.attendanceLocation.create({
      data: {
        attendanceId: attendance.id,
        latitude,
        longitude,
        accuracy,
        recordedAt: serverReceivedAt,
        insideGeofence: distance <= project.radiusM,
        distanceFromProject: distance,
      },
    });

    // Broadcast via WebSocket for admin dashboard real-time update
    emitCheckin({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}` });

    // Update device last seen
    if (deviceId) {
      await db.device.upsert({
        where: { userId_deviceId: { userId: user.sub, deviceId } },
        update: { lastSeenAt: new Date(), model: deviceModel ?? null, appVersion: appVersion ?? null, status: "ACTIVE" },
        create: {
          userId: user.sub,
          employeeId: employee.id,
          deviceId,
          model: deviceModel ?? null,
          appVersion: appVersion ?? null,
          platform: "ANDROID",
          status: "ACTIVE",
        },
      });
    }

    // Create notification
    await db.notification.create({
      data: {
        userId: null,
        companyId: employee.companyId,
        type: "ATTENDANCE",
        title: `${employee.firstName} checked in${lateMins > 0 ? " late" : ""}`,
        description: `${formatTimeInTimezone(serverReceivedAt, employee.company.timezone)} • ${project.name}`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    // Broadcast via WebSocket
    emitCheckin({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}` });

    const response = {
      success: true,
      data: {
        attendance: {
          id: attendance.id,
          status: attendance.sessionStatus,
          attendanceStatus: attendance.attendanceStatus,
          verificationStatus: attendance.verificationStatus,
          projectId: project.id,
          projectName: project.name,
          checkInAt: serverReceivedAt.toISOString(),
          checkInPhoto: photoUrl,
          location: {
            latitude,
            longitude,
            accuracy,
            insideGeofence: attendance.insideGeofence,
            distanceFromProject: distance,
          },
          lateMinutes: lateMins,
        },
      },
    };

    if (idempotencyKey) storeIdempotency(idempotencyKey, 201, response);

    return Response.json(response, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/mobile/check-in] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}

