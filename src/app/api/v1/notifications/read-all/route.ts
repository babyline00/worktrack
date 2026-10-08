import { db } from "@/lib/db";
import { requireAuth, notificationWriteScope, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// PATCH /api/v1/notifications/read-all
export async function PATCH(req: Request) {
  try {
    // Was requireRole([SUPER_ADMIN, ADMIN, MANAGER]), so every employee got a
    // 403 and the phone's "Mark all read" could never succeed. The write scope
    // keeps an employee to their own rows.
    const user = await requireAuth(req);
    const result = await db.notification.updateMany({
      where: { AND: [notificationWriteScope(user), { unread: true }] },
      data: { unread: false },
    });
    return apiSuccess({ success: true, updated: result.count });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}