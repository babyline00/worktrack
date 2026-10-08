import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  // Scoped to the caller's company. This previously queried every Notification
  // row in the database, so any signed-in tenant saw other companies' activity.
  const notifications = await db.notification.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      ...n,
      type: n.type.toLowerCase(),
    })),
  });
}

/** Marks the caller's company notifications as read. */
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  // Same scoping bug as GET: this used to clear unread notifications for every
  // company in the database.
  const result = await db.notification.updateMany({
    where: { companyId, unread: true },
    data: { unread: false },
  });
  return NextResponse.json({ success: true, updated: result.count });
}