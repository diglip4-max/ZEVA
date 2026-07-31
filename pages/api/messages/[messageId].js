import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Message from "../../../models/Message";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (!["GET", "PUT", "DELETE"].includes(req.method)) {
    return res
      .status(405)
      .json({ success: false, message: `${req.method} - Method not allowed` });
  }
  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (
      !requireRole(me, [
        "clinic",
        "agent",
        "admin",
        "doctor",
        "doctorStaff",
        "staff",
      ])
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ✅ Resolve clinicId based on role
    let clinic;
    if (me.role === "clinic") {
      clinic = await Clinic.findOne({ owner: me._id });
    } else if (me.role === "agent") {
      if (!me.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Agent not linked to any clinic" });
      }
      clinic = await Clinic.findById(me.clinicId);
    } else if (me.role === "doctor") {
      if (!me.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinic = await Clinic.findById(me.clinicId);
    } else if (me.role === "doctorStaff" || me.role === "staff") {
      if (!me.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Staff not linked to any clinic" });
      }
      clinic = await Clinic.findById(me.clinicId);
    } else if (me.role === "admin") {
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinic = await Clinic.findById(adminClinicId);
      }
    }

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found for this user" });
    }
    // ✅TODO: Check permission for reading leads (only for clinic, agent, doctor, and doctorStaff/staff; admin bypasses)
    if (me.role !== "admin" && clinic._id) {
      // For Get Messages Permissions
    }

    if (req.method === "GET") {
      // For Get Messages Permissions
      try {
        const { messageId } = req.query;

        let message = await Message.findById(messageId)
          .populate("senderId", "name email phone")
          .populate("recipientId", "name email phone")
          .populate("provider", "name label email phone _ct _ac")
          .populate({
            path: "replyToMessageId",
            select: "content mediaType mediaUrl channel direction",
            populate: [
              {
                path: "senderId",
                select: "name email phone",
              },
              {
                path: "recipientId",
                select: "name email phone",
              },
            ],
          })
          .lean(); // 🔥 CRITICAL: Add .lean() to get plain JavaScript objects

        res.status(200).json({
          success: true,
          message: "Found.",
          data: message,
        });
      } catch (error) {
        // console.error("Error fetching messages of conversation:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch message",
        });
      }
    } else if (req.method === "PUT") {
      // For Update Messages Permissions
      try {
        const { messageId } = req.query;
        const { isStarred, isArchived, isTrashed } = req.body;

        const updateData = {};

        if (isStarred !== undefined) {
          updateData.isStarred = isStarred;
        }

        if (isArchived !== undefined) {
          updateData.isArchived = isArchived;
        }

        if (isTrashed !== undefined) {
          updateData.isTrashed = isTrashed;
        }

        // Start Mongoose transaction
        const session = await mongoose.startSession();
        let updatedMessage;

        try {
          await session.withTransaction(async () => {
            updatedMessage = await Message.findByIdAndUpdate(
              messageId,
              updateData,
              { new: true, session },
            );

            await Message.updateMany(
              { replyToMessageId: messageId },
              updateData,
              { session },
            );
          });
        } finally {
          session.endSession();
        }

        res.status(200).json({
          success: true,
          message: "Updated.",
          data: updatedMessage,
        });
      } catch (error) {
        // console.error("Error updating message:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to update message",
        });
      }
    } else if (req.method === "DELETE") {
      // For Delete Messages Permissions
      try {
        const { messageId } = req.query;

        // Start Mongoose transaction
        const session = await mongoose.startSession();

        try {
          await session.withTransaction(async () => {
            await Message.findByIdAndDelete(messageId, { session });
            await Message.deleteMany(
              { replyToMessageId: messageId },
              { session },
            );
          });
        } finally {
          session.endSession();
        }

        res.status(200).json({
          success: true,
          message: "Deleted.",
        });
      } catch (error) {
        // console.error("Error deleting message:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to delete message",
        });
      }
    }
  } catch (error) {
    console.error("Error in message API: ", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}
