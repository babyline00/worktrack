import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Authorisation for the cookie-session `/api/*` surface (the admin web UI).
//
// The `/api/v1/*` surface already gated writes with `requireRole(...)`, but the
// cookie routes this file covers only checked that *a* session existed and which
// tenant it belonged to. That is tenant scoping, not authorisation: it stops
// one company editing another's project, but it does nothing to stop an
// employee account doing it to its own. Anything holding a valid staff session
// could create, edit and delete projects and shifts.
//
// Hiding buttons in the UI is not a control here — the UI renders the same page
// to every role, so these checks are the actual boundary.

/** Roles allowed to change company-wide configuration. */
export const CONFIG_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

/** Roles allowed to read operational data. */
export const CONFIG_READ_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const;

export type AuthedCompany =
  | { error: NextResponse; companyId?: undefined; userId?: undefined }
  | { error?: undefined; companyId: string; userId: string };

/**
 * Requires a session for `roles` and returns the caller's tenant.
 *
 * Returns a ready-to-return `NextResponse` rather than throwing, because every
 * caller in this codebase already returns responses rather than handling
 * exceptions at a boundary.
 */
export async function requireCompanyRole(
  roles: readonly string[],
): Promise<AuthedCompany> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user as any;
  const companyId = user.companyId as string | undefined;
  if (!companyId) {
    return {
      error: NextResponse.json({ error: "No company on session" }, { status: 403 }),
    };
  }

  if (!roles.includes(String(user.role ?? ""))) {
    // 403, not 401: the caller is authenticated, just not allowed. Distinguishing
    // them matters when reading logs to work out whether someone is probing the
    // API with a stolen session.
    return {
      error: NextResponse.json(
        { error: "You do not have permission to perform this action" },
        { status: 403 },
      ),
    };
  }

  return { companyId, userId: user.id as string };
}

/**
 * Session + tenant, with no role restriction. For read routes.
 *
 * Still worth centralising: it keeps the `companyId` unwrapping in one place,
 * which is what several hand-rolled copies of this got subtly wrong.
 */
export async function authedCompany(): Promise<AuthedCompany> {
  return requireCompanyRole([
    ...CONFIG_READ_ROLES,
    // Employees may read the config surfaces they need (their own project's
    // geofence, the shift list shown on their timesheet).
    "EMPLOYEE",
  ]);
}
