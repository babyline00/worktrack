"use client";

import { useState } from "react";
import {
  FileText,
  CalendarDays,
  Users,
  FolderKanban,
  Clock,
  UserX,
  FileDown,
  CheckCircle2,
} from "lucide-react";
import { Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REPORT_TYPES = [
  {
    id: "daily",
    name: "Daily Attendance",
    desc: "Today's check-in/out records",
    icon: CalendarDays,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "monthly",
    name: "Monthly Attendance",
    desc: "Full month attendance summary",
    icon: FileText,
    color: "text-success",
    bg: "bg-success-soft",
  },
  {
    id: "hours",
    name: "Employee Hours",
    desc: "Total working hours per employee",
    icon: Clock,
    color: "text-info",
    bg: "bg-info-soft",
  },
  {
    id: "project",
    name: "Project Attendance",
    desc: "Attendance by project",
    icon: FolderKanban,
    color: "text-warning",
    bg: "bg-warning-soft",
  },
  {
    id: "late",
    name: "Late Arrivals",
    desc: "Employees who arrived late",
    icon: Users,
    color: "text-warning",
    bg: "bg-warning-soft",
  },
  {
    id: "absence",
    name: "Absence Report",
    desc: "Absent employees report",
    icon: UserX,
    color: "text-danger",
    bg: "bg-danger-soft",
  },
];

export function ReportsPage() {
  const [reportType, setReportType] = useState("monthly");
  const [from, setFrom] = useState("01 Oct 2026");
  const [to, setTo] = useState("31 Oct 2026");
  const [format, setFormat] = useState("pdf");

  function generate() {
    toast.success("Report generated", {
      description: `${reportType.toUpperCase()} report • ${from} → ${to} • ${format.toUpperCase()}`,
    });
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate detailed workforce reports."
      />

      <div>
        <p className="mb-3 text-sm font-semibold text-navy">Report Types</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <Card
                key={r.id}
                className="cursor-pointer transition hover:border-primary/40 hover:shadow-md"
                onClick={() => setReportType(r.id)}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      r.bg,
                      r.color,
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.desc}
                    </p>
                  </div>
                  {reportType === r.id && (
                    <CheckCircle2 size={16} className="text-primary" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <p className="mb-4 text-sm font-semibold text-navy">Generate Report</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Employees</Label>
            <Select defaultValue="all">
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="custom">Custom Selection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Projects</Label>
            <Select defaultValue="all">
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="p1">Dubai Home Technical</SelectItem>
                <SelectItem value="p2">ABC Construction</SelectItem>
                <SelectItem value="p3">Client XYZ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Format</Label>
          <RadioGroup
            value={format}
            onValueChange={setFormat}
            className="mt-2 flex gap-2"
          >
            {["pdf", "excel", "csv"].map((f) => (
              <label
                key={f}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium uppercase transition",
                  format === f
                    ? "border-primary bg-accent text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <RadioGroupItem value={f} className="sr-only" />
                {f}
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={generate}>
            <FileDown size={14} className="mr-2" /> Generate Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
