import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const DECISIONS = ["APPROVED", "REJECTED", "PENDING"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  const companyId = user.companyId as string;

  const body = await req.json();
  const status = String(body.status ?? "").toUpperCase();
  if (!DECISIONS.includes(status as any)) {
    return NextResponse.json({ error: `Status must be one of ${DECISIONS.join(", ")}` }, { status: 400 });
  }

  // LeaveRequest carries no companyId of its own, so scope through the
  // employee relation. Updating by bare id let any authenticated user approve
  // or reject any leave request in the database.
  const existing = await db.leaveRequest.findFirst({
    where: { id: (await params).id, employee: { companyId } },
    include: { employee: true },
  });
  if (!existing) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

  const leave = await db.leaveRequest.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
    include: { employee: true },
  });

  await db.notification.create({
    data: {
      // Without companyId this row is a broadcast, and /api/dashboard
      // deliberately surfaces companyId:null rows to everyone — so every leave
      // decision in any company was reaching every other tenant.
      companyId,
      type: "LEAVE",
      title: `Leave ${status.toLowerCase()}`,
      description: `${leave.employee.firstName}'s ${leave.type.toLowerCase()} leave request was ${status.toLowerCase()}`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ leave });
}