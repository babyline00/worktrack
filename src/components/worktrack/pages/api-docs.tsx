"use client";

import { useState } from "react";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Play, Check, Key, Smartphone, Shield, Database } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  desc: string;
  auth: "JWT" | "JWT+ADMIN" | "PUBLIC";
  body?: string;
  example?: string;
}

const GROUPS: { title: string; icon: React.ElementType; endpoints: Endpoint[] }[] = [
  {
    title: "Authentication",
    icon: Key,
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/auth/login",
        desc: "Login with companyCode + employeeId + password. Returns JWT access + refresh tokens.",
        auth: "PUBLIC",
        body: `{
  "companyCode": "WT001",
  "employeeId": "2585436360",
  "password": "employee123",
  "deviceId": "ANDROID-DEVICE-123",
  "deviceModel": "Samsung SM-A546E",
  "appVersion": "1.0.0"
}`,
        example: `{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "user": { "id": "...", "employeeId": "2585436369", "role": "EMPLOYEE" }
  }
}`,
      },
      {
        method: "POST",
        path: "/api/v1/auth/refresh",
        desc: "Exchange refresh token for a new access token.",
        auth: "PUBLIC",
        body: `{ "refreshToken": "eyJ..." }`,
      },
      {
        method: "POST",
        path: "/api/v1/auth/logout",
        desc: "Revoke the refresh token.",
        auth: "JWT",
        body: `{ "refreshToken": "eyJ..." }`,
      },
      {
        method: "GET",
        path: "/api/v1/auth/me",
        desc: "Get the authenticated user's profile + linked employee record.",
        auth: "JWT",
      },
    ],
  },
  {
    title: "Mobile App API",
    icon: Smartphone,
    endpoints: [
      { method: "GET", path: "/api/v1/mobile/dashboard", desc: "Employee's home screen — today's attendance, projects, recent history.", auth: "JWT" },
      { method: "GET", path: "/api/v1/mobile/projects", desc: "Projects assigned to the employee with geofence coords + radius.", auth: "JWT" },
      { method: "GET", path: "/api/v1/mobile/profile", desc: "Get employee profile (email, phone, department, designation, projects).", auth: "JWT" },
      { method: "PATCH", path: "/api/v1/mobile/profile", desc: "Update email/phone.", auth: "JWT", body: `{ "phone": "+92 300 1234567", "email": "new@worktrack.io" }` },
      { method: "GET", path: "/api/v1/mobile/attendance/today", desc: "Today's attendance record with photos, location, geofence status.", auth: "JWT" },
      { method: "GET", path: "/api/v1/mobile/attendance/history?page=1&limit=20&from=2026-10-01&to=2026-10-31", desc: "Paginated attendance history with date range.", auth: "JWT" },
      {
        method: "POST",
        path: "/api/v1/mobile/attendance/check-in",
        desc: "Check-in with photo upload (multipart/form-data). Validates JWT, project, assignment, geofence (haversine), GPS accuracy, idempotency. Creates notification + WebSocket event.",
        auth: "JWT",
        body: `multipart/form-data:
projectId: prj_xxx
latitude: 25.2049
longitude: 55.2709
accuracy: 8.4
capturedAt: 2026-10-06T10:32:14+04:00
deviceId: ANDROID-123
deviceModel: Samsung SM-A546E
appVersion: 1.0.0
photo: <image/jpeg file>

Header: Idempotency-Key: <uuid>`,
      },
      {
        method: "POST",
        path: "/api/v1/mobile/attendance/check-out",
        desc: "Check-out with photo upload. Calculates working minutes, marks session COMPLETED, creates notification.",
        auth: "JWT",
        body: `multipart/form-data:
attendanceId: att_xxx
latitude: 25.2050
longitude: 55.2710
accuracy: 9.1
capturedAt: 2026-10-06T18:14:42+04:00
deviceId: ANDROID-123
photo: <image/jpeg file>

Header: Idempotency-Key: <uuid>`,
      },
      { method: "POST", path: "/api/v1/mobile/attendance/photo-upload-url", desc: "Get a presigned upload URL + fileKey for direct photo upload (S3-style).", auth: "JWT", body: `{ "type": "CHECK_IN", "fileName": "photo.jpg" }` },
      {
        method: "POST",
        path: "/api/v1/mobile/location",
        desc: "Live location ping during WORKING session. Stores in AttendanceLocation, recomputes geofence, alerts if employee leaves area.",
        auth: "JWT",
        body: `{ "attendanceId": "att_xxx", "latitude": 25.2051, "longitude": 55.2712, "accuracy": 10, "recordedAt": "2026-10-06T10:45:12+04:00" }`,
      },
      { method: "POST", path: "/api/v1/mobile/devices", desc: "Register a mobile device for push notifications (FCM token).", auth: "JWT", body: `{ "deviceId": "ANDROID-123", "platform": "ANDROID", "model": "Samsung SM-A546E", "osVersion": "15", "appVersion": "1.0.0", "pushToken": "FCM_TOKEN" }` },
      { method: "GET", path: "/api/v1/mobile/notifications", desc: "Paginated notifications for the employee.", auth: "JWT" },
    ],
  },
  {
    title: "Admin Dashboard API",
    icon: Shield,
    endpoints: [
      { method: "GET", path: "/api/v1/dashboard/summary", desc: "KPIs: totalEmployees, present, workingNow, absent, late, onLeave.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/dashboard/live-attendance?projectId=&status=", desc: "Live attendance list with filters.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/dashboard/live-map", desc: "Currently working employees with their latest GPS coordinates for map rendering.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/dashboard/alerts", desc: "Today's alerts: late check-ins, geofence violations, missing photos, missed checkouts.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/employees?page=1&limit=20&search=&status=&departmentId=", desc: "Paginated employee list with filters.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/employees", desc: "Create employee. Auto-creates unique (companyId, empId) constraint.", auth: "JWT+ADMIN", body: `{ "employeeId": "2585436399", "firstName": "New", "lastName": "Employee", "email": "new@worktrack.io", "phone": "+92 300 1234567", "departmentId": "dep_xxx", "designation": "Engineer", "projectIds": ["prj_xxx"] }` },
      { method: "GET", path: "/api/v1/employees/:id", desc: "Employee profile with assigned projects.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/employees/:id", desc: "Update employee fields.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/employees/:id/status", desc: "Activate/deactivate employee (soft delete). Audit logged.", auth: "JWT+ADMIN", body: `{ "status": "INACTIVE" }` },
      { method: "DELETE", path: "/api/v1/employees/:id", desc: "Soft delete (sets INACTIVE). Attendance history preserved.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/projects", desc: "List projects with today's attendance stats.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/projects", desc: "Create project with geofence.", auth: "JWT+ADMIN", body: `{ "name": "New Project", "code": "NEW-001", "clientName": "Client", "latitude": 25.2, "longitude": 55.2, "geofenceRadius": 200, "timezone": "Asia/Karachi", "startDate": "2026-10-06", "status": "ACTIVE" }` },
      { method: "PATCH", path: "/api/v1/projects/:id", desc: "Update project.", auth: "JWT+ADMIN" },
      { method: "DELETE", path: "/api/v1/projects/:id", desc: "Delete project (cascades assignments).", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/projects/:id/employees", desc: "Assign multiple employees to project.", auth: "JWT+ADMIN", body: `{ "employeeIds": ["emp_001", "emp_002"] }` },
      { method: "DELETE", path: "/api/v1/projects/:id/employees/:employeeId", desc: "Remove employee from project.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/attendance?employeeId=&projectId=&status=&from=&to=&page=&limit=", desc: "Paginated attendance records with full filters.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/attendance/:id", desc: "Attendance detail with check-in/out photos, GPS, accuracy, audit history, location trail.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/attendance/:id/adjust", desc: "Manual attendance adjustment. Audit logs old/new values + reason. Marks record FLAGGED.", auth: "JWT+ADMIN", body: `{ "checkInAt": "2026-10-06T09:00:00+04:00", "checkOutAt": "2026-10-06T17:00:00+04:00", "reason": "Employee forgot to check out." }` },
      { method: "GET", path: "/api/v1/leaves", desc: "List leave requests.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/leaves", desc: "Create leave request (admin on behalf of employee).", auth: "JWT+ADMIN", body: `{ "employeeId": "emp_xxx", "type": "ANNUAL", "from": "2026-10-10", "to": "2026-10-11", "reason": "Family event" }` },
      { method: "PATCH", path: "/api/v1/leaves/:id/approve", desc: "Approve leave. Audit logged + notification created.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/leaves/:id/reject", desc: "Reject leave. Audit logged + notification created.", auth: "JWT+ADMIN", body: `{ "reason": "Not enough coverage" }` },
      { method: "GET", path: "/api/v1/shifts", desc: "List shifts.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/shifts", desc: "Create shift with grace/break/working days.", auth: "JWT+ADMIN", body: `{ "name": "Morning Shift", "startTime": "09:00 AM", "endTime": "05:00 PM", "graceMins": "15", "breakMins": "45", "workingDays": "Mon,Tue,Wed,Thu,Fri" }` },
      { method: "GET", path: "/api/v1/company", desc: "Get company info.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/company", desc: "Update company info.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/departments", desc: "List departments with employee counts.", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/departments", desc: "Create department.", auth: "JWT+ADMIN", body: `{ "name": "Marketing" }` },
      { method: "GET", path: "/api/v1/notifications", desc: "Paginated notifications.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/notifications/read-all", desc: "Mark all as read.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/settings", desc: "Get all company settings as key-value map.", auth: "JWT+ADMIN" },
      { method: "PATCH", path: "/api/v1/settings", desc: "Bulk upsert settings.", auth: "JWT+ADMIN", body: `{ "REQUIRE_PHOTO": "true", "MAX_GPS_ACCURACY": "50", "GEOFENCE_ENABLED": "true" }` },
    ],
  },
  {
    title: "Reports API",
    icon: Database,
    endpoints: [
      { method: "GET", path: "/api/v1/reports/attendance/daily?date=2026-10-06&projectId=", desc: "Daily attendance report with summary.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/reports/attendance/monthly?month=2026-10&projectId=", desc: "Monthly attendance grouped by employee.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/reports/working-hours?from=2026-10-01&to=2026-10-31", desc: "Working hours per employee in date range.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/reports/late?from=&to=", desc: "Late arrivals report.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/reports/absence?from=&to=", desc: "Absence report (missing attendance on working days).", auth: "JWT+ADMIN" },
      { method: "POST", path: "/api/v1/reports/generate", desc: "Generate report (creates async job, returns download URL).", auth: "JWT+ADMIN", body: `{ "type": "monthly", "from": "2026-10-01", "to": "2026-10-31", "format": "csv" }` },
      { method: "GET", path: "/api/v1/reports/jobs/:id", desc: "Check report job status.", auth: "JWT+ADMIN" },
      { method: "GET", path: "/api/v1/reports/jobs/:id/download", desc: "Download generated report (CSV).", auth: "JWT+ADMIN" },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-info-soft text-info",
  POST: "bg-success-soft text-success",
  PATCH: "bg-warning-soft text-warning",
  DELETE: "bg-danger-soft text-danger",
};

export function ApiDocsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tester, setTester] = useState({ method: "POST", path: "/api/v1/auth/login", body: `{ "companyCode": "WT001", "employeeId": "2585436360", "password": "employee123" }`, token: "" });
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copied to clipboard");
  }

  async function runTest() {
    setLoading(true);
    setResponse("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tester.token) headers["Authorization"] = `Bearer ${tester.token}`;
      const res = await fetch(tester.path, {
        method: tester.method,
        headers,
        body: ["GET", "DELETE"].includes(tester.method) ? undefined : tester.body,
      });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="API Documentation"
        subtitle="Complete REST API specification — /api/v1/* — JWT-authenticated, multi-tenant, idempotent, audit-logged."
        actions={<Badge variant="outline" className="border-0 bg-success-soft text-success">v1.0</Badge>}
      />

      {/* Quick info cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <Key size={18} className="text-primary" />
          <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Authentication</p>
          <p className="mt-1 text-sm text-navy">JWT (HS256)</p>
          <p className="mt-1 text-xs text-muted-foreground">Access: 15 min • Refresh: 30 days • Rotation supported</p>
        </Card>
        <Card className="p-4">
          <Shield size={18} className="text-success" />
          <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Multi-Tenant</p>
          <p className="mt-1 text-sm text-navy">Company-scoped</p>
          <p className="mt-1 text-xs text-muted-foreground">All queries filtered by companyId from JWT</p>
        </Card>
        <Card className="p-4">
          <Database size={18} className="text-info" />
          <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Idempotency</p>
          <p className="mt-1 text-sm text-navy">Idempotency-Key header</p>
          <p className="mt-1 text-xs text-muted-foreground">Safe retries on check-in/out</p>
        </Card>
      </div>

      {/* Interactive tester */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Play size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-navy">Interactive API Tester</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-2">
            <Label className="text-xs">Method</Label>
            <select
              value={tester.method}
              onChange={(e) => setTester({ ...tester, method: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {["GET", "POST", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-7">
            <Label className="text-xs">Endpoint</Label>
            <Input
              value={tester.path}
              onChange={(e) => setTester({ ...tester, path: e.target.value })}
              className="mt-1 font-mono text-xs"
              placeholder="/api/v1/..."
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Bearer Token (optional)</Label>
            <Input
              value={tester.token}
              onChange={(e) => setTester({ ...tester, token: e.target.value })}
              className="mt-1 font-mono text-xs"
              placeholder="eyJ..."
            />
          </div>
        </div>
        {!["GET", "DELETE"].includes(tester.method) && (
          <div className="mt-3">
            <Label className="text-xs">Request Body (JSON)</Label>
            <Textarea
              value={tester.body}
              onChange={(e) => setTester({ ...tester, body: e.target.value })}
              rows={4}
              className="mt-1 font-mono text-xs"
            />
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button onClick={runTest} disabled={loading}>
            <Play size={14} className="mr-2" /> {loading ? "Sending..." : "Send Request"}
          </Button>
        </div>
        {response && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs">Response</Label>
              <Button variant="ghost" size="sm" onClick={() => copy(response, "resp")}>
                {copied === "resp" ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />} Copy
              </Button>
            </div>
            <pre className="scroll-thin max-h-80 overflow-auto rounded-lg bg-navy p-3 text-xs text-white">
              {response}
            </pre>
          </div>
        )}
      </Card>

      {/* Endpoints by group */}
      <Tabs defaultValue={GROUPS[0].title}>
        <TabsList className="flex-wrap">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <TabsTrigger key={g.title} value={g.title} className="gap-1.5">
                <Icon size={14} />
                <span className="hidden sm:inline">{g.title}</span>
                <Badge variant="outline" className="ml-1 border-0 bg-muted text-[10px] text-muted-foreground">{g.endpoints.length}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {GROUPS.map((group) => (
          <TabsContent key={group.title} value={group.title} className="space-y-2">
            {group.endpoints.map((ep, i) => {
              const id = `${group.title}-${i}`;
              const isExpanded = expanded === id;
              return (
                <Card key={id} className="p-0">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold w-14 text-center", METHOD_COLORS[ep.method])}>
                      {ep.method}
                    </span>
                    <code className="flex-1 font-mono text-xs text-navy">{ep.path}</code>
                    <Badge variant="outline" className={cn(
                      "border-0 text-[10px]",
                      ep.auth === "PUBLIC" ? "bg-muted text-muted-foreground" : ep.auth === "JWT+ADMIN" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                    )}>
                      {ep.auth}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border p-3">
                      <p className="text-sm text-muted-foreground">{ep.desc}</p>
                      {ep.body && (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold text-navy">Request Body</p>
                            <Button variant="ghost" size="sm" onClick={() => copy(ep.body!, `${id}-body`)}>
                              {copied === `${id}-body` ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />} Copy
                            </Button>
                          </div>
                          <pre className="scroll-thin max-h-60 overflow-auto rounded-lg bg-navy p-3 text-xs text-white">{ep.body}</pre>
                        </div>
                      )}
                      {ep.example && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-semibold text-navy">Example Response</p>
                          <pre className="scroll-thin max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs text-navy">{ep.example}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* Demo credentials */}
      <Card className="bg-accent/30">
        <h3 className="mb-2 text-sm font-semibold text-navy">Demo Credentials</h3>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Admin (NextAuth UI)</p>
            <p className="font-mono text-navy">admin@worktrack.io / admin123</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Employee (Mobile API)</p>
            <p className="font-mono text-navy">companyCode: WT001</p>
            <p className="font-mono text-navy">employeeId: 2585436360</p>
            <p className="font-mono text-navy">password: employee123</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
