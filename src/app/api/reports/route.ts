import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/reports?type=monthly&from=2026-10-01&to=2026-10-31
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as any).companyId;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "monthly";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  const from = fromStr ? new Date(fromStr) : new Date(new Date().setDate(new Date().getDate() - 30));
  const to = toStr ? new Date(toStr) : new Date();
  to.setHours(23, 59, 59, 999);

  const records = await db.attendance.findMany({
    where: {
      date: { gte: from, lte: to },
      employee: { companyId },
    },
    include: { employee: true, project: true },
    orderBy: { date: "asc" },
  });

  const summary = {
    type,
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
    totalRecords: records.length,
    present: records.filter((r) => r.status === "PRESENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    leave: records.filter((r) => r.status === "LEAVE").length,
    totalHoursMins: records.reduce((sum, r) => sum + r.workingMins, 0),
    avgHoursPerEmployee: 0,
  };
  const uniqueEmps = new Set(records.map((r) => r.employeeId)).size;
  summary.avgHoursPerEmployee = uniqueEmps > 0 ? Math.round(summary.totalHoursMins / uniqueEmps) : 0;

  return NextResponse.json({
    summary,
    records: records.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      employee: `${r.employee.firstName} ${r.employee.lastName}`,
      empId: r.employee.empId,
      project: r.project?.name ?? "—",
      checkIn: r.checkIn?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
      checkOut: r.checkOut?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—",
      hours: r.workingMins,
      status: r.status.toLowerCase(),
      verification: r.verification.toLowerCase(),
    })),
  });
}
