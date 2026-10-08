import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Session-authenticated department list for the admin employee dialog, which
// previously offered seven hardcoded names and sent the chosen one to an API
// that only read departmentId — so the selection was silently discarded.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const departments = await db.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d._count.employees,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Department name is required" }, { status: 400 });

  const department = await db.department.upsert({
    where: { companyId_name: { companyId, name } },
    update: {},
    create: { name, companyId },
  });
  return NextResponse.json({ department }, { status: 201 });
}