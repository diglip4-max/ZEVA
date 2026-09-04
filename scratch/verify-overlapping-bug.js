/**
 * Focused anomaly check: Verify the overlapping-condition bug in
 * sales-staff leaderboard aggregation.
 *
 * Findings (so far):
 *   Stage 6 anomaly example: soldBy="Hannielyn Gatpayat" month=8/2026
 *     sold=80, paid=80, partially=0, unpaid=71
 *     → 80+0+71 = 151 (impossible if mutually exclusive)
 *
 * This script proves the bug: the SAME (soldBy, month, year) record is
 * being counted in BOTH paidPackages AND unpaidPackages.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/database.js";
import Billing from "../models/Billing.js";

dotenv.config({ path: "../.env" });

const CLINIC_ID = "695611e64beeeb4df4ef0699";
const START = new Date(2026, 4, 1, 0, 0, 0, 0);
const END = new Date(2026, 7, 31, 23, 59, 59, 999);

async function main() {
  await dbConnect();

  console.log("=".repeat(78));
  console.log("ANOMALY CHECK: Same record counted in paid AND unpaid?");
  console.log("=".repeat(78));

  // Run the EXACT pipeline from lines 1408-1446 of package-performance.js
  // to see what totalPaid / totalPending look like for Hannielyn Gatpayat's
  // Aug 2026 records.
  const result = await Billing.aggregate([
    { $match: {
        $or: [
          { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Package",
            invoicedDate: { $gte: START, $lte: END } },
          { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Treatment",
            "unpaidPackagesPaid.0": { $exists: true },
            invoicedDate: { $gte: START, $lte: END } }
        ]
    }},
    { $addFields: {
        __packageName: { $cond: { if: { $eq: ["$service","Treatment"] },
            then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] }, else: "$package" } },
        __month: { $month: "$invoicedDate" },
        __year: { $year: "$invoicedDate" },
    }},
    { $lookup: { from: "patientregistrations",
        let: { patientId: "$patientId", packageName: "$__packageName" },
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
        totalPaid: { $max: [
            { $ifNull: ["$__pr.packages.paidAmount", 0] },
            { $ifNull: ["$paid", 0] }
        ]},
        totalPending: { $cond: { if: { $lte: ["$pending", 0] }, then: 0, else: { $subtract: ["$amount", "$paid"] } } },
    }},
    { $match: { soldBy: "Hannielyn Gatpayat", month: 8, year: 2026 } },
    { $group: {
        _id: { patientId: "$patientId", packageName: "$__packageName" },
        totalPaid: { $first: "$totalPaid" },
        totalPending: { $first: "$totalPending" },
        invoiceNumber: { $first: "$invoiceNumber" },
    }},
    { $sort: { totalPending: -1, totalPaid: 1 } },
  ]);

  console.log(`\nRecords for Hannielyn Gatpayat in Aug 2026: ${result.length}`);
  let paidCount = 0, partialCount = 0, unpaidCount = 0, bothCount = 0;
  for (const r of result) {
    const tp = r.totalPending, tpd = r.totalPaid;
    const isPaid = tp <= 0;
    const isPartial = tp > 0 && tpd > 0;
    const isUnpaid = tpd <= 0;
    const flag = (isPaid ? "P" : "-") + (isUnpaid ? "U" : "-") + (isPartial ? "A" : "-");
    if (isPaid) paidCount++;
    if (isUnpaid) unpaidCount++;
    if (isPartial) partialCount++;
    if (isPaid && isUnpaid) bothCount++;
    if (r.totalPaid === 0 && r.totalPending === 0) {
      console.log(`  ⚠ ${r._id.patientId} | ${r._id.packageName?.slice(0,30)} | paid=${tpd} pending=${tp} flags=[${flag}] invoice=${r.invoiceNumber}`);
    }
  }
  console.log(`\npaid=${paidCount} partial=${partialCount} unpaid=${unpaidCount}`);
  console.log(`Records counted in BOTH paid and unpaid: ${bothCount}`);
  console.log(`Sum paid+partial+unpaid = ${paidCount + partialCount + unpaidCount} (but only ${result.length} unique records!)`);
  console.log(`The excess: ${(paidCount + partialCount + unpaidCount) - result.length}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
