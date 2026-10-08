import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  // LeaveRequest has no companyId column, so the tenant filter has to go
  // through the employee relation. Without it this returned every company's
  // leave requests, and the approve/reject buttons acted on them.
  const leaves = await db.leaveRequest.findMany({
    where: { employee: { companyId } },
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
      reviewedAt: l.reviewedAt?.toISOString() ?? null,
      status: l.status.toLowerCase(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const user = session.user as any;
  const companyId = user.companyId as string;
  const employeeId = body.employeeId ?? user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee linked" }, { status: 400 });

  // An employee must not file a request for somebody else.
  const employee = await db.employee.findFirst({
    where: { id: String(employeeId), companyId },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const from = new Date(body.from);
  const to = new Date(body.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Provide valid from and to dates" }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: "The end date cannot be before the start date" }, { status: 400 });
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const leave = await db.leaveRequest.create({
    data: {
      employeeId: employee.id,
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
      // companyId was omitted, making this a broadcast visible to all tenants.
      companyId,
      type: "LEAVE",
      title: "New leave request",
      description: `${user.name ?? "Employee"} requested ${days} day${days > 1 ? "s" : ""} ${(body.type ?? "annual").toLowerCase()} leave`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ leave }, { status: 201 });
}