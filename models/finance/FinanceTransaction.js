// models/finance/FinanceTransaction.js
import { Schema, model, models, Types } from "mongoose";

const FinanceTransactionSchema = new Schema(
  {
    clinicId: { type: Types.ObjectId, ref: "Clinic", required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    entryType: {
      type: String,
      enum: ["bill", "expense", "petty_cash", "receivable"],
      required: true,
    },

    category: String,
    supplierId: { type: Types.ObjectId, ref: "Supplier" },

    invoiceNumber: { type: String, unique: true },
    invoiceDate: Date,
    dueDate: Date,

    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: {
      type: Number,
      default: function () {
        return this.amount;
      },
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "upcoming",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      default: "pending",
    },

    attachments: [String],
    notes: String,

    branchId: { type: Types.ObjectId, ref: "Branch" },
    createdBy: { type: Types.ObjectId, ref: "User" },

    history: [
      {
        user: { type: Types.ObjectId, ref: "User" },
        action: String,
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],

    isClosedMonth: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FinanceTransactionSchema.index({ supplierId: 1, status: 1 });
FinanceTransactionSchema.index({ entryType: 1, status: 1 });
FinanceTransactionSchema.index({ supplierId: 1, invoiceNumber: 1 });

// Counter collection ke bina, koi clinic prefix bhi nahi —
// simple global year-scoped sequence: FINV-2026-000001
FinanceTransactionSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();

    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    });

    const padded = String(count + 1).padStart(6, "0");
    this.invoiceNumber = `FINV-${year}-${padded}`;
  }
  next();
});

export const FinanceTransaction =
  models.FinanceTransaction ||
  model("FinanceTransaction", FinanceTransactionSchema);
