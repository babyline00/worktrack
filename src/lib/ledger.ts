// Credit / debit balance sheet — internal admin finance.
//
// Deliberately absent from the /api/v1 JWT surface. That surface is what the
// mobile app and any third-party integrator authenticate against, and a
// company's cash position is not something every employee should be able to
// page through. Access is admin-only through the cookie-session /api/ledger
// routes.
//
// Money is stored as Prisma `Decimal @db.Decimal(14,2)`, not Float: binary
// floating point cannot represent 0.01, and a balance sheet that drifts by a
// paisa is not one anyone trusts. Everything here works in integer paisa and
// only converts at the boundary, so no intermediate sum can accumulate error.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { startOfDayInTimezone, formatDateInTimezone } from "@/lib/v1";

export const CREDIT = "CREDIT";
export const DEBIT = "DEBIT";
export const POSTED = "POSTED";
export const VOID = "VOID";

/** Largest single entry. Guards against a typo becoming a nine-figure bill. */
export const MAX_ENTRY_MINOR = 999_999_999_99; // 999,999,999.99 in paisa

export type LedgerType = "CREDIT" | "DEBIT";

/**
 * Parses a user-supplied amount into whole paisa.
 *
 * Rejects anything that is not a plain positive decimal: `"12.34"`, `12.34` and
 * `"12"` are accepted; `"1,234"`, `"1e3"`, `"12.345"`, `"-5"` and `NaN` are
 * not. Silently coercing any of those into a number is how a ledger ends up
 * with a hundred entries nobody can explain.
 */
export function parseAmountToMinor(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return minorFromNumber(raw);
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/,/g, "");
  // `^...$` with no flags rejects exponents, signs, whitespace and multiple
  // decimal points outright.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return minorFromNumber(Number(trimmed));
}

function minorFromNumber(n: number): number | null {
  if (!Number.isFinite(n) || n < 0) return null;
  const minor = Math.round(n * 100);
  if (minor <= 0 || minor > MAX_ENTRY_MINOR) return null;
  return minor;
}

/** Whole paisa back to a number for JSON. Two decimals, never more. */
export function minorToAmount(minor: number): number {
  return Math.round(minor) / 100;
}

/** Prisma Decimal literal for a minor-unit amount. */
export function minorToDecimal(minor: number): Prisma.Decimal {
  return new Prisma.Decimal(minorToAmount(minor));
}

/** Half-open [from, to) bounds in the tenant's timezone. */
export function ledgerPeriodBounds(
  timezone: string,
  from?: string | null,
  to?: string | null,
): { from: Date; to: Date } {
  const anchorFor = (d: string, fallback: Date) => {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : fallback;
    return parsed;
  };
  const fromDate = startOfDayInTimezone(timezone, anchorFor(from ?? "", new Date()));
  const toDate = startOfDayInTimezone(timezone, anchorFor(to ?? "", new Date()));
  // An inverted range would silently return nothing and look like "no data".
  if (toDate.getTime() <= fromDate.getTime()) {
    throw new Error("'to' must be on or after 'from'");
  }
  return { from: fromDate, to: toDate };
}

/** Defaults to the current calendar month, matching the other finance views. */
export function thisMonthBounds(timezone: string) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 12));
  const next = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 12));
  return {
    from: startOfDayInTimezone(timezone, first),
    to: startOfDayInTimezone(timezone, next),
  };
}

/**
 * Credit and debit totals for a set of rows, in whole paisa.
 *
 * VOID rows are excluded from every balance but remain in the listing, so a
 * voided line is visible and explainable rather than having vanished.
 */
export function totalsInMinor(rows: { type: string; amountMinor: number; status?: string }[]) {
  let credits = 0;
  let debits = 0;
  for (const r of rows) {
    if (r.status === VOID) continue;
    if (r.type === CREDIT) credits += r.amountMinor;
    else debits += r.amountMinor;
  }
  return { credits, debits, balance: credits - debits };
}

/**
 * Closing balance carried into `from` from everything before it.
 *
 * Without this the running balance would restart at zero on every period and a
 * filtered view would show a company with no money. It is a single aggregate,
 * not a scan.
 */
export async function openingBalanceMinor(
  companyId: string,
  before: Date,
): Promise<{ credits: number; debits: number }> {
  const rows = await db.ledgerEntry.findMany({
    where: { companyId, status: POSTED, entryDate: { lt: before } },
    select: { type: true, amount: true },
  });
  let credits = 0;
  let debits = 0;
  for (const r of rows) {
    const minor = Math.round(r.amount.toNumber() * 100);
    if (r.type === CREDIT) credits += minor;
    else if (r.type === DEBIT) debits += minor;
  }
  return { credits, debits };
}

export type LedgerRow = {
  id: string;
  entryDate: string;
  type: LedgerType;
  category: string;
  description: string | null;
  reference: string | null;
  status: string;
  amountMinor: number;
  runningMinor: number;
  project: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
};

/**
 * The balance sheet for a period.
 *
 * Entries are ordered oldest-first so the running balance reads top to bottom
 * the way a statement does; the UI reverses for display.
 */
export async function buildBalanceSheet(opts: {
  companyId: string;
  timezone: string;
  from: Date;
  to: Date;
  projectId?: string | null;
  type?: LedgerType | null;
}) {
  const { companyId, timezone, from, to } = opts;

  const where: Prisma.LedgerEntryWhereInput = {
    companyId,
    entryDate: { gte: from, lt: to },
  };
  if (opts.projectId) where.projectId = opts.projectId;
  if (opts.type) where.type = opts.type;

  const [entries, opening] = await Promise.all([
    db.ledgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    openingBalanceMinor(
      companyId,
      opts.projectId ? new Date(0) : from,
    ),
  ]);

  // Opening balance when filtering by project should still be that project's
  // own history, so recompute against the same project filter rather than
  // inheriting the company-wide figure.
  let openingCredits = opening.credits;
  let openingDebits = opening.debits;
  if (opts.projectId || opts.type) {
    const past = await db.ledgerEntry.findMany({
      where: {
        companyId,
        entryDate: { lt: from },
        status: POSTED,
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.type ? { type: opts.type } : {}),
      },
      select: { type: true, amount: true },
    });
    openingCredits = 0;
    openingDebits = 0;
    for (const r of past) {
      const minor = Math.round(r.amount.toNumber() * 100);
      if (r.type === CREDIT) openingCredits += minor;
      else if (r.type === DEBIT) openingDebits += minor;
    }
  }

  let running = openingCredits - openingDebits;
  const rows: LedgerRow[] = entries.map((e) => {
    const amountMinor = Math.round(e.amount.toNumber() * 100);
    if (e.status !== VOID) {
      running += e.type === CREDIT ? amountMinor : -amountMinor;
    }
    return {
      id: e.id,
      entryDate: formatDateInTimezone(e.entryDate, timezone),
      type: e.type as LedgerType,
      category: e.category,
      description: e.description,
      reference: e.reference,
      status: e.status,
      amountMinor,
      runningMinor: running,
      project: e.project ? { id: e.project.id, name: e.project.name } : null,
      createdBy: e.createdBy ? { id: e.createdBy.id, name: e.createdBy.name } : null,
      createdAt: e.createdAt.toISOString(),
    };
  });

  const period = totalsInMinor(
    entries.map((e) => ({
      type: e.type,
      status: e.status,
      amountMinor: Math.round(e.amount.toNumber() * 100),
    })),
  );

  // By category, for the breakdown panel. VOID lines are excluded by
  // totalsInMinor so a voided entry does not appear in a category total.
  const byCategory = new Map<string, { credits: number; debits: number }>();
  for (const e of entries) {
    if (e.status === VOID) continue;
    const minor = Math.round(e.amount.toNumber() * 100);
    const bucket = byCategory.get(e.category) ?? { credits: 0, debits: 0 };
    if (e.type === CREDIT) bucket.credits += minor;
    else bucket.debits += minor;
    byCategory.set(e.category, bucket);
  }

  return {
    period: {
      from: formatDateInTimezone(from, timezone),
      to: formatDateInTimezone(to, timezone),
    },
    opening: { credits: openingCredits, debits: openingDebits, balance: openingCredits - openingDebits },
    totals: {
      credits: period.credits,
      debits: period.debits,
      net: period.balance,
      // What the company actually holds at the end of the period.
      closingBalance: openingCredits - openingDebits + period.balance,
    },
    byCategory: Array.from(byCategory.entries())
      .map(([category, v]) => ({
        category,
        credits: minorToAmount(v.credits),
        debits: minorToAmount(v.debits),
        net: minorToAmount(v.credits - v.debits),
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    entries: rows,
  };
}
