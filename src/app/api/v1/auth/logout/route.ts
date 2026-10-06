import { db } from "@/lib/db";
import { requireAuth, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/auth/logout
// Body: { refreshToken }
// Revokes the refresh token. Access token remains valid until expiry (15min).
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body;

    if (refreshToken) {
      await db.refreshToken.updateMany({
        where: { token: refreshToken, userId: user.sub },
        data: { revokedAt: new Date() },
      });
    }

    // Optionally revoke all tokens for this user
    // await db.refreshToken.updateMany({ where: { userId: user.sub, revokedAt: null }, data: { revokedAt: new Date() } });

    return apiSuccess({ message: "Logged out successfully" });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
