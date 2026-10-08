import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/v1";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = (session.user as any).companyId;

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
    if (checkIn && isNaN(checkIn.getTime())) {
      return NextResponse.json({ error: "Invalid check-in time" }, { status: 400 });
    }
    if (checkOut && isNaN(checkOut.getTime())) {
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
    };

    const data: any = { verificationStatus: "FLAGGED" };
    if (checkIn) data.checkIn = checkIn;
    if (checkOut) data.checkOut = checkOut;
    if (body.workingMinutes !== undefined && body.workingMinutes !== null) {
      const mins = Number(body.workingMinutes);
      if (!Number.isFinite(mins) || mins < 0) {
        return NextResponse.json(
          { error: "Working minutes must be a positive number" },
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
    // An open session that has been given a check-out is now finished.
    if (data.checkOut || data.workingMins !== undefined) {
      data.sessionStatus = "COMPLETED";
    }

    const updated = await db.attendance.update({ where: { id }, data });

    await auditLog({
      action: "ATTENDANCE_ADJUSTED",
      entity: "Attendance",
      entityId: id,
      companyId,
      performedById: (session.user as any).id,
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