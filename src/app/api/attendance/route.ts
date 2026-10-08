import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const employeeId = url.searchParams.get("employeeId");

  // If employeeId is provided, fetch ALL attendance records for that employee (no date filter)
  // Otherwise, fetch today's records for all employees
  const where: any = { employee: { companyId, status: "ACTIVE" } };

  if (employeeId) {
    where.employeeId = employeeId;
    // No date filter — get all history
  } else {
    // attendanceDate is a day marker, but not always stored at midnight — the
    // writers call setHours(0,0,0,0) in the server's local zone, so the stored
    // value can land at 04:00 and an exact-equality filter then matches
    // nothing, which is why this page showed "No attendance records" on days
    // full of them. Match the whole day as a range instead.
    const day = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.attendanceDate = { gte: dayStart, lt: dayEnd };
  }

  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : undefined;

  const records = await db.attendance.findMany({
    where,
    take: limit,
    include: {
      employee: true,
      project: true,
      photos: true,
    },
    orderBy: [{ attendanceDate: "desc" }, { checkIn: "desc" }],
  });

  const rows = records.map((r) => {
    let uiStatus: string = r.attendanceStatus.toLowerCase();
    if (uiStatus === "present") {
      uiStatus = r.checkOut ? "checked_out" : "working";
    } else if (uiStatus === "half_day") {
      uiStatus = "break";
    } else if (uiStatus === "late") {
      uiStatus = r.checkOut ? "checked_out" : "late";
    } else if (uiStatus === "absent") {
      uiStatus = "absent";
    } else if (uiStatus === "on_leave") {
      uiStatus = "leave";
    }

    const checkInPhoto = r.photos.find((p) => p.type === "CHECK_IN");
    const checkOutPhoto = r.photos.find((p) => p.type === "CHECK_OUT");

    return {
      id: r.id,
      date: r.attendanceDate.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      // Employee row id, so callers can match it against the session's
      // employeeId. Previously this was the human-facing empId, which can never
      // equal that cuid and made the employee portal's history always empty.
      employeeId: r.employeeId,
      empId: r.employee.empId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      employeeInitials: (r.employee.firstName[0] ?? "") + (r.employee.lastName[0] ?? ""),
      avatarColor: r.employee.avatarColor,
      projectId: r.projectId,
      project: r.project?.name ?? "—",
      checkIn: r.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
      checkOut: r.checkOut?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      // Exact values, so the admin adjust dialog can prefill real timestamps
      // instead of trying to parse the formatted strings above.
      checkInIso: r.checkIn?.toISOString() ?? null,
      checkOutIso: r.checkOut?.toISOString() ?? null,
      workingMinutes: r.workingMins,
      hoursMins: formatMins(r.workingMins),
      lateMinutes: r.lateMins,
      lateMins: r.lateMins,
      status: uiStatus,
      verification: r.verificationStatus.toLowerCase(),
      location: r.checkInLocation ?? "—",
      coords: { lat: r.checkInLat ?? 0, lng: r.checkInLng ?? 0 },
      accuracyM: r.checkInAccuracy ?? 0,
      photoCheckIn: !!checkInPhoto,
      photoCheckOut: !!checkOutPhoto,
      checkInPhotoUrl: checkInPhoto?.photoUrl ?? null,
      checkOutPhotoUrl: checkOutPhoto?.photoUrl ?? null,
      insideGeofence: r.insideGeofence,
      distanceFromProject: r.distanceFromProject,
    };
  });

  return NextResponse.json({ attendance: rows });
}

function formatMins(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
