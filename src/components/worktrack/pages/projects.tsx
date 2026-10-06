"use client";

import { useState } from "react";
import {
  Plus,
  MoreVertical,
  Users,
  MapPin,
  ArrowLeft,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Crosshair,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { PROJECTS, EMPLOYEES } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Avatar, Card, PageHeader, StatusPill } from "../ui";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ProjectsPage() {
  const { selectedProjectId, setSelectedProject } = useApp();
  const [createOpen, setCreateOpen] = useState(false);

  const selected = PROJECTS.find((p) => p.id === selectedProjectId);

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage projects, locations and assigned employees."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-2" /> Create Project
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROJECTS.map((p) => {
          const pct = Math.round((p.presentToday / p.totalEmployees) * 100);
          return (
            <Card
              key={p.id}
              className="cursor-pointer transition hover:border-primary/40 hover:shadow-md"
              onClick={() => setSelectedProject(p.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.code}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={14} />
                </Button>
              </div>

              <div className="mt-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0",
                    p.status === "active"
                      ? "bg-success-soft text-success"
                      : p.status === "paused"
                        ? "bg-warning-soft text-warning"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="capitalize">{p.status}</span>
                </Badge>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users size={13} /> {p.totalEmployees} Employees
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {p.location}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Today's Attendance
                  </span>
                  <span className="font-semibold text-navy">
                    {p.presentToday} / {p.totalEmployees}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct >= 90
                        ? "bg-success"
                        : pct >= 75
                          ? "bg-primary"
                          : "bg-warning",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setSelectedProject(p.id)}
              >
                View Project
              </Button>
            </Card>
          );
        })}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ProjectDetail({
  project,
  onBack,
}: {
  project: (typeof PROJECTS)[number];
  onBack: () => void;
}) {
  const { setDrawerEmployee, setPage } = useApp();
  const projectEmployees = EMPLOYEES.filter((e) =>
    e.projects.includes(project.id),
  );

  const stats = [
    { label: "Employees", value: project.totalEmployees },
    { label: "Present", value: project.presentToday },
    { label: "Working", value: project.workingNow },
    { label: "Absent", value: project.absentToday },
    { label: "Late", value: project.lateToday },
  ];

  return (
    <div className="space-y-6 fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Projects
      </button>

      <PageHeader
        title={project.name}
        subtitle={`${project.code} • ${project.client}`}
        actions={
          <>
            <Badge
              variant="outline"
              className="border-0 bg-success-soft text-success"
            >
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success pulse-live" />
              Active
            </Badge>
            <Button variant="outline" size="sm">
              <Pencil size={14} className="mr-2" /> Edit Project
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical size={16} />
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
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">
                Project Location
              </p>
              <div className="flex items-start gap-2 text-sm">
                <MapPin
                  size={16}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="font-medium text-navy">{project.location}</p>
                  <p className="text-xs text-muted-foreground">
                    Allowed Radius: {project.radiusM} meters
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {project.coords.lat.toFixed(4)},{" "}
                    {project.coords.lng.toFixed(4)}
                  </p>
                </div>
              </div>
              <div className="relative mt-4 h-48 overflow-hidden rounded-lg bg-navy">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(59,130,246,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.2) 1px, transparent 1px)",
                    backgroundSize: "30px 30px",
                  }}
                />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="relative flex h-10 w-10 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
                    <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <MapPin size={12} />
                    </span>
                  </span>
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-1 text-xs font-medium text-navy shadow">
                    Geofence: {project.radiusM}m
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">
                Project Info
              </p>
              <div className="space-y-3 text-sm">
                <Row label="Client" value={project.client} />
                <Row label="Code" value={project.code} />
                <Row label="Start Date" value={project.startDate} />
                <Row
                  label="End Date"
                  value={project.endDate ?? "Open-ended"}
                />
                <Row
                  label="Status"
                  value={<span className="capitalize">{project.status}</span>}
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {project.description}
              </p>
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
                    <th className="hidden px-4 py-3 font-medium md:table-cell">
                      Check-In
                    </th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectEmployees.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-t border-border transition hover:bg-muted/40"
                      onClick={() => {
                        setPage("live");
                        setDrawerEmployee(e.id);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={e.initials}
                            color={e.avatarColor}
                            size={32}
                          />
                          <div>
                            <p className="text-sm font-medium text-navy">
                              {e.firstName} {e.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.empId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {e.designation}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        {e.checkIn ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={e.todaysStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </td>
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
            <p className="mt-3 text-sm font-medium text-navy">
              Attendance analytics for this project
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Detailed attendance history and reports appear here.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => {
                setPage("attendance");
                toast.success("Loading project attendance report");
              }}
            >
              Open Attendance Report
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card className="p-0">
            <div className="relative h-[480px] overflow-hidden bg-navy">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(59,130,246,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.2) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/10" />

              {projectEmployees
                .filter(
                  (e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave",
                )
                .map((e, i) => {
                  const x = 20 + ((i * 53) % 60);
                  const y = 20 + ((i * 89) % 60);
                  const color =
                    e.todaysStatus === "working"
                      ? "#16a34a"
                      : e.todaysStatus === "break"
                        ? "#f59e0b"
                        : "#94a3b8";
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setPage("live");
                        setDrawerEmployee(e.id);
                      }}
                      className="group absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ring-2 ring-white/20"
                        style={{ background: color }}
                      >
                        {e.initials}
                      </span>
                      <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-navy/90 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                        {e.firstName}
                      </span>
                    </button>
                  );
                })}

              <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-navy shadow">
                <p className="font-semibold">{project.name}</p>
                <p className="text-muted-foreground">
                  {project.workingNow} working now
                </p>
              </div>
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

function ProjectSettings({ project }: { project: (typeof PROJECTS)[number] }) {
  const [photo, setPhoto] = useState(true);
  const [location, setLocation] = useState(true);
  const [gallery, setGallery] = useState(true);
  const [geofence, setGeofence] = useState(true);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Geofence Settings</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-navy">Enable Geofence</p>
              <p className="text-xs text-muted-foreground">
                Restrict check-ins to the project radius
              </p>
            </div>
            <Switch checked={geofence} onCheckedChange={setGeofence} />
          </div>
          <div>
            <Label className="text-xs">Allowed Radius (meters)</Label>
            <Input defaultValue={project.radiusM} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Project Location</Label>
            <Input defaultValue={project.location} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">
          Attendance Requirements
        </p>
        <div className="space-y-3">
          <ToggleRow
            label="Require Photo"
            desc="Capture photo at check-in/out"
            checked={photo}
            onChange={setPhoto}
            icon={Camera}
          />
          <ToggleRow
            label="Require Location"
            desc="GPS location required"
            checked={location}
            onChange={setLocation}
            icon={Crosshair}
          />
          <ToggleRow
            label="Prevent Gallery Upload"
            desc="Block photo uploads from gallery"
            checked={gallery}
            onChange={setGallery}
            icon={ShieldCheck}
          />
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={14} />
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [client, setClient] = useState("");
  const [radius, setRadius] = useState("200");
  const [status, setStatus] = useState("active");
  const [geofence, setGeofence] = useState(true);

  function submit() {
    if (!name || !code) {
      toast.error("Project name and code are required");
      return;
    }
    onOpenChange(false);
    toast.success("Project created successfully", {
      description: `${name} (${code}) is now active.`,
    });
    setName("");
    setCode("");
    setClient("");
    setRadius("200");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Project Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dubai Home Technical"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Client</Label>
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Client name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Project Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DHT-001"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              placeholder="Brief project description"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input placeholder="Search location" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input placeholder="25.2048" className="mt-1" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input placeholder="55.2708" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Allowed Radius (m)</Label>
              <Input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-navy">Enable Geofence</p>
              <p className="text-xs text-muted-foreground">
                Restrict check-ins to defined radius
              </p>
            </div>
            <Switch checked={geofence} onCheckedChange={setGeofence} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
