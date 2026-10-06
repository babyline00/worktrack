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
  | "settings";

interface AppState {
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
}

export const useApp = create<AppState>((set) => ({
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
}));
