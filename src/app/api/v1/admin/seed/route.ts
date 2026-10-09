import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { requireRole, apiError, ApiError } from "@/lib/v1";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/v1/admin/seed?step=1   (requires an ADMIN/SUPER_ADMIN JWT)
//
// Step 1: Company + admin + projects + shifts + settings
// Step 2: Employees + assignments + demo user
// Step 3: Today's attendance + leave + notifications
//
// Previously gated on a static `?key=worktrack-seed-2026` committed to the
// repository. That made the endpoint public: step 2 runs an unconditional
// `employee.deleteMany`, so anyone who knew the key could erase a tenant's
// entire staff list. It now requires a real admin token.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const step = parseInt(url.searchParams.get("step") ?? "1");

  try {
    await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  } catch (err: any) {
    return err instanceof ApiError
      ? apiError(err)
      : Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (step === 1) return await seedStep1();
    if (step === 2) return await seedStep2(url.searchParams.get("confirm"));
    if (step === 3) return await seedStep3();
    return Response.json({ error: "Invalid step (1-3)" }, { status: 400 });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

async function seedStep1() {
  const company = await db.company.upsert({
    where: { id: "company-main" },
    update: { code: "WT001", status: "ACTIVE" },
    create: { id: "company-main", name: "NAS International", code: "WT001", industry: "Construction & Services", email: "admin@worktrack.io", phone: "+92 300 1234567", address: "Lahore, Pakistan", timezone: "Asia/Karachi", currency: "PKR", status: "ACTIVE" },
  });

  const adminPwd = await bcrypt.hash("admin123", 10);
  await db.user.upsert({ where: { email: "admin@worktrack.io" }, update: {}, create: { email: "admin@worktrack.io", password: adminPwd, name: "Ahmad Administrator", role: "ADMIN", companyId: company.id, status: "ACTIVE" } });

  const projectData = [
    { code: "DHT-001", name: "Dubai Home Technical", client: "Dubai Properties", location: "Dubai, UAE", lat: 25.2048, lng: 55.2708, radiusM: 200 },
    { code: "ABC-002", name: "ABC Construction", client: "ABC Group", location: "Sharjah, UAE", lat: 25.3463, lng: 55.4209, radiusM: 250 },
    { code: "CXY-003", name: "Client XYZ", client: "XYZ Holdings", location: "Abu Dhabi, UAE", lat: 24.4539, lng: 54.3773, radiusM: 150 },
    { code: "MNT-004", name: "Marina Maintenance", client: "Marina Towers", location: "Dubai Marina, UAE", lat: 25.0805, lng: 55.1403, radiusM: 200 },
  ];
  for (const p of projectData) {
    await db.project.upsert({ where: { code: p.code }, update: {}, create: { ...p, status: "ACTIVE", startDate: new Date("2026-09-01"), companyId: company.id } });
  }

  // Shifts
  await db.shift.createMany({ data: [
    { name: "Morning Shift", startTime: "09:00 AM", endTime: "05:00 PM", graceMins: 15, breakMins: 45, workingDays: "Mon,Tue,Wed,Thu,Fri", companyId: company.id },
    { name: "Night Shift", startTime: "06:00 PM", endTime: "03:00 AM", graceMins: 10, breakMins: 45, workingDays: "Mon,Tue,Wed,Thu,Fri", companyId: company.id },
    { name: "Flexible", startTime: "Variable", endTime: "Variable", graceMins: 0, breakMins: 60, workingDays: "Mon,Tue,Wed,Thu,Fri,Sat", companyId: company.id },
  ], skipDuplicates: true });

  // Settings
  const settings = [["REQUIRE_PHOTO","true"],["REQUIRE_LOCATION","true"],["MAX_GPS_ACCURACY","50"],["GEOFENCE_ENABLED","true"],["DEFAULT_RADIUS","200"],["AUTO_CHECKOUT","true"], ["GEOFENCE_AUTO_CHECKOUT_MINS","5"],["PASSWORD_MIN_LENGTH","8"],["SESSION_TIMEOUT","30"],["LOGIN_ATTEMPT_LIMIT","5"],["NOTIFY_LATE","true"],["NOTIFY_ABSENT","true"],["NOTIFY_LEAVE","true"],["NOTIFY_GEOFENCE","true"]];
  for (const [k, v] of settings) {
    await db.setting.upsert({ where: { companyId_key: { companyId: company.id, key: k } }, update: { value: v }, create: { companyId: company.id, key: k, value: v } });
  }

  return Response.json({ success: true, step: 1, message: "Company + admin + projects + shifts + settings created. Call step=2 next." });
}

async function seedStep2(confirm?: string | null) {
  const company = await db.company.findUnique({ where: { id: "company-main" } });
  if (!company) return Response.json({ error: "Run step 1 first" }, { status: 400 });

  const FIRST_NAMES = ["Ahmad","Ali","Hamza","Bilal","Usman","Sana","Ayesha","Hassan","Faisal","Imran","Rehan","Kashif","Zain","Saad","Junaid","Nida","Mariam","Tariq","Adnan","Yasir"];
  const LAST_NAMES = ["Khan","Raza","Ahmed","Malik","Sheikh","Iqbal","Aslam","Hussain","Butt","Cheema","Tariq","Shah","Siddiqui","Mughal","Ansari"];
  const DESIGNATIONS = ["Marketing Executive","Site Engineer","Field Officer","Project Coordinator","Sales Executive","Accountant","HR Officer","Technician"];
  const AVATAR_COLORS = ["#2563eb","#0ea5e9","#16a34a","#f59e0b","#dc2626","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1"];
  const projects = await db.project.findMany({ where: { companyId: company.id } });

  // Clean + create employees.
  //
  // This deletes every employee in the company, so it now demands an explicit
  // `?confirm=reset-employees`. Seeding used to erase real staff silently just
  // because someone replayed step 2.
  if (confirm !== "reset-employees") {
    return Response.json(
      {
        success: false,
        error:
          "This step deletes all employees for the company. Re-run with ?confirm=reset-employees to proceed.",
      },
      { status: 428 },
    );
  }
  await db.employee.deleteMany({ where: { companyId: company.id } });

  const empData: Prisma.EmployeeCreateManyInput[] = [];
  for (let i = 0; i < 48; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    empData.push({
      empId: String(2585436360 + i), firstName: first, lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@worktrack.io`,
      phone: `+92 3${(i % 9)} ${100 + i} ${1000 + i * 7}`,
      designation: DESIGNATIONS[i % DESIGNATIONS.length],
      status: i % 17 === 0 ? "INACTIVE" : "ACTIVE",
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      companyId: company.id,
    });
  }
  await db.employee.createMany({ data: empData });
  const employees = await db.employee.findMany({ where: { companyId: company.id }, orderBy: { empId: "asc" } });

  // Assignments
  const assignData: Prisma.AssignmentCreateManyInput[] = [];
  for (let i = 0; i < employees.length; i++) {
    const proj = projects[i % projects.length];
    assignData.push({ employeeId: employees[i].id, projectId: proj.id });
    if (i % 4 === 0) assignData.push({ employeeId: employees[i].id, projectId: projects[(i + 1) % projects.length].id });
  }
  await db.assignment.createMany({ data: assignData, skipDuplicates: true });

  // Demo employee user
  const demoEmp = employees[1];
  const empPwd = await bcrypt.hash("employee123", 10);
  await db.user.upsert({ where: { email: "ahmad.khan@worktrack.io" }, update: { employeeId: demoEmp.id, status: "ACTIVE", password: empPwd }, create: { email: "ahmad.khan@worktrack.io", password: empPwd, name: `${demoEmp.firstName} ${demoEmp.lastName}`, role: "EMPLOYEE", companyId: company.id, employeeId: demoEmp.id, status: "ACTIVE" } });

  return Response.json({ success: true, step: 2, message: `${employees.length} employees + assignments + demo user created. Call step=3 next.` });
}

async function seedStep3() {
  const company = await db.company.findUnique({ where: { id: "company-main" } });
  if (!company) return Response.json({ error: "Run step 1 first" }, { status: 400 });

  const employees = await db.employee.findMany({ where: { companyId: company.id, status: "ACTIVE" }, orderBy: { empId: "asc" } });
  const projects = await db.project.findMany({ where: { companyId: company.id } });
  const shift = await db.shift.findFirst({ where: { companyId: company.id } });

  // Clean existing today's attendance
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await db.attendance.deleteMany({ where: { attendanceDate: today, companyId: company.id } });

  const statuses = ["PRESENT","PRESENT","PRESENT","LATE","PRESENT","PRESENT","ABSENT"];
  const attData: Prisma.AttendanceCreateManyInput[] = [];
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const status = statuses[i % statuses.length];
    if (status === "ABSENT") continue;
    const proj = projects[i % projects.length];
    const now = new Date();
    const checkIn = new Date(today); checkIn.setHours(9 + (i % 3), (i * 7) % 60, 0, 0);
    const isLate = status === "LATE";
    let checkOut = i % 5 === 0 ? new Date(checkIn.getTime() + 8 * 60 * 60 * 1000) : null;

    // `setHours` builds the nominal 9–11 AM start in the server's local timezone.
    // Seeding before that wall-clock time (or before the shift ends) produced
    // records dated in the future, which the app rendered as a negative working
    // timer. Anchor still-running sessions a couple of hours in the past and
    // reopen sessions whose shift has not finished yet.
    if (!checkOut || checkOut.getTime() > now.getTime()) {
      checkOut = null;
      if (checkIn.getTime() > now.getTime()) {
        checkIn.setTime(now.getTime() - (2 * 60 + (i % 45)) * 60 * 1000);
      }
    }
    const workingMins = checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : Math.max(0, Math.round((Date.now() - checkIn.getTime()) / 60000));
    attData.push({
      companyId: company.id, employeeId: emp.id, projectId: proj.id, shiftId: shift?.id,
      attendanceDate: today, checkIn, checkOut,
      checkInLat: (proj.lat ?? 25.2) + (Math.random() - 0.5) * 0.004,
      checkInLng: (proj.lng ?? 55.2) + (Math.random() - 0.5) * 0.004,
      checkInAccuracy: 5 + (i % 20), checkInLocation: proj.location ?? "Office",
      checkInCapturedAt: checkIn, checkInServerReceivedAt: checkIn,
      sessionStatus: checkOut ? "COMPLETED" : "WORKING", attendanceStatus: status,
      verificationStatus: i % 13 === 0 ? "PENDING" : "VERIFIED",
      insideGeofence: i % 19 !== 0, workingMins, lateMins: isLate ? 22 : 0,
    });
  }
  await db.attendance.createMany({ data: attData });

  // Leave requests
  if (employees.length > 7) {
    await db.leaveRequest.createMany({ data: [
      { employeeId: employees[2].id, type: "ANNUAL", fromDate: new Date("2026-10-10"), toDate: new Date("2026-10-11"), days: 2, reason: "Family event", status: "PENDING" },
      { employeeId: employees[5].id, type: "SICK", fromDate: new Date("2026-10-07"), toDate: new Date("2026-10-07"), days: 1, reason: "Flu", status: "PENDING" },
      { employeeId: employees[7].id, type: "EMERGENCY", fromDate: new Date("2026-10-08"), toDate: new Date("2026-10-09"), days: 2, reason: "Family emergency", status: "PENDING" },
      { employeeId: employees[1].id, type: "ANNUAL", fromDate: new Date("2026-10-01"), toDate: new Date("2026-10-03"), days: 3, reason: "Vacation", status: "APPROVED" },
    ] });
  }

  // Notifications
  await db.notification.createMany({ data: [
    { companyId: company.id, type: "ATTENDANCE", title: "Welcome to NAS International!", description: "Your dashboard is ready.", timeAgo: "Just now", unread: true },
    { companyId: company.id, type: "SYSTEM", title: "Database seeded", description: `${attData.length} attendance records created.`, timeAgo: "Just now", unread: true },
  ] });

  return Response.json({ success: true, step: 3, message: `Done! ${attData.length} attendance + leave + notifications created. Database is ready!` });
}
