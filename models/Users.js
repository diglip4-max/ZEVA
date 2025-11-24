// /models/Users.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const EODNoteSchema = new mongoose.Schema({
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String, required: true },
  password: { type: String, required: false },
  role: {
    type: String,
    enum: ['user', 'clinic', 'admin', 'doctor', 'lead', 'agent','staff','doctorStaff'],
    default: 'user',
  },
  gender: { type: String, enum: ['male', 'female', 'other'], default: null },
  dateOfBirth: { type: Date, default: null },
  age: { type: Number, default: null },
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' }, // ✅ tie agent to clinic
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ track who created this agent
  isApproved: { type: Boolean, default: false },
  declined: { type: Boolean, default: false },
  eodNotes: [EODNoteSchema],
}, { timestamps: true });

UserSchema.index({ email: 1, role: 1 }, { unique: true });

UserSchema.pre('save', async function (next) {
  if (
    this.isModified('password') &&
    this.password &&
    !this.password.startsWith('$2b$')
  ) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
delete mongoose.models.User; 

export default mongoose.models.User || mongoose.model('User', UserSchema);
