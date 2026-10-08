"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users,
  MapPin,
  ArrowLeft,
  Pencil,
  Clock,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useProjects,
  useEmployees,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useSettings,
  useUpdateSettings,
  type Project,
} from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { Avatar, Card, PageHeader, StatusPill } from "../ui";
import dynamic from "next/dynamic";
const RealMap = dynamic(() => import("../real-map").then((m) => m.RealMap), { ssr: false, loading: () => <div className="h-[480px] rounded-lg bg-muted animate-pulse" /> });
const MapLocationPicker = dynamic(() => import("../map-location-picker").then((m) => m.MapLocationPicker), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-muted animate-pulse" /> });
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Sentinel radius meaning "no geofence limit" — mirrors the API's constant. */
const NO_LIMIT_RADIUS = 9999999;

export function ProjectsPage() {
  const { selectedProjectId, setSelectedProject } = useApp();
  const { data: projData, isLoading } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const projects = projData?.projects ?? [];
  const selected = projects.find((p) => p.id === selectedProjectId);

  // The dialogs are hoisted out of the branches below and mounted once, for
  // every screen. They used to live only in the list branch, so the detail
  // page's Edit button set `editing` while the dialog that was supposed to show
  // it was never mounted — the button did nothing at all.
  const dialogs = (
    <>
      <ProjectFormDialog key="create" open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <ProjectFormDialog
          key={editing.id}
          open
          project={editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <DeleteProjectDialog project={deleting} onClose={() => setDeleting(null)} />
    </>
  );

  if (selected) {
    return (
      <>
        <ProjectDetail
          project={selected}
          onBack={() => setSelectedProject(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeleting(selected)}
        />
        {dialogs}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          <PageHeader title="Projects" subtitle="Loading…" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage projects, locations and assigned employees."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} className="mr-2" /> Create Project</Button>}
      />

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">📁</div>
          <p className="mt-4 text-sm font-medium text-navy">No projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create your first project to start managing your workforce.</p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} className="mr-2" /> Create Project</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const pct = p.totalEmployees > 0 ? Math.round((p.presentToday / p.totalEmployees) * 100) : 0;
            return (
              <Card key={p.id} className="cursor-pointer transition hover:border-primary/40 hover:shadow-md" onClick={() => setSelectedProject(p.id)}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleting(p); }}>
                      <Trash2 size={14} className="text-muted-foreground hover:text-danger" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit project"
                      onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                    >
                      <Pencil size={14} className="text-muted-foreground hover:text-navy" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <Badge variant="outline" className={cn(
                    "border-0 capitalize",
                    p.status === "active" ? "bg-success-soft text-success" : p.status === "paused" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
                  )}>
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />{p.status}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users size={13} /> {p.totalEmployees} Employees</span>
                  <span className="flex items-center gap-1"><MapPin size={13} /> {p.location}</span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Today's Attendance</span>
                    <span className="font-semibold text-navy">{p.presentToday} / {p.totalEmployees}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", pct >= 90 ? "bg-success" : pct >= 75 ? "bg-primary" : "bg-warning")} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setSelectedProject(p.id)}>View Project</Button>
              </Card>
            );
          })}
        </div>
      )}

      {dialogs}
    </div>
  );
}

function ProjectDetail({
  project,
  onBack,
  onEdit,
  onDelete,
}: {
  project: Project;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setDrawerEmployee, setPage } = useApp();
  const { data: empData } = useEmployees();
  const projectEmployees = (empData?.employees ?? []).filter((e) => e.projectIds.includes(project.id));

  // Cmd/Ctrl+E opens the editor, matching the shortcut shown on the button.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "e") return;
      // Don't hijack the shortcut while the admin is typing, or when the
      // editor is already open — Ctrl+E would otherwise re-open it on top.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      onEdit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEdit]);

  const stats = [
    { label: "Employees", value: project.totalEmployees },
    { label: "Present", value: project.presentToday },
    { label: "Working", value: project.workingNow },
    { label: "Absent", value: project.absentToday },
    { label: "Late", value: project.lateToday },
  ];

  return (
    <div className="space-y-6 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-navy">
        <ArrowLeft size={14} /> Back to Projects
      </button>

      <PageHeader
        title={project.name}
        subtitle={`${project.code} • ${project.client ?? "—"}`}
        actions={
          <>
            <Badge
              variant="outline"
              className={cn(
                "border-0 capitalize",
                project.status === "active"
                  ? "bg-success-soft text-success"
                  : project.status === "paused"
                    ? "bg-warning-soft text-warning"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />{project.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil size={14} className="mr-2" /> Edit Project
              <kbd className="ml-2 hidden rounded border border-border px-1 py-0.5 font-mono text-[10px] font-normal text-muted-foreground sm:inline-block">
                {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
                  ? "⌘E"
                  : "Ctrl E"}
              </kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 size={14} className="mr-2 text-danger" /> Delete
            </Button>
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {stats.map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-navy">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">Project Location</p>
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={16} className="mt-0.5 text-primary" />
                <div>
                  <p className="font-medium text-navy">{project.location}</p>
                  <p className="text-xs text-muted-foreground">
                    Allowed Radius:{" "}
                    {project.radiusM >= NO_LIMIT_RADIUS
                      ? "No limit"
                      : `${project.radiusM} meters`}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {project.coords.lat.toFixed(4)}, {project.coords.lng.toFixed(4)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <RealMap
                  markers={[]}
                  geofence={{ lat: project.coords.lat, lng: project.coords.lng, radiusM: project.radiusM, name: project.name }}
                  height={192}
                  center={[project.coords.lat, project.coords.lng]}
                  zoom={14}
                />
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">Project Info</p>
              <div className="space-y-3 text-sm">
                <Row label="Client" value={project.client ?? "—"} />
                <Row label="Code" value={project.code} />
                <Row label="Start Date" value={project.startDate ?? "—"} />
                <Row label="End Date" value={project.endDate ?? "Open-ended"} />
                <Row label="Status" value={<span className="capitalize">{project.status}</span>} />
              </div>
              {project.description && (
                <p className="mt-4 text-sm text-muted-foreground">{project.description}</p>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employees">
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Designation</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Check-In</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectEmployees.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No employees assigned</td></tr>
                  )}
                  {projectEmployees.map((e) => (
                    <tr key={e.id} className="cursor-pointer border-t border-border transition hover:bg-muted/40" onClick={() => { setPage("live"); setDrawerEmployee(e.id); }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={e.initials} color={e.avatarColor} size={32} />
                          <div>
                            <p className="text-sm font-medium text-navy">{e.firstName} {e.lastName}</p>
                            <p className="text-xs text-muted-foreground">{e.empId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.designation ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{e.checkIn ?? "—"}</td>
                      <td className="px-4 py-3"><StatusPill status={e.todaysStatus as any} /></td>
                      <td className="px-4 py-3"><Button variant="ghost" size="sm">View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={40} className="text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-navy">Attendance analytics for this project</p>
            <p className="mt-1 text-xs text-muted-foreground">Detailed attendance history and reports appear here.</p>
            <Button className="mt-4" size="sm" onClick={() => setPage("attendance")}>Open Attendance Report</Button>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card className="p-0">
            <div className="border-b border-border p-3">
              <p className="text-sm font-semibold text-navy">{project.name} — Live Workforce Map</p>
            </div>
            <div className="p-3">
              <RealMap
                markers={projectEmployees
                  .filter((e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave" && e.coords.lat && e.coords.lng)
                  .map((e) => ({
                    id: e.id,
                    lat: e.coords.lat,
                    lng: e.coords.lng,
                    initials: e.initials,
                    color: e.todaysStatus === "working" ? "#16a34a" : e.todaysStatus === "break" ? "#f59e0b" : "#94a3b8",
                    label: `${e.firstName} ${e.lastName}`,
                    description: `${e.project} • ${e.todaysStatus}`,
                    type: "employee" as const,
                  }))}
                geofence={{ lat: project.coords.lat, lng: project.coords.lng, radiusM: project.radiusM, name: project.name }}
                height={480}
                center={[project.coords.lat, project.coords.lng]}
                zoom={13}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <ProjectSettings project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Geofence quick-edit. These previously looked like working controls but only
 * mutated local state that was discarded on unmount, so an admin could change
 * the radius here and see nothing persist. Radius and location are real
 * project fields and are now saved.
 */
function ProjectSettings({ project }: { project: Project }) {
  const updateProject = useUpdateProject();
  const noLimit = project.radiusM >= NO_LIMIT_RADIUS;
  const [radius, setRadius] = useState(noLimit ? "" : String(project.radiusM));

  const save = (patch: Record<string, unknown>) =>
    updateProject.mutate({ id: project.id, ...patch });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Geofence Settings</p>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Allowed Radius (meters)</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                value={radius}
                placeholder={noLimit ? "No limit" : ""}
                onChange={(e) => setRadius(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={updateProject.isPending}
                onClick={() => {
                  const n = parseInt(radius);
                  if (!Number.isFinite(n) || n < 0) {
                    toast.error("Enter a radius of 0 or more");
                    return;
                  }
                  save({ radiusM: n });
                }}
              >
                Save
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Employees must be within this distance to check in. Enter 0 for no limit.
            </p>
          </div>

          <div>
            <Label className="text-xs">Project Location</Label>
            <ProjectLocationField project={project} onSave={save} />
          </div>

          <div>
            <Label className="text-xs">Coordinates</Label>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {project.coords.lat.toFixed(4)}, {project.coords.lng.toFixed(4)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Move these with the location picker in Edit Project.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Attendance Requirements</p>
        <div className="space-y-3">
          {[
            { key: "REQUIRE_PHOTO", label: "Require Photo", desc: "Capture photo at check-in/out" },
            { key: "REQUIRE_LOCATION", label: "Require Location", desc: "GPS location required" },
            { key: "GEOFENCE_ENABLED", label: "Enable Geofence", desc: "Restrict check-ins to the project radius" },
          ].map((r) => (
            <ProjectSettingToggle key={r.key} settingKey={r.key} label={r.label} desc={r.desc} />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          These are company-wide settings and apply to every project.
        </p>
      </Card>
    </div>
  );
}

function ProjectLocationField({
  project,
  onSave,
}: {
  project: Project;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [value, setValue] = useState(project.location ?? "");

  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        disabled={value === (project.location ?? "")}
        onClick={() => onSave({ location: value })}
      >
        Save
      </Button>
    </div>
  );
}

/** Company-level attendance setting, wired to the same store Settings uses. */
function ProjectSettingToggle({
  settingKey,
  label,
  desc,
}: {
  settingKey: string;
  label: string;
  desc: string;
}) {
  const { data, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const current = (data as any)?.settings?.[settingKey] ?? "false";
  const on = current === "true";

  if (isLoading) {
    return <Skeleton className="h-[60px] rounded-lg" />;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck size={14} />
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch
        checked={on}
        disabled={updateSettings.isPending}
        onCheckedChange={(v) => updateSettings.mutate({ [settingKey]: String(v) })}
      />
    </div>
  );
}



function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-danger">{children}</p>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

/**
 * One dialog for create and edit. The field set and validation are identical,
 * and keeping them in a single component is what stops the two drifting apart.
 *
 * The caller passes a `key` derived from the project id so the component
 * remounts per project and can seed its state straight from props.
 */
function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Omitted for create. */
  project?: Project;
}) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isEdit = !!project;
  const pending = createProject.isPending || updateProject.isPending;

  // "No limit" is persisted as a sentinel radius, so the toggle is derived from
  // the stored radius when the form opens.
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [location, setLocation] = useState(project?.location ?? "");
  const [lat, setLat] = useState(project?.coords?.lat ? String(project.coords.lat) : "");
  const [lng, setLng] = useState(project?.coords?.lng ? String(project.coords.lng) : "");
  const [radius, setRadius] = useState(
    project?.radiusM && project.radiusM < NO_LIMIT_RADIUS ? project.radiusM : 200,
  );
  const [noLimit, setNoLimit] = useState(!!project && project.radiusM >= NO_LIMIT_RADIUS);
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [startDate, setStartDate] = useState(project?.startDate ?? "");
  const [endDate, setEndDate] = useState(project?.endDate ?? "");
  const [dirty, setDirty] = useState(false);

  /** Client-side checks, so obvious mistakes never need a round trip. */
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!code.trim()) {
      e.code = "Code is required";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/.test(code.trim())) {
      e.code = "Use letters, numbers, dashes or underscores (max 24)";
    }
    if (!noLimit && (!Number.isFinite(radius) || radius < 0)) {
      e.radius = "Enter a radius of 0 or more";
    }
    // A project with only half a coordinate pair cannot be placed on a map.
    const hasLat = lat.trim() !== "";
    const hasLng = lng.trim() !== "";
    if (hasLat !== hasLng) {
      e[hasLat ? "lng" : "lat"] = "Provide both latitude and longitude";
    } else if (hasLat) {
      const la = Number(lat);
      const ln = Number(lng);
      if (!Number.isFinite(la) || la < -90 || la > 90) e.lat = "Latitude must be between -90 and 90";
      if (!Number.isFinite(ln) || ln < -180 || ln > 180) e.lng = "Longitude must be between -180 and 180";
    }
    if (startDate && endDate && endDate < startDate) {
      e.endDate = "End date cannot be before the start date";
    }
    return e;
  }, [name, code, lat, lng, radius, noLimit, startDate, endDate]);

  const valid = Object.keys(errors).length === 0;

  // A dirty dialog closed by Cancel, Escape or an outside click would silently
  // drop the admin's work, so ask first. Saving is exempt — it has its own path.
  const requestClose = useCallback(
    (next: boolean) => {
      if (!next && dirty && !isEdit) {
        if (confirm("Discard this project? Your changes will be lost.")) onOpenChange(false);
        return;
      }
      if (!next && dirty && isEdit && !window.confirm("Discard your changes?")) {
        return;
      }
      onOpenChange(next);
    },
    [dirty, isEdit, onOpenChange],
  );

  /** Tracks edits so Save can stay disabled until something actually changes. */
  function touch<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  const changes = useMemo(() => {
    if (!project) return [];
    const out: string[] = [];
    if (name.trim() !== project.name) out.push("name");
    if (code.trim() !== project.code) out.push("code");
    if (client !== (project.client ?? "")) out.push("client");
    if (description !== (project.description ?? "")) out.push("description");
    if (status !== project.status) out.push("status");
    if (location !== (project.location ?? "")) out.push("location");
    const storedLat = project.coords.lat ? String(project.coords.lat) : "";
    const storedLng = project.coords.lng ? String(project.coords.lng) : "";
    if (lat !== storedLat || lng !== storedLng) out.push("coordinates");
    const wantRadius = noLimit ? NO_LIMIT_RADIUS : radius;
    if (wantRadius !== project.radiusM) out.push("geofence radius");
    if (startDate !== (project.startDate ?? "")) out.push("start date");
    if (endDate !== (project.endDate ?? "")) out.push("end date");
    return out;
  }, [project, name, code, client, description, status, location, lat, lng, radius, noLimit, startDate, endDate]);

  function submit() {
    if (!valid || !name.trim() || !code.trim()) return;
    const onSuccess = () => onOpenChange(false);

    if (project) {
      // PATCH takes the raw column names.
      updateProject.mutate(
        {
          id: project.id,
          name: name.trim(),
          code: code.trim(),
          client,
          description,
          status,
          location,
          lat,
          lng,
          radiusM: noLimit ? 0 : radius,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        { onSuccess },
      );
    } else {
      createProject.mutate(
        {
          name: name.trim(),
          code: code.trim(),
          client,
          location,
          latitude: lat || undefined,
          longitude: lng || undefined,
          geofenceRadius: noLimit ? "0" : String(radius),
          description,
          status,
          geofence: !noLimit,
        },
        { onSuccess },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Project" : "Create New Project"}</DialogTitle>
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Changes apply to the geofence immediately — employees already checked
              in keep their existing record.
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Project Name *</Label>
            <Input
              value={name}
              onChange={(e) => touch(setName)(e.target.value)}
              placeholder="Dubai Home Technical"
              className="mt-1"
              aria-invalid={!!errors.name}
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Client</Label>
              <Input value={client} onChange={(e) => touch(setClient)(e.target.value)} placeholder="Client name" className="mt-1" />
            </div>
            <div>
              <Label>Project Code *</Label>
              <Input
                value={code}
                onChange={(e) => touch(setCode)(e.target.value.toUpperCase())}
                placeholder="DHT-001"
                className="mt-1"
                aria-invalid={!!errors.code}
              />
              {errors.code && <FieldError>{errors.code}</FieldError>}
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => touch(setDescription)(e.target.value)} placeholder="Brief project description" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate ?? ""} onChange={(e) => touch(setStartDate)(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => touch(setEndDate)(e.target.value)}
                className="mt-1"
                aria-invalid={!!errors.endDate}
              />
              {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
            </div>
          </div>

          {/* Location — search by name + interactive map + radius (all in one component) */}
          <div>
            <Label>Project Location</Label>
            <p className="mb-2 text-xs text-muted-foreground">Search by name or click on map to set coordinates. Location name auto-fills from selection.</p>
            <Input
              value={location}
              onChange={(e) => touch(setLocation)(e.target.value)}
              placeholder="Auto-filled from map search, or type manually"
              className="mb-2"
            />
            {errors.radius && <FieldError>{errors.radius}</FieldError>}
            <MapLocationPicker
              lat={lat}
              lng={lng}
              radius={radius}
              noLimit={noLimit}
              onLocationChange={(newLat, newLng) => {
                setLat(newLat.toFixed(6));
                setLng(newLng.toFixed(6));
                setDirty(true);
              }}
              onLocationNameChange={(name) => {
                setLocation(name);
                setDirty(true);
              }}
              onRadiusChange={(r) => {
                setRadius(r);
                setDirty(true);
              }}
              onNoLimitChange={(v) => {
                setNoLimit(v);
                setDirty(true);
              }}
            />
          </div>

          {/* Coordinates (read-only display) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input
                value={lat}
                onChange={(e) => touch(setLat)(e.target.value)}
                placeholder="25.2048"
                className="mt-1 font-mono text-xs"
                aria-invalid={!!errors.lat}
              />
              {errors.lat && <FieldError>{errors.lat}</FieldError>}
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                value={lng}
                onChange={(e) => touch(setLng)(e.target.value)}
                placeholder="55.2708"
                className="mt-1 font-mono text-xs"
                aria-invalid={!!errors.lng}
              />
              {errors.lng && <FieldError>{errors.lng}</FieldError>}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={touch(setStatus)}>
              <SelectTrigger className="mt-1 capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            {isEdit && project && status !== project.status && (
              <p className="mt-1 text-xs text-muted-foreground">
                {status === "paused"
                  ? "Paused projects block new check-ins from employees assigned to them."
                  : status === "completed"
                    ? "Completed projects stop accepting attendance and read as historical."
                    : "Active projects accept check-ins as normal."}
              </p>
            )}
          </div>

          {/* Spells out exactly what will change — the difference between an admin
              believing a silent failure and knowing their edit landed. */}
          {isEdit && changes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-navy">
                {changes.length} field{changes.length === 1 ? "" : "s"} will change
              </p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {changes.join(", ")}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => requestClose(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !valid || (isEdit && !dirty)}>
            {pending
              ? isEdit ? "Saving…" : "Creating…"
              : isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const deleteProject = useDeleteProject();
  const employees = project?.totalEmployees ?? 0;
  const records = project?.totalAttendance ?? 0;

  return (
    <AlertDialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {project?.name ?? "project"}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>This cannot be undone. Here is exactly what it affects:</p>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  <span>
                    <strong className="text-navy">{employees}</strong> employee
                    {employees === 1 ? "" : " assignments"} will be removed. The employees
                    themselves are not deleted.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <span>
                    <strong className="text-navy">{records}</strong> attendance record
                    {records === 1 ? "" : "s"} will be kept but{" "}
                    <strong>detached from this project</strong>, so they stop appearing in
                    this project's attendance and reports.
                  </span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                If you only want to stop new check-ins, set the status to Paused instead —
                that keeps the project and its history intact.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger text-white hover:bg-danger/90"
            disabled={deleteProject.isPending}
            onClick={() => {
              if (project) deleteProject.mutate(project.id, { onSuccess: onClose });
            }}
          >
            {deleteProject.isPending ? "Deleting…" : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
