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

// GET /api/v1/projects
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const { startOfDay } = nowInTimezone();

    const projects = await db.project.findMany({
      where: { companyId: user.companyId },
      include: {
        assignments: { where: { status: "ACTIVE" } },
        attendance: { where: { attendanceDate: startOfDay } },
      },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({
      projects: projects.map((p) => {
        const presentToday = p.attendance.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").length;
        const workingNow = p.attendance.filter((a) => a.sessionStatus === "WORKING").length;
        const lateToday = p.attendance.filter((a) => a.attendanceStatus === "LATE").length;
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          client: p.client,
          description: p.description,
          status: p.status.toLowerCase(),
          location: p.location,
          coords: { latitude: p.lat, longitude: p.lng },
          radius: p.radiusM,
          timezone: p.timezone,
          startDate: p.startDate?.toISOString().split("T")[0] ?? null,
          endDate: p.endDate?.toISOString().split("T")[0] ?? null,
          employeeCount: p.assignments.length,
          presentToday,
          workingNow,
          lateToday,
          absentToday: Math.max(0, p.assignments.length - presentToday),
        };
      }),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// POST /api/v1/projects
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    if (!body.name || !body.code) throw ERRORS.VALIDATION("name and code are required");

    const existing = await db.project.findUnique({ where: { code: body.code } });
    if (existing) throw ERRORS.CONFLICT("PROJECT_CODE_EXISTS", "Project code already exists");

    const project = await db.project.create({
      data: {
        code: body.code,
        name: body.name,
        client: body.clientName ?? body.client,
        description: body.description,
        status: (body.status ?? "ACTIVE").toUpperCase(),
        location: body.location,
        lat: body.latitude ? parseFloat(body.latitude) : null,
        lng: body.longitude ? parseFloat(body.longitude) : null,
        radiusM: parseInt(body.geofenceRadius ?? body.radiusM ?? "200") === 0 ? 9999999 : parseInt(body.geofenceRadius ?? body.radiusM ?? "200"),
        timezone: body.timezone,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        companyId: user.companyId,
      },
    });
    return apiSuccess({ project }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
