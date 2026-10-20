import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  auditLog,
  formatTimeInTimezone,
  formatMins,
} from "@/lib/v1";
import { emitCheckin, emitCheckout } from "@/lib/realtime-server";

export const runtime = "nodejs";

// POST /api/v1/admin/attendance/override
// Body: { attendanceId, action: "check_in" | "check_out" | "undo_checkout" | "set_status", checkInAt?, checkOutAt?, sessionStatus?, workingMins?, reason }
// Admin can override any attendance status
export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    if (auth.error) return auth.error;
    const user = { sub: auth.userId, companyId: auth.companyId, role: "ADMIN" };
    const body = await req.json().catch(() => ({}));
    const { attendanceId, action, checkInAt, checkOutAt, sessionStatus, workingMins, reason } = body;

    if (!attendanceId) throw ERRORS.VALIDATION("attendanceId is required");
    if (!action) throw ERRORS.VALIDATION("action is required");

    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { employee: { include: { company: true } }, project: true },
    });
    if (!attendance) throw ERRORS.NOT_FOUND("Attendance record not found");
    if (attendance.employee.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    const oldValue = {
      checkIn: attendance.checkIn?.toISOString() ?? null,
      checkOut: attendance.checkOut?.toISOString() ?? null,
      sessionStatus: attendance.sessionStatus,
      workingMins: attendance.workingMins,
    };

    const serverReceivedAt = new Date();
    let updateData: any = {};

    switch (action) {
      case "check_in":
        if (attendance.checkIn && !attendance.checkOut) {
          throw new ApiError("ALREADY_CHECKED_IN", "Session already has check-in without check-out", 409);
        }
        if (attendance.checkIn && attendance.checkOut) {
          // Create new session
          updateData = {
            checkIn: checkInAt ? new Date(checkInAt) : serverReceivedAt,
            checkInLat: attendance.checkInLat,
            checkInLng: attendance.checkInLng,
            checkInAccuracy: attendance.checkInAccuracy,
            checkInLocation: attendance.checkInLocation,
            checkInCapturedAt: checkInAt ? new Date(checkInAt) : null,
            checkInServerReceivedAt: serverReceivedAt,
            checkInDeviceId: "ADMIN-" + user.sub,
            sessionStatus: "WORKING",
            attendanceStatus: "PRESENT",
            verificationStatus: "FLAGGED",
            checkOut: null,
            checkOutLat: null,
            checkOutLng: null,
            checkOutAccuracy: null,
            checkOutLocation: null,
            checkOutCapturedAt: null,
            checkOutServerReceivedAt: null,
            checkOutDeviceId: null,
            workingMins: 0,
            insideGeofence: true,
            distanceFromProject: 0,
            notes: (attendance.notes ?? "") + "\n" + (reason ?? `Admin check-in by ${user.email}`),
          };
        } else {
          updateData = {
            checkIn: checkInAt ? new Date(checkInAt) : serverReceivedAt,
            checkInLat: attendance.checkInLat,
            checkInLng: attendance.checkInLng,
            checkInAccuracy: attendance.checkInAccuracy,
            checkInLocation: attendance.checkInLocation,
            checkInCapturedAt: checkInAt ? new Date(checkInAt) : null,
            checkInServerReceivedAt: serverReceivedAt,
            checkInDeviceId: "ADMIN-" + user.sub,
            sessionStatus: "WORKING",
            attendanceStatus: "PRESENT",
            verificationStatus: "FLAGGED",
            notes: (attendance.notes ?? "") + "\n" + (reason ?? `Admin check-in by ${user.email}`),
          };
        }
        break;

      case "check_out":
        if (!attendance.checkIn) throw ERRORS.NOT_CHECKED_IN();
        if (attendance.checkOut && action !== "force_check_out") {
          throw ERRORS.ALREADY_CHECKED_OUT();
        }
        const workingMinsCalc = workingMins ?? Math.max(0, Math.round((serverReceivedAt.getTime() - attendance.checkIn.getTime()) / 60000));
        updateData = {
          checkOut: checkOutAt ? new Date(checkOutAt) : serverReceivedAt,
          checkOutLat: attendance.checkOutLat,
          checkOutLng: attendance.checkOutLng,
          checkOutAccuracy: attendance.checkOutAccuracy,
          checkOutLocation: attendance.project?.location ?? null,
          checkOutCapturedAt: checkOutAt ? new Date(checkOutAt) : null,
          checkOutServerReceivedAt: serverReceivedAt,
          checkOutDeviceId: "ADMIN-" + user.sub,
          workingMins: workingMinsCalc,
          sessionStatus: "COMPLETED",
          insideGeofence: true,
          distanceFromProject: 0,
          verificationStatus: "FLAGGED",
          notes: (attendance.notes ?? "") + "\n" + (reason ?? `Admin check-out by ${user.email}`),
        };
        break;

      case "undo_checkout":
        if (!attendance.checkOut) throw new ApiError("NOT_CHECKED_OUT", "No check-out to undo", 400);
        updateData = {
          checkOut: null,
          checkOutLat: null,
          checkOutLng: null,
          checkOutAccuracy: null,
          checkOutLocation: null,
          checkOutCapturedAt: null,
          checkOutServerReceivedAt: null,
          checkOutDeviceId: null,
          workingMins: 0,
          sessionStatus: "WORKING",
          verificationStatus: attendance.verificationStatus === "FLAGGED" ? "FLAGGED" : "VERIFIED",
          notes: (attendance.notes ?? "") + "\n" + (reason ?? `Admin undo check-out by ${user.email}`),
        };
        break;

      case "set_status":
        if (!sessionStatus) throw ERRORS.VALIDATION("sessionStatus is required for set_status action");
        updateData = {
          sessionStatus,
          ...(workingMins !== undefined && { workingMins }),
        };
        break;

      default:
        throw ERRORS.VALIDATION("Invalid action");
    }

    const updated = await db.attendance.update({
      where: { id: attendanceId },
      data: updateData,
    });

    // Audit log
    await auditLog({
      action: `ADMIN_${action.toUpperCase()}`,
      entity: "attendance",
      entityId: attendanceId,
      performedById: user.sub,
      companyId: user.companyId,
      oldValue,
      newValue: {
        checkIn: updated.checkIn?.toISOString() ?? null,
        checkOut: updated.checkOut?.toISOString() ?? null,
        sessionStatus: updated.sessionStatus,
        workingMins: updated.workingMins,
      },
      reason: reason ?? `Admin ${action} by ${user.email}`,
      req,
    });

    // Emit real-time events
    if (action === "check_in") {
      emitCheckin({ employeeId: attendance.employeeId, employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}` });
    } else if (action === "check_out" || action === "force_check_out") {
      emitCheckout({ employeeId: attendance.employeeId, employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}` });
    }

    return apiSuccess({
      attendance: {
        id: updated.id,
        status: updated.sessionStatus,
        checkInAt: updated.checkIn?.toISOString() ?? null,
        checkOutAt: updated.checkOut?.toISOString() ?? null,
        workingMinutes: updated.workingMins,
        workingTime: formatMins(updated.workingMins),
        verificationStatus: updated.verificationStatus,
      },
      message: `Attendance ${action} completed`,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/admin/attendance/override] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}