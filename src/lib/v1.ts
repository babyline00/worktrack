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
  await db.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
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

export function nowInTimezone(timezone = "Asia/Karachi"): { date: Date; startOfDay: Date } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  return { date: now, startOfDay };
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
// Late calculation
// ============================================================

export function calculateLateMins(checkIn: Date, shiftStart: string, graceMins: number): number {
  // shiftStart format: "09:00 AM"
  const m = shiftStart.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let hours = parseInt(m[1]);
  const mins = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const shiftDate = new Date(checkIn);
  shiftDate.setHours(hours, mins + graceMins, 0, 0);
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
