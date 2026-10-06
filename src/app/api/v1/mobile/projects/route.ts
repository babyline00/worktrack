import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/projects
// Returns projects assigned to the authenticated employee
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN("Mobile endpoints are for employee accounts only");

    const assignments = await db.assignment.findMany({
      where: { employeeId: user.employeeId, status: "ACTIVE" },
      include: { project: true },
    });

    return apiSuccess({
      projects: assignments.map((a) => ({
        id: a.project.id,
        name: a.project.name,
        code: a.project.code,
        status: a.project.status,
        client: a.project.client,
        description: a.project.description,
        location: a.project.location,
        coords: { latitude: a.project.lat, longitude: a.project.lng },
        radius: a.project.radiusM,
        timezone: a.project.timezone,
        startDate: a.project.startDate?.toISOString().split("T")[0],
        endDate: a.project.endDate?.toISOString().split("T")[0] ?? null,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
