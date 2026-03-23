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
    documents: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true, trim: true },
            url: { type: String, required: true, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    tagline: { type: String, default: "" },
    description: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    isApproved: { type: Boolean, default: false },
    declined: { type: Boolean, default: false },
    slug: { 
      type: String, 
      unique: true, 
      sparse: true, // Only unique when exists
      index: true 
    },
    slugLocked: { type: Boolean, default: false }, // Lock slug once approved
    otpWhatsAppNumber: { type: String, default: null },
    otpEmail: { type: String, default: null },
  },
  { timestamps: true }
);

ClinicSchema.index({ location: "2dsphere" });
ClinicSchema.index({
  "treatments.mainTreatmentSlug": 1,
  "treatments.subTreatmentSlug": 1,
});



if (mongoose.models.Clinic) {
  delete mongoose.models.Clinic;
}
export default mongoose.model("Clinic", ClinicSchema);
