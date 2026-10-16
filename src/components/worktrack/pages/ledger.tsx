"use client";

// Credit / debit balance sheet — internal finance.
//
// Admin-only, matching the /api/ledger routes. Reached from the sidebar, which
// hides the entry for non-admins; the API enforces the same rule, so the hidden
// nav item is not the control, it is only the affordance.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { Avatar, Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/lib/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  entryDate: string;
  type: "CREDIT" | "DEBIT";
  category: string;
  description: string | null;
  reference: string | null;
  status: string;
  amountMinor: number;
  runningMinor: number;
  project: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

type Sheet = {
  period: { from: string; to: string };
  currency: string;
  opening: { credits: number; debits: number; balance: number };
  totals: { credits: number; debits: number; net: number; closingBalance: number };
  byCategory: { category: string; credits: number; debits: number; net: number }[];
  entries: Entry[];
};

/** Suggested categories. Free text is still accepted — these are shortcuts. */
const CATEGORY_SUGGESTIONS = {
  CREDIT: ["Client Payment", "Advance Received", "Refund", "Other Income"],
  DEBIT: ["Payroll", "Equipment", "Fuel & Transport", "Site Materials", "Rent", "Other Expense"],
};

function minor(n: number): number {
  return Math.round(n) / 100;
}

function money(amount: number, currency: string): string {
  return `${currency} ${minor(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function lastOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function LedgerPage() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(lastOfMonth);
  const [projectId, setProjectId] = useState("all");
  const [type, setType] = useState("all");
  const [data, setData] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: projData } = useProjects();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ from, to });
      if (projectId !== "all") q.set("projectId", projectId);
      if (type !== "all") q.set("type", type);
      const res = await fetch(`/api/ledger?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "Could not load the balance sheet");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, projectId, type]);

  useEffect(() => {
    load();
  }, [load]);

  // Newest first reads more naturally in a table, while the running balance
  // was computed oldest-first so it reads top-to-bottom like a statement.
  const rows = useMemo(() => [...(data?.entries ?? [])].reverse(), [data]);

  async function setStatus(entry: Entry, status: string) {
    try {
      const res = await fetch(`/api/ledger/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      toast.success(status === "VOID" ? "Entry voided" : "Entry reinstated");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update the entry");
    }
  }

  async function removeEntry(entry: Entry) {
    const reason = window.prompt(
      `Permanently delete this ${entry.type.toLowerCase()} of ${money(entry.amountMinor, data?.currency ?? "PKR")}?\n\nA reason is required and recorded in the audit log. Use Void instead if you only want to exclude it from balances.`,
    );
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`/api/ledger/${entry.id}`, {
        method: "DELETE",
        headers: { "x-reason": reason.trim() },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      toast.success("Entry deleted");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete the entry");
    }
  }

  const currency = data?.currency ?? "PKR";

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Credit & Debit"
        subtitle="Internal finance. Money received and money paid, with a running balance."
        actions={
          <Button size="sm" onClick={() => setCreating(true)} disabled={loading}>
            <Plus size={14} className="mr-2" /> Add Entry
          </Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 p-3">
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projData?.projects ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="CREDIT">Credit</SelectItem>
              <SelectItem value="DEBIT">Debit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9">
          {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null} Refresh
        </Button>
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertTriangle size={15} /> {error}
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Credits in" value={money(data.totals.credits, currency)} sub={`${data.entries.filter((e) => e.type === "CREDIT" && e.status !== "VOID").length} entries`} icon={<ArrowDownLeft size={15} />} tone="credit" />
            <Summary label="Debits out" value={money(data.totals.debits, currency)} sub={`${data.entries.filter((e) => e.type === "DEBIT" && e.status !== "VOID").length} entries`} icon={<ArrowUpRight size={15} />} tone="debit" />
            <Summary label="Net movement" value={money(data.totals.net, currency)} sub={`opening ${money(data.opening.balance, currency)}`} icon={<Scale size={15} />} tone={data.totals.net >= 0 ? "credit" : "debit"} />
            <Summary label="Closing balance" value={money(data.totals.closingBalance, currency)} sub="credits − debits to date" icon={<Scale size={15} />} tone={data.totals.closingBalance >= 0 ? "credit" : "debit"} emphasis />
          </div>

          {data.byCategory.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">By category</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="truncate text-sm font-medium">{c.category}</span>
                    <span className={cn("text-sm font-medium", c.net >= 0 ? "text-success" : "text-danger")}>
                      {money(Math.abs(c.net), currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            {rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No entries between {data.period.from} and {data.period.to}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Detail</th>
                      <th className="p-3 font-medium">Project</th>
                      <th className="p-3 text-right font-medium">In</th>
                      <th className="p-3 text-right font-medium">Out</th>
                      <th className="p-3 text-right font-medium">Balance</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const voided = e.status === "VOID";
                      return (
                        <tr
                          key={e.id}
                          className={cn(
                            "border-b last:border-0 transition hover:bg-muted/30",
                            voided && "opacity-50",
                          )}
                        >
                          <td className="whitespace-nowrap p-3 text-muted-foreground">
                            {e.entryDate}
                            {voided && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                                Void
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-medium">{e.category}</td>
                          <td className="max-w-[220px] p-3 text-muted-foreground">
                            <span className="block truncate">{e.description || "—"}</span>
                            {e.reference && (
                              <span className="block truncate text-xs">Ref {e.reference}</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">{e.project?.name ?? "—"}</td>
                          <td className="p-3 text-right font-medium text-success">
                            {e.type === "CREDIT" ? money(e.amountMinor, currency) : ""}
                          </td>
                          <td className="p-3 text-right font-medium text-danger">
                            {e.type === "DEBIT" ? money(e.amountMinor, currency) : ""}
                          </td>
                          <td className="p-3 text-right font-medium">
                            <span className={e.runningMinor >= 0 ? "text-navy" : "text-danger"}>
                              {money(e.runningMinor, currency)}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStatus(e, voided ? "POSTED" : "VOID")}
                              >
                                {voided ? "Reinstate" : "Void"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => removeEntry(e)}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            Opening balance carries in everything recorded before {data.period.from}, so a
            filtered period still shows the true position. Voided lines stay visible but
            are excluded from every total. Deleting is permanent and requires a reason.
          </p>
        </>
      )}

      <NewEntryDialog
        open={creating}
        onOpenChange={setCreating}
        currency={currency}
        defaultDate={new Date().toISOString().slice(0, 10)}
        projects={projData?.projects ?? []}
        onSaved={async () => {
          setCreating(false);
          await load();
        }}
      />
    </div>
  );
}

function Summary({
  label,
  value,
  sub,
  icon,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: "credit" | "debit";
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? "border-primary/30 p-4" : "p-4"}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={tone === "credit" ? "text-success" : "text-danger"}>{icon}</span>
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "credit" ? "text-success" : "text-danger",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function NewEntryDialog({
  open,
  onOpenChange,
  currency,
  defaultDate,
  projects,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currency: string;
  defaultDate: string;
  projects: any[];
  onSaved: () => void | Promise<void>;
}) {
  const [type, setType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category,
          amount,
          entryDate,
          description: description || undefined,
          reference: reference || undefined,
          projectId: projectId === "none" ? null : projectId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.errors) setErrors(json.errors);
        throw new Error(json?.error ?? `Could not save (${res.status})`);
      }
      toast.success(`${type === "CREDIT" ? "Credit" : "Debit"} recorded`);
      setCategory("");
      setAmount("");
      setDescription("");
      setReference("");
      await onSaved();
    } catch (e: any) {
      if (!Object.keys(errors).length) toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ledger entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["CREDIT", "DEBIT"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  type === t ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {t === "CREDIT" ? (
                    <ArrowDownLeft size={14} className="text-success" />
                  ) : (
                    <ArrowUpRight size={14} className="text-danger" />
                  )}
                  {t === "CREDIT" ? "Credit" : "Debit"}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t === "CREDIT" ? "Money received" : "Money paid out"}
                </p>
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs">Amount ({currency})</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
            {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={CATEGORY_SUGGESTIONS[type][0]}
              className="mt-1"
            />
            {errors.category ? (
              <p className="mt-1 text-xs text-destructive">{errors.category}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {CATEGORY_SUGGESTIONS[type].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-muted"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1"
              />
              {errors.entryDate && (
                <p className="mt-1 text-xs text-destructive">{errors.entryDate}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-001"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
