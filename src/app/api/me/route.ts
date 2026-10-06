import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;
  const employee = user.employeeId
    ? await db.employee.findUnique({
        where: { id: user.employeeId },
        include: {
          assignments: { include: { project: true } },
        },
      })
    : null;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId,
    },
    employee,
  });
}
