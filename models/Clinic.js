// models/Clinic.ts
import mongoose from "mongoose";
import { TreatmentRefSchema } from "../schema/TreatmentRef";

const ClinicSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: String,
    address: String,
    treatments: { type: [TreatmentRefSchema], default: [] }, // subTreatments now include price
    servicesName: { type: [String], default: [] },
    pricing: String,
    timings: String,
    photos: [String],
    licenseDocumentUrl: { type: String, default: null },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    isApproved: { type: Boolean, default: false },
    declined: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ClinicSchema.index({ location: "2dsphere" });
ClinicSchema.index({
  "treatments.mainTreatmentSlug": 1,
  "treatments.subTreatmentSlug": 1,
});



export default mongoose.models.Clinic || mongoose.model("Clinic", ClinicSchema);
