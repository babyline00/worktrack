// v1 API shared utilities — JWT, errors, idempotency, rate limiting, geofence, audit

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ============================================================
// JWT — simple HS256 implementation (no external dep)
// ============================================================

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "worktrack-dev-secret-change-me";
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes (seconds)
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days

function base64UrlEncode(obj: object | string): string {
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  let str = s.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function hmacSign(data: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
  companyId?: string;
  employeeId?: string;
  /**
   * The tenant's IANA timezone, carried on the token so every request can
   * resolve "today" correctly without an extra query for the company row.
   *
   * Optional because tokens minted before this field existed are still valid for
   * up to 15 minutes after deploy; readers must fall back to a company lookup
   * rather than assume it is present.
   */
  timezone?: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
  jti: string; // unique token id
}

export function signAccessToken(payload: Omit<JwtPayload, "type" | "iat" | "exp" | "jti">): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    type: "access",
    iat: now,
    exp: now + ACCESS_TOKEN_TTL,
    jti: `${now}-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  };
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64UrlEncode(fullPayload);
  const sig = hmacSign(`${header}.${body}`);
  return { token: `${header}.${body}.${sig}`, expiresIn: ACCESS_TOKEN_TTL };
}

export function signRefreshToken(payload: Omit<JwtPayload, "type" | "iat" | "exp" | "jti">): { token: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    type: "refresh",
    iat: now,
    exp: now + REFRESH_TOKEN_TTL,
    jti: `${now}-${Math.random().toString(36).slice(2)}-${Date.now()}-${payload.sub}`,
  };
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64UrlEncode(fullPayload);
  const sig = hmacSign(`${header}.${body}`);
  return { token: `${header}.${body}.${sig}`, expiresAt: new Date(now + REFRESH_TOKEN_TTL * 1000) };
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = hmacSign(`${header}.${body}`);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10);
}

export async function verifyPassword(p: string, hash: string): Promise<boolean> {
  return bcrypt.compare(p, hash);
}

// ============================================================
// Standardized API error (per spec §72)
// ============================================================

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  requestId: string;

  constructor(code: string, message: string, statusCode: number, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = crypto.randomUUID().slice(0, 8);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId: this.requestId,
      },
    };
  }
}

export const ERRORS = {
  UNAUTHORIZED: (msg = "Authentication required") => new ApiError("UNAUTHORIZED", msg, 401),
  FORBIDDEN: (msg = "You do not have permission to perform this action") => new ApiError("FORBIDDEN", msg, 403),
  NOT_FOUND: (msg = "Resource not found") => new ApiError("NOT_FOUND", msg, 404),
  VALIDATION: (msg: string, details?: any) => new ApiError("VALIDATION_ERROR", msg, 422, details),
  CONFLICT: (code: string, msg: string, details?: any) => new ApiError(code, msg, 409, details),
  RATE_LIMITED: (msg = "Too many requests. Please try again later.") => new ApiError("RATE_LIMITED", msg, 429),
  INTERNAL: (msg = "Internal server error") => new ApiError("INTERNAL_ERROR", msg, 500),
  OUTSIDE_GEOFENCE: (distance: number, allowedRadius: number) =>
    new ApiError("OUTSIDE_GEOFENCE", "You are outside the allowed project area.", 400, { distance, allowedRadius }),
  GPS_ACCURACY_TOO_LOW: () => new ApiError("GPS_ACCURACY_TOO_LOW", "Location accuracy is too low. Please move to an open area and try again.", 400),
  ALREADY_CHECKED_IN: () => new ApiError("ALREADY_CHECKED_IN", "You are already checked in.", 409),
  ALREADY_CHECKED_OUT: () => new ApiError("ALREADY_CHECKED_OUT", "You have already checked out.", 409),
  NOT_CHECKED_IN: () => new ApiError("NOT_CHECKED_IN", "You have not checked in yet.", 400),
  INVALID_CREDENTIALS: () => new ApiError("INVALID_CREDENTIALS", "Employee ID or password is incorrect.", 401),
  ACCOUNT_LOCKED: () => new ApiError("ACCOUNT_LOCKED", "Your account has been locked. Contact your administrator.", 403),
  COMPANY_NOT_FOUND: () => new ApiError("COMPANY_NOT_FOUND", "Company code not found.", 404),
  EMPLOYEE_INACTIVE: () => new ApiError("EMPLOYEE_INACTIVE", "Your account is inactive. Contact your administrator.", 403),
};

export function apiSuccess(data: any, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function apiError(err: ApiError): Response {
  return Response.json(err.toJSON(), { status: err.statusCode });
}

// ============================================================
// Auth helper — extract user from Bearer token
// ============================================================

export async function getUserFromRequest(req: Request): Promise<JwtPayload | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return verifyToken(token);
}

export async function requireAuth(req: Request): Promise<JwtPayload> {
  const user = await getUserFromRequest(req);
  if (!user) throw ERRORS.UNAUTHORIZED();
  return user;
}

export async function requireRole(req: Request, roles: string[]): Promise<JwtPayload> {
  const user = await requireAuth(req);
  if (!roles.includes(user.role)) throw ERRORS.FORBIDDEN();
  return user;
}

// ============================================================
// Notification scoping
// ============================================================

/** Roles that treat the company notification stream as their inbox. */
const NOTIFICATION_INBOX_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/**
 * Rows a user is allowed to *see*: their own notifications plus company-wide
 * broadcasts (`userId: null`). Never another company's rows.
 */
export function notificationReadScope(user: JwtPayload) {
  return {
    OR: [{ userId: user.sub }, { companyId: user.companyId, userId: null }],
  };
}

/**
 * Rows a user is allowed to *mark read*.
 *
 * `Notification.unread` is a column on the row, not per-recipient state, so a
 * write is visible to everyone who can read that row. Managers own the company
 * inbox and may clear it. An employee may only clear their own notifications —
 * otherwise tapping "mark all read" on the phone would silently mark their
 * manager's and colleagues' notifications read as well.
 */
export function notificationWriteScope(user: JwtPayload) {
  if (NOTIFICATION_INBOX_ROLES.includes(user.role)) {
    return { companyId: user.companyId };
  }
  return { userId: user.sub };
}

// ============================================================
// Idempotency — dedupe requests with same Idempotency-Key
// ============================================================

const idempotencyCache = new Map<string, { status: number; body: any; ts: number }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24h

export function checkIdempotency(req: Request): { key: string; cached?: { status: number; body: any } } | null {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return null;
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() - cached.ts < IDEMPOTENCY_TTL) {
    return { key, cached: { status: cached.status, body: cached.body } };
  }
  // Cleanup old entries
  if (idempotencyCache.size > 1000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL;
    for (const [k, v] of idempotencyCache) {
      if (v.ts < cutoff) idempotencyCache.delete(k);
    }
  }
  return { key };
}

export function storeIdempotency(key: string, status: number, body: any) {
  idempotencyCache.set(key, { status, body, ts: Date.now() });
}

// ============================================================
// Rate limiting — in-memory per IP+endpoint
// ============================================================

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number, windowSec: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (bucket.count >= maxRequests) return false;
  bucket.count++;
  return true;
}

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

// ============================================================
// Geofence — haversine distance
// ============================================================

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ============================================================
// Audit logger
// ============================================================

export async function auditLog(params: {
  action: string;
  entity: string;
  entityId: string;
  performedById?: string;
  companyId?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  req?: Request;
}) {
  // `entityId` is a generic identifier that may hold a leave id, a project id,
  // a ledger entry id or an attendance id. It used to double as the foreign key
  // to Attendance, so auditing anything that was not an attendance record threw
  // a constraint violation and the audit was silently lost. Only attendance
  // entities populate the dedicated column now.
  const isAttendanceEntity = params.entity.toLowerCase() === "attendance";

  await db.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      attendanceId: isAttendanceEntity ? params.entityId : null,
      performedById: params.performedById,
      companyId: params.companyId,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      reason: params.reason,
      ipAddress: params.req ? getClientIp(params.req) : null,
      userAgent: params.req?.headers.get("user-agent") ?? null,
    },
  });
}

// ============================================================
// Time helpers — store UTC, format with timezone
// ============================================================

/**
 * The UTC offset of `timeZone` at `date`, in milliseconds.
 *
 * Positive east of Greenwich. Computed by reading the wall-clock time in the
 * zone and comparing it to UTC, which is the only way to get DST right — a
 * fixed offset would be wrong for half the year in any zone that observes it.
 */
function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  // `hour12: false` yields "24" for midnight in some ICU versions; % 24 folds it
  // back to 00 so the UTC reconstruction below is not off by a day.
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) % 24,
    Number(get("minute")),
    Number(get("second")),
  );
  return asUtc - date.getTime();
}

/**
 * The UTC instant of midnight starting the day that `at` falls on in `timeZone`.
 *
 * This is deliberately not `new Date(at).setHours(0,0,0,0)`, which silently uses
 * the *server's* zone. Vercel runs UTC, so for a Karachi company every session
 * between 00:00 and 05:00 UTC was being filed under the previous day — which is
 * exactly the five hours right after the shift that the midnight crew works.
 */
export function startOfDayInTimezone(timeZone: string, at: Date = new Date()): Date {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at); // YYYY-MM-DD

  const [y, m, d] = localDate.split("-").map(Number);
  const wallClockUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0);

  // One pass is enough except within a few ms of a DST jump, where the first
  // guess lands on the wrong side of the transition; a second pass settles it.
  let ts = wallClockUtc - timezoneOffsetMs(new Date(wallClockUtc), timeZone);
  ts = wallClockUtc - timezoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/**
 * The UTC instant of a "HH:mm" wall-clock time on the day `at` falls on in
 * `timeZone`. Used to place a shift's scheduled end on a real date.
 */
export function wallClockInTimezone(timeZone: string, hhmm: string, at: Date): Date {
  const dayStart = startOfDayInTimezone(timeZone, at);
  const [h, m] = hhmm.split(":").map(Number);
  const target = dayStart.getTime() + (h * 60 + m) * 60_000;
  // Same two-pass correction as above for DST boundary days.
  let ts = target - timezoneOffsetMs(new Date(target), timeZone);
  ts = target - timezoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/**
 * A calendar date as `YYYY-MM-DD` in the tenant's timezone.
 *
 * `attendanceDate` is midnight *in the company's timezone* stored as a UTC
 * instant, so for Karachi that is 19:00 UTC the previous evening. Slicing the
 * ISO string — `date.toISOString().split("T")[0]` — therefore labels every
 * session a day early, which is what the history screen showed.
 */
export function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nowInTimezone(timezone = "Asia/Karachi"): { date: Date; startOfDay: Date } {
  const now = new Date();
  return { date: now, startOfDay: startOfDayInTimezone(timezone, now) };
}

/**
 * The tenant's timezone for an authenticated request.
 *
 * Reads it off the token, which costs nothing. Tokens minted before the field
 * existed fall back to one company lookup — a 15-minute window after deploy,
 * paid once per session rather than once per request.
 */
export async function resolveTimezone(
  user: Pick<JwtPayload, "timezone" | "companyId">
): Promise<string> {
  if (user.timezone) return user.timezone;
  if (!user.companyId) return "Asia/Karachi";
  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: { timezone: true },
  });
  return company?.timezone || "Asia/Karachi";
}

export function formatTimeInTimezone(date: Date | null, timezone = "Asia/Karachi"): string | null {
  if (!date) return null;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatMins(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

// ============================================================
// Stale attendance sessions
// ============================================================

/**
 * Hard ceiling on a single working session, in hours.
 *
 * This is payroll protection, not a convenience. A forgotten check-out would
 * otherwise keep accruing paid hours until something else closed it — and
 * `closeStaleSessions` only does that once the date rolls over, so an employee
 * could bank a full extra day's pay by never pressing the button. Eight hours
 * matches a normal shift; anything longer is an anomaly a supervisor should see
 * rather than silently pay for.
 *
 * Deliberately a constant rather than a per-company setting: a site that
 * genuinely runs 12-hour shifts should say so, not have the default quietly
 * over-credit everyone.
 */
export const MAX_WORKING_HOURS_HARD_CAP = 8;

/**
 * The instant a session that started at `checkIn` has hit the cap, or null if it
 * has not.
 *
 * Pure and clock-injectable so the rule can be exercised without waiting eight
 * hours, and so every call site enforces it identically.
 */
export function maxWorkingCapInstant(
  checkIn: Date | null,
  now: Date = new Date(),
  capHours: number = MAX_WORKING_HOURS_HARD_CAP,
): Date | null {
  if (!checkIn) return null;
  const capAt = new Date(checkIn.getTime() + capHours * 3_600_000);
  return now.getTime() >= capAt.getTime() ? capAt : null;
}

/**
 * Closes a session that has overrun the hard cap.
 *
 * Called by whichever endpoint already holds the open session, so enforcing the
 * cap costs no extra query — see the call sites in /mobile/location,
 * /mobile/attendance/today, /mobile/dashboard and /mobile/attendance/check-in.
 *
 * The session is closed *at the cap instant*, not at "now", so the credited time
 * and the stored timestamp agree. Leaving it open until the rule is noticed
 * would pay for the overshoot.
 */
export async function autoCloseAtMaxHours(opts: {
  attendanceId: string;
  checkIn: Date;
  capAt: Date;
  employeeId: string;
  companyId: string;
  userId?: string | null;
  projectName?: string | null;
}): Promise<void> {
  const workingMins = MAX_WORKING_HOURS_HARD_CAP * 60;
  const now = new Date();

  await db.attendance.update({
    where: { id: opts.attendanceId },
    data: {
      checkOut: opts.capAt,
      checkOutServerReceivedAt: now,
      checkOutDeviceId: "AUTO_MAX_HOURS",
      workingMins,
      sessionStatus: "COMPLETED",
      verificationStatus: "FLAGGED",
      notes:
        `Closed automatically after reaching the ${MAX_WORKING_HOURS_HARD_CAP}-hour ` +
        `maximum working time for a single session. No check-out was recorded by ` +
        `the employee. Please review.`,
    },
  });

  await db.notification.create({
    data: {
      // Addressed to the employee; the record itself is FLAGGED, which is how
      // it reaches the supervisor's review queue.
      userId: opts.userId ?? null,
      companyId: opts.companyId,
      type: "ALERT",
      title: "Shift closed at the maximum working time",
      description:
        `Your session at ${opts.projectName ?? "a project"} was closed automatically ` +
        `after ${MAX_WORKING_HOURS_HARD_CAP} hours. Any time beyond that was not ` +
        `recorded. Please check out before then next time.`,
    },
  });
}

/**
 * Ceiling on time credited to a session closed without the employee.
 *
 * Without this, a forgotten session left open over a long weekend would be
 * settled at check-out time and hand the employee days of paid work they never
 * did. Twelve hours is the longest plausible single stretch; anything beyond is
 * a guess, and a guess should not become a payslip.
 */
const MAX_UNATTENDED_SESSION_MINS = 12 * 60;

/**
 * Closes attendance sessions left open from a previous day.
 *
 * This exists because of a genuine deadlock. `check-in` refuses when *any*
 * unclosed session exists for the employee, but `today` and the dashboard only
 * ever look at today's sessions. So a session left open when the app was closed
 * — a crash, a flat battery, a flight — produced this: the dashboard said
 * "Not Checked In", offered a CHECK IN button, and that button could only ever
 * fail with ALREADY_CHECKED_IN. Because `today` never returned the stale
 * session's id, the app had no CHECK OUT button either. The employee was locked
 * out of attendance until someone fixed the row by hand in the database.
 *
 * Nobody is still working a shift from yesterday, so a session older than today
 * is closed rather than left to block. It is closed at the shift's scheduled end
 * where one is known, and flagged FLAGGED either way, so a supervisor reviews it
 * instead of it silently becoming a number.
 *
 * Deliberately does *not* touch a session opened today: that one may genuinely
 * be live, and the geofence auto-checkout in /mobile/location owns closing it.
 */
export async function closeStaleSessions(opts: {
  employeeId: string;
  companyId: string;
  timezone: string;
}): Promise<{ closed: string[] }> {
  const { startOfDay } = nowInTimezone(opts.timezone);

  const stale = await db.attendance.findMany({
    where: {
      employeeId: opts.employeeId,
      checkIn: { not: null },
      checkOut: null,
      attendanceDate: { lt: startOfDay },
    },
    include: { project: true },
  });

  if (stale.length === 0) return { closed: [] };

  const closed: string[] = [];
  const now = new Date();

  // `Attendance.shiftId` is a bare column with no Prisma relation, and the
  // employee's `User` is only reachable through the reverse side of the
  // relation. Both are fetched up front rather than per session.
  const shiftIds = [...new Set(stale.map((s) => s.shiftId).filter((id): id is string => !!id))];
  const shifts = shiftIds.length
    ? await db.shift.findMany({ where: { id: { in: shiftIds } } })
    : [];
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const employee = await db.employee.findUnique({
    where: { id: opts.employeeId },
    include: { user: { select: { id: true } } },
  });
  const userId = employee?.user?.id ?? null;

  for (const session of stale) {
    if (!session.checkIn) continue;
    const shift = session.shiftId ? shiftById.get(session.shiftId) : undefined;

    // Best available estimate of when the employee actually left.
    let checkOut = now;
    let basis = `there being no scheduled end time for this session, so the ` +
      `maximum plausible ${MAX_UNATTENDED_SESSION_MINS / 60}h shift was assumed`;
    if (shift?.endTime) {
      const scheduled = wallClockInTimezone(opts.timezone, shift.endTime, session.checkIn);
      // Only trust the schedule if it lands after the check-in. A shift that
      // ends before it starts (an overnight shift stored as "06:00"–"22:00"
      // read the other way round, say) would otherwise produce negative hours.
      if (scheduled.getTime() > session.checkIn.getTime()) {
        checkOut = scheduled;
        basis = `the "${shift.name}" shift's scheduled end (${shift.endTime})`;
      }
    }

    const rawMins = Math.max(0, Math.round((checkOut.getTime() - session.checkIn.getTime()) / 60_000));
    const workingMins = Math.min(rawMins, MAX_UNATTENDED_SESSION_MINS);
    const capped = workingMins < rawMins;

    // Keep the stored timestamp consistent with the credited time. Leaving
    // checkOut at "now" while crediting 12h produced a record that claimed the
    // employee checked out five days after they clocked in, which is worse than
    // useless in a report. When there is nothing to go on, the session is closed
    // at check-in plus the cap, so the two numbers tell the same story.
    if (capped) {
      checkOut = new Date(session.checkIn.getTime() + MAX_UNATTENDED_SESSION_MINS * 60_000);
    }

    await db.attendance.update({
      where: { id: session.id },
      data: {
        checkOut,
        checkOutServerReceivedAt: now,
        checkOutDeviceId: "AUTO_STALE_SESSION",
        workingMins,
        sessionStatus: "COMPLETED",
        verificationStatus: "FLAGGED",
        notes:
          `Closed automatically on ${formatDate(checkOut)}. The app was not used ` +
          `after check-in, so no check-out time or photo was ever captured; the ` +
          `recorded end is based on ${basis}` +
          (capped
            ? `, capped at ${MAX_UNATTENDED_SESSION_MINS / 60}h because the ` +
              `unattended gap was longer than a single plausible shift.`
            : ".") +
          ` Please review.`,
      },
    });

    await db.notification.create({
      data: {
        // Addressed to this employee only. A company broadcast would tell every
        // colleague about one person's forgotten check-out.
        userId,
        companyId: opts.companyId,
        type: "ALERT",
        title: "Attendance session closed automatically",
        description:
          `Your ${formatDate(session.checkIn)} session at ` +
          `${session.project?.name ?? "a project"} was never checked out, so it ` +
          `was closed automatically and flagged for review. Please confirm it ` +
          `with your supervisor.`,
      },
    });

    closed.push(session.id);
  }

  return { closed };
}

// ============================================================
// Late calculation
// ============================================================

/**
 * Parses a shift time into minutes since midnight.
 *
 * Accepts both "09:00" (24-hour, what the shift form stores) and "09:00 AM"
 * (12-hour, what seeded and legacy rows hold). Returns null for a shift with no
 * fixed hours — "Variable"/flexible shifts are legitimate and must not be
 * treated as midnight.
 */
export function parseShiftTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || /^variable$/i.test(trimmed)) return null;

  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;

  let hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();

  if (mins > 59) return null;
  if (ampm) {
    if (hours < 1 || hours > 12) return null;
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + mins;
}

/** Normalises a shift time to "HH:MM", or null when it is a flexible shift. */
export function normalizeShiftTime(value: string | null | undefined): string | null {
  const mins = parseShiftTime(value);
  if (mins === null) return null;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function calculateLateMins(checkIn: Date, shiftStart: string, graceMins: number): number {
  const mins = parseShiftTime(shiftStart);
  // A flexible shift has no defined start, so nobody can be late to it.
  if (mins === null) return 0;

  const shiftDate = new Date(checkIn);
  shiftDate.setHours(Math.floor(mins / 60), (mins % 60) + graceMins, 0, 0);
  const diff = Math.max(0, Math.round((checkIn.getTime() - shiftDate.getTime()) / 60000));
  return diff;
}

// ============================================================
// Pagination helper
// ============================================================

export function paginate(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  return { page, limit, skip: (page - 1) * limit };
}
