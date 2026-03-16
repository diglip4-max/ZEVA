import mongoose from "mongoose";
const { Schema } = mongoose;

const parameterSchema = new mongoose.Schema({
  providerId: { type: String },
  recipient: { type: String }, // {{contact.owner}}, custom value
  templateId: { type: String },
  channel: {
    type: String,
    enum: ["sms", "whatsapp", "email", "voice"],
  },
  subject: { type: String },
  preheader: { type: String },
  content: { type: String },
  mediaType: { type: String },
  mediaUrl: { type: String },
  whatsappMsgType: {
    type: String,
    enum: [
      "template-message",
      "non-template-message",
      "reply-button-message",
      "list-message",
    ],
  },
  replyButtons: [
    // for whatsapp interactive message
    {
      type: {
        type: String,
        enum: ["reply"],
        required: true,
        default: "reply",
      },
      reply: {
        id: { type: String, required: true },
        title: { type: String, required: true },
      },
      _id: false,
    },
  ],
  listSections: [
    // for whatsapp interactive message
    {
      title: { type: String, required: true },
      rows: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String },
          _id: false, // Prevents auto-adding of _id for rows
        },
      ],
      _id: false, // Prevents auto-adding of _id for sections
    },
  ],

  headerText: {
    type: String,
  },
  footerText: {
    type: String,
  },
  // for send whatsapp action
  bodyParameters: {
    type: [
      {
        type: { type: String },
        text: { type: String },
        _id: false, // ✅ Prevents auto-adding of _id
      },
    ],
    default: [],
  },
  headerParameters: {
    type: [
      {
        type: { type: String },
        text: { type: String },
        _id: false, // ✅ Prevents auto-adding of _id
      },
    ],
    default: [],
  },

  // for email attachments
  attachments: [
    {
      fileName: { type: String },
      fileSize: { type: String },
      mimeType: { type: String },
      mediaUrl: { type: String }, // URL of the uploaded file (e.g., S3)
      mediaType: {
        type: String,
        enum: ["file", "image", "video", "audio"],
        default: "file",
      },
    },
  ],

  // rest_api action parameters
  apiMethod: {
    type: String,
    enum: ["GET", "POST"],
  },
  apiEndPointUrl: {
    type: String,
  },
  apiPayloadType: {
    type: String,
    enum: ["JSON", "FORM_DATA"],
  },
  apiAuthType: {
    type: String,
    enum: ["NO_AUTH", "BEARER_TOKEN"],
  },
  isApiHeaders: {
    type: Boolean,
    default: false,
  },
  isApiParameters: {
    type: Boolean,
    default: false,
  },
  apiHeaders: [
    {
      key: String,
      value: String,
      _id: false, // ✅ Prevents auto-adding of _id
    },
  ],
  apiParameters: [
    {
      key: String,
      value: String,
      _id: false, // ✅ Prevents auto-adding of _id
    },
  ],

  // for delay action
  delayTime: { type: Number, default: 0 },
  delayFormat: {
    type: String,
    enum: ["seconds", "minutes", "hours", "days"],
  },

  // ai_composer action parameters
  aiComposerQuestion: {
    type: String,
  },

  // assign_owner action parameters
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // add_to_segment action parameters
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Segment",
  },
});

const WorkflowActionSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    // e.g., 'send_email', 'send_sms', 'update_lead_status', 'create_task'
    type: {
      type: String,
      required: [true, "Action type is required"],
      enum: [
        "send_email",
        "send_sms",
        "send_whatsapp",
        "update_lead_status",
        "add_tag",
        "assign_owner",
        "rest_api",
        "add_to_segment",
        "ai_composer",
        "delay",
        "router",
      ],
    },
    parameters: parameterSchema,

    // for rest_api action
    apiResponse: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Hot-reload fix for Next.js
if (mongoose.models.WorkflowAction) {
  delete mongoose.models.WorkflowAction;
}

export default mongoose.model("WorkflowAction", WorkflowActionSchema);
