import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/employees/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const emp = await db.employee.findUnique({
      where: { id: (await params).id },
      include: { department: true, assignments: { include: { project: true } }, company: true },
    });
    if (!emp || emp.companyId !== user.companyId) throw ERRORS.NOT_FOUND("Employee not found");

    return apiSuccess({
      id: emp.id,
      employeeId: emp.empId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name ?? null,
      designation: emp.designation,
      status: emp.status.toLowerCase(),
      avatarColor: emp.avatarColor,
      projects: emp.assignments
        .filter((a) => a.status === "ACTIVE")
        .map((a) => ({ id: a.project.id, name: a.project.name, code: a.project.code })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// PATCH /api/v1/employees/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const emp = await db.employee.findUnique({ where: { id: (await params).id } });
    if (!emp || emp.companyId !== user.companyId) throw ERRORS.NOT_FOUND();

    const updated = await db.employee.update({
      where: { id: (await params).id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId,
        designation: body.designation,
        avatarColor: body.avatarColor,
      },
    });
    return apiSuccess({ employee: updated });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// DELETE /api/v1/employees/:id — soft delete (set INACTIVE)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const emp = await db.employee.findUnique({ where: { id: (await params).id } });
    if (!emp || emp.companyId !== user.companyId) throw ERRORS.NOT_FOUND();

    await db.employee.update({ where: { id: (await params).id }, data: { status: "INACTIVE" } });
    return apiSuccess({ success: true, message: "Employee deactivated" });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
