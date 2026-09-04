// models/PettyCashExpense.js
//
// NEW FILE - did not exist before.
// Each document here = ONE expense made from petty cash.
// Previously this data lived inside PettyCash.expenses[] (an embedded
// array that grew forever). Now each expense is its own small document.

import mongoose from "mongoose";

const ExpenseItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false },
);

const PettyCashExpenseSchema = new mongoose.Schema(
  {
    pettyCashId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PettyCash",
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: { type: String, required: true, trim: true },
    spentAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    vendorName: { type: String, default: null },
    items: [ExpenseItemSchema],
    receipts: [{ type: String }], // Cloudinary URLs
    usedFromPettyCash: { type: Boolean, default: true },
    date: { type: Date, default: Date.now },

    // Audit fields - who logged it, and a safe way to reverse it
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isVoided: { type: Boolean, default: false },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String },
    voidedAt: { type: Date },

    migratedFromLegacy: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

// Indexes matched to real query patterns:
// "show this staff member's expenses at this clinic, most recent first"
PettyCashExpenseSchema.index({ clinicId: 1, migratedFromLegacy: 1 });
PettyCashExpenseSchema.index({
  clinicId: 1,
  staffId: 1,
  date: -1,
});
// "show all expenses under a given petty cash record"
PettyCashExpenseSchema.index({ pettyCashId: 1, date: -1 });
// "show all expenses for a vendor" (useful for vendor-spend reports)
PettyCashExpenseSchema.index({ vendor: 1, date: -1 });

/**
 * Recommended usage from your API route (inside a transaction):
 *
 *   const session = await mongoose.startSession();
 *   await session.withTransaction(async () => {
 *     const [expense] = await PettyCashExpense.create(
 *       [{ pettyCashId, clinicId, staffId, description, spentAmount, createdBy }],
 *       { session }
 *     );
 *     await PettyCash.applyExpense(pettyCashId, spentAmount, session);
 *     await PettyCash.updateGlobalSpentAmount(clinicId, spentAmount, "add", session);
 *   });
 *   session.endSession();
 *
 * To VOID/reverse an expense (never hard-delete financial records):
 *
 *   await PettyCashExpense.findByIdAndUpdate(expenseId, {
 *     isVoided: true, voidedBy, voidReason, voidedAt: new Date(),
 *   }, { session });
 *   await PettyCash.applyExpense(pettyCashId, -spentAmount, session); // reverse the totals
 *   await PettyCash.updateGlobalSpentAmount(clinicId, spentAmount, "subtract", session);
 */

export default mongoose.models.PettyCashExpense ||
  mongoose.model("PettyCashExpense", PettyCashExpenseSchema);
