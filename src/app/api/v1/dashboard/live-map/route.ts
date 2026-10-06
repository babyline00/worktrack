import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  nowInTimezone,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/dashboard/live-map
// Returns employees currently working with their latest location
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const { startOfDay } = nowInTimezone();

    const records = await db.attendance.findMany({
      where: {
        attendanceDate: startOfDay,
        sessionStatus: "WORKING",
        employee: { companyId: user.companyId },
      },
      include: {
        employee: true,
        project: true,
        locations: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
    });

    return apiSuccess({
      employees: records.map((r) => {
        const lastLoc = r.locations[0];
        const lat = lastLoc?.latitude ?? r.checkInLat ?? 0;
        const lng = lastLoc?.longitude ?? r.checkInLng ?? 0;
        return {
          attendanceId: r.id,
          employeeId: r.employee.id,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          employeeCode: r.employee.empId,
          initials: (r.employee.firstName[0] ?? "") + (r.employee.lastName[0] ?? ""),
          avatarColor: r.employee.avatarColor,
          projectId: r.projectId,
          projectName: r.project?.name ?? "—",
          latitude: lat,
          longitude: lng,
          accuracy: lastLoc?.accuracy ?? r.checkInAccuracy ?? 0,
          sessionStatus: r.sessionStatus,
          attendanceStatus: r.attendanceStatus,
          insideGeofence: lastLoc?.insideGeofence ?? r.insideGeofence,
          lastUpdated: (lastLoc?.recordedAt ?? r.checkIn)?.toISOString() ?? null,
        };
      }),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
