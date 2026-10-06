import { db } from "@/lib/db";
import {
  requireRole,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
} from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/projects/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const p = await db.project.findUnique({
      where: { id: (await params).id },
      include: { assignments: { where: { status: "ACTIVE" }, include: { employee: true } } },
    });
    if (!p || p.companyId !== user.companyId) throw ERRORS.NOT_FOUND();
    return apiSuccess({ project: p });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// PATCH /api/v1/projects/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const p = await db.project.findUnique({ where: { id: (await params).id } });
    if (!p || p.companyId !== user.companyId) throw ERRORS.NOT_FOUND();

    const updated = await db.project.update({
      where: { id: (await params).id },
      data: {
        name: body.name,
        client: body.client ?? body.clientName,
        description: body.description,
        status: (body.status ?? "ACTIVE").toUpperCase(),
        location: body.location,
        lat: body.latitude !== undefined ? parseFloat(body.latitude) : undefined,
        lng: body.longitude !== undefined ? parseFloat(body.longitude) : undefined,
        radiusM: body.geofenceRadius !== undefined ? parseInt(body.geofenceRadius) : (body.radiusM !== undefined ? parseInt(body.radiusM) : undefined),
      },
    });
    return apiSuccess({ project: updated });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}

// DELETE /api/v1/projects/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
    const p = await db.project.findUnique({ where: { id: (await params).id } });
    if (!p || p.companyId !== user.companyId) throw ERRORS.NOT_FOUND();
    await db.project.delete({ where: { id: (await params).id } });
    return apiSuccess({ success: true, message: "Project deleted" });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
