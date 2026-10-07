import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  ERRORS,
  apiSuccess,
  apiError,
  rateLimit,
  getClientIp,
  ApiError,
} from "@/lib/v1";

export const runtime = "nodejs";

// POST /api/v1/auth/login
// Body: { companyCode, employeeId, password, deviceId?, deviceModel?, appVersion? }
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`login:${ip}`, 10, 60)) {
      throw ERRORS.RATE_LIMITED();
    }

    const body = await req.json().catch(() => ({}));
    const { companyCode, employeeId, email, password, deviceId, deviceModel, appVersion } = body;

    if (!companyCode || !password || (!employeeId && !email)) {
      throw ERRORS.VALIDATION("companyCode, password and (employeeId or email) are required");
    }

    // 1. Find company by code
    const company = await db.company.findUnique({ where: { code: companyCode } });
    if (!company) throw ERRORS.COMPANY_NOT_FOUND();
    if (company.status !== "ACTIVE") {
      throw new ApiError("COMPANY_INACTIVE", "Company account is inactive.", 403);
    }

    // 2. Find user — either by email (admin/manager) or by employeeId (employee)
    let user: any;
    let employee: any = null;
    if (email) {
      user = await db.user.findUnique({ where: { email: String(email).toLowerCase() }, include: { employee: true } });
      if (!user || user.companyId !== company.id) throw ERRORS.INVALID_CREDENTIALS();
      employee = user.employee;
    } else {
      // employeeId login
      employee = await db.employee.findUnique({
        where: { companyId_empId: { companyId: company.id, empId: String(employeeId) } },
        include: { user: true },
      });
      if (!employee) throw ERRORS.INVALID_CREDENTIALS();
      if (employee.status !== "ACTIVE") throw ERRORS.EMPLOYEE_INACTIVE();
      user = employee.user;
    }
    if (!user || !user.password) throw ERRORS.INVALID_CREDENTIALS();
    if (user.status === "LOCKED") throw ERRORS.ACCOUNT_LOCKED();
    if (user.status !== "ACTIVE") throw ERRORS.ACCOUNT_LOCKED();

    // 4. Verify password
    const ok = await verifyPassword(password, user.password);
    if (!ok) throw ERRORS.INVALID_CREDENTIALS();

    // 5. Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: company.id,
      employeeId: employee?.id,
    };
    const access = signAccessToken(tokenPayload);
    const refresh = signRefreshToken(tokenPayload);

    // 6. Store refresh token in DB — delete old tokens for this user first to avoid collisions
    await db.refreshToken.deleteMany({ where: { userId: user.id } });
    try {
      await db.refreshToken.create({
        data: {
          userId: user.id,
          token: refresh.token,
          deviceId: deviceId ?? null,
          expiresAt: refresh.expiresAt,
        },
      });
    } catch (e) {
      // If still fails (race condition), continue — token is valid via JWT verification
    }

    // 7. Update last login
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // 8. Register device if provided
    if (deviceId) {
      await db.device.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId } },
        update: { lastSeenAt: new Date(), model: deviceModel ?? null, appVersion: appVersion ?? null, status: "ACTIVE" },
        create: {
          userId: user.id,
          employeeId: employee?.id ?? null,
          deviceId,
          platform: "ANDROID",
          model: deviceModel ?? null,
          appVersion: appVersion ?? null,
          status: "ACTIVE",
        },
      });
    }

    return apiSuccess({
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      user: {
        id: user.id,
        employeeId: employee?.empId ?? null,
        name: employee ? `${employee.firstName} ${employee.lastName}` : user.name,
        role: user.role,
        companyId: company.id,
        companyName: company.name,
        email: user.email,
        avatarColor: employee?.avatarColor ?? "#2563eb",
        avatarUrl: employee?.avatarUrl ?? null,
      },
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    console.error("[v1/auth/login] error:", err);
    return apiError(ERRORS.INTERNAL());
  }
}
