import mongoose from "mongoose";
const { Schema, model, models, Types } = mongoose;

// ============================================================
// 1. NOTIFICATION SETTING (per clinic, per notification type)
// ============================================================

const NotificationSettingSchema = new Schema({
  clinicId: {
    type: Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
    index: true,
  },

  notificationTypeKey: {
    type: String,
    required: true,
  },
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
  label: { type: String, required: true },

  // ON/OFF
  isEnabled: { type: Boolean, default: false },
  isProtected: { type: Boolean, default: false },

  // Trigger
  trigger: {
    event: { type: String, required: true },
    conditions: { type: Schema.Types.Mixed, default: {} },
  },

  // NOTE on recipients: no separate top-level `recipients` field —
  // that would just duplicate `channels[].recipient` below and risk
  // going out of sync. To know who this notification goes to, derive
  // it from channels: [...new Set(channels.map(c => c.recipient))].
  //
  // If the same event needs materially different messages per
  // recipient (e.g. package-transfer: original patient vs new patient,
  // payment-failed: patient vs staff), prefer creating a SEPARATE
  // notificationTypeKey per recipient instead of cramming both into
  // one type's channels array.

  // Channels with ON/OFF per channel, recipient-aware
  channels: [
    {
      channel: {
        type: String,
        enum: ["whatsapp", "sms", "email", "app_push"],
        required: true,
      },
      recipient: {
        type: String,
        enum: ["patient", "staff"],
        default: "patient",
      },
      isEnabled: { type: Boolean, default: false },
      priority: { type: Number, default: 1 }, // lower = tried first; used for fallback ordering
      providerId: { type: Schema.Types.ObjectId, ref: "Provider" },
      templateId: { type: Schema.Types.ObjectId, ref: "Template" },

      mediaUrl: {
        type: String,
        default: "",
      },
      mediaType: {
        type: String,
        enum: ["image", "video", "audio", "document", "file", ""],
        default: "",
      },

      variableMappings: { type: Object, default: {} },
      headerVariableMappings: { type: Object, default: {} },
      buttonVariableMappings: { type: Object, default: {} },

      attachments: [
        // for email attachments
        {
          fileName: { type: String },
          fileSize: { type: String },
          mimeType: { type: String },
          mediaUrl: { type: String }, // url to access the attachment
          mediaType: {
            type: String,
            enum: ["image", "video", "audio", "document", "file", ""],
            default: "",
          },
        },
      ],

      _id: false,
    },
  ],

  // Timing
  timing: {
    mode: {
      type: String,
      enum: ["immediate", "before_event", "after_event"],
      default: "immediate",
    },
    offsetMinutes: { type: Number, default: 0 },
  },

  // Rules
  bypassQuietHours: { type: Boolean, default: false },
  respectMarketingPreference: { type: Boolean, default: false },
  preventDuplicateForSameEvent: { type: Boolean, default: true },
});

// ============================================================
// 2. CLINIC SETTINGS (Main document)
// ============================================================

const SettingSchema = new Schema(
  {
    clinicId: {
      type: Types.ObjectId,
      ref: "Clinic",
      required: true,
      unique: true,
    },

    notificationSetting: [NotificationSettingSchema],

    quietHours: {
      start: { type: String, default: "22:00" },
      end: { type: String, default: "08:00" },
    },

    // Section 14: prevents over-messaging on marketing/offer/engagement sends
    marketingRules: {
      maxPerWeek: { type: Number, default: 2 },
      appliesToCategories: {
        type: [String],
        default: ["engagement", "offer"],
      },
    },

    isPaused: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SettingSchema.index({ clinicId: 1 });

export const Setting = models.Setting || model("Setting", SettingSchema);
