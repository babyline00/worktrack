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

// PATCH /api/v1/employees/:id/status
// Body: { status: "ACTIVE" | "INACTIVE" }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    if (!body.status || !["ACTIVE", "INACTIVE"].includes(body.status.toUpperCase())) {
      throw ERRORS.VALIDATION("status must be ACTIVE or INACTIVE");
    }

    const emp = await db.employee.findUnique({ where: { id: (await params).id } });
    if (!emp || emp.companyId !== user.companyId) throw ERRORS.NOT_FOUND();

    const oldValue = { status: emp.status };
    const updated = await db.employee.update({
      where: { id: (await params).id },
      data: { status: body.status.toUpperCase() },
    });

    await auditLog({
      action: "EMPLOYEE_STATUS_CHANGED",
      entity: "employee",
      entityId: (await params).id,
      performedById: user.sub,
      companyId: user.companyId,
      oldValue,
      newValue: { status: updated.status },
      req,
    });

    return apiSuccess({ employee: updated });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
