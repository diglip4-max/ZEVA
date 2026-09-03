/**
 * Verify the bug fix: Run the EXACT same Billing-based aggregation as
 * the API (lines 1208-1461 of package-performance.js), but with the
 * paid/partially/unpaid conditions forced to BOTH the OLD (buggy) and
 * NEW (fixed) variants, so we can see side-by-side the difference.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/database.js";
import Billing from "../models/Billing.js";

dotenv.config({ path: "../.env" });

const CLINIC_ID = "695611e64beeeb4df4ef0699";
const START = new Date(2026, 3, 1, 0, 0, 0, 0);   // Apr 1, 2026 (per user screenshot)
const END = new Date(2026, 7, 27, 23, 59, 59, 999); // Aug 27, 2026 (per user screenshot)

// ─────────────────────────────────────────────────────────────────
// Build the EXACT pre-final-group pipeline (everything up to line 1407
// in the API). At the end, every record has totalPaid and totalPending
// computed with the same $max/edge-case logic the API uses.
// ─────────────────────────────────────────────────────────────────
function buildUpToSoldByPipeline() {
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
            { $ifNull: ["$paid", 0] },
            { $ifNull: ["$pendingClaimUsed", 0] },
            { $ifNull: ["$advanceUsed", 0] }
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
        month: "$__month",
        year: "$__year"
    }},
  ];
}

// OLD buggy group stage (lines 1415-1445 BEFORE fix)
const oldFinalGroup = {
  $group: {
    _id: { soldBy: "$soldBy", month: "$month", year: "$year" },
    totalPackagesSold: { $sum: 1 },
    paidPackages: { $sum: { $cond: [{ $lte: ["$totalPending", 0] }, 1, 0] } },
    partiallyPaidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPending", 0] }, { $gt: ["$totalPaid", 0] }] }, 1, 0] } },
    unpaidPackages: { $sum: { $cond: [{ $lte: ["$totalPaid", 0] }, 1, 0] } },
  }
};

// NEW fixed group stage (matches the fix applied to lines 1419-1445)
const newFinalGroup = {
  $group: {
    _id: { soldBy: "$soldBy", month: "$month", year: "$year" },
    totalPackagesSold: { $sum: 1 },
    paidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPaid", 0] }, { $lte: ["$totalPending", 0] }] }, 1, 0] } },
    partiallyPaidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] }, 1, 0] } },
    unpaidPackages: { $sum: { $cond: [{ $and: [{ $lte: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] }, 1, 0] } },
  }
};

function summarize(rows, label) {
  let totalSold = 0, totalPaid = 0, totalPartial = 0, totalUnpaid = 0;
  let anomalies = 0;
  for (const r of rows) {
    totalSold += r.totalPackagesSold;
    totalPaid += r.paidPackages;
    totalPartial += r.partiallyPaidPackages;
    totalUnpaid += r.unpaidPackages;
    const sum = r.paidPackages + r.partiallyPaidPackages + r.unpaidPackages;
    if (sum > r.totalPackagesSold) anomalies++;
  }
  console.log(`\n  [${label}]`);
  console.log(`  Total groups: ${rows.length}`);
  console.log(`  Sum of totalPackagesSold across groups: ${totalSold}`);
  console.log(`  Sum of paidPackages:                    ${totalPaid}`);
  console.log(`  Sum of partiallyPaidPackages:           ${totalPartial}`);
  console.log(`  Sum of unpaidPackages:                  ${totalUnpaid}`);
  console.log(`  paid+partially+unpaid:                  ${totalPaid + totalPartial + totalUnpaid}`);
  console.log(`  (paid+partially+unpaid) - sold:         ${(totalPaid + totalPartial + totalUnpaid) - totalSold}  ${(totalPaid + totalPartial + totalUnpaid) > totalSold ? "❌ EXCEEDS SOLD (the bug)" : "✅ ≤ sold (correct)"}`);
  console.log(`  Groups with anomaly (paid+partially+unpaid > sold): ${anomalies}`);
  return { totalSold, totalPaid, totalPartial, totalUnpaid, anomalies };
}

async function main() {
  await dbConnect();
  console.log("=".repeat(80));
  console.log("VERIFICATION: Bug fix at lines 1419-1445 of package-performance.js");
  console.log(`Clinic: ${CLINIC_ID}`);
  console.log(`Date range: ${START.toISOString()} to ${END.toISOString()}`);
  console.log("=".repeat(80));

  // Run pre-final-group pipeline once, then apply both group stages
  const upToSoldBy = buildUpToSoldByPipeline();
  const preGroup = await Billing.aggregate(upToSoldBy);
  console.log(`\nPre-final-group records: ${preGroup.length}`);

  // Show distribution of (totalPaid, totalPending) buckets
  const buckets = { "paid>0,pending<=0": 0, "paid>0,pending>0": 0, "paid<=0,pending>0": 0, "paid=0,pending=0": 0 };
  for (const r of preGroup) {
    const tp = r.totalPaid || 0, pn = r.totalPending || 0;
    if (tp > 0 && pn <= 0) buckets["paid>0,pending<=0"]++;
    else if (tp > 0 && pn > 0) buckets["paid>0,pending>0"]++;
    else if (tp <= 0 && pn > 0) buckets["paid<=0,pending>0"]++;
    else buckets["paid=0,pending=0"]++;
  }
  console.log(`Bucket distribution:`, buckets);
  console.log(`  → Records with paid=0 AND pending=0 (the bug victims): ${buckets["paid=0,pending=0"]}`);

  // Run BOTH the OLD (buggy) and NEW (fixed) final group stages
  const oldResult = await Billing.aggregate([...upToSoldBy, oldFinalGroup]);
  const newResult = await Billing.aggregate([...upToSoldBy, newFinalGroup]);

  const oldSum = summarize(oldResult, "OLD (buggy) conditions");
  const newSum = summarize(newResult, "NEW (fixed) conditions");

  console.log(`\n${"=".repeat(80)}`);
  console.log("COMPARISON");
  console.log("=".repeat(80));
  console.log(`  Old paid=${oldSum.totalPaid} | New paid=${newSum.totalPaid} | Delta=${oldSum.totalPaid - newSum.totalPaid} records removed from paid`);
  console.log(`  Old unpaid=${oldSum.totalUnpaid} | New unpaid=${newSum.totalUnpaid} | Delta=${oldSum.totalUnpaid - newSum.totalUnpaid} records removed from unpaid`);
  console.log(`  Expected: paid and unpaid both should DROP by ${buckets["paid=0,pending=0"]} (the count of paid=0/pending=0 records).`);
  console.log(`  After fix: paid+partially+unpaid should be <= ${oldSum.totalSold} (the total sold)`);
  console.log(`  This means: every group has paid+partially+unpaid == totalPackagesSold (when no $0 records exist)`);
  console.log(`  Or: paid+partially+unpaid == totalPackagesSold - count_of_$0_records_in_group`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
