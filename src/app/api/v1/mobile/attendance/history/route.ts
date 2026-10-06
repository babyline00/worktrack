import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  formatTimeInTimezone,
  paginate,
  formatMins,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/mobile/attendance/history?page=1&limit=20&from=2026-10-01&to=2026-10-31
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId) throw ERRORS.FORBIDDEN();

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const { page, limit, skip } = paginate(req);

    const emp = await db.employee.findUnique({
      where: { id: user.employeeId },
      include: { company: true },
    });
    if (!emp) throw ERRORS.NOT_FOUND("Employee not found");

    const where: any = { employeeId: emp.id };
    if (from || to) {
      where.attendanceDate = {};
      if (from) where.attendanceDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.attendanceDate.lte = toDate;
      }
    }

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: { project: true },
        orderBy: { attendanceDate: "desc" },
        skip,
        take: limit,
      }),
      db.attendance.count({ where }),
    ]);

    return apiSuccess({
      data: records.map((r) => ({
        id: r.id,
        date: r.attendanceDate.toISOString().split("T")[0],
        project: r.project?.name ?? "—",
        projectCode: r.project?.code ?? null,
        checkIn: formatTimeInTimezone(r.checkIn, emp.company.timezone),
        checkOut: formatTimeInTimezone(r.checkOut, emp.company.timezone),
        workingMinutes: r.workingMins,
        workingTime: formatMins(r.workingMins),
        sessionStatus: r.sessionStatus,
        attendanceStatus: r.attendanceStatus,
        verificationStatus: r.verificationStatus,
        lateMinutes: r.lateMins,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
