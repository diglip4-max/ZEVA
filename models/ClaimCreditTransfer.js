// models/ClaimCreditTransfer.js
// Enterprise ledger for claim credit transfers between patients.
//
// Every transfer is recorded HERE — never inside InsuranceClaim or Billing,
// which stay pristine as the source documents for revenue and claim history.
//
// Patient balances pick up transfers automatically through the balance APIs
// (pages/api/clinic/claim-usage.js and patient-balance/[patientId].js):
//   source remaining = released - used - transfersOut
//   dest   remaining = released - used + transfersIn
//
// The record carries a full audit trail: who transferred, from where (IP /
// user agent), balance snapshots before/after, and reversal fields so a
// transfer can be corrected without deleting history.
import mongoose from "mongoose";

const claimCreditTransferSchema = new mongoose.Schema(
  {
    // Human-readable unique reference, e.g. CCT-20260916-482913
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },

    // ----- Parties -----
    sourcePatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    sourcePatientName: { type: String, default: "" },
    sourceEmrNumber: { type: String, default: "" },
    destPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    destPatientName: { type: String, default: "" },
    destEmrNumber: { type: String, default: "" },

    // ----- Transfer -----
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },

    // ----- Server-computed balance snapshots (never client-trusted) -----
    sourceReleasedTotal: { type: Number, default: 0 },
    sourceUsedTotal: { type: Number, default: 0 },
    sourceTransferredOutBefore: { type: Number, default: 0 },
    sourceRemainingBefore: { type: Number, default: 0 },
    sourceRemainingAfter: { type: Number, default: 0 },
    destReleasedTotal: { type: Number, default: 0 },
    destUsedTotal: { type: Number, default: 0 },
    destTransferredInBefore: { type: Number, default: 0 },
    destRemainingBefore: { type: Number, default: 0 },
    destRemainingAfter: { type: Number, default: 0 },

    // ----- Status / audit -----
    status: {
      type: String,
      enum: ["Completed", "Reversed"],
      default: "Completed",
      index: true,
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    transferredByName: { type: String, default: "" },
    transferredByRole: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // ----- Reversal audit (corrections without deleting history) -----
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    reversedByName: { type: String, default: "" },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: "" },
  },
  { timestamps: true }
);

claimCreditTransferSchema.index({ clinicId: 1, createdAt: -1 });
claimCreditTransferSchema.index({ sourcePatientId: 1, createdAt: -1 });
claimCreditTransferSchema.index({ destPatientId: 1, createdAt: -1 });

if (mongoose.models.ClaimCreditTransfer) {
  delete mongoose.models.ClaimCreditTransfer;
}

export default mongoose.model(
  "ClaimCreditTransfer",
  claimCreditTransferSchema
);
