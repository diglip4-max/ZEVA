import { Worker } from "bullmq";
import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import Segment from "../models/Segment.js";
import redis from "./redis.js";
import {
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
} from "./checkpoint.js";
import dbConnect from "../lib/database.js";

console.log("📌 Import Leads Worker Started...");

const importLeadsFromFileWorker = new Worker(
  "importLeadsFromFileQueue",
  async (job) => {
    console.time(`Job-${job.id}`);
    console.log(`🚀 Processing Job ID: ${job.id}`);

    const WORKER_NAME = "importLeadsFromFile";
    const { leadsToInsert, segmentId } = job.data;
    const BATCH_SIZE = 500;

    try {
      await dbConnect();

      // Validate segmentId if provided
      let segment = null;
      if (segmentId) {
        if (!mongoose.Types.ObjectId.isValid(segmentId)) {
          throw new Error("Invalid segment ID format");
        }
        segment = await Segment.findById(segmentId).select("_id name").lean();
        if (!segment) {
          throw new Error(`Segment ${segmentId} not found`);
        }
        console.log(`🎯 Importing to segment: ${segment.name}`);
      } else {
        console.log(`📥 Importing leads without segment association`);
      }

      let startIndex = await getCheckpoint(WORKER_NAME, job.id);
      if (startIndex >= leadsToInsert.length) {
        startIndex = 0;
      }
      console.log(`⏩ Resuming from index: ${startIndex}`);

      let totalInserted = 0;
      let insertedLeadIds = [];
      const segmentObjectId = segment?._id;

      for (let i = startIndex; i < leadsToInsert.length; i += BATCH_SIZE) {
        const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
        console.log(
          `📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} leads`
        );

        try {
          // Bulk insert leads
          const insertedDocs = await Lead.insertMany(batch, {
            ordered: false,
          });

          totalInserted += insertedDocs.length;

          // Collect lead IDs if segment exists
          if (segmentObjectId) {
            insertedLeadIds.push(...insertedDocs.map((doc) => doc._id));

            // Update segment periodically
            if (insertedLeadIds.length >= 1000) {
              await addLeadsToSegment(segmentObjectId, insertedLeadIds);
              insertedLeadIds = [];
            }
          }
        } catch (batchError) {
          console.warn(
            `⚠ Batch insert error, falling back to single inserts...`
          );

          // Process leads individually
          for (const lead of batch) {
            try {
              const insertedLead = await Lead.create(lead);
              totalInserted++;

              if (segmentObjectId) {
                insertedLeadIds.push(insertedLead._id);
              }
            } catch (err) {
              console.error(
                `❌ Failed: ${lead.phone || lead.email || "unknown"} - ${
                  err.message
                }`
              );
            }
          }
        }

        // Save checkpoint every 5 batches
        const nextIndex = i + BATCH_SIZE;
        if (
          nextIndex % (BATCH_SIZE * 5) === 0 ||
          nextIndex >= leadsToInsert.length
        ) {
          await saveCheckpoint(WORKER_NAME, job.id, nextIndex);
        }

        // Yield to event loop every 3 batches
        if (i % (BATCH_SIZE * 3) === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Final segment update if needed
      if (segmentObjectId && insertedLeadIds.length > 0) {
        await addLeadsToSegment(segmentObjectId, insertedLeadIds);
      }

      // Clear checkpoint
      await clearCheckpoint(WORKER_NAME, job.id);

      console.timeEnd(`Job-${job.id}`);
      console.log(
        `🎉 Job ${job.id} completed. Inserted: ${totalInserted}/${leadsToInsert.length}`
      );

      return {
        totalProcessed: leadsToInsert.length,
        totalInserted,
        segmentId: segment?._id || null,
        segmentName: segment?.name || null,
      };
    } catch (error) {
      console.log("Error in import leads from file worker: ", error?.message);
    }
  },
  {
    connection: redis,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 500,
    },
  }
);

// Helper to add leads to segment
async function addLeadsToSegment(segmentId, leadIds) {
  if (!leadIds.length) return;

  try {
    await Segment.findByIdAndUpdate(segmentId, {
      $addToSet: {
        leads: { $each: leadIds },
      },
    });
    console.log(`✅ Added ${leadIds.length} leads to segment`);
  } catch (error) {
    console.error(`❌ Failed to update segment:`, error.message);
  }
}

// Worker events
importLeadsFromFileWorker.on("completed", (job, returnValue) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  console.log(`📊 ${returnValue?.totalInserted || 0} leads imported`);

  if (returnValue?.segmentId) {
    console.log(`🏷 Added to segment: ${returnValue?.segmentName}`);
  }
});

importLeadsFromFileWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

// ==================== PATIENT IMPORT WORKER ====================
import PatientRegistration from "../models/PatientRegistration.js";
import { generateEmrNumber } from "../lib/generateEmrNumber.js";

console.log("📌 Import Patients Worker Started...");

const importPatientsFromFileWorker = new Worker(
  "importPatientsFromFileQueue",
  async (job) => {
    console.time(`PatientJob-${job.id}`);
    console.log(`🚀 Processing Patient Import Job ID: ${job.id}`);

    const WORKER_NAME = "importPatientsFromFile";
    const { 
      patientsToInsert, 
      userId, 
      computedInvoicedBy,
      dateStr,
      maxInvoiceSeq 
    } = job.data;
    const BATCH_SIZE = 100;

    try {
      await dbConnect();

      let startIndex = await getCheckpoint(WORKER_NAME, job.id);
      if (startIndex >= patientsToInsert.length) {
        startIndex = 0;
      }
      console.log(`⏩ Resuming from index: ${startIndex}`);

      let totalInserted = 0;
      let totalFailed = 0;
      const errors = [];
      let invoiceSequence = maxInvoiceSeq;

      const getNextInvoiceNumber = () => {
        invoiceSequence++;
        return `INV-${dateStr}-${String(invoiceSequence).padStart(3, "0")}`;
      };

      for (let i = startIndex; i < patientsToInsert.length; i += BATCH_SIZE) {
        const batch = patientsToInsert.slice(i, i + BATCH_SIZE);
        console.log(
          `📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} patients`
        );

        for (let j = 0; j < batch.length; j++) {
          const patientData = batch[j];
          const rowIndex = i + j + 2; // +2 because row 1 is header, and arrays are 0-indexed
          
          try {
            // Generate invoice number
            let invoiceNumber = getNextInvoiceNumber();
            // Verify it doesn't exist (safety check)
            let existingInvoice = await PatientRegistration.findOne({ invoiceNumber });
            if (existingInvoice) {
              // If exists, keep incrementing until we find a unique one
              let attempts = 0;
              while (existingInvoice && attempts < 100) {
                invoiceSequence++;
                invoiceNumber = getNextInvoiceNumber();
                existingInvoice = await PatientRegistration.findOne({ invoiceNumber });
                if (!existingInvoice) break;
                attempts++;
              }
              if (attempts >= 100) {
                totalFailed++;
                errors.push(`Row ${rowIndex}: Could not generate unique invoice number`);
                continue;
              }
            }

            // Generate EMR number
            const emrNumber = await generateEmrNumber();

            // Create patient with generated numbers
            const finalPatientData = {
              ...patientData,
              invoiceNumber,
              emrNumber,
              userId: userId,
              invoicedBy: computedInvoicedBy,
            };

            await PatientRegistration.create(finalPatientData);
            totalInserted++;
          } catch (patientError) {
            totalFailed++;
            // Handle validation errors more gracefully
            if (patientError.name === 'ValidationError') {
              const validationErrors = Object.values(patientError.errors).map(e => e.message).join(", ");
              errors.push(`Row ${rowIndex}: Patient validation failed: ${validationErrors}`);
            } else if (patientError.code === 11000) {
              const field = Object.keys(patientError.keyPattern)[0];
              errors.push(`Row ${rowIndex}: ${field} already exists`);
            } else {
              errors.push(`Row ${rowIndex}: Failed to create patient: ${patientError.message || "Unknown error"}`);
            }
          }
        }

        // Save checkpoint every 5 batches
        const nextIndex = i + BATCH_SIZE;
        if (
          nextIndex % (BATCH_SIZE * 5) === 0 ||
          nextIndex >= patientsToInsert.length
        ) {
          await saveCheckpoint(WORKER_NAME, job.id, nextIndex);
        }

        // Yield to event loop every 3 batches
        if (i % (BATCH_SIZE * 3) === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Clear checkpoint
      await clearCheckpoint(WORKER_NAME, job.id);

      console.timeEnd(`PatientJob-${job.id}`);
      console.log(
        `🎉 Patient Import Job ${job.id} completed. Inserted: ${totalInserted}/${patientsToInsert.length}, Failed: ${totalFailed}`
      );

      return {
        totalProcessed: patientsToInsert.length,
        totalInserted,
        totalFailed,
        errors: errors.slice(0, 100), // Limit errors to first 100
      };
    } catch (error) {
      console.error("Error in import patients from file worker: ", error?.message);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 500,
    },
  }
);

// Worker events
importPatientsFromFileWorker.on("completed", (job, returnValue) => {
  console.log(`✅ Patient Import Job ${job.id} completed successfully`);
  console.log(`📊 ${returnValue?.totalInserted || 0} patients imported, ${returnValue?.totalFailed || 0} failed`);
});

importPatientsFromFileWorker.on("failed", (job, err) => {
  console.error(`❌ Patient Import Job ${job?.id} failed:`, err.message);
});