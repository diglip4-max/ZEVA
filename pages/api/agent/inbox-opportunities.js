// pages/api/agent/inbox-opportunities.js
// Dashboard API for inbox opportunities and hot leads

import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Opportunity from "../../../models/Opportunity";
import Lead from "../../../models/Lead";
import Message from "../../../models/Message";
import IntentDefinition from "../../../models/IntentDefinition";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/inbox-opportunities?status=new,viewed&limit=10&date=2026-08-18
 *
 * Returns enriched opportunity cards and hot leads for the dashboard.
 * When date is provided, filters opportunities created on that day.
 * When date is omitted, returns all active (non-expired) opportunities.
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       opportunities: [ { id, initials, initialsBg, name, department, ... } ],
 *       hotLeads: [ { id, initials, initialsBg, name, waitTime, ... } ]
 *     }
 *   }
 */

const INTENT_LABELS = {
  price_inquiry: "Pricing Inquiry",
  booking_request: "Booking Request",
  availability_check: "Availability Check",
  treatment_inquiry: "Treatment Inquiry",
  comparison: "Comparison",
  urgency_signal: "Urgent",
};

const INITIALS_BG_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-indigo-500",
];

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getInitialsBg(index) {
  return INITIALS_BG_COLORS[index % INITIALS_BG_COLORS.length];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    const { status = "new,viewed", limit = "20", date } = req.query;
    const statusFilter = status.split(",").map((s) => s.trim());
    const maxResults = Math.min(parseInt(limit) || 20, 50);

    // Build date filter — if a specific date is provided, filter by that day
    let dateMatch = { expiresAt: { $gt: new Date() } };
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      dateMatch = {
        createdAt: { $gte: dayStart, $lte: dayEnd },
      };
    }

    // Build dynamic intent label map from IntentDefinition (global + clinic-scoped)
    const intentDefs = await IntentDefinition.find({
      isActive: true,
      $or: [{ clinicId: null }, { clinicId: new mongoose.Types.ObjectId(clinicId) }],
    })
      .select("key label")
      .lean();

    const intentLabels = { ...INTENT_LABELS };
    for (const def of intentDefs) {
      intentLabels[def.key] = def.label;
    }

    // ─── Fetch Opportunities with Lead + AI Response ──────────────────────
    const opportunities = await Opportunity.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          status: { $in: statusFilter },
          ...dateMatch,
        },
      },
      { $sort: { relevanceScore: -1, createdAt: -1 } },
      { $limit: maxResults },
      {
        $lookup: {
          from: "leads",
          localField: "leadId",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "messages",
          let: { convId: "$conversationId", msgDir: "outgoing" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversationId", "$$convId"] },
                    { $eq: ["$direction", "$$msgDir"] },
                    { $eq: ["$source", "AI"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "aiMessages",
        },
      },
      {
        $project: {
          _id: 1,
          intent: 1,
          leadMessage: 1,
          staffSuggestion: 1,
          relevanceScore: 1,
          status: 1,
          conversationId: 1,
          leadId: 1,
          createdAt: 1,
          leadName: { $ifNull: ["$lead.name", "Unknown"] },
          aiResponse: { $arrayElemAt: ["$aiMessages.content", 0] },
          treatments: { $ifNull: ["$entities.treatments", []] },
        },
      },
    ]);

    // ─── Format Opportunities for Frontend ────────────────────────────────
    const formattedOpportunities = opportunities.map((opp, idx) => ({
      id: opp._id.toString(),
      initials: getInitials(opp.leadName),
      initialsBg: getInitialsBg(idx),
      name: opp.leadName,
      department:
        opp.treatments.length > 0
          ? opp.treatments.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
          : intentLabels[opp.intent] || opp.intent,
      likelyPercent: opp.relevanceScore,
      patientMessage: opp.leadMessage,
      ourResponse: opp.aiResponse || null,
      suggestion: opp.staffSuggestion || "Review and respond",
      intent: opp.intent,
      conversationId: opp.conversationId?.toString(),
      leadId: opp.leadId?.toString(),
      status: opp.status,
      createdAt: opp.createdAt,
    }));

    // ─── Fetch Hot Leads (grouped by lead) ────────────────────────────────
    const hotLeads = await Opportunity.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          status: { $in: ["new", "viewed"] },
          ...dateMatch,
        },
      },
      {
        $group: {
          _id: "$leadId",
          intents: { $push: "$intent" },
          avgScore: { $avg: "$relevanceScore" },
          maxScore: { $max: "$relevanceScore" },
          latestMessage: { $first: "$leadMessage" },
          latestConversationId: { $first: "$conversationId" },
          count: { $sum: 1 },
          treatments: { $first: { $ifNull: ["$entities.treatments", []] } },
        },
      },
      { $sort: { avgScore: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "leads",
          localField: "_id",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          leadName: { $ifNull: ["$lead.name", "Unknown"] },
          avgScore: 1,
          maxScore: 1,
          count: 1,
          intents: 1,
          latestMessage: 1,
          latestConversationId: 1,
          treatments: 1,
        },
      },
    ]);

    // ─── Format Hot Leads for Frontend ────────────────────────────────────
    const formattedHotLeads = hotLeads.map((hl, idx) => {
      const treatmentStr =
        hl.treatments.length > 0
          ? hl.treatments.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
          : intentLabels[hl.intents[0]] || "Inquiry";

      const intentSummary =
        hl.count > 1
          ? `${treatmentStr} · ${hl.count} signals`
          : `${treatmentStr} · Asked about ${hl.intents[0]?.replace(/_/g, " ")}`;

      // Compute wait time based on recency
      const minutesAgo = Math.round(
        (Date.now() - new Date(hl.latestConversationId).getTime()) / 60000
      );
      const waitTime =
        minutesAgo < 60
          ? `${minutesAgo} min wait`
          : null;

      return {
        id: hl._id.toString(),
        initials: getInitials(hl.leadName),
        initialsBg: getInitialsBg(idx),
        name: hl.leadName,
        waitTime,
        waitTimeBg: "bg-amber-50 dark:bg-amber-500/10",
        waitTimeColor: "text-amber-700 dark:text-amber-400",
        details: intentSummary,
        progressPercent: Math.round(hl.avgScore),
        progressBarColor:
          hl.avgScore >= 80
            ? "bg-indigo-600"
            : hl.avgScore >= 60
              ? "bg-sky-500"
              : "bg-purple-500",
        progressTextColor:
          hl.avgScore >= 80
            ? "text-indigo-600 dark:text-indigo-400"
            : hl.avgScore >= 60
              ? "text-sky-600 dark:text-sky-400"
              : "text-purple-600 dark:text-purple-400",
        conversationId: hl.latestConversationId?.toString(),
        leadId: hl._id.toString(),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        opportunities: formattedOpportunities,
        hotLeads: formattedHotLeads,
      },
    });
  } catch (err) {
    console.error("[inbox-opportunities] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
