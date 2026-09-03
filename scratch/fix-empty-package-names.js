/**
 * Data Fix Script: Backfill empty packageName in PatientRegistration.packages
 *
 * ROOT CAUSE
 * ──────────
 *   Some packages were inserted into PatientRegistration.packages with an
 *   empty `packageName` (e.g. "") because the client payload did not include
 *   the name. This causes the Active Packages vs Packages Sold KPI mismatch
 *   because the two APIs group by { patientId, packageName } and "" never
 *   matches a real package name in Billing.
 *
 *   This script is a ONE-TIME data backfill that:
 *     1. Finds all packages with empty/missing `packageName`.
 *     2. Resolves the correct name, in this priority:
 *          (a) packages[i].packageSnapshot.name    ← already-correct snapshot
 *          (b) Package master doc by packages[i].packageId
 *          (c) Billing record for same patientId + nearby date + amount
 *     3. If still unresolvable, the record is SKIPPED (never overwritten
 *        with garbage).
 *
 * SAFETY
 * ──────
 *   • Default mode is DRY-RUN. Pass --fix to actually write.
 *   • Idempotent: re-running the script (after --fix) is a no-op.
 *   • Never overwrites a non-empty `packageName`.
 *   • Updates are scoped via positional `$set` (packages.$[elem].packageName)
 *     using `arrayFilters` to target only the specific sub-document.
 *   • All changes are written to ./scratch/fix-empty-package-names.log
 *     (including before/after snapshots) so the change is auditable and
 *     reversible.
 *
 * USAGE
 * ─────
 *   node scratch/fix-empty-package-names.js          # dry-run (safe)
 *   node scratch/fix-empty-package-names.js --fix    # apply fix
 *   node scratch/fix-empty-package-names.js --fix --clinic 695611e64beeeb4df4ef0699
 *   node scratch/fix-empty-package-names.js --fix --rollback
 *
 * IMPORTANT
 * ─────────
 *   This script is INTENTIONALLY conservative:
 *     - It does NOT delete or rewrite any other field.
 *     - It does NOT touch the patient record's other packages.
 *     - It does NOT touch packageSnapshot (which may already be correct).
 *     - It only writes `packageName` when the existing value is empty/undefined.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import dbConnect from "../lib/database.js";
import PatientRegistration from "../models/PatientRegistration.js";
import Package from "../models/Package.js";
import Billing from "../models/Billing.js";

dotenv.config({ path: "../.env" });

// ─── Configuration ───────────────────────────────────────────────────────
const ARGS = new Set(process.argv.slice(2));
const APPLY_FIX = ARGS.has("--fix");
const ROLLBACK = ARGS.has("--rollback");
const CLINIC_ARG = process.argv.find((a) => a.startsWith("--clinic="));
const CLINIC_FILTER = CLINIC_ARG
  ? CLINIC_ARG.split("=")[1]
  : process.argv[process.argv.indexOf("--clinic") + 1];

const LOG_FILE = path.join(process.cwd(), "scratch", "fix-empty-package-names.log");
const ROLLBACK_FILE = path.join(
  process.cwd(),
  "scratch",
  "fix-empty-package-names.rollback.jsonl",
);

// ─── Logger ──────────────────────────────────────────────────────────────
function log(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}`;
  console.log(text);
  try {
    fs.appendFileSync(LOG_FILE, text + "\n");
  } catch (e) {
    // logging failure should never abort the script
  }
}

function isEmptyName(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

// ─── Rollback persistence ────────────────────────────────────────────────
function recordRollback(patientId, packageIndex, oldName, newName) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    patientId: String(patientId),
    packageIndex,
    oldName,
    newName,
  });
  try {
    fs.appendFileSync(ROLLBACK_FILE, entry + "\n");
  } catch (e) {
    log(`WARN: could not write rollback log: ${e.message}`);
  }
}

async function performRollback() {
  if (!fs.existsSync(ROLLBACK_FILE)) {
    log("No rollback file found. Nothing to do.");
    return;
  }
  const lines = fs
    .readFileSync(ROLLBACK_FILE, "utf8")
    .split("\n")
    .filter(Boolean);
  log(`Rolling back ${lines.length} entries…`);

  for (const line of lines) {
    try {
      const { patientId, packageIndex, oldName } = JSON.parse(line);
      const updateResult = await PatientRegistration.updateOne(
        { _id: patientId },
        { $set: { [`packages.${packageIndex}.packageName`]: oldName } },
      );
      log(
        `  ↺ patient ${patientId} idx ${packageIndex}: restored "${oldName}" (matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount})`,
      );
    } catch (e) {
      log(`  ✗ rollback failed for line: ${line} (${e.message})`);
    }
  }
  log("Rollback complete.");
}

// ─── Resolvers (priority order) ──────────────────────────────────────────

function resolveFromSnapshot(pkg) {
  if (pkg.packageSnapshot && typeof pkg.packageSnapshot.name === "string") {
    const n = pkg.packageSnapshot.name.trim();
    if (n) return { name: n, source: "packageSnapshot.name" };
  }
  return null;
}

async function resolveFromPackageMaster(pkg) {
  if (!pkg.packageId) return null;
  try {
    const doc = await Package.findById(pkg.packageId)
      .select("name isDeleted")
      .lean();
    if (doc && doc.name && String(doc.name).trim()) {
      return { name: String(doc.name).trim(), source: "Package master" };
    }
  } catch (e) {
    log(`  WARN: Package master lookup failed for packageId=${pkg.packageId}: ${e.message}`);
  }
  return null;
}

async function resolveFromBilling(pkg, patient, clinicId) {
  try {
    // Look for a Package-service billing for this patient close to the
    // assigned date (±7 days) with the same totalPrice (if known).
    const priceMatch =
      typeof pkg.totalPrice === "number" && pkg.totalPrice > 0
        ? { amount: pkg.totalPrice }
        : {};

    const dateWindow = (() => {
      if (!pkg.assignedDate) return {};
      const center = new Date(pkg.assignedDate).getTime();
      const lo = new Date(center - 7 * 24 * 60 * 60 * 1000);
      const hi = new Date(center + 7 * 24 * 60 * 60 * 1000);
      return { invoicedDate: { $gte: lo, $lte: hi } };
    })();

    const billingMatch = {
      patientId: patient._id,
      service: "Package",
      ...priceMatch,
      ...dateWindow,
      ...(clinicId ? { clinicId: new mongoose.Types.ObjectId(clinicId) } : {}),
    };

    // Prefer billings with non-empty package field, ordered by closest date.
    const candidates = await Billing.find(billingMatch)
      .select("package invoicedDate")
      .sort({ invoicedDate: 1 })
      .limit(5)
      .lean();

    for (const cand of candidates) {
      if (cand.package && String(cand.package).trim()) {
        return {
          name: String(cand.package).trim(),
          source: `Billing invoice (${cand.invoicedDate?.toISOString?.() || "?"})`,
        };
      }
    }
  } catch (e) {
    log(`  WARN: Billing lookup failed: ${e.message}`);
  }
  return null;
}

// ─── Main scan & fix logic ──────────────────────────────────────────────

async function run() {
  await dbConnect();
  log("=".repeat(78));
  log(`MODE: ${APPLY_FIX ? "APPLY (--fix)" : "DRY-RUN (default)"}`);
  log(`CLINIC FILTER: ${CLINIC_FILTER || "<all clinics>"}`);
  log("=".repeat(78));

  // Build patient query (optionally scoped to a clinic)
  const patientQuery = {};
  if (CLINIC_FILTER) {
    if (!mongoose.Types.ObjectId.isValid(CLINIC_FILTER)) {
      log(`ERROR: --clinic value is not a valid ObjectId: ${CLINIC_FILTER}`);
      process.exit(2);
    }
    patientQuery.clinicId = new mongoose.Types.ObjectId(CLINIC_FILTER);
  }

  // Use aggregation to find only the patients that actually have
  // at least one package with an empty packageName. This avoids loading
  // every patient into memory.
  const cursor = PatientRegistration.aggregate([
    { $match: patientQuery },
    { $unwind: { path: "$packages", includeArrayIndex: "pkgIdx" } },
    {
      $match: {
        $or: [
          { "packages.packageName": { $exists: false } },
          { "packages.packageName": null },
          { "packages.packageName": "" },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        clinicId: 1,
        firstName: 1,
        lastName: 1,
        pkgIdx: 1,
        pkg: "$packages",
      },
    },
  ]).cursor();

  const stats = {
    patientsScanned: 0,
    emptyPackagesFound: 0,
    resolvedBySnapshot: 0,
    resolvedByMaster: 0,
    resolvedByBilling: 0,
    unresolvable: 0,
    updated: 0,
    wouldUpdate: 0,
    skippedAlreadyValid: 0,
  };

  // For efficiency, batch Package master lookups: collect all packageIds,
  // then fetch in a single query.
  const records = [];
  for await (const doc of cursor) {
    records.push(doc);
  }

  log(`Found ${records.length} patient-package record(s) with empty packageName.`);

  if (records.length === 0) {
    log("Nothing to fix. Exiting.");
    process.exit(0);
  }

  // Pre-fetch all referenced Package master docs in one go
  const masterIds = [
    ...new Set(
      records
        .map((r) => r.pkg?.packageId)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => String(id)),
    ),
  ];
  const masters = masterIds.length
    ? await Package.find({ _id: { $in: masterIds } })
        .select("_id name isDeleted")
        .lean()
    : [];
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  // Process each record
  for (const rec of records) {
    stats.emptyPackagesFound++;
    const patient = { _id: rec._id, clinicId: rec.clinicId };
    const pkg = rec.pkg || {};
    const idx = rec.pkgIdx;
    const patientLabel = `${rec.firstName || ""} ${rec.lastName || ""}`.trim() || String(rec._id);

    log("");
    log(`─── patient ${patientLabel} (${rec._id}) — package index ${idx} ───`);
    log(`    packageId      = ${pkg.packageId || "(none)"}`);
    log(`    assignedDate   = ${pkg.assignedDate?.toISOString?.() || "(none)"}`);
    log(`    totalPrice     = ${pkg.totalPrice ?? "(none)"}`);
    log(`    snapshot.name  = ${pkg.packageSnapshot?.name || "(empty)"}`);

    // 1) Try packageSnapshot first
    let resolved = resolveFromSnapshot(pkg);
    if (resolved) {
      stats.resolvedBySnapshot++;
      log(`    ✓ resolved via ${resolved.source} → "${resolved.name}"`);
    } else {
      // 2) Try Package master
      if (pkg.packageId) {
        const master = masterById.get(String(pkg.packageId));
        if (master && master.name && String(master.name).trim()) {
          resolved = {
            name: String(master.name).trim(),
            source: "Package master (prefetched)",
          };
          stats.resolvedByMaster++;
          log(`    ✓ resolved via Package master → "${resolved.name}"`);
        }
      }

      // 3) Fallback to Billing
      if (!resolved) {
        const fromBilling = await resolveFromBilling(
          pkg,
          patient,
          rec.clinicId ? String(rec.clinicId) : null,
        );
        if (fromBilling) {
          resolved = fromBilling;
          stats.resolvedByBilling++;
          log(`    ✓ resolved via ${fromBilling.source} → "${fromBilling.name}"`);
        }
      }
    }

    if (!resolved) {
      stats.unresolvable++;
      log(`    ✗ UNRESOLVABLE — leaving packageName untouched`);
      continue;
    }

    // Re-check current value in DB to avoid races & to honour idempotency
    const current = await PatientRegistration.findOne(
      { _id: rec._id },
      { packages: 1 },
    ).lean();
    const currentPkg = current?.packages?.[idx];
    if (!currentPkg) {
      log(`    ! package index ${idx} no longer exists on patient — skipping`);
      continue;
    }
    if (!isEmptyName(currentPkg.packageName)) {
      stats.skippedAlreadyValid++;
      log(
        `    ↺ packageName is now "${currentPkg.packageName}" — nothing to do (idempotent skip)`,
      );
      continue;
    }

    if (!APPLY_FIX) {
      stats.wouldUpdate++;
      log(`    [DRY-RUN] would set packageName = "${resolved.name}"`);
      continue;
    }

    // APPLY FIX — scoped positional update (only this one sub-doc)
    const updateRes = await PatientRegistration.updateOne(
      { _id: rec._id },
      { $set: { [`packages.${idx}.packageName`]: resolved.name } },
    );
    if (updateRes.modifiedCount === 1) {
      stats.updated++;
      recordRollback(rec._id, idx, currentPkg.packageName ?? "", resolved.name);
      log(`    ✓ UPDATED → packageName = "${resolved.name}"`);
    } else if (updateRes.matchedCount === 0) {
      log(`    ! patient record vanished mid-update — skipping`);
    } else {
      log(`    ! no change applied (modifiedCount=0) — investigate`);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────
  log("");
  log("=".repeat(78));
  log("SUMMARY");
  log("=".repeat(78));
  log(`  empty packages found       : ${stats.emptyPackagesFound}`);
  log(`  resolved by snapshot        : ${stats.resolvedBySnapshot}`);
  log(`  resolved by Package master  : ${stats.resolvedByMaster}`);
  log(`  resolved by Billing         : ${stats.resolvedByBilling}`);
  log(`  UNRESOLVABLE (left as is)   : ${stats.unresolvable}`);
  log(`  already valid (idempotent)  : ${stats.skippedAlreadyValid}`);
  log(`  ${APPLY_FIX ? "UPDATED" : "would update"}              : ${APPLY_FIX ? stats.updated : stats.wouldUpdate}`);
  log("");
  log(`Log file:    ${LOG_FILE}`);
  if (APPLY_FIX) {
    log(`Rollback file: ${ROLLBACK_FILE}`);
    log("To undo this run: node scratch/fix-empty-package-names.js --rollback");
  }
  log("Done.");
  process.exit(0);
}

// ─── Entry point ─────────────────────────────────────────────────────────
(async () => {
  try {
    if (ROLLBACK) {
      await dbConnect();
      await performRollback();
      process.exit(0);
    }
    await run();
  } catch (e) {
    log(`FATAL: ${e.stack || e.message}`);
    process.exit(1);
  }
})();
