import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema(
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure unique room names per clinic
RoomSchema.index({ clinicId: 1, name: 1 }, { unique: true });

// Prevent caching of model schema in Next.js development hot-reloading
if (mongoose.models.Room) {
  delete mongoose.models.Room;
}

export default mongoose.model("Room", RoomSchema);

