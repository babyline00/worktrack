"use client";

import { useState } from "react";
import { Plus, Clock, Users, Pencil, Trash2 } from "lucide-react";
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift } from "@/lib/hooks";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
  breakMins: number;
  workingDays: string;
};

/** "06:00 PM" / "18:00" -> "18:00"; flexible/blank/unparsable -> "". */
function toTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const m = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h > 23) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export function ShiftsPage() {
  const { data, isLoading } = useShifts();
  const [editing, setEditing] = useState<Shift | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Shift | null>(null);

  const shifts = data?.shifts ?? [];

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Shifts"
        subtitle="Define working shifts, grace periods, and break durations."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-2" /> Create Shift
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : shifts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Clock size={32} className="text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-navy">No shifts defined</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shifts set the expected start time used to flag late arrivals.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-2" /> Create Shift
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.startTime} – {s.endTime}</p>
                  </div>
                </div>
                {/* Edit and Delete sit outside any card-level click target, so
                    neither needs a stopPropagation escape hatch. */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Edit shift"
                    onClick={() => setEditing(s)}
                  >
                    <Pencil size={14} className="text-muted-foreground hover:text-navy" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete shift"
                    onClick={() => setDeleting(s)}
                  >
                    <Trash2 size={14} className="text-muted-foreground hover:text-danger" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grace Period</span>
                  <span className="font-medium text-navy">{s.graceMins} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Break Duration</span>
                  <span className="font-medium text-navy">{s.breakMins} mins</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-1.5 text-xs text-muted-foreground">Working Days</p>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <span
                      key={d}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-medium",
                        s.workingDays.split(",").includes(d)
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users size={13} /> Applies to every project without its own shift
              </div>
            </Card>
          ))}
        </div>
      )}

      {createOpen && <ShiftFormDialog key="create" open onOpenChange={setCreateOpen} />}
      {editing && (
        <ShiftFormDialog
          key={editing.id}
          open
          shift={editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <DeleteShiftDialog shift={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** One form for create and edit, remounted per shift via `key`. */
function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift?: Shift;
}) {
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const isEdit = !!shift;
  const pending = createShift.isPending || updateShift.isPending;

  // Seeded and legacy rows hold 12-hour values ("06:00 PM") or the literal
  // "Variable" for a flexible shift. Convert to HH:MM so <input type="time">
  // can show them; a flexible shift stays blank rather than 00:00.
  const [name, setName] = useState(shift?.name ?? "");
  const [startTime, setStartTime] = useState(toTimeInput(shift?.startTime));
  const [endTime, setEndTime] = useState(toTimeInput(shift?.endTime));
  const [graceMins, setGraceMins] = useState(String(shift?.graceMins ?? 15));
  const [breakMins, setBreakMins] = useState(String(shift?.breakMins ?? 45));
  const [days, setDays] = useState<string[]>(
    shift ? shift.workingDays.split(",").filter(Boolean) : ["Mon", "Tue", "Wed", "Thu", "Fri"],
  );

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function submit() {
    // Blank means a flexible shift with no fixed hours; the API stores
    // "Variable" for that, which the existing card rendering displays.
    const payload = {
      name,
      startTime: startTime || "Variable",
      endTime: endTime || "Variable",
      graceMins,
      breakMins,
      workingDays: days.join(","),
    };
    const onSuccess = () => onOpenChange(false);
    if (shift) updateShift.mutate({ id: shift.id, ...payload }, { onSuccess });
    else createShift.mutate(payload, { onSuccess });
  }

  const valid =
    name.trim() !== "" &&
    (Boolean(startTime) === Boolean(endTime)) &&
    (startTime === "" || /^\d{2}:\d{2}$/.test(startTime)) &&
    (endTime === "" || /^\d{2}:\d{2}$/.test(endTime)) &&
    (startTime === "" || startTime !== endTime) &&
    days.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scroll-thin max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Shift" : "Create Shift"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Shift Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Evening Shift"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
                aria-invalid={!!startTime && !/^\d{2}:\d{2}$/.test(startTime)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
                aria-invalid={!!endTime && !/^\d{2}:\d{2}$/.test(endTime)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            24-hour format. The grace period is how late an employee may arrive before being flagged.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Grace Period (mins)</Label>
              <Input type="number" min={0} max={240} value={graceMins} onChange={(e) => setGraceMins(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Break Duration (mins)</Label>
              <Input type="number" min={0} max={480} value={breakMins} onChange={(e) => setBreakMins(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Working Days</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label
                  key={d}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    days.includes(d)
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                  {d}
                </label>
              ))}
            </div>
            {days.length === 0 && (
              <p className="mt-1 text-xs text-danger">Select at least one working day</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? "Saving…" : isEdit ? "Save Changes" : "Create Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteShiftDialog({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const deleteShift = useDeleteShift();
  return (
    <AlertDialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {shift?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Attendance records that already used this shift block the deletion — you will be
            told how many if that applies. Renaming the shift is safe if you only want to retire it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger text-white hover:bg-danger/90"
            disabled={deleteShift.isPending}
            onClick={() => { if (shift) deleteShift.mutate(shift.id, { onSuccess: onClose }); }}
          >
            {deleteShift.isPending ? "Deleting…" : "Delete Shift"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}