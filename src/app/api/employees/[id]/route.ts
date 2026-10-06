import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const emp = await db.employee.update({
    where: { id: (await params).id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      department: body.department,
      designation: body.designation,
      status: body.status?.toUpperCase(),
      avatarColor: body.avatarColor,
    },
  });
  return NextResponse.json({ employee: emp });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.employee.delete({ where: { id: (await params).id } });
  return NextResponse.json({ success: true });
}
