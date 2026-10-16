// Monthly attendance rollup and salary computation.
//
// Shared by two authentication surfaces that must not drift apart:
//   - /api/attendance/{monthly,salary}  NextAuth cookie session (admin web UI)
//   - /api/v1/reports/salary             JWT bearer token (mobile / integrations)
// The web app carries a NextAuth cookie, not a v1 JWT, so the browser cannot
// call the v1 routes — hence one implementation behind both.

import { db } from "@/lib/db";
import {
  startOfDayInTimezone,
  formatDateInTimezone,
  MAX_WORKING_HOURS_HARD_CAP,
} from "@/lib/v1";

/** Pay rates live in the existing per-company Setting table. See the note in
 *  /api/v1/reports/salary: no migration needed, and moving to a real table later
 *  is a data migration rather than a redesign. */
export const RATE_KEY = (employeeId: string) => `SALARY_HOURLY_RATE_${employeeId}`;
export const OVERTIME_MULTIPLIER_KEY = "SALARY_OVERTIME_MULTIPLIER";

export const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

export function rateKeyFor(employeeId: string) {
  return RATE_KEY(employeeId);
}

/**
 * Half-open UTC bounds `[from, to)` covering one calendar month in `timezone`.
 *
 * Half-open because the exclusive end is what stops the first instant of the
 * next month being counted twice, and `timezone` because `new Date(y, m, 1)` is
 * the server's zone — on Vercel that is UTC, which for a Karachi company starts
 * the month five hours late and ends it five hours early, silently dropping the
 * first and last shift of every month.
 */
export function monthBounds(timezone: string, year: number, month0: number) {
  const from = startOfDayInTimezone(timezone, new Date(Date.UTC(year, month0, 1, 12)));
  const to = startOfDayInTimezone(timezone, new Date(Date.UTC(year, month0 + 1, 1, 12)));
  return { from, to };
}

/** Parses `YYYY-MM`, falling back to the server's current month. */
export function parseMonth(month?: string | null): { year: number; month0: number } {
  const now = new Date();
  if (!month) return { year: now.getFullYear(), month0: now.getMonth() };
  const [y, m] = month.split("-").map((v) => parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error("month must be in YYYY-MM format");
  }
  return { year: y, month0: m - 1 };
}

type SalaryEmployee = {
  employeeId: string;
  empId: string;
  name: string;
  designation: string | null;
  avatarColor: string | null;
  days: number;
  present: number;
  late: number;
  absent: number;
  leaveDays: number;
  totalMins: number;
  overtimeMins: number;
  hourlyRate: number;
  cappedSessions: number;
  flaggedSessions: number;
  records: any[];
};

const AUTO_CLOSE_DEVICES = new Set([
  "AUTO_MAX_HOURS",
  "AUTO_GEOFENCE",
  "AUTO_STALE_SESSION",
]);

/**
 * Aggregates a month's attendance per employee and prices it.
 *
 * Every figure comes from `Attendance.workingMins` — the same column the daily
 * screen shows — so a supervisor comparing the two is looking at one set of
 * numbers, not a parallel calculation.
 */
export async function computeMonthlySalary(opts: {
  companyId: string;
  timezone: string;
  year: number;
  month0: number;
  employeeId?: string;
}) {
  const { companyId, timezone, year, month0 } = opts;
  const { from, to } = monthBounds(timezone, year, month0);

  const where: any = {
    attendanceDate: { gte: from, lt: to },
    employee: { companyId },
  };
  if (opts.employeeId) where.employeeId = opts.employeeId;

  const [records, employees, settings] = await Promise.all([
    db.attendance.findMany({
      where,
      include: { employee: true, project: true },
      orderBy: [{ employeeId: "asc" }, { attendanceDate: "asc" }],
    }),
    // Everyone, including those with no hours this month, so the list is the
    // payroll run rather than only the people who happened to work.
    db.employee.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        empId: true,
        firstName: true,
        lastName: true,
        avatarColor: true,
        designation: true,
      },
      orderBy: { empId: "asc" },
    }),
    db.setting.findMany({
      where: {
        companyId,
        OR: [
          { key: { startsWith: "SALARY_HOURLY_RATE_" } },
          { key: OVERTIME_MULTIPLIER_KEY },
        ],
      },
      select: { key: true, value: true },
    }),
  ]);

  const rateFor = (employeeId: string): number => {
    const n = Number(settings.find((s) => s.key === RATE_KEY(employeeId))?.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const multRaw = Number(settings.find((s) => s.key === OVERTIME_MULTIPLIER_KEY)?.value);
  const overtimeMultiplier =
    Number.isFinite(multRaw) && multRaw > 0 ? multRaw : DEFAULT_OVERTIME_MULTIPLIER;

  const byEmployee = new Map<string, SalaryEmployee>();
  const blank = (e: {
    id: string;
    empId: string;
    firstName: string;
    lastName: string;
    avatarColor: string | null;
    designation: string | null;
  }): SalaryEmployee => ({
    employeeId: e.id,
    empId: e.empId,
    name: `${e.firstName} ${e.lastName}`,
    designation: e.designation,
    avatarColor: e.avatarColor,
    days: 0,
    present: 0,
    late: 0,
    absent: 0,
    leaveDays: 0,
    totalMins: 0,
    overtimeMins: 0,
    hourlyRate: rateFor(e.id),
    cappedSessions: 0,
    flaggedSessions: 0,
    records: [],
  });

  for (const e of employees) byEmployee.set(e.id, blank(e));

  for (const r of records) {
    // A record whose employee row is gone (deleted mid-month) still has hours
    // that were genuinely worked. Keep the bucket rather than dropping them and
    // silently under-paying.
    let bucket = byEmployee.get(r.employeeId);
    if (!bucket) {
      bucket = blank(r.employee);
      byEmployee.set(r.employeeId, bucket);
    }

    bucket.days++;
    if (r.attendanceStatus === "PRESENT") bucket.present++;
    if (r.attendanceStatus === "LATE") bucket.late++;
    if (r.attendanceStatus === "ABSENT") bucket.absent++;
    if (r.attendanceStatus === "ON_LEAVE") bucket.leaveDays++;
    bucket.totalMins += r.workingMins;
    if (r.checkOutDeviceId === "AUTO_MAX_HOURS") bucket.cappedSessions++;
    if (r.verificationStatus === "FLAGGED") bucket.flaggedSessions++;

    bucket.records.push({
      // Keyed on the calendar day in the tenant's timezone, so a session that
      // starts at 23:30 is not filed under the next day by UTC maths.
      dayKey: formatDateInTimezone(r.attendanceDate, timezone),
      date: formatDateInTimezone(r.attendanceDate, timezone),
      project: r.project?.name ?? null,
      projectCode: r.project?.code ?? null,
      checkIn: r.checkIn?.toISOString() ?? null,
      checkOut: r.checkOut?.toISOString() ?? null,
      workingMinutes: r.workingMins,
      overtimeMinutes: 0,
      status: r.attendanceStatus,
      sessionStatus: r.sessionStatus,
      verificationStatus: r.verificationStatus,
      autoClosed:
        r.checkOutDeviceId && AUTO_CLOSE_DEVICES.has(r.checkOutDeviceId)
          ? r.checkOutDeviceId
          : null,
    });
  }

  // Overtime is assessed per day, not per month: a month of 6-hour days is not
  // the same as six days of 9 hours, and only the second is overtime.
  //
  // Two passes on purpose. The first recorded each session; this one computes
  // each day's true excess and hands it out. Doing it inline re-derived
  // `standard` against every session, so several sessions were each labelled
  // overtime for the same minutes — paying 7 minutes of overtime on a day that
  // only exceeded by 4.
  const standardMinsPerDay = DEFAULT_STANDARD_HOURS_PER_DAY * 60;
  for (const bucket of byEmployee.values()) {
    const byDay = new Map<string, any[]>();
    for (const rec of bucket.records) {
      const list = byDay.get(rec.dayKey);
      if (list) list.push(rec);
      else byDay.set(rec.dayKey, [rec]);
    }
    for (const daySessions of byDay.values()) {
      const dayTotal = daySessions.reduce((s, r) => s + r.workingMinutes, 0);
      let excess = dayTotal - standardMinsPerDay;
      if (excess <= 0) continue;
      // Newest session first, so the attribution matches how the day ended.
      for (let i = daySessions.length - 1; i >= 0 && excess > 0; i--) {
        const take = Math.min(excess, daySessions[i].workingMinutes);
        daySessions[i].overtimeMinutes = take;
        excess -= take;
        bucket.overtimeMins += take;
      }
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const employeesOut = Array.from(byEmployee.values()).map((b) => {
    const ordinaryMins = Math.max(0, b.totalMins - b.overtimeMins);
    // Hours are rounded first and pay derived from the rounded figures, so an
    // admin multiplying the hours on screen by the rate gets the pay on screen.
    // Deriving pay from unrounded minutes instead leaves a few rupees unexplained
    // on a payslip, which is what turns into a payroll query.
    const ordinaryHours = round(ordinaryMins / 60);
    const overtimeHours = round(b.overtimeMins / 60);
    // Derived from the two displayed columns rather than rounded separately from
    // raw minutes, so the row visibly adds up. Rounding all three independently
    // made the columns disagree by 0.01h, which is exactly the sort of thing
    // someone checks a payslip for.
    const totalHours = round(ordinaryHours + overtimeHours);
    const grossPay = round(
      ordinaryHours * b.hourlyRate + overtimeHours * b.hourlyRate * overtimeMultiplier,
    );
    return {
      ...b,
      // The per-day breakdown is what an employee disputes; dayKey is an
      // internal grouping handle and has no business in a payslip.
      records: b.records.map(({ dayKey, ...rest }) => rest),
      ordinaryMins,
      ordinaryHours,
      overtimeHours,
      totalHours,
      grossPay,
      hasRate: b.hourlyRate > 0,
    };
  });

  const paid = employeesOut.filter((e) => e.hasRate);

  return {
    month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
    currency: "PKR",
    standardHoursPerDay: DEFAULT_STANDARD_HOURS_PER_DAY,
    overtimeMultiplier,
    maxWorkingHoursPerSession: MAX_WORKING_HOURS_HARD_CAP,
    summary: {
      employees: employeesOut.length,
      employeesPaid: paid.length,
      /** Employees with worked hours but no rate saved — these are the ones that
       *  would silently pay zero, so they are surfaced rather than absorbed. */
      missingRate: employeesOut.filter((e) => !e.hasRate && e.totalMins > 0).length,
      totalHours: round(employeesOut.reduce((s, e) => s + e.totalMins, 0) / 60),
      overtimeHours: round(employeesOut.reduce((s, e) => s + e.overtimeMins, 0) / 60),
      grossPay: round(paid.reduce((s, e) => s + e.grossPay, 0)),
      cappedSessions: employeesOut.reduce((s, e) => s + e.cappedSessions, 0),
      flaggedSessions: employeesOut.reduce((s, e) => s + e.flaggedSessions, 0),
    },
    employees: employeesOut,
  };
}

/** Per-employee monthly attendance rollup. Same records, no pricing. */
export async function computeMonthlyAttendance(opts: {
  companyId: string;
  timezone: string;
  year: number;
  month0: number;
  projectId?: string;
}) {
  const { companyId, timezone, year, month0 } = opts;
  const { from, to } = monthBounds(timezone, year, month0);

  const where: any = {
    attendanceDate: { gte: from, lt: to },
    employee: { companyId },
  };
  if (opts.projectId) where.projectId = opts.projectId;

  const records = await db.attendance.findMany({
    where,
    include: { employee: true, project: true },
    orderBy: [{ employeeId: "asc" }, { attendanceDate: "asc" }],
  });

  const byEmployee = new Map<string, any>();
  for (const r of records) {
    const key = r.employeeId;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: key,
        empId: r.employee.empId,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        avatarColor: r.employee.avatarColor,
        days: 0,
        present: 0,
        late: 0,
        totalMins: 0,
        records: [],
      });
    }
    const e = byEmployee.get(key);
    e.days++;
    if (r.attendanceStatus === "PRESENT") e.present++;
    if (r.attendanceStatus === "LATE") e.late++;
    e.totalMins += r.workingMins;
    e.records.push({
      date: formatDateInTimezone(r.attendanceDate, timezone),
      checkIn: r.checkIn?.toISOString() ?? null,
      checkOut: r.checkOut?.toISOString() ?? null,
      workingMinutes: r.workingMins,
      status: r.attendanceStatus,
    });
  }

  return {
    month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
    summary: {
      totalEmployees: byEmployee.size,
      totalRecords: records.length,
      totalMins: records.reduce((s, r) => s + r.workingMins, 0),
    },
    employees: Array.from(byEmployee.values()),
  };
}

/**
 * Persists hourly rates and the overtime multiplier.
 *
 * Validates that every id belongs to `companyId` before writing: the key is
 * derived from an id the caller supplies, so without that check a crafted body
 * could author rate rows against another tenant's employees.
 */
export async function saveSalaryRates(opts: {
  companyId: string;
  rates: Record<string, unknown>;
  overtimeMultiplier?: unknown;
}) {
  const { companyId, rates, overtimeMultiplier } = opts;
  const ids = Object.keys(rates ?? {});

  if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
    throw new Error("rates must be an object of employeeId to hourly rate");
  }

  const employees = ids.length
    ? await db.employee.findMany({
        where: { id: { in: ids }, companyId },
        select: { id: true },
      })
    : [];
  const allowed = new Set(employees.map((e) => e.id));
  const rejected = ids.filter((id) => !allowed.has(id));
  if (rejected.length) {
    throw new Error(`${rejected.length} employee(s) are not in your company`);
  }

  const ops: any[] = ids.map((id) => {
    const value = Number(rates[id]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Rate for ${id} must be a number of 0 or more`);
    }
    return db.setting.upsert({
      where: { companyId_key: { companyId, key: RATE_KEY(id) } },
      create: { companyId, key: RATE_KEY(id), value: String(value) },
      update: { value: String(value) },
    });
  });

  if (overtimeMultiplier !== undefined) {
    const mult = Number(overtimeMultiplier);
    if (!Number.isFinite(mult) || mult <= 0 || mult > 10) {
      throw new Error("overtimeMultiplier must be between 0 and 10");
    }
    ops.push(
      db.setting.upsert({
        where: { companyId_key: { companyId, key: OVERTIME_MULTIPLIER_KEY } },
        create: { companyId, key: OVERTIME_MULTIPLIER_KEY, value: String(mult) },
        update: { value: String(mult) },
      }),
    );
  }

  await db.$transaction(ops);
  return { saved: ids.length };
}
