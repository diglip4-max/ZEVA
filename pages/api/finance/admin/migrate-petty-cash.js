// pages/api/finance/admin/migrate-petty-cash.js
//
// Admin-only, clinic-scoped HTTP version of
// scripts/migrate-petty-cash-legacy.js — same idempotent backfill logic,
// but runs over one clinicId at a time so you can test on a single clinic
// before running the full CLI script, or trigger it without shell access.
//
// POST /api/finance/admin/migrate-petty-cash?clinicId=...&dryRun=true
//
// SECURITY: this endpoint WRITES data (creates PettyCashExpense /
// PettyCashAllocation documents). It is gated to admin role only. Consider
// removing this route (or gating it behind an env flag) once the one-time
// migration is complete, rather than leaving a data-mutating endpoint
// live indefinitely.

import dbConnect from "../../../../lib/database";
import PettyCash from "../../../../models/PettyCash";
import PettyCashExpense from "../../../../models/PettyCashExpense";
import PettyCashAllocation from "../../../../models/PettyCashAllocation";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed — use POST" });
  }

  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (!me) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Deliberately admin-only — this mutates financial records, unlike the
    // read-only dashboard endpoints.
    if (!requireRole(me, ["admin"])) {
      return res.status(403).json({
        success: false,
        message: "Admin access required to run this migration.",
      });
    }

    const { clinicId } = req.query;
    if (!clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "clinicId query param is required." });
    }

    const dryRun = req.query.dryRun === "true";

    const stats = {
      clinicId,
      dryRun,
      pettyCashDocsScanned: 0,
      expensesMigrated: 0,
      expensesSkippedAlreadyExists: 0,
      expensesSkippedNoId: 0,
      allocationsMigrated: 0,
      allocationsSkippedAlreadyExists: 0,
      allocationsSkippedNoId: 0,
    };

    const pettyCashDocs = await PettyCash.find({
      clinicId,
      $or: [
        { "expenses.0": { $exists: true } },
        { "allocatedAmounts.0": { $exists: true } },
      ],
    }).lean();

    for (const doc of pettyCashDocs) {
      stats.pettyCashDocsScanned++;
      const pettyCashId = doc._id;
      const staffId = doc.staffId;
      const fallbackCreatedBy = doc.createdBy || staffId;

      if (!staffId) continue; // malformed legacy doc — same guard as the CLI script

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

        if (!dryRun) {
          await PettyCashExpense.create({
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
            createdAt: exp._id.getTimestamp(),
            createdBy: fallbackCreatedBy,
            isVoided: false,
            migratedFromLegacy: true,
          });
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

        if (!dryRun) {
          await PettyCashAllocation.create({
            _id: alloc._id,
            pettyCashId,
            clinicId,
            staffId,
            amount: alloc.amount || 0,
            receipts: alloc.receipts || [],
            date: alloc.date || doc.createdAt || new Date(),
            createdAt: alloc._id.getTimestamp(),
            createdBy: fallbackCreatedBy,
            isVoided: false,
            migratedFromLegacy: true,
          });
        }
        stats.allocationsMigrated++;
      }
    }

    // Verification, scoped to this clinic only — same sanity check the CLI
    // script does, so you get the same "does it match the rollup total?"
    // signal without having to run the full-DB script first.
    const mismatches = [];
    const verifyDocs = await PettyCash.find({
      clinicId,
      staffId: { $ne: null },
    }).lean();

    for (const doc of verifyDocs) {
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

    return res.status(200).json({ success: true, stats, mismatches });
  } catch (error) {
    console.error("Petty cash migration (API) failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}
