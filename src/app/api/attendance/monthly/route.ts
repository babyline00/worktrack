import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeMonthlyAttendance, parseMonth } from "@/lib/salary";

// GET /api/attendance/monthly?month=2026-10[&projectId=...]
//
// Cookie-session twin of /api/v1/reports/attendance/monthly. Same lib
// implementation, so the daily screen, this rollup and the salary calculator
// all read the same Attendance rows and reconcile.

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    const companyId = user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "No company on session" }, { status: 403 });
    }
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(String(user.role ?? ""))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });

    const url = new URL(req.url);
    let period;
    try {
      period = parseMonth(url.searchParams.get("month"));
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const payload = await computeMonthlyAttendance({
      companyId,
      timezone: company?.timezone ?? "Asia/Karachi",
      year: period.year,
      month0: period.month0,
      projectId: url.searchParams.get("projectId") ?? undefined,
    });

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to load monthly attendance" },
      { status: 500 },
    );
  }
}
