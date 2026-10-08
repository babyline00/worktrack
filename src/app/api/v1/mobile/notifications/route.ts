import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  paginate,
  notificationReadScope,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/notifications
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const { page, limit, skip } = paginate(req);

    const where = notificationReadScope(user);
    const [items, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      // Shipped with the list so the phone's bell badge is correct on arrival
      // instead of needing a second request.
      db.notification.count({ where: { AND: [where, { unread: true }] } }),
    ]);

    return apiSuccess({
      data: items.map((n) => ({
        ...n,
        type: n.type.toLowerCase(),
      })),
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
