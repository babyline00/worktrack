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
    const today = dateStr ? new Date(dateStr) : new Date();
    today.setHours(0, 0, 0, 0);
    where.attendanceDate = today;
  }

  const records = await db.attendance.findMany({
    where,
    include: {
      employee: true,
      project: true,
      photos: true,
    },
    orderBy: { attendanceDate: "desc" },
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
      employeeId: r.employee.empId,
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
