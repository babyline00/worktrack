import { db } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  ApiError,
  ERRORS,
  haversineMeters,
} from "@/lib/v1";

export const runtime = "nodejs";

/** Fallback grace period when the company has no explicit setting. */
const DEFAULT_AUTO_CHECKOUT_MINS = 5;

/**
 * Company policy for automatic check-out when an employee leaves the site.
 *
 * Reuses the existing `AUTO_CHECKOUT` switch the settings screen already
 * exposes, and adds a separate grace-period setting so a company can allow a
 * longer site visit before the session is closed for them.
 */
async function autoCheckoutPolicy(
  companyId: string,
): Promise<{ enabled: boolean; graceMins: number }> {
  const rows = await db.setting.findMany({
    where: {
      companyId,
      key: { in: ["AUTO_CHECKOUT", "GEOFENCE_AUTO_CHECKOUT_MINS"] },
    },
    select: { key: true, value: true },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const configured = Number(get("GEOFENCE_AUTO_CHECKOUT_MINS"));
  return {
    enabled: get("AUTO_CHECKOUT") === "true",
    graceMins:
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_AUTO_CHECKOUT_MINS,
  };
}

/**
 * When the employee first left the site on the current outside spell.
 *
 * Derived from the stored ping trail rather than a dedicated column, so no
 * migration is needed: the spell starts after the most recent inside ping.
 * Returns `null` when they have never been inside, which would leave no
 * trustworthy baseline to measure from.
 */
async function startOfOutsideSpell(
  attendanceId: string,
): Promise<Date | null> {
  const lastInside = await db.attendanceLocation.findFirst({
    where: { attendanceId, insideGeofence: true },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  const firstOutside = await db.attendanceLocation.findFirst({
    where: {
      attendanceId,
      insideGeofence: false,
      ...(lastInside ? { recordedAt: { gt: lastInside.recordedAt } } : {}),
    },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true },
  });
  return firstOutside?.recordedAt ?? null;
}

/** Closes an open session without employee interaction, flagged for review. */
async function closeSessionAutomatically(opts: {
  attendance: {
    id: string;
    checkIn: Date | null;
    project: { name: string | null } | null;
  };
  latitude: number;
  longitude: number;
  accuracy: number;
  distance: number;
  outsideMins: number;
  graceMins: number;
  employeeId: string;
  companyId: string;
}) {
  const now = new Date();
  const workingMins = opts.attendance.checkIn
    ? Math.max(0, Math.round((now.getTime() - opts.attendance.checkIn.getTime()) / 60000))
    : 0;

  await db.attendance.update({
    where: { id: opts.attendance.id },
    data: {
      checkOut: now,
      checkOutLat: opts.latitude,
      checkOutLng: opts.longitude,
      checkOutAccuracy: opts.accuracy,
      checkOutCapturedAt: now,
      checkOutServerReceivedAt: now,
      checkOutDeviceId: "AUTO_GEOFENCE",
      workingMins,
      sessionStatus: "COMPLETED",
      insideGeofence: false,
      distanceFromProject: opts.distance,
      // No selfie was possible without the employee, so the record is flagged
      // rather than left looking verified.
      verificationStatus: "FLAGGED",
      notes:
        `Auto checked out after ${opts.outsideMins} minutes outside the project ` +
        `radius (limit ${opts.graceMins} min). Last position was ` +
        `${opts.distance}m from the site.`,
    },
  });

  const emp = await db.employee.findUnique({ where: { id: opts.employeeId } });
  await db.notification.create({
    data: {
      companyId: opts.companyId,
      type: "ALERT",
      title: `${emp?.firstName ?? "Employee"} was auto checked out`,
      description:
        `Left ${opts.attendance.project?.name ?? "the project"} for ` +
        `${opts.outsideMins} minutes (${opts.distance}m away). Session closed and flagged.`,
      timeAgo: "Just now",
      unread: true,
    },
  });
}

// POST /api/v1/mobile/location
// Live location tracking during work session
// Body: { attendanceId, latitude, longitude, accuracy, recordedAt }
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    if (!user.employeeId || !user.companyId) throw ERRORS.FORBIDDEN();

    const body = await req.json().catch(() => ({}));
    const { attendanceId, latitude, longitude, accuracy, recordedAt } = body;

    if (!attendanceId || isNaN(latitude) || isNaN(longitude)) {
      throw ERRORS.VALIDATION("attendanceId, latitude, longitude are required");
    }

    // Verify attendance belongs to user & is WORKING
    const att = await db.attendance.findUnique({
      where: { id: attendanceId },
      include: { project: true },
    });
    if (!att) throw ERRORS.NOT_FOUND("Attendance not found");
    if (att.employeeId !== user.employeeId) throw ERRORS.FORBIDDEN();
    if (att.sessionStatus !== "WORKING") {
      throw new ApiError("NOT_WORKING", "Location updates only allowed during an active work session.", 400);
    }

    // Calculate geofence status
    let insideGeofence = true;
    let distance = 0;
    if (att.project?.lat && att.project?.lng) {
      distance = haversineMeters(att.project.lat, att.project.lng, latitude, longitude);
      insideGeofence = distance <= att.project.radiusM;
    }

    // Save location point
    await db.attendanceLocation.create({
      data: {
        attendanceId,
        latitude,
        longitude,
        accuracy: accuracy ?? 0,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        source: "MOBILE",
        insideGeofence,
        distanceFromProject: distance,
      },
    });

    // If outside geofence & was previously inside, flag + notify
    if (!insideGeofence && att.insideGeofence) {
      await db.attendance.update({
        where: { id: attendanceId },
        data: { insideGeofence: false, distanceFromProject: distance },
      });
      const emp = await db.employee.findUnique({ where: { id: user.employeeId } });
      await db.notification.create({
        data: {
          companyId: user.companyId,
          type: "ALERT",
          title: `${emp?.firstName ?? "Employee"} is outside project geofence`,
          description: `Currently ${distance}m away from ${att.project?.name ?? "project"}`,
          timeAgo: "Just now",
          unread: true,
        },
      });
    } else if (insideGeofence && !att.insideGeofence) {
      await db.attendance.update({
        where: { id: attendanceId },
        data: { insideGeofence: true, distanceFromProject: distance },
      });
    }

    // Auto check-out: close the session by itself once the employee has been
    // clear of the site for the whole grace period. A single drifting fix must
    // never end a shift, so the clock only starts at the first outside ping of
    // the current spell and resets the moment they come back.
    let autoCheckedOut = false;
    if (!insideGeofence) {
      const { enabled, graceMins } = await autoCheckoutPolicy(user.companyId);
      if (enabled) {
        const breachStart = await startOfOutsideSpell(attendanceId);
        if (breachStart) {
          const outsideMins = Math.floor((Date.now() - breachStart.getTime()) / 60000);
          if (outsideMins >= graceMins) {
            await closeSessionAutomatically({
              attendance: att,
              latitude,
              longitude,
              accuracy,
              distance,
              outsideMins,
              graceMins,
              employeeId: user.employeeId,
              companyId: user.companyId,
            });
            autoCheckedOut = true;
          }
        }
      }
    }

    return apiSuccess({
      insideGeofence,
      distanceFromProject: distance,
      autoCheckedOut,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return apiError(err);
    return apiError(ERRORS.INTERNAL());
  }
}
