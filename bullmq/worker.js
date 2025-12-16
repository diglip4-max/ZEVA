import { Worker } from "bullmq";
import Lead from "../models/Lead.js";
import redis from "./redis.js";

import {
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
} from "./checkpoint.js";
import dbConnect from "../lib/database.js";

console.log("📌 All Workers Started...");

const importLeadsFromFileWorker = new Worker(
  "importLeadsFromFileQueue",
  async (job) => {
    console.log(`🚀 Processing Job ID: ${job.id}`);
    const WORKER_NAME = "importLeadsFromFile";

    const { leadsToInsert } = job.data;
    const BATCH_SIZE = 1000;

    await dbConnect();

    // ---- Read last saved checkpoint ----
    let startIndex = await getCheckpoint(WORKER_NAME, job.id);
    console.log(`⏩ Resuming from batch index: ${startIndex}`);

    for (let i = startIndex; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE);

      console.log(`📦 Batch Start: ${i} | Size: ${batch.length}`);

      try {
        await Lead.insertMany(batch, { ordered: false });
        console.log(`✅ Batch inserted: ${batch.length}`);
      } catch (batchError) {
        console.error(
          `⚠ Batch insert error at index ${i}. Falling back to single inserts...`
        );

        for (const lead of batch) {
          try {
            await Lead.create(lead);
          } catch (err) {
            console.error(
              `❌ Single insert failed for ${lead.phone}: ${err.message}`
            );
          }
        }
      }

      // ---- SAVE CHECKPOINT ----
      const nextIndex = i + BATCH_SIZE;
      await saveCheckpoint(WORKER_NAME, job.id, nextIndex);
      console.log(`💾 Checkpoint Saved: ${nextIndex}`);
    }

    // ---- JOB COMPLETED ----
    await clearCheckpoint(WORKER_NAME, job.id);
    console.log(`🎉 Job ${job.id} finished. Checkpoint cleared.`);
  },

  {
    connection: redis,
  }
);

// Worker events
importLeadsFromFileWorker.on("completed", (job) => {
  console.log(`🎉 Job Completed: ${job.id}`);
});

importLeadsFromFileWorker.on("failed", (job, err) => {
  console.error(`❌ Job Failed: ${job?.id}`, err);
});
