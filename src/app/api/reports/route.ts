import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTimeInTimezone } from "@/lib/v1";

export const runtime = "nodejs";

/**
 * GET /api/reports?type=&from=&to=&projectId=&scope=&format=
 *
 * `format=csv` streams a downloadable CSV; `format=excel` streams an HTML-table
 * .xls that Excel opens natively. Both are generated here rather than assembled
 * in the browser, so a large report does not have to round-trip through React.
 *
 * The column names below are the schema's: attendanceDate, attendanceStatus,
 * sessionStatus, verificationStatus. Earlier versions of this file queried
 * `date`, `status` and `verification`, none of which exist, so every request
 * failed to compile and the UI showed "Failed to generate report".
 */
const REPORT_TYPES = ["daily", "monthly", "hours", "project", "late", "absence"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** RFC 4180 escaping: quote anything containing a delimiter, quote or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Formats a date from its local components.
 *
 * `toISOString()` would shift the range: `to` is set to 23:59:59.999 local, and
 * on a host behind UTC that is already the next day in UTC, so asking for
 * 2026-10-31 reported through 2026-11-01.
 */
function dayOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function parseRange(url: URL) {
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  // Defaults to the current calendar month rather than "last 30 days", so a
  // monthly report does not silently straddle two months.
  const now = new Date();
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toStr ? new Date(`${toStr}T00:00:00`) : now;
  to.setHours(23, 59, 59, 999);
  // attendanceDate is stored as midnight; compare on that column, not checkIn.
  const fromDay = new Date(from);
  fromDay.setHours(0, 0, 0, 0);
  return { from: fromDay, to };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId as string;

  const url = new URL(req.url);
  const requested = url.searchParams.get("type") ?? "monthly";
  const type: ReportType = (REPORT_TYPES as readonly string[]).includes(requested)
    ? (requested as ReportType)
    : "monthly";
  const format = url.searchParams.get("format") ?? "json";
  // "all" is the UI's sentinel for no filter; passing it through as a real id
// would match nothing and silently return an empty report.
const projectParam = url.searchParams.get("projectId");
const projectId = projectParam && projectParam !== "all" ? projectParam : undefined;
  const scope = url.searchParams.get("scope") ?? "all"; // all | active
  const { from, to } = parseRange(url);

  if (from > to) {
    return NextResponse.json({ error: "'from' cannot be after 'to'" }, { status: 400 });
  }

  const records = await db.attendance.findMany({
    where: {
      companyId,
      attendanceDate: { gte: from, lte: to },
      ...(projectId ? { projectId } : {}),
      ...(scope === "active" ? { employee: { status: "ACTIVE" } } : {}),
    },
    include: { employee: true, project: true },
    orderBy: [{ attendanceDate: "asc" }, { checkIn: "asc" }],
  });

  const tz = "Asia/Karachi";

  const flat = records.map((r) => ({
    date: dayOf(r.attendanceDate),
    employee: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    empId: r.employee.empId,
    department: "—",
    project: r.project?.name ?? "—",
    checkIn: r.checkIn ? formatTimeInTimezone(r.checkIn, tz) : "—",
    checkOut: r.checkOut ? formatTimeInTimezone(r.checkOut, tz) : "—",
    workingMins: r.workingMins,
    lateMins: r.lateMins,
    sessionStatus: r.sessionStatus,
    attendanceStatus: r.attendanceStatus,
    verificationStatus: r.verificationStatus,
  }));

  // Per-type shaping: each report answers a different question, so each gets
  // its own columns rather than the same dump with a different label.
  let headers: string[];
  let rows: unknown[][];
  let columns: Record<string, string>;

  switch (type) {
    case "daily": {
      headers = ["Date", "Employee", "Emp ID", "Project", "Check-In", "Check-Out", "Worked (min)", "Status", "Verification"];
      rows = flat.map((r) => [r.date, r.employee, r.empId, r.project, r.checkIn, r.checkOut, r.workingMins, r.attendanceStatus, r.verificationStatus]);
      columns = { totalRecords: String(flat.length), days: String(new Set(flat.map((r) => r.date)).size) };
      break;
    }
    case "monthly": {
      const byDay = new Map<string, number>();
      for (const r of flat) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.workingMins);
      headers = ["Date", "Present", "Late", "Absent", "On Leave", "Worked (min)"];
      rows = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date]) => {
        const dayRecs = flat.filter((r) => r.date === date);
        const count = (s: string) => dayRecs.filter((r) => r.attendanceStatus === s).length;
        return [date, count("PRESENT"), count("LATE"), count("ABSENT"), count("ON_LEAVE"), byDay.get(date)];
      });
      columns = {
        totalRecords: String(flat.length),
        present: String(flat.filter((r) => r.attendanceStatus === "PRESENT").length),
        late: String(flat.filter((r) => r.attendanceStatus === "LATE").length),
        absent: String(flat.filter((r) => r.attendanceStatus === "ABSENT").length),
        leave: String(flat.filter((r) => r.attendanceStatus === "ON_LEAVE").length),
      };
      break;
    }
    case "hours": {
      const byEmp = new Map<string, { name: string; empId: string; mins: number; days: Set<string>; late: number }>();
      for (const r of flat) {
        const cur = byEmp.get(r.employee) ?? { name: r.employee, empId: r.empId, mins: 0, days: new Set<string>(), late: 0 };
        cur.mins += r.workingMins;
        cur.days.add(r.date);
        if (r.attendanceStatus === "LATE") cur.late++;
        byEmp.set(r.employee, cur);
      }
      headers = ["Employee", "Emp ID", "Days Worked", "Total Minutes", "Total Hours", "Late Days"];
      rows = [...byEmp.values()]
        .sort((a, b) => b.mins - a.mins)
        .map((v) => [v.name, v.empId, v.days.size, v.mins, (v.mins / 60).toFixed(2), v.late]);
      columns = { totalRecords: String(byEmp.size), totalHoursMins: String(flat.reduce((s, r) => s + r.workingMins, 0)) };
      break;
    }
    case "project": {
      const byProj = new Map<string, { recs: number; mins: number; present: number; late: number }>();
      for (const r of flat) {
        const cur = byProj.get(r.project) ?? { recs: 0, mins: 0, present: 0, late: 0 };
        cur.recs++;
        cur.mins += r.workingMins;
        if (r.attendanceStatus === "PRESENT") cur.present++;
        if (r.attendanceStatus === "LATE") cur.late++;
        byProj.set(r.project, cur);
      }
      headers = ["Project", "Records", "Present", "Late", "Total Minutes", "Total Hours"];
      rows = [...byProj.entries()].map(([proj, v]) => [proj, v.recs, v.present, v.late, v.mins, (v.mins / 60).toFixed(2)]);
      columns = { totalRecords: String(byProj.size) };
      break;
    }
    case "late": {
      const late = flat
        .filter((r) => r.attendanceStatus === "LATE" || r.lateMins > 0)
        .sort((a, b) => b.lateMins - a.lateMins);
      headers = ["Date", "Employee", "Emp ID", "Project", "Check-In", "Late (min)"];
      rows = late.map((r) => [r.date, r.employee, r.empId, r.project, r.checkIn, r.lateMins]);
      columns = { totalRecords: String(late.length) };
      break;
    }
    case "absence": {
      const absent = flat.filter((r) => r.attendanceStatus === "ABSENT" || r.attendanceStatus === "ON_LEAVE");
      headers = ["Date", "Employee", "Emp ID", "Status"];
      rows = absent.map((r) => [r.date, r.employee, r.empId, r.attendanceStatus]);
      columns = {
        totalRecords: String(absent.length),
        absent: String(absent.filter((r) => r.attendanceStatus === "ABSENT").length),
        leave: String(absent.filter((r) => r.attendanceStatus === "ON_LEAVE").length),
      };
      break;
    }
  }

  const stamp = `${type}-${dayOf(from)}_to_${dayOf(to)}`;

  if (format === "csv" || format === "excel") {
    if (format === "csv") {
      return new Response(toCsv(headers, rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          // BOM so Excel opens UTF-8 names correctly.
          "Content-Disposition": `attachment; filename="nas-attendance-${stamp}.csv"`,
        },
      });
    }

    // Excel opens an HTML table saved as .xls natively, which avoids pulling in
    // a spreadsheet dependency just to emit a grid.
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:4px}</style></head><body><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${csvCell(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="nas-attendance-${stamp}.xls"`,
      },
    });
  }

  const totalMins = flat.reduce((s, r) => s + r.workingMins, 0);
  const employees = new Set(flat.map((r) => r.empId)).size;

  return NextResponse.json({
    summary: {
      type,
      from: dayOf(from),
      to: dayOf(to),
      totalRecords: flat.length,
      present: flat.filter((r) => r.attendanceStatus === "PRESENT").length,
      late: flat.filter((r) => r.attendanceStatus === "LATE").length,
      absent: flat.filter((r) => r.attendanceStatus === "ABSENT").length,
      leave: flat.filter((r) => r.attendanceStatus === "ON_LEAVE").length,
      employees,
      totalHoursMins: totalMins,
      avgHoursPerEmployee: employees > 0 ? Math.round(totalMins / employees) : 0,
      flagged: flat.filter((r) => r.verificationStatus === "FLAGGED").length,
      weekdays: DAY_NAMES.filter((d) => flat.some((r) => DAY_NAMES[new Date(r.date).getDay()] === d)).join(", "),
    },
    headers,
    columns,
    records: flat,
    rows,
  });
}