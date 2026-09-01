import mongoose from "mongoose";
import { Schema, model, models } from "mongoose";

// ============================================================
// NOTIFICATION CATALOG (Master list - System defined)
// ============================================================

const NotificationCatalogSchema = new Schema(
  {
    notificationTypeKey: {
      type: String,
      unique: true,
      required: true,
    }, // "payment.received"

    category: {
      type: String,
      enum: [
        "payment",
        "appointment",
        "package",
        "followup",
        "engagement",
        "offer",
        "feedback",
        "security",
      ],
      required: true,
    },

    label: { type: String, required: true }, // "Payment Received"
    isProtected: { type: Boolean, default: false },

    // Default settings (clinic can override)
    defaultIsEnabled: { type: Boolean, default: true },

    defaultChannels: [
      {
        channel: {
          type: String,
          enum: ["whatsapp", "sms", "email", "app_push"],
        },
        recipient: {
          type: String,
          enum: ["patient", "staff"],
          default: "patient",
        },
        priority: { type: Number, default: 1 },
        _id: false,
      },
    ],

    defaultTiming: {
      mode: {
        type: String,
        enum: ["immediate", "before_event", "after_event"],
        default: "immediate",
      },
      offsetMinutes: { type: Number, default: 0 },
    },

    // No defaultRecipients here either — derive from defaultChannels[].recipient,
    // same reasoning as NotificationSetting.

    defaultConditions: {
      type: Schema.Types.Mixed,
      default: {},
    },

    bypassQuietHours: { type: Boolean, default: false },
    respectMarketingPreference: { type: Boolean, default: false },
    preventDuplicateForSameEvent: { type: Boolean, default: true },

    version: { type: Number, default: 1 },
    // A catalog entry is a real, usable notification type by default.
    // Flip to false only for staged/draft types not yet released to clinics.
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ============================================================
// INDEXES
// ============================================================

NotificationCatalogSchema.index({ notificationTypeKey: 1 });
NotificationCatalogSchema.index({ category: 1 });
NotificationCatalogSchema.index({ isActive: 1 });

// ============================================================
// MODEL
// ============================================================

export const NotificationCatalog =
  models.NotificationCatalog ||
  model("NotificationCatalog", NotificationCatalogSchema);
