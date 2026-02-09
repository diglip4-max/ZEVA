// // models/WorkSession.js
// const mongoose = require('mongoose');

// const StatusHistorySchema = new mongoose.Schema({
//   status: {
//     type: String,
//     enum: ['ONLINE', 'OFFLINE'],
//     required: true
//   },
//   timestamp: {
//     type: Date,
//     default: Date.now
//   }
// });

// const WorkSessionSchema = new mongoose.Schema({
//   agentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Users',
//     required: false,
//     index: true
//   },
//   doctorId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Users',
//     required: false,
//     index: true
//   },
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Users',
//     required: false,
//     index: true
//   },

//   role: {
//     type: String,
//     enum: ['agent', 'doctor', 'doctorStaff'],
//     required: true,
//     index: true
//   },

//   date: {
//     type: Date,
//     required: true,
//     index: true
//   },

//   arrivalTime: {
//     type: Date
//   },

//   leftTime: {
//     type: Date
//   },

//   status: {
//     type: String,
//     enum: ['ONLINE', 'OFFLINE'],
//     default: 'ONLINE'
//   },

//   statusHistory: [StatusHistorySchema],

//   lastActivity: {
//     type: Date,
//     default: Date.now
//   },

//   deskTimeSeconds: {
//     type: Number,
//     default: 0
//   },

//   productiveSeconds: {
//     type: Number,
//     default: 0
//   },

//   productivityPercentage: {
//     type: Number,
//     default: 0
//   },

//   activityLogs: [{
//     timestamp: Date,
//     isActive: Boolean,
//     duration: Number,
//     activityType: String,
//   }],

//   agentScreenshots: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'AgentScreenshot'
//   }],

//   doctorScreenshots: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'DoctorScreenshot'
//   }],

//   createdAt: {
//     type: Date,
//     default: Date.now
//   },

//   updatedAt: {
//     type: Date,
//     default: Date.now
//   },
// });

// // Indexes – for common queries
// WorkSessionSchema.index({ userId: 1, date: 1 });
// WorkSessionSchema.index({ role: 1, date: 1 });
// WorkSessionSchema.index({ doctorId: 1, date: 1 }, { sparse: true });
// WorkSessionSchema.index({ agentId: 1, date: 1 }, { sparse: true });

// WorkSessionSchema.pre('save', function (next) {
//   this.updatedAt = new Date();

//   // Populate userId from agentId or doctorId if not already set
//   if (!this.userId) {
//     if (this.agentId) {
//       this.userId = this.agentId;
//     } else if (this.doctorId) {
//       this.userId = this.doctorId;
//     }
//   }

//   next();
// });

// //calculate productivity
// WorkSessionSchema.methods.calculateProductivity = function () {
//   if (this.deskTimeSeconds > 0) {
//     this.productivityPercentage = Math.round(
//       (this.productiveSeconds / this.deskTimeSeconds) * 100
//     );
//   }
//   return this;
// };

// module.exports = mongoose.models.WorkSession || mongoose.model('WorkSession', WorkSessionSchema);

// models/WorkSession.js
const mongoose = require('mongoose');

const StatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['ONLINE', 'OFFLINE'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const WorkSessionSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: false,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: false,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: false,
    index: true
  },

  role: {
    type: String,
    enum: ['agent', 'doctor', 'doctorStaff'],
    required: true,
    index: true
  },

  date: {
    type: Date,
    required: true,
    index: true
  },

  arrivalTime: {
    type: Date
  },

  leftTime: {
    type: Date
  },

  status: {
    type: String,
    enum: ['ONLINE', 'OFFLINE'],
    default: 'ONLINE'
  },

  statusHistory: [StatusHistorySchema],

  lastActivity: {
    type: Date,
    default: Date.now
  },

  deskTimeSeconds: {
    type: Number,
    default: 0
  },

  productiveSeconds: {
    type: Number,
    default: 0
  },

  productivityPercentage: {
    type: Number,
    default: 0
  },

  activityLogs: [{
    timestamp: Date,
    isActive: Boolean,
    duration: Number,
    activityType: String,
  }],

  agentScreenshots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentScreenshot'
  }],

  doctorScreenshots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorScreenshot'
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },
});

// Indexes – for common queries
WorkSessionSchema.index({ userId: 1, date: 1 });
WorkSessionSchema.index({ role: 1, date: 1 });
WorkSessionSchema.index({ doctorId: 1, date: 1 }, { sparse: true });
WorkSessionSchema.index({ agentId: 1, date: 1 }, { sparse: true });

// Add this compound unique index to prevent duplicate sessions
// for same user+role+date combination
WorkSessionSchema.index({ 
  userId: 1, 
  role: 1, 
  date: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    userId: { $exists: true },
    role: { $exists: true },
    date: { $exists: true }
  }
});



//calculate productivity
WorkSessionSchema.methods.calculateProductivity = function () {
  if (this.deskTimeSeconds > 0) {
    this.productivityPercentage = Math.round(
      (this.productiveSeconds / this.deskTimeSeconds) * 100
    );
  }
  return this;
};

module.exports = mongoose.models.WorkSession || mongoose.model('WorkSession', WorkSessionSchema);