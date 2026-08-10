import mongoose from "mongoose";

const BlockedSlotSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    fromTime: {
      type: String,
      required: true, // Format: "HH:MM" (24-hour)
    },
    toTime: {
      type: String,
      required: true, // Format: "HH:MM" (24-hour)
    },
    reason: {
      type: String,
      trim: true,
      default: "", // e.g. "Doctor off", "Maintenance"
    },

    // Who blocked it
    blockedByRole: {
      type: String,
      enum: ["clinic", "admin", "doctor", "staff"],
      default: null,
    },
    blockedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    blockedByName: {
      type: String,
      trim: true,
      default: null,
    },
    blockedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true, // false = unblocked
    },

    // Who unblocked it
    unblockedByRole: {
      type: String,
      enum: ["clinic", "admin", "doctor", "staff"],
      default: null,
    },
    unblockedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    unblockedByName: {
      type: String,
      trim: true,
      default: null,
    },
    unblockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

BlockedSlotSchema.index({ clinicId: 1, startDate: 1, fromTime: 1 });
BlockedSlotSchema.index({ doctorId: 1, startDate: 1 });
BlockedSlotSchema.index({ roomId: 1, startDate: 1 });

// Prevent caching of model schema in Next.js development hot-reloading
if (mongoose.models.BlockedSlot) {
  delete mongoose.models.BlockedSlot;
}

export default mongoose.model("BlockedSlot", BlockedSlotSchema);
