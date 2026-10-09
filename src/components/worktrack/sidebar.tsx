"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Radio,
  FolderKanban,
  Users,
  CalendarCheck,
  Clock,
  CalendarHeart,
  FileBarChart,
  Settings,
  LifeBuoy,
  Bell,
  MoreVertical,
  Code2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEmployees, useLeaveRequests } from "@/lib/hooks";
import { BRAND, NasIcon } from "./brand";
import { useApp, type PageKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { Button } from "@/components/ui/button";

const NAV: {
  group?: string;
  items: { key: PageKey; label: string; icon: React.ElementType; badge?: string }[];
}[] = [
  {
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "live", label: "Live Attendance", icon: Radio, badge: "live" },
    ],
  },
  {
    items: [
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "employees", label: "Employees", icon: Users },
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "shifts", label: "Shifts", icon: Clock },
      { key: "leave", label: "Leave Management", icon: CalendarHeart, badge: "leave" },
    ],
  },
  {
    items: [
      { key: "reports", label: "Reports", icon: FileBarChart },
      { key: "api-docs", label: "API Docs", icon: Code2 },
    ],
  },
];

const BOTTOM = [
  { key: "settings" as PageKey, label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { page, setPage, sidebarOpen, setSidebarOpen } = useApp();
  const { data: session } = useSession();
  const { data: empData } = useEmployees();
  const { data: leaveData } = useLeaveRequests();

  // Nav badges used to be fixed strings — "32" working, "5" pending leave —
  // shown regardless of what the database actually held.
  const workingCount = (empData?.employees ?? []).filter(
    (e) => e.todaysStatus === "working" || e.todaysStatus === "late",
  ).length;
  const pendingLeave = (leaveData?.leaves ?? []).filter(
    (l) => l.status === "pending",
  ).length;

  const badgeValue = (badge?: string) => {
    if (badge === "live") return workingCount > 0 ? String(workingCount) : null;
    if (badge === "leave") return pendingLeave > 0 ? String(pendingLeave) : null;
    return badge ?? null;
  };

  const userName = session?.user?.name ?? "Signed in";
  const userInitials =
    userName
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-[72px] items-center gap-2.5 px-5">
          <NasIcon className="h-8 w-8 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-bold tracking-tight text-navy">
              {BRAND.name.toUpperCase()}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {BRAND.descriptor}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
          {NAV.map((section, si) => (
            <div key={si} className="mb-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = page === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setPage(item.key);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "group mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-navy",
                    )}
                  >
                    <Icon
                      className={cn("h-4.5 w-4.5 shrink-0", active && "text-primary")}
                      size={18}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badgeValue(item.badge) !== null && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {badgeValue(item.badge)}
                      </span>
                    )}
                  </button>
                );
              })}
              {si < NAV.length - 1 && (
                <div className="my-2 border-t border-sidebar-border" />
              )}
            </div>
          ))}

          {/* Bottom section */}
          <div className="mt-2">
            {BOTTOM.map((item) => {
              const Icon = item.icon;
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setPage(item.key);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "group mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-navy",
                  )}
                >
                  <Icon
                    className={cn("h-4.5 w-4.5", active && "text-primary")}
                    size={18}
                  />
                  {item.label}
                </button>
              );
            })}
            {/* Was href="#", which jumped to the top of the page. */}
            <button
              onClick={() => { setPage("help"); setSidebarOpen(false); }}
              className={cn(
                "mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted",
                page === "help" ? "text-navy" : "text-muted-foreground hover:text-navy",
              )}
            >
              <LifeBuoy size={18} />
              Help & Support
            </button>
          </div>
        </nav>

        {/* Profile — the name and role came from session data, not a literal. */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
            <Avatar initials={userInitials} color="#2563eb" size={36} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-navy">{userName}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {(session?.user as any)?.role?.toLowerCase() ?? "staff"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title="Account settings"
              onClick={() => setPage("settings")}
            >
              <MoreVertical size={14} />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
