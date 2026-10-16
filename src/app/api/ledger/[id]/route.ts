import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCompanyRole, CONFIG_WRITE_ROLES } from "@/lib/api-auth";
import { auditLog, startOfDayInTimezone } from "@/lib/v1";
import {
  parseAmountToMinor,
  minorToDecimal,
  minorToAmount,
  CREDIT,
  DEBIT,
  POSTED,
  VOID,
} from "@/lib/ledger";

// PATCH  /api/ledger/:id  — correct an existing line
// DELETE /api/ledger/:id  — remove a line outright
//
// A DELETE is genuinely destructive and leaves no trace, so the UI offers VOID
// (PATCH with status) instead — that keeps the line visible in the statement
// and excludes it from every balance. Delete exists for rows that were created
// in error and have no business appearing at all.

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
    if ("error" in auth) return auth.error;
    const { companyId, userId } = auth;

    const body = await req.json().catch(() => ({}));
    const errors: Record<string, string> = {};

    // Scope the lookup to the tenant. A bare findUnique by id would let an
    // admin of one company edit another company's ledger.
    const existing = await db.ledgerEntry.findFirst({
      where: { id: (await params).id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (status !== POSTED && status !== VOID) {
        errors.status = "Status must be POSTED or VOID";
      } else {
        data.status = status;
      }
    }

    if (body.type !== undefined) {
      const type = String(body.type).toUpperCase();
      if (type !== CREDIT && type !== DEBIT) errors.type = "Type must be Credit or Debit";
      else data.type = type;
    }

    if (body.category !== undefined) {
      const category = String(body.category).trim();
      if (!category) errors.category = "Category is required";
      else data.category = category.slice(0, 80);
    }

    if (body.amount !== undefined) {
      const minor = parseAmountToMinor(body.amount);
      if (minor == null) {
        errors.amount = "Enter a positive amount with at most 2 decimal places";
      } else {
        data.amount = minorToDecimal(minor);
      }
    }

    if (body.description !== undefined) {
      data.description = body.description ? String(body.description).slice(0, 500) : null;
    }
    if (body.reference !== undefined) {
      data.reference = body.reference ? String(body.reference).slice(0, 80) : null;
    }

    if (body.entryDate !== undefined) {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate))
        ? new Date(`${body.entryDate}T12:00:00Z`)
        : new Date(body.entryDate);
      if (isNaN(d.getTime())) {
        errors.entryDate = "Invalid date";
      } else {
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: { timezone: true },
        });
        data.entryDate = startOfDayInTimezone(
          company?.timezone ?? "Asia/Karachi",
          d,
        );
      }
    }

    if (body.projectId !== undefined) {
      if (!body.projectId) {
        data.projectId = null;
      } else {
        const project = await db.project.findFirst({
          where: { id: String(body.projectId), companyId },
          select: { id: true },
        });
        if (!project) errors.projectId = "Project not found";
        else data.projectId = project.id;
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Please fix the highlighted fields", errors }, { status: 400 });
    }

    const oldValue = {
      type: existing.type,
      category: existing.category,
      amount: existing.amount.toString(),
      status: existing.status,
      reference: existing.reference,
    };

    const updated = await db.ledgerEntry.update({
      where: { id: existing.id },
      data,
    });

    await auditLog({
      action: "LEDGER_ENTRY_UPDATED",
      entity: "ledgerEntry",
      entityId: updated.id,
      performedById: userId,
      companyId,
      oldValue,
      newValue: {
        type: updated.type,
        category: updated.category,
        amount: updated.amount.toString(),
        status: updated.status,
        reference: updated.reference,
      },
      reason: body.reason ? String(body.reason).slice(0, 300) : undefined,
      req,
    });

    return NextResponse.json({
      entry: {
        id: updated.id,
        type: updated.type,
        category: updated.category,
        amount: minorToAmount(Math.round(updated.amount.toNumber() * 100)),
        status: updated.status,
      },
      message: "Entry updated",
    });
  } catch {
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyRole(CONFIG_WRITE_ROLES);
    if ("error" in auth) return auth.error;
    const { companyId, userId } = auth;

    const existing = await db.ledgerEntry.findFirst({
      where: { id: (await params).id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // A balance-sheet line is a financial record, so a reason is required —
    // the same rule as an attendance adjustment.
    const reason = String(req.headers.get("x-reason") ?? "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to delete a ledger entry" },
        { status: 400 },
      );
    }

    await db.ledgerEntry.delete({ where: { id: existing.id } });

    await auditLog({
      action: "LEDGER_ENTRY_DELETED",
      entity: "ledgerEntry",
      entityId: existing.id,
      performedById: userId,
      companyId,
      oldValue: {
        type: existing.type,
        category: existing.category,
        amount: existing.amount.toString(),
        reference: existing.reference,
      },
      reason: reason.slice(0, 300),
      req,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
