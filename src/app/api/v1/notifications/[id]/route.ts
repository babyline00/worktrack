import { db } from "@/lib/db";
import { requireAuth, notificationWriteScope, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// PATCH /api/v1/notifications/:id/read
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const id = (await params).id;

    // Fetch first and check ownership. This used to `update({ where: { id } })`
    // with no check at all, so any manager could clear a notification belonging
    // to a different company.
    const existing = await db.notification.findUnique({ where: { id } });
    if (!existing) throw ERRORS.NOT_FOUND();

    const scope = notificationWriteScope(user);
    const permitted =
      "userId" in scope && scope.userId
        ? existing.userId === scope.userId
        : existing.companyId === scope.companyId;
    if (!permitted) throw ERRORS.FORBIDDEN();

    await db.notification.update({ where: { id }, data: { unread: false } });
    return apiSuccess({ success: true });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}