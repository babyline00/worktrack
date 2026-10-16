import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  auditLog,
  formatMins,
} from "@/lib/v1";

export const runtime = "nodejs";

/**
 * Sanity ceiling for a manually entered duration.
 *
 * Deliberately looser than `MAX_WORKING_HOURS_HARD_CAP`: that cap exists to
 * stop a forgotten check-out quietly becoming a payslip, which is not what a
 * supervisor correcting a record is doing. This only rejects values that cannot
 * be real — a 40-hour "session" is a typo, not a shift. A 12-hour entry that
 * looks wrong is the supervisor's call, and the audit log records who made it.
 */
const MAX_MANUAL_WORKING_MINS = 24 * 60;

// POST /api/v1/attendance/:id/adjust
// Body: { checkInAt?, checkOutAt?, workingMinutes?, reason }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    if (!body.reason) throw ERRORS.VALIDATION("A reason is required for manual adjustment");

    const att = await db.attendance.findUnique({ where: { id: (await params).id } });
    if (!att) throw ERRORS.NOT_FOUND("Attendance not found");
    if (att.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    const oldValue = {
      checkIn: att.checkIn?.toISOString() ?? null,
      checkOut: att.checkOut?.toISOString() ?? null,
      workingMinutes: att.workingMins,
      sessionStatus: att.sessionStatus,
    };

    const updateData: any = {};

    // Explicit nulls are meaningful: an admin closing a session they left open
    // sends `checkOutAt: null`. Previously `if (body.checkOutAt)` swallowed
    // that, so the button silently did nothing.
    const hasCheckIn = "checkInAt" in body;
    const hasCheckOut = "checkOutAt" in body;
    const hasWorking = "workingMinutes" in body;

    const nextCheckIn = hasCheckIn
      ? body.checkInAt
        ? new Date(body.checkInAt)
        : null
      : att.checkIn;
    const nextCheckOut = hasCheckOut
      ? body.checkOutAt
        ? new Date(body.checkOutAt)
        : null
      : att.checkOut;

    if (hasCheckIn) updateData.checkIn = nextCheckIn;
    if (hasCheckOut) updateData.checkOut = nextCheckOut;

    // A check-out before the check-in is always a mistake, and silently
    // clamping the duration to 0 hid it — the record then looked like a
    // legitimate zero-hour day.
    if (nextCheckIn && nextCheckOut && nextCheckOut.getTime() <= nextCheckIn.getTime()) {
      throw ERRORS.VALIDATION("Check-out must be after check-in");
    }

    if (hasWorking) {
      const mins = Number(body.workingMinutes);
      if (!Number.isFinite(mins) || mins < 0 || mins > MAX_MANUAL_WORKING_MINS) {
        throw ERRORS.VALIDATION(
          `Working minutes must be between 0 and ${MAX_MANUAL_WORKING_MINS} (24 hours)`,
        );
      }
      updateData.workingMins = Math.round(mins);
    } else if (nextCheckIn && nextCheckOut) {
      updateData.workingMins = Math.max(
        0,
        Math.round((nextCheckOut.getTime() - nextCheckIn.getTime()) / 60000),
      );
    }

    // Keep the lifecycle consistent with the times. Editing the times on a row
    // that still said WORKING (or NOT_STARTED) left the dashboard reporting a
    // session state that no longer matched the record.
    if (hasCheckIn || hasCheckOut) {
      updateData.sessionStatus =
        nextCheckIn && !nextCheckOut ? "WORKING" : "COMPLETED";
    }

    updateData.verificationStatus = "FLAGGED"; // mark adjusted records

    const updated = await db.attendance.update({
      where: { id: (await params).id },
      data: updateData,
    });

    await auditLog({
      action: "ATTENDANCE_ADJUSTED",
      entity: "attendance",
      entityId: (await params).id,
      performedById: user.sub,
      companyId: user.companyId,
      oldValue,
      newValue: {
        checkIn: updated.checkIn?.toISOString() ?? null,
        checkOut: updated.checkOut?.toISOString() ?? null,
        workingMinutes: updated.workingMins,
        sessionStatus: updated.sessionStatus,
      },
      reason: body.reason,
      req,
    });

    return apiSuccess({
      attendance: {
        id: updated.id,
        checkIn: updated.checkIn?.toISOString() ?? null,
        checkOut: updated.checkOut?.toISOString() ?? null,
        workingMinutes: updated.workingMins,
        workingTime: formatMins(updated.workingMins),
        sessionStatus: updated.sessionStatus,
        verificationStatus: updated.verificationStatus,
      },
      message: "Attendance adjusted and audit logged",
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
