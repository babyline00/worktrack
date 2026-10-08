import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

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
      await db.user.update({
        where: { id: emp.user.id },
        data: { password: hashedPassword },
      });
    } else {
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
    await db.assignment.updateMany({
      where: { employeeId: id },
      data: { status: "REMOVED", removedAt: new Date() },
    });
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

// DELETE /api/employees/:id — PERMANENT delete with ALL related records
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp || emp.companyId !== (session.user as any).companyId) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Get all attendance records for this employee (to delete photos from disk)
  const attendanceRecords = await db.attendance.findMany({
    where: { employeeId: id },
    select: { id: true },
  });

  // Get all photo file paths to delete from disk
  const photos = await db.attendancePhoto.findMany({
    where: { attendanceId: { in: attendanceRecords.map((a) => a.id) } },
    select: { storageKey: true },
  });

  // Delete photo files from disk
  for (const photo of photos) {
    try {
      const filePath = join(process.cwd(), "public", photo.storageKey);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // ignore file deletion errors
    }
  }

  // Delete all related records in dependency order (children first)
  // 1. Attendance locations (GPS trail)
  const locResult = await db.attendanceLocation.deleteMany({
    where: { attendanceId: { in: attendanceRecords.map((a) => a.id) } },
  });

  // 2. Attendance photos (DB records)
  const photoResult = await db.attendancePhoto.deleteMany({
    where: { attendanceId: { in: attendanceRecords.map((a) => a.id) } },
  });

  // 3. Audit logs for this employee's attendance
  await db.auditLog.deleteMany({
    where: { entity: "attendance", entityId: { in: attendanceRecords.map((a) => a.id) } },
  });

  // 4. Attendance records
  const attResult = await db.attendance.deleteMany({
    where: { employeeId: id },
  });

  // 5. Leave requests
  const leaveResult = await db.leaveRequest.deleteMany({
    where: { employeeId: id },
  });

  // 6. Assignments (project assignments)
  const assignResult = await db.assignment.deleteMany({
    where: { employeeId: id },
  });

  // 7. Devices
  const deviceResult = await db.device.deleteMany({
    where: { employeeId: id },
  });

  // 8. Refresh tokens for the linked user
  await db.refreshToken.deleteMany({
    where: { user: { employeeId: id } },
  });

  // 9. User account (login credentials)
  const userResult = await db.user.deleteMany({
    where: { employeeId: id },
  });

  // 10. Finally, delete the employee
  await db.employee.delete({ where: { id } });

  return NextResponse.json({
    success: true,
    message: "Employee permanently deleted with all records",
    deleted: {
      attendance: attResult.count,
      attendancePhotos: photoResult.count,
      attendanceLocations: locResult.count,
      leaveRequests: leaveResult.count,
      assignments: assignResult.count,
      devices: deviceResult.count,
      userAccounts: userResult.count,
      photoFiles: photos.length,
    },
  });
}
