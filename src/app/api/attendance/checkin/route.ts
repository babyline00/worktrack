import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/attendance/checkin
// body: { employeeId, projectId, lat, lng, accuracy, photo (base64), location }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = session.user as any;
  const employeeId = body.employeeId ?? user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee linked" }, { status: 400 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check existing record
  const existing = await db.attendance.findFirst({
    where: { employeeId, date: today },
  });
  if (existing?.checkIn) {
    return NextResponse.json({ error: "Already checked in today", attendance: existing }, { status: 400 });
  }

  // Determine status (late if after 9:15 AM)
  const now = new Date();
  const lateThreshold = new Date(today);
  lateThreshold.setHours(9, 15, 0, 0);
  const status = now > lateThreshold ? "LATE" : "PRESENT";

  // Verify geofence if project provided
  let insideGeofence = true;
  if (body.projectId) {
    const project = await db.project.findUnique({ where: { id: body.projectId } });
    if (project?.lat && project?.lng && body.lat && body.lng) {
      const distance = haversine(project.lat, project.lng, body.lat, body.lng);
      insideGeofence = distance <= project.radiusM;
    }
  }

  const record = await db.attendance.create({
    data: {
      employeeId,
      projectId: body.projectId,
      date: today,
      checkIn: now,
      checkInLat: body.lat,
      checkInLng: body.lng,
      checkInAccuracy: body.accuracy,
      checkInPhoto: body.photo,
      checkInLocation: body.location,
      status,
      verification: body.photo ? "VERIFIED" : "PENDING",
      insideGeofence,
      workingMins: 0,
    },
  });

  // Create notification
  await db.notification.create({
    data: {
      type: "ATTENDANCE",
      title: `${(session.user as any).name ?? "Employee"} checked in${status === "LATE" ? " late" : ""}`,
      description: `${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} • ${body.location ?? "—"}`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ attendance: record, status, insideGeofence });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
