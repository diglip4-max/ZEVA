// /models/Lead.js
import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId,  ref: "Clinic",  required: true, index: true }, // ✅ Clinic that owns this lead

    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    age: { type: Number },

    treatments: [
      {
        treatment: { type: mongoose.Schema.Types.ObjectId, ref: "Treatment", required: true },
        subTreatment: { type: String },
      },
    ],

    source: {
      type: String,
      enum: ["Instagram", "Facebook", "Google", "WhatsApp", "Walk-in", "Other"],
      required: true,
      index: true,
    },
    customSource: { type: String },

    offerTag: { type: String, index: true },

    status: {
      type: String,
      enum: ["New", "Contacted", "Booked", "Visited", "Follow-up", "Not Interested", "Other"],
      default: "New",
      index: true,
    },
    customStatus: { type: String },

    notes: [
      {
        text: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    assignedTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        assignedAt: { type: Date, default: Date.now },
      },
    ],

    followUps: [{ date: { type: Date } }],
    nextFollowUps: [{ date: { type: Date } }],
  },
  { timestamps: true }
);

delete mongoose.models.Lead; 

export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
