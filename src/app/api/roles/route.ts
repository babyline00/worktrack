import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/roles
// How many active user accounts hold each role, so Settings → Users & Roles can
// show real numbers. Role definitions themselves are fixed by the schema and are
// not editable.

const ROLE_META: { role: string; name: string; desc: string; color: string; permissions: string[] }[] = [
  {
    role: "SUPER_ADMIN",
    name: "Super Admin",
    desc: "Full access to everything",
    color: "bg-danger-soft text-danger",
    permissions: ["Everything"],
  },
  {
    role: "ADMIN",
    name: "Company Admin",
    desc: "Manage company workforce",
    color: "bg-primary/10 text-primary",
    permissions: ["Dashboard", "Projects", "Employees", "Attendance", "Reports", "Settings"],
  },
  {
    role: "MANAGER",
    name: "Manager",
    desc: "Monitor teams & attendance",
    color: "bg-info-soft text-info",
    permissions: ["Dashboard", "Live Attendance", "Employees", "Reports"],
  },
  {
    role: "EMPLOYEE",
    name: "Employee",
    desc: "Self-service portal",
    color: "bg-success-soft text-success",
    permissions: ["Assigned Projects", "Own Attendance", "Limited Settings"],
  },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const grouped = await db.user.groupBy({
    by: ["role"],
    where: { companyId, status: "ACTIVE" },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.role, g._count._all]));

  return NextResponse.json({
    roles: ROLE_META.map((r) => ({ ...r, userCount: counts.get(r.role) ?? 0 })),
    totalUsers: [...counts.values()].reduce((a, b) => a + b, 0),
  });
}