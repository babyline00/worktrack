import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const maxDuration = 30;

// POST /api/v1/admin/setup-admin?key=worktrack-seed-2026
// Creates ONLY: 1 company + 1 admin user + default settings. No projects, no employees, no demo data.
// Body (optional): { companyName, companyCode, adminName, adminEmail, adminPassword }
export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== "worktrack-seed-2026") return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const companyName = body.companyName || "WorkTrack LLC";
    const companyCode = body.companyCode || "WT001";
    const adminName = body.adminName || "Ahmad Administrator";
    const adminEmail = body.adminEmail || "admin@worktrack.io";
    const adminPassword = body.adminPassword || "admin123";

    const existing = await db.company.findFirst({});
    if (existing) {
      return Response.json({ success: false, error: "Company already exists. Run /admin/clean first." }, { status: 409 });
    }

    // 1. Company
    const company = await db.company.create({
      data: {
        id: "company-main",
        name: companyName,
        code: companyCode,
        industry: "Workforce Management",
        email: adminEmail,
        status: "ACTIVE",
        timezone: "Asia/Karachi",
        currency: "PKR",
      },
    });

    // 2. Admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await db.user.create({
      data: { email: adminEmail, password: hashedPassword, name: adminName, role: "ADMIN", companyId: company.id, status: "ACTIVE" },
    });

    // 3. Default settings only (required for app config)
    const defaultSettings = [
      ["REQUIRE_PHOTO", "true"], ["REQUIRE_LOCATION", "true"], ["MAX_GPS_ACCURACY", "50"],
      ["GEOFENCE_ENABLED", "true"], ["DEFAULT_RADIUS", "200"], ["AUTO_CHECKOUT", "false"],
      ["PASSWORD_MIN_LENGTH", "8"], ["SESSION_TIMEOUT", "30"], ["LOGIN_ATTEMPT_LIMIT", "5"],
      ["NOTIFY_LATE", "true"], ["NOTIFY_ABSENT", "true"], ["NOTIFY_LEAVE", "true"], ["NOTIFY_GEOFENCE", "true"],
    ];
    for (const [k, v] of defaultSettings) {
      await db.setting.create({ data: { companyId: company.id, key: k, value: v } });
    }

    return Response.json({
      success: true,
      message: "Admin account created. Database is clean — no demo data.",
      admin: { name: admin.name, email: admin.email, role: admin.role },
      company: { name: company.name, code: company.code },
      login: { webUrl: "https://my-project-chi-flame-13.vercel.app", email: adminEmail, password: adminPassword, companyCode },
    });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
