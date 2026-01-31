// models/AgentProfile.ts
import mongoose from "mongoose";

const AgentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    agentCode: { type: String, unique: true },
    emergencyPhone: String,
    relativePhone: String,

    idType: { type: String, enum: ["aadhaar", "pan", "passport"] },
    idNumber: String,
    idDocumentUrl: String,

    passportNumber: String,
    passportDocumentUrl: String,

    contractUrl: String,
    contractType: { type: String, enum: ["full", "part"] },

    baseSalary: { type: Number, default: 0 },

    /** ✅ Commission preference (NOT calculation) */
    commissionType: {
      type: String,
      enum: [
        "flat",
        "after_deduction",
        "target_based",
        "target_plus_expense",
      ],
      default: "flat",
    },

    joiningDate: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AgentProfileSchema.index({ userId: 1 });

export default mongoose.models.AgentProfile ||
  mongoose.model("AgentProfile", AgentProfileSchema);
