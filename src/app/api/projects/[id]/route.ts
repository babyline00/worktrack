import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;

/** A radius this large is how "no limit" is represented (see POST /api/projects). */
const NO_LIMIT_RADIUS = 9999999;

async function authedCompany() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { companyId: (session.user as any).companyId as string };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;
  const { companyId } = auth;

  const id = (await params).id;
  const body = await req.json();

  // Scope the lookup to the caller's company. A bare `update({ where: { id } })`
  // let any authenticated admin edit or delete another tenant's project by id.
  const existing = await db.project.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const data: Prisma.ProjectUpdateInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    data.name = name;
  }

  if (body.code !== undefined) {
    const code = String(body.code).trim();
    if (!code) return NextResponse.json({ error: "Project code is required" }, { status: 400 });
    const clash = await db.project.findFirst({ where: { code, NOT: { id } } });
    if (clash) {
      return NextResponse.json({ error: `Project code "${code}" is already in use` }, { status: 409 });
    }
    data.code = code;
  }

  if (body.client !== undefined) data.client = String(body.client).trim() || null;
  if (body.description !== undefined) data.description = String(body.description).trim() || null;
  if (body.location !== undefined) data.location = String(body.location).trim() || null;

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!STATUSES.includes(status as any)) {
      return NextResponse.json({ error: `Status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
    }
    data.status = status;
  }

  // Coordinates: accept an explicit null so a project can have its geofence
  // cleared, and reject out-of-range values rather than storing nonsense.
  for (const [key, min, max] of [["lat", -90, 90], ["lng", -180, 180]] as const) {
    if (body[key] === undefined) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      return NextResponse.json({ error: `${key} must be a number between ${min} and ${max}` }, { status: 400 });
    }
    data[key] = n;
  }

  if (body.radiusM !== undefined) {
    const n = Number(body.radiusM);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Radius must be zero or greater" }, { status: 400 });
    }
    data.radiusM = n === 0 ? NO_LIMIT_RADIUS : Math.round(n);
  }

  if (body.startDate !== undefined) {
    data.startDate = body.startDate ? new Date(body.startDate) : null;
  }
  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  const project = await db.project.update({ where: { id }, data });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;

  const id = (await params).id;
  const existing = await db.project.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await db.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}