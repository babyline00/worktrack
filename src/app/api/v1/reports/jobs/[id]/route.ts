import { db } from "@/lib/db";
import { requireRole, apiSuccess, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/jobs/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const job = await db.reportJob.findUnique({ where: { id: (await params).id } });
    if (!job || job.companyId !== user.companyId) throw ERRORS.NOT_FOUND("Job not found");
    return apiSuccess({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        from: job.from.toISOString().split("T")[0],
        to: job.to.toISOString().split("T")[0],
        format: job.resultFormat,
        resultUrl: job.resultUrl,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
