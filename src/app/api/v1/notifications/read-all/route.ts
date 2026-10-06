import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// PATCH /api/v1/notifications/read-all
export async function PATCH(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    await db.notification.updateMany({
      where: { companyId: user.companyId, unread: true },
      data: { unread: false },
    });
    return apiSuccess({ success: true });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
