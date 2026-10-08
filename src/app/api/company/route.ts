import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Session-authenticated company profile, for the admin Settings page.
// The JWT equivalents live under /api/v1/company.

const STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"];

function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** IANA timezone, so Intl accepts it when formatting timestamps. */
function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const body = await req.json();
  const existing = await db.company.findUnique({ where: { id: companyId } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const data: Prisma.CompanyUpdateInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Company name is required", errors: { name: "Company name is required" } }, { status: 400 });
    }
    data.name = name;
  }

  if (body.code !== undefined) {
    const code = String(body.code).trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(code)) {
      return NextResponse.json({ error: "Code must be 2–32 letters, numbers or dashes", errors: { code: "Use 2–32 letters, numbers or dashes" } }, { status: 400 });
    }
    // Employees type this to reach the mobile app, so a clash would lock them out.
    const clash = await db.company.findFirst({ where: { code, NOT: { id: companyId } } });
    if (clash) {
      return NextResponse.json({ error: `Company code "${code}" is already in use`, errors: { code: "Already in use" } }, { status: 409 });
    }
    data.code = code;
  }

  for (const key of ["industry", "email", "phone", "address", "logo"] as const) {
    if (body[key] !== undefined) data[key] = trimToNull(body[key]);
  }

  if (body.currency !== undefined) {
    const currency = String(body.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Currency must be a 3-letter code, e.g. PKR", errors: { currency: "Use a 3-letter code" } }, { status: 400 });
    }
    data.currency = currency;
  }

  if (body.timezone !== undefined) {
    const timezone = String(body.timezone).trim();
    if (!validTimezone(timezone)) {
      return NextResponse.json({ error: "Unknown timezone", errors: { timezone: "Use an IANA zone, e.g. Asia/Karachi" } }, { status: 400 });
    }
    data.timezone = timezone;
  }

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status must be ACTIVE, SUSPENDED or INACTIVE", errors: { status: "Invalid status" } }, { status: 400 });
    }
    data.status = status;
  }

  const company = await db.company.update({ where: { id: companyId }, data });
  return NextResponse.json({ company });
}