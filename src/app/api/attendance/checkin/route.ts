import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/attendance/checkin (legacy — used by in-app employee mobile view via NextAuth session)
// body: { employeeId, projectId, lat, lng, accuracy, photo (base64), location }
/**
 * Detects a real image from its magic bytes.
 *
 * Buffer.from(x, "base64") does not throw on invalid input — it silently skips
 * characters it cannot decode — so "!!!not-base64!!!" yields bytes and would
 * otherwise be stored as a verified photo.
 */
function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  // GIF: "GIF8"
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return true;
  // WebP: "RIFF" .... "WEBP"
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = session.user as any;
  const employeeId = body.employeeId ?? user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee linked" }, { status: 400 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await db.attendance.findFirst({
    where: { employeeId, attendanceDate: today },
  });
  if (existing?.checkIn) {
    return NextResponse.json({ error: "Already checked in today", attendance: existing }, { status: 400 });
  }

  const now = new Date();
  const lateThreshold = new Date(today);
  lateThreshold.setHours(9, 15, 0, 0);
  const attendanceStatus = now > lateThreshold ? "LATE" : "PRESENT";

  let insideGeofence = true;
  let distance = 0;
  if (body.projectId) {
    const project = await db.project.findUnique({ where: { id: body.projectId } });
    if (project?.lat && project?.lng && body.lat && body.lng) {
      distance = haversine(project.lat, project.lng, body.lat, body.lng);
      insideGeofence = distance <= project.radiusM;
      // Block check-in if outside geofence (unless No Limit / very large radius)
      if (!insideGeofence && project.radiusM < 999999) {
        return NextResponse.json({
          error: `You are ${distance}m outside the allowed project area (radius: ${project.radiusM}m). Please move closer to the project location to check in.`,
          code: "OUTSIDE_GEOFENCE",
          distance,
          allowedRadius: project.radiusM,
        }, { status: 400 });
      }
    }
  }

  const employee = await db.employee.findUnique({ where: { id: employeeId } });

  const record = await db.attendance.create({
    data: {
      companyId: employee?.companyId ?? user.companyId,
      employeeId,
      projectId: body.projectId,
      attendanceDate: today,
      checkIn: now,
      checkInLat: body.lat,
      checkInLng: body.lng,
      checkInAccuracy: body.accuracy,
      checkInLocation: body.location,
      checkInCapturedAt: now,
      checkInServerReceivedAt: now,
      sessionStatus: "WORKING",
      attendanceStatus,
      // Set below once the photo is actually stored. Marking it VERIFIED from
      // the mere presence of a base64 string produced records claiming photo
      // verification while holding no photo at all.
      verificationStatus: "PENDING",
      insideGeofence,
      distanceFromProject: distance,
      workingMins: 0,
      lateMins: attendanceStatus === "LATE" ? Math.round((now.getTime() - lateThreshold.getTime()) / 60000) : 0,
    },
  });

  // Persist the captured selfie. Previously it was used only as a truthiness
  // flag and thrown away, so the record said VERIFIED with no photo behind it.
  let photoStored = false;
  if (body.photo) {
    try {
      // Accept either a bare base64 payload or a full data: URL.
      const raw = String(body.photo);
      const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > 0 && buffer.length <= 10 * 1024 * 1024 && looksLikeImage(buffer)) {
        const photo = await db.attendancePhoto.create({
          data: {
            attendanceId: record.id,
            type: "CHECK_IN",
            storageKey: `attendance/${employee?.empId ?? "unknown"}/${Date.now()}-checkin`,
            photoUrl: "",
            mimeType: String(body.mimeType ?? "image/jpeg"),
            fileSize: buffer.byteLength,
            capturedAt: now,
            data: new Uint8Array(buffer),
          },
        });
        await db.attendancePhoto.update({
          where: { id: photo.id },
          data: { photoUrl: `/api/attendance/photo/${photo.id}` },
        });
        await db.attendance.update({
          where: { id: record.id },
          data: { checkInPhotoId: photo.id, verificationStatus: "VERIFIED" },
        });
        photoStored = true;
      }
    } catch (err) {
      // A bad capture must not lose the attendance record itself; it just
      // stays unverified.
      console.error("[checkin] photo store failed:", err);
    }
  }

  await db.notification.create({
    data: {
      companyId: employee?.companyId ?? user.companyId,
      type: "ATTENDANCE",
      title: `${user.name ?? "Employee"} checked in${attendanceStatus === "LATE" ? " late" : ""}`,
      description: `${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} • ${body.location ?? "—"}`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  // Save initial GPS location to AttendanceLocation for trail tracking
  if (body.lat && body.lng) {
    await db.attendanceLocation.create({
      data: {
        attendanceId: record.id,
        latitude: body.lat,
        longitude: body.lng,
        accuracy: body.accuracy ?? 0,
        recordedAt: now,
        source: "MOBILE",
        insideGeofence,
        distanceFromProject: distance,
      },
    });
  }

  // photoStored tells the caller whether the selfie actually persisted, so a
// failed capture is visible rather than looking like a verified check-in.
return NextResponse.json({
    // `record` predates the photo write, so the persisted verification state is
    // reported explicitly rather than echoing a stale value.
    attendance: { ...record, verificationStatus: photoStored ? "VERIFIED" : "PENDING" },
    status: attendanceStatus,
    insideGeofence,
    photoStored,
  });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
