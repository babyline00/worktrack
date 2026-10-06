"use client";

import {
  Users,
  UserCheck,
  Radio,
  UserX,
  AlertTriangle,
  Clock4,
  RefreshCw,
  Download,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EMPLOYEES,
  KPIS,
  presentPct,
  ALERTS,
  ATTENDANCE_TREND_7D,
  ATTENDANCE_TREND_30D,
  ATTENDANCE_TREND_3M,
  PROJECT_PERFORMANCE,
  formatMins,
} from "@/lib/data";
import { useApp } from "@/lib/store";
import { Avatar, Card, PageHeader, SectionTitle, StatusPill } from "../ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KPI_DEFS = [
  {
    key: "total",
    label: "Employees",
    value: KPIS.totalEmployees,
    sub: "+4.2% this month",
    icon: Users,
    tone: "info",
    target: "employees" as const,
  },
  {
    key: "present",
    label: "Present",
    value: KPIS.present,
    sub: `${presentPct()}% • today`,
    icon: UserCheck,
    tone: "success",
    target: "attendance" as const,
  },
  {
    key: "working",
    label: "Working Now",
    value: KPIS.workingNow,
    sub: "🟢 Live",
    icon: Radio,
    tone: "primary",
    target: "live" as const,
    live: true,
  },
  {
    key: "absent",
    label: "Absent",
    value: KPIS.absent,
    sub: `${((KPIS.absent / KPIS.totalEmployees) * 100).toFixed(1)}% today`,
    icon: UserX,
    tone: "danger",
    target: "attendance" as const,
  },
  {
    key: "late",
    label: "Late Today",
    value: KPIS.late,
    sub: "⚠ Attention",
    icon: Clock4,
    tone: "warning",
    target: "attendance" as const,
  },
];

const TONE_STYLES: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  success: { bg: "bg-success-soft", text: "text-success" },
  warning: { bg: "bg-warning-soft", text: "text-warning" },
  danger: { bg: "bg-danger-soft", text: "text-danger" },
  info: { bg: "bg-info-soft", text: "text-info" },
};

export function DashboardHome() {
  const { setPage, setDrawerEmployee } = useApp();
  const [trendTab, setTrendTab] = useState<"7d" | "30d" | "3m">("7d");

  const trendData =
    trendTab === "7d"
      ? ATTENDANCE_TREND_7D
      : trendTab === "30d"
        ? ATTENDANCE_TREND_30D
        : ATTENDANCE_TREND_3M;

  const donutData = [
    { name: "Present", value: KPIS.present, color: "#16a34a" },
    { name: "Late", value: KPIS.late, color: "#f59e0b" },
    { name: "On Leave", value: KPIS.leave, color: "#0ea5e9" },
    { name: "Absent", value: KPIS.absent, color: "#dc2626" },
  ];

  const liveEmployees = EMPLOYEES.filter(
    (e) => e.todaysStatus === "working" || e.todaysStatus === "break",
  ).slice(0, 6);

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Dashboard"
        date="Tuesday, October 6, 2026"
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw size={14} className="mr-2" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() =>
                toast.success("Report exported", {
                  description: "Today's dashboard report downloaded as PDF.",
                })
              }
            >
              <Download size={14} className="mr-2" /> Export Report
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {KPI_DEFS.map((kpi) => {
          const Icon = kpi.icon;
          const tone = TONE_STYLES[kpi.tone];
          return (
            <button
              key={kpi.key}
              onClick={() => setPage(kpi.target)}
              className="group text-left"
            >
              <Card className="h-full transition group-hover:border-primary/40 group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      tone.bg,
                      tone.text,
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  {kpi.live && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-success">
                      <span className="pulse-live h-1.5 w-1.5 rounded-full bg-success" />
                      Live
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="mt-1 text-[28px] font-bold leading-tight text-navy">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{kpi.sub}</p>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Live attendance + Today's status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            right={
              <button
                onClick={() => setPage("live")}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View All <ArrowRight size={12} />
              </button>
            }
          >
            <div className="flex items-center gap-2">
              <span className="pulse-live h-2 w-2 rounded-full bg-success" />
              Live Attendance
              <span className="text-xs font-normal text-muted-foreground">
                • Updated 12 seconds ago
              </span>
            </div>
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Employee</th>
                  <th className="pb-2 font-medium">Project</th>
                  <th className="hidden pb-2 font-medium sm:table-cell">
                    Check-in
                  </th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {liveEmployees.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-border/60 transition hover:bg-muted/50"
                    onClick={() => {
                      setDrawerEmployee(e.id);
                    }}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={e.initials}
                          color={e.avatarColor}
                          size={32}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">
                            {e.firstName} {e.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.empId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-sm text-muted-foreground">
                      {e.project}
                    </td>
                    <td className="hidden py-3 pr-3 text-sm text-muted-foreground sm:table-cell">
                      {e.checkIn ?? "—"}
                    </td>
                    <td className="py-3">
                      <StatusPill status={e.todaysStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle>Today's Status</SectionTitle>
          <div className="relative mx-auto h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[28px] font-bold text-navy">{presentPct()}%</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {donutData.map((d) => (
              <button
                key={d.name}
                onClick={() => setPage("attendance")}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="text-navy">{d.name}</span>
                </span>
                <span className="font-semibold text-navy">{d.value}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Attendance Trend + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            right={
              <Tabs
                value={trendTab}
                onValueChange={(v) => setTrendTab(v as any)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs">
                    7 Days
                  </TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs">
                    30 Days
                  </TabsTrigger>
                  <TabsTrigger value="3m" className="text-xs">
                    3 Months
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            Attendance Trend
          </SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  width={32}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Attendance"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2.4}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Attention Required</SectionTitle>
          <div className="space-y-2.5">
            {ALERTS.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  if (a.employee) {
                    const emp = EMPLOYEES.find(
                      (e) => e.firstName === a.employee,
                    );
                    if (emp) {
                      setPage("live");
                      setDrawerEmployee(emp.id);
                    }
                  } else {
                    setPage("attendance");
                  }
                }}
                className="flex w-full gap-3 rounded-lg border border-border p-3 text-left transition hover:border-warning/40 hover:bg-warning-soft/30"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    a.severity === "danger"
                      ? "bg-danger-soft text-danger"
                      : a.severity === "warning"
                        ? "bg-warning-soft text-warning"
                        : "bg-info-soft text-info",
                  )}
                >
                  <AlertTriangle size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Project Performance */}
      <Card>
        <SectionTitle
          right={
            <button
              onClick={() => setPage("projects")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View All Projects <ArrowRight size={12} />
            </button>
          }
        >
          Project Attendance
        </SectionTitle>
        <div className="space-y-4">
          {PROJECT_PERFORMANCE.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPage("projects");
                useApp.setState({ selectedProjectId: p.id });
              }}
              className="block w-full text-left"
            >
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-navy">{p.name}</span>
                <span className="text-muted-foreground">
                  {p.present}/{p.total} • {p.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    p.pct >= 90
                      ? "bg-success"
                      : p.pct >= 75
                        ? "bg-primary"
                        : p.pct >= 60
                          ? "bg-warning"
                          : "bg-danger",
                  )}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
