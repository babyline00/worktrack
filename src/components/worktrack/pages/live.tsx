"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
  ImageOff,
  LogIn,
  LogOut,
  UserCheck,
  UserX,
  AlertCircle,
} from "lucide-react";
import { useEmployees, useDashboard, useProjects, type AttendanceLeg } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import {
  Avatar,
  Card,
  PageHeader,
  StatusPill,
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
import { cn, attendancePhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtimeUpdates } from "@/lib/realtime";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Sentinel for "no project filter". Not a project name — real names come
 *  from the database below. */
const ALL_PROJECTS = "All Projects";

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
  // Real project names from the database. This replaces a hardcoded list that
  // named projects which never existed ("Dubai Home Technical", "Client XYZ")
  // and, worse, could never match the `e.project` strings it was compared
  // against — so selecting any project always produced an empty table.
  const { data: projData } = useProjects();
  const [query, setQuery] = useState("");
  // The selected project is held by id, not by name. Employee rows carry a
  // project *name*, so a name-keyed filter silently stopped matching the
  // moment two projects shared a name — and could not distinguish a project
  // that had been renamed.
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [status, setStatus] = useState("All Status");
  const [lastUpdate, setLastUpdate] = useState(0);
  const [showLiveMap, setShowLiveMap] = useState(false);
  // Admin check-in/out state
  const [adminAction, setAdminAction] = useState<{ type: "checkin" | "checkout"; employee: any } | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const onUpdate = useCallback(() => {
    refetch();
    refetchDash();
    setLastUpdate(0);
  }, [refetch, refetchDash]);
  const connected = useRealtimeUpdates("live-attendance", onUpdate);

  const employees = empData?.employees ?? [];
  const projects = projData?.projects ?? [];

  // Admin check-in/out functions
  const handleAdminCheckIn = useCallback(async (employee: typeof employees[0]) => {
    // Allow check-in even if already checked in (will create new session or use admin override)
    const projectIdToUse = employee.projectIds?.[0];
    if (!projectIdToUse) {
      toast.error("Employee has no assigned project");
      return;
    }
    // Use project coordinates or employee's last known location
    const project = projects.find(p => p.id === projectIdToUse);
    if (!project?.coords?.lat || !project?.coords?.lng) {
      toast.error("Project has no coordinates configured");
      return;
    }
    setAdminAction({ type: "checkin", employee });
  }, [employees, projects]);

  const handleAdminCheckOut = useCallback(async (employee: typeof employees[0]) => {
    // Allow check-out even if not currently "working" - use admin override
    try {
      const res = await fetch(`/api/attendance?employeeId=${employee.id}&status=working`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success || !data.data?.length) {
        // Try to find any recent session to check out
        const res2 = await fetch(`/api/attendance?employeeId=${employee.id}&limit=1`, {
          credentials: "include",
        });
        const data2 = await res2.json();
        if (!data2.success || !data2.data?.length) {
          toast.error("No session found to check out");
          return;
        }
        const attendance = data2.data[0];
        if (attendance.sessionStatus === "COMPLETED" || attendance.sessionStatus === "COMPLETED") {
          // Session already completed - ask if they want to force check-out
          // For now, we'll allow force check-out via admin override
        }
        setAdminAction({ type: "checkout", employee: { ...employee, attendanceId: attendance.id, projectCoords: project?.coords } });
        return;
      }
      const attendance = data.data[0];
      // Use project coordinates or employee's last known location
      const project = projects.find(p => p.id === attendance.projectId);
      setAdminAction({ type: "checkout", employee: { ...employee, attendanceId: attendance.id, projectCoords: project?.coords } });
    } catch {
      toast.error("Failed to find open session");
    }
  }, [employees, projects]);

  const executeAdminAction = useCallback(async (lat: number, lng: number, accuracy: number) => {
    if (!adminAction) return;
    setIsAdminLoading(true);
    try {
      const endpoint = "/api/v1/admin/attendance/override";
      const action = adminAction.type === "checkin" ? "check_in" : "check_out";
      const body = adminAction.type === "checkin"
        ? { 
            employeeId: adminAction.employee.id, 
            projectId: adminAction.employee.projectIds?.[0], 
            latitude: lat, 
            longitude: lng, 
            accuracy,
            action: "check_in"
          }
        : { 
            attendanceId: (adminAction.employee as any).attendanceId, 
            latitude: lat, 
            longitude: lng, 
            accuracy,
            action: "check_out"
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${adminAction.type === "checkin" ? "Checked in" : "Checked out"} ${adminAction.employee.firstName} ${adminAction.employee.lastName}`);
        setAdminAction(null);
        refetch();
        refetchDash();
      } else {
        toast.error(data.error?.message || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsAdminLoading(false);
    }
  }, [adminAction, refetch, refetchDash]);

  // Projects that actually have someone assigned to them, ordered as returned.
  // Listing every project would fill the dropdown with sites nobody works at,
  // which reads as "the filter is broken" rather than "no staff there yet".
  const projectOptions = useMemo(
    () => projects.filter((p) => employees.some((e) => e.projectIds?.includes(p.id))),
    [projects, employees],
  );

  const selectedProjectName = useMemo(
    () => projects.find((p) => p.id === projectId)?.name,
    [projects, projectId],
  );

  // A renamed or deleted project must not leave the table permanently empty.
  const projectFilterStale =
    projectId !== ALL_PROJECTS && !!projects.length && !projects.some((p) => p.id === projectId);

  useEffect(() => {
    if (projectFilterStale) setProjectId(ALL_PROJECTS);
  }, [projectFilterStale]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = query.toLowerCase();
      const matchQuery = !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.empId.includes(q) || e.project.toLowerCase().includes(q);
      // Match on the assignment id, not the display name: an employee can hold
      // several assignments and `project` only shows the first one.
      const matchProj = projectId === ALL_PROJECTS || !!e.projectIds?.includes(projectId);
      const matchStatus = status === "All Status" || e.todaysStatus === status;
      return matchQuery && matchProj && matchStatus;
    });
  }, [employees, query, projectId, status]);

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
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All Projects</SelectItem>
              {projectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>
                </SelectItem>
              ))}
              {projectOptions.length === 0 && (
                <SelectItem value="none" disabled>
                  No projects with assigned staff
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>))}
            </SelectContent>
          </Select>
          {(query || projectId !== ALL_PROJECTS || status !== "All Status") && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setProjectId(ALL_PROJECTS); setStatus("All Status"); }}>
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
          {projectFilterStale && (
            <p className="w-full text-xs text-muted-foreground">
              The selected project is no longer available — showing all projects.
            </p>
          )}
        </div>
      </Card>

      {liveMapMode ? (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-semibold text-navy">Live Workforce Map</p>
            <div className="flex items-center gap-2">
              {/* The two icon buttons here did nothing at all. Replaced with the
                  one number that was actually missing. */}
              <span className="text-xs text-muted-foreground">
                {filtered.filter((e) => e.coords.lat && e.coords.lng).length} of {filtered.length} located
              </span>
            </div>
          </div>
          <div className="p-3">
            {/* The geofence circle is only meaningful for one project at a time.
                Without a project selected it would draw every site's radius over
                the map and misattribute employee positions. */}
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
              geofence={
                projectId !== ALL_PROJECTS
                  ? (() => {
                      const p = projects.find((x) => x.id === projectId);
                      return p && p.coords.lat && p.coords.lng
                        ? { lat: p.coords.lat, lng: p.coords.lng, radiusM: p.radiusM, name: p.name }
                        : undefined;
                    })()
                  : undefined
              }
              height={480}
              zoom={11}
              className="isolate"
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
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Check-Out</th>
                  <th className="px-4 py-3 font-medium">Working Time</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Location</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Last Updated</th>
                  <th className="px-4 py-3 font-medium">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center">
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
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">{e.checkOut ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{formatMins(e.workingTimeMins)}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-muted-foreground" />{e.location}</span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={e.todaysStatus as any} /></td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{e.lastUpdatedSec}s ago</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); setDrawerEmployee(e.id); }}>View</Button>
                        {e.todaysStatus === "working" ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(ev) => { ev.stopPropagation(); handleAdminCheckOut(e); }}
                            disabled={isAdminLoading}
                          >
                            <LogOut size={12} className="mr-1" /> Check Out
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(ev) => { ev.stopPropagation(); handleAdminCheckIn(e); }}
                            disabled={isAdminLoading || !e.projectIds?.length}
                          >
                            <LogIn size={12} className="mr-1" /> Check In
                          </Button>
                        )}
                      </div>
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
                <DetailRow label="Working Time" value={formatMins(drawerEmp.workingTimeMins)} />

                {/* Both legs of the session side by side: the check-in and
                    check-out time, GPS and geofence verdict each. */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Check-In &amp; Check-Out
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <LegCard title="Check-In" leg={drawerEmp.checkInDetail} />
                    <LegCard title="Check-Out" leg={drawerEmp.checkOutDetail} />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Selfies</p>
                  <div className="grid grid-cols-2 gap-3">
                    <PhotoTile
                      label="Check-In"
                      photoUrl={attendancePhotoUrl(drawerEmp.checkInDetail?.photoId)}
                    />
                    <PhotoTile
                      label="Check-Out"
                      photoUrl={attendancePhotoUrl(drawerEmp.checkOutDetail?.photoId)}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current Position
                  </p>
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

                {/* Admin Check-In/Out from drawer */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {drawerEmp.todaysStatus === "working" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDrawerEmployee(null);
                        handleAdminCheckOut(drawerEmp);
                      }}
                      disabled={isAdminLoading}
                      className="h-10"
                    >
                      <LogOut size={12} className="mr-1" /> Check Out
                    </Button>
                  ) : drawerEmp.projectIds?.length ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setDrawerEmployee(null);
                        handleAdminCheckIn(drawerEmp);
                      }}
                      disabled={isAdminLoading}
                      className="h-10"
                    >
                      <LogIn size={12} className="mr-1" /> Check In
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="h-10"
                    >
                      No Project
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Admin Check-In/Out Confirmation Dialog */}
      {adminAction && (
        <Dialog open={true} onOpenChange={(open) => !open && setAdminAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {adminAction.type === "checkin" ? (
                  <>Admin Check-In: <span className="font-normal">{adminAction.employee.firstName} {adminAction.employee.lastName}</span></>
                ) : (
                  <>Admin Check-Out: <span className="font-normal">{adminAction.employee.firstName} {adminAction.employee.lastName}</span></>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Admin Action
                </span>
                <span className="text-xs text-muted-foreground">
                  {adminAction.type === "checkin"
                    ? "Employee will be marked as working"
                    : "Session will be closed"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {adminAction.type === "checkin"
                  ? "Confirm check-in using project location."
                  : "Confirm check-out using employee's last known location."}
              </p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">GPS Accuracy (meters)</label>
                <Input
                  type="number"
                  defaultValue={adminAction.type === "checkin"
                    ? "10"
                    : adminAction.employee.accuracyM?.toString() || "10"}
                  placeholder="GPS Accuracy"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setAdminAction(null)} disabled={isAdminLoading}>
                  Cancel
                </Button>
                <Button
                  variant={adminAction.type === "checkin" ? "default" : "destructive"}
                  onClick={() => {
                    const lat = adminAction.type === "checkin"
                      ? adminAction.employee.projectCoords?.lat || adminAction.employee.coords?.lat || 0
                      : adminAction.employee.coords?.lat || 0;
                    const lng = adminAction.type === "checkin"
                      ? adminAction.employee.projectCoords?.lng || adminAction.employee.coords?.lng || 0
                      : adminAction.employee.coords?.lng || 0;
                    const acc = 10;
                    if (lat && lng) executeAdminAction(lat, lng, acc);
                  }}
                  disabled={isAdminLoading}
                >
                  {isAdminLoading ? (
                    <>Processing... <RefreshCw size={14} className="ml-2 animate-spin" /></>
                  ) : adminAction.type === "checkin" ? (
                    <>Confirm Check-In <UserCheck size={14} className="ml-2" /></>
                  ) : (
                    <>Confirm Check-Out <UserX size={14} className="ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
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

/** One leg (check-in or check-out) of the employee's latest session. */
function LegCard({ title, leg }: { title: string; leg: AttendanceLeg | null }) {
  if (!leg) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">Not recorded yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-semibold text-navy">{leg.time}</p>

      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">Place</dt>
          <dd className="text-right font-medium text-navy">
            {leg.location || <span className="font-normal text-muted-foreground">—</span>}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">Coordinates</dt>
          <dd className="text-right font-mono text-navy">
            {leg.coords
              ? `${leg.coords.lat.toFixed(4)}, ${leg.coords.lng.toFixed(4)}`
              : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Accuracy</dt>
          <dd className="font-medium text-navy">
            {leg.accuracyM != null ? `${Math.round(leg.accuracyM)}m` : "—"}
          </dd>
        </div>
        {leg.insideGeofence !== null && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Geofence</dt>
            <dd className={cn("font-medium", leg.insideGeofence ? "text-success" : "text-danger")}>
              {leg.insideGeofence ? "Inside" : "Outside"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * The actual selfie for one leg. Photos are stored in the database and served
 * by an authenticated route, so this renders a real <img> rather than the
 * placeholder this used to draw whenever a photo existed.
 */
function PhotoTile({ label, photoUrl }: { label: string; photoUrl: string | null }) {
  // Track *which* URL failed rather than a boolean, so switching employees
  // (and therefore URLs) resets the error without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = photoUrl != null && failedUrl === photoUrl;

  return (
    <figure className="overflow-hidden rounded-lg border border-border">
      <div className="relative aspect-video bg-muted/30">
        {photoUrl && !failed ? (
          // Session cookie is sent automatically; no token needed here.
          <img
            src={photoUrl}
            alt={`${label} selfie`}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(photoUrl)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff size={18} />
            <p className="text-xs">{failed ? "Could not load photo" : "No photo captured"}</p>
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      </div>
    </figure>
  );
}

function formatMins(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
