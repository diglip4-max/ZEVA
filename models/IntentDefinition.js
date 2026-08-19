// models/IntentDefinition.js
// Dynamic intent category definition — allows adding new intent types via DB records
// without any code deploy. clinicId: null means global default; a set value scopes to one clinic.

import mongoose from "mongoose";

const { Schema } = mongoose;

const ExampleSchema = new Schema(
  {
    message: { type: String, required: true },
    expectedOutput: {
      intent: { type: String, required: true },
      entities: {
        treatments: { type: [String], default: [] },
        doctors: { type: [String], default: [] },
        dates: { type: [String], default: [] },
        prices: { type: [String], default: [] },
      },
    },
  },
  { _id: false }
);

const IntentDefinitionSchema = new Schema(
  {
    // null = global default for all clinics; set = scoped to one clinic
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
      index: true,
    },

    // Machine-readable identifier (e.g., "price_inquiry") — unique per clinic scope
    key: { type: String, required: true },

    // Human-readable name for admin UI display (e.g., "Price Inquiry")
    label: { type: String, required: true },

    // Plain-English definition used inside the LLM prompt
    description: { type: String, required: true },

    // Sample patient messages with expected classification output
    examples: { type: [ExampleSchema], default: [] },

    // Base weight for relevanceScore computation
    baseWeight: { type: Number, default: 50 },

    // Auto-populated by the batch regex generation job — can be empty (LLM-only)
    regexPatterns: { type: [String], default: [] },

    // Inactive intents are excluded from both regex pass and LLM prompt
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique compound index: prevents duplicate intent keys within the same clinic scope
IntentDefinitionSchema.index({ clinicId: 1, key: 1 }, { unique: true });

// Fast lookup when building the classifier prompt per clinic
IntentDefinitionSchema.index({ clinicId: 1, isActive: 1 });

// Pre-save validation: require at least 2 examples before an intent can be active
IntentDefinitionSchema.pre("validate", function (next) {
  if (this.isActive && (!this.examples || this.examples.length < 2)) {
    return next(
      new Error(
        `IntentDefinition "${this.key}" must have at least 2 examples before it can be set isActive: true`
      )
    );
  }
  next();
});

const IntentDefinition =
  mongoose.models.IntentDefinition ||
  mongoose.model("IntentDefinition", IntentDefinitionSchema);

export default IntentDefinition;
