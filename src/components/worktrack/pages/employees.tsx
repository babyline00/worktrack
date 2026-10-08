"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  MoreVertical,
  ArrowLeft,
  Pencil,
  Upload,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  TrendingUp,
  Clock,
  FileText,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEmployees, useProjects, useCreateEmployee, useDeleteEmployee } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { Avatar, Card, PageHeader, StatusPill } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function EmployeesPage() {
  const { selectedEmployeeId, setSelectedEmployee } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: empData, isLoading } = useEmployees();

  const employees = empData?.employees ?? [];
  const selected = employees.find((e) => e.id === selectedEmployeeId);

  if (selected) {
    return <EmployeeProfile employee={selected} onBack={() => setSelectedEmployee(null)} />;
  }

  const filtered = employees.filter((e) => {
    const q = query.toLowerCase();
    return !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.empId.includes(q) || (e.department ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total employees`}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} className="mr-2" /> Add Employee</Button>}
      />

      <Card className="p-3">
        <Input placeholder="Search by name, ID, or department..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-9" />
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Projects</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Today's Attendance</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 30).map((e) => (
                  <tr key={e.id} className="cursor-pointer border-t border-border transition hover:bg-muted/40" onClick={() => setSelectedEmployee(e.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={e.initials} color={e.avatarColor} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">{e.firstName} {e.lastName}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.empId}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{e.department}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">{e.projects.length} Projects</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("border-0", e.status === "active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" /><span className="capitalize">{e.status}</span>
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell"><StatusPill status={e.todaysStatus as any} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(ev) => { ev.stopPropagation(); setDeleteId(e.id); }}>
                          <Trash2 size={14} className="text-muted-foreground hover:text-danger" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(ev) => ev.stopPropagation()}>
                          <MoreVertical size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 30 && (
            <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
              Showing 30 of {filtered.length} employees. Use search to narrow down.
            </div>
          )}
        </Card>
      )}

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />
      <DeleteEmployeeDialog id={deleteId} onClose={() => setDeleteId(null)} />
    </div>
  );
}

function EmployeeProfile({ employee, onBack }: { employee: any; onBack: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const monthlyTrend = Array.from({ length: 30 }, (_, i) => ({
    label: `D${i + 1}`,
    hours: 6 + Math.round(Math.sin(i / 4) * 2 + (i % 3)),
  }));
  const stats = [
    { label: "Present This Month", value: employee.presentThisMonth, icon: Calendar, tone: "text-success" },
    { label: "Late", value: employee.lateThisMonth, icon: Clock, tone: "text-warning" },
    { label: "Total Hours", value: `${employee.totalHours}h`, icon: Clock, tone: "text-primary" },
    { label: "Attendance Rate", value: `${employee.attendanceRate}%`, icon: TrendingUp, tone: "text-info" },
  ];

  return (
    <div className="space-y-6 fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-navy">
        <ArrowLeft size={14} /> Back to Employees
      </button>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar initials={employee.initials} color={employee.avatarColor} size={64} />
            <div>
              <h2 className="text-xl font-bold text-navy">{employee.firstName} {employee.lastName}</h2>
              <p className="text-sm text-muted-foreground">Employee ID: {employee.empId}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="outline" className={cn("border-0", employee.status === "active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                  <span className="capitalize">{employee.status}</span>
                </Badge>
                <StatusPill status={employee.todaysStatus as any} />
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil size={14} className="mr-2" /> Edit Employee</Button>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="p-4">
                  <Icon size={16} className={s.tone} />
                  <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-0.5 text-xl font-bold text-navy">{s.value}</p>
                </Card>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">Personal Information</p>
              <div className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="Email" value={employee.email ?? "—"} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone ?? "—"} />
                <InfoRow icon={Building2} label="Department" value={employee.department ?? "—"} />
                <InfoRow icon={Briefcase} label="Designation" value={employee.designation ?? "—"} />
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-sm font-semibold text-navy">Working Hours (Last 30 Days)</p>
              <div className="h-44">
                <p className="text-sm text-muted-foreground">Total: {employee.totalHours}h • Avg: {(employee.totalHours / 30).toFixed(1)}h/day</p>
                <div className="mt-4 flex h-32 items-end gap-1">
                  {monthlyTrend.map((d, i) => (
                    <div key={i} className="flex-1 rounded-t bg-primary/30 hover:bg-primary" style={{ height: `${(d.hours / 12) * 100}%` }} title={`Day ${i + 1}: ${d.hours}h`} />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={40} className="text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-navy">Attendance history</p>
            <p className="mt-1 text-xs text-muted-foreground">Daily check-in/out records, photos, and locations appear here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-3">
          {employee.projects.length === 0 ? (
            <Card className="py-8 text-center text-sm text-muted-foreground">No projects assigned</Card>
          ) : (
            employee.projects.map((p: string, i: number) => (
              <Card key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{p}</p>
                </div>
                <Badge variant="outline" className="border-0 bg-success-soft text-success">Active</Badge>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="activity">
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-navy">No recent activity</p>
            <p className="mt-1 text-xs text-muted-foreground">Activity log will appear here as the employee uses WorkTrack.</p>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={40} className="text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-navy">No documents</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload contracts, IDs, or certificates for this employee.</p>
            <Button variant="outline" size="sm" className="mt-4"><Upload size={14} className="mr-2" /> Upload Document</Button>
          </Card>
        </TabsContent>
      </Tabs>

      <EditEmployeeDialog employee={employee} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

// ============================================================
// EditEmployeeDialog — edit employee fields + reset password + reassign projects
// ============================================================
function EditEmployeeDialog({ employee, open, onOpenChange }: { employee: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: projData } = useProjects();
  const projects = projData?.projects ?? [];

  const [first, setFirst] = useState(employee.firstName ?? "");
  const [last, setLast] = useState(employee.lastName ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [designation, setDesignation] = useState(employee.designation ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [assigned, setAssigned] = useState<string[]>(employee.projectIds ?? []);
  const [saving, setSaving] = useState(false);

  // Reset form when employee changes or dialog opens
  useEffect(() => {
    if (open) {
      setFirst(employee.firstName ?? "");
      setLast(employee.lastName ?? "");
      setEmail(employee.email ?? "");
      setPhone(employee.phone ?? "");
      setDesignation(employee.designation ?? "");
      setPassword("");
      setAssigned(employee.projectIds ?? []);
    }
  }, [employee, open]);

  function toggleProject(id: string) {
    setAssigned((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function submit() {
    if (!first) {
      toast.error("First name is required");
      return;
    }
    if (password && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          email,
          phone,
          designation,
          password: password || undefined,
          projectIds: assigned,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || "Failed to update");
      }

      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Employee updated successfully", {
        description: password ? "Password reset — employee can log in with new password" : undefined,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name *</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} className="mt-1" /></div>
            <div><Label>Last Name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
            <div><Label>Designation</Label><Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1" /></div>
          </div>

          {/* Password reset */}
          <div>
            <Label>Reset Password {employee.email ? `(leave empty to keep current)` : `*`}</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={employee.email ? "Leave empty to keep current password" : "Set a password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && <p className="mt-1 text-xs text-warning">Password will be reset for this employee.</p>}
          </div>

          {/* Project assignments */}
          <div>
            <Label>Assigned Projects</Label>
            <div className="mt-2 space-y-2">
              {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects available.</p>}
              {projects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted">
                  <Checkbox checked={assigned.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={saving || !first}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-2">
      <Icon size={14} className="text-muted-foreground" />
      <span className="w-24 text-muted-foreground">{label}</span>
      <span className="flex-1 font-medium text-navy">{value}</span>
    </div>
  );
}

function AddEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createEmployee = useCreateEmployee();
  const { data: projData } = useProjects();
  const projects = projData?.projects ?? [];

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [empId, setEmpId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("Marketing");
  const [designation, setDesignation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [active, setActive] = useState(true);
  const [assigned, setAssigned] = useState<string[]>([]);

  function toggleProject(id: string) {
    setAssigned((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  function submit() {
    if (!first || !empId) {
      toast.error("First name and employee ID are required");
      return;
    }
    if (!password) {
      toast.error("Password is required for the employee to log in");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    createEmployee.mutate({
      firstName: first,
      lastName: last,
      empId,
      email: email || `${first.toLowerCase()}.${last.toLowerCase()}@worktrack.io`,
      phone,
      department,
      designation,
      status: active ? "active" : "inactive",
      projectIds: assigned,
      password,
      role: "EMPLOYEE",
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFirst(""); setLast(""); setEmpId(""); setEmail(""); setPhone(""); setDesignation(""); setPassword(""); setAssigned([]);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-2">
            <button className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-primary">
              <Upload size={20} />
            </button>
            <p className="text-xs text-muted-foreground">Profile Photo</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name *</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} className="mt-1" /></div>
            <div><Label>Last Name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employee ID *</Label><Input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="2585436369" className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="auto-generated if empty" className="mt-1" /></div>

          {/* Password — admin sets login password for employee */}
          <div>
            <Label>Password *</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Employee will use this password with their Employee ID to log in to the mobile app.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Marketing", "Engineering", "Operations", "Field", "Sales", "Finance", "HR"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Designation</Label><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Marketing Executive" className="mt-1" /></div>
          </div>
          <div>
            <Label>Assign Projects</Label>
            <div className="mt-2 space-y-2">
              {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects available. Create a project first.</p>}
              {projects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted">
                  <Checkbox checked={assigned.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-navy">Status</p>
            <Badge variant="outline" className={cn("border-0 cursor-pointer capitalize", active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")} onClick={() => setActive(!active)}>
              {active ? "active" : "inactive"}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={createEmployee.isPending}>
            {createEmployee.isPending ? "Adding..." : "Create Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const deleteEmployee = useDeleteEmployee();
  return (
    <AlertDialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this employee? This action cannot be undone and will remove all associated records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger text-white hover:bg-danger/90"
            onClick={() => { if (id) deleteEmployee.mutate(id, { onSuccess: onClose }); }}
          >
            Delete Employee
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
