import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/profile
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const emp = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: { department: true, company: true },
    });
    if (!emp) throw ERRORS.NOT_FOUND("Employee not found");

    const assignments = await db.assignment.findMany({
      where: { employeeId: emp.id, status: "ACTIVE" },
      include: { project: true },
    });

    return apiSuccess({
      id: emp.id,
      employeeId: emp.empId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name ?? null,
      designation: emp.designation,
      status: emp.status,
      avatarColor: emp.avatarColor,
      avatarUrl: emp.avatarUrl,
      company: {
        id: emp.company.id,
        name: emp.company.name,
        code: emp.company.code,
        timezone: emp.company.timezone,
      },
      projects: assignments.map((a) => ({
        id: a.project.id,
        name: a.project.name,
        code: a.project.code,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// PATCH /api/v1/mobile/profile
export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();
    const body = await req.json().catch(() => ({}));
    const { phone, email } = body;

    const emp = await db.employee.update({
      where: { id: user.employeeId },
      data: {
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
      },
    });
    return apiSuccess({ employee: emp });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
