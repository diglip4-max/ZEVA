// models/PettyCash.js
//
// ENTERPRISE-OPTIMIZED VERSION
// This file now holds ONLY the "parent" record per staff member (or the
// special global tracking record where staffId = null).
// The actual allocation/expense entries live in their own collections:
//   - PettyCashAllocation.js
//   - PettyCashExpense.js

import mongoose from "mongoose";

const PettyCashSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: false, // For backward compatibility or global records
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // null = the special global tracking record for a clinic
    },

    // Patient fields - optional for manual petty cash entries
    patientName: { type: String, trim: true },
    patientEmail: { type: String, trim: true },
    patientPhone: { type: String },
    note: { type: String, default: "" },

    // ---- ROLLUP TOTALS ONLY (no more embedded arrays here) ----
    // These are the per-staff totals. They are now maintained via
    // atomic $inc calls from the Allocation/Expense models' hooks,
    // NOT recalculated by summing embedded arrays on every save.
    totalAllocated: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    totalSpent: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    totalAmount: {
      type: mongoose.Schema.Types.Decimal128, // remaining balance
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // Global amount tracking (only meaningful on the staffId: null record)
    globalTotalAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    globalSpentAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // Audit fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { getters: true },   // so Decimal128 fields serialize as normal numbers
    toObject: { getters: true },
  }
);

// ---- INDEXES matched to real query patterns ----
// "Give me this staff member's petty cash record at this clinic"
PettyCashSchema.index({ clinicId: 1, staffId: 1 }, { unique: true, sparse: true });
// "Give me recently created/updated records for this clinic" (dashboards, listings)
PettyCashSchema.index({ clinicId: 1, createdAt: -1 });

// NOTE: There is intentionally NO pre("save") hook recalculating totals from
// arrays anymore, because there are no arrays on this document anymore.
// Totals are updated atomically (see statics below) at the exact moment
// money is allocated or spent, called from API routes inside a transaction.

// ---------------------------------------------------------------------------
// STATIC METHODS
// ---------------------------------------------------------------------------

/**
 * Read-only helper: get a clinic's global totals.
 * Safe to call without a session - it's a read, not a write.
 */
PettyCashSchema.statics.getGlobalAmounts = async function (clinicId) {
  if (!clinicId) {
    return { globalTotalAmount: 0, globalSpentAmount: 0, globalRemainingAmount: 0 };
  }
  const globalRecord = await this.findOne({ staffId: null, clinicId }).lean();
  const total = globalRecord && globalRecord.globalTotalAmount ? parseFloat(globalRecord.globalTotalAmount.toString()) : 0;
  const spent = globalRecord && globalRecord.globalSpentAmount ? parseFloat(globalRecord.globalSpentAmount.toString()) : 0;
  return {
    globalTotalAmount: total,
    globalSpentAmount: spent,
    globalRemainingAmount: total - spent,
  };
};

/**
 * Atomically adjust a clinic's global SPENT total.
 * Uses $inc (database-side addition) instead of read-modify-write,
 * so concurrent calls never lose an update.
 * Pass `session` when calling inside a transaction.
 */
PettyCashSchema.statics.updateGlobalSpentAmount = async function (
  clinicId,
  amount,
  operation = "add",
  session = null
) {
  if (!clinicId) return null;
  const delta = operation === "add" ? amount : -amount;

  return this.findOneAndUpdate(
    { staffId: null, clinicId },
    {
      $inc: { globalSpentAmount: delta },
      $setOnInsert: { note: "Global petty cash tracking", globalTotalAmount: 0 },
    },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
};

/**
 * Atomically adjust a clinic's global TOTAL (allocated) amount.
 * Same atomic pattern as updateGlobalSpentAmount.
 */
PettyCashSchema.statics.updateGlobalTotalAmount = async function (
  clinicId,
  amount,
  operation = "add",
  session = null
) {
  if (!clinicId) return null;
  const delta = operation === "add" ? amount : -amount;

  return this.findOneAndUpdate(
    { staffId: null, clinicId },
    {
      $inc: { globalTotalAmount: delta },
      $setOnInsert: { note: "Global petty cash tracking", globalSpentAmount: 0 },
    },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
};

/**
 * Adjust ONE staff member's rollup totals atomically.
 * Called whenever an allocation is created for them.
 */
PettyCashSchema.statics.applyAllocation = async function (pettyCashId, amount, session = null) {
  return this.findByIdAndUpdate(
    pettyCashId,
    { $inc: { totalAllocated: amount, totalAmount: amount } },
    { new: true, session }
  );
};

/**
 * Adjust ONE staff member's rollup totals atomically.
 * Called whenever an expense is created for them.
 * Pass a negative `amount` to reverse (void) a previously applied expense.
 */
PettyCashSchema.statics.applyExpense = async function (pettyCashId, amount, session = null) {
  return this.findByIdAndUpdate(
    pettyCashId,
    { $inc: { totalSpent: amount, totalAmount: -amount } },
    { new: true, session }
  );
};

/**
 * Recalculate a SPECIFIC clinic's global totals from source-of-truth
 * staff records. Scoped by clinicId (not the whole system) so it stays
 * fast as the number of clinics grows. Use as a periodic reconciliation
 * job, not on every request.
 */
PettyCashSchema.statics.recalculateGlobalAmounts = async function (clinicId) {
  if (!clinicId) {
    throw new Error("clinicId is required to recalculate global amounts");
  }
  try {
    const pipeline = [
      { $match: { clinicId: new mongoose.Types.ObjectId(clinicId), staffId: { $ne: null } } },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: { $toDouble: "$totalAllocated" } },
          totalSpent: { $sum: { $toDouble: "$totalSpent" } },
        },
      },
    ];

    const result = await this.aggregate(pipeline);
    const totals = result[0] || { totalAllocated: 0, totalSpent: 0 };

    const globalRecord = await this.findOneAndUpdate(
      { staffId: null, clinicId },
      {
        globalTotalAmount: totals.totalAllocated,
        globalSpentAmount: totals.totalSpent,
        $setOnInsert: { note: "Global petty cash tracking" },
      },
      { upsert: true, new: true }
    );

    return {
      globalTotalAmount: globalRecord.globalTotalAmount,
      globalSpentAmount: globalRecord.globalSpentAmount,
      globalRemainingAmount: globalRecord.globalTotalAmount - globalRecord.globalSpentAmount,
    };
  } catch (error) {
    console.error("Error recalculating global amounts:", error);
    throw error; // enterprise code should surface errors, not swallow them silently
  }
};

export default mongoose.models.PettyCash || mongoose.model("PettyCash", PettyCashSchema);
