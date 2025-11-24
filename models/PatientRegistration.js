import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Number, required: true, min: 0 },
  advance: { type: Number, default: 0, min: 0 },
  pending: { type: Number, required: true, min: 0 },
  paying: { type: Number, default: 0, min: 0 }, // Track paying amount
  paymentMethod: {
    type: String,
    enum: ["Cash", "Card", "BT", "Tabby", "Tamara"],
    required: true,
  },
  status: { type: String, enum: ["Active", "Cancelled", "Completed", "Rejected", "Released"] },
  rejectionNote: { type: String, trim: true },
  advanceClaimStatus: { type: String, enum: ["Pending", "Released", "Cancelled", "Approved by doctor"] },
  advanceClaimCancellationRemark: { type: String, trim: true },
  updatedAt: { type: Date, default: Date.now },
});

const patientRegistrationSchema = new mongoose.Schema(
  {
    // Auto-generated fields
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    invoicedDate: { type: Date, default: Date.now },
    invoicedBy: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Patient Details
    emrNumber: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    email: { type: String, trim: true, lowercase: true },
    mobileNumber: { 
      type: String, 
      required: true, 
      validate: {
        validator: function(v) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Enter valid 10-digit number"
      }
    },
    referredBy: { type: String, trim: true },
    patientType: { type: String, enum: ["New", "Old"], default: "New" },

    // Medical Details
    doctor: { type: String, required: true, trim: true },
    service: { type: String, enum: ["Package", "Treatment"], required: true },
    treatment: { type: String, trim: true },
    package: { type: String, trim: true },
    packageUnits: { type: Number, default: 1, min: 1 },
    usedSession: { type: Number, default: 0, min: 0 },
    userTreatmentName: { type: String, trim: true },

    // Payment Details
    amount: { type: Number, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    advance: { type: Number, default: 0, min: 0 },
    pending: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ["Cash", "Card", "BT", "Tabby", "Tamara"], required: true },
    paymentHistory: [paymentHistorySchema],

    // Insurance Section
    insurance: { type: String, enum: ["Yes", "No"], default: "No" },
    insuranceType: { type: String, enum: ["Paid", "Advance"], default: "Paid" },
    advanceGivenAmount: { type: Number, default: 0, min: 0 },
    coPayPercent: { type: Number, default: 0, min: 0, max: 100 },
    needToPay: { type: Number, default: 0, min: 0 },
    advanceClaimStatus: { type: String, enum: ["Pending", "Released", "Cancelled","Approved by doctor"], default: function() { return this.insurance === "Yes" ? "Pending" : null; } },
    advanceClaimReleaseDate: { type: Date },
    advanceClaimReleasedBy: { type: String, trim: true },
    advanceClaimCancellationRemark: { type: String, trim: true },

    // Status & Notes
    membership: { type: String, enum: ["Yes", "No"], default: "No" },
    membershipStartDate: { type: Date },
    membershipEndDate: { type: Date },
    notes: { type: String, trim: true },
    rejectionNote: { type: String, trim: true }, // Show when status is rejected
  },
  { timestamps: true }
);

// 🔹 Pre-save hook: calculate pending & needToPay
patientRegistrationSchema.pre("save", function (next) {
  this.amount = Number(this.amount ?? 0);
  this.paid = Number(this.paid ?? 0);
  this.advance = Number(this.advance ?? 0);
  this.advanceGivenAmount = Number(this.advanceGivenAmount ?? 0);
  this.coPayPercent = Number(this.coPayPercent ?? 0);

  // Updated payment calculation logic (avoid double-counting advance)
  // Treat `paid` as the total money received so far
  // Derive `advance` and `pending` purely from `paid` vs `amount`
  if (this.paid >= this.amount) {
    this.pending = 0;
    this.advance = this.paid - this.amount;
  } else {
    this.advance = 0;
    this.pending = this.amount - this.paid;
  }

  // Calculate insurance fields
  if (this.insurance === "Yes") {
    // Advance given amount equals full amount for insurance flow
    this.advanceGivenAmount = this.amount;
    const coPayAmount = (this.amount * this.coPayPercent) / 100;
    // Need to pay is amount after deducting co-pay percent
    this.needToPay = Math.max(0, this.amount - coPayAmount);
  } else {
    this.needToPay = this.pending;
  }

  next();
});

// 🔹 Indexes for faster search
patientRegistrationSchema.index({ invoiceNumber: 1 });
patientRegistrationSchema.index({ firstName: 1, lastName: 1 });
patientRegistrationSchema.index({ mobileNumber: 1 });

export default mongoose.models.PatientRegistration ||
  mongoose.model("PatientRegistration", patientRegistrationSchema);
