import mongoose from "mongoose";

const { Schema } = mongoose;

/* =====================================
   PAYMENT HISTORY SUB SCHEMA
===================================== */
const paymentHistorySchema = new Schema(
{
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Number, required: true, min: 0 },
  advance: { type: Number, default: 0, min: 0 },
  pending: { type: Number, required: true, min: 0 },
  paying: { type: Number, default: 0, min: 0 },

  paymentMethod: {
    type: String,
    enum: ["Cash", "Card", "BT", "Tabby", "Tamara"],
    required: true
  },

  status: {
    type: String,
    enum: ["Active", "Cancelled", "Completed", "Rejected", "Released"]
  },

  rejectionNote: { type: String, trim: true },

  advanceClaimStatus: {
    type: String,
    enum: ["Pending", "Released", "Cancelled", "Approved by doctor"]
  },

  advanceClaimCancellationRemark: {
    type: String,
    trim: true
  },

  updatedAt: { type: Date, default: Date.now }
},
{ _id: false }
);

/* =====================================
   WALLET TRANSACTION SCHEMA
===================================== */
const walletTransactionSchema = new Schema(
{
  type: {
    type: String,
    enum: ["credit", "debit", "expired", "refund_reverse"],
    required: true
  },

  amount: { type: Number, required: true, min: 0 },

  sourceOfferId: {
    type: Schema.Types.ObjectId,
    ref: "Offer"
  },

  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: "Billing"
  },

  note: { type: String, trim: true },

  expiryDate: { type: Date },

  createdAt: { type: Date, default: Date.now }
},
{ _id: false }
);

/* =====================================
   OFFER HISTORY SCHEMA
===================================== */
const offerHistorySchema = new Schema(
{
  offerId: {
    type: Schema.Types.ObjectId,
    ref: "Offer"
  },

  offerName: String,

  offerType: {
    type: String,
    enum: ["instant_discount", "cashback", "bundle"]
  },

  benefitValue: { type: Number, default: 0 },

  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: "Billing"
  },

  usedAt: { type: Date, default: Date.now }
},
{ _id: false }
);

/* =====================================
   FREE SESSION SCHEMA
===================================== */
const freeSessionSchema = new Schema(
{
  offerId: {
    type: Schema.Types.ObjectId,
    ref: "Offer"
  },

  serviceId: {
    type: Schema.Types.ObjectId,
    ref: "Treatment"
  },

  serviceName: String,

  totalSessions: { type: Number, default: 0, min: 0 },

  usedSessions: { type: Number, default: 0, min: 0 },

  remainingSessions: { type: Number, default: 0, min: 0 },

  transferable: { type: Boolean, default: false },

  expiryDate: { type: Date },

  createdAt: { type: Date, default: Date.now }
},
{ _id: false }
);

/* =====================================
   MAIN PATIENT MODEL
===================================== */
const patientRegistrationSchema = new Schema(
{
  /* =============================
     BASIC INVOICE / USER LINK
  ============================= */
  invoiceNumber: {
    type: String,
    unique: true,
    trim: true
  },

  invoicedDate: {
    type: Date,
    default: Date.now
  },

  invoicedBy: {
    type: String,
    trim: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },

  clinicId: {
    type: Schema.Types.ObjectId,
    ref: "Clinic",
    index: true
  },

  /* =============================
     PATIENT DETAILS
  ============================= */
  emrNumber: { type: String, trim: true },

  firstName: {
    type: String,
    required: true,
    trim: true
  },

  lastName: { type: String, trim: true },

  gender: {
    type: String,
    enum: ["Male", "Female", "Other"]
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },

  referredBy: { type: String, trim: true },

  patientType: {
    type: String,
    enum: ["New", "Old"],
    default: "New"
  },

  /* =============================
     INSURANCE
  ============================= */
  insurance: {
    type: String,
    enum: ["Yes", "No"],
    default: "No"
  },

  insuranceType: {
    type: String,
    enum: ["Paid", "Advance"],
    default: "Paid"
  },

  advanceGivenAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  coPayPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  needToPay: {
    type: Number,
    default: 0,
    min: 0
  },

  advanceClaimStatus: {
    type: String,
    enum: ["Pending", "Released", "Cancelled", "Approved by doctor"],
    default: function () {
      return this.insurance === "Yes" ? "Pending" : null;
    }
  },

  advanceClaimReleaseDate: Date,
  advanceClaimReleasedBy: String,
  advanceClaimCancellationRemark: String,

  /* =============================
     MEMBERSHIP
  ============================= */
  membership: {
    type: String,
    enum: ["Yes", "No"],
    default: "No"
  },

  membershipStartDate: Date,
  membershipEndDate: Date,

  membershipId: {
    type: Schema.Types.ObjectId,
    ref: "MembershipPlan"
  },

  /* =============================
     PACKAGE
  ============================= */
  package: {
    type: String,
    enum: ["Yes", "No"],
    default: "No"
  },

  packageId: {
    type: Schema.Types.ObjectId,
    ref: "Package"
  },

  packageTotalPrice: {
    type: Number,
    default: 0
  },

  packagePaidAmount: {
    type: Number,
    default: 0
  },

  packagePaymentStatus: {
    type: String,
    enum: ["Unpaid", "Partial", "Full"],
    default: "Unpaid"
  },

  packagePaymentMethod: {
    type: String,
    default: ""
  },

  /* =============================
     NOTES
  ============================= */
  notes: String,
  rejectionNote: String,

  /* =============================
     PAYMENT HISTORY
  ============================= */
  paymentHistory: [paymentHistorySchema],

  /* =============================
     WALLET SYSTEM
  ============================= */
  wallet: {
    balance: { type: Number, default: 0 },
    usedAmount: { type: Number, default: 0 },
    expiredAmount: { type: Number, default: 0 }
  },

  walletTransactions: [walletTransactionSchema],

  /* =============================
     OFFER HISTORY
  ============================= */
  offerHistory: [offerHistorySchema],

  /* =============================
     FREE SESSIONS / BUNDLE
  ============================= */
  freeSessions: [freeSessionSchema],

  /* =============================
     LEAD LINK
  ============================= */
  leadId: {
    type: Schema.Types.ObjectId,
    ref: "Lead"
  }
},
{ timestamps: true }
);

/* =====================================
   PRE SAVE LOGIC
===================================== */
patientRegistrationSchema.pre("save", function (next) {

  this.advanceGivenAmount = Number(this.advanceGivenAmount || 0);
  this.coPayPercent = Number(this.coPayPercent || 0);

  if (this.insurance === "Yes") {
    const coPayAmount =
      (this.advanceGivenAmount * this.coPayPercent) / 100;

    this.needToPay = Math.max(
      0,
      this.advanceGivenAmount - coPayAmount
    );
  } else {
    this.needToPay = 0;
  }

  next();
});

/* =====================================
   INDEXES
===================================== */
patientRegistrationSchema.index({
  firstName: 1,
  lastName: 1
});

patientRegistrationSchema.index({
  mobileNumber: 1
});

patientRegistrationSchema.index({
  clinicId: 1
});

/* =====================================
   EXPORT
===================================== */
export default mongoose.models.PatientRegistration ||
mongoose.model(
  "PatientRegistration",
  patientRegistrationSchema
);