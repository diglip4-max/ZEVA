import mongoose from "mongoose";

const multiplePaymentSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    transactionType: {
      type: String,
      enum: [
        "PAYMENT",
        "ADVANCE_USAGE",
        "CLAIM_USAGE",
        "PENDING_CLEARANCE",
        "CASHBACK_USAGE",
      ],
    },
    notes: { type: String },
  },
  { _id: false },
);

const paymentHistorySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    pending: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
    },
    multiplePayments: [multiplePaymentSchema],
    status: {
      type: String,
      enum: [
        "Active",
        "Cancelled",
        "Completed",
        "Rejected",
        "Released",
        "Partial",
      ],
    },
    updatedAt: { type: Date, default: Date.now },
    // Enterprise-grade audit trail fields
    transactionType: {
      type: String,
      enum: [
        "PAYMENT",
        "PENDING_CLEARANCE",
        "REGULAR_PAYMENT",
        "ADVANCE_USAGE",
        "CLAIM_USAGE",
        "FULL_PAYMENT",
        "PARTIAL_PAYMENT",
      ],
    },
    amountPaid: { type: Number, default: 0 },
    advanceAmountUsed: { type: Number, default: 0 },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidByName: { type: String },
    remainingPending: { type: Number, default: 0 },
  },
  { _id: false },
);

const billingSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    invoicedDate: {
      type: Date,
      default: Date.now,
    },
    invoicedBy: {
      type: String,
      required: true,
      trim: true,
    },
    // ID of the user who created the billing (agent / doctorStaff / clinic owner)
    invoicedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Doctor (doctorStaff) assigned to the appointment
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Service details
    service: {
      type: String,
      enum: ["Package", "Treatment", "Service"],
      required: true,
    },
    treatment: {
      type: String,
      trim: true,
    },
    package: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    sessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Package-specific: Track which treatments and their sessions
    selectedPackageTreatments: [
      {
        treatmentName: { type: String, trim: true },
        treatmentSlug: { type: String, trim: true },
        sessions: { type: Number, min: 0, default: 0 },
        _id: false,
      },
    ],
    // Selected treatments with details (slugs, service IDs, quantities)
    selectedTreatments: [
      {
        treatmentName: { type: String, trim: true },
        treatmentSlug: { type: String, trim: true },
        treatmentServiceId: { type: String, trim: true },
        quantity: { type: Number, min: 0, default: 1 },
        price: { type: Number, min: 0, default: 0 },
        originalAppointmentQuantity: { type: Number, min: 0 }, // Original quantity from the appointment (if any)
        _id: false,
      },
    ],
    // Track unpaid packages that were paid in this billing
    unpaidPackagesPaid: [
      {
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
        packageSubId: { type: mongoose.Schema.Types.ObjectId },
        packageName: { type: String, trim: true },
        amount: { type: Number, min: 0, default: 0 },
        _id: false,
      },
    ],
    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paid: {
      type: Number,
      required: true,
      min: 0,
    },
    // Amount of previous advance applied to this invoice
    advanceUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Amount of insurance claim used for this invoice
    claimAmountUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Amount of previous pending cleared in this invoice
    pendingUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Amount of pending claim cleared in this invoice
    pendingClaimUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    pending: {
      type: Number,
      required: true,
      min: 0,
    },
    // Enterprise Pending Ledger: denormalized cache of total remainingAmount
    // across all Open/Partial ledger rows in PatientPendingLedger collection
    // for THIS billing. Source of truth lives in PatientPendingLedger.
    // This cached field is updated by lib/pendingLedger.applyClearance.
    pendingLedgerCached: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Number of Open/Partial ledger rows attached to this billing (for fast list rendering)
    pendingLedgerOpenCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Enterprise Pending Ledger: per-line breakdown of which ledger rows
    // THIS billing record cleared. Populated only on audit billings
    // created by /api/clinic/pending-ledgers/clear. Each entry references
    // a PatientPendingLedger row by ledgerId so the UI can render the
    // per-treatment breakdown of a pending payment.
    pendingClearedBreakdown: [
      {
        ledgerId: { type: String, trim: true, index: true },
        invoiceNumber: { type: String, trim: true },
        service: { type: String, enum: ["Treatment", "Package", "Service"] },
        treatmentSlug: { type: String, trim: true },
        treatmentName: { type: String, trim: true },
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
        packageName: { type: String, trim: true },
        amountCleared: { type: Number, min: 0 },
        newStatus: { type: String },
        newRemaining: { type: Number, min: 0 },
        _id: false,
      },
    ],
    advance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Amount of previous advance applied to this invoice
    pastAdvance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pastAdvanceUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    pastAdvanceType: {
      type: String,
      enum: ["50% Offer", "54% Offer", "159 Flat", ""],
      default: "",
    },
    paymentMethod: {
      type: String,
      required: false,
    },
    // Multiple payment methods for split payments
    multiplePayments: [multiplePaymentSchema],
    paymentHistory: [paymentHistorySchema],
    // Additional fields
    notes: {
      type: String,
      trim: true,
    },
    // Membership free consultation tracking
    isFreeConsultation: {
      type: Boolean,
      default: false,
    },
    freeConsultationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    membershipDiscountApplied: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDoctorDiscountApplied: {
      type: Boolean,
      default: false,
    },
    doctorDiscountType: {
      type: String,
    },
    doctorDiscountAmount: {
      type: Number,
      default: 0,
    },
    isAgentDiscountApplied: {
      type: Boolean,
      default: false,
    },
    agentDiscountType: {
      type: String,
    },
    agentDiscountAmount: {
      type: Number,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    originalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isAdvanceOnly: {
      type: Boolean,
      default: false,
    },
    // Pending balance payment screenshots/proof images
    pendingBalanceImage: {
      type: [String],
      default: [],
    },
    offerApplied: {
      type: Boolean,
      default: false,
    },

    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },

    offerName: String,

    offerType: {
      type: String,
      enum: ["instant_discount", "cashback", "bundle"],
    },

    offerDiscountAmount: {
      type: Number,
      default: 0,
    },

    cashbackEarned: {
      type: Number,
      default: 0,
    },

    // Detailed cashback offer tracking fields
    isCashbackApplied: {
      type: Boolean,
      default: false,
    },

    cashbackOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },

    cashbackOfferName: {
      type: String,
      default: null,
    },

    cashbackAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cashback validity period
    cashbackStartDate: {
      type: Date,
      default: null,
    },

    cashbackEndDate: {
      type: Date,
      default: null,
    },

    // Cashback WALLET usage (when patient uses previously earned cashback)
    cashbackWalletUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    bundleSessionsAdded: {
      type: Number,
      default: 0,
    },

    offerOverrideUsed: {
      type: Boolean,
      default: false,
    },

    offerOverrideReason: String,

    offerFreeSession: {
      type: [String],
      default: [],
    },

    freeOfferSessionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Free sessions consumed in this billing (redemptions from previous bundle offers)
    usedFreeSessions: {
      type: [String],
      default: [],
    },

    usedFreeSessionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Offer refund tracking fields
    isOfferRefunded: {
      type: Boolean,
      default: false,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundedBy: {
      type: String,
      trim: true,
      default: null,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Track what offers were refunded
    refundedOffers: [
      {
        offerType: {
          type: String,
          enum: ["instant_discount", "cashback", "bundle"],
          required: true,
        },
        offerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Offer",
          default: null,
        },
        offerName: {
          type: String,
          default: null,
        },
        amount: {
          type: Number,
          default: 0,
        },
        freeSessionsRefunded: {
          type: [String],
          default: [],
        },
        freeSessionsRestored: {
          type: [String],
          default: [],
        },
        cashbackRefunded: {
          type: Number,
          default: 0,
        },
        cashbackWalletUsageReversed: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { timestamps: true },
);

// Pre-save hook to calculate pending
billingSchema.pre("save", function (next) {
  this.amount = Number(this.amount ?? 0);
  this.paid = Number(this.paid ?? 0);
  this.advanceUsed = Number(this.advanceUsed ?? 0);
  this.claimAmountUsed = Number(this.claimAmountUsed ?? 0);
  this.pendingUsed = Number(this.pendingUsed ?? 0);
  this.pendingClaimUsed = Number(this.pendingClaimUsed ?? 0);
  this.advance = Number(this.advance ?? 0);

  if (this.advanceUsed < 0) this.advanceUsed = 0;
  if (this.claimAmountUsed < 0) this.claimAmountUsed = 0;
  if (this.pendingUsed < 0) this.pendingUsed = 0;
  if (this.pendingClaimUsed < 0) this.pendingClaimUsed = 0;

  // For NEW documents, calculate advance without subtracting pendingUsed/pendingClaimUsed
  // because the amount field already includes the pending being cleared.
  // Example: amount=400 (100 current + 300 pending), paid=900, pendingUsed=300
  // Correct: advance = 900 - 400 = 500 (NOT 900 - 400 - 300 = 200)
  if (this.isNew) {
    const totalCreditsUsed = this.advanceUsed + this.claimAmountUsed;
    const effectiveDue = Math.max(0, this.amount - totalCreditsUsed);
    this.advance = Math.max(0, this.paid - effectiveDue);
    return next();
  }

  // Check if pending was directly modified (for existing documents), if so skip other calculations
  // This allows explicit pending updates from APIs like pay-invoice-pending
  if (this.isModified("pending")) {
    // Only recalculate advance based on paid and pendingUsed/pendingClaimUsed
    const totalCreditsUsed = this.advanceUsed + this.claimAmountUsed;
    const effectiveDue = Math.max(0, this.amount - totalCreditsUsed);
    // New advance generated if paid exceeds effective due (minus pending cleared)
    // pendingClaimUsed is subtracted because clearing insurance pending claim is past debt, not new advance
    this.advance = Math.max(
      0,
      this.paid - effectiveDue - this.pendingUsed - this.pendingClaimUsed,
    );
    return next();
  }

  // Effective due after applying previous advance AND insurance claim to this invoice
  const totalCreditsUsed = this.advanceUsed + this.claimAmountUsed;
  const effectiveDue = Math.max(0, this.amount - totalCreditsUsed);
  // Pending is any remaining due after today's payment
  this.pending = Math.max(0, effectiveDue - this.paid);
  // New advance generated if paid exceeds effective due
  // If pendingUsed/pendingClaimUsed is provided, it reduces the amount that can be converted to advance
  // Both represent past debt being cleared (not new revenue), so they reduce advance generation
  this.advance = Math.max(
    0,
    this.paid - effectiveDue - this.pendingUsed - this.pendingClaimUsed,
  );

  next();
});

// Indexes for faster queries
billingSchema.index({ patientId: 1 });
billingSchema.index({ invoiceNumber: 1 });

// Prevent duplicate model compilation error
if (mongoose.models.Billing) {
  delete mongoose.models.Billing;
}

export default mongoose.models.Billing ||
  mongoose.model("Billing", billingSchema);
