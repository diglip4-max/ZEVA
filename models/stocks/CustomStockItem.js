import mongoose from "mongoose";

const CustomStockItemSchema = new mongoose.Schema(
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
    },
    code: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    uom: {
      type: String,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["Fixed", "Percentage"],
      default: "Fixed",
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    netPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    vatType: {
      type: String,
      enum: ["Exclusive", "Inclusive"],
      default: "Exclusive",
    },
    vatPercentage: {
      type: Number,
      default: 0,
    },
    netPlusVat: {
      type: Number,
      default: 0,
    },
    freeQuantity: {
      type: Number,
      default: 0,
    },
    freeQuantityExpiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["New", "Allocated", "Expired"],
      default: "New",
    },
    // packaging structure
    level0: {
      price: {
        type: Number,
        default: 0,
      },
      uom: {
        type: String,
        trim: true,
      },
    },
    packagingStructure: {
      level1: {
        quantity: {
          type: Number,
          default: 1,
        },
        price: {
          type: Number,
          default: 0,
        },
        uom: {
          type: String,
          trim: true,
        },
      },
      level2: {
        quantity: {
          type: Number,
          default: 1,
        },
        price: {
          type: Number,
          default: 0,
        },
        uom: {
          type: String,
          trim: true,
        },
      },
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

// For Next.js hot-reload - always replace models to reflect latest schema
if (mongoose.models.CustomStockItem) {
  delete mongoose.models.CustomStockItem;
}

const CustomStockItem = mongoose.model(
  "CustomStockItem",
  CustomStockItemSchema,
);
export default CustomStockItem;
