import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    treatments: [
      {
        treatmentName: {
          type: String,
          required: true,
        },
        treatmentSlug: {
          type: String,
          required: false,
        },
        sessions: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure unique package names per clinic
PackageSchema.index({ clinicId: 1, name: 1 }, { unique: true });

export default mongoose.models.Package || mongoose.model("Package", PackageSchema);

