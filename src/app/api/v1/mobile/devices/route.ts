import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/mobile/devices
// Body: { deviceId, platform, model, osVersion, appVersion, pushToken }
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const { deviceId, platform, model, osVersion, appVersion, pushToken } = body;

    if (!deviceId) throw ERRORS.VALIDATION("deviceId is required");

    const device = await db.device.upsert({
      where: { userId_deviceId: { userId: user.sub, deviceId } },
      update: {
        platform: platform ?? "ANDROID",
        model: model ?? null,
        osVersion: osVersion ?? null,
        appVersion: appVersion ?? null,
        pushToken: pushToken ?? null,
        lastSeenAt: new Date(),
        status: "ACTIVE",
        employeeId: user.employeeId ?? null,
      },
      create: {
        userId: user.sub,
        employeeId: user.employeeId ?? null,
        deviceId,
        platform: platform ?? "ANDROID",
        model: model ?? null,
        osVersion: osVersion ?? null,
        appVersion: appVersion ?? null,
        pushToken: pushToken ?? null,
        status: "ACTIVE",
      },
    });

    return apiSuccess({ device }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// GET /api/v1/mobile/devices — list current user's devices
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const devices = await db.device.findMany({
      where: { userId: user.sub },
      orderBy: { lastSeenAt: "desc" },
    });
    return apiSuccess({ devices });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
