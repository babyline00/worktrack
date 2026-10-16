"use client";

// Salary calculator.
//
// Reads /api/v1/reports/salary, which computes pay from the *same*
// Attendance.workingMins the daily screen shows — nothing is re-derived here,
// so a supervisor comparing the two sees the same hours.
//
// Two things are deliberately loud rather than silent:
//   - an employee with worked hours but no saved rate shows as "No rate set"
//     and contributes nothing to the company total, instead of quietly paying 0
//   - a session closed by a rule (8-hour cap, geofence, abandoned) is badged,
//     because that is time nobody actually confirmed

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePoundSterling,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  ShieldAlert,
} from "lucide-react";
import { Avatar, Card } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type SalaryRecord = {
  date: string;
  project: string | null;
  workingMinutes: number;
  overtimeMinutes: number;
  status: string;
  autoClosed: string | null;
};

type SalaryEmployee = {
  employeeId: string;
  empId: string;
  name: string;
  designation: string | null;
  avatarColor: string | null;
  days: number;
  present: number;
  late: number;
  leaveDays: number;
  totalHours: number;
  ordinaryHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
  hasRate: boolean;
  cappedSessions: number;
  flaggedSessions: number;
  records: SalaryRecord[];
};

type SalaryPayload = {
  month: string;
  currency: string;
  standardHoursPerDay: number;
  overtimeMultiplier: number;
  maxWorkingHoursPerSession: number;
  summary: {
    employees: number;
    employeesPaid: number;
    missingRate: number;
    totalHours: number;
    overtimeHours: number;
    grossPay: number;
    cappedSessions: number;
    flaggedSessions: number;
  };
  employees: SalaryEmployee[];
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Initials for the avatar, matching the sidebar's convention. */
function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** Employees with no colour stored still need one, or the avatar is invisible. */
const FALLBACK_AVATAR_COLOR = "#64748b";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const AUTO_CLOSE_REASON: Record<string, string> = {
  AUTO_MAX_HOURS: "8-hour cap",
  AUTO_GEOFENCE: "geofence",
  AUTO_STALE_SESSION: "no check-out",
};

export function SalaryCalculator() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<SalaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Draft rates, keyed by employee id. Kept separate from `data` so typing does
  // not require a round trip, and so an unsaved edit is visible as such.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [multiplier, setMultiplier] = useState<string>("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      // Cookie-session twin of /api/v1/reports/salary — same lib computation,
      // but the admin UI has no bearer token to send the v1 route.
      const res = await fetch(`/api/attendance/salary?month=${m}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      setData(json);
      setMultiplier(String(json.overtimeMultiplier));
    } catch (e: any) {
      setError(e?.message ?? "Could not load salary data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const rows = useMemo(() => {
    const list = data?.employees ?? [];
    return [...list].sort((a, b) => {
      // Employees who need attention first: hours but no rate.
      if (a.hasRate !== b.hasRate) return a.hasRate ? 1 : -1;
      return b.grossPay - a.grossPay;
    });
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const multChanged = Number(multiplier) !== data.overtimeMultiplier;
    const anyDraft = Object.entries(drafts).some(([id, v]) => {
      const emp = data.employees.find((e) => e.employeeId === id);
      return emp && Number(v) !== emp.hourlyRate;
    });
    return multChanged || anyDraft;
  }, [data, drafts, multiplier]);

  async function saveRates() {
    if (!data) return;
    const rates: Record<string, number> = {};
    for (const [id, v] of Object.entries(drafts)) {
      const emp = data.employees.find((e) => e.employeeId === id);
      if (emp && Number(v) !== emp.hourlyRate) rates[id] = Number(v);
    }
    const mult = Number(multiplier);
    if (!Object.keys(rates).length && mult === data.overtimeMultiplier) return;

    setSaving(true);
    try {
      const res = await fetch("/api/attendance/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates, overtimeMultiplier: mult }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Save failed (${res.status})`);
      }
      setDrafts({});
      toast.success("Rates saved");
      await load(month);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save rates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
          <ChevronLeft size={14} />
        </Button>
        <div className="flex items-center gap-2 font-medium">
          <CalendarDays size={15} className="text-muted-foreground" />
          {monthLabel(month)}
        </div>
        <Button variant="outline" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
          <ChevronRight size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
          This month
        </Button>

        <div className="ml-auto flex items-end gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Overtime ×</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="h-9 w-[90px]"
            />
          </div>
          <Button size="sm" onClick={saveRates} disabled={!dirty || saving} className="h-9">
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
            Save rates
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertTriangle size={15} /> {error}
        </Card>
      )}

      {loading && !data && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Calculating {monthLabel(month)}…
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={`Gross payroll (${data.currency})`}
              value={data.summary.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              hint={`${data.summary.employeesPaid} of ${data.summary.employees} employees have a rate`}
              icon={<BadgePoundSterling size={15} />}
            />
            <SummaryCard
              label="Hours worked"
              value={`${data.summary.totalHours}h`}
              hint={`${data.summary.overtimeHours}h overtime at ×${data.overtimeMultiplier}`}
              icon={<CalendarDays size={15} />}
            />
            <SummaryCard
              label="Missing rates"
              value={String(data.summary.missingRate)}
              hint={data.summary.missingRate ? "These would pay zero" : "All set"}
              warn={data.summary.missingRate > 0}
              icon={<AlertTriangle size={15} />}
            />
            <SummaryCard
              label="Auto-closed sessions"
              value={String(data.summary.cappedSessions)}
              hint={`${data.summary.flaggedSessions} flagged for review`}
              warn={data.summary.cappedSessions > 0}
              icon={<ShieldAlert size={15} />}
            />
          </div>

          {data.summary.missingRate > 0 && (
            <Card className="flex items-start gap-2 border-warning/40 bg-warning-soft/40 p-4 text-sm">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {data.summary.missingRate} employee(s) worked hours this month but have no
                hourly rate saved. Their hours are listed below and are excluded from the
                gross total — set a rate to include them.
              </span>
            </Card>
          )}

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium">Days</th>
                  <th className="p-3 font-medium">Hours</th>
                  <th className="p-3 font-medium">Overtime</th>
                  <th className="p-3 font-medium">Rate/hr</th>
                  <th className="p-3 text-right font-medium">Gross pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const isOpen = expanded === e.employeeId;
                  return (
                    <RowGroup
                      key={e.employeeId}
                      emp={e}
                      open={isOpen}
                      onToggle={() => setExpanded(isOpen ? null : e.employeeId)}
                      draft={drafts[e.employeeId]}
                      onDraft={(v) =>
                        setDrafts((d) => ({ ...d, [e.employeeId]: v }))
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-muted-foreground">
            Overtime is counted per day: anything over {data.standardHoursPerDay} hours on a
            single day is charged at the multiplier. A single session is closed automatically
            at {data.maxWorkingHoursPerSession} hours. Hours come from recorded attendance
            only — nothing here is estimated.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  warn,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card className={warn ? "border-warning/40 p-4" : "p-4"}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={warn ? "mt-1 text-2xl font-semibold text-warning" : "mt-1 text-2xl font-semibold"}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}

function RowGroup({
  emp,
  open,
  onToggle,
  draft,
  onDraft,
}: {
  emp: SalaryEmployee;
  open: boolean;
  onToggle: () => void;
  draft?: string;
  onDraft: (v: string) => void;
}) {
  const [local, setLocal] = useState(draft ?? String(emp.hourlyRate));
  useEffect(() => {
    setLocal(draft ?? String(emp.hourlyRate));
  }, [draft, emp.hourlyRate]);

  return (
    <>
      <tr
        className="cursor-pointer border-b transition hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="p-3">
          <div className="flex items-center gap-2">
            <Avatar initials={initialsOf(emp.name)} color={emp.avatarColor ?? FALLBACK_AVATAR_COLOR} />
            <div className="min-w-0">
              <div className="truncate font-medium">{emp.name}</div>
              <div className="text-xs text-muted-foreground">
                {emp.empId}
                {emp.cappedSessions > 0 && (
                  <span className="ml-2 text-warning">
                    · {emp.cappedSessions} auto-closed
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="p-3">{emp.days}</td>
        <td className="p-3">{emp.totalHours}h</td>
        <td className="p-3">
          {emp.overtimeHours > 0 ? (
            <span className="text-warning">{emp.overtimeHours}h</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            min="0"
            step="50"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onDraft(e.target.value);
            }}
            className="h-8 w-[100px]"
            placeholder="0"
          />
        </td>
        <td className="p-3 text-right font-medium">
          {emp.hasRate ? (
            emp.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })
          ) : (
            <span className="text-xs font-normal text-warning">No rate set</span>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b bg-muted/20">
          <td colSpan={6} className="p-3">
            {emp.records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records this month.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2 font-medium">Date</th>
                    <th className="p-2 font-medium">Project</th>
                    <th className="p-2 font-medium">Worked</th>
                    <th className="p-2 font-medium">Overtime</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.records.map((r, i) => (
                    <tr key={`${r.date}-${i}`}>
                      <td className="p-2">{r.date}</td>
                      <td className="p-2 text-muted-foreground">{r.project ?? "—"}</td>
                      <td className="p-2">{r.workingMinutes}m</td>
                      <td className="p-2">
                        {r.overtimeMinutes ? (
                          <span className="text-warning">{r.overtimeMinutes}m</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2 text-muted-foreground">
                        {r.autoClosed
                          ? `Closed by ${AUTO_CLOSE_REASON[r.autoClosed] ?? r.autoClosed}`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
