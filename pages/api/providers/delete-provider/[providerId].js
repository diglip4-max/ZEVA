import mongoose from "mongoose";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import Clinic from "../../../../models/Clinic";
import Provider from "../../../../models/Provider";
import Template from "../../../../models/Template";
import Message from "../../../../models/Message";
import dbConnect from "../../../../lib/database";
import { gmailWatchRenewalQueue } from "../../../../bullmq/queue";

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
    clinicId = req.body.clinicId || req.query.clinicId;
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

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(clinicId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid clinic ID format",
    });
  }

  try {
    const { providerId } = req.query;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "providerId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID format",
      });
    }

    // Start MongoDB Transaction
    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // console.log({ providerId, clinicId });
        // Find the provider within transaction
        const provider = await Provider.findById({
          _id: providerId,
          clinicId,
        }).session(session);

        if (!provider) {
          throw new Error(
            "Provider not found or you don't have permission to delete it",
          );
        }

        // Get counts for response
        const templatesCount = await Template.countDocuments(
          { providerId: provider._id, clinicId },
          { session },
        );

        const messagesCount = await Message.countDocuments(
          { providerId: provider._id, clinicId },
          { session },
        );

        // 1. Delete associated templates
        const templateResult = await Template.deleteMany(
          { providerId: provider._id, clinicId },
          { session },
        );

        // 2. Delete associated messages
        const messageResult = await Message.deleteMany(
          { providerId: provider._id, clinicId },
          { session },
        );

        // 3. Delete Gmail watch job if it exists
        if (
          provider.gmailWatchJobId &&
          provider.gmailWatchJobKey &&
          provider.emailProviderType === "gmail"
        ) {
          // find job
          const repeatableJobs =
            await gmailWatchRenewalQueue.getRepeatableJobs();
          console.log({ repeatableJobs });
          const job = repeatableJobs.find(
            (item) => item.key === provider.gmailWatchJobKey,
          );
          if (job) {
            await gmailWatchRenewalQueue.removeRepeatableByKey(
              provider.gmailWatchJobKey,
            );
            console.log(
              "Gmail watch job deleted successfully for providerId: ",
              providerId,
            );
          }
        }

        // 4. Delete the provider
        const providerResult = await Provider.deleteOne(
          { _id: providerId, clinicId },
          { session },
        );
        console.log({ providerResult });

        if (providerResult.deletedCount === 0) {
          throw new Error("Failed to delete provider");
        }

        // If all successful, commit will happen automatically
        // Return data for response
        return {
          deletedProvider: {
            name: provider.name,
            _id: provider._id,
          },
          cascadeDelete: {
            templates: templatesCount,
            messages: messagesCount,
            deletedTemplates: templateResult.deletedCount,
            deletedMessages: messageResult.deletedCount,
          },
        };
      });

      // Transaction successful - commit automatically
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Provider and all associated data deleted successfully",
        data: {
          deleted: true,
          cascadeDelete: {
            templates: result.cascadeDelete.templates,
            messages: result.cascadeDelete.messages,
          },
        },
      });
    } catch (transactionError) {
      // Transaction failed - abort automatically
      session.endSession();

      if (transactionError.message.includes("Provider not found")) {
        return res.status(404).json({
          success: false,
          message: transactionError.message,
        });
      }

      throw transactionError;
    }
  } catch (err) {
    // console.error("Error in deleting provider:", err);

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
