import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/employees/:id — update employee fields + optional password reset
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Verify employee belongs to admin's company
  const emp = await db.employee.findUnique({ where: { id }, include: { user: true } });
  if (!emp || emp.companyId !== (session.user as any).companyId) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Update employee fields
  const updated = await db.employee.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.designation !== undefined && { designation: body.designation }),
      ...(body.status !== undefined && { status: body.status.toUpperCase() }),
      ...(body.avatarColor !== undefined && { avatarColor: body.avatarColor }),
    },
  });

  // Update linked user email if provided
  if (body.email !== undefined && emp.user) {
    await db.user.update({
      where: { id: emp.user.id },
      data: { email: body.email, name: `${body.firstName ?? emp.firstName} ${body.lastName ?? emp.lastName}`.trim() },
    });
  }

  // Reset password if provided
  if (body.password) {
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(body.password, 10);

    if (emp.user) {
      // Update existing user's password
      await db.user.update({
        where: { id: emp.user.id },
        data: { password: hashedPassword },
      });
    } else {
      // Create user account if it doesn't exist
      await db.user.create({
        data: {
          email: emp.email || `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@worktrack.io`,
          password: hashedPassword,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          role: "EMPLOYEE",
          companyId: emp.companyId,
          employeeId: emp.id,
          status: "ACTIVE",
        },
      });
    }
  }

  // Update project assignments if provided
  if (body.projectIds !== undefined) {
    // Remove all existing assignments
    await db.assignment.updateMany({
      where: { employeeId: id },
      data: { status: "REMOVED", removedAt: new Date() },
    });
    // Create new assignments
    if (body.projectIds.length > 0) {
      for (const pid of body.projectIds) {
        await db.assignment.upsert({
          where: { employeeId_projectId: { employeeId: id, projectId: pid } },
          update: { status: "ACTIVE", removedAt: null },
          create: { employeeId: id, projectId: pid, status: "ACTIVE" },
        });
      }
    }
  }

  return NextResponse.json({
    employee: updated,
    message: body.password ? "Employee updated + password reset" : "Employee updated",
  });
}

// DELETE /api/employees/:id — soft delete (deactivate)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp || emp.companyId !== (session.user as any).companyId) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Soft delete — set status to INACTIVE
  await db.employee.update({ where: { id }, data: { status: "INACTIVE" } });
  // Also deactivate user account
  await db.user.updateMany({
    where: { employeeId: id },
    data: { status: "INACTIVE" },
  });

  return NextResponse.json({ success: true, message: "Employee deactivated" });
}
