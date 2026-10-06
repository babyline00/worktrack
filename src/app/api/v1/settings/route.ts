import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/settings
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const settings = await db.setting.findMany({ where: { companyId: user.companyId } });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return apiSuccess({ settings: map });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// PATCH /api/v1/settings
export async function PATCH(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const ops = Object.entries(body).map(([key, value]) =>
      db.setting.upsert({
        where: { companyId_key: { companyId: user.companyId, key } },
        update: { value: String(value) },
        create: { companyId: user.companyId, key, value: String(value) },
      })
    );
    await Promise.all(ops);
    return apiSuccess({ success: true, updated: Object.keys(body).length });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
