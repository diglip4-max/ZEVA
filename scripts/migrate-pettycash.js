#!/usr/bin/env node
/**
 * Migration Script: migrate-pettycash.js
 *
 * Migrates old PettyCash records with embedded arrays (allocatedAmounts, expenses)
 * into the new PettyCashAllocation and PettyCashExpense collections.
 * Converts amount fields to Decimal128 and sets up the rollup totals.
 *
 * Usage:
 *   node scripts/migrate-pettycash.js
 *   node scripts/migrate-pettycash.js --dry-run
 */

const path = require("path");
const mongoose = require("mongoose");

// Load environment variables
try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
} catch (_) { }
try {
  require("dotenv").config();
} catch (_) { }

const argv = process.argv.slice(2);
const isDryRun = argv.includes("--dry-run");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/zeva";

async function run() {
  console.log("============================================================");
  console.log(" Petty Cash Schema Migration & Backfill");
  console.log("============================================================");
  console.log(` Mode: ${isDryRun ? "DRY-RUN (No writes)" : "LIVE (Writes to DB)"}`);
  console.log("------------------------------------------------------------");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const pettyCashCollection = db.collection("pettycashes");
  const allocationCollection = db.collection("pettycashallocations");
  const expenseCollection = db.collection("pettycashexpenses");

  // Get all staff records
  const records = await pettyCashCollection.find({ staffId: { $ne: null } }).toArray();
  console.log(`Found ${records.length} PettyCash documents to process.`);

  let totalAllocationsMigrated = 0;
  let totalExpensesMigrated = 0;

  for (const record of records) {
    console.log(`Processing PettyCash ID: ${record._id} for staff: ${record.staffId}`);

    const oldAllocations = record.allocatedAmounts || [];
    const oldExpenses = record.expenses || [];

    const newAllocations = [];
    const newExpenses = [];

    let totalAllocatedNum = 0;
    let totalSpentNum = 0;

    // 1. Process allocations
    for (const alloc of oldAllocations) {
      const amount = alloc.amount || 0;
      totalAllocatedNum += amount;

      newAllocations.push({
        pettyCashId: record._id,
        clinicId: record.clinicId || null,
        staffId: record.staffId,
        amount: mongoose.Types.Decimal128.fromString(amount.toString()),
        receipts: alloc.receipts || [],
        date: alloc.date || new Date(),
        createdBy: record.createdBy || record.staffId, // Fallback to staffId if not present
        isVoided: false,
        createdAt: alloc.date || record.createdAt || new Date(),
        updatedAt: alloc.date || record.updatedAt || new Date(),
      });
    }

    // 2. Process expenses
    for (const exp of oldExpenses) {
      const spentAmount = exp.spentAmount || 0;
      totalSpentNum += spentAmount;

      const formattedItems = (exp.items || []).map(item => ({
        itemName: item.itemName,
        amount: mongoose.Types.Decimal128.fromString((item.amount || 0).toString())
      }));

      newExpenses.push({
        pettyCashId: record._id,
        clinicId: record.clinicId || null,
        staffId: record.staffId,
        description: exp.description || "Migrated expense",
        spentAmount: mongoose.Types.Decimal128.fromString(spentAmount.toString()),
        vendor: exp.vendor || null,
        vendorName: exp.vendorName || null,
        items: formattedItems,
        receipts: exp.receipts || [],
        usedFromPettyCash: exp.usedFromPettyCash !== undefined ? exp.usedFromPettyCash : true,
        date: exp.date || new Date(),
        createdBy: record.createdBy || record.staffId,
        isVoided: false,
        createdAt: exp.date || record.createdAt || new Date(),
        updatedAt: exp.date || record.updatedAt || new Date(),
      });
    }

    const remainingNum = totalAllocatedNum - totalSpentNum;

    console.log(`  Allocations to migrate: ${newAllocations.length} (Sum: ${totalAllocatedNum})`);
    console.log(`  Expenses to migrate: ${newExpenses.length} (Sum: ${totalSpentNum})`);
    console.log(`  New rollup totals - Allocated: ${totalAllocatedNum}, Spent: ${totalSpentNum}, Remaining: ${remainingNum}`);

    if (!isDryRun) {
      // Insert Allocations
      if (newAllocations.length > 0) {
        await allocationCollection.insertMany(newAllocations);
        totalAllocationsMigrated += newAllocations.length;
      }

      // Insert Expenses
      if (newExpenses.length > 0) {
        await expenseCollection.insertMany(newExpenses);
        totalExpensesMigrated += newExpenses.length;
      }

      // Update parent document rollup totals and drop old arrays
      await pettyCashCollection.updateOne(
        { _id: record._id },
        {
          $set: {
            totalAllocated: mongoose.Types.Decimal128.fromString(totalAllocatedNum.toString()),
            totalSpent: mongoose.Types.Decimal128.fromString(totalSpentNum.toString()),
            totalAmount: mongoose.Types.Decimal128.fromString(remainingNum.toString()),
          },
          $unset: {
            allocatedAmounts: "",
            expenses: ""
          }
        }
      );
    }
  }

  // 3. Recalculate global amounts for all clinics
  if (!isDryRun) {
    console.log("Recalculating global totals for clinics...");
    const clinics = await pettyCashCollection.distinct("clinicId", { clinicId: { $ne: null } });

    for (const clinicId of clinics) {
      // Find all records for this clinic
      const clinicRecords = await pettyCashCollection.find({ clinicId, staffId: { $ne: null } }).toArray();
      let globalTotalNum = 0;
      let globalSpentNum = 0;

      for (const rec of clinicRecords) {
        globalTotalNum += rec.totalAllocated ? parseFloat(rec.totalAllocated.toString()) : 0;
        globalSpentNum += rec.totalSpent ? parseFloat(rec.totalSpent.toString()) : 0;
      }

      await pettyCashCollection.findOneAndUpdate(
        { staffId: null, clinicId },
        {
          $set: {
            globalTotalAmount: mongoose.Types.Decimal128.fromString(globalTotalNum.toString()),
            globalSpentAmount: mongoose.Types.Decimal128.fromString(globalSpentNum.toString()),
          },
          $setOnInsert: { note: "Global petty cash tracking" }
        },
        { upsert: true }
      );
      console.log(`Clinic ${clinicId} Global - Total: ${globalTotalNum}, Spent: ${globalSpentNum}`);
    }
  }

  console.log("------------------------------------------------------------");
  console.log("Migration complete!");
  console.log(`Allocations migrated: ${totalAllocationsMigrated}`);
  console.log(`Expenses migrated: ${totalExpensesMigrated}`);
  console.log("============================================================");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
