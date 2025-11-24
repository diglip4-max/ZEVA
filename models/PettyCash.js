// models/PettyCash.js
import mongoose from "mongoose";

// Allocation schema (flat array)
const AllocSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  receipts: [{ type: String }], // array of Cloudinary URLs
  date: { type: Date, default: Date.now },
});

// Expense schema
const ExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  spentAmount: { type: Number, required: true },
  vendor: { type: String, default: null }, // vendor ID reference
  vendorName: { type: String, default: null }, // vendor name for display
  receipts: [{ type: String }], // array of Cloudinary URLs
  date: { type: Date, default: Date.now },
});

const PettyCashSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow null for global tracking record
    },
    // Patient fields - optional for manual petty cash entries
    patientName: { type: String, trim: true },
    patientEmail: { type: String, trim: true },
    patientPhone: { type: String },
    note: { type: String, default: "" },

    // Flat allocated amounts array
    allocatedAmounts: [AllocSchema],

    // Expenses array
    expenses: [ExpenseSchema],

    // Totals (auto-calculated)
    totalAllocated: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }, // remaining
    
    // Global amount tracking
    globalTotalAmount: { type: Number, default: 0 }, // global total amount (all staff combined)
    globalSpentAmount: { type: Number, default: 0 }, // global spent amount (all staff combined)
  },
  { timestamps: true }
);

// Pre-save hook to calculate totals automatically
PettyCashSchema.pre("save", function (next) {
  // Sum allocated amounts
  const totalAllocated = (this.allocatedAmounts || []).reduce(
    (acc, alloc) => acc + (alloc.amount || 0),
    0
  );

  // Sum spent amounts
  const totalSpent = (this.expenses || []).reduce(
    (acc, exp) => acc + (exp.spentAmount || 0),
    0
  );

  this.totalAllocated = totalAllocated;
  this.totalSpent = totalSpent;
  this.totalAmount = totalAllocated - totalSpent;

  next();
});

// Static method to get current global amounts
PettyCashSchema.statics.getGlobalAmounts = async function() {
  try {
    // Get the global tracking record
    const globalRecord = await this.findOne({ staffId: null });
    return {
      globalTotalAmount: globalRecord ? globalRecord.globalTotalAmount : 0,
      globalSpentAmount: globalRecord ? globalRecord.globalSpentAmount : 0,
      globalRemainingAmount: globalRecord ? (globalRecord.globalTotalAmount - globalRecord.globalSpentAmount) : 0
    };
  } catch (error) {
    console.error("Error getting global amounts:", error);
    return {
      globalTotalAmount: 0,
      globalSpentAmount: 0,
      globalRemainingAmount: 0
    };
  }
};

// Static method to update global total amount (when cash is received or petty cash is added)
PettyCashSchema.statics.updateGlobalTotalAmount = async function(amount, operation = 'add') {
  try {
    // Find or create a global tracking record
    let globalRecord = await this.findOne({ staffId: null });
    
    if (!globalRecord) {
      // Create a new global tracking record
      globalRecord = await this.create({
        staffId: null, // Global record
        note: "Global petty cash tracking",
        allocatedAmounts: [],
        expenses: [],
        globalTotalAmount: 0,
        globalSpentAmount: 0
      });
    }

    const currentGlobalTotal = globalRecord.globalTotalAmount || 0;
    const newGlobalTotal = operation === 'add' 
      ? currentGlobalTotal + amount 
      : operation === 'subtract'
      ? Math.max(0, currentGlobalTotal - amount)
      : currentGlobalTotal;

    // Update only the global record
    globalRecord.globalTotalAmount = newGlobalTotal;
    await globalRecord.save();
    
    console.log(`Global Total Amount updated: ${currentGlobalTotal} + ${amount} = ${newGlobalTotal}`);
    return newGlobalTotal;
  } catch (error) {
    console.error("Error updating global total amount:", error);
    return 0;
  }
};

// Static method to update global spent amount (when expenses are added)
PettyCashSchema.statics.updateGlobalSpentAmount = async function(amount, operation = 'add') {
  try {
    // Find or create a global tracking record
    let globalRecord = await this.findOne({ staffId: null });
    
    if (!globalRecord) {
      // Create a new global tracking record
      globalRecord = await this.create({
        staffId: null, // Global record
        note: "Global petty cash tracking",
        allocatedAmounts: [],
        expenses: [],
        globalTotalAmount: 0,
        globalSpentAmount: 0
      });
    }

    const currentGlobalSpent = globalRecord.globalSpentAmount || 0;
    const newGlobalSpent = operation === 'add' 
      ? currentGlobalSpent + amount 
      : operation === 'subtract'
      ? Math.max(0, currentGlobalSpent - amount)
      : currentGlobalSpent;

    // Update only the global record
    globalRecord.globalSpentAmount = newGlobalSpent;
    await globalRecord.save();
    
    console.log(`Global Spent Amount updated: ${currentGlobalSpent} + ${amount} = ${newGlobalSpent}`);
    return newGlobalSpent;
  } catch (error) {
    console.error("Error updating global spent amount:", error);
    return 0;
  }
};

// Static method to recalculate global amounts from all records
PettyCashSchema.statics.recalculateGlobalAmounts = async function() {
  try {
    // Get all staff records (excluding global record) and calculate totals
    const pipeline = [
      {
        $match: { staffId: { $ne: null } }
      },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$totalAllocated" },
          totalSpent: { $sum: "$totalSpent" }
        }
      }
    ];
    
    const result = await this.aggregate(pipeline);
    const totals = result[0] || { totalAllocated: 0, totalSpent: 0 };
    
    // Find or create global tracking record
    let globalRecord = await this.findOne({ staffId: null });
    
    if (!globalRecord) {
      globalRecord = await this.create({
        staffId: null,
        note: "Global petty cash tracking",
        allocatedAmounts: [],
        expenses: [],
        globalTotalAmount: totals.totalAllocated,
        globalSpentAmount: totals.totalSpent
      });
    } else {
      globalRecord.globalTotalAmount = totals.totalAllocated;
      globalRecord.globalSpentAmount = totals.totalSpent;
      await globalRecord.save();
    }
    
    return {
      globalTotalAmount: totals.totalAllocated,
      globalSpentAmount: totals.totalSpent,
      globalRemainingAmount: totals.totalAllocated - totals.totalSpent
    };
  } catch (error) {
    console.error("Error recalculating global amounts:", error);
    return {
      globalTotalAmount: 0,
      globalSpentAmount: 0,
      globalRemainingAmount: 0
    };
  }
};

// Note: Global amounts are updated manually in APIs to avoid double counting
// Post-save hooks removed to prevent automatic recalculation

// Avoid recompilation errors in Next.js
delete mongoose.models.PettyCash;
export default mongoose.models.PettyCash ||
  mongoose.model("PettyCash", PettyCashSchema);
