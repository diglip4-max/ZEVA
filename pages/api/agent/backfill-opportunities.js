// pages/api/agent/backfill-opportunities.js
// One-time backfill: classify recent incoming messages and create Opportunities
// Usage: POST /api/agent/backfill-opportunities?days=7

import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Message from "../../../models/Message";
import Opportunity from "../../../models/Opportunity";
import Lead from "../../../models/Lead";
import Conversation from "../../../models/Conversation";
import { getUserFromReq } from "../lead-ms/auth";
import { classifyAndCreateOpportunity } from "../../../lib/intentClassifier";

/**
 * POST /api/agent/backfill-opportunities?days=7
 * 
 * Scans recent incoming messages that don't have Opportunities yet,
 * runs them through the intent classifier, and creates Opportunities.
 * 
 * Safe to run multiple times — skips messages that already have Opportunities.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await dbConnect();

    const clinicId = user.clinicId;
    if (!clinicId) {
      return res.status(400).json({ success: false, message: "No clinic associated" });
    }

    const days = Math.min(parseInt(req.query.days) || 7, 30); // max 30 days back
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find incoming messages that DON'T already have an Opportunity
    const existingOppMessageIds = await Opportunity.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
    }).select("messageId").lean();

    const alreadyClassifiedIds = new Set(
      existingOppMessageIds.map((o) => o.messageId.toString())
    );

    // Find recent incoming messages not yet classified
    const messages = await Message.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      direction: "incoming",
      createdAt: { $gte: sinceDate },
      content: { $exists: true, $ne: "" },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const toClassify = messages.filter(
      (m) => !alreadyClassifiedIds.has(m._id.toString())
    );

    console.log(
      `[Backfill] Found ${toClassify.length} messages to classify (out of ${messages.length} recent incoming)`
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const msg of toClassify) {
      try {
        // Reconstruct minimal objects for classifyAndCreateOpportunity
        const conversation = await Conversation.findById(msg.conversationId).lean();
        const lead = await Lead.findById(msg.leadId).lean();

        if (!conversation || !lead) {
          skipped++;
          continue;
        }

        // Pass the message as a plain object with the fields the classifier needs
        const msgObj = {
          _id: msg._id,
          clinicId: msg.clinicId,
          conversationId: msg.conversationId,
          leadId: msg.leadId,
          direction: msg.direction,
          content: msg.content,
        };

        const opp = await classifyAndCreateOpportunity(msgObj, conversation, lead);
        if (opp) {
          created++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors++;
        console.error(`[Backfill] Error classifying message ${msg._id}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalScanned: messages.length,
        toClassify: toClassify.length,
        created,
        skipped,
        errors,
        days,
      },
    });
  } catch (err) {
    console.error("[backfill-opportunities] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
