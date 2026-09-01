// models/BankAccount.js
import { Schema, model, models, Types } from "mongoose";

const BankAccountSchema = new Schema(
  {
    clinicId: { type: Types.ObjectId, ref: "Clinic", required: true },

    bankName: { type: String, required: true },
    accountName: String,
    accountNumber: String,
    ifscCode: String,

    currentBalance: { type: Number, default: 0 }, // manual/optional per doc — owner/admin updates it
    notes: String,

    isActive: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: "User" },

    history: [
      {
        field: String,
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        changedBy: { type: Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

BankAccountSchema.index({ clinicId: 1, isActive: 1 });

export const BankAccount =
  models.BankAccount || model("BankAccount", BankAccountSchema);
