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

  const employees = await db.employee.findMany({
    where: { companyId },
    include: {
      department: true,
      assignments: { where: { status: "ACTIVE" }, include: { project: true } },
      attendance: {
        where: { attendanceDate: today },
        take: 1,
        orderBy: { attendanceDate: "desc" },
        include: { locations: { orderBy: { recordedAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const result = employees.map((e) => {
    const todayAtt = e.attendance[0];
    let todaysStatus = "absent";
    if (todayAtt) {
      if (todayAtt.checkOut) todaysStatus = "checked_out";
      else if (todayAtt.attendanceStatus === "LATE") todaysStatus = "late";
      else todaysStatus = "working";
    }
    return {
      id: e.id,
      empId: e.empId,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      department: e.department?.name ?? null,
      designation: e.designation,
      status: e.status.toLowerCase(),
      avatarColor: e.avatarColor,
      initials: (e.firstName[0] ?? "") + (e.lastName[0] ?? ""),
      projects: e.assignments.map((a) => a.project.name),
      projectIds: e.assignments.map((a) => a.projectId),
      project: e.assignments[0]?.project.name ?? "—",
      location: e.assignments[0]?.project.location ?? "—",
      // Use real GPS from latest location, or check-in GPS, or project GPS as fallback
      coords: (() => {
        const latestLoc = todayAtt?.locations?.[0];
        if (latestLoc) return { lat: latestLoc.latitude, lng: latestLoc.longitude };
        if (todayAtt?.checkInLat && todayAtt?.checkInLng) return { lat: todayAtt.checkInLat, lng: todayAtt.checkInLng };
        const proj = e.assignments[0]?.project;
        return proj ? { lat: proj.lat ?? 0, lng: proj.lng ?? 0 } : { lat: 0, lng: 0 };
      })(),
      todaysStatus,
      checkIn: todayAtt?.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      checkOut: todayAtt?.checkOut?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      workingTimeMins: todayAtt?.workingMins ?? 0,
      accuracyM: todayAtt?.checkInAccuracy ?? 0,
      lastUpdatedSec: todayAtt?.checkIn ? Math.max(5, Math.round((Date.now() - todayAtt.checkIn.getTime()) / 60000) * 60) : 5,
      photoCaptured: !!todayAtt?.checkInPhotoId,
      insideGeofence: todayAtt?.insideGeofence ?? true,
      presentThisMonth: 22,
      lateThisMonth: 3,
      totalHours: 168,
      attendanceRate: 90,
    };
  });

  return NextResponse.json({ employees: result });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const body = await req.json();

  const emp = await db.employee.create({
    data: {
      empId: body.empId,
      firstName: body.firstName,
      lastName: body.lastName ?? "",
      email: body.email,
      phone: body.phone,
      departmentId: body.departmentId ?? null,
      designation: body.designation,
      status: body.status?.toUpperCase() ?? "ACTIVE",
      avatarColor: body.avatarColor ?? "#2563eb",
      companyId,
    },
  });

  if (body.projectIds?.length) {
    await db.assignment.createMany({
      data: body.projectIds.map((pid: string) => ({ employeeId: emp.id, projectId: pid })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ employee: emp });
}
