// models/PettyCashAllocation.js
//
// NEW FILE - did not exist before.
// Each document here = ONE time cash was handed to a staff member.
// Previously this data lived inside PettyCash.allocatedAmounts[] (an
// embedded array that grew forever). Now each allocation is its own
// small document, linked back to its parent PettyCash record.

import mongoose from "mongoose";

const PettyCashAllocationSchema = new mongoose.Schema(
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
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    receipts: [{ type: String }], // Cloudinary URLs
    date: { type: Date, default: Date.now },

    // Audit fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isVoided: { type: Boolean, default: false },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String },
    voidedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Indexes matched to real query patterns:
// "show this staff member's allocations at this clinic, most recent first"
PettyCashAllocationSchema.index({ clinicId: 1, staffId: 1, date: -1 });
// "show all allocations under a given petty cash record"
PettyCashAllocationSchema.index({ pettyCashId: 1, date: -1 });

/**
 * Recommended usage from your API route (inside a transaction):
 *
 *   const session = await mongoose.startSession();
 *   await session.withTransaction(async () => {
 *     const [alloc] = await PettyCashAllocation.create(
 *       [{ pettyCashId, clinicId, staffId, amount, createdBy }],
 *       { session }
 *     );
 *     await PettyCash.applyAllocation(pettyCashId, amount, session);
 *     await PettyCash.updateGlobalTotalAmount(clinicId, amount, "add", session);
 *   });
 *   session.endSession();
 *
 * To VOID/reverse an allocation:
 *
 *   await PettyCashAllocation.findByIdAndUpdate(allocationId, {
 *     isVoided: true, voidedBy, voidReason, voidedAt: new Date(),
 *   }, { session });
 *   await PettyCash.applyAllocation(pettyCashId, -amount, session);
 *   await PettyCash.updateGlobalTotalAmount(clinicId, amount, "subtract", session);
 */

export default mongoose.models.PettyCashAllocation ||
  mongoose.model("PettyCashAllocation", PettyCashAllocationSchema);
