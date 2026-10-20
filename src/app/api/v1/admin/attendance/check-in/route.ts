import { db } from "@/lib/db";
import {
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
  calculateLateMins,
  nowInTimezone,
  closeStaleSessions,
  maxWorkingCapInstant,
  autoCloseAtMaxHours,
  formatTimeInTimezone,
  auditLog,
} from "@/lib/v1";
import { emitCheckin } from "@/lib/realtime-server";
import { requireCompanyRole } from "@/lib/api-auth";

export const runtime = "nodejs";

// POST /api/v1/admin/attendance/check-in
// Body: { employeeId, projectId, latitude, longitude, accuracy, notes? }
// Admin can check in any employee (no photo required for admin-initiated)
export async function POST(req: Request) {
  try {
    const auth = await requireCompanyRole(["SUPER_ADMIN", "ADMIN"]);
    if (auth.error) return auth.error;
    const user = { sub: auth.userId, companyId: auth.companyId, role: "ADMIN" };
    const body = await req.json().catch(() => ({}));
    const { employeeId, projectId, latitude, longitude, accuracy, notes } = body;

    // Required fields
    if (!employeeId) throw ERRORS.VALIDATION("employeeId is required");
    if (!projectId) throw ERRORS.VALIDATION("projectId is required");
    if (isNaN(latitude) || isNaN(longitude)) throw ERRORS.VALIDATION("Valid latitude and longitude are required");

    // Verify employee exists and belongs to admin's company
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: { company: true },
    });
    if (!employee) throw ERRORS.NOT_FOUND("Employee not found");
    if (employee.companyId !== user.companyId) throw ERRORS.FORBIDDEN();
    if (employee.status !== "ACTIVE") throw ERRORS.EMPLOYEE_INACTIVE();

    // Verify project exists and is active
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw ERRORS.NOT_FOUND("Project not found");
    if (project.status !== "ACTIVE") throw new ApiError("PROJECT_INACTIVE", "Project is not active.", 400);
    if (project.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    // Verify employee is assigned to project
    const assignment = await db.assignment.findUnique({
      where: { employeeId_projectId: { employeeId: employee.id, projectId: project.id } },
    });
    if (!assignment || assignment.status !== "ACTIVE") {
      throw new ApiError("NOT_ASSIGNED", "Employee is not assigned to this project.", 403);
    }

    // Close any stale sessions from previous days
    await closeStaleSessions({
      employeeId: employee.id,
      companyId: employee.companyId,
      timezone: employee.company.timezone,
    });

    // Check for existing open session
    const { startOfDay } = nowInTimezone(employee.company.timezone);
    let openSession = await db.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { not: null },
        checkOut: null,
      },
      include: { project: { select: { name: true } } },
    });

    // Auto-close if session exceeded max working hours
    if (openSession?.checkIn) {
      const capAt = maxWorkingCapInstant(openSession.checkIn);
      if (capAt) {
        await autoCloseAtMaxHours({
          attendanceId: openSession.id,
          checkIn: openSession.checkIn,
          capAt,
          employeeId: employee.id,
          companyId: employee.companyId,
          projectName: openSession.project?.name,
        });
        openSession = null;
      }
    }

    if (openSession) throw ERRORS.ALREADY_CHECKED_IN();

    // GPS accuracy check (use company setting or default 50m)
    const maxAccuracySetting = await db.setting.findUnique({
      where: { companyId_key: { companyId: employee.companyId, key: "MAX_GPS_ACCURACY" } },
    });
    const maxAccuracy = maxAccuracySetting ? parseInt(maxAccuracySetting.value) : 50;
    if (accuracy > maxAccuracy) throw ERRORS.GPS_ACCURACY_TOO_LOW();

    // Geofence check
    if (project.lat && project.lng) {
      const distance = haversineMeters(project.lat, project.lng, latitude, longitude);
      if (distance > project.radiusM) {
        throw ERRORS.OUTSIDE_GEOFENCE(distance, project.radiusM);
      }
    }

    // Determine shift & late status
    let shiftId: string | null = null;
    let lateMins = 0;
    let attendanceStatus = "PRESENT";
    const shift = await db.shift.findFirst({ where: { companyId: employee.companyId } });
    if (shift) {
      shiftId = shift.id;
      lateMins = calculateLateMins(new Date(), shift.startTime, shift.graceMins);
      if (lateMins > 0) attendanceStatus = "LATE";
    }

    // Create attendance record (admin check-in doesn't require photo)
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
        checkInCapturedAt: serverReceivedAt,
        checkInServerReceivedAt: serverReceivedAt,
        checkInDeviceId: `ADMIN-${user.sub}`,
        sessionStatus: "WORKING",
        attendanceStatus,
        verificationStatus: "FLAGGED", // Admin check-in flagged for review
        insideGeofence: distance <= project.radiusM,
        distanceFromProject: distance,
        lateMins,
        notes: notes ?? `Admin check-in by ${user.email}`,
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
        source: "ADMIN",
        insideGeofence: distance <= project.radiusM,
        distanceFromProject: distance,
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        companyId: employee.companyId,
        type: "ATTENDANCE",
        title: `${employee.firstName} checked in by admin${lateMins > 0 ? " late" : ""}`,
        description: `${formatTimeInTimezone(serverReceivedAt, employee.company.timezone)} • ${project.name}`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    // Broadcast via WebSocket
    emitCheckin({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}` });

    // Audit log
    await auditLog({
      action: "ADMIN_CHECK_IN",
      entity: "attendance",
      entityId: attendance.id,
      performedById: user.sub,
      companyId: user.companyId,
      newValue: {
        checkIn: attendance.checkIn?.toISOString(),
        projectId: project.id,
        projectName: project.name,
        latitude,
        longitude,
        accuracy,
      },
      reason: notes ?? `Admin check-in by ${user.email}`,
      req,
    });

    return apiSuccess({
      attendance: {
        id: attendance.id,
        status: attendance.sessionStatus,
        attendanceStatus: attendance.attendanceStatus,
        verificationStatus: attendance.verificationStatus,
        projectId: project.id,
        projectName: project.name,
        checkInAt: serverReceivedAt.toISOString(),
        location: {
          latitude,
          longitude,
          accuracy,
          insideGeofence: attendance.insideGeofence,
          distanceFromProject: distance,
        },
        lateMinutes: lateMins,
      },
      message: "Employee checked in successfully",
    }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/admin/check-in] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}