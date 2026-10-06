"use client";

import { useMemo, useState } from "react";
import { Download, Search, MapPin, X, Calendar as CalIcon } from "lucide-react";
import { useAttendance } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import {
  Avatar,
  Card,
  PageHeader,
  StatusPill,
  VerificationBadge,
} from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AttendancePage() {
  const { attendanceDetailId, setAttendanceDetail } = useApp();
  const { data, isLoading } = useAttendance();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const all = data?.attendance ?? [];
    return all.filter((r) => {
      const q = query.toLowerCase();
      const matchQ = !q || r.employeeName.toLowerCase().includes(q) || r.employeeId.includes(q);
      const matchP = project === "all" || r.project === project;
      const matchS = status === "all" || r.status === status;
      return matchQ && matchP && matchS;
    });
  }, [data, query, project, status]);

  const detail = rows.find((r) => r.id === attendanceDetailId);

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Review and manage employee attendance."
        actions={<Button size="sm" onClick={() => toast.success("Attendance exported as Excel")}><Download size={14} className="mr-2" /> Export</Button>}
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employee..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="Dubai Home Technical">Dubai Home Technical</SelectItem>
              <SelectItem value="ABC Construction">ABC Construction</SelectItem>
              <SelectItem value="Client XYZ">Client XYZ</SelectItem>
              <SelectItem value="Marina Maintenance">Marina Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="working" className="capitalize">Working</SelectItem>
              <SelectItem value="late" className="capitalize">Late</SelectItem>
              <SelectItem value="checked_out" className="capitalize">Checked Out</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => toast.info("Today, October 6, 2026")}>
            <CalIcon size={14} className="mr-2" /> Today
          </Button>
          {(query || project !== "all" || status !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setProject("all"); setStatus("all"); }}>
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Project</th>
                  <th className="px-4 py-3 font-medium">Check-In</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Check-Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Verification</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-navy">No attendance records match your filters</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or clearing the search.</p>
                  </td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-border transition hover:bg-muted/40" onClick={() => setAttendanceDetail(r.id)}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={r.employeeInitials} color={r.avatarColor} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">{r.employeeName}</p>
                          <p className="text-xs text-muted-foreground">{r.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.project}</td>
                    <td className="px-4 py-3 text-sm text-navy">{r.checkIn}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.checkOut ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{r.hoursMins}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status as any} /></td>
                    <td className="hidden px-4 py-3 lg:table-cell"><VerificationBadge status={r.verification as any} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setAttendanceDetail(null)}>
        <SheetContent className="scroll-thin w-full overflow-y-auto sm:max-w-md">
          {detail && (
            <>
              <SheetHeader><SheetTitle>Attendance Details</SheetTitle></SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <div className="flex items-center gap-3 pt-2">
                  <Avatar initials={detail.employeeInitials} color={detail.avatarColor} size={48} />
                  <div>
                    <p className="text-sm font-semibold text-navy">{detail.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{detail.employeeId}</p>
                    <p className="text-xs text-muted-foreground">06 October 2026</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-In</p>
                  <p className="text-2xl font-bold text-navy">{detail.checkIn}</p>
                  <PhotoBox label="Check-In Photo" captured={detail.photoCheckIn} />
                  <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3 text-sm">
                    <Row label="Location" value={detail.location} />
                    <Row label="Coordinates" value={`${detail.coords.lat.toFixed(4)}, ${detail.coords.lng.toFixed(4)}`} mono />
                    <Row label="Accuracy" value={`${detail.accuracyM} meters`} />
                    <Row label="Geofence" value={detail.insideGeofence ? "Inside" : "Outside"} />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-Out</p>
                  <p className="text-2xl font-bold text-navy">{detail.checkOut ?? "—"}</p>
                  <PhotoBox label="Check-Out Photo" captured={detail.photoCheckOut} />
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">{detail.hoursMins}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusPill status={detail.status as any} />
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">Verification</span>
                    <VerificationBadge status={detail.verification as any} />
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => toast.info("Opening location map", { description: detail.location })}>
                  <MapPin size={14} className="mr-2" /> View on Map
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PhotoBox({ label, captured }: { label: string; captured: boolean }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        {captured ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <path d="M3 7a2 2 0 012-2h2l1.5-2h7L17 5h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <p className="text-[11px]">Photo available</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No photo captured</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-navy", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
