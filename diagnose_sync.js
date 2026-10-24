import dotenv from "dotenv";
dotenv.config();

import dbConnect from "./lib/database.js";
import Provider from "./models/Provider.js";
import Message from "./models/Message.js";
import { syncImapEmails } from "./services/emailSync.js";

async function run() {
  try {
    console.log("Connecting to database...");
    await dbConnect();
    
    const provider = await Provider.findOne({ 
      email: "query@ramacarepolyclinic.com",
      emailProviderType: "other",
      isActive: true
    });

    if (!provider) {
      console.log("Provider query@ramacarepolyclinic.com not found.");
      process.exit(0);
    }

    console.log(`Found provider: ${provider.email}. Starting sync...`);
    
    const results = await syncImapEmails([provider._id.toString()]);
    console.log("Sync Results:", JSON.stringify(results, null, 2));

    // Check if the specific email from 3:05 PM (Oct 19) exists in DB
    const latestMsg = await Message.findOne({
      clinicId: provider.clinicId,
      direction: "incoming"
    }).sort({ emailReceivedAt: -1 });

    console.log("Latest Incoming Message in DB:", {
      subject: latestMsg?.subject,
      receivedAt: latestMsg?.emailReceivedAt,
      from: latestMsg?.senderId,
      direction: latestMsg?.direction
    });

    process.exit(0);
  } catch (error) {
    console.error("Diagnostic failed:", error);
    process.exit(1);
  }
}

run();
