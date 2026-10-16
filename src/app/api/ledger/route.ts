import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCompanyRole, CONFIG_WRITE_ROLES } from "@/lib/api-auth";
import { auditLog, startOfDayInTimezone } from "@/lib/v1";
import {
  buildBalanceSheet,
  ledgerPeriodBounds,
  thisMonthBounds,
  parseAmountToMinor,
  minorToDecimal,
  CREDIT,
  DEBIT,
  POSTED,
  type LedgerType,
} from "@/lib/ledger";

// GET  /api/ledger?from=&to=&projectId=&type=
// POST /api/ledger   { type, category, amount, entryDate?, description?, reference?, projectId? }
//
// Internal finance. Deliberately not exposed on /api/v1 — see lib/ledger.ts.
// Admin-only in both directions: a company's cash position is not something a
// manager or employee should be able to page through.

export async function GET(req: Request) {
  try {
    const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
    if ("error" in auth) return auth.error;
    const { companyId, userId } = auth;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { timezone: true, currency: true },
    });
    const timezone = company?.timezone ?? "Asia/Karachi";

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const projectId = url.searchParams.get("projectId") || null;
    const rawType = url.searchParams.get("type");
    if (rawType && rawType !== CREDIT && rawType !== DEBIT) {
      return NextResponse.json(
        { error: "type must be CREDIT or DEBIT" },
        { status: 400 },
      );
    }
    const type = (rawType as LedgerType | null) ?? null;

    // No explicit range means the current calendar month, matching the monthly
    // records and salary views so the three cannot disagree about "this month".
    let bounds: { from: Date; to: Date };
    if (from || to) {
      try {
        const today = thisMonthBounds(timezone);
        bounds = ledgerPeriodBounds(
          timezone,
          from,
          to ?? new Date(today.to.getTime() - 86_400_000).toISOString().slice(0, 10),
        );
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    } else {
      bounds = thisMonthBounds(timezone);
    }

    const sheet = await buildBalanceSheet({
      companyId,
      timezone,
      from: bounds.from,
      to: bounds.to,
      projectId,
      type,
    });

    return NextResponse.json({
      ...sheet,
      currency: company?.currency ?? "PKR",
    });
  } catch {
    return NextResponse.json({ error: "Failed to load balance sheet" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
    if ("error" in auth) return auth.error;
    const { companyId, userId } = auth;

    const body = await req.json().catch(() => ({}));
    const errors: Record<string, string> = {};
    const type = body.type === DEBIT ? DEBIT : body.type === CREDIT ? CREDIT : null;
    if (!type) errors.type = "Choose Credit or Debit";

    const category = String(body.category ?? "").trim();
    if (!category) errors.category = "Category is required";
    else if (category.length > 80) errors.category = "Keep the category under 80 characters";

    const amountMinor = parseAmountToMinor(body.amount);
    if (amountMinor == null) {
      errors.amount = "Enter a positive amount with at most 2 decimal places";
    }

    let entryDate: Date | undefined;
    if (body.entryDate) {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate))
        ? new Date(`${body.entryDate}T12:00:00Z`)
        : new Date(body.entryDate);
      if (isNaN(d.getTime())) errors.entryDate = "Invalid date";
      else entryDate = d;
    }

    // Reject a project from another tenant. The id arrives from the client, so
    // without this a crafted body could attribute cost to someone else's site.
    let projectId: string | null = null;
    if (body.projectId) {
      const project = await db.project.findFirst({
        where: { id: String(body.projectId), companyId },
        select: { id: true },
      });
      if (!project) errors.projectId = "Project not found";
      else projectId = project.id;
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Please fix the highlighted fields", errors }, { status: 400 });
    }

    // Non-null because each of these was recorded in `errors` above when it was
    // missing, and reaching here means `errors` came back empty. Spelling the
    // invariant out at the single point it is established, rather than with a
    // `!` at every use.
    if (type == null || amountMinor == null) {
      return NextResponse.json({ error: "Type and amount are required" }, { status: 400 });
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const timezone = company?.timezone ?? "Asia/Karachi";
    const date = startOfDayInTimezone(timezone, entryDate ?? new Date());

    const entry = await db.ledgerEntry.create({
      data: {
        companyId,
        entryDate: date,
        type,
        category,
        amount: minorToDecimal(amountMinor),
        description: body.description ? String(body.description).slice(0, 500) : null,
        reference: body.reference ? String(body.reference).slice(0, 80) : null,
        projectId,
        status: POSTED,
        createdById: userId,
      },
    });

    await auditLog({
      action: "LEDGER_ENTRY_CREATED",
      entity: "ledgerEntry",
      entityId: entry.id,
      performedById: userId,
      companyId,
      newValue: {
        type,
        category,
        amount: amountMinor! / 100,
        reference: entry.reference,
      },
      req,
    });

    return NextResponse.json(
      { entry: { ...entry, amount: entry.amount.toString() } },
      { status: 201 },
    );
  } catch (err) {
    // Logged rather than returned: a finance failure needs to be traceable, but
    // the message can carry schema detail that has no business in a response.
    console.error("[ledger] create failed:", err);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
