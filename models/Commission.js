import mongoose from "mongoose";

const CommissionSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    // Source indicates who this commission is for
    source: { type: String, enum: ["referral", "staff"], required: true, index: true },
    // Referral-based commission fields (optional depending on source)
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: "Referral", index: true },
    referralName: { type: String, trim: true },
    // Staff/doctor-based commission fields (optional depending on source)
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    commissionType: { type: String, enum: ["flat", "after_deduction", "target_based", "target_plus_expense"], default: "flat" },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "PatientRegistration", required: true },
    billingId: { type: mongoose.Schema.Types.ObjectId, ref: "Billing", required: true },
    commissionPercent: { type: Number, min: 0, max: 100, required: true },
    amountPaid: { type: Number, min: 0, required: true },
    commissionAmount: { type: Number, min: 0, required: true },
    invoicedDate: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Target-based commission fields
    targetAmount: { type: Number, min: 0, default: 0 }, // Target amount for this staff member
    cumulativeAchieved: { type: Number, min: 0, default: 0 }, // Total achieved amount until this transaction
    isAboveTarget: { type: Boolean, default: false }, // Whether this transaction crossed the target
    // After-deduction commission fields
    totalExpenses: { type: Number, min: 0, default: 0 }, // Total expenses from NEW patient complaints/items (since last billing)
    netAmount: { type: Number, min: 0, default: 0 }, // Net amount after deducting expenses (paidAmount - totalExpenses)
    expenseBreakdown: { type: Array, default: [] }, // Detailed breakdown of expenses per complaint
    complaintsCount: { type: Number, min: 0, default: 0 }, // Number of NEW complaints used for expense calculation
    lastBillingDate: { type: Date }, // Date of the last billing (cutoff for NEW complaints)
    lastBillingInvoice: { type: String }, // Invoice number of the last billing
    isFirstBilling: { type: Boolean, default: false }, // Whether this is the first billing for the patient
    // Target-plus-expense commission fields
    amountAboveTarget: { type: Number, min: 0, default: 0 }, // Amount exceeding the target
    netCommissionableAmount: { type: Number, min: 0, default: 0 }, // Amount above target minus expenses
  },
  { timestamps: true }
);

CommissionSchema.index({ clinicId: 1, source: 1, billingId: 1 });
CommissionSchema.index({ clinicId: 1, createdAt: -1 });

delete mongoose.models.Commission;
export default mongoose.models.Commission || mongoose.model("Commission", CommissionSchema);
