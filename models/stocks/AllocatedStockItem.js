import mongoose from "mongoose";

const AllocatedStockItemSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    item: {
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StockItem",
      },
      customStockItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomStockItem",
      },
      code: {
        type: String,
        trim: true,
      },
      name: {
        type: String,
        required: true,
      },
      description: {
        type: String,
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
        salePrice: {
          type: Number,
          default: 0,
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
          salePrice: {
            type: Number,
            default: 0,
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
          salePrice: {
            type: Number,
            default: 0,
          },
        },
      },
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockLocation",
    },
    status: {
      type: String,
      enum: [
        "Allocated",
        "Issued",
        "Used",
        "Partially_Used",
        "Returned",
        "Expired",
        "Cancelled",
        "Deleted",
      ],
      default: "Allocated",
      index: true,
    },
    expiryDate: {
      type: Date,
      index: true,
    },
    quantitiesByUom: [
      {
        uom: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 0,
        },
        _id: false,
      },
    ],
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const AllocatedStockItemDetailsSchema = new mongoose.Schema(
  {
    allocatedStockItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AllocatedStockItem",
        required: true,
      },
    ],
    purchaseRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRecord",
    },
    customStockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomStockItem",
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Fix for Next.js hot-reload - always replace models to reflect latest schema
if (mongoose.models.AllocatedStockItem) {
  delete mongoose.models.AllocatedStockItem;
}
if (mongoose.modelSchemas && mongoose.modelSchemas.AllocatedStockItem) {
  delete mongoose.modelSchemas.AllocatedStockItem;
}
const AllocatedStockItem = mongoose.model(
  "AllocatedStockItem",
  AllocatedStockItemSchema,
);

if (mongoose.models.AllocatedStockItemDetails) {
  delete mongoose.models.AllocatedStockItemDetails;
}
if (mongoose.modelSchemas && mongoose.modelSchemas.AllocatedStockItemDetails) {
  delete mongoose.modelSchemas.AllocatedStockItemDetails;
}
const AllocatedStockItemDetails = mongoose.model(
  "AllocatedStockItemDetails",
  AllocatedStockItemDetailsSchema,
);

export { AllocatedStockItemDetails };
export default AllocatedStockItem;
