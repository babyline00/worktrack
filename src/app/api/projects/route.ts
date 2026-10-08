import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** Sentinel radius meaning "no geofence limit". */
const NO_LIMIT_RADIUS = 9999999;

/** Parses an optional coordinate. Returns NaN when absent so callers can treat
 *  "not provided" and "invalid" with one check. */
function parseCoord(value: unknown, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return NaN;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return n;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

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
  const companyId = (session.user as any).companyId as string;
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Project code is required" }, { status: 400 });

  const status = String(body.status ?? "ACTIVE").toUpperCase();
  if (!["ACTIVE", "PAUSED", "COMPLETED"].includes(status)) {
    return NextResponse.json({ error: "Status must be ACTIVE, PAUSED or COMPLETED" }, { status: 400 });
  }

  // Reject duplicates with a readable message rather than letting the unique
  // constraint surface as an opaque 500.
  const clash = await db.project.findFirst({ where: { code } });
  if (clash) {
    return NextResponse.json({ error: `Project code "${code}" is already in use` }, { status: 409 });
  }

  const lat = parseCoord(body.lat ?? body.latitude, -90, 90);
  const lng = parseCoord(body.lng ?? body.longitude, -180, 180);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Coordinates must be numbers within valid ranges" }, { status: 400 });
  }

  const rawRadius = parseInt(body.geofenceRadius ?? body.radiusM ?? "200");
  if (!Number.isFinite(rawRadius) || rawRadius < 0) {
    return NextResponse.json({ error: "Radius must be zero or greater" }, { status: 400 });
  }

  const project = await db.project.create({
    data: {
      code,
      name,
      client: body.client ? String(body.client).trim() : null,
      description: body.description ? String(body.description).trim() : null,
      status,
      location: body.location ? String(body.location).trim() : null,
      lat: Number.isNaN(lat) ? null : lat,
      lng: Number.isNaN(lng) ? null : lng,
      // 0 is how the UI spells "no limit"; the API needs a real large radius
      // because the geofence check compares distance against radiusM.
      radiusM: rawRadius === 0 ? NO_LIMIT_RADIUS : rawRadius,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : null,
      companyId,
    },
  });

  return NextResponse.json({ project });
}
