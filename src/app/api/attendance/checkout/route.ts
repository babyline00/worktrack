import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// POST /api/attendance/checkout (legacy — NextAuth session, base64 photo)
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
    include: { project: true },
  });
  if (!existing?.checkIn) return NextResponse.json({ error: "Not checked in yet" }, { status: 400 });
  if (existing.checkOut) return NextResponse.json({ error: "Already checked out" }, { status: 400 });

  const now = new Date();
  const workingMins = Math.max(0, Math.round((now.getTime() - existing.checkIn.getTime()) / 60000));

  // Geofence check for check-out
  let distance = 0;
  let isOutside = false;
  if (existing.project?.lat && existing.project?.lng && body.lat && body.lng) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(body.lat - existing.project.lat);
    const dLng = toRad(body.lng - existing.project.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(existing.project.lat)) * Math.cos(toRad(body.lat)) * Math.sin(dLng / 2) ** 2;
    distance = Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    isOutside = distance > (existing.project.radiusM ?? 200);
  }

  // Save check-out photo if provided (base64)
  let checkOutPhotoUrl: string | null = null;
  if (body.photo) {
    const emp = await db.employee.findUnique({ where: { id: employeeId } });
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const photoDir = join(process.cwd(), "public", "uploads", "attendance", String(y), m, d, emp?.empId ?? "unknown");
    mkdirSync(photoDir, { recursive: true });
    const photoId = crypto.randomUUID();
    const fileName = `${photoId}-checkout.jpg`;
    const filePath = join(photoDir, fileName);
    const base64Data = body.photo.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    writeFileSync(filePath, buffer);
    checkOutPhotoUrl = `/uploads/attendance/${y}/${m}/${d}/${emp?.empId ?? "unknown"}/${fileName}`;
    const storageKey = `attendance/${y}/${m}/${d}/${emp?.empId ?? "unknown"}/${fileName}`;

    await db.attendancePhoto.create({
      data: {
        attendanceId: existing.id,
        type: "CHECK_OUT",
        storageKey,
        photoUrl: checkOutPhotoUrl,
        mimeType: "image/jpeg",
        fileSize: buffer.length,
        capturedAt: now,
      },
    });
  }

  const record = await db.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      checkOutLat: body.lat,
      checkOutLng: body.lng,
      checkOutAccuracy: body.accuracy,
      checkOutLocation: body.location,
      checkOutCapturedAt: now,
      checkOutServerReceivedAt: now,
      workingMins,
      sessionStatus: "COMPLETED",
      insideGeofence: !isOutside,
      distanceFromProject: distance,
      verificationStatus: isOutside ? "FLAGGED" : existing.verificationStatus,
    },
  });

  await db.notification.create({
    data: {
      companyId: existing.companyId,
      type: "ATTENDANCE",
      title: `${user.name ?? "Employee"} checked out${isOutside ? " (outside geofence)" : ""}`,
      description: `${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} • ${formatMins(workingMins)} worked${isOutside ? ` • ${distance}m from project` : ""}`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({
    attendance: record,
    checkOutPhotoUrl,
    geofenceWarning: isOutside
      ? `You checked out ${distance}m outside the project area. This has been flagged for admin review.`
      : null,
  });
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
