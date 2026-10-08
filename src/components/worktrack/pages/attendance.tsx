"use client";

import { useMemo, useState } from "react";
import { Download, Search, MapPin, X, Calendar as CalIcon, Eye, Pencil, User as UserIcon } from "lucide-react";
import { useAttendance, useEmployeeByEmpId, useEmployees } from "@/lib/hooks";
import { AdjustAttendanceDialog } from "@/components/worktrack/adjust-attendance-dialog";
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
  const { attendanceDetailId, setAttendanceDetail, setPage } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useAttendance(date);
  const { data: empData } = useEmployees();
  const detail = data?.attendance?.find((r) => r.id === attendanceDetailId);
  // Resolve through the API rather than the loaded employee list, which may
  // not include this employee.
  // `empId` is the human code; `employeeId` is the internal row id and the
  // lookup hook matches on the code.
  const { data: looked, isFetching: looking } = useEmployeeByEmpId(detail?.empId);
  const [query, setQuery] = useState("");
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const adjusting =
    data?.attendance?.find((r) => r.id === adjustId) ?? null;
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("all");

  // Both lists come from the data actually present, so a project or status the
  // API can return is always selectable. The previous hardcoded lists meant a
  // renamed or newly created project could never be filtered for.
  const projectNames = useMemo(
    () => [...new Set((data?.attendance ?? []).map((r) => r.project).filter((p) => p && p !== "—"))].sort(),
    [data],
  );
  const availableStatuses = useMemo(
    () => [...new Set((data?.attendance ?? []).map((r) => r.status))].sort(),
    [data],
  );

    const rows = useMemo(() => {
    const all = data?.attendance ?? [];
    return all.filter((r) => {
      const q = query.toLowerCase();
      const matchQ = !q || r.employeeName.toLowerCase().includes(q) || r.empId.includes(q);
      const matchP = project === "all" || r.project === project;
      const matchS = status === "all" || r.status === status;
      return matchQ && matchP && matchS;
    });
  }, [data, query, project, status]);

  /** Opens the employee's full record, fetched on demand if not already loaded. */
  const openEmployee = async (empId: string | undefined) => {
    if (!empId) return;
    // Prefer an exact hit from the already-loaded list to avoid a round trip.
    const local = empData?.employees?.find((e) => String(e.empId) === empId);
    const found = local ?? looked?.employees?.[0];
    if (!found) {
      toast.error("Employee not found", {
        description: `No employee record matches ID ${empId}.`,
      });
      return;
    }
    setAttendanceDetail(null);
    setPage("employees");
    useApp.setState({ selectedEmployeeId: found.id });
  };

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Review and manage employee attendance."
        actions={
          <Button
            size="sm"
            onClick={() => {
              // This only showed a toast claiming an export had happened.
              const day = date ?? new Date().toISOString().slice(0, 10);
              const a = document.createElement("a");
              a.href = `/api/reports?type=daily&from=${day}&to=${day}&format=csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              toast.success("Attendance exported", { description: `Downloaded as CSV for ${day}` });
            }}
          >
            <Download size={14} className="mr-2" /> Export
          </Button>
        }
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
              {projectNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[140px] capitalize"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {availableStatuses.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[150px]"
              aria-label="Attendance date"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setDate(new Date().toISOString().slice(0, 10))}
            >
              <CalIcon size={14} className="mr-2" /> Today
            </Button>
          </div>
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
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center">
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
                          <p className="text-xs text-muted-foreground">{r.empId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.project}</td>
                    <td className="px-4 py-3 text-sm text-navy">{r.checkIn}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.checkOut ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{r.hoursMins}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status as any} /></td>
                    <td className="hidden px-4 py-3 lg:table-cell"><VerificationBadge status={r.verification as any} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAttendanceDetail(r.id); }}>
                          <Eye size={12} className="mr-1" /> View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAdjustId(r.id); }}
                          title="Manually correct the captured times">
                          <Pencil size={12} className="mr-1" /> Adjust
                        </Button>
                      </div>
                    </td>
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
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{detail.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{detail.empId}</p>
                    <p className="text-xs text-muted-foreground">{detail.date}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={looking}
                    onClick={() => openEmployee(detail.empId)}
                    title={`Open the full record for ${detail.employeeName}`}
                  >
                    <UserIcon size={12} className="mr-1" />
                    {looking ? "Loading…" : "View Employee Details"}
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-In</p>
                  <p className="text-2xl font-bold text-navy">{detail.checkIn}</p>
                  <PhotoBox label="Check-In Photo" captured={detail.photoCheckIn} photoUrl={detail.checkInPhotoUrl ?? null} />
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
                  <PhotoBox label="Check-Out Photo" captured={detail.photoCheckOut} photoUrl={detail.checkOutPhotoUrl ?? null} />
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

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Previously this only fired a toast containing the address;
                    // it opened nothing. Open the coordinates it already has.
                    const { lat, lng } = detail.coords;
                    if (!lat && !lng) {
                      toast.error("No coordinates were recorded for this check-in");
                      return;
                    }
                    window.open(
                      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
                      "_blank",
                      "noopener",
                    );
                  }}
                >
                  <MapPin size={14} className="mr-2" /> View on Map
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AdjustAttendanceDialog
        key={adjustId ?? "none"}
        attendanceId={adjustId}
        employeeName={adjusting?.employeeName}
        employeeId={adjusting?.employeeId}
        checkIn={adjusting?.checkInIso}
        checkOut={adjusting?.checkOutIso}
        workingMinutes={adjusting?.workingMinutes}
        open={!!adjustId}
        onOpenChange={(v) => { if (!v) setAdjustId(null); }}
      />
    </div>
  );
}

/**
 * The actual selfie. This drew a hardcoded camera icon and the words "Photo
 * available" whenever a photo existed, so nobody reviewing attendance could
 * see who had actually checked in.
 */
function PhotoBox({
  label,
  photoUrl,
  captured,
}: {
  label: string;
  photoUrl: string | null;
  captured: boolean;
}) {
  // The stored photoUrl points at the JWT route the mobile app uses; the admin
  // UI authenticates with a session cookie, so swap in the sibling route.
  const src = photoUrl?.includes("/api/v1/attendance/photo/")
    ? photoUrl.replace("/api/v1/attendance/photo/", "/api/attendance/photo/")
    : photoUrl ?? null;

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
        {src ? (
          <img
            src={src}
            alt={`${label} selfie`}
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : captured ? (
          <p className="text-xs text-muted-foreground">Photo unavailable</p>
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
