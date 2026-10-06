import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leaves = await db.leaveRequest.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    leaves: leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
      employeeInitials: (l.employee.firstName[0] ?? "") + (l.employee.lastName[0] ?? ""),
      avatarColor: l.employee.avatarColor,
      type: l.type,
      from: l.fromDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
      to: l.toDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
      days: l.days,
      reason: l.reason,
      status: l.status.toLowerCase(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const user = session.user as any;
  const employeeId = body.employeeId ?? user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee linked" }, { status: 400 });

  const from = new Date(body.from);
  const to = new Date(body.to);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const leave = await db.leaveRequest.create({
    data: {
      employeeId,
      type: body.type ?? "ANNUAL",
      fromDate: from,
      toDate: to,
      days,
      reason: body.reason,
      status: "PENDING",
    },
  });

  await db.notification.create({
    data: {
      type: "LEAVE",
      title: "New leave request",
      description: `${(session.user as any).name ?? "Employee"} requested ${days} day${days > 1 ? "s" : ""} ${body.type?.toLowerCase() ?? "annual"} leave`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ leave });
}
