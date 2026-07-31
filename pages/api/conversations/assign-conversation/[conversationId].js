import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import Clinic from "../../../../models/Clinic";
import Conversation from "../../../../models/Conversation";
import User from "../../../../models/Users"; // Add User import
import dbConnect from "../../../../lib/database";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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
  } else if (me.role === "agent" || me.role === "doctor") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User not tied to a clinic" });
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
    const { ownerId, ownerIds } = req.body; // Get ownerId (single) or ownerIds (array) from request body

    // Validate inputs
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required",
      });
    }

    // Process ownerIds or ownerId
    let finalOwnerIds = [];
    if (ownerIds && Array.isArray(ownerIds)) {
      finalOwnerIds = ownerIds;
    } else if (ownerId) {
      finalOwnerIds = [ownerId];
    }

    // Validate each ownerId in finalOwnerIds
    for (const id of finalOwnerIds) {
      // Check if the agent/user exists and belongs to the same clinic
      const agent = await User.findOne({
        _id: id,
        clinicId: clinicId,
        role: { $in: ["agent", "doctor", "staff", "doctorStaff"] }, // Only assign to these roles
      });

      if (!agent) {
        return res.status(400).json({
          success: false,
          message: `Agent ${id} not found or does not belong to this clinic`,
        });
      }

      // Check if agent is approved and active
      if (!agent.isApproved || agent.declined) {
        return res.status(400).json({
          success: false,
          message: `Agent ${id} is not approved or has been declined`,
        });
      }
    }

    // Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      clinicId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or you do not have access to it",
      });
    }

    // Check if conversation can be assigned (optional business logic)
    if (
      conversation.status === "trashed" ||
      conversation.status === "blocked"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign conversation with status: ${conversation.status}`,
      });
    }

    // Check if trying to assign to same owners
    const currentOwners = conversation.owners || [];
    const currentOwnersSet = new Set(currentOwners.map((id) => id.toString()));
    const newOwnersSet = new Set(finalOwnerIds.map((id) => id.toString()));
    const areSameOwners =
      currentOwnersSet.size === newOwnersSet.size &&
      [...currentOwnersSet].every((id) => newOwnersSet.has(id));
    if (areSameOwners && finalOwnerIds.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Conversation already assigned to these agents",
        data: {
          conversationId,
          ownerIds: finalOwnerIds,
          changed: false,
        },
      });
    }

    // Get previous owners for notification/logging
    const previousOwnerIds = conversation.owners || [];
    const previousOwnerId = conversation.ownerId;

    // Update conversation with new owners
    const updatedConversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, clinicId },
      {
        $set: {
          ownerId: finalOwnerIds.length > 0 ? finalOwnerIds[0] : null, // Set first owner as ownerId for backward compatibility
          owners: finalOwnerIds,
          updatedAt: new Date(),
          // You might want to update status when assigned
          status: finalOwnerIds.length > 0 ? "open" : conversation.status,
        },
      },
      {
        new: true,
        select: "ownerId owners status updatedAt leadId tags",
        runValidators: true,
      },
    ).populate("owners", "name email role phone"); // Populate owners info

    // Optional: Create an activity log or notification
    // await createConversationActivityLog({
    //   conversationId,
    //   userId: me._id,
    //   action: finalOwnerIds.length > 0 ? "assigned" : "unassigned",
    //   details: {
    //     previousOwnerIds,
    //     newOwnerIds: finalOwnerIds,
    //   },
    // });

    return res.status(200).json({
      success: true,
      message:
        finalOwnerIds.length > 0
          ? "Conversation assigned successfully"
          : "Conversation unassigned successfully",
      data: {
        conversationId,
        ownerIds: updatedConversation.owners,
        previousOwnerIds,
        previousOwnerId,
        changed: true,
        conversation: {
          id: updatedConversation._id,
          status: updatedConversation.status,
          updatedAt: updatedConversation.updatedAt,
          // Include populated owners info if exists
          owners: updatedConversation.owners,
        },
      },
    });
  } catch (err) {
    console.error("Error assigning conversation:", err);

    // Handle validation errors
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors,
      });
    }

    // Handle invalid ObjectId
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}
