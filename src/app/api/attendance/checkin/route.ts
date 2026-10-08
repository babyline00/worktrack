import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/attendance/checkin (legacy — used by in-app employee mobile view via NextAuth session)
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
      verificationStatus: body.photo ? "VERIFIED" : "PENDING",
      insideGeofence,
      distanceFromProject: distance,
      workingMins: 0,
      lateMins: attendanceStatus === "LATE" ? Math.round((now.getTime() - lateThreshold.getTime()) / 60000) : 0,
    },
  });

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

  return NextResponse.json({ attendance: record, status: attendanceStatus, insideGeofence });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
