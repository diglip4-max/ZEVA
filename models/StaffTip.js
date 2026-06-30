import mongoose from "mongoose";

const staffTipSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    billingId: {
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
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
    },
    staffRole: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

staffTipSchema.index({ clinicId: 1, billingId: 1 });
staffTipSchema.index({ clinicId: 1, staffId: 1, createdAt: -1 });

if (mongoose.models.StaffTip) {
  delete mongoose.models.StaffTip;
}

export default mongoose.models.StaffTip || mongoose.model("StaffTip", staffTipSchema);
