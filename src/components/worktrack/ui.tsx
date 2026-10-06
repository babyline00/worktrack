import { cn } from "@/lib/utils";
import type { AttendanceStatus, VerificationStatus } from "@/lib/data";

export function StatusPill({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const map: Record<
    AttendanceStatus,
    { label: string; dot: string; bg: string; text: string }
  > = {
    working: {
      label: "Working",
      dot: "bg-success",
      bg: "bg-success-soft",
      text: "text-success",
    },
    break: {
      label: "On Break",
      dot: "bg-warning",
      bg: "bg-warning-soft",
      text: "text-warning",
    },
    checked_out: {
      label: "Checked Out",
      dot: "bg-muted-foreground",
      bg: "bg-muted",
      text: "text-muted-foreground",
    },
    absent: {
      label: "Absent",
      dot: "bg-danger",
      bg: "bg-danger-soft",
      text: "text-danger",
    },
    late: {
      label: "Late",
      dot: "bg-warning",
      bg: "bg-warning-soft",
      text: "text-warning",
    },
    leave: {
      label: "On Leave",
      dot: "bg-info",
      bg: "bg-info-soft",
      text: "text-info",
    },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
        ✓ Verified
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">
        ✕ Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">
      ⏳ Pending
    </span>
  );
}

export function Avatar({
  initials,
  color,
  size = 36,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  date,
  actions,
}: {
  title: string;
  subtitle?: string;
  date?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-navy">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
        {date && (
          <p className="mt-1 text-sm font-medium text-muted-foreground">{date}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-semibold text-navy">{children}</h3>
      {right}
    </div>
  );
}
