"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============= Types =============
export interface AttendanceLeg {
  at: string;
  time: string;
  coords: { lat: number; lng: number } | null;
  location: string | null;
  accuracyM: number | null;
  photoId: string | null;
  insideGeofence: boolean | null;
}

export interface Employee {
  id: string;
  empId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  status: string;
  avatarColor: string;
  initials: string;
  projects: string[];
  projectIds: string[];
  project: string;
  location: string;
  coords: { lat: number; lng: number };
  todaysStatus: string;
  checkIn?: string;
  checkOut?: string;
  workingTimeMins: number;
  accuracyM: number;
  lastUpdatedSec: number;
  photoCaptured: boolean;
  insideGeofence: boolean;
  presentThisMonth: number;
  lateThisMonth: number;
  totalHours: number;
  attendanceRate: number;
  /** Latest session's two legs, kept separate so the UI can show both. */
  checkInDetail: AttendanceLeg | null;
  checkOutDetail: AttendanceLeg | null;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client?: string;
  description?: string;
  status: string;
  location?: string;
  coords: { lat: number; lng: number };
  radiusM: number;
  startDate: string;
  endDate?: string;
  totalEmployees: number;
  presentToday: number;
  workingNow: number;
  lateToday: number;
  absentToday: number;
  /** Lifetime attendance rows, used to state delete impact honestly. */
  totalAttendance: number;
}

export interface AttendanceRow {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  avatarColor: string;
  project: string;
  checkIn: string;
  checkOut?: string;
  /** ISO timestamps — the exact values, unlike the display strings above. */
  checkInIso?: string | null;
  checkOutIso?: string | null;
  workingMinutes?: number;
  hoursMins: string;
  status: string;
  verification: string;
  location: string;
  coords: { lat: number; lng: number };
  accuracyM: number;
  photoCheckIn: boolean;
  photoCheckOut: boolean;
  insideGeofence: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  avatarColor: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
  breakMins: number;
  workingDays: string;
}

export interface DashboardData {
  kpis: {
    totalEmployees: number;
    present: number;
    workingNow: number;
    absent: number;
    late: number;
    leave: number;
    presentPct: number;
  };
  donut: { name: string; value: number; color: string }[];
  trend: { label: string; value: number }[];
  projectPerformance: { id: string; name: string; present: number; total: number; pct: number }[];
  liveAttendance: any[];
  alerts: any[];
  notifications: any[];
}

// ============= Hooks =============
export function useDashboard(trendDays?: 7 | 30 | 90) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard", trendDays ?? 7],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?trendDays=${trendDays ?? 7}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    refetchInterval: 30_000, // refresh every 30s
  });
}

export function useEmployees() {
  return useQuery<{ employees: Employee[] }>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });
}

/**
 * Resolves one employee by their human-facing employee ID.
 *
 * The attendance table shows `empId` (e.g. 987654321) while the employees list
 * is keyed by internal id, and that list may be paginated — so looking the
 * employee up in already-loaded data fails for anyone not on page 1.
 */
export function useEmployeeByEmpId(empId: string | undefined) {
  return useQuery<{ employees: Employee[] }>({
    queryKey: ["employee-by-empid", empId],
    enabled: !!empId,
    queryFn: async () => {
      const res = await fetch(
        `/api/employees?search=${encodeURIComponent(empId ?? "")}`,
      );
      if (!res.ok) throw new Error("Failed to load employee");
      const body = await res.json();
      return {
        // Match exactly — a partial `contains` search can return several
        // employees whose ids share this prefix.
        employees: (body?.employees ?? []).filter(
          (e: Employee) => String(e.empId) === String(empId),
        ),
      };
    },
  });
}

export function useProjects() {
  return useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });
}

export function useAttendance(date?: string) {
  return useQuery<{ attendance: AttendanceRow[] }>({
    queryKey: ["attendance", date ?? "today"],
    queryFn: async () => {
      const url = date ? `/api/attendance?date=${date}` : "/api/attendance";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load attendance");
      return res.json();
    },
  });
}

export function useLeaveRequests() {
  return useQuery<{ leaves: LeaveRequest[] }>({
    queryKey: ["leave"],
    queryFn: async () => {
      const res = await fetch("/api/leave");
      if (!res.ok) throw new Error("Failed to load leave requests");
      return res.json();
    },
  });
}

export function useShifts() {
  return useQuery<{ shifts: Shift[] }>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error("Failed to load shifts");
      return res.json();
    },
  });
}

export function useSettings() {
  return useQuery<{ settings: Record<string, string> }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });
}

export function useNotifications() {
  return useQuery<{ notifications: any[] }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
  });
}

// ============= Mutations =============
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Project created successfully");
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to create project"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, any>) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to update project");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Project updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to update project"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Project deleted");
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || "Failed to add employee");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Employee added successfully", {
        description: data.message || "Login access enabled",
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to add employee"),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete employee");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      const deleted = data?.deleted;
      toast.success("Employee permanently deleted", {
        description: deleted
          ? `${deleted.attendance} attendance, ${deleted.attendancePhotos} photos, ${deleted.leaveRequests} leaves, ${deleted.assignments} assignments removed`
          : "All related records removed",
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete employee"),
  });
}

/**
 * Manually corrects an attendance record.
 *
 * The record is flagged FLAGGED server-side and the change is audit logged, so
 * adjustments are always attributable.
 */
export function useAdjustAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      checkInAt,
      checkOutAt,
      workingMinutes,
      reason,
    }: {
      id: string;
      checkInAt?: string;
      checkOutAt?: string;
      workingMinutes?: number;
      reason: string;
    }) => {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInAt, checkOutAt, workingMinutes, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to adjust attendance");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Attendance adjusted", {
        description: "The record was flagged and the change was audit logged.",
      });
    },
    onError: (e: Error) => toast.error("Adjustment failed", { description: e.message }),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update leave");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast[vars.status === "approved" ? "success" : "error"](
        vars.status === "approved" ? "Leave request approved" : "Leave request rejected",
      );
    },
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit leave request");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Leave request submitted");
    },
  });
}

export interface CompanyProfile {
  id: string;
  name: string;
  code: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  status: string;
}

export function useCompany() {
  return useQuery<{ company: CompanyProfile }>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await fetch("/api/company");
      if (!res.ok) throw new Error("Failed to load company");
      return res.json();
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CompanyProfile>) => {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body?.error ?? "Failed to save company"), { fields: body?.errors });
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Company details saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to save company"),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/shifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to update shift");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to update shift"),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shifts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to delete shift");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Unable to delete shift"),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create shift");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift created successfully");
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Check-in failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["employee-attendance"] });
      toast.success(
        data.status === "LATE" ? "Checked in (late)" : "Checked in successfully",
        { description: data.insideGeofence ? undefined : "⚠ Outside project geofence" },
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Check-in failed"),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/attendance/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Check-out failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["employee-attendance"] });
      toast.success("Checked out successfully");
    },
    onError: (e: any) => toast.error(e.message ?? "Check-out failed"),
  });
}

// Employee's own attendance
export function useMyAttendance(employeeId?: string) {
  return useQuery({
    queryKey: ["employee-attendance", employeeId],
    queryFn: async () => {
      // Filtered server-side. This used to download the whole company's
      // attendance and filter in the browser, which both exposed every
      // employee's records to an employee session and matched nothing anyway.
      const res = await fetch(`/api/attendance?employeeId=${encodeURIComponent(employeeId ?? "")}&limit=100`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!employeeId,
  });
}
