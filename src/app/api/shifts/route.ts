import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const shifts = await db.shift.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ shifts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const body = await req.json();
  const shift = await db.shift.create({
    data: {
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      graceMins: parseInt(body.graceMins ?? "15"),
      breakMins: parseInt(body.breakMins ?? "45"),
      workingDays: body.workingDays,
      companyId,
    },
  });
  return NextResponse.json({ shift });
}
