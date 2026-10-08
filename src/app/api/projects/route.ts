import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const projects = await db.project.findMany({
    where: { companyId },
    include: {
      assignments: { include: { employee: true } },
      attendance: { where: { attendanceDate: today } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = projects.map((p) => {
    const presentToday = p.attendance.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").length;
    const workingNow = p.attendance.filter((a) => !a.checkOut).length;
    const lateToday = p.attendance.filter((a) => a.attendanceStatus === "LATE").length;
    const absentToday = Math.max(0, p.assignments.length - presentToday);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      client: p.client,
      description: p.description,
      status: p.status.toLowerCase(),
      location: p.location,
      coords: { lat: p.lat ?? 0, lng: p.lng ?? 0 },
      radiusM: p.radiusM,
      startDate: p.startDate?.toISOString().split("T")[0] ?? "",
      endDate: p.endDate?.toISOString().split("T")[0],
      totalEmployees: p.assignments.length,
      presentToday,
      workingNow,
      lateToday,
      absentToday,
    };
  });

  return NextResponse.json({ projects: result });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const body = await req.json();

  const project = await db.project.create({
    data: {
      code: body.code,
      name: body.name,
      client: body.client,
      description: body.description,
      status: (body.status ?? "ACTIVE").toUpperCase(),
      location: body.location,
      lat: body.lat ? parseFloat(body.lat) : (body.latitude ? parseFloat(body.latitude) : null),
      lng: body.lng ? parseFloat(body.lng) : (body.longitude ? parseFloat(body.longitude) : null),
      radiusM: parseInt(body.geofenceRadius ?? body.radiusM ?? "200") === 0 ? 9999999 : parseInt(body.geofenceRadius ?? body.radiusM ?? "200"),
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : null,
      companyId,
    },
  });

  return NextResponse.json({ project });
}
