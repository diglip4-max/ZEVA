// scripts/migrate-petty-cash-legacy.js
//
// ONE-TIME BACKFILL — run once, safe to re-run (idempotent).
//
// Purpose: PettyCash used to store expenses/allocations as embedded arrays
// (PettyCash.expenses[], PettyCash.allocatedAmounts[]). A schema refactor
// moved new writes to separate PettyCashExpense / PettyCashAllocation
// collections, but old embedded records were never copied over — they
// still sit in the raw `expenses`/`allocatedAmounts` fields of PettyCash
// documents (visible in Compass, invisible to the current schema/queries).
//
// This script copies each embedded item into its own PettyCashExpense /
// PettyCashAllocation document, reusing the ORIGINAL _id so the script is
// safe to run multiple times (it skips anything already migrated).
//
// IMPORTANT: it does NOT touch PettyCash.totalSpent / totalAllocated —
// those rollup numbers were already correct pre-refactor and stay correct.
// This script only backfills the missing *detail* records.
//
// Usage:
//   node -r dotenv/config scripts/migrate-petty-cash-legacy.js
//   (or wire into your existing script-runner / ts-node setup)
//   Add --dry-run to preview counts without writing anything.

import dbConnect from "../lib/database";
import PettyCash from "../models/PettyCash";
import PettyCashExpense from "../models/PettyCashExpense";
import PettyCashAllocation from "../models/PettyCashAllocation";

const DRY_RUN = process.argv.includes("--dry-run");

async function migrate() {
  await dbConnect();

  // Only look at PettyCash docs that actually have legacy embedded data.
  const cursor = PettyCash.find({
    $or: [
      { "expenses.0": { $exists: true } },
      { "allocatedAmounts.0": { $exists: true } },
    ],
  }).cursor();

  const stats = {
    pettyCashDocsScanned: 0,
    expensesMigrated: 0,
    expensesSkippedAlreadyExists: 0,
    expensesSkippedNoId: 0,
    allocationsMigrated: 0,
    allocationsSkippedAlreadyExists: 0,
    allocationsSkippedNoId: 0,
  };

  for await (const rawDoc of cursor) {
    stats.pettyCashDocsScanned++;
    // .toObject() so we get the raw legacy fields even though the current
    // schema no longer declares `expenses`/`allocatedAmounts`.
    const doc = rawDoc.toObject();
    const pettyCashId = doc._id;
    const clinicId = doc.clinicId;
    const staffId = doc.staffId;
    // Legacy records predate the `createdBy` field on the child docs —
    // fall back to the staff member themself as the audit owner.
    const fallbackCreatedBy = doc.createdBy || staffId;

    if (!clinicId || !staffId) {
      console.warn(
        `Skipping PettyCash ${pettyCashId}: missing clinicId/staffId, cannot safely migrate.`,
      );
      continue;
    }

    // ---- Expenses ----
    for (const exp of doc.expenses || []) {
      if (!exp._id) {
        stats.expensesSkippedNoId++;
        continue;
      }
      const exists = await PettyCashExpense.exists({ _id: exp._id });
      if (exists) {
        stats.expensesSkippedAlreadyExists++;
        continue;
      }

      const payload = {
        _id: exp._id,
        pettyCashId,
        clinicId,
        staffId,
        description: exp.description || "Legacy petty cash expense",
        spentAmount: exp.spentAmount || 0,
        vendor: exp.vendor || null,
        vendorName: exp.vendorName || null,
        items: (exp.items || []).map((it) => ({
          itemName: it.itemName,
          amount: it.amount || 0,
        })),
        receipts: exp.receipts || [],
        usedFromPettyCash: exp.usedFromPettyCash !== false,
        date: exp.date || doc.createdAt || new Date(),
        // Preserve the record's real creation time (encoded in the
        // reused ObjectId) instead of letting Mongoose stamp it with
        // "now" — otherwise every migrated record would look like it
        // was created today, breaking anything sorted/filtered by
        // createdAt. `updatedAt` is intentionally left alone; Mongoose
        // always sets that to "now" for a new document regardless, which
        // correctly reflects "when this DB record was actually written".
        createdAt: exp._id.getTimestamp(),
        createdBy: fallbackCreatedBy,
        isVoided: false,
        migratedFromLegacy: true,
      };

      if (DRY_RUN) {
        console.log("[dry-run] would create PettyCashExpense:", payload._id);
      } else {
        await PettyCashExpense.create(payload);
      }
      stats.expensesMigrated++;
    }

    // ---- Allocations ----
    for (const alloc of doc.allocatedAmounts || []) {
      if (!alloc._id) {
        stats.allocationsSkippedNoId++;
        continue;
      }
      const exists = await PettyCashAllocation.exists({ _id: alloc._id });
      if (exists) {
        stats.allocationsSkippedAlreadyExists++;
        continue;
      }

      const payload = {
        _id: alloc._id,
        pettyCashId,
        clinicId,
        staffId,
        amount: alloc.amount || 0,
        receipts: alloc.receipts || [],
        date: alloc.date || doc.createdAt || new Date(),
        // Same reasoning as the expense payload above.
        createdAt: alloc._id.getTimestamp(),
        createdBy: fallbackCreatedBy,
        isVoided: false,
        migratedFromLegacy: true,
      };

      if (DRY_RUN) {
        console.log("[dry-run] would create PettyCashAllocation:", payload._id);
      } else {
        await PettyCashAllocation.create(payload);
      }
      stats.allocationsMigrated++;
    }
  }

  console.log(
    DRY_RUN ? "DRY RUN COMPLETE (nothing written):" : "MIGRATION COMPLETE:",
  );
  console.log(stats);

  // Sanity check: compare rebuilt totals against PettyCash's own rollup
  // fields. Large mismatches mean something about the legacy data doesn't
  // match assumptions above and needs a human look before you trust it.
  await verifyAgainstRollups();
}

async function verifyAgainstRollups() {
  const mismatches = [];
  const cursor = PettyCash.find({ staffId: { $ne: null } }).cursor();

  for await (const doc of cursor) {
    const [expenseAgg] = await PettyCashExpense.aggregate([
      { $match: { pettyCashId: doc._id, isVoided: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$spentAmount" } } },
    ]);
    const [allocAgg] = await PettyCashAllocation.aggregate([
      { $match: { pettyCashId: doc._id, isVoided: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const rebuiltSpent = expenseAgg?.total || 0;
    const rebuiltAllocated = allocAgg?.total || 0;
    const declaredSpent = doc.totalSpent || 0;
    const declaredAllocated = doc.totalAllocated || 0;

    if (
      Math.abs(rebuiltSpent - declaredSpent) > 1 ||
      Math.abs(rebuiltAllocated - declaredAllocated) > 1
    ) {
      mismatches.push({
        pettyCashId: doc._id,
        staffId: doc.staffId,
        declaredSpent,
        rebuiltSpent,
        declaredAllocated,
        rebuiltAllocated,
      });
    }
  }

  if (mismatches.length > 0) {
    console.warn(
      `\n⚠️  ${mismatches.length} PettyCash record(s) don't match their rollup totals after migration. Review before deleting legacy arrays:`,
    );
    console.table(mismatches);
  } else {
    console.log(
      "\n✅ All PettyCash rollup totals match the migrated detail records.",
    );
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
