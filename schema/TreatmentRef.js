// schemas/TreatmentRef.ts
import mongoose from "mongoose";

const SubTreatmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

export const TreatmentRefSchema = new mongoose.Schema(
  {
    mainTreatment: { type: String, required: true },
    mainTreatmentSlug: { type: String, required: true },
    subTreatments: [SubTreatmentSchema], // Array of sub-treatments
  },
  { _id: false }
);
