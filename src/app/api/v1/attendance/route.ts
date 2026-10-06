import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  nowInTimezone,
  formatTimeInTimezone,
  formatMins,
  paginate,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/attendance?employeeId&projectId&status&from&to&page&limit
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const { page, limit, skip } = paginate(req);

    const where: any = { employee: { companyId: user.companyId } };
    if (employeeId) where.employeeId = employeeId;
    if (projectId) where.projectId = projectId;
    if (status) where.attendanceStatus = status.toUpperCase();
    if (from || to) {
      where.attendanceDate = {};
      if (from) where.attendanceDate.gte = new Date(from);
      if (to) {
        const t = new Date(to); t.setHours(23, 59, 59, 999);
        where.attendanceDate.lte = t;
      }
    }

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: { employee: true, project: true },
        orderBy: { attendanceDate: "desc" },
        skip,
        take: limit,
      }),
      db.attendance.count({ where }),
    ]);

    return apiSuccess({
      data: records.map((r) => ({
        id: r.id,
        date: r.attendanceDate.toISOString().split("T")[0],
        employeeId: r.employee.empId,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeInitials: (r.employee.firstName[0] ?? "") + (r.employee.lastName[0] ?? ""),
        avatarColor: r.employee.avatarColor,
        projectId: r.projectId,
        project: r.project?.name ?? "—",
        checkIn: formatTimeInTimezone(r.checkIn, "Asia/Karachi"),
        checkOut: formatTimeInTimezone(r.checkOut, "Asia/Karachi"),
        hoursMins: formatMins(r.workingMins),
        workingMinutes: r.workingMins,
        lateMinutes: r.lateMins,
        sessionStatus: r.sessionStatus,
        attendanceStatus: r.attendanceStatus,
        verificationStatus: r.verificationStatus,
        insideGeofence: r.insideGeofence,
        distanceFromProject: r.distanceFromProject,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
