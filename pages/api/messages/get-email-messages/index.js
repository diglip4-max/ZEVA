import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import Conversation from "../../../../models/Conversation";
import Lead from "../../../../models/Lead";
import Message from "../../../../models/Message";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
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
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const status = req.query.status || "all"; // Default to "all" if not provided
      const search = req.query.search?.trim()?.toLowerCase() || ""; // Default to empty string if not provided

      let query = {
        clinicId: clinic._id,
        channel: "email",
        replyToMessageId: null,
      }; // Only fetch top-level email messages (not replies)

      if (status === "all") {
        query.isTrashed = { $ne: true };
        query.isArchived = { $ne: true };
      } else if (["incoming", "outgoing"].includes(status)) {
        query.direction = status;
      } else if (["opend", "clicked"].includes(status)) {
        // outgoing emails that lead have opened
        if (status === "opend") {
          query.status = { $ne: "sent" };
        } else {
          query.status = "clicked";
        }
        query.direction = "outgoing";
      } else if (status === "starred") {
        query.isStarred = true;
      } else if (status === "archived") {
        query.isArchived = true;
      } else if (status === "trashed") {
        query.isTrashed = true;
      }

      // 🚀 OPTIMIZED: Handle search and lead filtering in the most efficient way
      if (search) {
        // Search case: Find leads that match search AND belong to this clinic, then get their IDs
        const searchRegex = new RegExp(search, "i");
        const matchingLeadIds = await Lead.find({
          clinicId: clinic._id,
          $or: [{ name: searchRegex }, { email: searchRegex }],
        }).distinct("_id"); // 🚀 Use distinct() for even better performance!

        if (matchingLeadIds.length === 0) {
          return res.status(200).json({
            success: true,
            message: "Messages Found.",
            data: [],
            pagination: {
              totalMessages: 0,
              totalPages: 0,
              currentPage: page,
              limit,
              hasMore: false,
            },
          });
        }

        query.recipientId = { $in: matchingLeadIds };
      }

      // Determine ownerId filter. If role is clinic and ownerId is passed in query, filter by it.
      // If role is not clinic, restrict to me._id.
      let ownerIdFilter = null;
      if (me.role === "clinic") {
        if (req.query.ownerId) {
          ownerIdFilter = req.query.ownerId;
        }
      } else {
        ownerIdFilter = me._id;
      }

      if (ownerIdFilter) {
        const matchingConversations = await Conversation.find({
          clinicId: clinic._id,
          ownerId: ownerIdFilter,
        }).distinct("_id");

        if (matchingConversations.length === 0) {
          return res.status(200).json({
            success: true,
            message: "Messages Found.",
            data: [],
            pagination: {
              totalMessages: 0,
              totalPages: 0,
              currentPage: page,
              limit,
              hasMore: false,
            },
          });
        }
        query.conversationId = { $in: matchingConversations };
      }

      let messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "name email phone")
        .populate("recipientId", "name email phone tags")
        .populate("provider", "name label email phone _ct _ac")
        .populate({
          path: "replyToMessageId",
          select: "content mediaType mediaUrl channel direction",
          populate: [
            { path: "senderId", select: "name email phone" },
            { path: "recipientId", select: "name email phone" },
          ],
        })
        .lean();

      // Group messages by date
      const groupedMessages = {};

      messages.forEach((message) => {
        if (!message.createdAt) return;
        const date = new Date(message.createdAt).toISOString().split("T")[0];
        if (!groupedMessages[date]) groupedMessages[date] = [];
        groupedMessages[date].push(message);
      });

      const formatedData = Object.keys(groupedMessages).map((date) => ({
        date,
        messages: groupedMessages[date],
      }));

      const totalMessages = await Message.countDocuments(query);
      const totalPages = Math.ceil(totalMessages / limit);
      const hasMore = page * limit < totalMessages;

      res.status(200).json({
        success: true,
        message: "Found.",
        data: formatedData,
        pagination: {
          totalMessages,
          totalPages,
          currentPage: page,
          limit,
          hasMore,
        },
      });
    } catch (error) {
      console.error("Error fetching messages of conversation:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch messages of conversation",
      });
    }
  } catch (error) {
    console.error("Get Messages error conversation: ", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}
