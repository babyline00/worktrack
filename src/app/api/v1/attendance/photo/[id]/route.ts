import { db } from "@/lib/db";
import { requireAuth, apiError, ERRORS, ApiError } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/attendance/photo/:id
// Serves a stored attendance selfie. Photos are company-scoped rather than
// public, so this requires a token for the same company as the record.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(_req);
    if (!user.companyId) throw ERRORS.FORBIDDEN();

    const photo = await db.attendancePhoto.findUnique({
      where: { id: (await params).id },
      include: { attendance: { select: { companyId: true } } },
    });
    if (!photo || photo.attendance.companyId !== user.companyId) {
      throw ERRORS.NOT_FOUND("Photo not found");
    }

    if (!photo.data?.length) {
      // Row exists but the bytes do not (e.g. a record seeded before this
      // change). Say so plainly instead of returning an empty 200 image.
      return new Response("Photo data unavailable", { status: 404 });
    }

    return new Response(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.mimeType || "image/jpeg",
        "Content-Length": String(photo.data.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: err.code, message: err.message, requestId: err.requestId },
        }),
        { status: err.statusCode, headers: { "Content-Type": "application/json" } },
      );
    }
    return apiError(ERRORS.INTERNAL());
  }
}