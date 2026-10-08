"use client";

import { useState } from "react";
import {
  Plus,
  MoreVertical,
  Users,
  MapPin,
  ArrowLeft,
  Pencil,
  Clock,
  Crosshair,
  Camera,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useProjects, useEmployees, useCreateProject, useDeleteProject } from "@/lib/hooks";
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
  DialogClose,
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

export function ProjectsPage() {
  const { selectedProjectId, setSelectedProject } = useApp();
  const { data: projData, isLoading } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const projects = projData?.projects ?? [];
  const selected = projects.find((p) => p.id === selectedProjectId);

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => setSelectedProject(null)} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" subtitle="Loading…" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
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
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}>
                      <Trash2 size={14} className="text-muted-foreground hover:text-danger" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical size={14} />
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

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteProjectDialog id={deleteId} onClose={() => setDeleteId(null)} />
    </div>
  );
}

function ProjectDetail({ project, onBack }: { project: any; onBack: () => void }) {
  const { setDrawerEmployee, setPage } = useApp();
  const { data: empData } = useEmployees();
  const projectEmployees = (empData?.employees ?? []).filter((e) => e.projectIds.includes(project.id));

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
            <Badge variant="outline" className="border-0 bg-success-soft text-success">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success pulse-live" />Active
            </Badge>
            <Button variant="outline" size="sm"><Pencil size={14} className="mr-2" /> Edit Project</Button>
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
                  <p className="text-xs text-muted-foreground">Allowed Radius: {project.radiusM} meters</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{project.coords.lat.toFixed(4)}, {project.coords.lng.toFixed(4)}</p>
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

function ProjectSettings({ project }: { project: any }) {
  const [photo, setPhoto] = useState(true);
  const [location, setLocation] = useState(true);
  const [gallery, setGallery] = useState(true);
  const [geofence, setGeofence] = useState(true);
  const [radius, setRadius] = useState(project.radiusM.toString());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Geofence Settings</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-navy">Enable Geofence</p>
              <p className="text-xs text-muted-foreground">Restrict check-ins to the project radius</p>
            </div>
            <Switch checked={geofence} onCheckedChange={setGeofence} />
          </div>
          <div>
            <Label className="text-xs">Allowed Radius (meters)</Label>
            <Input value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Project Location</Label>
            <Input defaultValue={project.location} className="mt-1" />
          </div>
        </div>
      </Card>
      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Attendance Requirements</p>
        <div className="space-y-3">
          <ToggleRow label="Require Photo" desc="Capture photo at check-in/out" checked={photo} onChange={setPhoto} icon={Camera} />
          <ToggleRow label="Require Location" desc="GPS location required" checked={location} onChange={setLocation} icon={Crosshair} />
          <ToggleRow label="Prevent Gallery Upload" desc="Block photo uploads from gallery" checked={gallery} onChange={setGallery} icon={ShieldCheck} />
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, icon: Icon }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={14} /></span>
        <div>
          <p className="text-sm font-medium text-navy">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState(200);
  const [noLimit, setNoLimit] = useState(false);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  function submit() {
    if (!name || !code) return;
    createProject.mutate({
      name, code, client, location,
      latitude: lat || undefined,
      longitude: lng || undefined,
      geofenceRadius: noLimit ? "0" : String(radius),
      description,
      status,
      geofence: !noLimit,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setName(""); setCode(""); setClient(""); setLocation(""); setLat(""); setLng(""); setRadius(200); setNoLimit(false); setDescription("");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Create New Project</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Project Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dubai Home Technical" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Client</Label><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" className="mt-1" /></div>
            <div><Label>Project Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DHT-001" className="mt-1" /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief project description" className="mt-1" /></div>

          {/* Location — search by name + interactive map + radius (all in one component) */}
          <div>
            <Label>Project Location</Label>
            <p className="mb-2 text-xs text-muted-foreground">Search by name or click on map to set coordinates. Location name auto-fills from selection.</p>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Auto-filled from map search, or type manually"
              className="mb-2"
            />
            <MapLocationPicker
              lat={lat}
              lng={lng}
              radius={radius}
              noLimit={noLimit}
              onLocationChange={(newLat, newLng) => {
                setLat(newLat.toFixed(6));
                setLng(newLng.toFixed(6));
              }}
              onLocationNameChange={(name) => setLocation(name)}
              onRadiusChange={(r) => setRadius(r)}
              onNoLimitChange={(v) => setNoLimit(v)}
            />
          </div>

          {/* Coordinates (read-only display) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="25.2048" className="mt-1 font-mono text-xs" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="55.2708" className="mt-1 font-mono text-xs" />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={createProject.isPending || !name || !code}>
            {createProject.isPending ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const deleteProject = useDeleteProject();
  return (
    <AlertDialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this project? This action cannot be undone and will remove all associated assignments.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger text-white hover:bg-danger/90"
            onClick={() => { if (id) deleteProject.mutate(id, { onSuccess: onClose }); }}
          >
            Delete Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
