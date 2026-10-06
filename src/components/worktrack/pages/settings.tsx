"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SECTIONS = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "roles", label: "Users & Roles", icon: Users },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export function SettingsPage() {
  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Settings"
        subtitle="Manage company, attendance, security, and integrations."
      />

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

        <TabsContent value="company">
          <CompanySettings />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceSettings />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>
        <TabsContent value="roles">
          <RolesSettings />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanySettings() {
  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-navy">Company Information</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Company Name</Label>
          <Input defaultValue="WorkTrack LLC" className="mt-1" />
        </div>
        <div>
          <Label>Industry</Label>
          <Input defaultValue="Construction & Services" className="mt-1" />
        </div>
        <div>
          <Label>Email</Label>
          <Input defaultValue="admin@worktrack.io" className="mt-1" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input defaultValue="+971 4 123 4567" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Input defaultValue="Business Bay, Dubai, UAE" className="mt-1" />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input defaultValue="Asia/Dubai (GST+4)" className="mt-1" />
        </div>
        <div>
          <Label>Currency</Label>
          <Input defaultValue="AED (د.إ)" className="mt-1" />
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={() => toast.success("Company settings saved")}>
          <Save size={14} className="mr-2" /> Save Changes
        </Button>
      </div>
    </Card>
  );
}

function AttendanceSettings() {
  const [photo, setPhoto] = useState(true);
  const [location, setLocation] = useState(true);
  const [gallery, setGallery] = useState(true);
  const [gps, setGps] = useState(true);
  const [geofence, setGeofence] = useState(true);
  const [autoCheckout, setAutoCheckout] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Check-In Settings</p>
        <div className="space-y-3">
          <ToggleRow
            icon={Camera}
            label="Require Photo"
            desc="Capture photo at check-in"
            checked={photo}
            onChange={setPhoto}
          />
          <ToggleRow
            icon={MapPin}
            label="Require Location"
            desc="GPS location required at check-in"
            checked={location}
            onChange={setLocation}
          />
          <ToggleRow
            icon={ImageOff}
            label="Prevent Gallery Upload"
            desc="Block photo uploads from device gallery"
            checked={gallery}
            onChange={setGallery}
          />
          <ToggleRow
            icon={Crosshair}
            label="Require GPS Accuracy"
            desc="Reject check-ins with poor GPS accuracy"
            checked={gps}
            onChange={setGps}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Maximum GPS Accuracy (meters)</Label>
            <Input type="number" defaultValue={50} className="mt-1" />
          </div>
          <div>
            <Label>Default Geofence Radius (meters)</Label>
            <Input type="number" defaultValue={200} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Geofence & Auto</p>
        <div className="space-y-3">
          <ToggleRow
            icon={MapPin}
            label="Enable Geofence"
            desc="Require employees to be inside project geofence to check in"
            checked={geofence}
            onChange={setGeofence}
          />
          <ToggleRow
            icon={CalendarCheck}
            label="Auto Check-Out"
            desc="Automatically check out employees after shift ends"
            checked={autoCheckout}
            onChange={setAutoCheckout}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Attendance settings saved")}>
          <Save size={14} className="mr-2" /> Save Settings
        </Button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [late, setLate] = useState(true);
  const [absent, setAbsent] = useState(true);
  const [leave, setLeave] = useState(true);
  const [geofence, setGeofence] = useState(true);
  const [daily, setDaily] = useState(false);

  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-navy">
        Notification Preferences
      </p>
      <div className="space-y-3">
        <ToggleRow
          icon={Bell}
          label="Late check-in alerts"
          desc="Notify when an employee checks in late"
          checked={late}
          onChange={setLate}
        />
        <ToggleRow
          icon={Bell}
          label="Absence alerts"
          desc="Notify when an employee is absent"
          checked={absent}
          onChange={setAbsent}
        />
        <ToggleRow
          icon={Bell}
          label="Leave request notifications"
          desc="Notify on new leave requests"
          checked={leave}
          onChange={setLeave}
        />
        <ToggleRow
          icon={Bell}
          label="Geofence violations"
          desc="Notify when an employee is outside project area"
          checked={geofence}
          onChange={setGeofence}
        />
        <ToggleRow
          icon={Bell}
          label="Daily summary email"
          desc="Receive a daily attendance summary at 7:00 PM"
          checked={daily}
          onChange={setDaily}
        />
      </div>
    </Card>
  );
}

function SecuritySettings() {
  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-navy">Security Policy</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Minimum Password Length</Label>
          <Input type="number" defaultValue={8} className="mt-1" />
        </div>
        <div>
          <Label>Session Timeout (minutes)</Label>
          <Input type="number" defaultValue={30} className="mt-1" />
        </div>
        <div>
          <Label>Login Attempt Limit</Label>
          <Input type="number" defaultValue={5} className="mt-1" />
        </div>
        <div>
          <Label>Account Lock Duration (minutes)</Label>
          <Input type="number" defaultValue={15} className="mt-1" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ToggleRow
          icon={Shield}
          label="Require strong password"
          desc="Must include uppercase, lowercase, number, symbol"
          checked
          onChange={() => {}}
        />
        <ToggleRow
          icon={Shield}
          label="Two-factor authentication"
          desc="Require 2FA for admin login"
          checked={false}
          onChange={() => {}}
        />
        <ToggleRow
          icon={Shield}
          label="IP whitelist"
          desc="Restrict admin login to specific IPs"
          checked={false}
          onChange={() => {}}
        />
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={() => toast.success("Security settings saved")}>
          <Save size={14} className="mr-2" /> Save
        </Button>
      </div>
    </Card>
  );
}

function RolesSettings() {
  const roles = [
    {
      name: "Super Admin",
      desc: "Full access to everything",
      color: "bg-danger-soft text-danger",
      permissions: ["Everything"],
    },
    {
      name: "Company Admin",
      desc: "Manage company workforce",
      color: "bg-primary/10 text-primary",
      permissions: [
        "Dashboard",
        "Projects",
        "Employees",
        "Attendance",
        "Reports",
        "Settings",
      ],
    },
    {
      name: "Manager",
      desc: "Monitor teams & attendance",
      color: "bg-info-soft text-info",
      permissions: [
        "Dashboard",
        "Live Attendance",
        "Employees",
        "Reports",
      ],
    },
    {
      name: "Employee",
      desc: "Self-service portal",
      color: "bg-success-soft text-success",
      permissions: ["Assigned Projects", "Own Attendance", "Limited Settings"],
    },
  ];

  return (
    <div className="space-y-4">
      {roles.map((r) => (
        <Card key={r.name}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold",
                    r.color,
                  )}
                >
                  {r.name}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function IntegrationsSettings() {
  const integrations = [
    {
      name: "Slack",
      desc: "Send attendance alerts to Slack channels",
      connected: true,
      icon: "💬",
    },
    {
      name: "Google Maps",
      desc: "Map provider for live tracking",
      connected: true,
      icon: "📍",
    },
    {
      name: "QuickBooks",
      desc: "Sync payroll hours",
      connected: false,
      icon: "💼",
    },
    {
      name: "Zapier",
      desc: "Connect 5,000+ apps via Zapier",
      connected: false,
      icon: "⚡",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {integrations.map((i) => (
        <Card key={i.name}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                {i.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
            </div>
            {i.connected ? (
              <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                Connected
              </span>
            ) : (
              <Button size="sm" variant="outline">
                Connect
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
