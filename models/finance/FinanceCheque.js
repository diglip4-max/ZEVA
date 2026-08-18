// models/FinanceCheque.ts
import { Schema, model, models, Types } from "mongoose";

const FinanceChequeSchema = new Schema(
  {
    clinicId: { type: Types.ObjectId, ref: "Clinic", required: true },
    paymentId: { type: Types.ObjectId, ref: "FinancePayment", required: true },
    transactionId: { type: Types.ObjectId, ref: "FinanceTransaction" },
    supplierId: { type: Types.ObjectId, ref: "Supplier" },

    chequeNumber: String,
    bank: String,
    payee: String,
    amount: Number,
    chequeDate: Date,

    status: {
      type: String,
      enum: [
        "issued",
        "presented",
        "cleared",
        "returned",
        "bounced",
        "cancelled",
      ],
      default: "issued",
    },

    history: [
      {
        status: String,
        changedBy: { type: Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

FinanceChequeSchema.index({ supplierId: 1, status: 1 });
FinanceChequeSchema.index({ paymentId: 1 });

export const FinanceCheque =
  models.FinanceCheque || model("FinanceCheque", FinanceChequeSchema);
