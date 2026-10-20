import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding WorkTrack database (admin only)...");

  // Clear all data (in dependency order)
  await db.auditLog.deleteMany({});
  await db.attendanceLocation.deleteMany({});
  await db.attendancePhoto.deleteMany({});
  await db.attendance.deleteMany({});
  await db.leaveRequest.deleteMany({});
  await db.assignment.deleteMany({});
  await db.employee.deleteMany({});
  await db.project.deleteMany({});
  await db.shift.deleteMany({});
  await db.department.deleteMany({});
  await db.notification.deleteMany({});
  await db.setting.deleteMany({});
  await db.refreshToken.deleteMany({});
  await db.device.deleteMany({});
  await db.reportJob.deleteMany({});
  await db.ledgerEntry.deleteMany({});
  await db.user.deleteMany({});
  await db.company.deleteMany({});

  // 1. Company
  const company = await db.company.create({
    data: {
      id: "company-main",
      name: "WorkTrack LLC",
      code: "WT001",
      industry: "Construction & Services",
      email: "admin@worktrack.io",
      phone: "+92 300 1234567",
      address: "Lahore, Pakistan",
      timezone: "Asia/Karachi",
      currency: "PKR",
      status: "ACTIVE",
    },
  });

  // 2. Admin user only
  const adminPwd = await bcrypt.hash("admin123", 10);
  await db.user.create({
    data: {
      email: "admin@worktrack.io",
      password: adminPwd,
      name: "Ahmad Administrator",
      role: "SUPER_ADMIN",
      companyId: company.id,
      status: "ACTIVE",
    },
  });

  console.log("✅ Seed complete (admin only)!");
  console.log("   Company code: WT001");
  console.log("   Admin login: admin@worktrack.io / admin123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());