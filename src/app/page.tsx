"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useApp } from "@/lib/store";
import { Sidebar } from "@/components/worktrack/sidebar";
import { Topbar } from "@/components/worktrack/topbar";
import { LoginScreen } from "@/components/worktrack/login";
import { EmployeeMobileView } from "@/components/worktrack/employee-mobile";
import { DashboardHome } from "@/components/worktrack/pages/dashboard";
import { LiveAttendancePage } from "@/components/worktrack/pages/live";
import { ProjectsPage } from "@/components/worktrack/pages/projects";
import { EmployeesPage } from "@/components/worktrack/pages/employees";
import { AttendancePage } from "@/components/worktrack/pages/attendance";
import { ShiftsPage } from "@/components/worktrack/pages/shifts";
import { LeavePage } from "@/components/worktrack/pages/leave";
import { ReportsPage } from "@/components/worktrack/pages/reports";
import { SettingsPage } from "@/components/worktrack/pages/settings";
import { ApiDocsPage } from "@/components/worktrack/pages/api-docs";

export default function Home() {
  const { data: session, status } = useSession();
  const { view, setView, page } = useApp();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Auto-route based on session
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user) {
      const role = (session.user as any).role;
      if (view === "login") {
        setView(role === "EMPLOYEE" ? "employee" : "admin");
      }
    } else if (status === "unauthenticated") {
      setView("login");
    }
  }, [status, session, view, setView]);

  // Avoid hydration mismatch
  if (!hydrated) return null;

  if (status === "loading" || view === "login") {
    return <LoginScreen />;
  }

  if (view === "employee") {
    return <EmployeeMobileView />;
  }

  // Admin view
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-[250px]">
        <Topbar />
        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {page === "dashboard" && <DashboardHome />}
          {page === "live" && <LiveAttendancePage />}
          {page === "projects" && <ProjectsPage />}
          {page === "employees" && <EmployeesPage />}
          {page === "attendance" && <AttendancePage />}
          {page === "shifts" && <ShiftsPage />}
          {page === "leave" && <LeavePage />}
          {page === "reports" && <ReportsPage />}
          {page === "settings" && <SettingsPage />}
          {page === "api-docs" && <ApiDocsPage />}
        </main>
      </div>
    </div>
  );
}
