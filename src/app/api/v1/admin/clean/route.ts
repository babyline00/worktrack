import { db } from "@/lib/db";

export const maxDuration = 30;

// POST /api/v1/admin/clean?key=worktrack-seed-2026
// Removes ALL demo/seed data — leaves database empty for production use
export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== "worktrack-seed-2026") return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const results: string[] = [];

    const deleted = {
      attendanceLocations: await db.attendanceLocation.deleteMany({}),
      attendancePhotos: await db.attendancePhoto.deleteMany({}),
      attendance: await db.attendance.deleteMany({}),
      auditLogs: await db.auditLog.deleteMany({}),
      leaveRequests: await db.leaveRequest.deleteMany({}),
      notifications: await db.notification.deleteMany({}),
      assignments: await db.assignment.deleteMany({}),
      refreshTokens: await db.refreshToken.deleteMany({}),
      devices: await db.device.deleteMany({}),
      reportJobs: await db.reportJob.deleteMany({}),
      shifts: await db.shift.deleteMany({}),
      employees: await db.employee.deleteMany({}),
      projects: await db.project.deleteMany({}),
      departments: await db.department.deleteMany({}),
      settings: await db.setting.deleteMany({}),
      users: await db.user.deleteMany({}),
      company: await db.company.deleteMany({}),
    };

    for (const [key, val] of Object.entries(deleted)) {
      results.push(`${key}: ${val.count} deleted`);
    }

    return Response.json({
      success: true,
      message: "Database cleaned — all data removed. Database is now empty.",
      results,
    });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
