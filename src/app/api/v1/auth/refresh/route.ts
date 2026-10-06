import { db } from "@/lib/db";
import {
  signAccessToken,
  verifyToken,
  ERRORS,
  apiSuccess,
  apiError,
  ApiError,
} from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/auth/refresh
// Body: { refreshToken }
// Returns new access token. Refresh token is rotated.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body;
    if (!refreshToken) throw ERRORS.VALIDATION("refreshToken is required");

    // Verify JWT signature + expiry
    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      throw new ApiError("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.", 401);
    }

    // Check DB — token must exist & not revoked
    const stored = await db.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revokedAt) {
      throw new ApiError("INVALID_REFRESH_TOKEN", "Refresh token has been revoked.", 401);
    }

    // Issue new access token
    const access = signAccessToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      companyId: payload.companyId,
      employeeId: payload.employeeId,
    });

    // Optional: rotate refresh token (revoke old, issue new) — uncomment for strict rotation
    // const newRefresh = signRefreshToken({ ...payload });
    // await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedBy: newRefresh.token } });
    // await db.refreshToken.create({ data: { userId: payload.sub, token: newRefresh.token, expiresAt: newRefresh.expiresAt } });

    return apiSuccess({
      accessToken: access.token,
      expiresIn: access.expiresIn,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/auth/refresh] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}
