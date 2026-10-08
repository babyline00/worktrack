"use client";

// Manual attendance adjustment for admins.
//
// Corrects times that were captured wrongly (a forgotten check-out, a missed
// scan). The reason is mandatory and the record is flagged FLAGGED server-side
// so an adjustment is always distinguishable from a clean capture.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdjustAttendance } from "@/lib/hooks";

/** `"2026-10-08T14:30"` — what `<input type="datetime-local">` produces. */
function toLocalInput(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function AdjustAttendanceDialog({
  attendanceId,
  employeeName,
  employeeId,
  checkIn,
  checkOut,
  workingMinutes: initialMinutes,
  open,
  onOpenChange,
}: {
  attendanceId: string | null;
  employeeName?: string;
  employeeId?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingMinutes?: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Seeded once on mount; the parent remounts this dialog via `key` whenever a
  // different record is chosen, so there is no effect to synchronise.
  const [checkInAt, setCheckInAt] = useState(() => toLocalInput(checkIn));
  const [checkOutAt, setCheckOutAt] = useState(() => toLocalInput(checkOut));
  const [workingMinutes, setWorkingMinutes] = useState(() =>
    typeof initialMinutes === "number" ? String(initialMinutes) : "",
  );
  const [reason, setReason] = useState("");
  const adjust = useAdjustAttendance();

  const submit = async () => {
    if (!attendanceId) return;
    await adjust.mutateAsync({
      id: attendanceId,
      // datetime-local has no timezone; send it as local time.
      checkInAt: checkInAt ? new Date(checkInAt).toISOString() : undefined,
      checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : undefined,
      workingMinutes: workingMinutes ? Number(workingMinutes) : undefined,
      reason,
    });
    onOpenChange(false);
  };

  const canSubmit = reason.trim().length > 0 && !adjust.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust attendance</DialogTitle>
          <DialogDescription>
            {employeeName ? `${employeeName} · ${employeeId}` : employeeId}
            <br />
            Corrects a captured record. This is audit logged and the record will
            be marked as flagged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adj-in">Check-in</Label>
              <Input
                id="adj-in"
                type="datetime-local"
                value={checkInAt}
                onChange={(e) => setCheckInAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-out">Check-out</Label>
              <Input
                id="adj-out"
                type="datetime-local"
                value={checkOutAt}
                onChange={(e) => setCheckOutAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-mins">Working minutes (optional)</Label>
            <Input
              id="adj-mins"
              type="number"
              min={0}
              placeholder="Leave blank to calculate from the times above"
              value={workingMinutes}
              onChange={(e) => setWorkingMinutes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-reason">Reason *</Label>
            <Textarea
              id="adj-reason"
              rows={2}
              placeholder="e.g. Employee forgot to check out; site manager confirmed."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {adjust.isPending ? "Saving…" : "Save adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}