import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import Clinic from "../../../../models/Clinic";
import Conversation from "../../../../models/Conversation";
import Message from "../../../../models/Message";
import dbConnect from "../../../../lib/database";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Get clinicId based on user role
  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: "Clinic not found for this user",
      });
    }
    clinicId = clinic._id;
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Agent not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.body.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin",
      });
    }
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required",
      });
    }

    // Find the conversation first to get details for response
    let conversation = await Conversation.findOne({
      _id: conversationId,
      clinicId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or you do not have access to it",
      });
    }

    // Start a transaction for atomic operations
    const session = await Conversation.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Delete all messages in this conversation
        await Message.deleteMany(
          { conversationId: conversationId, clinicId },
          { session }
        );

        // 3. Delete the conversation itself
        await Conversation.deleteOne(
          { _id: conversationId, clinicId },
          { session }
        );
      });

      await session.endSession();

      return res.status(200).json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } catch (transactionErr) {
      await session.endSession();
      throw transactionErr;
    }
  } catch (err) {
    console.error("Error deleting conversation:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}
