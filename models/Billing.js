import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Number, required: true, min: 0 },
  pending: { type: Number, required: true, min: 0 },
  paymentMethod: {
    type: String,
    enum: ["Cash", "Card", "BT", "Tabby", "Tamara"],
    required: true,
  },
  status: { type: String, enum: ["Active", "Cancelled", "Completed", "Rejected", "Released"] },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

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
      required: true,
      index: true,
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
    // Service details
    service: {
      type: String,
      enum: ["Package", "Treatment"],
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
      min: 1,
    },
    sessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Package-specific: Track which treatments and their sessions
    selectedPackageTreatments: [{
      treatmentName: { type: String, trim: true },
      treatmentSlug: { type: String, trim: true },
      sessions: { type: Number, min: 0, default: 0 },
      _id: false
    }],
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
    pending: {
      type: Number,
      required: true,
      min: 0,
    },
    advance: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "BT", "Tabby", "Tamara"],
      required: true,
    },
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
    originalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to calculate pending
billingSchema.pre("save", function (next) {
  this.amount = Number(this.amount ?? 0);
  this.paid = Number(this.paid ?? 0);
  this.advanceUsed = Number(this.advanceUsed ?? 0);
  this.advance = Number(this.advance ?? 0);

  if (this.advanceUsed < 0) this.advanceUsed = 0;

  // Effective due after applying previous advance to this invoice
  const effectiveDue = Math.max(0, this.amount - this.advanceUsed);
  // Pending is any remaining due after today's payment
  this.pending = Math.max(0, effectiveDue - this.paid);
  // New advance generated if paid exceeds effective due
  this.advance = Math.max(0, this.paid - effectiveDue);

  next();
});

// Indexes for faster queries
billingSchema.index({ clinicId: 1, appointmentId: 1 });
billingSchema.index({ patientId: 1 });
billingSchema.index({ invoiceNumber: 1 });

export default mongoose.models.Billing || mongoose.model("Billing", billingSchema);

