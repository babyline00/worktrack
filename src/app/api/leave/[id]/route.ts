import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const user = session.user as any;

  const leave = await db.leaveRequest.update({
    where: { id: params.id },
    data: {
      status: body.status.toUpperCase(),
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
    include: { employee: true },
  });

  await db.notification.create({
    data: {
      type: "LEAVE",
      title: `Leave ${body.status.toLowerCase()}`,
      description: `${leave.employee.firstName}'s ${leave.type.toLowerCase()} leave request was ${body.status.toLowerCase()}`,
      timeAgo: "Just now",
      unread: true,
    },
  });

  return NextResponse.json({ leave });
}
