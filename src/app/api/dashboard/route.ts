import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Cache } from "@/lib/cache";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;

  // Try cache first (15 second TTL for dashboard)
  const cacheKey = `dashboard:${companyId}`;
  const cached = await Cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeEmployees = await db.employee.count({ where: { companyId, status: "ACTIVE" } });

  // Get today's attendance with employee + project + latest location
  const presentRecords = await db.attendance.findMany({
    where: { attendanceDate: today, employee: { companyId, status: "ACTIVE" } },
    include: {
      employee: true,
      project: true,
      locations: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });

  const leaveToday = await db.leaveRequest.findMany({
    where: { status: "APPROVED", fromDate: { lte: today }, toDate: { gte: today }, employee: { companyId } },
    include: { employee: true },
  });

  const notifications = await db.notification.findMany({
    where: { OR: [{ companyId }, { companyId: null }] },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const projects = await db.project.findMany({
    where: { companyId },
    include: { assignments: { where: { status: "ACTIVE" } } },
  });

  // KPI calculations
  const presentEmployeeIds = new Set(
    presentRecords.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").map((a) => a.employeeId)
  );
  const present = presentEmployeeIds.size;
  const workingNow = presentRecords.filter((a) => a.sessionStatus === "WORKING").length;
  const late = presentRecords.filter((a) => a.attendanceStatus === "LATE").length;
  const onLeave = leaveToday.length;
  const absent = Math.max(0, activeEmployees - present - onLeave);
  const presentPct = activeEmployees > 0 ? Math.round((present / activeEmployees) * 1000) / 10 : 0;

  const donut = [
    { name: "Present", value: present - late > 0 ? present - late : 0, color: "#16a34a" },
    { name: "Late", value: late, color: "#f59e0b" },
    { name: "On Leave", value: onLeave, color: "#0ea5e9" },
    { name: "Absent", value: absent, color: "#dc2626" },
  ];

  // Attendance trend
  const trend: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayRecords = await db.attendance.count({
      where: { attendanceDate: d, employee: { companyId, status: "ACTIVE" }, attendanceStatus: { in: ["PRESENT", "LATE"] } },
    });
    trend.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: activeEmployees > 0 ? Math.round((dayRecords / activeEmployees) * 100) : 0,
    });
  }

  // Project performance
  const projectPerf = await Promise.all(
    projects.map(async (p) => {
      const presentToday = await db.attendance.count({
        where: { attendanceDate: today, projectId: p.id, attendanceStatus: { in: ["PRESENT", "LATE"] }, employee: { status: "ACTIVE" } },
      });
      const total = p.assignments.length;
      return { id: p.id, name: p.name, present: presentToday, total, pct: total > 0 ? Math.round((presentToday / total) * 100) : 0 };
    })
  );

  // Live attendance with REAL GPS coordinates from latest location
  const liveAttendance = presentRecords
    .filter((a) => a.sessionStatus === "WORKING")
    .slice(0, 10)
    .map((a) => {
      const latestLoc = a.locations[0];
      // Use latest location if available, otherwise fall back to check-in GPS
      const lat = latestLoc?.latitude ?? a.checkInLat ?? 0;
      const lng = latestLoc?.longitude ?? a.checkInLng ?? 0;
      return {
        id: a.id,
        attendanceId: a.id,
        employeeId: a.employee.empId,
        employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
        employeeInitials: (a.employee.firstName[0] ?? "") + (a.employee.lastName[0] ?? ""),
        avatarColor: a.employee.avatarColor,
        projectId: a.projectId,
        projectName: a.project?.name ?? "—",
        projectCoords: a.project ? { lat: a.project.lat, lng: a.project.lng } : null,
        projectRadius: a.project?.radiusM ?? 200,
        checkIn: a.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
        status: "working",
        location: a.checkInLocation ?? "—",
        // REAL GPS coordinates
        coords: { lat, lng },
        accuracy: latestLoc?.accuracy ?? a.checkInAccuracy ?? 0,
        insideGeofence: latestLoc?.insideGeofence ?? a.insideGeofence,
        distanceFromProject: latestLoc?.distanceFromProject ?? a.distanceFromProject ?? 0,
        lastUpdatedSec: latestLoc
          ? Math.max(5, Math.round((Date.now() - latestLoc.recordedAt.getTime()) / 60000) * 60)
          : a.checkIn ? Math.max(5, Math.round((Date.now() - a.checkIn.getTime()) / 60000) * 60) : 5,
        lastLocationTime: latestLoc?.recordedAt?.toISOString() ?? a.checkIn?.toISOString() ?? null,
        // For the employee table view
        project: a.project?.name ?? "—",
        workingTimeMins: a.workingMins,
      };
    });

  // Alerts
  const alerts: any[] = [];
  const lateAlerts = presentRecords.filter((a) => a.attendanceStatus === "LATE").slice(0, 3);
  for (const a of lateAlerts) {
    alerts.push({
      id: `al-late-${a.id}`,
      severity: "warning",
      title: `${a.employee.firstName} checked in ${a.lateMins} min late`,
      description: `${a.project?.name ?? "—"} • ${a.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—"}`,
      employee: a.employee.firstName,
    });
  }

  const stillWorking = presentRecords.filter((a) => a.sessionStatus === "WORKING");
  if (stillWorking.length > 0) {
    const lateHour = new Date(today);
    lateHour.setHours(18, 0, 0, 0);
    if (new Date() > lateHour) {
      alerts.push({ id: "al-no-checkout", severity: "warning", title: `${stillWorking.length} employees haven't checked out`, description: "Shift ended at 6:00 PM — checkout pending" });
    }
  }

  const outsideGeofence = presentRecords.filter((a) => !a.insideGeofence && a.sessionStatus === "WORKING");
  if (outsideGeofence.length > 0) {
    const first = outsideGeofence[0];
    alerts.push({ id: `al-geofence-${first.id}`, severity: "danger", title: `${first.employee.firstName} is outside project geofence`, description: `Currently ${first.distanceFromProject}m away from ${first.project?.name ?? "project"}`, employee: first.employee.firstName });
  }

  const missingPhotos = presentRecords.filter((a) => !a.checkInPhotoId);
  if (missingPhotos.length > 0) {
    alerts.push({ id: "al-missing-photos", severity: "warning", title: `${missingPhotos.length} employees have missing attendance photos`, description: "Photo verification required at check-in" });
  }

  const response = {
    kpis: { totalEmployees: activeEmployees, present, workingNow, absent, late, leave: onLeave, presentPct },
    donut,
    trend,
    projectPerformance: projectPerf,
    liveAttendance,
    alerts,
    notifications,
  };

  // Cache for 15 seconds
  await Cache.set(cacheKey, response, 15_000);

  return NextResponse.json(response);
}
