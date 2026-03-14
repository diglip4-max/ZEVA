import mongoose from "mongoose";
const { Schema } = mongoose;

const WorkflowHistorySchema = new Schema(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    triggerId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowTrigger",
      required: true,
    },
    actionId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowAction",
      required: true,
    },
    // The document that triggered the workflow (e.g., a Lead or Appointment ID)
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "in-progress",
        "completed",
        "failed",
        "waiting",
        "skipped",
        "canceled",
        "retrying",
      ],
      default: "pending",
    },
    executedAt: {
      type: Date,
    },
    // Store any error messages if the action failed
    error: {
      type: String,
    },
    // Store details about the action that was performed
    details: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

WorkflowHistorySchema.index({ workflowId: 1, status: 1 });
WorkflowHistorySchema.index({ targetId: 1 });

// Hot-reload fix for Next.js
if (mongoose.models.WorkflowHistory) {
  delete mongoose.models.WorkflowHistory;
}

export default mongoose.model("WorkflowHistory", WorkflowHistorySchema);
