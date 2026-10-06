import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/attendance/checkout
// body: { employeeId, lat, lng, accuracy, photo (base64), location }
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
    where: { employeeId, date: today },
  });
  if (!existing?.checkIn) {
    return NextResponse.json({ error: "Not checked in yet" }, { status: 400 });
  }
  if (existing.checkOut) {
    return NextResponse.json({ error: "Already checked out" }, { status: 400 });
  }

  const now = new Date();
  const workingMins = Math.max(0, Math.round((now.getTime() - existing.checkIn.getTime()) / 60000));

  const record = await db.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      checkOutLat: body.lat,
      checkOutLng: body.lng,
      checkOutAccuracy: body.accuracy,
      checkOutPhoto: body.photo,
      checkOutLocation: body.location,
      workingMins,
    },
  });

  await db.notification.create({
    data: {
      type: "ATTENDANCE",
      title: `${(session.user as any).name ?? "Employee"} checked out`,
      description: `${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} • ${formatMins(workingMins)} worked`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ attendance: record });
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
