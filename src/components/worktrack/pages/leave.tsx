"use client";

import { Check, X } from "lucide-react";
import { useLeaveRequests, useApproveLeave } from "@/lib/hooks";
import { Avatar, Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LeavePage() {
  const { data, isLoading } = useLeaveRequests();
  const approveLeave = useApproveLeave();
  const requests = data?.leaves ?? [];

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6 fade-in">
      <PageHeader title="Leave Management" subtitle="Review and approve employee leave requests." />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="mt-1 text-2xl font-bold text-warning">{stats.pending}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Approved</p><p className="mt-1 text-2xl font-bold text-success">{stats.approved}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Rejected</p><p className="mt-1 text-2xl font-bold text-danger">{stats.rejected}</p></Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Leave Type</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">From</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">To</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No leave requests</td></tr>
                )}
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border transition hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={r.employeeInitials} color={r.avatarColor} size={32} />
                        <p className="text-sm font-medium text-navy">{r.employeeName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className="border-0 bg-info-soft text-info">{r.type}</Badge></td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.from}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{r.to}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy">{r.days}</td>
                    <td className="hidden max-w-[200px] px-4 py-3 text-sm text-muted-foreground lg:table-cell"><span className="line-clamp-1">{r.reason}</span></td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("border-0 capitalize", r.status === "approved" ? "bg-success-soft text-success" : r.status === "rejected" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7 border-success text-success hover:bg-success-soft" disabled={approveLeave.isPending} onClick={() => approveLeave.mutate({ id: r.id, status: "approved" })}>
                            <Check size={14} />
                          </Button>
                          <Button size="icon" variant="outline" className="h-7 w-7 border-danger text-danger hover:bg-danger-soft" disabled={approveLeave.isPending} onClick={() => approveLeave.mutate({ id: r.id, status: "rejected" })}>
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (<span className="text-xs text-muted-foreground">—</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
