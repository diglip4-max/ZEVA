import mongoose from "mongoose";
import { Schema, model, models, Types } from "mongoose";

// ============================================================
// NOTIFICATION LOG (Delivery history + audit trail)
// ============================================================

const NotificationLogSchema = new Schema(
  {
    clinicId: {
      type: Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    patientId: {
      type: Types.ObjectId,
      ref: "PatientRegistration",
    },

    notificationTypeKey: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    label: { type: String, required: true },
    trigger: {
      event: { type: String, required: true },
      conditions: { type: Schema.Types.Mixed, default: {} },
    },
    sourceId: { type: Types.ObjectId }, // paymentId, appointmentId, etc.

    channel: { type: String, enum: ["whatsapp", "sms", "email", "app_push"] },
    recipient: {
      type: String,
      enum: ["patient", "staff"],
      default: "patient",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "queued",
        "sent",
        "delivered",
        "read",
        "opened",
        "clicked",
        "failed",
      ],
      default: "pending",
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    openedAt: { type: Date }, // for booking/offer links — section 23 "Opened" metric
    clickedAt: { type: Date }, // for booking/offer links — section 23 "Clicked" metric

    error: { type: String, default: "" },

    // Section 24 audit trail: who/what caused this notification.
    // Omit for system-triggered events; set for manual sends/resends.
    triggeredBy: {
      type: { type: String, enum: ["system", "user"], default: "system" },
      userId: { type: Types.ObjectId, ref: "User" },
    },

    // Message info
    messageId: { type: Types.ObjectId, ref: "Message" },
  },
  { timestamps: true },
);

// Indexes for faster queries
NotificationLogSchema.index({ clinicId: 1, patientId: 1, createdAt: -1 });
NotificationLogSchema.index({
  clinicId: 1,
  notificationTypeKey: 1,
  createdAt: -1,
});
NotificationLogSchema.index({ sourceId: 1 });
NotificationLogSchema.index({ campaignId: 1, status: 1 });

// ============================================================
// MODEL
// ============================================================

export const NotificationLog =
  models.NotificationLog || model("NotificationLog", NotificationLogSchema);
