import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/departments
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const departments = await db.department.findMany({
      where: { companyId: user.companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    });
    return apiSuccess({
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        employeeCount: d._count.employees,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// POST /api/v1/departments
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    if (!body.name) throw ERRORS.VALIDATION("name is required");
    const dept = await db.department.create({
      data: { name: body.name, companyId: user.companyId },
    });
    return apiSuccess({ department: dept }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
