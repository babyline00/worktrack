import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeShiftTime } from "@/lib/v1";
import type { Prisma } from "@prisma/client";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Validates a shift's fields.
 *
 * This previously accepted anything: an empty name, unparsable grace/break
 * values that became NaN, and an empty workingDays string that silently made
 * the shift never apply.
 *
 * Times are normalised to "HH:MM" on the way in. Both "09:00 AM" and "09:00" are
 * accepted, because seeded and legacy rows are stored in 12-hour form and
 * rejecting them would make those shifts impossible to edit.
 */
function validate(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.name = "Shift name is required";

  const rawStart = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const rawEnd = typeof body.endTime === "string" ? body.endTime.trim() : "";

  let startTime: string | null = null;
  let endTime: string | null = null;
  const startGiven = rawStart !== "" && !/^variable$/i.test(rawStart);
  const endGiven = rawEnd !== "" && !/^variable$/i.test(rawEnd);

  if (startGiven) {
    startTime = normalizeShiftTime(rawStart);
    if (startTime === null) errors.startTime = "Use HH:MM (24-hour)";
  }
  if (endGiven) {
    endTime = normalizeShiftTime(rawEnd);
    if (endTime === null) errors.endTime = "Use HH:MM (24-hour)";
  }

  // A shift may legitimately have no fixed hours ("Variable"/flexible), but
  // having exactly one of the pair is a mistake.
  if (startGiven !== endGiven && !errors.startTime && !errors.endTime) {
    errors[endGiven ? "endTime" : "startTime"] = "Set both times, or clear both for a flexible shift";
  }
  // An overnight shift (18:00 -> 03:00) is normal, so only equality is invalid.
  if (startTime && endTime && startTime === endTime) {
    errors.endTime = "End time must differ from the start time";
  }

  const graceMins = Number(body.graceMins ?? 15);
  if (!Number.isInteger(graceMins) || graceMins < 0 || graceMins > 240) {
    errors.graceMins = "Enter 0–240 minutes";
  }
  const breakMins = Number(body.breakMins ?? 45);
  if (!Number.isInteger(breakMins) || breakMins < 0 || breakMins > 480) {
    errors.breakMins = "Enter 0–480 minutes";
  }

  const rawDays = Array.isArray(body.workingDays)
    ? body.workingDays.map(String)
    : typeof body.workingDays === "string"
      ? body.workingDays.split(",").map((d) => d.trim()).filter(Boolean)
      : [];
  const workingDays = rawDays.filter((d) => DAY_NAMES.includes(d));
  if (workingDays.length === 0) errors.workingDays = "Select at least one working day";

  return {
    errors,
    values: {
      name,
      // Flexible shifts keep the literal "Variable" so the existing UI, which
      // renders the raw column, still reads sensibly.
      startTime: startTime ?? "Variable",
      endTime: endTime ?? "Variable",
      graceMins,
      breakMins,
      workingDays: workingDays.join(","),
    },
  };
}

async function authedCompany() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { companyId: (session.user as any).companyId as string };
}

export async function GET() {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;
  const shifts = await db.shift.findMany({
    where: { companyId: auth.companyId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ shifts });
}

export async function POST(req: Request) {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { errors, values } = validate(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Please fix the highlighted fields", errors }, { status: 400 });
  }

  const shift = await db.shift.create({ data: { ...values, companyId: auth.companyId } });
  return NextResponse.json({ shift }, { status: 201 });
}

/** PATCH /api/shifts — partial update; omitted fields keep their value. */
export async function PATCH(req: Request) {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Shift id is required" }, { status: 400 });

  // Scoped to the company so an id from another tenant cannot be edited.
  const existing = await db.shift.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  // Validate the merged result, so a partial edit cannot leave the row invalid.
  const { errors, values } = validate({
    name: body.name ?? existing.name,
    startTime: body.startTime ?? existing.startTime,
    endTime: body.endTime ?? existing.endTime,
    graceMins: body.graceMins ?? existing.graceMins,
    breakMins: body.breakMins ?? existing.breakMins,
    workingDays: body.workingDays ?? existing.workingDays,
  });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Please fix the highlighted fields", errors }, { status: 400 });
  }

  const data: Prisma.ShiftUpdateInput = values;
  const shift = await db.shift.update({ where: { id }, data });
  return NextResponse.json({ shift });
}

export async function DELETE(req: Request) {
  const auth = await authedCompany();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Shift id is required" }, { status: 400 });

  const existing = await db.shift.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  // Attendance rows reference their shift, so refuse rather than orphan history.
  const usedBy = await db.attendance.count({ where: { shiftId: id } });
  if (usedBy > 0) {
    return NextResponse.json(
      {
        error: `This shift is used by ${usedBy} attendance record${usedBy === 1 ? "" : "s"} and cannot be deleted. Remove it from those records first, or rename it instead.`,
        attendanceRecords: usedBy,
      },
      { status: 409 },
    );
  }

  await db.shift.delete({ where: { id } });
  return NextResponse.json({ success: true });
}