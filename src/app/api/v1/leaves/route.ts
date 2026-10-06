import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/leaves
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const leaves = await db.leaveRequest.findMany({
      where: { employee: { companyId: user.companyId } },
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({
      leaves: leaves.map((l) => ({
        id: l.id,
        employeeId: l.employee.empId,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        employeeInitials: (l.employee.firstName[0] ?? "") + (l.employee.lastName[0] ?? ""),
        avatarColor: l.employee.avatarColor,
        type: l.type,
        from: l.fromDate.toISOString().split("T")[0],
        to: l.toDate.toISOString().split("T")[0],
        days: l.days,
        reason: l.reason,
        status: l.status.toLowerCase(),
        reviewedAt: l.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// POST /api/v1/leaves (employee self-request via admin, or admin on behalf)
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
    const body = await req.json().catch(() => ({}));
    const { employeeId, type, from, to, reason } = body;
    if (!employeeId || !from || !to) throw ERRORS.VALIDATION("employeeId, from, to are required");

    const emp = await db.employee.findUnique({ where: { id: employeeId } });
    if (!emp || emp.companyId !== user.companyId) throw ERRORS.NOT_FOUND();

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const leave = await db.leaveRequest.create({
      data: {
        employeeId,
        type: type ?? "ANNUAL",
        fromDate,
        toDate,
        days,
        reason,
        status: "PENDING",
      },
    });

    await db.notification.create({
      data: {
        companyId: user.companyId,
        type: "LEAVE",
        title: "New leave request",
        description: `${emp.firstName} requested ${days} day${days > 1 ? "s" : ""} ${type?.toLowerCase() ?? "annual"} leave`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    return apiSuccess({ leave }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
