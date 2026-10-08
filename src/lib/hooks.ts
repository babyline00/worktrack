"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============= Types =============
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
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
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
      if (!res.ok) throw new Error("Failed to delete employee");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Employee deleted");
    },
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
      const res = await fetch("/api/attendance");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.attendance.filter((a: AttendanceRow) => a.employeeId === employeeId);
    },
    enabled: !!employeeId,
  });
}
