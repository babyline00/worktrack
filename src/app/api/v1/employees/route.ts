import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  paginate,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/employees?page=1&limit=20&search=&status=&department=
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const departmentId = url.searchParams.get("departmentId");
    const { page, limit, skip } = paginate(req);

    const where: any = { companyId: user.companyId };
    if (status) where.status = status.toUpperCase();
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { empId: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: { department: true, assignments: { where: { status: "ACTIVE" }, include: { project: true } } },
        orderBy: { firstName: "asc" },
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
    ]);

    return apiSuccess({
      data: employees.map((e) => ({
        id: e.id,
        employeeId: e.empId,
        firstName: e.firstName,
        lastName: e.lastName,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        phone: e.phone,
        department: e.department?.name ?? null,
        designation: e.designation,
        status: e.status.toLowerCase(),
        avatarColor: e.avatarColor,
        projects: e.assignments.map((a) => ({ id: a.project.id, name: a.project.name })),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// POST /api/v1/employees
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));

    if (!body.employeeId || !body.firstName) {
      throw ERRORS.VALIDATION("employeeId and firstName are required");
    }

    // Check empId unique within company
    const existing = await db.employee.findUnique({
      where: { companyId_empId: { companyId: user.companyId, empId: body.employeeId } },
    });
    if (existing) throw ERRORS.CONFLICT("EMPLOYEE_ID_EXISTS", "Employee ID already exists in this company");

    const emp = await db.employee.create({
      data: {
        empId: body.employeeId,
        firstName: body.firstName,
        lastName: body.lastName ?? "",
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId,
        designation: body.designation,
        status: body.status?.toUpperCase() ?? "ACTIVE",
        avatarColor: body.avatarColor ?? "#2563eb",
        companyId: user.companyId,
      },
    });

    // Assign projects
    if (body.projectIds?.length) {
      await db.assignment.createMany({
        data: body.projectIds.map((pid: string) => ({ employeeId: emp.id, projectId: pid })),
        skipDuplicates: true,
      });
    }

    return apiSuccess({ employee: emp }, 201);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
