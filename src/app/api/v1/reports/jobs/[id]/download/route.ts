import { db } from "@/lib/db";
import { requireRole, apiError, ApiError, ERRORS } from "@/lib/v1";

export const runtime = "nodejs";

// GET /api/v1/reports/jobs/:id/download
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    const job = await db.reportJob.findUnique({ where: { id: (await params).id } });
    if (!job || job.companyId !== user.companyId) throw ERRORS.NOT_FOUND();
    if (job.status !== "COMPLETED") {
      return apiError(new ApiError("JOB_NOT_READY", "Report is still processing", 400));
    }

    const cache = (globalThis as any).__reportCache as Map<string, { csv: string; fileName: string }> | undefined;
    const entry = cache?.get((await params).id);
    if (!entry) return apiError(ERRORS.NOT_FOUND("Report file not found (expired)"));

    return new Response(entry.csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${entry.fileName}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
