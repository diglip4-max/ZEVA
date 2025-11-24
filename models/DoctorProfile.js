// models/DoctorProfile.ts
import mongoose from "mongoose";
import { TreatmentRefSchema } from "../schema/TreatmentRef";
const TimeSlotSchema = new mongoose.Schema(
  {
    date: { type: String, required: false }, // e.g., "Today", "Tomorrow", "Fri, 4 Jul"
    availableSlots: { type: Number, required: false },
    sessions: {
      morning: [{ type: String }],
      evening: [{ type: String }],
    },
  },
  { _id: false }
);

const DoctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    degree: { type: String, required: true },
    photos: [String],
    treatments: { type: [TreatmentRefSchema], default: [] },
    experience: { type: Number, required: true },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    consultationFee: { type: Number, required: false },
    clinicContact: { type: String, required: false },
    timeSlots: [TimeSlotSchema],
    resumeUrl: { type: String, required: true },
  },

  { timestamps: true }
);

DoctorProfileSchema.index({ location: "2dsphere" });
DoctorProfileSchema.index({
  "treatments.mainTreatmentSlug": 1,
  "treatments.subTreatmentSlug": 1,
});

delete mongoose.models.DoctorProfile; // ❗ Force model refresh during development

export default mongoose.model("DoctorProfile", DoctorProfileSchema);
