import mongoose from "mongoose";

const ConsentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    // Step 1: File
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    // Step 2: Form Details
    formName: {
      type: String,
      required: true,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    language: {
      type: String,
      enum: ["English", "Spanish", "French", "Arabic", "Hindi"],
      default: "English",
    },
    version: {
      type: String,
      default: "1.0",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // Step 3: Service Mapping
    serviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    // Step 4: Signature Settings
    enableDigitalSignature: {
      type: Boolean,
      default: false,
    },
    requireNameConfirmation: {
      type: Boolean,
      default: false,
    },
    // Status
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Consent || mongoose.model("Consent", ConsentSchema);
