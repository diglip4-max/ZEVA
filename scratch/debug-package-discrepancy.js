/**
 * Debug Script: Compare Packages Sold (Billing) vs Active Packages (PatientRegistration)
 * 
 * This script identifies the exact discrepancy between:
 * - Packages Sold: Counted from Billing model (grouped by patientId + package name)
 * - Active Packages: Counted from PatientRegistration model (grouped by patientId + packageName)
 * 
 * Usage: node scratch/debug-package-discrepancy.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Billing from "../models/Billing.js";
import PatientRegistration from "../models/PatientRegistration.js";
import dbConnect from "../lib/database.js";

dotenv.config({ path: "../.env" });

// ─── Configuration ───────────────────────────────────────────────────────
const CLINIC_ID = "695611e64beeeb4df4ef0699"; // Rama Care Polyclinic
const START_DATE = null; // All time
const END_DATE = null; // All time

// ─── Helper Functions ────────────────────────────────────────────────────

function normalizePackageName(name) {
  return (name || "").toString().trim().toLowerCase();
}

function createKey(patientId, packageName) {
  return `${String(patientId)}__${normalizePackageName(packageName)}`;
}

// ─── Main Debug Logic ────────────────────────────────────────────────────

async function debugPackageDiscrepancy() {
  try {
    await dbConnect();
    console.log("=".repeat(80));
    console.log("PACKAGE DISCREPANCY DEBUG SCRIPT");
    console.log("=".repeat(80));
    console.log(`Date Range: ${START_DATE ? START_DATE.toISOString() : 'ALL TIME'} to ${END_DATE ? END_DATE.toISOString() : 'ALL TIME'}`);
    console.log(`Clinic ID: ${CLINIC_ID}`);
    console.log("=".repeat(80));

    // ── STEP 1: Fetch Packages from Billing (Packages Sold) ─────────────
    console.log("\n STEP 1: Fetching Packages from Billing model...");
    
    const billingMatch = {
      clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
      service: "Package",
    };
    if (START_DATE && END_DATE) {
      billingMatch.invoicedDate = { $gte: START_DATE, $lte: END_DATE };
    }

    const billingPipeline = [
      { $match: billingMatch },
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
    console.log(`✅ Billing packages found: ${billingPackages.length}`);

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

    // ── STEP 2: Fetch Packages from PatientRegistration (Active Packages) ─
    console.log("\n STEP 2: Fetching Packages from PatientRegistration model...");
    
    const prDateMatch = {};
    if (START_DATE && END_DATE) {
      prDateMatch["packages.assignedDate"] = { $gte: START_DATE, $lte: END_DATE };
    }

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
          ...prDateMatch,
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

    const prPackages = await PatientRegistration.aggregate(prPipeline);
    console.log(`✅ PatientRegistration packages found: ${prPackages.length}`);

    const prMap = new Map();
    prPackages.forEach((pkg) => {
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

    // ── STEP 3: Compare Both Datasets ───────────────────────────────────
    console.log("\n🔍 STEP 3: Comparing datasets...");
    console.log("-".repeat(80));

    const allKeys = new Set([...billingMap.keys(), ...prMap.keys()]);
    
    const onlyInBilling = [];
    const onlyInPR = [];
    const inBoth = [];
    const nameMismatches = [];

    allKeys.forEach((key) => {
      const inBilling = billingMap.has(key);
      const inPR = prMap.has(key);

      if (inBilling && !inPR) {
        onlyInBilling.push(billingMap.get(key));
      } else if (!inBilling && inPR) {
        onlyInPR.push(prMap.get(key));
      } else if (inBilling && inPR) {
        const billing = billingMap.get(key);
        const pr = prMap.get(key);
        
        // Check for name mismatches
        if (normalizePackageName(billing.packageName) !== normalizePackageName(pr.packageName)) {
          nameMismatches.push({
            key,
            billingName: billing.packageName,
            prName: pr.packageName,
          });
        }

        inBoth.push({
          key,
          billing,
          pr,
        });
      }
    });

    // ── STEP 4: Print Summary ───────────────────────────────────────────
    console.log("\n STEP 4: Summary");
    console.log("-".repeat(80));
    console.log(`Total unique keys: ${allKeys.size}`);
    console.log(`In BOTH datasets: ${inBoth.length}`);
    console.log(`Only in Billing (Packages Sold): ${onlyInBilling.length}`);
    console.log(`Only in PatientRegistration (Active Packages): ${onlyInPR.length}`);
    console.log(`Name mismatches: ${nameMismatches.length}`);
    console.log("");
    console.log(`Billing total (Packages Sold): ${billingPackages.length}`);
    console.log(`PR total (Active Packages): ${prPackages.length}`);
    console.log(`Difference: ${prPackages.length - billingPackages.length}`);

    // ── STEP 5: Print Detailed Breakdown ────────────────────────────────
    console.log("\n📋 STEP 5: Detailed Breakdown");
    console.log("-".repeat(80));

    if (onlyInBilling.length > 0) {
      console.log(`\n Packages ONLY in Billing (${onlyInBilling.length}):`);
      console.log("   These are counted in Packages Sold but NOT in Active Packages");
      onlyInBilling.forEach((pkg, idx) => {
        console.log(`   ${idx + 1}. Patient: ${pkg.patientId} | Package: "${pkg.packageName}" | Invoices: ${pkg.invoiceNumbers.join(", ")}`);
      });
    }

    if (onlyInPR.length > 0) {
      console.log(`\n❌ Packages ONLY in PatientRegistration (${onlyInPR.length}):`);
      console.log("   These are counted in Active Packages but NOT in Packages Sold");
      onlyInPR.forEach((pkg, idx) => {
        console.log(`   ${idx + 1}. Patient: ${pkg.patientId} | Package: "${pkg.packageName}" | Assigned: ${pkg.assignedDate?.toISOString()} | SoldBy: ${pkg.packageSoldBy}`);
      });
    }

    if (nameMismatches.length > 0) {
      console.log(`\n⚠️  Name Mismatches (${nameMismatches.length}):`);
      console.log("   Same patient+package key but different names in Billing vs PR");
      nameMismatches.forEach((mismatch, idx) => {
        console.log(`   ${idx + 1}. Key: ${mismatch.key}`);
        console.log(`      Billing: "${mismatch.billingName}"`);
        console.log(`      PR: "${mismatch.prName}"`);
      });
    }

    if (inBoth.length > 0) {
      console.log(`\n✅ Packages in BOTH datasets (${inBoth.length}):`);
      console.log("   Sample (first 5):");
      inBoth.slice(0, 5).forEach((item, idx) => {
        console.log(`   ${idx + 1}. Patient: ${item.billing.patientId} | Package: "${item.billing.packageName}"`);
        console.log(`      Billing: Paid=${item.billing.totalPaid}, Pending=${item.billing.totalPending}`);
        console.log(`      PR: Total=${item.pr.totalPrice}, Paid=${item.pr.paidAmount}, Status=${item.pr.paymentStatus}`);
      });
    }

    // ── STEP 6: Root Cause Analysis ─────────────────────────────────────
    console.log("\n🎯 STEP 6: Root Cause Analysis");
    console.log("-".repeat(80));
    
    if (onlyInPR.length > onlyInBilling.length) {
      console.log(` ROOT CAUSE: ${onlyInPR.length} packages exist in PatientRegistration but NOT in Billing`);
      console.log(`   This explains why Active Packages (${prPackages.length}) > Packages Sold (${billingPackages.length})`);
      console.log(`   Possible reasons:`);
      console.log(`   - Packages assigned manually without billing`);
      console.log(`   - Packages from before billing system was implemented`);
      console.log(`   - Data migration issues`);
    } else if (onlyInBilling.length > onlyInPR.length) {
      console.log(`🔴 ROOT CAUSE: ${onlyInBilling.length} packages exist in Billing but NOT in PatientRegistration`);
      console.log(`   This explains why Packages Sold (${billingPackages.length}) > Active Packages (${prPackages.length})`);
      console.log(`   Possible reasons:`);
      console.log(`   - Billing created but package not assigned to patient`);
      console.log(`   - Data sync issues between Billing and PatientRegistration`);
    } else if (nameMismatches.length > 0) {
      console.log(`🟡 ROOT CAUSE: ${nameMismatches.length} packages have name mismatches between Billing and PR`);
      console.log(`   This causes the same package to be counted separately in both systems`);
    } else {
      console.log(`🟢 No obvious root cause found. Both datasets are aligned.`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("DEBUG COMPLETE");
    console.log("=".repeat(80));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

debugPackageDiscrepancy();
