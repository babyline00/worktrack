import { NextResponse } from "next/server";
import { requireCompanyRole, CONFIG_WRITE_ROLES } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/v1";

/**
 * Sanity ceiling for a manually entered duration (24 hours).
 *
 * Looser than the 8-hour auto cap on purpose: that cap stops a forgotten
 * check-out quietly becoming a payslip, which is not what a supervisor
 * correcting a record is doing. This only rejects values that cannot be real —
 * a 40-hour "session" is a typo, not a shift.
 */
const MAX_MANUAL_WORKING_MINS = 24 * 60;

// PATCH /api/attendance/:id
// Manually adjust a record from the admin web UI.
//
// The v1 equivalent (/api/v1/attendance/:id/adjust) authenticates with a JWT,
// which the browser session does not carry — every admin page here is on
// NextAuth cookies. Both routes share the same rules so an adjustment made in
// either place behaves identically.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Role-checked: a manual adjustment rewrites recorded hours, which is pay.
    const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
    if ("error" in auth) return auth.error;
    const { companyId } = auth;

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required for manual adjustment" },
        { status: 400 },
      );
    }

    const id = (await params).id;
    const att = await db.attendance.findUnique({ where: { id } });
    if (!att || att.companyId !== companyId) {
      return NextResponse.json({ error: "Attendance not found" }, { status: 404 });
    }

    const checkIn = body.checkInAt ? new Date(body.checkInAt) : null;
    const checkOut = body.checkOutAt ? new Date(body.checkOutAt) : null;
    if (body.checkInAt && isNaN(checkIn!.getTime())) {
      return NextResponse.json({ error: "Invalid check-in time" }, { status: 400 });
    }
    if (body.checkOutAt && isNaN(checkOut!.getTime())) {
      return NextResponse.json({ error: "Invalid check-out time" }, { status: 400 });
    }
    if (checkIn && checkOut && checkOut < checkIn) {
      return NextResponse.json(
        { error: "Check-out cannot be before check-in" },
        { status: 400 },
      );
    }

    const oldValue = {
      checkIn: att.checkIn?.toISOString() ?? null,
      checkOut: att.checkOut?.toISOString() ?? null,
      workingMinutes: att.workingMins,
      sessionStatus: att.sessionStatus,
    };

    // Explicit nulls are meaningful — an admin closing a session they left open
    // sends `checkOutAt: null`. Truthiness checks swallowed that, so the button
    // silently did nothing.
    const hasCheckIn = "checkInAt" in body;
    const hasCheckOut = "checkOutAt" in body;
    const hasWorking = "workingMinutes" in body && body.workingMinutes !== null;

    const data: any = { verificationStatus: "FLAGGED" };
    if (hasCheckIn) data.checkIn = checkIn;
    if (hasCheckOut) data.checkOut = checkOut;

    if (hasWorking) {
      const mins = Number(body.workingMinutes);
      if (!Number.isFinite(mins) || mins < 0 || mins > MAX_MANUAL_WORKING_MINS) {
        return NextResponse.json(
          {
            error: `Working minutes must be between 0 and ${MAX_MANUAL_WORKING_MINS} (24 hours)`,
          },
          { status: 400 },
        );
      }
      data.workingMins = Math.round(mins);
    } else if (checkIn && checkOut) {
      data.workingMins = Math.max(
        0,
        Math.round((checkOut.getTime() - checkIn.getTime()) / 60000),
      );
    }

    // Keep the lifecycle consistent with the times. Editing the times on a row
    // that still said WORKING left the dashboard reporting a session state that
    // no longer matched the record.
    if (hasCheckIn || hasCheckOut) {
      data.sessionStatus = checkIn && !checkOut ? "WORKING" : "COMPLETED";
    }

    const updated = await db.attendance.update({ where: { id }, data });

    await auditLog({
      action: "ATTENDANCE_ADJUSTED",
      entity: "Attendance",
      entityId: id,
      companyId,
      performedById: auth.userId,
      oldValue,
      newValue: {
        checkIn: updated.checkIn?.toISOString() ?? null,
        checkOut: updated.checkOut?.toISOString() ?? null,
        workingMinutes: updated.workingMins,
      },
      reason,
      req,
    });

    return NextResponse.json({ ok: true, attendance: updated });
  } catch (err: any) {
    console.error("attendance adjust failed", err);
    return NextResponse.json({ error: "Adjustment failed" }, { status: 500 });
  }
}