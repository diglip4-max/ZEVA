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
