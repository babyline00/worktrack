import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/shifts
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const shifts = await db.shift.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "asc" },
    });
    return apiSuccess({ shifts });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// POST /api/v1/shifts
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    if (!body.name) throw ERRORS.VALIDATION("name is required");
    const shift = await db.shift.create({
      data: {
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        graceMins: parseInt(body.graceMins ?? "15"),
        breakMins: parseInt(body.breakMins ?? "45"),
        workingDays: body.workingDays ?? "Mon,Tue,Wed,Thu,Fri",
        companyId: user.companyId,
      },
    });
    return apiSuccess({ shift }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
