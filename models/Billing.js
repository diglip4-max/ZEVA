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
  },
  { timestamps: true }
);

// Pre-save hook to calculate pending
billingSchema.pre("save", function (next) {
  this.amount = Number(this.amount ?? 0);
  this.paid = Number(this.paid ?? 0);
  this.advance = Number(this.advance ?? 0);

  // Calculate pending
  if (this.paid >= this.amount) {
    this.pending = 0;
    this.advance = this.paid - this.amount;
  } else {
    this.advance = 0;
    this.pending = this.amount - this.paid;
  }

  next();
});

// Indexes for faster queries
billingSchema.index({ clinicId: 1, appointmentId: 1 });
billingSchema.index({ patientId: 1 });
billingSchema.index({ invoiceNumber: 1 });

export default mongoose.models.Billing || mongoose.model("Billing", billingSchema);

