import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";
import crypto from "crypto";

export const runtime = "nodejs";

// POST /api/v1/mobile/attendance/photo-upload-url
// Returns a path/key for direct upload (in this simple impl, we generate the URL the client will PUT to)
// In production this would return a presigned S3/OSS URL
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const body = await req.json().catch(() => ({}));
    const { type, fileName } = body; // type: CHECK_IN | CHECK_OUT
    if (!type) throw ERRORS.VALIDATION("type is required (CHECK_IN or CHECK_OUT)");

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const fileKey = `attendance/${y}/${m}/${d}/${user.employeeId}/${crypto.randomUUID()}-${type.toLowerCase()}.jpg`;

    // In a real S3 setup, this would be a presigned PUT URL
    // Here we return the upload endpoint that accepts the file
    const uploadUrl = `/api/v1/mobile/attendance/upload?fileKey=${encodeURIComponent(fileKey)}`;

    return apiSuccess({
      uploadUrl,
      fileKey,
      expiresIn: 300,
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
