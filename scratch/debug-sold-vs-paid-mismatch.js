/**
 * Debug Script: Diagnose Total Sold vs Paid/Partially/Unpaid Count Mismatch
 *
 * The user reports:
 *   - Total Packages Sold: 169
 *   - Paid Packages: 180
 *   - Partially Paid: 2
 *   - Unpaid Packages: 6
 *   - 180 + 2 + 6 = 188  ≠  169
 *
 * This script traces EXACTLY where the extra 19 records come from by running
 * the same aggregation pipelines the API uses.
 *
 * Usage: node scratch/debug-sold-vs-paid-mismatch.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/database.js";
import Billing from "../models/Billing.js";
import PatientRegistration from "../models/PatientRegistration.js";

dotenv.config({ path: "../.env" });

const CLINIC_ID = "695611e64beeeb4df4ef0699";
const START = new Date(2026, 4, 1, 0, 0, 0, 0);   // May 1, 2026
const END = new Date(2026, 7, 31, 23, 59, 59, 999); // Aug 31, 2026

async function main() {
  await dbConnect();
  console.log("=".repeat(80));
  console.log("SOLD vs PAID/PARTIALLY/UNPAID COUNT MISMATCH DIAGNOSIS");
  console.log("=".repeat(80));
  console.log(`Clinic: ${CLINIC_ID}`);
  console.log(`Date range: ${START.toISOString()} to ${END.toISOString()}`);
  console.log("=".repeat(80));

  // ─────────────────────────────────────────────────────────────────
  // Stage 1: What does packages-sold API compute? (Total Sold = 169)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 1: packages-sold aggregation (source of 'Total Sold' KPI)");
  const packagesSoldPipeline = [
    { $match: {
        clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
        service: "Package",
        invoicedDate: { $gte: START, $lte: END },
    }},
    { $group: { _id: { patientId: "$patientId", package: "$package" } } },
    { $count: "total" },
  ];
  const psResult = await Billing.aggregate(packagesSoldPipeline);
  console.log(`  → Packages Sold (Billing unique patient+package in date range): ${psResult?.[0]?.total ?? 0}`);

  // ─────────────────────────────────────────────────────────────────
  // Stage 2: Sales staff leaderboard Billing pipeline
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 2: salesStaffBillingResults (Billing-based, date-filtered)");
  const salesStaffBillingPipeline = [
    { $match: { $or: [
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Package",
          invoicedDate: { $gte: START, $lte: END } },
        { clinicId: new mongoose.Types.ObjectId(CLINIC_ID), service: "Treatment",
          "unpaidPackagesPaid.0": { $exists: true },
          invoicedDate: { $gte: START, $lte: END } }
    ]}},
    { $addFields: { __packageName: { $cond: { if: { $eq: ["$service","Treatment"] },
        then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] }, else: "$package" } } } },
    { $group: { _id: { patientId: "$patientId", packageName: "$__packageName" } } },
  ];
  const ssBillingKeys = await Billing.aggregate(salesStaffBillingPipeline);
  const ssBillingKeySet = new Set(ssBillingKeys.map(k => `${k._id.patientId}__${k._id.packageName}`));
  console.log(`  → Unique (patientId+packageName) pairs from Billing: ${ssBillingKeys.length}`);

  // ─────────────────────────────────────────────────────────────────
  // Stage 3: PatientRegistration (assignedDate in range, totalPrice > 0)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 3: PatientRegistration packages (assignedDate in range)");
  const prPipeline = [
    { $match: { clinicId: new mongoose.Types.ObjectId(CLINIC_ID) } },
    { $unwind: "$packages" },
    { $match: {
        "packages.totalPrice": { $gt: 0 },
        "packages.assignedDate": { $gte: START, $lte: END },
        $expr: { $gt: [{ $trim: { input: { $ifNull: ["$packages.packageSoldBy", ""] } } }, ""] },
    }},
    { $group: {
        _id: { patientId: "$_id", packageName: "$packages.packageName", soldBy: "$packages.packageSoldBy" },
        totalPrice: { $sum: "$packages.totalPrice" },
        paidAmount: { $sum: "$packages.paidAmount" },
    }},
  ];
  const prResults = await PatientRegistration.aggregate(prPipeline);
  console.log(`  → PR records (soldBy-set, totalPrice>0, in range): ${prResults.length}`);

  // Filter to those NOT in billing (mimics the API merge step)
  const prOnly = prResults.filter(r => {
    const k = `${r._id.patientId}__${r._id.packageName}`;
    return !ssBillingKeySet.has(k);
  });
  console.log(`  → PR records NOT in Billing: ${prOnly.length}`);

  // ─────────────────────────────────────────────────────────────────
  // Stage 4: Build the "merged" sales-staff totals like the API does
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 4: Simulating salesStaffFinalMap merge (source of 'paidPackages' KPI)");

  // Build billing-based per-package result (soldBy, month, year, paid status)
  const billingDetailPipeline = [
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
        totalAmount: { $ifNull: ["$__pr.packages.totalPrice", 0] },
        totalPending: { $cond: { if: { $lte: ["$pending", 0] }, then: 0, else: { $subtract: ["$amount", "$paid"] } } },
    }},
    { $group: {
        _id: { patientId: "$patientId", packageName: "$__packageName", soldBy: "$soldBy", month: "$__month", year: "$__year" },
        totalAmount: { $first: "$totalAmount" },
        totalPaid: { $first: "$totalPaid" },
        totalPending: { $first: "$totalPending" },
    }},
    { $group: {
        _id: { soldBy: "$_id.soldBy", month: "$_id.month", year: "$_id.year" },
        totalPackagesSold: { $sum: 1 },
        totalPaid: { $sum: "$totalPaid" },
        totalPending: { $sum: "$totalPending" },
        totalRevenue: { $sum: "$totalAmount" },
        paidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPaid", 0] }, { $lte: ["$totalPending", 0] }] }, 1, 0] } },
        partiallyPaidPackages: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPending", 0] }, { $gt: ["$totalPaid", 0] }] }, 1, 0] } },
        unpaidPackages: { $sum: { $cond: [{ $and: [{ $lte: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] }, 1, 0] } },
    }},
  ];
  const billingStaffResults = await Billing.aggregate(billingDetailPipeline);
  console.log(`  → Billing staff-results (groups): ${billingStaffResults.length}`);

  let billingTotals = { totalSold: 0, paid: 0, partially: 0, unpaid: 0 };
  for (const r of billingStaffResults) {
    billingTotals.totalSold += r.totalPackagesSold;
    billingTotals.paid += r.paidPackages;
    billingTotals.partially += r.partiallyPaidPackages;
    billingTotals.unpaid += r.unpaidPackages;
  }
  console.log(`  → From Billing only: sold=${billingTotals.totalSold}, paid=${billingTotals.paid}, partially=${billingTotals.partially}, unpaid=${billingTotals.unpaid}`);

  // PR-only staff results
  const prStaffResults = new Map();
  for (const r of prOnly) {
    const d = new Date(START); // Use range start as proxy — assignedDate is in range
    const month = d.getMonth() + 1, year = d.getFullYear();
    const key = `${r._id.soldBy}__${month}__${year}`;
    if (!prStaffResults.has(key)) {
      prStaffResults.set(key, { soldBy: r._id.soldBy, month, year, totalSold: 0, paid: 0, partially: 0, unpaid: 0 });
    }
    const e = prStaffResults.get(key);
    e.totalSold += 1;
    if (r.paidAmount >= r.totalPrice) e.paid += 1;
    else if (r.paidAmount > 0) e.partially += 1;
    else e.unpaid += 1;
  }
  let prTotals = { totalSold: 0, paid: 0, partially: 0, unpaid: 0 };
  for (const e of prStaffResults.values()) {
    prTotals.totalSold += e.totalSold;
    prTotals.paid += e.paid;
    prTotals.partially += e.partially;
    prTotals.unpaid += e.unpaid;
  }
  console.log(`  → From PR-only (not in billing): sold=${prTotals.totalSold}, paid=${prTotals.paid}, partially=${prTotals.partially}, unpaid=${prTotals.unpaid}`);

  // Final merge
  const merged = new Map();
  for (const r of billingStaffResults) {
    const key = `${r._id.soldBy}__${r._id.month}__${r._id.year}`;
    merged.set(key, { ...r });
  }
  for (const e of prStaffResults.values()) {
    const key = `${e.soldBy}__${e.month}__${e.year}`;
    if (merged.has(key)) {
      const x = merged.get(key);
      x.totalPackagesSold += e.totalSold;
      x.paidPackages += e.paid;
      x.partiallyPaidPackages += e.partially;
      x.unpaidPackages += e.unpaid;
    } else {
      merged.set(key, {
        _id: { soldBy: e.soldBy, month: e.month, year: e.year },
        totalPackagesSold: e.totalSold, totalRevenue: 0, totalPaid: 0, totalPending: 0,
        paidPackages: e.paid, partiallyPaidPackages: e.partially, unpaidPackages: e.unpaid,
      });
    }
  }
  let finalTotals = { totalSold: 0, paid: 0, partially: 0, unpaid: 0 };
  for (const x of merged.values()) {
    finalTotals.totalSold += x.totalPackagesSold;
    finalTotals.paid += x.paidPackages;
    finalTotals.partially += x.partiallyPaidPackages;
    finalTotals.unpaid += x.unpaidPackages;
  }
  console.log(`  → MERGED (Billing + PR-only): sold=${finalTotals.totalSold}, paid=${finalTotals.paid}, partially=${finalTotals.partially}, unpaid=${finalTotals.unpaid}`);

  // ─────────────────────────────────────────────────────────────────
  // Stage 5: Per-month breakdown
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 5: Per-month breakdown of merged data");
  const byMonth = new Map();
  for (const x of merged.values()) {
    const m = `${x._id.year}-${String(x._id.month).padStart(2, "0")}`;
    if (!byMonth.has(m)) byMonth.set(m, { sold: 0, paid: 0, partially: 0, unpaid: 0 });
    const b = byMonth.get(m);
    b.sold += x.totalPackagesSold;
    b.paid += x.paidPackages;
    b.partially += x.partiallyPaidPackages;
    b.unpaid += x.unpaidPackages;
  }
  for (const [m, b] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: sold=${b.sold}, paid=${b.paid}, partially=${b.partially}, unpaid=${b.unpaid}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // Stage 6: Anomaly hunt
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 STAGE 6: Anomaly hunt — find rows where paid+partially+unpaid > sold for a single (soldBy, month, year)");
  for (const x of merged.values()) {
    const sum = x.paidPackages + x.partiallyPaidPackages + x.unpaidPackages;
    if (sum > x.totalPackagesSold) {
      console.log(`  ⚠ soldBy="${x._id.soldBy}" month=${x._id.month}/${x._id.year}: sold=${x.totalPackagesSold} but paid+partially+unpaid=${sum} (paid=${x.paidPackages}, partially=${x.partiallyPaidPackages}, unpaid=${x.unpaidPackages})`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`  packages-sold API total           : ${psResult?.[0]?.total ?? 0}  ← "Total Sold" KPI`);
  console.log(`  Sales Staff leaderboard MERGED   : sold=${finalTotals.totalSold}, paid=${finalTotals.paid}, partially=${finalTotals.partially}, unpaid=${finalTotals.unpaid}`);
  console.log(`  Difference                        : ${finalTotals.totalSold - (psResult?.[0]?.total ?? 0)} extra records in leaderboard`);
  console.log(`  paid+partially+unpaid - sold     : ${(finalTotals.paid + finalTotals.partially + finalTotals.unpaid) - finalTotals.totalSold}`);
  console.log("");

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
