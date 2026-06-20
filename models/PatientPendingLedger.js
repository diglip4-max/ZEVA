import mongoose from "mongoose";

/* ==============================
   Per-clearance audit sub-record
   Each clearance documents ONE allocation that paid down this ledger line.
================================ */
const clearanceSubSchema = new mongoose.Schema(
  {
    clearingBillingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Billing",
    },
    clearingInvoiceNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidByName: { type: String },
    paymentMethod: { type: String },
    transactionType: {
      type: String,
      enum: [
        "PAYMENT",
        "PENDING_CLEARANCE",
        "ADVANCE_USAGE",
        "CASHBACK_USAGE",
        "REFUND",
        "WRITE_OFF",
        "ADJUSTMENT",
      ],
    },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

/* ==============================
   Patient Pending Ledger Schema
   Source of truth for every AED of pending balance.
   Each row = one "open line of credit" the patient owes the clinic.
   Enterprise-grade separate collection for:
     - multi-branch rollups
     - partial refunds scoped to a specific treatment/package
     - audit trail per clearance
     - dispute / write-off workflow
================================ */
const patientPendingLedgerSchema = new mongoose.Schema(
  {
    // Stable identifier so a payment can be re-linked even if the
    // parent billing is duplicated or migrated. Format: PL-<uuid or hash>
    ledgerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Multi-tenant + multi-branch support
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    branchId: {
      type: String,
      default: null,
      index: true, // future multi-branch
    },

    // Patient + parent billing linkage
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    parentBillingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Billing",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Source identity (the treatment / package that generated this pending amount)
    service: {
      type: String,
      enum: ["Treatment", "Package", "Service"],
      required: true,
    },
    treatmentSlug: { type: String, trim: true, index: true },
    treatmentName: { type: String, trim: true },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    packageName: { type: String, trim: true },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    patientPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserPackage",
    },
    patientPackageSubId: { type: mongoose.Schema.Types.ObjectId },

    // Money lifecycle
    originalAmount: { type: Number, required: true, min: 0 }, // pending at creation
    paidAmount: { type: Number, default: 0, min: 0 },         // sum of all clearances so far
    remainingAmount: { type: Number, required: true, min: 0 }, // original - paid
    currency: { type: String, default: "AED" },

    // Lifecycle
    status: {
      type: String,
      enum: ["Open", "Partial", "Closed", "Disputed", "WrittenOff", "Refunded"],
      default: "Open",
      index: true,
    },

    // Audit
    createdAt: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date, default: null },

    // Per-clearance log
    clearances: [clearanceSubSchema],

    // Optimistic concurrency: bump on every clearance / status change
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

/* ==============================
   Compound indexes for hot query patterns
================================ */
// FIFO listing per patient (oldest open first)
patientPendingLedgerSchema.index({ patientId: 1, status: 1, createdAt: 1 });

// Branch / clinic rollup (e.g. daily pending total per branch)
patientPendingLedgerSchema.index({ clinicId: 1, status: 1, createdAt: 1 });

// "Pending for this billing" lookup
patientPendingLedgerSchema.index({ parentBillingId: 1, status: 1 });

// Analytics per treatment
patientPendingLedgerSchema.index({ treatmentSlug: 1, status: 1 });

// Partial index: only the small hot working set
patientPendingLedgerSchema.index(
  { status: 1, createdAt: 1 },
  { partialFilterExpression: { status: { $in: ["Open", "Partial"] } } },
);

/* ==============================
   Pre-save invariant: remainingAmount = originalAmount - paidAmount
================================ */
patientPendingLedgerSchema.pre("save", function (next) {
  const original = Number(this.originalAmount || 0);
  const paid = Number(this.paidAmount || 0);
  this.remainingAmount = Math.max(0, Number((original - paid).toFixed(2)));

  if (this.remainingAmount <= 0 && this.status !== "Closed" && this.status !== "WrittenOff" && this.status !== "Refunded") {
    this.status = "Closed";
    this.closedAt = this.closedAt || new Date();
  } else if (paid > 0 && this.remainingAmount > 0 && this.status === "Open") {
    this.status = "Partial";
  }

  next();
});

/* ==============================
   Hot-reload safe model export
================================ */
if (mongoose.models.PatientPendingLedger) {
  delete mongoose.models.PatientPendingLedger;
}

export default mongoose.model("PatientPendingLedger", patientPendingLedgerSchema);
