"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Map as MapIcon,
  List,
  Search,
  MapPin,
  Crosshair,
  Maximize2,
  Filter,
  X,
} from "lucide-react";
import { EMPLOYEES, formatMins } from "@/lib/data";
import { useApp } from "@/lib/store";
import {
  Avatar,
  Card,
  PageHeader,
  StatusPill,
  VerificationBadge,
} from "../ui";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const { drawerEmployeeId, setDrawerEmployee, liveMapMode, setLiveMapMode } =
    useApp();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All Projects");
  const [status, setStatus] = useState("All Status");
  const [lastUpdate, setLastUpdate] = useState(12);

  const filtered = useMemo(() => {
    return EMPLOYEES.filter((e) => {
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.empId.includes(q) ||
        e.project.toLowerCase().includes(q);
      const matchProj = project === "All Projects" || e.project === project;
      const matchStatus = status === "All Status" || e.todaysStatus === status;
      return matchQuery && matchProj && matchStatus;
    });
  }, [query, project, status]);

  const drawerEmp = EMPLOYEES.find((e) => e.id === drawerEmployeeId);

  function refresh() {
    setLastUpdate(0);
    toast.success("Live data refreshed");
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Live Attendance"
        subtitle="Monitor your active workforce in real time."
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success sm:inline-flex">
              <span className="pulse-live h-2 w-2 rounded-full bg-success" />
              {filtered.filter((e) => e.todaysStatus === "working").length}{" "}
              Employees Working
            </span>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={14} className="mr-2" /> Refresh
            </Button>
            <Button
              size="sm"
              variant={liveMapMode ? "outline" : "default"}
              onClick={() => setLiveMapMode(!liveMapMode)}
            >
              {liveMapMode ? (
                <>
                  <List size={14} className="mr-2" /> List View
                </>
              ) : (
                <>
                  <MapIcon size={14} className="mr-2" /> Map View
                </>
              )}
            </Button>
          </>
        }
      />

      <p className="-mt-3 text-xs text-muted-foreground">
        Updated {lastUpdate} seconds ago
      </p>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search employee..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(query || project !== "All Projects" || status !== "All Status") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setProject("All Projects");
                setStatus("All Status");
              }}
            >
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </Card>

      {liveMapMode ? (
        <LiveMap
          employees={filtered}
          onSelect={(id) => setDrawerEmployee(id)}
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Check-In
                  </th>
                  <th className="px-4 py-3 font-medium">Working Time</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Location
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <p className="text-sm font-medium text-navy">
                        No employees match your filters
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try adjusting filters or clearing the search.
                      </p>
                    </td>
                  </tr>
                )}
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-t border-border transition hover:bg-muted/40"
                    onClick={() => setDrawerEmployee(e.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={e.initials}
                          color={e.avatarColor}
                          size={34}
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {e.project}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      {e.checkIn ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">
                      {formatMins(e.workingTimeMins)}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="text-muted-foreground" />
                        {e.location}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={e.todaysStatus} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {e.lastUpdatedSec}s ago
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDrawerEmployee(e.id);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Drawer */}
      <Sheet
        open={!!drawerEmp}
        onOpenChange={(o) => !o && setDrawerEmployee(null)}
      >
        <SheetContent className="scroll-thin w-full overflow-y-auto sm:max-w-md">
          {drawerEmp && (
            <>
              <SheetHeader>
                <SheetTitle>Employee Details</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <div className="flex flex-col items-center pt-2 text-center">
                  <Avatar
                    initials={drawerEmp.initials}
                    color={drawerEmp.avatarColor}
                    size={72}
                  />
                  <h3 className="mt-3 text-lg font-semibold text-navy">
                    {drawerEmp.firstName} {drawerEmp.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {drawerEmp.empId}
                  </p>
                  <div className="mt-2">
                    <StatusPill status={drawerEmp.todaysStatus} />
                  </div>
                </div>

                <DetailRow label="Project" value={drawerEmp.project} />
                <DetailRow label="Check-In" value={drawerEmp.checkIn ?? "—"} />
                <DetailRow
                  label="Working Time"
                  value={formatMins(drawerEmp.workingTimeMins)}
                />
                <DetailRow
                  label="Check-Out"
                  value={drawerEmp.checkOut ?? "—"}
                />

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Check-In Photo
                  </p>
                  <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                    {drawerEmp.photoCaptured ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
                            <path
                              d="M3 7a2 2 0 012-2h2l1.5-2h7L17 5h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3.5"
                              stroke="currentColor"
                              strokeWidth="1.6"
                            />
                          </svg>
                        </div>
                        <p className="text-xs">Photo captured at check-in</p>
                        <VerificationBadge
                          status={
                            drawerEmp.photoCaptured ? "verified" : "pending"
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No photo captured
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium text-navy">
                      {drawerEmp.location}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium text-navy">
                      {drawerEmp.accuracyM}m
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Geofence</span>
                    <span
                      className={cn(
                        "font-medium",
                        drawerEmp.insideGeofence
                          ? "text-success"
                          : "text-danger",
                      )}
                    >
                      {drawerEmp.insideGeofence ? "Inside" : "Outside"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coordinates</span>
                    <span className="font-mono text-xs text-navy">
                      {drawerEmp.coords.lat.toFixed(4)},{" "}
                      {drawerEmp.coords.lng.toFixed(4)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    toast.info("Opening live map…", {
                      description: `${drawerEmp.firstName}'s live location`,
                    })
                  }
                >
                  <Crosshair size={14} className="mr-2" /> View Live Location
                </Button>
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

function LiveMap({
  employees,
  onSelect,
}: {
  employees: typeof EMPLOYEES;
  onSelect: (id: string) => void;
}) {
  // Simple SVG-based map. We place markers on a stylized grid.
  const markers = employees
    .filter((e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave")
    .slice(0, 30);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="text-sm font-semibold text-navy">Live Workforce Map</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Crosshair size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>
      <div className="relative h-[480px] overflow-hidden bg-[#0f172a]">
        {/* Stylized background grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/10" />

        {/* Map markers */}
        {markers.map((e, i) => {
          const x = 10 + ((i * 73) % 80);
          const y = 12 + ((i * 137) % 70);
          const color =
            e.todaysStatus === "working"
              ? "#16a34a"
              : e.todaysStatus === "break"
                ? "#f59e0b"
                : e.todaysStatus === "checked_out"
                  ? "#94a3b8"
                  : e.todaysStatus === "late"
                    ? "#f59e0b"
                    : "#0ea5e9";
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="pulse-live absolute inset-0 -m-1 rounded-full" style={{ background: `${color}33` }} />
              <span
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ring-2 ring-white/20"
                style={{ background: color }}
              >
                {e.initials}
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-navy/90 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                {e.firstName} • {e.location}
              </span>
            </button>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-navy/80 p-3 text-[11px] text-white backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" /> Working
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" /> Break / Late
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-info" /> Leave
          </span>
        </div>

        <div className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-navy shadow">
          <p className="font-semibold">{markers.length} on map</p>
          <p className="text-muted-foreground">Click marker for details</p>
        </div>
      </div>
    </Card>
  );
}
