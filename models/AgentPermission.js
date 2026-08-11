// models/AgentPermission.js
import mongoose from 'mongoose';

// customActionsField – enterprise-scalable extension point for
// per-module and per-submodule custom actions (e.g. "advance", "approve").
// Placed at the SAME level as `actions` to match the frontend data structure.
const customActionsField = {
  type: Map,
  of: Boolean,
  default: {}
};

const ModulePermissionSchema = new mongoose.Schema({
  module: {
    type: String,
    required: true
  },
  subModules: [{
    name: { type: String, required: true },
    path: { type: String, default: '' },
    icon: { type: String, default: '📄' },
    order: { type: Number, default: 0 },
    moduleKey: { type: String }, // Added moduleKey field
    actions: {
      all: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      import: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    customActions: customActionsField
  }],
  actions: {
    all: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    import: { type: Boolean, default: false },
    export: { type: Boolean, default: false }
  },
  customActions: customActionsField
});

const AgentPermissionSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  permissions: [ModulePermissionSchema],
  isActive: { type: Boolean, default: true },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModified: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient queries
AgentPermissionSchema.index({ agentId: 1 });
AgentPermissionSchema.index({ 'permissions.module': 1 });
AgentPermissionSchema.index({ grantedBy: 1 });

export default mongoose.models.AgentPermission || mongoose.model('AgentPermission', AgentPermissionSchema);


