import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const FIRST_NAMES = [
  "Ahmad", "Ali", "Hamza", "Bilal", "Usman", "Sana", "Ayesha", "Hassan",
  "Faisal", "Imran", "Rehan", "Kashif", "Zain", "Saad", "Junaid", "Nida",
  "Mariam", "Tariq", "Adnan", "Yasir",
];
const LAST_NAMES = [
  "Khan", "Raza", "Ahmed", "Malik", "Sheikh", "Iqbal", "Aslam", "Hussain",
  "Butt", "Cheema", "Tariq", "Shah", "Siddiqui", "Mughal", "Ansari",
];
const DEPARTMENTS = ["Marketing", "Engineering", "Operations", "Field", "Sales", "Finance", "HR"];
const DESIGNATIONS = [
  "Marketing Executive", "Site Engineer", "Field Officer", "Project Coordinator",
  "Sales Executive", "Accountant", "HR Officer", "Technician",
];
const AVATAR_COLORS = [
  "#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

async function main() {
  console.log("🌱 Seeding WorkTrack database...");

  const company = await db.company.upsert({
    where: { id: "company-main" },
    update: {},
    create: {
      id: "company-main",
      name: "WorkTrack LLC",
      industry: "Construction & Services",
      email: "admin@worktrack.io",
      phone: "+92 300 1234567",
      address: "Lahore, Pakistan",
      timezone: "Asia/Karachi",
      currency: "PKR",
    },
  });

  const adminPwd = await bcrypt.hash("admin123", 10);
  await db.user.upsert({
    where: { email: "admin@worktrack.io" },
    update: {},
    create: {
      email: "admin@worktrack.io",
      password: adminPwd,
      name: "Ahmad Administrator",
      role: "ADMIN",
      companyId: company.id,
      status: "ACTIVE",
    },
  });

  const projects = await Promise.all(
    [
      { code: "DHT-001", name: "Dubai Home Technical", client: "Dubai Properties", description: "Technical maintenance & decor for residential units.", location: "Dubai, UAE", lat: 25.2048, lng: 55.2708, radiusM: 200 },
      { code: "ABC-002", name: "ABC Construction", client: "ABC Group", description: "On-site construction supervision & labour attendance.", location: "Sharjah, UAE", lat: 25.3463, lng: 55.4209, radiusM: 250 },
      { code: "CXY-003", name: "Client XYZ", client: "XYZ Holdings", description: "Maintenance contract for retail outlets.", location: "Abu Dhabi, UAE", lat: 24.4539, lng: 54.3773, radiusM: 150 },
      { code: "MNT-004", name: "Marina Maintenance", client: "Marina Towers", description: "Annual maintenance & inspection services.", location: "Dubai Marina, UAE", lat: 25.0805, lng: 55.1403, radiusM: 200 },
    ].map((p) =>
      db.project.upsert({
        where: { code: p.code },
        update: {},
        create: { ...p, status: "ACTIVE", startDate: new Date("2026-09-01"), companyId: company.id },
      })
    )
  );

  const employees = [];
  for (let i = 0; i < 48; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const proj = projects[i % projects.length];
    const empId = String(2585436360 + i);

    const emp = await db.employee.upsert({
      where: { empId },
      update: {},
      create: {
        empId,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@worktrack.io`,
        phone: `+92 3${(i % 9)} ${100 + i} ${1000 + i * 7}`,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        designation: DESIGNATIONS[i % DESIGNATIONS.length],
        status: i % 17 === 0 ? "INACTIVE" : "ACTIVE",
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        companyId: company.id,
      },
    });
    employees.push(emp);

    await db.assignment.upsert({
      where: { employeeId_projectId: { employeeId: emp.id, projectId: proj.id } },
      update: {},
      create: { employeeId: emp.id, projectId: proj.id },
    });

    if (i % 4 === 0) {
      const proj2 = projects[(i + 1) % projects.length];
      await db.assignment.upsert({
        where: { employeeId_projectId: { employeeId: emp.id, projectId: proj2.id } },
        update: {},
        create: { employeeId: emp.id, projectId: proj2.id },
      });
    }
  }

  // Demo employee user
  const demoEmp = employees[0];
  const empPwd = await bcrypt.hash("employee123", 10);
  await db.user.upsert({
    where: { email: "ahmad.khan@worktrack.io" },
    update: {},
    create: {
      email: "ahmad.khan@worktrack.io",
      password: empPwd,
      name: `${demoEmp.firstName} ${demoEmp.lastName}`,
      role: "EMPLOYEE",
      companyId: company.id,
      employeeId: demoEmp.id,
      status: "ACTIVE",
    },
  });

  // Attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const statuses = ["PRESENT", "PRESENT", "PRESENT", "LATE", "PRESENT", "LEAVE", "ABSENT"];
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const status = statuses[i % statuses.length];
    if (status === "ABSENT" || status === "LEAVE") continue;

    const checkIn = new Date(today);
    checkIn.setHours(9 + (i % 3), (i * 7) % 60, 0, 0);
    const checkOut = i % 8 === 0 ? new Date(checkIn.getTime() + 8 * 60 * 60 * 1000 + 14 * 60 * 1000) : null;

    const assignment = await db.assignment.findFirst({ where: { employeeId: emp.id } });
    const workingMins = checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
      : Math.max(0, Math.round((Date.now() - checkIn.getTime()) / 60000));

    await db.attendance.create({
      data: {
        employeeId: emp.id,
        projectId: assignment?.projectId,
        date: today,
        checkIn,
        checkOut,
        checkInLat: 25.2048 + (Math.random() - 0.5) * 0.05,
        checkInLng: 55.2708 + (Math.random() - 0.5) * 0.05,
        checkInAccuracy: 5 + (i % 20),
        checkInLocation: "Dubai Office",
        status,
        verification: i % 13 === 0 ? "PENDING" : "VERIFIED",
        insideGeofence: i % 19 !== 0,
        workingMins,
      },
    });
  }

  await Promise.all([
    db.shift.createMany({
      data: [
        { name: "Morning Shift", startTime: "09:00 AM", endTime: "05:00 PM", graceMins: 15, breakMins: 45, workingDays: "Mon,Tue,Wed,Thu,Fri", companyId: company.id },
        { name: "Night Shift", startTime: "06:00 PM", endTime: "03:00 AM", graceMins: 10, breakMins: 45, workingDays: "Mon,Tue,Wed,Thu,Fri", companyId: company.id },
        { name: "Flexible", startTime: "Variable", endTime: "Variable", graceMins: 0, breakMins: 60, workingDays: "Mon,Tue,Wed,Thu,Fri,Sat", companyId: company.id },
      ],
    }),
    db.leaveRequest.createMany({
      data: [
        { employeeId: employees[2].id, type: "ANNUAL", fromDate: new Date("2026-10-10"), toDate: new Date("2026-10-11"), days: 2, reason: "Family event out of city", status: "PENDING" },
        { employeeId: employees[5].id, type: "SICK", fromDate: new Date("2026-10-07"), toDate: new Date("2026-10-07"), days: 1, reason: "Flu — medical certificate attached", status: "PENDING" },
        { employeeId: employees[7].id, type: "EMERGENCY", fromDate: new Date("2026-10-08"), toDate: new Date("2026-10-09"), days: 2, reason: "Family emergency", status: "PENDING" },
        { employeeId: employees[1].id, type: "ANNUAL", fromDate: new Date("2026-10-01"), toDate: new Date("2026-10-03"), days: 3, reason: "Vacation", status: "APPROVED" },
        { employeeId: employees[3].id, type: "UNPAID", fromDate: new Date("2026-09-20"), toDate: new Date("2026-09-22"), days: 3, reason: "Personal work", status: "REJECTED" },
      ],
    }),
    db.notification.createMany({
      data: [
        { type: "ATTENDANCE", title: "Ahmad checked in late", description: "09:42 AM — 42 minutes late", timeAgo: "5 min ago", unread: true },
        { type: "ATTENDANCE", title: "Ali checked out", description: "06:14 PM • 8h 14m worked", timeAgo: "18 min ago", unread: true },
        { type: "ALERT", title: "3 employees absent", description: "Today's attendance is below target", timeAgo: "1 hour ago", unread: true },
        { type: "LEAVE", title: "New leave request", description: "Hamza requested 2 days annual leave", timeAgo: "2 hours ago", unread: false },
        { type: "SYSTEM", title: "Backup completed", description: "Daily database backup successful", timeAgo: "4 hours ago", unread: false },
      ],
    }),
    db.setting.createMany({
      data: [
        { companyId: company.id, key: "REQUIRE_PHOTO", value: "true" },
        { companyId: company.id, key: "REQUIRE_LOCATION", value: "true" },
        { companyId: company.id, key: "PREVENT_GALLERY", value: "true" },
        { companyId: company.id, key: "REQUIRE_GPS_ACCURACY", value: "true" },
        { companyId: company.id, key: "MAX_GPS_ACCURACY", value: "50" },
        { companyId: company.id, key: "GEOFENCE_ENABLED", value: "true" },
        { companyId: company.id, key: "DEFAULT_RADIUS", value: "200" },
        { companyId: company.id, key: "AUTO_CHECKOUT", value: "false" },
        { companyId: company.id, key: "PASSWORD_MIN_LENGTH", value: "8" },
        { companyId: company.id, key: "SESSION_TIMEOUT", value: "30" },
        { companyId: company.id, key: "LOGIN_ATTEMPT_LIMIT", value: "5" },
        { companyId: company.id, key: "REQUIRE_STRONG_PASSWORD", value: "true" },
        { companyId: company.id, key: "TWO_FACTOR_AUTH", value: "false" },
        { companyId: company.id, key: "NOTIFY_LATE", value: "true" },
        { companyId: company.id, key: "NOTIFY_ABSENT", value: "true" },
        { companyId: company.id, key: "NOTIFY_LEAVE", value: "true" },
        { companyId: company.id, key: "NOTIFY_GEOFENCE", value: "true" },
        { companyId: company.id, key: "NOTIFY_DAILY_SUMMARY", value: "false" },
      ],
    }),
  ]);

  console.log("✅ Seed complete!");
  console.log("   Admin: admin@worktrack.io / admin123");
  console.log("   Employee: ahmad.khan@worktrack.io / employee123");
}

main().catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); }).finally(() => db.$disconnect());
