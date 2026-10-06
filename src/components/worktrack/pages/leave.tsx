"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { LEAVE_REQUESTS } from "@/lib/data";
import { Avatar, Card, PageHeader } from "../ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LeavePage() {
  const [requests, setRequests] = useState(LEAVE_REQUESTS);

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  function action(id: string, status: "approved" | "rejected") {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    toast[status === "approved" ? "success" : "error"](
      status === "approved"
        ? "Leave request approved"
        : "Leave request rejected",
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Leave Management"
        subtitle="Review and approve employee leave requests."
      />

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold text-warning">{stats.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {stats.approved}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Rejected</p>
          <p className="mt-1 text-2xl font-bold text-danger">
            {stats.rejected}
          </p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Leave Type</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  From
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  To
                </th>
                <th className="px-4 py-3 font-medium">Days</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Reason
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border transition hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        initials={r.employeeInitials}
                        color={r.avatarColor}
                        size={32}
                      />
                      <p className="text-sm font-medium text-navy">
                        {r.employeeName}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className="border-0 bg-info-soft text-info"
                    >
                      {r.type}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                    {r.from}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                    {r.to}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-navy">
                    {r.days}
                  </td>
                  <td className="hidden max-w-[200px] px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                    <span className="line-clamp-1">{r.reason}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-0 capitalize",
                        r.status === "approved"
                          ? "bg-success-soft text-success"
                          : r.status === "rejected"
                            ? "bg-danger-soft text-danger"
                            : "bg-warning-soft text-warning",
                      )}
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 border-success text-success hover:bg-success-soft"
                          onClick={() => action(r.id, "approved")}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 border-danger text-danger hover:bg-danger-soft"
                          onClick={() => action(r.id, "rejected")}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
