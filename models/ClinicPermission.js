// models/ClinicPermission.js
import mongoose from 'mongoose';

// ──────────────────────────────────────────────────────────────
// ActionSchema – shared between module-level and submodule-level
// Fixed CRUD booleans stay as real fields for query/index perf.
// ──────────────────────────────────────────────────────────────
const ActionSchema = {
  all: { type: Boolean, default: true },
  create: { type: Boolean, default: true },
  read: { type: Boolean, default: true },
  update: { type: Boolean, default: true },
  delete: { type: Boolean, default: true },
  import: { type: Boolean, default: true },
  export: { type: Boolean, default: true },
};

// ──────────────────────────────────────────────────────────────
// customActionsField – enterprise-scalable extension point for
// per-module and per-submodule custom actions (e.g. "advance",
// "approve"). Placed at the SAME level as `actions` (not inside
// it) to match the frontend data structure.
// Keys MUST be validated against config/actionRegistry.js before writing.
// Mongoose Map caveat: always use .set(key, val) when mutating programmatically.
// ──────────────────────────────────────────────────────────────
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
    moduleKey: { type: String, required: false },
    actions: ActionSchema,
    customActions: customActionsField
  }],
  actions: ActionSchema,
  customActions: customActionsField
});

const ClinicPermissionSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'clinic', 'doctor'],
    required: true,
    default: 'clinic',
    index: true
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
ClinicPermissionSchema.index({ 'permissions.module': 1 });
ClinicPermissionSchema.index({ clinicId: 1, role: 1 }, { unique: true });

if (mongoose.models.ClinicPermission) {
  delete mongoose.models.ClinicPermission;
}

export default mongoose.model('ClinicPermission', ClinicPermissionSchema);
