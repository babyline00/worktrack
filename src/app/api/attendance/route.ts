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

  const today = dateStr ? new Date(dateStr) : new Date();
  today.setHours(0, 0, 0, 0);

  const records = await db.attendance.findMany({
    where: { attendanceDate: today, employee: { companyId } },
    include: { employee: true, project: true },
    orderBy: { checkIn: "asc" },
  });

  const rows = records.map((r) => {
    // Map DB status to UI status
    let uiStatus: string = r.attendanceStatus.toLowerCase();
    if (uiStatus === "present") {
      uiStatus = r.checkOut ? "checked_out" : "working";
    } else if (uiStatus === "half_day") {
      uiStatus = "break";
    }
    return {
      id: r.id,
      date: today.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      employeeId: r.employee.empId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      employeeInitials: (r.employee.firstName[0] ?? "") + (r.employee.lastName[0] ?? ""),
      avatarColor: r.employee.avatarColor,
      project: r.project?.name ?? "—",
      checkIn: r.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
      checkOut: r.checkOut?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      hoursMins: formatMins(r.workingMins),
      status: uiStatus,
      verification: r.verificationStatus.toLowerCase(),
      location: r.checkInLocation ?? "—",
      coords: { lat: r.checkInLat ?? 0, lng: r.checkInLng ?? 0 },
      accuracyM: r.checkInAccuracy ?? 0,
      photoCheckIn: !!r.checkInPhoto,
      photoCheckOut: !!r.checkOutPhoto,
      insideGeofence: r.insideGeofence,
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
