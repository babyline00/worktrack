"use client";

import { useMemo, useState, useCallback } from "react";
import {
  RefreshCw,
  Map as MapIcon,
  List,
  Search,
  MapPin,
  Crosshair,
  Maximize2,
  X,
  Navigation,
  User as UserIcon,
} from "lucide-react";
import { useEmployees, useDashboard } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import {
  Avatar,
  Card,
  PageHeader,
  StatusPill,
  VerificationBadge,
} from "../ui";
import { RealMap } from "../real-map";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtimeUpdates } from "@/lib/realtime";

const PROJECT_OPTIONS = [
  "All Projects",
  "Dubai Home Technical",
  "ABC Construction",
  "Client XYZ",
  "Marina Maintenance",
];

const STATUS_OPTIONS = [
  "All Status",
  "working",
  "break",
  "checked_out",
  "late",
  "absent",
  "leave",
];

export function LiveAttendancePage() {
  const { drawerEmployeeId, setDrawerEmployee, liveMapMode, setLiveMapMode } = useApp();
  const { data: empData, isLoading, refetch, isFetching } = useEmployees();
  const { data: dashData, refetch: refetchDash } = useDashboard();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All Projects");
  const [status, setStatus] = useState("All Status");
  const [lastUpdate, setLastUpdate] = useState(0);

  const onUpdate = useCallback(() => {
    refetch();
    refetchDash();
    setLastUpdate(0);
  }, [refetch, refetchDash]);
  const connected = useRealtimeUpdates("live-attendance", onUpdate);

  const employees = empData?.employees ?? [];

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = query.toLowerCase();
      const matchQuery = !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.empId.includes(q) || e.project.toLowerCase().includes(q);
      const matchProj = project === "All Projects" || e.project === project;
      const matchStatus = status === "All Status" || e.todaysStatus === status;
      return matchQuery && matchProj && matchStatus;
    });
  }, [employees, query, project, status]);

  const drawerEmp = employees.find((e) => e.id === drawerEmployeeId);

  function refresh() {
    refetch();
    refetchDash();
    setLastUpdate(0);
    toast.success("Live data refreshed");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live Attendance" subtitle="Loading…" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const workingCount = filtered.filter((e) => e.todaysStatus === "working").length;

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Live Attendance"
        subtitle="Monitor your active workforce in real time."
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success sm:inline-flex">
              <span className={cn("h-2 w-2 rounded-full bg-success", connected && "pulse-live")} />
              {workingCount} Employees Working
            </span>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={14} className={cn("mr-2", isFetching && "animate-spin")} /> Refresh
            </Button>
            <Button size="sm" variant={liveMapMode ? "outline" : "default"} onClick={() => setLiveMapMode(!liveMapMode)}>
              {liveMapMode ? (<><List size={14} className="mr-2" /> List View</>) : (<><MapIcon size={14} className="mr-2" /> Map View</>)}
            </Button>
          </>
        }
      />

      <p className="-mt-3 text-xs text-muted-foreground">
        Updated {lastUpdate}s ago • {connected ? "🔴 Live" : "Offline"}
      </p>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employee..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_OPTIONS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>))}
            </SelectContent>
          </Select>
          {(query || project !== "All Projects" || status !== "All Status") && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setProject("All Projects"); setStatus("All Status"); }}>
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </Card>

      {liveMapMode ? (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-semibold text-navy">Live Workforce Map</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Crosshair size={14} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize2 size={14} /></Button>
            </div>
          </div>
          <div className="p-3">
            <RealMap
              markers={filtered
                .filter((e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave" && e.coords.lat && e.coords.lng)
                .map((e) => ({
                  id: e.id,
                  lat: e.coords.lat,
                  lng: e.coords.lng,
                  initials: e.initials,
                  color: e.todaysStatus === "working" ? "#16a34a" : e.todaysStatus === "break" ? "#f59e0b" : e.todaysStatus === "late" ? "#f59e0b" : "#94a3b8",
                  label: `${e.firstName} ${e.lastName}`,
                  description: `${e.project} • ${e.todaysStatus}`,
                  type: "employee" as const,
                }))}
              height={480}
              zoom={11}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Check-In</th>
                  <th className="px-4 py-3 font-medium">Working Time</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Location</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Last Updated</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-navy">No employees match your filters</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or clearing the search.</p>
                  </td></tr>
                )}
                {filtered.map((e) => (
                  <tr key={e.id} className="cursor-pointer border-t border-border transition hover:bg-muted/40" onClick={() => setDrawerEmployee(e.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={e.initials} color={e.avatarColor} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-muted-foreground">{e.empId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{e.project}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{e.checkIn ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{formatMins(e.workingTimeMins)}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-muted-foreground" />{e.location}</span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={e.todaysStatus as any} /></td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{e.lastUpdatedSec}s ago</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); setDrawerEmployee(e.id); }}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={!!drawerEmp} onOpenChange={(o) => !o && setDrawerEmployee(null)}>
        <SheetContent className="scroll-thin w-full overflow-y-auto sm:max-w-md">
          {drawerEmp && (
            <>
              <SheetHeader><SheetTitle>Employee Details</SheetTitle></SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <div className="flex flex-col items-center pt-2 text-center">
                  <Avatar initials={drawerEmp.initials} color={drawerEmp.avatarColor} size={72} />
                  <h3 className="mt-3 text-lg font-semibold text-navy">{drawerEmp.firstName} {drawerEmp.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{drawerEmp.empId}</p>
                  <div className="mt-2"><StatusPill status={drawerEmp.todaysStatus as any} /></div>
                </div>

                <DetailRow label="Project" value={drawerEmp.project} />
                <DetailRow label="Check-In" value={drawerEmp.checkIn ?? "—"} />
                <DetailRow label="Working Time" value={formatMins(drawerEmp.workingTimeMins)} />
                <DetailRow label="Check-Out" value={drawerEmp.checkOut ?? "—"} />

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Check-In Photo</p>
                  <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                    {drawerEmp.photoCaptured ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
                            <path d="M3 7a2 2 0 012-2h2l1.5-2h7L17 5h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" />
                            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </div>
                        <p className="text-xs">Photo captured at check-in</p>
                        <VerificationBadge status={drawerEmp.photoCaptured ? "verified" : "pending"} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No photo captured</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium text-navy">{drawerEmp.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium text-navy">{drawerEmp.accuracyM}m</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Geofence</span>
                    <span className={cn("font-medium", drawerEmp.insideGeofence ? "text-success" : "text-danger")}>
                      {drawerEmp.insideGeofence ? "Inside" : "Outside"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coordinates</span>
                    <span className="font-mono text-xs text-navy">{drawerEmp.coords.lat.toFixed(4)}, {drawerEmp.coords.lng.toFixed(4)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDrawerEmployee(null);
                      useApp.setState({ selectedEmployeeId: drawerEmp.id, page: "employees" });
                    }}
                  >
                    <UserIcon size={14} className="mr-2" /> Employee
                  </Button>
                  <Button
                    variant={showLiveMap ? "default" : "outline"}
                    onClick={() => setShowLiveMap(!showLiveMap)}
                  >
                    {showLiveMap ? <X size={14} className="mr-2" /> : <Navigation size={14} className="mr-2" />}
                    {showLiveMap ? "Hide Map" : "Live Map"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function formatMins(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
