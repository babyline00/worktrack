import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/attendance/photo/:id
// Session-authenticated counterpart of /api/v1/attendance/photo/:id, for the
// admin web UI (which authenticates with NextAuth cookies, not a JWT).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as any).companyId;

  const photo = await db.attendancePhoto.findUnique({
    where: { id: (await params).id },
    include: { attendance: { select: { companyId: true } } },
  });
  if (!photo || photo.attendance.companyId !== companyId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (!photo.data?.length) {
    return NextResponse.json({ error: "Photo data unavailable" }, { status: 404 });
  }

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType || "image/jpeg",
      "Content-Length": String(photo.data.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}