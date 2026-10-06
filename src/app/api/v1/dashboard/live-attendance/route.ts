import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  nowInTimezone,
  formatTimeInTimezone,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/dashboard/live-attendance?projectId&status&page&limit
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const { startOfDay } = nowInTimezone();

    const where: any = {
      attendanceDate: startOfDay,
      employee: { companyId: user.companyId },
    };
    if (projectId) where.projectId = projectId;
    if (status) where.sessionStatus = status.toUpperCase();

    const records = await db.attendance.findMany({
      where,
      include: { employee: true, project: true },
      orderBy: { checkIn: "asc" },
      take: 100,
    });

    return apiSuccess({
      employees: records.map((r) => ({
        attendanceId: r.id,
        employeeId: r.employee.id,
        employeeCode: r.employee.empId,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        avatarColor: r.employee.avatarColor,
        initials: (r.employee.firstName[0] ?? "") + (r.employee.lastName[0] ?? ""),
        projectId: r.projectId,
        projectName: r.project?.name ?? "—",
        checkIn: formatTimeInTimezone(r.checkIn, "Asia/Karachi"),
        checkOut: formatTimeInTimezone(r.checkOut, "Asia/Karachi"),
        workingMinutes: r.workingMins,
        sessionStatus: r.sessionStatus,
        attendanceStatus: r.attendanceStatus,
        verificationStatus: r.verificationStatus,
        insideGeofence: r.insideGeofence,
        location: r.checkInLocation,
        lastUpdatedSec: r.checkIn ? Math.max(5, Math.round((Date.now() - r.checkIn.getTime()) / 60000) * 60) : 5,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
