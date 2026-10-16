"use client";

// Month-to-date cash position, shown on the admin Dashboard.
//
// Deliberately a separate fetch rather than another field on /api/dashboard:
// that endpoint is cached and on the hot path, and adding a finance aggregate
// to it would make everyone's dashboard load depend on a ledger nobody else
// should even be able to read. Only admins mount this at all.

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Scale } from "lucide-react";
import { Card } from "./ui";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

type Sheet = {
  currency: string;
  opening: { balance: number };
  totals: { credits: number; debits: number; net: number; closingBalance: number };
};

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DashboardFinanceCard() {
  const { setPage } = useApp();
  const [data, setData] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .slice(0, 10);
        const res = await fetch(`/api/ledger?from=${first}&to=${last}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // A finance card that cannot load is omitted rather than shown empty,
        // so nobody reads a zero balance as "the company is broke".
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading position…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const net = data.totals.net;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Scale size={14} /> Cash position — this month
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setPage("ledger")}
        >
          Open ledger
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Opening" value={money(data.opening.balance, data.currency)} />
        <Figure
          label="Credits in"
          value={money(data.totals.credits, data.currency)}
          icon={<ArrowDownLeft size={13} className="text-success" />}
          tone="text-success"
        />
        <Figure
          label="Debits out"
          value={money(data.totals.debits, data.currency)}
          icon={<ArrowUpRight size={13} className="text-danger" />}
          tone="text-danger"
        />
        <Figure
          label="Closing"
          value={money(data.totals.closingBalance, data.currency)}
          hint={`net ${net >= 0 ? "+" : ""}${money(net, data.currency)}`}
          emphasis
          tone={net >= 0 ? "text-success" : "text-danger"}
        />
      </div>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
  icon,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-semibold tabular-nums",
          emphasis ? "text-xl" : "text-base",
          tone ?? "text-navy",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
