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
import { useState, useCallback, useEffect } from "react";
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
import { useDashboard, useProjects } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { Avatar, Card, PageHeader, SectionTitle, StatusPill } from "../ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtimeUpdates } from "@/lib/realtime";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data, isLoading, refetch, isFetching } = useDashboard();
  const { data: projData } = useProjects();
  const [lastUpdate, setLastUpdate] = useState(0);

  // Real-time: refresh dashboard on incoming events
  const onUpdate = useCallback(() => {
    refetch();
    setLastUpdate(0);
  }, [refetch]);
  const connected = useRealtimeUpdates("dashboard", onUpdate);

  // Heartbeat tick for "updated X seconds ago"
  useEffect(() => {
    const t = setInterval(() => setLastUpdate((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" date="Loading…" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const KPI_DEFS = [
    { key: "total", label: "Employees", value: k.totalEmployees, sub: "Active workforce", icon: Users, tone: "info", target: "employees" as const },
    { key: "present", label: "Present", value: k.present, sub: `${k.presentPct}% • today`, icon: UserCheck, tone: "success", target: "attendance" as const },
    { key: "working", label: "Working Now", value: k.workingNow, sub: "🟢 Live", icon: Radio, tone: "primary", target: "live" as const, live: true },
    { key: "absent", label: "Absent", value: k.absent, sub: `${k.totalEmployees > 0 ? ((k.absent / k.totalEmployees) * 100).toFixed(1) : 0}% today`, icon: UserX, tone: "danger", target: "attendance" as const },
    { key: "late", label: "Late Today", value: k.late, sub: "⚠ Attention", icon: Clock4, tone: "warning", target: "attendance" as const },
  ];

  const liveEmployees = data.liveAttendance;
  const projectPerf = data.projectPerformance;
  const projects = projData?.projects ?? [];

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Dashboard"
        date={`Tuesday, October 6, 2026 • ${connected ? "🔴 Live" : "Offline"}`}
        actions={
          <>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Updated {lastUpdate}s ago
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                setLastUpdate(0);
                toast.success("Dashboard refreshed");
              }}
            >
              <RefreshCw size={14} className={cn("mr-2", isFetching && "animate-spin")} /> Refresh
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
            <button key={kpi.key} onClick={() => setPage(kpi.target)} className="group text-left">
              <Card className="h-full transition group-hover:border-primary/40 group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone.bg, tone.text)}>
                    <Icon size={18} />
                  </span>
                  {kpi.live && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-success">
                      <span className="pulse-live h-1.5 w-1.5 rounded-full bg-success" />
                      Live
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-[28px] font-bold leading-tight text-navy">{kpi.value}</p>
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
                • Updated {lastUpdate}s ago
              </span>
            </div>
          </SectionTitle>
          {liveEmployees.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No employees working right now
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Project</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Check-in</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveEmployees.map((e: any) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-border/60 transition hover:bg-muted/50"
                      onClick={() => setDrawerEmployee(e.id)}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={e.employeeInitials} color={e.avatarColor} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-navy">{e.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{e.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-sm text-muted-foreground">{e.project}</td>
                      <td className="hidden py-3 pr-3 text-sm text-muted-foreground sm:table-cell">{e.checkIn}</td>
                      <td className="py-3"><StatusPill status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Today's Status</SectionTitle>
          <div className="relative mx-auto h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.donut} cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={2} dataKey="value" stroke="none">
                  {data.donut.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[28px] font-bold text-navy">{k.presentPct}%</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.donut.map((d: any) => (
              <button
                key={d.name}
                onClick={() => setPage("attendance")}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
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
              <Tabs value={trendTab} onValueChange={(v) => setTrendTab(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs">7 Days</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            Attendance Trend (Last 7 Days)
          </SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} width={32} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Attendance"]}
                />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.4} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Attention Required</SectionTitle>
          <div className="space-y-2.5">
            {data.alerts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                ✅ No alerts — everything looks good!
              </p>
            )}
            {data.alerts.map((a: any) => (
              <button
                key={a.id}
                onClick={() => {
                  if (a.employee) {
                    setPage("live");
                    // try to find employee by first name
                    const emp = liveEmployees.find((e: any) => e.employeeName?.startsWith(a.employee));
                    if (emp) setDrawerEmployee(emp.id);
                  } else {
                    setPage("attendance");
                  }
                }}
                className="flex w-full gap-3 rounded-lg border border-border p-3 text-left transition hover:border-warning/40 hover:bg-warning-soft/30"
              >
                <span className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  a.severity === "danger" ? "bg-danger-soft text-danger" : a.severity === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info",
                )}>
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
            <button onClick={() => setPage("projects")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View All Projects <ArrowRight size={12} />
            </button>
          }
        >
          Project Attendance
        </SectionTitle>
        <div className="space-y-4">
          {projectPerf.map((p: any) => (
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
                <span className="text-muted-foreground">{p.present}/{p.total} • {p.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    p.pct >= 90 ? "bg-success" : p.pct >= 75 ? "bg-primary" : p.pct >= 60 ? "bg-warning" : "bg-danger",
                  )}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </button>
          ))}
          {projectPerf.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No projects yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
