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
    };

    const updateData: any = {};
    if (body.checkInAt) updateData.checkIn = new Date(body.checkInAt);
    if (body.checkOutAt) updateData.checkOut = new Date(body.checkOutAt);
    if (body.workingMinutes !== undefined) {
      updateData.workingMins = body.workingMinutes;
    } else if (body.checkInAt && body.checkOutAt) {
      updateData.workingMins = Math.max(0, Math.round((new Date(body.checkOutAt).getTime() - new Date(body.checkInAt).getTime()) / 60000));
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
        verificationStatus: updated.verificationStatus,
      },
      message: "Attendance adjusted and audit logged",
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
