import { db } from "@/lib/db";
import { requireAuth, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// Roles that own the company leave inbox.
const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

// GET /api/v1/leaves
export async function GET(req: Request) {
  try {
    // Was manager-only, so an employee always got a 403 and the app's Leave tab
    // silently rendered "no requests" for the only role that uses it.
    const user = await requireAuth(req);
    const isManager = MANAGER_ROLES.includes(user.role);

    const where = isManager
      ? { employee: { companyId: user.companyId } }
      : // An employee may only ever see their own requests.
        { employeeId: user.employeeId };

    if (!isManager && !user.employeeId) {
      throw ERRORS.FORBIDDEN("No employee record is linked to this account");
    }

    const leaves = await db.leaveRequest.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({
      leaves: leaves.map((l) => ({
        id: l.id,
        // The cuid the POST endpoint expects. It used to send `empId` here,
        // so the app's client-side "is this mine?" filter could never match and
        // re-submitting the value would 404.
        employeeId: l.employeeId,
        empId: l.employee.empId,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        employeeInitials:
          (l.employee.firstName[0] ?? "") + (l.employee.lastName[0] ?? ""),
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
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const { employeeId, type, from, to, reason } = body;
    if (!employeeId || !from || !to)
      throw ERRORS.VALIDATION("employeeId, from, to are required");

    // Accept either the cuid or the human employee code. The app only has the
    // code from its login response, and the previous `findUnique({ id })` made
    // every leave submission 404.
    const emp = await db.employee.findFirst({
      where: {
        companyId: user.companyId,
        OR: [{ id: employeeId }, { empId: employeeId }],
      },
    });
    if (!emp) throw ERRORS.NOT_FOUND();

    // An employee can only request leave for themselves.
    if (!MANAGER_ROLES.includes(user.role) && emp.id !== user.employeeId) {
      throw ERRORS.FORBIDDEN();
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw ERRORS.VALIDATION("from and to must be valid dates");
    }
    if (toDate < fromDate) {
      throw ERRORS.VALIDATION("to date cannot be before the from date");
    }
    const days =
      Math.max(
        1,
        Math.round(
          (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );

    const leave = await db.leaveRequest.create({
      data: {
        employeeId: emp.id,
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

    // Tell the employee their own request landed, not just the admins.
    await db.notification.create({
      data: {
        userId: user.sub,
        companyId: user.companyId,
        type: "LEAVE",
        title: "Leave request submitted",
        description: `Your ${type?.toLowerCase() ?? "annual"} leave request for ${days} day${days > 1 ? "s" : ""} is awaiting approval`,
        timeAgo: "Just now",
        unread: true,
      },
    });

    return apiSuccess({ leave, leaveId: leave.id }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}