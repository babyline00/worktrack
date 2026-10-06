import { db } from "@/lib/db";
import { requireAuth, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/auth/me
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const dbUser = await db.user.findUnique({
      where: { id: user.sub },
      include: { employee: { include: { company: true, department: true } } },
    });
    if (!dbUser) throw ERRORS.NOT_FOUND("User not found");

    return apiSuccess({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      companyId: dbUser.companyId,
      employee: dbUser.employee
        ? {
            id: dbUser.employee.id,
            employeeId: dbUser.employee.empId,
            firstName: dbUser.employee.firstName,
            lastName: dbUser.employee.lastName,
            department: dbUser.employee.department?.name ?? null,
            designation: dbUser.employee.designation,
            status: dbUser.employee.status,
            avatarColor: dbUser.employee.avatarColor,
            avatarUrl: dbUser.employee.avatarUrl,
            phone: dbUser.employee.phone,
            company: dbUser.employee.company
              ? { id: dbUser.employee.company.id, name: dbUser.employee.company.name, code: dbUser.employee.company.code, timezone: dbUser.employee.company.timezone }
              : null,
          }
        : null,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
