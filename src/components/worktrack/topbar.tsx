"use client";

import { useEffect } from "react";
import { Menu, Search, Bell, HelpCircle, ChevronDown } from "lucide-react";
import { useApp } from "@/lib/store";
import { Avatar } from "./ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EMPLOYEES, PROJECTS, NOTIFICATIONS } from "@/lib/data";
import { cn } from "@/lib/utils";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  live: "Live Attendance",
  projects: "Projects",
  employees: "Employees",
  attendance: "Attendance",
  shifts: "Shifts",
  leave: "Leave Management",
  reports: "Reports",
  settings: "Settings",
};

export function Topbar() {
  const { setPage, setSearchOpen, searchOpen, setSidebarOpen, page } = useApp();
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  // Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </Button>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-navy">
            {PAGE_LABELS[page] ?? "Dashboard"}
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Good morning, Ahmad
          </p>
        </div>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="group hidden h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-navy sm:flex"
        >
          <Search size={16} />
          <span>Search…</span>
          <kbd className="ml-6 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Ctrl K
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search size={18} />
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold text-navy">Notifications</p>
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            </div>
            <div className="scroll-thin max-h-96 overflow-y-auto">
              {NOTIFICATIONS.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left transition hover:bg-muted",
                    n.unread && "bg-accent/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.unread ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {n.timeAgo}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <DropdownMenuItem className="justify-center py-2 text-sm font-medium text-primary">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help"
          className="hidden sm:inline-flex"
        >
          <HelpCircle size={18} />
        </Button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-muted">
              <Avatar initials="AH" color="#2563eb" size={32} />
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold text-navy">Ahmad</p>
                <p className="text-[11px] text-muted-foreground">Administrator</p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-navy">Ahmad</p>
                <p className="text-xs text-muted-foreground">admin@worktrack.io</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPage("settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>Activity Log</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Search command palette */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search employees, projects, attendance…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {Object.entries(PAGE_LABELS).map(([k, label]) => (
              <CommandItem
                key={k}
                onSelect={() => {
                  setPage(k as any);
                  setSearchOpen(false);
                }}
              >
                <Search size={14} className="opacity-50" />
                <span>{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Employees">
            {EMPLOYEES.slice(0, 8).map((e) => (
              <CommandItem
                key={e.id}
                onSelect={() => {
                  setPage("employees");
                  useApp.setState({ selectedEmployeeId: e.id });
                  setSearchOpen(false);
                }}
              >
                <Avatar
                  initials={e.initials}
                  color={e.avatarColor}
                  size={20}
                />
                <span>
                  {e.firstName} {e.lastName}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {e.empId}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Projects">
            {PROJECTS.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  setPage("projects");
                  useApp.setState({ selectedProjectId: p.id });
                  setSearchOpen(false);
                }}
              >
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>{p.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {p.code}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
