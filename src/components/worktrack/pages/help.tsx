"use client";

import { useMemo, useState } from "react";
import {
  LifeBuoy,
  ChevronDown,
  BookOpen,
  Smartphone,
  ShieldCheck,
  MapPin,
  Camera,
  Clock,
  Users,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Help & Support.
 *
 * This existed only as a sidebar `<a href="#">` that jumped to the top of the
 * page — there was no route key, no render branch and no component behind it,
 * so nothing the UI pointed at here went anywhere.
 */

const GUIDES = [
  {
    icon: Smartphone,
    title: "Employee mobile app",
    blurb: "Signing in, check-in and check-out, selfies and geofencing.",
    items: [
      {
        q: "Why is the app asking for my company code?",
        a: "It shouldn't. The company code is baked into the build for your organisation, so employees only enter their employee ID and password. If you are being asked for it, you are on an older build — ask your administrator to reissue the app.",
      },
      {
        q: "My check-in failed. What should I check?",
        a: "Three things, in order. First, GPS: the app rejects a fix it considers stale or inaccurate, so step outside or wait a few seconds for a better lock. Second, the geofence: you must be inside the project radius shown in the app. Third, the network: a check-in needs a connection, and a queued one syncs the moment you are back online.",
      },
      {
        q: "Can I check in more than once a day?",
        a: "Yes. Each check-in/check-out pair is a separate session, and they are all summed for the day. Start a second session whenever you return to site.",
      },
      {
        q: "Do I have to take a photo?",
        a: "Where your administrator requires photo verification, yes. A check-in cannot complete without one, and an auto check-out (for example when you leave the site area) is flagged for review precisely because no selfie could be taken.",
      },
      {
        q: "What happens if I forget to check out?",
        a: "If auto check-out is enabled, the session closes once you have been outside the project radius for the configured grace period — usually five minutes. That record is marked for review because there is no checkout selfie. If it is off, ask an administrator to close the session for you.",
      },
    ],
  },
  {
    icon: MapPin,
    title: "Locations and geofencing",
    blurb: "Project radius, accuracy limits and out-of-area behaviour.",
    items: [
      {
        q: "How is the project radius decided?",
        a: "Per project, under Projects → your project → Settings. Enter the distance in metres that counts as on-site, or 0 for no limit. Company-wide, Settings → Attendance controls whether the geofence applies at all and the maximum GPS accuracy accepted.",
      },
      {
        q: "Why does my check-in say I am outside the zone?",
        a: "Either your position really is beyond the project radius, or the fix is inaccurate enough to be unreliable. The app reports the accuracy in metres — anything worse than the configured maximum is rejected outright.",
      },
    ],
  },
  {
    icon: Camera,
    title: "Photos and verification",
    blurb: "Selfies, storage and what the flags mean.",
    items: [
      {
        q: "Where are the selfies stored?",
        a: "In the WorkTrack database, served only to signed-in staff of your own organisation. They are never publicly addressable, and the API rejects any request without a valid session.",
      },
      {
        q: "What do the verification states mean?",
        a: "Verified means a photo was captured and stored. Pending means no photo was required or none was captured. Flagged means something needs a human look — most often an automatic check-out with no selfie, or a check-in outside the geofence.",
      },
    ],
  },
  {
    icon: Users,
    title: "Managing your team",
    blurb: "Employees, projects, shifts and leave.",
    items: [
      {
        q: "An employee cannot sign in to the app.",
        a: "They need a user account, not just an employee record. When you create an employee and set a password, the app login is created with it. Without a password the employee exists for attendance purposes only and cannot sign in anywhere.",
      },
      {
        q: "What is the difference between the company code and the project code?",
        a: "The company code (Settings → Company) identifies your organisation and is what employees type to reach the right tenant. Project codes like ABC-002 identify individual sites and appear throughout attendance and reports.",
      },
      {
        q: "Can I delete a project that has attendance history?",
        a: "Deleting it removes the project assignments and detaches the attendance records from that project — the records survive, but they stop being counted against it. If you only want to stop new check-ins, set the status to Paused instead.",
      },
    ],
  },
  {
    icon: FileText,
    title: "Reports and exports",
    blurb: "The six report types and how to download them.",
    items: [
      {
        q: "Which reports are available?",
        a: "Daily Attendance, Monthly Attendance, Employee Hours, Project Attendance, Late Arrivals and Absence. Each has its own columns rather than being the same list under a different name.",
      },
      {
        q: "How do I get the data out?",
        a: "Generate the report, then Download CSV or Download Excel — both are produced by the server with the report's own columns. Print / PDF opens a print-ready page where your browser can save it as a PDF.",
      },
    ],
  },
];

export function HelpSupportPage() {
  const { setPage } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(GUIDES[0].items[0].q);

  // Search across every guide so one box covers the whole page.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDES.map((g) => ({ guide: g, items: g.items }));
    return GUIDES.map((g) => ({
      guide: g,
      items: g.items.filter(
        (i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const total = results.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Help & Support"
        subtitle="Guides for the WorkTrack admin console and mobile app."
      />

      <Card className="p-4">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help — e.g. geofence, photo, check-out, project code..."
            className="h-11 pl-4"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {query
            ? total > 0
              ? `${total} matching answer${total === 1 ? "" : "s"}`
              : `No answers match "${query}". Try a different word, or contact support below.`
            : "Pick a topic, or search across everything."}
        </p>
      </Card>

      {results.map(({ guide, items }) => {
        const Icon = guide.icon;
        return (
          <Card key={guide.title} className="p-0">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">{guide.title}</p>
                <p className="text-xs text-muted-foreground">{guide.blurb}</p>
              </div>
            </div>
            <div>
              {items.map((item) => {
                const isOpen = open === item.q;
                return (
                  <div key={item.q} className="border-b border-border last:border-0">
                    <button
                      onClick={() => setOpen(isOpen ? null : item.q)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                    >
                      <span className="text-sm font-medium text-navy">{item.q}</span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "shrink-0 text-muted-foreground transition",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {isOpen && (
                      <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            <p className="text-sm font-semibold text-navy">API reference</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Every mobile and admin endpoint, with a request runner you can point at
            this deployment.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setPage("api-docs")}>
            Open API Docs
          </Button>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-success" />
            <p className="text-sm font-semibold text-navy">Your data</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Records are scoped to your company. Other tenants cannot see your employees,
            attendance, notifications or leave requests.
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-warning" />
            <p className="text-sm font-semibold text-navy">Still stuck?</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Include the employee's ID, the approximate time, and what the app displayed.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a href={`mailto:support@worktrack.io?subject=${encodeURIComponent("WorkTrack support request")}`}>
              Contact support
            </a>
          </Button>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <Clock size={11} /> Attendance records keep for the company's lifetime
        </Badge>
        <Badge variant="outline" className="gap-1">
          <LifeBuoy size={11} /> Docs reflect this deployment
        </Badge>
      </div>
    </div>
  );
}