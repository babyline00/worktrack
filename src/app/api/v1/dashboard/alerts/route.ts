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

// GET /api/v1/dashboard/alerts
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const { startOfDay } = nowInTimezone();

    const records = await db.attendance.findMany({
      where: { attendanceDate: startOfDay, employee: { companyId: user.companyId } },
      include: { employee: true, project: true },
    });

    const alerts: any[] = [];

    // Late alerts
    for (const r of records.filter((a) => a.attendanceStatus === "LATE").slice(0, 3)) {
      alerts.push({
        id: `late-${r.id}`,
        type: "LATE",
        severity: "WARNING",
        employee: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeCode: r.employee.empId,
        message: `${r.employee.firstName} checked in ${r.lateMins} minutes late.`,
        attendanceId: r.id,
      });
    }

    // Outside geofence
    for (const r of records.filter((a) => !a.insideGeofence).slice(0, 3)) {
      alerts.push({
        id: `geofence-${r.id}`,
        type: "GEOFENCE",
        severity: "HIGH",
        employee: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeCode: r.employee.empId,
        message: `Employee is outside project area (${r.distanceFromProject}m from ${r.project?.name ?? "project"}).`,
        attendanceId: r.id,
      });
    }

    // Missing photos
    const recordsWithoutPhoto = records.filter((a) => a.verificationStatus === "PENDING");
    if (recordsWithoutPhoto.length > 0) {
      alerts.push({
        id: "missing-photos",
        type: "MISSING_PHOTO",
        severity: "WARNING",
        employee: null,
        message: `${recordsWithoutPhoto.length} employees have missing attendance photos.`,
      });
    }

    // Not checked out (still working past shift end)
    const stillWorking = records.filter((a) => a.sessionStatus === "WORKING");
    if (stillWorking.length > 0) {
      const lateHour = new Date(startOfDay);
      lateHour.setHours(18, 0, 0, 0);
      if (new Date() > lateHour) {
        alerts.push({
          id: "missing-checkout",
          type: "MISSED_CHECKOUT",
          severity: "WARNING",
          employee: null,
          message: `${stillWorking.length} employees haven't checked out.`,
        });
      }
    }

    return apiSuccess({ alerts });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
