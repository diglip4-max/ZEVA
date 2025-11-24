import mongoose from "mongoose";

const { Schema } = mongoose;

const OfferSchema = new Schema({
  clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  type: {
    type: String,
    enum: ["percentage", "fixed", "free Consult"],
    required: true,
  },
  value: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  code: { type: String, index: true, sparse: true },
  slug: { type: String, index: true, sparse: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  timezone: { type: String, default: "Asia/Kolkata" },
  maxUses: { type: Number, default: null },
  usesCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  channels: [{ type: String, enum: ["email", "sms", "web", "affiliate"] }],
  utm: {
    source: { type: String, default: "clinic" },
    medium: { type: String, default: "email" },
    campaign: { type: String, default: "" },
  },
  conditions: { type: Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ["draft", "active", "paused", "expired", "archived"],
    default: "draft",
  },

  // 🔹 Store selected treatments
  treatments: [{ type: Schema.Types.ObjectId, ref: "Treatment" }],

  // 🔹 Store selected subtreatments as embedded docs
  subTreatments: [
    {
      treatmentId: { type: Schema.Types.ObjectId, ref: "Treatment", required: true },
      slug: { type: String, required: true }, // e.g. "root-canal-treatment"
      name: { type: String, required: true }, // e.g. "Root Canal Treatment"
    },
  ],

  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

OfferSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  if (this.endsAt && new Date() > this.endsAt) this.status = "expired";
  next();
});

// ✅ Export the model correctly
export default mongoose.models.Offer || mongoose.model("Offer", OfferSchema);
