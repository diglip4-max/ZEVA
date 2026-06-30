import mongoose from "mongoose";

// Separate function to find next available product sale invoice number
async function getNextAvailableProductSaleInvoiceNo(clinicId) {
  const prefix = "PSINV";

  try {
    // Find the highest invoice number for this clinic
    const lastInvoice = await mongoose
      .model("ProductSale")
      .findOne({
        clinicId,
        invoiceNo: { $regex: `^${prefix}-\\d{6}$` },
      })
      .sort({ invoiceNo: -1 })
      .select("invoiceNo");

    if (!lastInvoice || !lastInvoice.invoiceNo) {
      // First invoice for this clinic
      return `${prefix}-000001`;
    }

    // Extract the numeric part and increment
    const match = lastInvoice.invoiceNo.match(/\d+$/);
    if (match) {
      const currentNumber = parseInt(match[0], 10);
      const nextNumber = currentNumber + 1;
      return `${prefix}-${String(nextNumber).padStart(6, "0")}`;
    }

    // Fallback if format doesn't match
    return `${prefix}-000001`;
  } catch (error) {
    console.error("Error generating product sale invoice number:", error);
    // Fallback with timestamp
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }
}

const ProductSaleSchema = new mongoose.Schema(
  {
    clinicId: {
      type: String,
      required: true,
    },
    invoiceNo: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now(),
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
    },
    paymentMethodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
      required: true,
    },
    paymentMethodName: {
      type: String,
      required: true,
    },
    items: [
      {
        allocatedItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AllocatedItem",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        code: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        uom: {
          type: String,
          required: true,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        totalPrice: {
          type: Number,
          required: true,
        },
        currency: {
          type: String,
          enum: ["AED", "USD"],
          default: "AED",
        },
        notes: {
          type: String,
          trim: true,
          default: "",
        },
        _id: false,
      },
    ],

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "canceled",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "partially_refunded", "refunded"],
      default: "pending",
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// In pre-save hook
ProductSaleSchema.pre("save", async function (next) {
  if (!this.invoiceNo) {
    try {
      this.invoiceNo = await getNextAvailableProductSaleInvoiceNo(
        this.clinicId,
      );
    } catch (error) {
      console.error(
        "Error generating product sale invoice number in pre-save:",
        error,
      );
      // Fallback to timestamp-based numbering
      this.invoiceNo = `PSINV-${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

// Add index for better query performance
ProductSaleSchema.index({ clinicId: 1, invoiceNo: 1 });

// Fix for Next.js hot-reload - always replace models to reflect latest schema
if (mongoose.models.ProductSale) {
  delete mongoose.models.ProductSale;
}

const ProductSale = mongoose.model("ProductSale", ProductSaleSchema);

export default ProductSale;
