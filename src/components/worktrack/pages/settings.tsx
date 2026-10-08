"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  CalendarCheck,
  Bell,
  Shield,
  Users,
  Plug,
  Camera,
  MapPin,
  ImageOff,
  Crosshair,
  Save,
} from "lucide-react";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSettings, useCompany, useUpdateCompany } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "roles", label: "Users & Roles", icon: Users },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export function SettingsPage() {
  const { data, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [local, setLocal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.settings) {
      // Defer to avoid setState in effect body
      Promise.resolve().then(() => setLocal(data.settings));
    }
  }, [data]);

  function set(key: string, value: string) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    updateSettings.mutate(local);
  }

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6 fade-in">
      <PageHeader title="Settings" subtitle="Manage company, attendance, security, and integrations." />

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
                <Icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="company"><CompanySettings /></TabsContent>

        <TabsContent value="attendance">
          <div className="space-y-4">
            <Card>
              <p className="mb-4 text-sm font-semibold text-navy">Check-In Settings</p>
              <div className="space-y-3">
                <ToggleRow icon={Camera} label="Require Photo" desc="Capture photo at check-in" checked={local.REQUIRE_PHOTO === "true"} onChange={(v) => set("REQUIRE_PHOTO", String(v))} />
                <ToggleRow icon={MapPin} label="Require Location" desc="GPS location required at check-in" checked={local.REQUIRE_LOCATION === "true"} onChange={(v) => set("REQUIRE_LOCATION", String(v))} />
                <ToggleRow icon={ImageOff} label="Prevent Gallery Upload" desc="Block photo uploads from device gallery" checked={local.PREVENT_GALLERY === "true"} onChange={(v) => set("PREVENT_GALLERY", String(v))} />
                <ToggleRow icon={Crosshair} label="Require GPS Accuracy" desc="Reject check-ins with poor GPS accuracy" checked={local.REQUIRE_GPS_ACCURACY === "true"} onChange={(v) => set("REQUIRE_GPS_ACCURACY", String(v))} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><Label>Maximum GPS Accuracy (meters)</Label><Input type="number" value={local.MAX_GPS_ACCURACY ?? "50"} onChange={(e) => set("MAX_GPS_ACCURACY", e.target.value)} className="mt-1" /></div>
                <div><Label>Default Geofence Radius (meters)</Label><Input type="number" value={local.DEFAULT_RADIUS ?? "200"} onChange={(e) => set("DEFAULT_RADIUS", e.target.value)} className="mt-1" /></div>
              </div>
            </Card>
            <Card>
              <p className="mb-4 text-sm font-semibold text-navy">Geofence & Auto</p>
              <div className="space-y-3">
                <ToggleRow icon={MapPin} label="Enable Geofence" desc="Require employees to be inside project geofence to check in" checked={local.GEOFENCE_ENABLED === "true"} onChange={(v) => set("GEOFENCE_ENABLED", String(v))} />
                <ToggleRow icon={CalendarCheck} label="Auto Check-Out" desc="Close a session automatically once the employee has been outside the project radius for too long" checked={local.AUTO_CHECKOUT === "true"} onChange={(v) => set("AUTO_CHECKOUT", String(v))} />
                {local.AUTO_CHECKOUT === "true" && (
                  <div>
                    <Label>Grace period before auto check-out (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={local.GEOFENCE_AUTO_CHECKOUT_MINS ?? "5"}
                      onChange={(e) =>
                        set("GEOFENCE_AUTO_CHECKOUT_MINS", e.target.value)
                      }
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Time outside the radius before the session is closed. The
                      clock resets if the employee returns, and the closed record
                      is flagged for review because no selfie can be taken.
                    </p>
                  </div>
                )}
              </div>
            </Card>
            <div className="flex justify-end"><Button onClick={save} disabled={updateSettings.isPending}><Save size={14} className="mr-2" /> {updateSettings.isPending ? "Saving..." : "Save Settings"}</Button></div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <p className="mb-4 text-sm font-semibold text-navy">Notification Preferences</p>
            <div className="space-y-3">
              <ToggleRow icon={Bell} label="Late check-in alerts" desc="Notify when an employee checks in late" checked={local.NOTIFY_LATE === "true"} onChange={(v) => set("NOTIFY_LATE", String(v))} />
              <ToggleRow icon={Bell} label="Absence alerts" desc="Notify when an employee is absent" checked={local.NOTIFY_ABSENT === "true"} onChange={(v) => set("NOTIFY_ABSENT", String(v))} />
              <ToggleRow icon={Bell} label="Leave request notifications" desc="Notify on new leave requests" checked={local.NOTIFY_LEAVE === "true"} onChange={(v) => set("NOTIFY_LEAVE", String(v))} />
              <ToggleRow icon={Bell} label="Geofence violations" desc="Notify when an employee is outside project area" checked={local.NOTIFY_GEOFENCE === "true"} onChange={(v) => set("NOTIFY_GEOFENCE", String(v))} />
              <ToggleRow icon={Bell} label="Daily summary email" desc="Receive a daily attendance summary at 7:00 PM" checked={local.NOTIFY_DAILY_SUMMARY === "true"} onChange={(v) => set("NOTIFY_DAILY_SUMMARY", String(v))} />
            </div>
            <div className="mt-5 flex justify-end"><Button onClick={save}><Save size={14} className="mr-2" /> Save</Button></div>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <p className="mb-4 text-sm font-semibold text-navy">Security Policy</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><Label>Minimum Password Length</Label><Input type="number" value={local.PASSWORD_MIN_LENGTH ?? "8"} onChange={(e) => set("PASSWORD_MIN_LENGTH", e.target.value)} className="mt-1" /></div>
              <div><Label>Session Timeout (minutes)</Label><Input type="number" value={local.SESSION_TIMEOUT ?? "30"} onChange={(e) => set("SESSION_TIMEOUT", e.target.value)} className="mt-1" /></div>
              <div><Label>Login Attempt Limit</Label><Input type="number" value={local.LOGIN_ATTEMPT_LIMIT ?? "5"} onChange={(e) => set("LOGIN_ATTEMPT_LIMIT", e.target.value)} className="mt-1" /></div>
            </div>
            <div className="mt-4 space-y-3">
              <ToggleRow icon={Shield} label="Require strong password" desc="Must include uppercase, lowercase, number, symbol" checked={local.REQUIRE_STRONG_PASSWORD === "true"} onChange={(v) => set("REQUIRE_STRONG_PASSWORD", String(v))} />
              <ToggleRow icon={Shield} label="Two-factor authentication" desc="Require 2FA for admin login" checked={local.TWO_FACTOR_AUTH === "true"} onChange={(v) => set("TWO_FACTOR_AUTH", String(v))} />
            </div>
            <div className="mt-5 flex justify-end"><Button onClick={save}><Save size={14} className="mr-2" /> Save</Button></div>
          </Card>
        </TabsContent>

        <TabsContent value="roles"><RolesSettings /></TabsContent>
        <TabsContent value="integrations"><IntegrationsSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanySettings() {
  const { data, isLoading, error } = useCompany();
  const updateCompany = useUpdateCompany();
  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const company = data?.company;

  // Seed the form while rendering rather than in an effect: React re-runs this
  // component immediately before painting, so there is no flash of empty inputs
  // and no cascading setState.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (company && seededFor !== company.id) {
    setSeededFor(company.id);
    setErrors({});
    setForm({
      name: company.name ?? "",
      code: company.code ?? "",
      industry: company.industry ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
      timezone: company.timezone ?? "",
      currency: company.currency ?? "",
      status: company.status ?? "ACTIVE",
    });
  }

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  function save() {
    setErrors({});
    updateCompany.mutate(form, {
      onError: (e: any) => setErrors(e?.fields ?? {}),
    });
  }

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-72 rounded-xl" />
      </Card>
    );
  }

  if (error || !company) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm font-medium text-navy">Could not load company details</p>
        <p className="mt-1 text-xs text-muted-foreground">{error?.message}</p>
      </Card>
    );
  }

  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs text-danger">{errors[k]}</p> : null;

  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-navy">Company Information</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Company Name</Label>
          <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className="mt-1" />
          {err("name")}
        </div>
        <div>
          <Label>Industry</Label>
          <Input value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Company Code</Label>
          <Input
            value={form.code ?? ""}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className="mt-1 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Employees type this to sign in on mobile. Changing it locks out anyone using the old code.
          </p>
          {err("code")}
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value.toUpperCase())} className="mt-1" />
          {err("currency")}
        </div>
        <div>
          <Label>Timezone (IANA)</Label>
          <Input value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} className="mt-1 font-mono text-xs" />
          <p className="mt-1 text-xs text-muted-foreground">e.g. Asia/Karachi — drives every timestamp shown.</p>
          {err("timezone")}
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status ?? "ACTIVE"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {err("status")}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={updateCompany.isPending}>
          <Save size={14} className="mr-2" />
          {updateCompany.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </Card>
  );
}

function RolesSettings() {
  const roles = [
    { name: "Super Admin", desc: "Full access to everything", color: "bg-danger-soft text-danger", permissions: ["Everything"] },
    { name: "Company Admin", desc: "Manage company workforce", color: "bg-primary/10 text-primary", permissions: ["Dashboard", "Projects", "Employees", "Attendance", "Reports", "Settings"] },
    { name: "Manager", desc: "Monitor teams & attendance", color: "bg-info-soft text-info", permissions: ["Dashboard", "Live Attendance", "Employees", "Reports"] },
    { name: "Employee", desc: "Self-service portal", color: "bg-success-soft text-success", permissions: ["Assigned Projects", "Own Attendance", "Limited Settings"] },
  ];
  return (
    <div className="space-y-4">
      {roles.map((r) => (
        <Card key={r.name}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", r.color)}>{r.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <span key={p} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{p}</span>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function IntegrationsSettings() {
  const integrations = [
    { name: "Slack", desc: "Send attendance alerts to Slack channels", connected: true, icon: "💬" },
    { name: "Google Maps", desc: "Map provider for live tracking", connected: true, icon: "📍" },
    { name: "QuickBooks", desc: "Sync payroll hours", connected: false, icon: "💼" },
    { name: "Zapier", desc: "Connect 5,000+ apps via Zapier", connected: false, icon: "⚡" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {integrations.map((i) => (
        <Card key={i.name}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{i.icon}</span>
              <div>
                <p className="text-sm font-semibold text-navy">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
            </div>
            {i.connected ? (
              <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Connected</span>
            ) : (
              <Button size="sm" variant="outline">Connect</Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange }: { icon: React.ElementType; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
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
