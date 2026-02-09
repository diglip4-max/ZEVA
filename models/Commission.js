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
  },
  { timestamps: true }
);

CommissionSchema.index({ clinicId: 1, source: 1, billingId: 1 });
CommissionSchema.index({ clinicId: 1, createdAt: -1 });

delete mongoose.models.Commission;
export default mongoose.models.Commission || mongoose.model("Commission", CommissionSchema);
