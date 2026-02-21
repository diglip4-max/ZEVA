// // cron/cleanupScreenshots.js
// import dbConnect from "../../../lib/database.js"; // Assuming this path is correct based on your existing cron file
// import mongoose from "mongoose";
// import { multiCloudinary } from "../path/to/MultiCloudinaryService.js"; // Adjust the import path to where your MultiCloudinaryService is located (e.g., services/cloudinary.js). Note: If it's TypeScript, ensure it's compiled to JS or your setup supports TS imports.

// // Import your schemas (adjust paths if needed)
// import AgentScreenshotSchema from "../../../models/AgentScreenshot.js";
// import DoctorScreenshotSchema from "../../../models/DoctorScreenshot.js";

// // Safely register models
// const AgentScreenshot = mongoose.models.AgentScreenshot || mongoose.model("AgentScreenshot", AgentScreenshotSchema);
// const DoctorScreenshot = mongoose.models.DoctorScreenshot || mongoose.model("DoctorScreenshot", DoctorScreenshotSchema);

// async function cleanupScreenshots() {
//   try {
//     // ✅ Ensure DB connection
//     await dbConnect();

//     const now = new Date();
//     // Define retention period (e.g., 30 days for screenshots; adjust as needed or use process.env.RETENTION_DAYS)
//     // This is shorter than job cleanup (6 months) since screenshots may accumulate quickly and are less critical long-term.
//     const retentionDays = process.env.SCREENSHOT_RETENTION_DAYS || 30;
//     const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

//     // 1. Find old agent screenshots
//     const oldAgentScreenshots = await AgentScreenshot.find({
//       timestamp: { $lt: cutoff },
//     });

//     let agentDeletedCount = 0;
//     for (const screenshot of oldAgentScreenshots) {
//       // Delete from Cloudinary (screenshot account)
//       const deletedFromCloudinary = await multiCloudinary.deleteImage(
//         screenshot.cloudinaryPublicId,
//         'screenshot'
//       );

//       if (deletedFromCloudinary) {
//         // Delete from DB if Cloudinary deletion succeeds
//         await AgentScreenshot.deleteOne({ _id: screenshot._id });
//         agentDeletedCount++;
//       } else {
//         console.warn(`Failed to delete Cloudinary image for agent screenshot ID: ${screenshot._id}`);
//       }
//     }

//     // 2. Find old doctor screenshots
//     const oldDoctorScreenshots = await DoctorScreenshot.find({
//       timestamp: { $lt: cutoff },
//     });

//     let doctorDeletedCount = 0;
//     for (const screenshot of oldDoctorScreenshots) {
//       // Delete from Cloudinary (screenshot account)
//       const deletedFromCloudinary = await multiCloudinary.deleteImage(
//         screenshot.cloudinaryPublicId,
//         'screenshot'
//       );

//       if (deletedFromCloudinary) {
//         // Delete from DB if Cloudinary deletion succeeds
//         await DoctorScreenshot.deleteOne({ _id: screenshot._id });
//         doctorDeletedCount++;
//       } else {
//         console.warn(`Failed to delete Cloudinary image for doctor screenshot ID: ${screenshot._id}`);
//       }
//     }

//     console.log("🧹 Screenshot cleanup complete:");
//     console.log(`- Agent screenshots deleted: ${agentDeletedCount}`);
//     console.log(`- Doctor screenshots deleted: ${doctorDeletedCount}`);
//   } catch (err) {
//     console.error("❌ Screenshot cleanup failed:", err);
//   }
// }

// // Run immediately on startup
// cleanupScreenshots();

// // Schedule to run every 5 minutes (matching your existing cron pattern; adjust interval if needed, e.g., hourly for less frequency)
// setInterval(cleanupScreenshots, 1 * 60 * 1000);

// cron/index.js   (or cron/scheduler.js — your main cron entry file)

import cron from "node-cron";
import "./cleanupJobs.js";
import { cleanupOldScreenshots } from "./cleanupScreenshots.js";

// ─── NEW: Import the one-time 2-day deletion function ───
import { deleteLastTwoDaysScreenshots } from "../scripts/deleteRecentScreenshots.js";  // adjust path

// Optional: run cleanups on server start
(async () => {
  console.log("Cron module started");
  // await cleanupOldScreenshots();   // optional
})();

// ─── Daily screenshot cleanup (old logic, e.g. >30 days) ───
cron.schedule("0 0 * * *", async () => {
  console.log("🕛 Daily cleanup at midnight");
  await cleanupOldScreenshots();
}, {
  timezone: "Asia/Kolkata"
});

// ─── NEW: Run "delete last 2 days" EVERY DAY at 15:58 IST ───
cron.schedule("06 16 * * *", async () => {
  console.log("🗑️ Running scheduled deletion of last 2 days screenshots at 15:58 IST");
  await deleteLastTwoDaysScreenshots();
}, {
  timezone: "Asia/Kolkata"   // ← very important
});

console.log("Cron jobs scheduled:");
console.log("• Daily full cleanup → 00:00 IST");
console.log("• Delete last 2 days screenshots → 15:56 IST every day");