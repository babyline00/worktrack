import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  auditLog,
} from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/projects/:id/employees
// Body: { employeeIds: ["emp_001", "emp_002"] }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { employeeIds } = body;
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw ERRORS.VALIDATION("employeeIds array is required");
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project || project.companyId !== user.companyId) throw ERRORS.NOT_FOUND("Project not found");

    // Verify all employees belong to company
    const employees = await db.employee.findMany({ where: { id: { in: employeeIds }, companyId: user.companyId } });
    if (employees.length !== employeeIds.length) {
      throw ERRORS.VALIDATION("Some employees were not found in your company");
    }

    // Create assignments (skip existing)
    const result = await db.$transaction(
      employeeIds.map((empId: string) =>
        db.assignment.upsert({
          where: { employeeId_projectId: { employeeId: empId, projectId: id } },
          update: { status: "ACTIVE", removedAt: null },
          create: { employeeId: empId, projectId: id, status: "ACTIVE" },
        })
      )
    );

    await auditLog({
      action: "EMPLOYEES_ASSIGNED",
      entity: "project",
      entityId: id,
      performedById: user.sub,
      companyId: user.companyId,
      newValue: { employeeIds },
      req,
    });

    return apiSuccess({ assigned: result.length, employees: result }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// DELETE /api/v1/projects/:id/employees/:employeeId
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; employeeId: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const assignment = await db.assignment.findUnique({
      where: { employeeId_projectId: { employeeId: (await params).employeeId, projectId: (await params).id } },
    });
    if (!assignment) throw ERRORS.NOT_FOUND("Assignment not found");

    await db.assignment.update({
      where: { employeeId_projectId: { employeeId: (await params).employeeId, projectId: (await params).id } },
      data: { status: "REMOVED", removedAt: new Date() },
    });

    await auditLog({
      action: "EMPLOYEE_REMOVED_FROM_PROJECT",
      entity: "project",
      entityId: (await params).id,
      performedById: user.sub,
      companyId: user.companyId,
      oldValue: { employeeId: (await params).employeeId },
      req,
    });

    return apiSuccess({ success: true, message: "Employee removed from project" });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
