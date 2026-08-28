/**
 * Simulate the FULL sales-staff leaderboard assembly: both billing pipeline
 * AND PR pipeline, then the merge at lines 1607-1652, then the final
 * grouping at lines 1654-1707. Verify the FINAL paid/partial/unpaid numbers.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/database.js";
import Billing from "../models/Billing.js";
import PatientRegistration from "../models/PatientRegistration.js";

dotenv.config({ path: "../.env" });

const CLINIC_ID = "695611e64beeeb4df4ef0699";
const START = new Date(2026, 3, 1, 0, 0, 0, 0);   // Apr 1, 2026
const END = new Date(2026, 7, 27, 23, 59, 59, 999); // Aug 27, 2026

// Build the Billing-based pipeline (lines 1208-1461 of API)
function buildBillingPipeline() {
  return [
    { $match: { $or: [
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Package",
          invoicedDate: { $gte: START, $lte: END } },
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Treatment",
          "unpaidPackagesPaid.0": { $exists: true },
          invoicedDate: { $gte: START, $lte: END } }
    ]}},
    { $addFields: {
        __packageName: { $cond: { if: { $eq: ["$service","Treatment"] },
            then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] }, else: "$package" } },
        __patientId: "$patientId",
        __month: { $month: "$invoicedDate" },
        __year: { $year: "$invoicedDate" }
    }},
    { $group: {
        _id: { patientId: "$__patientId", packageName: "$__packageName" },
        totalPaidForPackage: { $sum: { $add: [
            { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingClaimUsed", 0] }, { $ifNull: ["$advanceUsed", 0] }
        ]}},
        totalPendingForPackage: { $sum: { $cond: { if: { $eq: ["$service","Package"] }, then: { $ifNull: ["$pending", 0] }, else: 0 } } },
        totalAmountForPackage: { $first: { $cond: { if: { $eq: ["$service","Package"] }, then: { $ifNull: ["$amount", 0] }, else: 0 } } },
        __month: { $first: "$__month" },
        __year: { $first: "$__year" }
    }},
    { $lookup: { from: "patientregistrations",
        let: { patientId: "$_id.patientId", packageName: "$_id.packageName" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$patientId"] } } },
          { $unwind: "$packages" },
          { $match: { $expr: { $eq: ["$packages.packageName", "$$packageName"] } } },
          { $limit: 1 },
          { $project: { "packages.packageSoldBy": 1, "packages.totalPrice": 1, "packages.paidAmount": 1 } }
        ],
        as: "__pr" }},
    { $unwind: { path: "$__pr", preserveNullAndEmptyArrays: true } },
    { $addFields: {
        soldBy: { $ifNull: ["$__pr.packages.packageSoldBy", ""] },
        totalAmount: { $ifNull: [
            { $cond: [ { $ne: ["$totalAmountForPackage", 0] }, "$totalAmountForPackage", "$__pr.packages.totalPrice" ] }, 0
        ]},
        totalPaid: { $max: [
            { $ifNull: ["$__pr.packages.paidAmount", 0] },
            { $ifNull: ["$totalPaidForPackage", 0] }
        ]},
        totalPending: { $cond: {
            if: { $lte: [{ $ifNull: ["$totalPendingForPackage", 0] }, 0] },
            then: 0,
            else: { $subtract: [
                { $ifNull: [
                    { $cond: [ { $ne: ["$totalAmountForPackage", 0] }, "$totalAmountForPackage", "$__pr.packages.totalPrice" ] },
                    0
                ]},
                { $max: [
                    { $ifNull: ["$__pr.packages.paidAmount", 0] },
                    { $ifNull: ["$totalPaidForPackage", 0] }
                ]}
            ]}
        }},
        month: "$__month", year: "$__year"
    }},
    // FIXED final group (lines 1419-1458 with bug fix)
    { $group: {
        _id: { soldBy: "$soldBy", month: "$month", year: "$year" },
        totalPackagesSold: { $sum: 1 },
        totalPaid: { $sum: "$totalPaid" },
        totalPending: { $sum: "$totalPending" },
        totalRevenue: { $sum: "$totalAmount" },
        paidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPaid", 0] }, { $lte: ["$totalPending", 0] }] }, 1, 0] } },
        partiallyPaidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] }, 1, 0] } },
        unpaidPackages: { $sum: { $cond: [{ $and: [{ $lte: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] }, 1, 0] } },
    }}
  ];
}

async function main() {
  await dbConnect();
  console.log("=".repeat(80));
  console.log("FULL PIPELINE TEST: Billing + PR merge simulation");
  console.log(`Clinic: ${CLINIC_ID}`);
  console.log(`Date range: ${START.toISOString()} to ${END.toISOString()}`);
  console.log("=".repeat(80));

  // 1. Run Billing pipeline (with fix)
  const billingResults = await Billing.aggregate(buildBillingPipeline());
  console.log(`\nBilling pipeline groups: ${billingResults.length}`);
  let bSold = 0, bPaid = 0, bPart = 0, bUnpaid = 0;
  for (const r of billingResults) {
    bSold += r.totalPackagesSold; bPaid += r.paidPackages; bPart += r.partiallyPaidPackages; bUnpaid += r.unpaidPackages;
  }
  console.log(`  Billing totals: sold=${bSold}, paid=${bPaid}, partially=${bPart}, unpaid=${bUnpaid}`);
  console.log(`  paid+partially+unpaid = ${bPaid+bPart+bUnpaid} (should ≤ ${bSold})`);

  // 2. Get unique (patientId+packageName) keys from billing (lines 1534-1556)
  const billingKeysAgg = await Billing.aggregate([
    { $match: { $or: [
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Package", invoicedDate: { $gte: START, $lte: END } },
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Treatment", "unpaidPackagesPaid.0": { $exists: true }, invoicedDate: { $gte: START, $lte: END } }
    ]}},
    { $addFields: { __packageName: { $cond: { if: { $eq: ["$service","Treatment"] },
        then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] }, else: "$package" } } } },
    { $group: { _id: { patientId: "$patientId", packageName: "$__packageName" } } }
  ]);
  const billingKeySet = new Set(billingKeysAgg.map(k => `${String(k._id.patientId)}__${String(k._id.packageName)}`));
  console.log(`\nBilling unique keys: ${billingKeySet.size}`);

  // 3. Run PR pipeline (lines 1455-1530) - same as API
  const prResults = await PatientRegistration.aggregate([
    { $match: { clinicId: new mongoose.Types.ObjectId(CLINIC_ID) } },
    { $unwind: "$packages" },
    { $match: { $expr: { $gt: [{ $trim: { input: { $ifNull: ["$packages.packageSoldBy", ""] } } }, ""] } } },
    { $match: { "packages.totalPrice": { $gt: 0 } } },
    { $match: { "packages.assignedDate": { $gte: START, $lte: END } } },
    { $group: {
        _id: { patientId: "$_id", packageName: "$packages.packageName", soldBy: "$packages.packageSoldBy", month: { $month: "$packages.assignedDate" }, year: { $year: "$packages.assignedDate" } },
        totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
        paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } }
    }},
    { $group: {
        _id: { soldBy: "$_id.soldBy", month: "$_id.month", year: "$_id.year" },
        totalPackagesSold: { $sum: 1 },
        totalRevenue: { $sum: "$totalPrice" },
        totalPaid: { $sum: "$paidAmount" },
        totalPending: { $sum: { $subtract: ["$totalPrice", "$paidAmount"] } },
        paidPackages: { $sum: { $cond: [{ $gte: ["$paidAmount", "$totalPrice"] }, 1, 0] } },
        partiallyPaidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$paidAmount", 0] }, { $lt: ["$paidAmount", "$totalPrice"] }] }, 1, 0] } },
        unpaidPackages: { $sum: { $cond: [{ $eq: ["$paidAmount", 0] }, 1, 0] } },
    }}
  ]);
  let pSold = 0, pPaid = 0, pPart = 0, pUnpaid = 0;
  for (const r of prResults) {
    pSold += r.totalPackagesSold; pPaid += r.paidPackages; pPart += r.partiallyPaidPackages; pUnpaid += r.unpaidPackages;
  }
  console.log(`\nPR pipeline groups: ${prResults.length}`);
  console.log(`  PR totals (pre-filter): sold=${pSold}, paid=${pPaid}, partially=${pPart}, unpaid=${pUnpaid}`);

  // 4. Filter PR results to exclude those already in billing (lines 1597-1605)
  // Get unique PR (patientId+packageName) keys
  const prKeysAgg = await PatientRegistration.aggregate([
    { $match: { clinicId: new mongoose.Types.ObjectId(CLINIC_ID) } },
    { $unwind: "$packages" },
    { $match: { $expr: { $gt: [{ $trim: { input: { $ifNull: ["$packages.packageSoldBy", ""] } } }, ""] } } },
    { $match: { "packages.totalPrice": { $gt: 0 } } },
    { $match: { "packages.assignedDate": { $gte: START, $lte: END } } },
    { $group: { _id: { patientId: "$_id", packageName: "$packages.packageName" } } }
  ]);
  const prUniqueFiltered = prKeysAgg.filter(k => !billingKeySet.has(`${String(k._id.patientId)}__${String(k._id.packageName)}`));
  console.log(`\nPR records NOT in billing: ${prUniqueFiltered.length}`);

  // 5. Now simulate the MERGE at lines 1607-1652 (with BUGS that exist in API)
  console.log(`\n${"=".repeat(80)}`);
  console.log("MERGE SIMULATION (matching API code at lines 1607-1652):");
  console.log("=".repeat(80));
  const merged = new Map();
  for (const r of billingResults) {
    const key = `${r._id.soldBy || ""}__${r._id.month}__${r._id.year}`;
    merged.set(key, {
      _id: r._id,
      totalPackagesSold: r.totalPackagesSold,
      totalRevenue: r.totalRevenue,
      totalPaid: r.totalPaid,
      totalPending: r.totalPending,
      paidPackages: r.paidPackages,
      partiallyPaidPackages: r.partiallyPaidPackages,
      unpaidPackages: r.unpaidPackages
    });
  }
  // PR merge - using SAME buggy code as API (uses r.totalPrice/r.paidAmount which are undefined)
  for (const r of prResults) {
    const key = `${r._id.soldBy || ""}__${r._id.month}__${r._id.year}`;
    if (merged.has(key)) {
      const existing = merged.get(key);
      merged.set(key, {
        _id: existing._id,
        totalPackagesSold: existing.totalPackagesSold + r.totalPackagesSold,
        totalRevenue: existing.totalRevenue + r.totalPrice,  // BUG: undefined
        totalPaid: existing.totalPaid + r.paidAmount,        // BUG: undefined
        totalPending: existing.totalPending + (r.totalPrice - r.paidAmount),  // BUG: NaN
        paidPackages: existing.paidPackages + (r.paidAmount >= r.totalPrice ? 1 : 0),  // BUG: 0
        partiallyPaidPackages: existing.partiallyPaidPackages + (r.paidAmount > 0 && r.paidAmount < r.totalPrice ? 1 : 0),  // BUG: 0
        unpaidPackages: existing.unpaidPackages + (r.paidAmount === 0 ? 1 : 0)  // BUG: 0
      });
    } else {
      merged.set(key, {
        _id: r._id,
        totalPackagesSold: 1,    // BUG: should be r.totalPackagesSold
        totalRevenue: r.totalPrice,  // BUG: undefined
        totalPaid: r.paidAmount,    // BUG: undefined
        totalPending: r.totalPrice - r.paidAmount,  // BUG: NaN
        paidPackages: r.paidAmount >= r.totalPrice ? 1 : 0,  // BUG: 0
        partiallyPaidPackages: r.paidAmount > 0 && r.paidAmount < r.totalPrice ? 1 : 0,  // BUG: 0
        unpaidPackages: r.paidAmount === 0 ? 1 : 0  // BUG: 0
      });
    }
  }

  // 6. Final grouping by soldBy (lines 1654-1707)
  const finalMap = new Map();
  for (const r of merged.values()) {
    const key = r._id.soldBy || "";
    if (finalMap.has(key)) {
      const existing = finalMap.get(key);
      existing.totalPackagesSold += r.totalPackagesSold;
      existing.totalRevenue += r.totalRevenue;
      existing.totalPaid += r.totalPaid;
      existing.totalPending += r.totalPending;
      existing.paidPackages += r.paidPackages;
      existing.partiallyPaidPackages += r.partiallyPaidPackages;
      existing.unpaidPackages += r.unpaidPackages;
    } else {
      finalMap.set(key, {
        soldBy: key, ...r
      });
    }
  }

  let fSold = 0, fPaid = 0, fPart = 0, fUnpaid = 0;
  for (const r of finalMap.values()) {
    fSold += r.totalPackagesSold; fPaid += r.paidPackages; fPart += r.partiallyPaidPackages; fUnpaid += r.unpaidPackages;
  }

  console.log(`\n  FINAL merged totals (this is what UI sees):`);
  console.log(`    Sold:      ${fSold}`);
  console.log(`    Paid:      ${fPaid}`);
  console.log(`    Partially: ${fPart}`);
  console.log(`    Unpaid:    ${fUnpaid}`);
  console.log(`    Sum:       ${fPaid + fPart + fUnpaid} (should ≤ ${fSold})`);
  console.log(`    ${(fPaid + fPart + fUnpaid) > fSold ? "❌ PAID+PARTIAL+UNPAID > SOLD (BUG!)" : "✅ OK"}`);

  // 7. Show the merged groups that have anomaly
  console.log(`\n  Anomaly groups (paid+partially+unpaid > sold):`);
  let anomalyCount = 0;
  for (const r of finalMap.values()) {
    const sum = r.paidPackages + r.partiallyPaidPackages + r.unpaidPackages;
    if (sum > r.totalPackagesSold) {
      anomalyCount++;
      console.log(`    ${r.soldBy}: sold=${r.totalPackagesSold}, paid=${r.paidPackages}, partial=${r.partiallyPaidPackages}, unpaid=${r.unpaidPackages}, sum=${sum}`);
    }
  }
  if (anomalyCount === 0) console.log(`    (none)`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
