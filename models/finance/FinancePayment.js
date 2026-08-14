// models/FinancePayment.ts
import { Schema, model, models, Types } from "mongoose";

const FinancePaymentSchema = new Schema(
  {
    clinicId: { type: Types.ObjectId, ref: "Clinic", required: true },
    transactionId: {
      type: Types.ObjectId,
      ref: "FinanceTransaction",
      required: true,
    },
    supplierId: { type: Types.ObjectId, ref: "Supplier" },

    paymentNumber: { type: String, unique: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "card", "online", "petty_cash"],
      required: true,
    },

    // bankAccountId: { type: Types.ObjectId, ref: "BankAccount" },
    chequeId: { type: Types.ObjectId, ref: "Cheque" },

    attachment: String,
    notes: String,
    reversed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FinancePaymentSchema.index({ transactionId: 1 });
FinancePaymentSchema.index({ supplierId: 1, date: -1 });

FinancePaymentSchema.pre("save", async function (next) {
  if (this.isNew && !this.paymentNumber) {
    const year = new Date().getFullYear();

    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    });

    const padded = String(count + 1).padStart(6, "0");
    this.paymentNumber = `PAY-${year}-${padded}`;
  }
  next();
});

export const FinancePayment =
  models.FinancePayment || model("FinancePayment", FinancePaymentSchema);
