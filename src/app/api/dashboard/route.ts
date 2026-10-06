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

  const [totalEmployees, presentRecords, activeEmployees, leaveToday, notifications, projects] = await Promise.all([
    db.employee.count({ where: { companyId, status: "ACTIVE" } }),
    db.attendance.findMany({
      where: { attendanceDate: today, employee: { companyId } },
      include: { employee: true, project: true },
    }),
    db.employee.count({ where: { companyId, status: "ACTIVE" } }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", fromDate: { lte: today }, toDate: { gte: today } },
      include: { employee: true },
    }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.project.findMany({ where: { companyId }, include: { assignments: true } }),
  ]);

  const present = presentRecords.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").length;
  const workingNow = presentRecords.filter((a) => !a.checkOut).length;
  const late = presentRecords.filter((a) => a.attendanceStatus === "LATE").length;
  const absent = activeEmployees - present - leaveToday.length;
  const onLeave = leaveToday.length;
  const presentPct = activeEmployees > 0 ? Math.round((present / activeEmployees) * 1000) / 10 : 0;

  const donut = [
    { name: "Present", value: present, color: "#16a34a" },
    { name: "Late", value: late, color: "#f59e0b" },
    { name: "On Leave", value: onLeave, color: "#0ea5e9" },
    { name: "Absent", value: Math.max(0, absent), color: "#dc2626" },
  ];

  // Attendance trend (last 7 days)
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayRecords = await db.attendance.count({
      where: {
        attendanceDate: d,
        employee: { companyId },
        attendanceStatus: { in: ["PRESENT", "LATE"] },
      },
    });
    const totalActive = activeEmployees || 1;
    trend.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: Math.round((dayRecords / totalActive) * 100),
    });
  }

  // Project performance
  const projectPerf = await Promise.all(
    projects.map(async (p) => {
      const presentToday = await db.attendance.count({
        where: {
          attendanceDate: today,
          projectId: p.id,
          attendanceStatus: { in: ["PRESENT", "LATE"] },
        },
      });
      return {
        id: p.id,
        name: p.name,
        present: presentToday,
        total: p.assignments.length,
        pct: p.assignments.length > 0 ? Math.round((presentToday / p.assignments.length) * 100) : 0,
      };
    })
  );

  // Live attendance (currently working)
  const liveAttendance = presentRecords
    .filter((a) => !a.checkOut)
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      employeeId: a.employee.empId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
      employeeInitials: (a.employee.firstName[0] ?? "") + (a.employee.lastName[0] ?? ""),
      avatarColor: a.employee.avatarColor,
      project: a.project?.name ?? "—",
      checkIn: a.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
      status: "working",
      location: a.checkInLocation ?? "—",
      lastUpdatedSec: a.checkIn ? Math.max(5, Math.round((Date.now() - a.checkIn.getTime()) / 60000) * 60) : 5,
    }));

  // Alerts
  const alerts = [];
  const lateAlerts = presentRecords.filter((a) => a.attendanceStatus === "LATE").slice(0, 1);
  for (const a of lateAlerts) {
    alerts.push({
      id: `al-late-${a.id}`,
      severity: "warning",
      title: `${a.employee.firstName} checked in late`,
      description: `${a.project?.name ?? "—"} • ${a.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
      employee: a.employee.firstName,
    });
  }
  const notCheckedOut = presentRecords.filter((a) => !a.checkOut && a.attendanceStatus === "PRESENT").length;
  if (notCheckedOut > 0) {
    alerts.push({
      id: "al-no-checkout",
      severity: "warning",
      title: `${notCheckedOut} employees haven't checked out`,
      description: "Shift ended — checkout pending",
    });
  }
  const outsideGeofence = presentRecords.filter((a) => !a.insideGeofence);
  if (outsideGeofence.length > 0) {
    const first = outsideGeofence[0];
    alerts.push({
      id: `al-geofence-${first.id}`,
      severity: "danger",
      title: `${first.employee.firstName} is outside project geofence`,
      description: `Currently outside ${first.project?.name ?? "—"} site`,
      employee: first.employee.firstName,
    });
  }
  const missingPhotos = presentRecords.filter((a) => !a.checkInPhoto);
  if (missingPhotos.length > 0) {
    alerts.push({
      id: "al-missing-photos",
      severity: "warning",
      title: `${missingPhotos.length} employees have missing attendance photos`,
      description: "Photo verification required at check-in",
    });
  }

  return NextResponse.json({
    kpis: {
      totalEmployees,
      present,
      workingNow,
      absent: Math.max(0, absent),
      late,
      leave: onLeave,
      presentPct,
    },
    donut,
    trend,
    projectPerformance: projectPerf,
    liveAttendance,
    alerts,
    notifications,
  });
}
