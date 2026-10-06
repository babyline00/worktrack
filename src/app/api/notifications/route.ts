import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notifications = await db.notification.findMany({
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

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.notification.updateMany({ where: { unread: true }, data: { unread: false } });
  return NextResponse.json({ success: true });
}
