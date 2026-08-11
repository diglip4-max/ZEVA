import mongoose from "mongoose";
// Inline schema for manual clinic petty cash (stored in a simple collection)

const ManualPettyCashSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
    isExpense: { type: Boolean, default: false },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    vendorName: { type: String },
    items: [
      {
        itemName: { type: String },
        amount: { type: Number },
      },
    ],
    images: [{ type: String }],
    usedFromPettyCash: { type: Boolean, default: true },
  },
  { timestamps: true },
);
// Prevent model recompilation error in development
delete mongoose.models.ManualPettyCash;

const ManualPettyCash =
  mongoose.models.ManualPettyCash ||
  mongoose.model("ManualPettyCash", ManualPettyCashSchema);

export default ManualPettyCash;
