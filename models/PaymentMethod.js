import mongoose from "mongoose";

const PaymentMethodSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    }, // ✅ Clinic that owns this UOM
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    uniqueName: {
      type: String,
      required: [true, "Unique name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    isDeleteable: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// 🔥 Important fix for Next.js hot-reload
if (mongoose.models.PaymentMethod) {
  delete mongoose.models.PaymentMethod;
}

export default mongoose.model("PaymentMethod", PaymentMethodSchema);
