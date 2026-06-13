#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * ============================================================
 *  Migration: Backfill existing Billing pending amounts into
 *             the new PatientPendingLedger collection.
 * ============================================================
 *
 * What it does
 * ------------
 *  1. Scans every Billing where pending > 0 AND isAdvanceOnly !== true.
 *  2. For each Billing that does NOT already have a PatientPendingLedger
 *     row (matched by parentBillingId), it creates ONE Open/Partial/Closed
 *     ledger row reflecting the current state:
 *        - originalAmount     = billing.pending
 *        - paidAmount         = billing.pendingUsed (capped at originalAmount)
 *        - remainingAmount    = originalAmount - paidAmount
 *        - status             = Open | Partial | Closed (derived)
 *  3. Refreshes Billing.pendingLedgerCached & pendingLedgerOpenCount
 *     so the cached fields match the freshly-inserted ledger rows.
 *
 * Safety guarantees
 * -----------------
 *  - IDEMPOTENT: re-running the script will skip billings that already
 *    have a ledger row (matched by parentBillingId).
 *  - NON-DESTRUCTIVE: never touches Billing.pending / Billing.pendingUsed
 *    (the existing flow keeps reading those untouched).
 *  - DRY-RUN supported: `--dry-run` flag previews counts without writing.
 *  - BATCHED: ledger inserts use bulk operations in chunks of 500.
 *
 * Usage
 * -----
 *    node scripts/migrate-pending-ledger.js
 *    node scripts/migrate-pending-ledger.js --dry-run
 *    node scripts/migrate-pending-ledger.js --clinic=<clinicId>     (optional scope)
 *    node scripts/migrate-pending-ledger.js --limit=500             (optional cap)
 *
 * Why a separate collection (recap)
 * ---------------------------------
 *  Multi-branch + millions of billings + per-treatment audit trail
 *  cannot live inside the Billing document (16 MB ceiling, hot-path
 *  reads, concurrent writes during FIFO clearance, sharding, partial
 *  refunds). See lib/pendingLedger.js and models/PatientPendingLedger.js.
 */

const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

// Load env from .env or .env.local (Next.js style)
try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
} catch (_) {
  /* ignore */
}
try {
  require("dotenv").config();
} catch (_) {
  /* ignore */
}

/* ------------------------------------------------------------------ */
/* CLI args                                                           */
/* ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const isDryRun = argv.includes("--dry-run");
const clinicFilterArg = argv.find((a) => a.startsWith("--clinic="));
const limitArg = argv.find((a) => a.startsWith("--limit="));
const clinicFilter = clinicFilterArg ? clinicFilterArg.split("=")[1] : null;
const userLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/zeva";

const BATCH_SIZE = 500;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function newLedgerId() {
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const rand = crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `PL-${ymd}-${rand}`;
}

function round2(n) {
  return Number((Number(n) || 0).toFixed(2));
}

function deriveStatus(originalAmount, paidAmount) {
  const remaining = round2(originalAmount - paidAmount);
  if (remaining <= 0) return "Closed";
  if (paidAmount > 0) return "Partial";
  return "Open";
}

function buildLedgerDoc(billing) {
  const originalAmount = round2(billing.pending);
  const paidAmountRaw = round2(billing.pendingUsed || 0);
  // Defensive: paid cannot exceed original
  const paidAmount = Math.min(paidAmountRaw, originalAmount);
  const remainingAmount = round2(originalAmount - paidAmount);
  const status = deriveStatus(originalAmount, paidAmount);

  const now = new Date();
  // Prefer the original invoice date so FIFO ordering reflects real history
  const createdAt = billing.invoicedDate || billing.createdAt || now;

  return {
    ledgerId: newLedgerId(),
    clinicId: billing.clinicId,
    branchId: billing.branchId || null,
    patientId: billing.patientId,
    parentBillingId: billing._id,
    appointmentId: billing.appointmentId || null,
    invoiceNumber: billing.invoiceNumber,
    service: billing.service || "Service",
    treatmentSlug: billing.treatmentSlug || null,
    treatmentName: billing.treatment || null,
    packageId: null,
    packageName: billing.package || null,
    serviceId: null,
    patientPackageId: billing.patientPackageId || null,
    patientPackageSubId: billing.patientPackageSubId || null,
    originalAmount,
    paidAmount,
    remainingAmount,
    currency: billing.currency || "AED",
    status,
    closedAt: status === "Closed" ? createdAt : null,
    clearances: [],
    createdBy: billing.createdBy || null,
    version: 1,
    createdAt,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
async function run() {
  console.log("============================================================");
  console.log(" Pending Ledger Backfill Migration");
  console.log("============================================================");
  console.log(` Mode        : ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  if (clinicFilter) console.log(` Clinic scope: ${clinicFilter}`);
  if (userLimit) console.log(` Limit       : ${userLimit}`);
  console.log(` Mongo URI   : ${MONGODB_URI.replace(/\/\/.*@/, "//<creds>@")}`);
  console.log("------------------------------------------------------------");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const billings = db.collection("billings");
  const ledgers = db.collection("patientpendingledgers");

  // ---- 1. Build query for candidate billings ---------------------
  const billingQuery = {
    pending: { $gt: 0 },
    isAdvanceOnly: { $ne: true },
  };
  if (clinicFilter) {
    try {
      billingQuery.clinicId = new mongoose.Types.ObjectId(clinicFilter);
    } catch (e) {
      console.error("Invalid --clinic ObjectId:", clinicFilter);
      process.exit(1);
    }
  }

  const totalCandidates = await billings.countDocuments(billingQuery);
  console.log(`Candidate billings with pending > 0 : ${totalCandidates}`);

  if (totalCandidates === 0) {
    console.log("Nothing to migrate. Done.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ---- 2. Pre-load already-migrated parentBillingIds -------------
  const existingParentIds = new Set();
  const existingCursor = ledgers
    .find({}, { projection: { parentBillingId: 1, _id: 0 } })
    .batchSize(1000);
  let prefetchCount = 0;
  while (await existingCursor.hasNext()) {
    const r = await existingCursor.next();
    if (r && r.parentBillingId) {
      existingParentIds.add(String(r.parentBillingId));
      prefetchCount += 1;
    }
  }
  console.log(`Already-migrated ledger rows         : ${prefetchCount}`);

  // ---- 3. Iterate billings and build ledger docs -----------------
  const projection = {
    _id: 1,
    clinicId: 1,
    branchId: 1,
    patientId: 1,
    appointmentId: 1,
    invoiceNumber: 1,
    invoicedDate: 1,
    createdAt: 1,
    pending: 1,
    pendingUsed: 1,
    service: 1,
    treatment: 1,
    treatmentSlug: 1,
    package: 1,
    patientPackageId: 1,
    patientPackageSubId: 1,
    currency: 1,
    createdBy: 1,
  };

  let cursor = billings.find(billingQuery, { projection }).sort({ invoicedDate: 1, createdAt: 1 });
  if (userLimit) cursor = cursor.limit(userLimit);

  const cacheUpdates = []; // {billingId, remaining, openCount}
  let scanned = 0;
  let skippedExisting = 0;
  let skippedZero = 0;
  let toInsertBatch = [];
  let totalInserted = 0;
  let totalFailed = 0;

  async function flushBatch() {
    if (toInsertBatch.length === 0) return;
    if (isDryRun) {
      totalInserted += toInsertBatch.length;
      toInsertBatch = [];
      return;
    }
    try {
      const res = await ledgers.insertMany(toInsertBatch, { ordered: false });
      totalInserted += res.insertedCount || toInsertBatch.length;
    } catch (err) {
      // Partial failure: some succeeded, some failed (e.g. unique ledgerId collision)
      const ok =
        err && err.result && typeof err.result.insertedCount === "number"
          ? err.result.insertedCount
          : 0;
      totalInserted += ok;
      totalFailed += toInsertBatch.length - ok;
      console.warn(
        `  ! Batch insert reported ${toInsertBatch.length - ok} failure(s): ${err.message}`,
      );
    }
    toInsertBatch = [];
  }

  while (await cursor.hasNext()) {
    const billing = await cursor.next();
    scanned += 1;

    if (existingParentIds.has(String(billing._id))) {
      skippedExisting += 1;
      continue;
    }

    const original = round2(billing.pending);
    const paid = Math.min(round2(billing.pendingUsed || 0), original);
    if (original <= 0) {
      skippedZero += 1;
      continue;
    }

    const doc = buildLedgerDoc(billing);
    toInsertBatch.push(doc);

    cacheUpdates.push({
      billingId: billing._id,
      remaining: doc.remainingAmount,
      openCount: doc.status === "Open" || doc.status === "Partial" ? 1 : 0,
    });

    if (toInsertBatch.length >= BATCH_SIZE) {
      await flushBatch();
      process.stdout.write(
        `  ... inserted ${totalInserted}/${totalCandidates}\r`,
      );
    }
  }
  await flushBatch();
  console.log(""); // newline after the progress indicator

  // ---- 4. Update Billing cached fields ---------------------------
  let cacheUpdated = 0;
  if (!isDryRun && cacheUpdates.length > 0) {
    console.log(`Updating cached fields on ${cacheUpdates.length} billings...`);
    let bulk = billings.initializeUnorderedBulkOp();
    let pending = 0;
    for (const u of cacheUpdates) {
      bulk
        .find({ _id: u.billingId })
        .updateOne({
          $set: {
            pendingLedgerCached: u.remaining,
            pendingLedgerOpenCount: u.openCount,
          },
        });
      pending += 1;
      if (pending >= BATCH_SIZE) {
        const res = await bulk.execute();
        cacheUpdated += res.modifiedCount || 0;
        bulk = billings.initializeUnorderedBulkOp();
        pending = 0;
      }
    }
    if (pending > 0) {
      const res = await bulk.execute();
      cacheUpdated += res.modifiedCount || 0;
    }
  }

  // ---- 5. Report -------------------------------------------------
  console.log("------------------------------------------------------------");
  console.log(" Migration Report");
  console.log("------------------------------------------------------------");
  console.log(` Mode                  : ${isDryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(` Billings scanned      : ${scanned}`);
  console.log(` Skipped (existing)    : ${skippedExisting}`);
  console.log(` Skipped (zero amount) : ${skippedZero}`);
  console.log(
    ` Ledger rows ${isDryRun ? "would-insert" : "inserted   "}: ${totalInserted}`,
  );
  console.log(` Insert failures       : ${totalFailed}`);
  console.log(` Billing cache updates : ${cacheUpdated}`);
  console.log("------------------------------------------------------------");

  // ---- 6. Spot-check sample --------------------------------------
  if (!isDryRun && totalInserted > 0) {
    const sample = await ledgers
      .find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    console.log("\nSample of inserted ledger rows:");
    for (const s of sample) {
      console.log(
        `  - ${s.ledgerId} | inv=${s.invoiceNumber} | ${s.service} | original=${s.originalAmount} | paid=${s.paidAmount} | remaining=${s.remainingAmount} | status=${s.status}`,
      );
    }
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB. Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("\nMigration FAILED:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
