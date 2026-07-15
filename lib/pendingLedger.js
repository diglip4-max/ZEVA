import crypto from "crypto";
import mongoose from "mongoose";
import PatientPendingLedger from "../models/PatientPendingLedger";
import Billing from "../models/Billing";

/* ============================================================
   Patient Pending Ledger - Central Helper Utility
   Single source of truth for every AED of pending balance.

   Architecture decision (see plan):
     Ledger lives in its own collection (PatientPendingLedger)
     instead of an embedded subdocument array on Billing.
     Reasons: multi-branch rollups, partial refunds scoped to a
     specific treatment/package, audit trail per clearance,
     dispute / write-off workflow, horizontal sharding,
     partial indexes, and the 16MB document ceiling.
============================================================ */

/**
 * Generate a stable, sortable ledger id.
 * Format: PL-<yyyyMMdd>-<10char base36 hash>
 */
export function newLedgerId() {
  const date = new Date();
  const ymd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 10).toUpperCase();
  return `PL-${ymd}-${rand}`;
}

/* ============================================================
   createLedgerEntry
   Creates a new Open ledger row attached to a billing.
   Call this whenever a billing ends up with pending > 0
   (or when a previously closed invoice is being reopened).
============================================================ */
export async function createLedgerEntry({
  clinicId,
  branchId = null,
  patientId,
  parentBillingId,
  appointmentId = null,
  invoiceNumber,
  service,
  treatmentSlug = null,
  treatmentName = null,
  packageId = null,
  packageName = null,
  serviceId = null,
  patientPackageId = null,
  patientPackageSubId = null,
  amount,
  currency = "AED",
  createdBy = null,
  session = null,
}) {
  if (!clinicId || !patientId || !parentBillingId || !invoiceNumber || !service) {
    throw new Error("createLedgerEntry: missing required fields");
  }
  const amt = Number(amount || 0);
  if (amt <= 0) {
    return null; // nothing to track
  }

  const entry = new PatientPendingLedger({
    ledgerId: newLedgerId(),
    clinicId,
    branchId,
    patientId,
    parentBillingId,
    appointmentId,
    invoiceNumber,
    service,
    treatmentSlug,
    treatmentName,
    packageId,
    packageName,
    serviceId,
    patientPackageId,
    patientPackageSubId,
    originalAmount: Number(amt.toFixed(2)),
    paidAmount: 0,
    remainingAmount: Number(amt.toFixed(2)),
    currency,
    status: "Open",
    createdBy,
    clearances: [],
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  // Update cached fields on the parent billing for fast legacy reads.
  await recomputeBillingCache(parentBillingId, session);

  return entry;
}

/* ============================================================
   applyClearance (transactional)
   Pays down a list of ledger rows by explicit amounts.
   `allocations` is an array of { ledgerId, amount } objects.
   Returns { ok, breakdown: [{ ledgerId, invoiceNumber, treatmentName, packageName, amountCleared }] }

   - Uses a Mongoose transaction so partial failure rolls back.
   - For each ledger, increments paidAmount, decrements remainingAmount,
     pushes a clearance sub-record, and transitions status Open -> Partial -> Closed.
   - Updates the parent billing's pendingLedgerCached + pendingLedgerOpenCount.
============================================================ */
export async function applyClearance({
  allocations,
  clearingBillingId = null,
  clearingInvoiceNumber = null,
  paymentMethod = null,
  paidBy = null,
  paidByName = null,
  transactionType = "PENDING_CLEARANCE",
  notes = null,
  useTransaction = true,
}) {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error("applyClearance: allocations must be a non-empty array");
  }

  // Normalize + validate allocations
  const normalized = allocations
    .map((a) => ({
      ledgerId: String(a.ledgerId || ""),
      amount: Number(a.amount || 0),
    }))
    .filter((a) => a.ledgerId && a.amount > 0);

  if (normalized.length === 0) {
    throw new Error("applyClearance: no valid allocations");
  }

  const totalAmount = Number(
    normalized.reduce((s, a) => s + a.amount, 0).toFixed(2),
  );

  const run = async (session) => {
    const breakdown = [];
    const affectedBillingIds = new Set();

    for (const alloc of normalized) {
      const ledger = await PatientPendingLedger.findOne({ ledgerId: alloc.ledgerId }).session(session);
      if (!ledger) {
        throw new Error(`applyClearance: ledger not found: ${alloc.ledgerId}`);
      }
      if (["Closed", "WrittenOff", "Refunded"].includes(ledger.status)) {
        throw new Error(
          `applyClearance: ledger ${alloc.ledgerId} is ${ledger.status} and cannot accept payments`,
        );
      }
      if (alloc.amount > ledger.remainingAmount + 0.01) {
        throw new Error(
          `applyClearance: allocation ${alloc.amount} exceeds remaining ${ledger.remainingAmount} on ${alloc.ledgerId}`,
        );
      }

      // Mutate
      ledger.paidAmount = Number((Number(ledger.paidAmount || 0) + alloc.amount).toFixed(2));
      // remainingAmount will be recomputed by the model's pre-save hook
      ledger.clearances.push({
        clearingBillingId,
        clearingInvoiceNumber,
        amount: alloc.amount,
        paidAt: new Date(),
        paidBy,
        paidByName,
        paymentMethod,
        transactionType,
        notes,
      });
      ledger.version = (ledger.version || 1) + 1;

      await ledger.save({ session });
      affectedBillingIds.add(String(ledger.parentBillingId));

      breakdown.push({
        ledgerId: ledger.ledgerId,
        invoiceNumber: ledger.invoiceNumber,
        service: ledger.service,
        treatmentSlug: ledger.treatmentSlug,
        treatmentName: ledger.treatmentName,
        packageId: ledger.packageId,
        packageName: ledger.packageName,
        amountCleared: Number(alloc.amount.toFixed(2)),
        newStatus: ledger.status,
        newRemaining: ledger.remainingAmount,
        paymentMethod: paymentMethod || null,
      });
    }

    // Recompute cached fields on every affected parent billing
    for (const billingId of affectedBillingIds) {
      await recomputeBillingCache(billingId, session);
    }

    return { ok: true, totalAmount, breakdown, affectedBillingIds: Array.from(affectedBillingIds) };
  };

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await run(session);
      });
      return result;
    } finally {
      session.endSession();
    }
  } else {
    return await run(null);
  }
}

/* ============================================================
   applyAutoFifoClearance
   Convenience wrapper: given a total payment amount, walk the
   patient's Open/Partial ledgers oldest first and allocate
   until the payment is exhausted. Returns the same shape as
   applyClearance. Used by the overview "Pay Pending" button.
============================================================ */
export async function applyAutoFifoClearance({
  patientId,
  clinicId,
  totalAmount,
  clearingBillingId = null,
  clearingInvoiceNumber = null,
  paymentMethod = null,
  paidBy = null,
  paidByName = null,
  transactionType = "PENDING_CLEARANCE",
  notes = null,
}) {
  const payment = Number(totalAmount || 0);
  if (payment <= 0) {
    return { ok: true, totalAmount: 0, breakdown: [], affectedBillingIds: [] };
  }

  // Find Open/Partial ledgers for this patient, oldest first.
  // We exclude Closed/WrittenOff/Refunded/Disputed by default.
  const ledgers = await PatientPendingLedger.find({
    patientId,
    clinicId,
    status: { $in: ["Open", "Partial"] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const allocations = [];
  let remaining = payment;
  for (const l of ledgers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(l.remainingAmount || 0));
    if (take > 0) {
      allocations.push({ ledgerId: l.ledgerId, amount: take });
      remaining = Number((remaining - take).toFixed(2));
    }
  }

  if (allocations.length === 0) {
    return { ok: true, totalAmount: 0, breakdown: [], affectedBillingIds: [], warning: "No open ledgers to clear" };
  }

  return await applyClearance({
    allocations,
    clearingBillingId,
    clearingInvoiceNumber,
    paymentMethod,
    paidBy,
    paidByName,
    transactionType,
    notes,
    useTransaction: true,
  });
}

/* ============================================================
   getOpenLedgers
   Returns the array of Open/Partial ledgers for a patient.
   Used by the overview pay modal and the AppointmentBillingModal.
============================================================ */
export async function getOpenLedgers(patientId, clinicId = null, { limit = 100 } = {}) {
  const match = { patientId, status: { $in: ["Open", "Partial"] } };
  if (clinicId) match.clinicId = clinicId;
  return await PatientPendingLedger.find(match)
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

/* ============================================================
   aggregatePatientPending
   Single source of truth for the patient balance card.
============================================================ */
export async function aggregatePatientPending(patientId, clinicId = null) {
  const match = { patientId };
  if (clinicId) match.clinicId = clinicId;

  const result = await PatientPendingLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        total: { $sum: "$remainingAmount" },
        paid: { $sum: "$paidAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  let totalOpen = 0;
  let totalPartial = 0;
  let totalClosed = 0;
  let totalCleared = 0;
  let openCount = 0;

  for (const row of result) {
    if (row._id === "Open") {
      totalOpen += row.total;
      openCount += row.count;
    } else if (row._id === "Partial") {
      totalPartial += row.total;
      openCount += row.count;
    } else if (row._id === "Closed" || row._id === "Refunded") {
      totalClosed += row.total;
    }
    totalCleared += row.paid;
  }

  return {
    totalOpen: Number(totalOpen.toFixed(2)),
    totalPartial: Number(totalPartial.toFixed(2)),
    totalPending: Number((totalOpen + totalPartial).toFixed(2)),
    totalCleared: Number(totalCleared.toFixed(2)),
    openCount,
  };
}

/* ============================================================
   pendingLedgerPreview
   Returns a small list (default 5) of oldest Open/Partial
   ledgers with treatment/package name for UI display.
============================================================ */
export async function pendingLedgerPreview(patientId, clinicId = null, { limit = 5 } = {}) {
  const match = { patientId, status: { $in: ["Open", "Partial"] } };
  if (clinicId) match.clinicId = clinicId;
  return await PatientPendingLedger.find(match)
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("ledgerId invoiceNumber service treatmentName packageName remainingAmount originalAmount paidAmount status createdAt")
    .lean();
}

/* ============================================================
   recomputeBillingCache
   Updates pendingLedgerCached + pendingLedgerOpenCount on a billing
   to mirror the aggregated state of its ledger rows.
============================================================ */
export async function recomputeBillingCache(billingId, session = null) {
  if (!billingId) return;

  console.log("[recomputeBillingCache] Called for billingId:", billingId.toString());

  // Pull ALL ledger rows for this billing (not only open) so we can
  // correctly compute pendingUsed = sum(paidAmount across all rows).
  const allRowsQuery = PatientPendingLedger.find({ parentBillingId: billingId })
    .select("remainingAmount paidAmount originalAmount status")
    .lean();
  const allRows = session ? await allRowsQuery.session(session) : await allRowsQuery;

  console.log("[recomputeBillingCache] Found", allRows.length, "ledger row(s) for billing", billingId.toString());

  let totalRemaining = 0;
  let totalPaid = 0;
  let openCount = 0;
  for (const r of allRows) {
    totalPaid += Number(r.paidAmount || 0);
    if (["Open", "Partial"].includes(r.status)) {
      totalRemaining += Number(r.remainingAmount || 0);
      openCount += 1;
    }
  }
  totalRemaining = Number(totalRemaining.toFixed(2));
  totalPaid = Number(totalPaid.toFixed(2));

  console.log("[recomputeBillingCache] Computed: totalRemaining =", totalRemaining, ", openCount =", openCount);

  // We deliberately DO NOT overwrite legacy Billing.pending here.
  // billing.pending is the single source of truth for the outstanding
  // pending amount.  The ledger collection (PatientPendingLedger) is the
  // detailed breakdown, but the scalar pending on Billing must only be
  // updated by the billing flow itself (add-pending-payment, billing
  // creation, etc.) — never by this cache helper.
  // We only update the cached ledger fields so the UI can show
  // ledger-level detail without querying the ledger collection.
  const update = {
    pendingLedgerCached: totalRemaining,
    pendingLedgerOpenCount: openCount,
  };

  console.log("[recomputeBillingCache] Updating billing", billingId.toString(), "with:", update);

  if (session) {
    await Billing.findByIdAndUpdate(billingId, { $set: update }, { session });
  } else {
    await Billing.findByIdAndUpdate(billingId, { $set: update });
  }
  console.log("[recomputeBillingCache] ✓ Update complete for billing", billingId.toString());
  return update;
}

/* ============================================================
   syncBillingFromLegacy
   Backfill helper: when migrating from scalar pending -> ledger,
   given a billing id, create a single Open ledger row equal to
   billing.pending.  Also fixes existing ledgers whose remainingAmount
   is stale (created by the old pending - pendingUsed logic).
============================================================ */
export async function syncBillingFromLegacy(billing, { session = null, createdBy = null } = {}) {
  if (!billing) return null;
  const existing = await PatientPendingLedger.findOne({ parentBillingId: billing._id }).lean();

  // billing.pending is the single source of truth for the outstanding
  // pending amount.  The ledger remaining must match it exactly so that
  // FIFO clearance allocates the correct amount.
  const remaining = Math.max(0, Number(billing.pending || 0));

  if (existing) {
    // If the existing ledger was created by the old logic (pending - pendingUsed)
    // and has no clearances yet, fix its remainingAmount to match billing.pending.
    const hasClearances = existing.clearances && existing.clearances.length > 0;
    const existingRemaining = Number(existing.remainingAmount || 0);
    if (!hasClearances && existingRemaining !== remaining && remaining > 0) {
      const updateFields = {
        originalAmount: remaining,
        remainingAmount: remaining,
        paidAmount: 0,
      };
      if (session) {
        await PatientPendingLedger.updateOne(
          { _id: existing._id },
          { $set: updateFields },
          { session }
        );
      } else {
        await PatientPendingLedger.updateOne(
          { _id: existing._id },
          { $set: updateFields }
        );
      }
      await recomputeBillingCache(billing._id, session);
      console.log('[syncBillingFromLegacy] Fixed stale ledger', existing.ledgerId, 'remainingAmount:', existingRemaining, '->', remaining);
    }
    return null;
  }

  if (remaining <= 0) {
    // No outstanding pending; still mark cache as 0
    await recomputeBillingCache(billing._id, session);
    return null;
  }

  return await createLedgerEntry({
    clinicId: billing.clinicId,
    branchId: null,
    patientId: billing.patientId,
    parentBillingId: billing._id,
    appointmentId: billing.appointmentId,
    invoiceNumber: billing.invoiceNumber,
    service: billing.service || "Service",
    treatmentSlug: billing.treatmentSlug || null,
    treatmentName: billing.treatment || null,
    packageId: null,
    packageName: billing.package || null,
    serviceId: null,
    patientPackageId: billing.patientPackageId || null,
    patientPackageSubId: billing.patientPackageSubId || null,
    amount: remaining,
    createdBy,
    session,
  });
}

export default {
  newLedgerId,
  createLedgerEntry,
  applyClearance,
  applyAutoFifoClearance,
  getOpenLedgers,
  aggregatePatientPending,
  pendingLedgerPreview,
  recomputeBillingCache,
  syncBillingFromLegacy,
};
