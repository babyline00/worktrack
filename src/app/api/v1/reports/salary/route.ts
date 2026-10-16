import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  resolveTimezone,
} from "@/lib/v1";
import { computeMonthlySalary, saveSalaryRates, parseMonth } from "@/lib/salary";

export const runtime = "nodejs";

// GET  /api/v1/reports/salary?month=2026-10[&employeeId=...]
// POST /api/v1/reports/salary   { rates: { [employeeId]: hourlyRate }, overtimeMultiplier? }
//
// The computation lives in lib/salary so the admin web UI — which authenticates
// with a NextAuth cookie rather than a v1 JWT — can serve the same numbers from
// /api/attendance/salary without a second implementation drifting from this one.

export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    if (!user.companyId) throw ERRORS.FORBIDDEN("Token is not scoped to a company");
    const timezone = await resolveTimezone(user);

    const url = new URL(req.url);
    let period;
    try {
      period = parseMonth(url.searchParams.get("month"));
    } catch (e: any) {
      throw ERRORS.VALIDATION(e.message);
    }

    const payload = await computeMonthlySalary({
      companyId: user.companyId,
      timezone,
      year: period.year,
      month0: period.month0,
      employeeId: url.searchParams.get("employeeId") ?? undefined,
    });

    return apiSuccess(payload);
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    if (!user.companyId) throw ERRORS.FORBIDDEN("Token is not scoped to a company");
    // Bound to a local: TypeScript does not carry the narrowing above into the
    // callbacks lib/salary builds.
    const companyId = user.companyId;

    const body = await req.json().catch(() => ({}));
    try {
      const { saved } = await saveSalaryRates({
        companyId,
        rates: body?.rates,
        overtimeMultiplier: body?.overtimeMultiplier,
      });
      return apiSuccess({ saved, message: `Saved ${saved} rate(s)` });
    } catch (e: any) {
      throw ERRORS.VALIDATION(e.message);
    }
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
