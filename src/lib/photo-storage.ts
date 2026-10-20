// Attendance photo storage.
//
// Photos used to be written to `public/uploads/...`, which works on a long
// running Node server but not on serverless hosts: Vercel's filesystem is
// read-only, so `mkdir` failed and every photo check-in/check-out returned a
// 500. The bytes are therefore kept in the database and served through an
// authenticated route.
//
// Swapping in S3/R2/Vercel Blob later only needs `storeAttendancePhoto` and the
// serving route changed — callers already work in terms of the returned URL.
import { db } from "@/lib/db";

/** Guards against a pathological upload before it reaches the database. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function storeAttendancePhoto(opts: {
  attendanceId: string;
  type: "CHECK_IN" | "CHECK_OUT";
  buffer: Buffer;
  mimeType: string;
  employeeEmpId: string;
  capturedAt?: Date | null;
}) {
  // Pre-generate the photo ID to avoid the second DB write for photoUrl.
  // Use a CUID-like prefix + timestamp + random for uniqueness.
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const photoUrl = `/api/v1/attendance/photo/${photoId}`;

  const photo = await db.attendancePhoto.create({
    data: {
      id: photoId,
      attendanceId: opts.attendanceId,
      type: opts.type,
      // Stable, human-inspectable key even though nothing is written to disk.
      storageKey: `attendance/${opts.employeeEmpId}/${Date.now()}-${opts.type.toLowerCase()}`,
      mimeType: opts.mimeType,
      fileSize: opts.buffer.byteLength,
      capturedAt: opts.capturedAt ?? null,
      // Prisma wants a Uint8Array view; Buffer satisfies that at runtime.
      data: new Uint8Array(opts.buffer),
      photoUrl,
    },
  });

  return { id: photo.id, photoUrl, fileSize: photo.fileSize, storageKey: photo.storageKey };
}