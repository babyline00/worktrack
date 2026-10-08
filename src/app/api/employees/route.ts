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
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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

  // Build result array with real-time stats (use for...of to allow await)
  const result = [];
  for (const e of employees) {
    const todayAtt = e.attendance[0];
    let todaysStatus = "absent";
    if (todayAtt) {
      if (todayAtt.checkOut) todaysStatus = "checked_out";
      else if (todayAtt.attendanceStatus === "LATE") todaysStatus = "late";
      else todaysStatus = "working";
    }

    // Real monthly stats
    const [presentCount, lateCount, sumAgg, totalCount] = await Promise.all([
      db.attendance.count({ where: { employeeId: e.id, attendanceStatus: { in: ["PRESENT", "LATE"] }, attendanceDate: { gte: monthStart } } }),
      db.attendance.count({ where: { employeeId: e.id, attendanceStatus: "LATE", attendanceDate: { gte: monthStart } } }),
      db.attendance.aggregate({ where: { employeeId: e.id, attendanceDate: { gte: monthStart } }, _sum: { workingMins: true } }),
      db.attendance.count({ where: { employeeId: e.id, attendanceDate: { gte: monthStart } } }),
    ]);

    const totalHours = Math.round((sumAgg._sum.workingMins ?? 0) / 60);
    const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    // Use real GPS from latest location, or check-in GPS, or project GPS
    const latestLoc = todayAtt?.locations?.[0];
    const coords = latestLoc
      ? { lat: latestLoc.latitude, lng: latestLoc.longitude }
      : todayAtt?.checkInLat && todayAtt?.checkInLng
        ? { lat: todayAtt.checkInLat, lng: todayAtt.checkInLng }
        : e.assignments[0]?.project
          ? { lat: e.assignments[0].project.lat ?? 0, lng: e.assignments[0].project.lng ?? 0 }
          : { lat: 0, lng: 0 };

    result.push({
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
      coords,
      todaysStatus,
      checkIn: todayAtt?.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      checkOut: todayAtt?.checkOut?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      workingTimeMins: todayAtt?.workingMins ?? 0,
      accuracyM: todayAtt?.checkInAccuracy ?? 0,
      lastUpdatedSec: todayAtt?.checkIn ? Math.max(5, Math.round((Date.now() - todayAtt.checkIn.getTime()) / 60000) * 60) : 5,
      photoCaptured: !!todayAtt?.checkInPhotoId,
      insideGeofence: todayAtt?.insideGeofence ?? true,
      // Real-time stats
      presentThisMonth: presentCount,
      lateThisMonth: lateCount,
      totalHours,
      attendanceRate,
    });
  }

  return NextResponse.json({ employees: result });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const body = await req.json();

  // Check empId unique within company
  const existing = await db.employee.findUnique({
    where: { companyId_empId: { companyId, empId: body.empId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Employee ID already exists in this company" }, { status: 409 });
  }

  // Auto-generate email if not provided
  const email = body.email || `${body.firstName.toLowerCase()}.${(body.lastName || "").toLowerCase()}@worktrack.io`;

  // Check if email is already used by a user
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email already in use. Please use a different email." }, { status: 409 });
  }

  const emp = await db.employee.create({
    data: {
      empId: body.empId,
      firstName: body.firstName,
      lastName: body.lastName ?? "",
      email,
      phone: body.phone,
      departmentId: body.departmentId ?? null,
      designation: body.designation,
      status: body.status?.toUpperCase() ?? "ACTIVE",
      avatarColor: body.avatarColor ?? "#2563eb",
      companyId,
    },
  });

  // Create user account with password (so employee can log in)
  if (body.password) {
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(body.password, 10);
    await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: `${body.firstName} ${body.lastName ?? ""}`.trim(),
        role: body.role || "EMPLOYEE",
        companyId,
        employeeId: emp.id,
        status: "ACTIVE",
      },
    });
  }

  // Assign projects
  if (body.projectIds?.length) {
    await db.assignment.createMany({
      data: body.projectIds.map((pid: string) => ({ employeeId: emp.id, projectId: pid })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ employee: emp, message: body.password ? "Employee created with login access" : "Employee created (no login)" });
}
