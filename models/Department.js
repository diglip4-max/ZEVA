import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema(
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

// Ensure unique department names per clinic
DepartmentSchema.index({ clinicId: 1, name: 1 }, { unique: true });

// Prevent caching of model schema in Next.js development hot-reloading
if (mongoose.models.Department) {
  delete mongoose.models.Department;
}

export default mongoose.model("Department", DepartmentSchema);

