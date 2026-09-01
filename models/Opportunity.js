import mongoose from "mongoose";

const { Schema } = mongoose;

const OpportunitySchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },

    // Dynamic intent — valid values come from IntentDefinition, not hardcoded here
    intent: {
      type: String,
      required: true,
    },

    confidence: { type: Number, min: 0, max: 1, default: 1 },

    // The lead's exact message text
    leadMessage: { type: String, required: true },

    // What KAKA replied (if AI already responded)
    aiResponse: { type: String, default: null },

    // AI-generated suggestion for staff
    staffSuggestion: { type: String, default: null },

    // Extracted entities (treatment name, doctor name, date mentioned, etc.)
    entities: {
      treatments: [String],
      doctors: [String],
      dates: [String],
      prices: [String],
    },

    status: {
      type: String,
      enum: ["new", "viewed", "contacted", "converted", "dismissed"],
      default: "new",
      index: true,
    },

    // Likelihood score for dashboard sorting (0-100)
    relevanceScore: { type: Number, default: 0, index: true },

    // Auto-expire after 48 hours if not acted on
    expiresAt: { type: Date, index: true },

    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Dashboard query index
OpportunitySchema.index({ clinicId: 1, status: 1, createdAt: -1 });
// Prevent duplicate opportunities for same message
OpportunitySchema.index({ messageId: 1 }, { unique: true });

const Opportunity =
  mongoose.models.Opportunity ||
  mongoose.model("Opportunity", OpportunitySchema);

export default Opportunity;
