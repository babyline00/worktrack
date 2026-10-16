import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeMonthlySalary, saveSalaryRates, parseMonth } from "@/lib/salary";

// GET /api/attendance/salary?month=2026-10[&employeeId=...]
// POST /api/attendance/salary  { rates: {...}, overtimeMultiplier? }
//
// Cookie-session twin of /api/v1/reports/salary. The admin web UI is on
// NextAuth cookies and carries no v1 JWT, so it cannot call the v1 route — but
// both call the same lib/salary implementation, so the figures cannot diverge.

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
    // Managers can read payroll figures; only admins can change rates.
    const role = String(user.role ?? "");
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) {
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

    const payload = await computeMonthlySalary({
      companyId,
      timezone: company?.timezone ?? "Asia/Karachi",
      year: period.year,
      month0: period.month0,
      employeeId: url.searchParams.get("employeeId") ?? undefined,
    });

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Failed to load salary data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    // Rates change pay, so unlike reading them this is admin-only. The v1 route
    // enforces the same split.
    if (!["SUPER_ADMIN", "ADMIN"].includes(String(user.role ?? ""))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    try {
      const { saved } = await saveSalaryRates({
        companyId,
        rates: body?.rates,
        overtimeMultiplier: body?.overtimeMultiplier,
      });
      return NextResponse.json({ saved, message: `Saved ${saved} rate(s)` });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to save rates" }, { status: 500 });
  }
}
