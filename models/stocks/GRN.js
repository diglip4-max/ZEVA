import mongoose from "mongoose";

const GRNSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    }, // ✅ Clinic that owns this GRN
    // TODO
    grnNo: {
      type: String,
      required: [true, "GRN number is required"],
      trim: true,
    },
    branch: {
      // it will actuall branch reference not string
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    purchasedOrder: {
      // it will actually be a reference to a Purchase Order, not a branch
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRecord",
      required: true,
      index: true,
    },
    grnDate: {
      type: Date,
      required: true,
    },
    supplierInvoiceNo: {
      type: String,
      required: [true, "Supplier invoice number is required"],
      trim: true,
    },
    supplierGrnDate: {
      type: Date,
      required: [true, "Supplier GRN date is required"],
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["New", "Partly_Invoiced", "Invoiced", "Partly_Paid", "Paid", "Deleted"],
      default: "New",
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
if (mongoose.models.GRN) {
  delete mongoose.models.GRN;
}

export default mongoose.model("GRN", GRNSchema);
