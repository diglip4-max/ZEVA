import mongoose from "mongoose";

const TagSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    }, // ✅ Clinic that owns this UOM
    tag: {
      type: String,
      required: [true, "Tag is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// 🔥 Important fix for Next.js hot-reload
if (mongoose.models.Tag) {
  delete mongoose.models.Tag;
}

export default mongoose.model("Tag", TagSchema);
