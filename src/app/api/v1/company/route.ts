import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/company
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
    const company = await db.company.findUnique({ where: { id: user.companyId } });
    if (!company) throw ERRORS.NOT_FOUND();
    return apiSuccess({
      id: company.id,
      name: company.name,
      code: company.code,
      industry: company.industry,
      email: company.email,
      phone: company.phone,
      address: company.address,
      logo: company.logo,
      timezone: company.timezone,
      currency: company.currency,
      status: company.status.toLowerCase(),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// PATCH /api/v1/company
export async function PATCH(req: Request) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const updated = await db.company.update({
      where: { id: user.companyId },
      data: {
        name: body.name,
        industry: body.industry,
        email: body.email,
        phone: body.phone,
        address: body.address,
        timezone: body.timezone,
        currency: body.currency,
      },
    });
    return apiSuccess({ company: updated });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
