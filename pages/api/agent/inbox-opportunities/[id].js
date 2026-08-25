// pages/api/agent/inbox-opportunities/[id].js
// PATCH endpoint for updating opportunity status

import mongoose from "mongoose";
import dbConnect from "../../../../lib/database";
import Opportunity from "../../../../models/Opportunity";
import { getUserFromReq } from "../../lead-ms/auth";

const VALID_STATUSES = ["new", "viewed", "contacted", "converted", "dismissed"];

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await dbConnect();

    const { id } = req.query;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid opportunity ID" });
    }

    const clinicId = user.clinicId;
    if (!clinicId) {
      return res.status(400).json({ success: false, message: "No clinic associated" });
    }

    const { status, isRead } = req.body;

    // Build update object
    const update = {};
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      update.status = status;
    }
    if (typeof isRead === "boolean") {
      update.isRead = isRead;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    const updated = await Opportunity.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        clinicId: new mongoose.Types.ObjectId(clinicId),
      },
      { $set: update },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: updated._id.toString(),
        status: updated.status,
        isRead: updated.isRead,
      },
    });
  } catch (err) {
    console.error("[inbox-opportunities/:id] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
