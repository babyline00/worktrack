import { db } from "@/lib/db";
import {
  requireAuth,
  notificationReadScope,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/notifications/unread-count
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const unreadCount = await db.notification.count({
      where: { AND: [notificationReadScope(user), { unread: true }] },
    });
    return apiSuccess({ unreadCount });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}