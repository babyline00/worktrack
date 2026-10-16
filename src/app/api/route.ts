import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
// Never cached: this is the endpoint the app uses to prove it is talking to a
// live, reachable NAS deployment, and to warm the connection pool before it
// fires its real requests.
export const dynamic = "force-dynamic";

/**
 * GET /api
 *
 * Service descriptor and liveness check.
 *
 * This used to return `{"message": "Hello, world!"}`, which told a client
 * nothing: it could not tell whether it had reached the right deployment, which
 * API version it should speak, or whether the database was reachable at all.
 * The mobile app uses it as a cheap pre-flight — if this fails, there is no
 * point waiting on `/auth/login` to time out.
 */
export async function GET() {
  const startedAt = Date.now();

  // Deliberately the cheapest possible query. This endpoint exists to answer
  // "is the API up", not to serve data, so it must not compete with real work.
  let database: "up" | "down" = "up";
  let databaseError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (err: any) {
    database = "down";
    // The message is intentionally coarse — this response is unauthenticated,
    // so it must not leak connection strings or driver detail to the internet.
    databaseError = err?.name === "PrismaClientInitializationError"
      ? "Database unreachable"
      : "Database query failed";
  }

  const body = {
    ok: database === "up",
    service: "NAS International",
    product: "Workforce Management",
    tagline: "Delivering Today • Connecting Tomorrow",
    api: {
      version: "v1",
      // The mobile app resolves everything relative to this, so a client that
      // hardcoded a host can be corrected without shipping a new build.
      root: "/api/v1",
      health: "/api",
    },
    database,
    ...(databaseError ? { databaseError } : {}),
    capabilities: [
      "auth",
      "attendance",
      "live-tracking",
      "geofencing",
      "projects",
      "leave",
      "reports",
      "notifications",
    ],
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  // 503 when the database is down so a health check or a load balancer can act
  // on the status code instead of having to parse the body.
  return NextResponse.json(body, {
    status: database === "up" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}