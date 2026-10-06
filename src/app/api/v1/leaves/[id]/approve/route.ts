import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS, auditLog } from "@/lib/v1";

export const runtime = "nodejs";

// PATCH /api/v1/leaves/:id/approve
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const leave = await db.leaveRequest.findUnique({ where: { id: (await params).id }, include: { employee: true } });
    if (!leave) throw ERRORS.NOT_FOUND("Leave request not found");
    if (leave.employee.companyId !== user.companyId) throw ERRORS.FORBIDDEN();

    const oldValue = { status: leave.status };
    const updated = await db.leaveRequest.update({
      where: { id: (await params).id },
      data: { status: "APPROVED", reviewedBy: user.sub, reviewedAt: new Date() },
    });

    await auditLog({
      action: "LEAVE_APPROVED",
      entity: "leave",
      entityId: (await params).id,
      performedById: user.sub,
      companyId: user.companyId,
      oldValue,
      newValue: { status: "APPROVED" },
      req,
    });

    await db.notification.create({
      data: {
        companyId: user.companyId,
        type: "LEAVE",
        title: `Leave approved`,
        description: `${leave.employee.firstName}'s ${leave.type.toLowerCase()} leave was approved`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    return apiSuccess({ leave: updated });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
