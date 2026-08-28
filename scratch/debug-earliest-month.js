/**
 * Debug Script: Find Earliest Active Package Month & Compare Both Datasets
 * 
 * This script:
 * 1. Finds the earliest month from Active Packages (PatientRegistration)
 * 2. Compares both datasets for that exact month
 * 3. Shows detailed breakdown of discrepancies
 * 
 * Usage: node scratch/debug-earliest-month.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Billing from "../models/Billing.js";
import PatientRegistration from "../models/PatientRegistration.js";
import dbConnect from "../lib/database.js";

dotenv.config({ path: "../.env" });

// ─── Configuration ───────────────────────────────────────────────────────
const CLINIC_ID = "695611e64beeeb4df4ef0699"; // Rama Care Polyclinic

// ─── Helper Functions ────────────────────────────────────────────────────

function normalizePackageName(name) {
  return (name || "").toString().trim().toLowerCase();
}

function createKey(patientId, packageName) {
  return `${String(patientId)}__${normalizePackageName(packageName)}`;
}

function getMonthYear(date) {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// ─── Main Debug Logic ────────────────────────────────────────────────────

async function debugEarliestMonth() {
  try {
    await dbConnect();
    console.log("=".repeat(80));
    console.log("FIND EARLIEST ACTIVE PACKAGE MONTH & COMPARE DATASETS");
    console.log("=".repeat(80));
    console.log(`Clinic ID: ${CLINIC_ID}`);
    console.log("=".repeat(80));

    // ── STEP 1: Fetch ALL Active Packages from PatientRegistration ──────
    console.log("\n📦 STEP 1: Fetching ALL Active Packages from PatientRegistration...");
    
    const prPipeline = [
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
        },
      },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.totalPrice": { $gt: 0 },
        },
      },
      {
        $group: {
          _id: {
            patientId: "$_id",
            packageName: "$packages.packageName",
          },
          assignedDate: { $min: "$packages.assignedDate" },
          totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
          paymentStatus: { $first: "$packages.paymentStatus" },
          packageSoldBy: { $first: "$packages.packageSoldBy" },
          count: { $sum: 1 },
        },
      },
      { $sort: { assignedDate: 1 } },
    ];

    const allActivePackages = await PatientRegistration.aggregate(prPipeline);
    console.log(`✅ Total Active Packages found: ${allActivePackages.length}`);

    if (allActivePackages.length === 0) {
      console.log("❌ No active packages found!");
      process.exit(0);
    }

    // ── STEP 2: Find Earliest Month ─────────────────────────────────────
    console.log("\n📅 STEP 2: Finding earliest month...");
    
    let earliestDate = null;
    let earliestMonth = null;
    const monthCounts = {};

    allActivePackages.forEach((pkg) => {
      if (pkg.assignedDate) {
        const monthYear = getMonthYear(pkg.assignedDate);
        if (monthYear) {
          monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1;
          
          if (!earliestDate || pkg.assignedDate < earliestDate) {
            earliestDate = pkg.assignedDate;
            earliestMonth = monthYear;
          }
        }
      }
    });

    console.log(`✅ Earliest package date: ${earliestDate?.toISOString()}`);
    console.log(`✅ Earliest month: ${earliestMonth}`);
    console.log(`\n📊 Packages per month:`);
    Object.entries(monthCounts).sort().forEach(([month, count]) => {
      console.log(`   ${month}: ${count} packages`);
    });

    // ─ STEP 3: Get Date Range for Earliest Month ───────────────────────
    const { start: monthStart, end: monthEnd } = getMonthRange(earliestMonth);
    console.log(`\n📅 Date range for ${earliestMonth}:`);
    console.log(`   Start: ${monthStart.toISOString()}`);
    console.log(`   End: ${monthEnd.toISOString()}`);

    // ── STEP 4: Fetch Packages Sold (Billing) for Earliest Month ────────
    console.log(`\n STEP 4: Fetching Packages Sold (Billing) for ${earliestMonth}...`);
    
    const billingPipeline = [
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
          service: "Package",
          invoicedDate: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: {
            patientId: "$patientId",
            package: "$package",
          },
          count: { $sum: 1 },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
          firstInvoiceDate: { $min: "$invoicedDate" },
          lastInvoiceDate: { $max: "$invoicedDate" },
          invoiceNumbers: { $addToSet: "$invoiceNumber" },
        },
      },
    ];

    const billingPackages = await Billing.aggregate(billingPipeline);
    console.log(`✅ Packages Sold in ${earliestMonth}: ${billingPackages.length}`);

    // ── STEP 5: Fetch Active Packages (PatientRegistration) for Earliest Month ─
    console.log(`\n📦 STEP 5: Fetching Active Packages (PatientRegistration) for ${earliestMonth}...`);
    
    const prMonthPipeline = [
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
        },
      },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.totalPrice": { $gt: 0 },
          "packages.assignedDate": { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: {
            patientId: "$_id",
            packageName: "$packages.packageName",
          },
          count: { $sum: 1 },
          totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
          paymentStatus: { $first: "$packages.paymentStatus" },
          assignedDate: { $min: "$packages.assignedDate" },
          packageSoldBy: { $first: "$packages.packageSoldBy" },
        },
      },
    ];

    const prMonthPackages = await PatientRegistration.aggregate(prMonthPipeline);
    console.log(`✅ Active Packages in ${earliestMonth}: ${prMonthPackages.length}`);

    // ── STEP 6: Compare Both Datasets ──────────────────────────────────
    console.log(`\n🔍 STEP 6: Comparing datasets for ${earliestMonth}...`);
    console.log("-".repeat(80));

    const billingMap = new Map();
    billingPackages.forEach((pkg) => {
      const key = createKey(pkg._id.patientId, pkg._id.package);
      billingMap.set(key, {
        patientId: String(pkg._id.patientId),
        packageName: pkg._id.package,
        billingCount: pkg.count,
        totalPaid: pkg.totalPaid,
        totalPending: pkg.totalPending,
        firstInvoiceDate: pkg.firstInvoiceDate,
        lastInvoiceDate: pkg.lastInvoiceDate,
        invoiceNumbers: pkg.invoiceNumbers,
      });
    });

    const prMap = new Map();
    prMonthPackages.forEach((pkg) => {
      const key = createKey(pkg._id.patientId, pkg._id.packageName);
      prMap.set(key, {
        patientId: String(pkg._id.patientId),
        packageName: pkg._id.packageName,
        prCount: pkg.count,
        totalPrice: pkg.totalPrice,
        paidAmount: pkg.paidAmount,
        paymentStatus: pkg.paymentStatus,
        assignedDate: pkg.assignedDate,
        packageSoldBy: pkg.packageSoldBy,
      });
    });

    const allKeys = new Set([...billingMap.keys(), ...prMap.keys()]);
    
    const onlyInBilling = [];
    const onlyInPR = [];
    const inBoth = [];

    allKeys.forEach((key) => {
      const inBilling = billingMap.has(key);
      const inPR = prMap.has(key);

      if (inBilling && !inPR) {
        onlyInBilling.push(billingMap.get(key));
      } else if (!inBilling && inPR) {
        onlyInPR.push(prMap.get(key));
      } else if (inBilling && inPR) {
        inBoth.push({
          key,
          billing: billingMap.get(key),
          pr: prMap.get(key),
        });
      }
    });

    // ── STEP 7: Print Summary ───────────────────────────────────────────
    console.log(`\n📊 STEP 7: Summary for ${earliestMonth}`);
    console.log("-".repeat(80));
    console.log(`Total unique keys: ${allKeys.size}`);
    console.log(`In BOTH datasets: ${inBoth.length}`);
    console.log(`Only in Billing (Packages Sold): ${onlyInBilling.length}`);
    console.log(`Only in PatientRegistration (Active Packages): ${onlyInPR.length}`);
    console.log("");
    console.log(`Billing total (Packages Sold): ${billingPackages.length}`);
    console.log(`PR total (Active Packages): ${prMonthPackages.length}`);
    console.log(`Difference: ${prMonthPackages.length - billingPackages.length}`);

    // ── STEP 8: Print Detailed Breakdown ────────────────────────────────
    console.log(`\n STEP 8: Detailed Breakdown for ${earliestMonth}`);
    console.log("-".repeat(80));

    if (onlyInBilling.length > 0) {
      console.log(`\n💰 Packages ONLY in Billing (${onlyInBilling.length}):`);
      console.log("   Counted in Packages Sold but NOT in Active Packages");
      onlyInBilling.forEach((pkg, idx) => {
        console.log(`   ${idx + 1}. Patient: ${pkg.patientId}`);
        console.log(`      Package: "${pkg.packageName}"`);
        console.log(`      Invoices: ${pkg.invoiceNumbers.join(", ")}`);
        console.log(`      Paid: ${pkg.totalPaid}, Pending: ${pkg.totalPending}`);
      });
    }

    if (onlyInPR.length > 0) {
      console.log(`\n📦 Packages ONLY in PatientRegistration (${onlyInPR.length}):`);
      console.log("   Counted in Active Packages but NOT in Packages Sold");
      onlyInPR.forEach((pkg, idx) => {
        console.log(`   ${idx + 1}. Patient: ${pkg.patientId}`);
        console.log(`      Package: "${pkg.packageName}"`);
        console.log(`      Assigned: ${pkg.assignedDate?.toISOString()}`);
        console.log(`      SoldBy: ${pkg.packageSoldBy}`);
        console.log(`      Total: ${pkg.totalPrice}, Paid: ${pkg.paidAmount}, Status: ${pkg.paymentStatus}`);
      });
    }

    if (inBoth.length > 0) {
      console.log(`\n✅ Packages in BOTH datasets (${inBoth.length}):`);
      console.log("   Sample (first 10):");
      inBoth.slice(0, 10).forEach((item, idx) => {
        console.log(`   ${idx + 1}. Patient: ${item.billing.patientId}`);
        console.log(`      Package: "${item.billing.packageName}"`);
        console.log(`      Billing: Paid=${item.billing.totalPaid}, Pending=${item.billing.totalPending}`);
        console.log(`      PR: Total=${item.pr.totalPrice}, Paid=${item.pr.paidAmount}, Status=${item.pr.paymentStatus}`);
      });
    }

    // ── STEP 9: Root Cause Analysis ─────────────────────────────────────
    console.log(`\n STEP 9: Root Cause Analysis for ${earliestMonth}`);
    console.log("-".repeat(80));
    
    if (onlyInPR.length > onlyInBilling.length) {
      console.log(`🔴 ROOT CAUSE: ${onlyInPR.length} packages in PatientRegistration but NOT in Billing`);
      console.log(`   This explains why Active Packages (${prMonthPackages.length}) > Packages Sold (${billingPackages.length})`);
    } else if (onlyInBilling.length > onlyInPR.length) {
      console.log(`🔴 ROOT CAUSE: ${onlyInBilling.length} packages in Billing but NOT in PatientRegistration`);
      console.log(`   This explains why Packages Sold (${billingPackages.length}) > Active Packages (${prMonthPackages.length})`);
    } else if (onlyInBilling.length === 0 && onlyInPR.length === 0) {
      console.log(`🟢 PERFECT MATCH! Both datasets are aligned for ${earliestMonth}`);
    } else {
      console.log(`🟡 EQUAL MISMATCH: ${onlyInBilling.length} in Billing only, ${onlyInPR.length} in PR only`);
      console.log(`   Total counts match but different packages`);
    }

    // ─ STEP 10: Instructions for User ─────────────────────────────────
    console.log(`\n${"=".repeat(80)}`);
    console.log("📝 INSTRUCTIONS FOR UI TESTING");
    console.log("=".repeat(80));
    console.log(`\n1. Apply this date range in the UI:`);
    console.log(`   Start Date: ${monthStart.toISOString().split('T')[0]}`);
    console.log(`   End Date: ${monthEnd.toISOString().split('T')[0]}`);
    console.log(`\n2. Expected counts:`);
    console.log(`   Packages Sold: ${billingPackages.length}`);
    console.log(`   Active Packages: ${prMonthPackages.length} (but UI shows ALL-TIME = ${allActivePackages.length})`);
    console.log(`\n3. If counts don't match, the discrepancy is:`);
    console.log(`   - ${onlyInBilling.length} packages in Billing only`);
    console.log(`   - ${onlyInPR.length} packages in PatientRegistration only`);
    console.log(`\n${"=".repeat(80)}`);
    console.log("DEBUG COMPLETE");
    console.log("=".repeat(80));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

debugEarliestMonth();
