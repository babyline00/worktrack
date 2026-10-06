"use client";

import { create } from "zustand";

export type PageKey =
  | "dashboard"
  | "live"
  | "projects"
  | "employees"
  | "attendance"
  | "shifts"
  | "leave"
  | "reports"
  | "settings"
  | "api-docs";

export type AppView = "login" | "admin" | "employee";

interface AppState {
  // View (auth-gated)
  view: AppView;
  setView: (v: AppView) => void;

  // Page within admin view
  page: PageKey;
  setPage: (p: PageKey) => void;

  // Project detail
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;

  // Employee profile
  selectedEmployeeId: string | null;
  setSelectedEmployee: (id: string | null) => void;

  // Live attendance drawer
  drawerEmployeeId: string | null;
  setDrawerEmployee: (id: string | null) => void;

  // Live attendance detail
  attendanceDetailId: string | null;
  setAttendanceDetail: (id: string | null) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  // Sidebar (mobile)
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Live map view toggle
  liveMapMode: boolean;
  setLiveMapMode: (v: boolean) => void;

  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  view: "login", // start at login; SessionProvider will swap to admin/employee after auth
  setView: (v) => set({ view: v }),

  page: "dashboard",
  setPage: (p) => set({ page: p }),

  selectedProjectId: null,
  setSelectedProject: (id) => set({ selectedProjectId: id }),

  selectedEmployeeId: null,
  setSelectedEmployee: (id) => set({ selectedEmployeeId: id }),

  drawerEmployeeId: null,
  setDrawerEmployee: (id) => set({ drawerEmployeeId: id }),

  attendanceDetailId: null,
  setAttendanceDetail: (id) => set({ attendanceDetailId: id }),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),

  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  liveMapMode: false,
  setLiveMapMode: (v) => set({ liveMapMode: v }),

  theme: "light",
  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    set({ theme: next });
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
  },
}));
