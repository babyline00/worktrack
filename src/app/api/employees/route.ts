import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/v1";

/** The fields a session row contributes to one check-in / check-out leg. */
type SessionLegSource = {
  checkIn: Date | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracy: number | null;
  checkInLocation: string | null;
  checkInPhotoId: string | null;
  checkOut: Date | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracy: number | null;
  checkOutLocation: string | null;
  checkOutPhotoId: string | null;
  insideGeofence: boolean;
  photos: { id: string; type: string }[];
  project: { lat: number | null; lng: number | null; radiusM: number | null } | null;
};

/**
 * Normalises one leg of a session (check-in or check-out) so the UI can render
 * the two side by side: time, GPS, accuracy, geofence verdict and selfie.
 */
function sessionLeg(att: SessionLegSource | undefined, which: "checkIn" | "checkOut") {
  if (!att) return null;
  const isIn = which === "checkIn";
  const at = isIn ? att.checkIn : att.checkOut;
  if (!at) return null;

  const lat = isIn ? att.checkInLat : att.checkOutLat;
  const lng = isIn ? att.checkInLng : att.checkOutLng;
  const project = att.project;

  // Prefer recomputing from the leg's own coordinates; `insideGeofence` on the
  // row only records the check-in verdict.
  let insideGeofence: boolean | null = isIn ? (att.insideGeofence ?? true) : null;
  if (lat != null && lng != null && project?.lat != null && project?.lng != null) {
    insideGeofence =
      haversineMeters(project.lat, project.lng, lat, lng) <= (project.radiusM ?? 200);
  }

  // The `*PhotoId` columns were only added by the routes that store the photo,
  // so rows written earlier have them null even though the selfie exists on the
  // `photos` relation. Fall back to that so existing history keeps rendering.
  const storedPhotoId = (isIn ? att.checkInPhotoId : att.checkOutPhotoId) || null;
  const photoId =
    storedPhotoId ?? att.photos.find((p) => p.type === (isIn ? "CHECK_IN" : "CHECK_OUT"))?.id ?? null;

  return {
    at: at.toISOString(),
    time: at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    coords: lat != null && lng != null ? { lat, lng } : null,
    location: (isIn ? att.checkInLocation : att.checkOutLocation) || null,
    accuracyM: (isIn ? att.checkInAccuracy : att.checkOutAccuracy) ?? null,
    photoId,
    insideGeofence,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const url = new URL(req.url);
  // `search` was accepted by callers but ignored here, so a lookup for one
  // employee downloaded the whole roster — and the per-employee aggregates
  // below run in a loop, which made that expensive as well as pointless.
  const search = (url.searchParams.get("search") ?? "").trim();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const employees = await db.employee.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { empId: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      department: true,
      assignments: { where: { status: "ACTIVE" }, include: { project: true } },
      attendance: {
        where: { attendanceDate: today },
        take: 1,
        // Order by check-in, not attendanceDate: every record for today shares
        // the same date, so ordering by it was a no-op and an employee with
        // several sessions today got an arbitrary one instead of the latest.
        orderBy: { checkIn: "desc" },
        include: {
          project: true,
          photos: { select: { id: true, type: true } },
          locations: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  // Build result array with real-time stats (use for...of to allow await)
  const result: Record<string, unknown>[] = [];
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

    const checkInLeg = sessionLeg(todayAtt, "checkIn");
    const checkOutLeg = sessionLeg(todayAtt, "checkOut");

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
      photoCaptured: checkInLeg?.photoId != null,
      insideGeofence: todayAtt?.insideGeofence ?? true,
      // Per-leg check-in / check-out detail. The Live Attendance drawer shows
      // both legs side by side, so the two need to stay distinguishable
      // instead of being merged into one set of fields.
      checkInDetail: checkInLeg,
      checkOutDetail: checkOutLeg,
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

  // The create dialog sent a department *name* while this handler only read
  // departmentId, so every employee was created with a null department and the
  // list rendered a blank column. Accept either form, creating the Department
  // row if a new name was typed.
  let departmentId: string | null = null;
  if (body.departmentId) {
    const byId = await db.department.findFirst({
      where: { id: String(body.departmentId), companyId },
    });
    departmentId = byId?.id ?? null;
  } else if (body.department) {
    const name = String(body.department).trim();
    if (name) {
      const dept = await db.department.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { name, companyId },
      });
      departmentId = dept.id;
    }
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
      departmentId,
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
