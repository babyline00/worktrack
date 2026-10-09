"use client";

import { useState } from "react";
import { BRAND } from "../brand";
import {
  FileText,
  CalendarDays,
  Users,
  FolderKanban,
  Clock,
  UserX,
  FileDown,
  CheckCircle2,
  Printer,
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
import { useProjects } from "@/lib/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REPORT_TYPES = [
  { id: "daily", name: "Daily Attendance", desc: "Today's check-in/out records", icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
  { id: "monthly", name: "Monthly Attendance", desc: "Full month attendance summary", icon: FileText, color: "text-success", bg: "bg-success-soft" },
  { id: "hours", name: "Employee Hours", desc: "Total working hours per employee", icon: Clock, color: "text-info", bg: "bg-info-soft" },
  { id: "project", name: "Project Attendance", desc: "Attendance by project", icon: FolderKanban, color: "text-warning", bg: "bg-warning-soft" },
  { id: "late", name: "Late Arrivals", desc: "Employees who arrived late", icon: Users, color: "text-warning", bg: "bg-warning-soft" },
  { id: "absence", name: "Absence Report", desc: "Absent employees report", icon: UserX, color: "text-danger", bg: "bg-danger-soft" },
];

type Summary = {
  totalRecords: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  employees: number;
  flagged: number;
};

export function ReportsPage() {
  const { data: projData } = useProjects();
  const projects = projData?.projects ?? [];

  const [reportType, setReportType] = useState("monthly");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState("csv");
  const [scope, setScope] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: Summary;
    headers: string[];
    rows: unknown[][];
  } | null>(null);

  const query = (fmt?: string) => {
    const p = new URLSearchParams({ type: reportType, from, to, scope, projectId });
    if (fmt) p.set("format", fmt);
    return p.toString();
  };

  async function generate() {
    if (from > to) {
      toast.error("The start date cannot be after the end date");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${query()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Report failed");
      setResult(data);
      toast.success("Report generated", {
        description: `${data.summary.totalRecords} record${data.summary.totalRecords === 1 ? "" : "s"} • ${data.rows.length} row${data.rows.length === 1 ? "" : "s"}`,
      });
    } catch (e: any) {
      // The previous version swallowed the response and always said
      // "Failed to generate report", hiding the real reason.
      toast.error(e?.message ?? "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function download(fmt: "csv" | "excel") {
    // A real download from the API, rather than building a file in the browser.
    const a = document.createElement("a");
    a.href = `/api/reports?${query(fmt)}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function print() {
    if (!result) return;
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) {
      toast.error("Allow pop-ups to print this report");
      return;
    }
    const esc = (v: unknown) =>
      String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    w.document.write(`
      <html><head><title>${BRAND.name} ${esc(reportType)} report</title>
      <style>
        body { font: 12px system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        p.meta { color: #555; margin: 0 0 16px; font-size: 11px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
        th { background: #f4f4f5; }
        td.num, th.num { text-align: right; }
      </style></head><body>
      <h1>${esc(REPORT_TYPES.find((r) => r.id === reportType)?.name ?? reportType)}</h1>
      <p class="meta">${esc(from)} to ${esc(to)} &middot; ${result.summary.totalRecords} records &middot; generated ${esc(new Date().toLocaleString())}</p>
      <table><thead><tr>${result.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${result.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader title="Reports & Analytics" subtitle="Generate detailed workforce reports." />

      <div>
        <p className="mb-3 text-sm font-semibold text-navy">Report Types</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <Card key={r.id} className="cursor-pointer transition hover:border-primary/40 hover:shadow-md" onClick={() => { setReportType(r.id); setResult(null); }}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", r.bg, r.color)}><Icon size={18} /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                  {reportType === r.id && <CheckCircle2 size={16} className="text-primary" />}
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
            <Select value={reportType} onValueChange={(v) => { setReportType(v); setResult(null); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setResult(null); }} className="mt-1" /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setResult(null); }} className="mt-1" /></div>
          </div>
          <div>
            <Label>Employees</Label>
            <Select value={scope} onValueChange={(v) => { setScope(v); setResult(null); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Inactive employees are excluded by history, not hidden.</p>
          </div>
          <div>
            <Label>Projects</Label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setResult(null); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {/* Real projects, not the three hardcoded placeholders this used
                    to offer regardless of what the company actually has. */}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Export Format</Label>
          <RadioGroup value={format} onValueChange={setFormat} className="mt-2 flex flex-wrap gap-2">
            {[
              { v: "csv", label: "CSV" },
              { v: "excel", label: "Excel" },
              { v: "print", label: "Print / PDF" },
            ].map((f) => (
              <label key={f.v} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition", format === f.v ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                <RadioGroupItem value={f.v} className="sr-only" />
                {f.label}
              </label>
            ))}
          </RadioGroup>
          <p className="mt-1 text-xs text-muted-foreground">
            {format === "print"
              ? "Opens a print-ready page — choose “Save as PDF” in the print dialog."
              : "Downloaded from the server with the report's own columns."}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {result && (
            <>
              <Button variant="outline" onClick={() => download("csv")}>
                <FileDown size={14} className="mr-2" /> Download CSV
              </Button>
              <Button variant="outline" onClick={() => download("excel")}>
                <FileDown size={14} className="mr-2" /> Download Excel
              </Button>
              <Button variant="outline" onClick={print}>
                <Printer size={14} className="mr-2" /> Print / PDF
              </Button>
            </>
          )}
          <Button onClick={generate} disabled={loading}>
            <FileDown size={14} className="mr-2" /> {loading ? "Generating…" : "Generate Report"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
            <p className="text-sm font-semibold text-navy">Preview</p>
            <p className="text-xs text-muted-foreground">
              {result.summary.totalRecords} records &middot; {result.summary.employees} employees &middot;{" "}
              {result.summary.present} present &middot; {result.summary.late} late &middot;{" "}
              {result.summary.absent} absent &middot;{" "}
              {result.summary.flagged > 0 && <span className="text-danger">{result.summary.flagged} flagged for review</span>}
            </p>
          </div>
          {result.rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No attendance in this range. Widen the dates or change the filters.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr className="text-left text-xs text-muted-foreground">
                    {result.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {r.map((c, j) => (
                        <td key={j} className="whitespace-nowrap px-4 py-2 text-muted-foreground">{String(c ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 200 && (
                <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                  Showing the first 200 of {result.rows.length} rows — download for the full set.
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
