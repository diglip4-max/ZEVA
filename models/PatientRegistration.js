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
    invoiceNumber: { type: String, unique: true, trim: true },
    invoicedDate: { type: Date, default: Date.now },
    invoicedBy: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Patient Details
    emrNumber: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    email: { type: String, trim: true, lowercase: true },
    mobileNumber: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v) {
          return /^[0-9]{}$/.test(v);
        },
        message: "Enter valid mobile number"
      }
    },
    referredBy: { type: String, trim: true },
    patientType: { type: String, enum: ["New", "Old"], default: "New" },


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

// 🔹 Pre-save hook: calculate needToPay for insurance
patientRegistrationSchema.pre("save", function (next) {
  this.advanceGivenAmount = Number(this.advanceGivenAmount ?? 0);
  this.coPayPercent = Number(this.coPayPercent ?? 0);

  // Calculate insurance fields
  if (this.insurance === "Yes") {
    const coPayAmount = (this.advanceGivenAmount * this.coPayPercent) / 100;
    // Need to pay is advance given amount after deducting co-pay percent
    this.needToPay = Math.max(0, this.advanceGivenAmount - coPayAmount);
  } else {
    this.needToPay = 0;
  }

  next();
});

// 🔹 Indexes for faster search
patientRegistrationSchema.index({ invoiceNumber: 1 });
patientRegistrationSchema.index({ firstName: 1, lastName: 1 });
patientRegistrationSchema.index({ mobileNumber: 1 });

if (mongoose.models.PatientRegistration) {
  delete mongoose.models.PatientRegistration;
}
export default mongoose.model("PatientRegistration", patientRegistrationSchema);
