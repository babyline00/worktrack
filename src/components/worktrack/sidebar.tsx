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
} from "lucide-react";
import { useApp, type PageKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { NOTIFICATIONS } from "@/lib/data";
import { Button } from "@/components/ui/button";

const NAV: {
  group?: string;
  items: { key: PageKey; label: string; icon: React.ElementType; badge?: string }[];
}[] = [
  {
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "live", label: "Live Attendance", icon: Radio, badge: "32" },
    ],
  },
  {
    items: [
      { key: "projects", label: "Projects", icon: FolderKanban },
      { key: "employees", label: "Employees", icon: Users },
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "shifts", label: "Shifts", icon: Clock },
      { key: "leave", label: "Leave Management", icon: CalendarHeart, badge: "5" },
    ],
  },
  {
    items: [{ key: "reports", label: "Reports", icon: FileBarChart }],
  },
];

const BOTTOM = [
  { key: "settings" as PageKey, label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { page, setPage, sidebarOpen, setSidebarOpen } = useApp();

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="M4 7h16M4 12h10M4 17h7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="18" cy="17" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-navy">
              WORKTRACK
            </p>
            <p className="text-[11px] text-muted-foreground">
              Workforce Management
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
                    {item.badge && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.badge}
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
            <a
              href="#"
              className="mt-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-navy"
            >
              <LifeBuoy size={18} />
              Help & Support
            </a>
          </div>
        </nav>

        {/* Profile */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
            <Avatar initials="AH" color="#2563eb" size={36} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-navy">Ahmad</p>
              <p className="truncate text-xs text-muted-foreground">
                Administrator
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <MoreVertical size={14} />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
