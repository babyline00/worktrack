"use client";

import { useState } from "react";
import { Plus, Clock, Users } from "lucide-react";
import { useShifts, useCreateShift } from "@/lib/hooks";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ShiftsPage() {
  const { data, isLoading } = useShifts();
  const createShift = useCreateShift();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [form, setForm] = useState({ name: "", startTime: "", endTime: "", graceMins: "15", breakMins: "45" });

  const shifts = data?.shifts ?? [];

  function toggleDay(d: string) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function submit() {
    if (!form.name) return;
    createShift.mutate({ ...form, workingDays: days.join(",") }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", startTime: "", endTime: "", graceMins: "15", breakMins: "45" });
        setDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
      },
    });
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Shifts"
        subtitle="Define working shifts, grace periods, and break durations."
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} className="mr-2" /> Create Shift</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Clock size={18} /></span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.startTime} – {s.endTime}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-0 bg-success-soft text-success">Active</Badge>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Grace Period</span><span className="font-medium text-navy">{s.graceMins} mins</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Break Duration</span><span className="font-medium text-navy">{s.breakMins} mins</span></div>
              </div>
              <div className="mt-4">
                <p className="mb-1.5 text-xs text-muted-foreground">Working Days</p>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <span key={d} className={cn("rounded px-2 py-0.5 text-[11px] font-medium", s.workingDays.includes(d) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{d}</span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Shift</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Shift Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Evening Shift" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time</Label><Input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} placeholder="02:00 PM" className="mt-1" /></div>
              <div><Label>End Time</Label><Input value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} placeholder="10:00 PM" className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Grace Period (mins)</Label><Input type="number" value={form.graceMins} onChange={(e) => setForm({ ...form, graceMins: e.target.value })} className="mt-1" /></div>
              <div><Label>Break Duration (mins)</Label><Input type="number" value={form.breakMins} onChange={(e) => setForm({ ...form, breakMins: e.target.value })} className="mt-1" /></div>
            </div>
            <div>
              <Label>Working Days</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d} className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition", days.includes(d) ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                    <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={submit} disabled={createShift.isPending}>{createShift.isPending ? "Creating..." : "Create Shift"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
