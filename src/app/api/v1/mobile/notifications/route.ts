import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  paginate,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/notifications
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const { page, limit, skip } = paginate(req);

    const where = {
      OR: [{ userId: user.sub }, { companyId: user.companyId, userId: null }],
    };
    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    return apiSuccess({
      data: items.map((n) => ({
        ...n,
        type: n.type.toLowerCase(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
