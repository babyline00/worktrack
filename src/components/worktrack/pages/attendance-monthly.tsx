"use client";

// Monthly attendance records, shown inside the Attendance page.
//
// Reads /api/v1/reports/attendance/monthly, which aggregates the same
// Attendance rows the daily view shows. Nothing here is derived client-side, so
// a total on this screen always reconciles with the daily screen it came from.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Avatar, Card, StatusPill } from "../ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MonthRecord = {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number;
  status: string;
};

type MonthEmployee = {
  employeeId: string;
  empId: string;
  name: string;
  avatarColor: string | null;
  days: number;
  present: number;
  late: number;
  totalMins: number;
  records: MonthRecord[];
};

type MonthPayload = {
  month: string;
  summary: { totalEmployees: number; totalRecords: number; totalMins: number };
  employees: MonthEmployee[];
};

/** Current month as `YYYY-MM` in the browser's own calendar. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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

function formatMins(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function AttendanceMonthly() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<MonthPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      // The cookie-session twin, not the /v1 JWT route: the admin UI carries a
      // NextAuth cookie and no bearer token, so /api/v1 would answer 401.
      const res = await fetch(`/api/attendance/monthly?month=${m}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "Could not load monthly records");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const sorted = useMemo(() => {
    const list = data?.employees ?? [];
    // Most hours first: the people who need reviewing are at the top.
    return [...list].sort((a, b) => b.totalMins - a.totalMins);
  }, [data]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </Button>
        <div className="flex items-center gap-2 font-medium">
          <CalendarDays size={15} className="text-muted-foreground" />
          {monthLabel(month)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </Button>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setDate(1);
              d.setMonth(d.getMonth() - i);
              const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              return (
                <SelectItem key={v} value={v}>
                  {monthLabel(v)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
          This month
        </Button>

        {data && (
          <div className="ml-auto flex gap-5 text-sm">
            <Stat label="Employees" value={String(data.summary.totalEmployees)} />
            <Stat label="Records" value={String(data.summary.totalRecords)} />
            <Stat label="Total time" value={formatMins(data.summary.totalMins)} />
          </div>
        )}
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertTriangle size={15} /> {error}
        </Card>
      )}

      {loading && !data && (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading {monthLabel(month)}…
        </Card>
      )}

      {!loading && !error && sorted.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No attendance recorded for {monthLabel(month)}.
        </Card>
      )}

      {sorted.map((e) => {
        const isOpen = expanded === e.employeeId;
        return (
          <Card key={e.employeeId} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : e.employeeId)}
              className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-muted/40"
            >
              <Avatar initials={initialsOf(e.name)} color={e.avatarColor ?? FALLBACK_AVATAR_COLOR} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.empId}</div>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <Stat label="Days" value={String(e.days)} />
                <Stat label="Present" value={String(e.present)} />
                <Stat label="Late" value={String(e.late)} />
                <Stat label="Time" value={formatMins(e.totalMins)} />
              </div>
            </button>

            {isOpen && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">In</th>
                      <th className="p-3 font-medium">Out</th>
                      <th className="p-3 font-medium">Worked</th>
                      <th className="p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.records.map((r, i) => (
                      <tr key={`${r.date}-${i}`} className="border-b last:border-0">
                        <td className="p-3">{r.date}</td>
                        <td className="p-3 text-muted-foreground">
                          {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "—"}
                        </td>
                        <td className="p-3">{formatMins(r.workingMinutes)}</td>
                        <td className="p-3">
                          <StatusPill status={r.status as any} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
