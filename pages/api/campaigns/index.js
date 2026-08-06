// import { getUserFromReq, requireRole } from "../lead-ms/auth";
// import Clinic from "../../../models/Clinic";
// import dbConnect from "../../../lib/database";
// import Campaign from "../../../models/Campaign";
// import Template from "../../../models/Template";
// import Segment from "../../../models/Segment";
// import User from "../../../models/Users";

// export default async function handler(req, res) {
//   await dbConnect();

//   if (req.method !== "GET") {
//     res.setHeader("Allow", ["GET"]);
//     return res.status(405).end(`Method ${req.method} Not Allowed`);
//   }

//   const me = await getUserFromReq(req);
//   if (!me) {
//     return res
//       .status(401)
//       .json({ success: false, message: "Not authenticated" });
//   }

//   if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
//     return res.status(403).json({ success: false, message: "Access denied" });
//   }

//   // Get clinicId based on user role
//   let clinicId;
//   if (me.role === "clinic") {
//     const clinic = await Clinic.findOne({ owner: me._id });
//     if (!clinic) {
//       return res.status(400).json({
//         success: false,
//         message: "Clinic not found for this user",
//       });
//     }
//     clinicId = clinic._id;
//   } else if (me.role === "agent") {
//     if (!me.clinicId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Agent not tied to a clinic" });
//     }
//     clinicId = me.clinicId;
//   } else if (me.role === "doctor" || me.role === "doctorStaff") {
//     if (!me.clinicId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Doctor not tied to a clinic" });
//     }
//     clinicId = me.clinicId;
//   } else if (me.role === "admin") {
//     clinicId = req.query.clinicId;
//     if (!clinicId) {
//       return res.status(400).json({
//         success: false,
//         message: "clinicId is required for admin",
//       });
//     }
//   } else {
//     return res.status(403).json({
//       success: false,
//       message: "Access denied",
//     });
//   }

//   try {
//     // Parse pagination parameters
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     // Build filter query
//     const filter = { clinicId };

//     if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
//       filter.userId = me._id;
//     }

//     // Apply status filter if provided
//     if (req.query.status) {
//       filter.status = req.query.status;
//     }

//     // Apply type filter if provided
//     if (req.query.type) {
//       filter.type = req.query.type;
//     }

//     // Apply search filter if provided
//     if (req.query.search) {
//       const searchRegex = new RegExp(req.query.search, "i");
//       filter.$or = [{ name: searchRegex }, { description: searchRegex }];
//     }

//     // Get total count
//     const total = await Campaign.countDocuments(filter);

//     // Fetch campaigns with pagination
//     const campaigns = await Campaign.find(filter)
//       .populate(
//         "template",
//         "name uniqueName category language status",
//         Template,
//       )
//       .populate("userId", "name email", User)
//       .populate("segmentId", "name", Segment)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     // Calculate pagination metadata
//     const totalPages = Math.ceil(total / limit);
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     return res.status(200).json({
//       success: true,
//       data: campaigns,
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalItems: total,
//         totalResults: total,
//         itemsPerPage: limit,
//         hasNextPage,
//         hasPrevPage,
//       },
//     });
//   } catch (err) {
//     console.error("Error fetching campaigns:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message || "Internal Server Error",
//     });
//   }
// }

// ------------------------------------------- NEW -------------------------------------------
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import Clinic from "../../../models/Clinic";
import dbConnect from "../../../lib/database";
import Campaign from "../../../models/Campaign";
import Template from "../../../models/Template";
import Segment from "../../../models/Segment";
import User from "../../../models/Users";
import Message from "../../../models/Message";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
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
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.query.clinicId;
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
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { clinicId };

    if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
      filter.userId = me._id;
    }

    // Apply status filter if provided
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Apply type filter if provided
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Apply search filter if provided
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // Get total count
    const total = await Campaign.countDocuments(filter);

    // Fetch campaigns with pagination
    const campaigns = await Campaign.find(filter)
      .populate(
        "template",
        "name uniqueName category language status",
        Template,
      )
      .populate("userId", "name email", User)
      .populate("segmentId", "name", Segment)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get all campaign IDs for aggregation
    const campaignIds = campaigns.map((campaign) => campaign._id);

    // Aggregate message statistics for all campaigns
    const messageStats = await Message.aggregate([
      {
        $match: {
          campaignId: { $in: campaignIds },
        },
      },
      {
        $group: {
          _id: "$campaignId",
          totalMessages: { $sum: 1 },

          // SENT: All messages except failed, bounced, complained, unsubscribed
          sentMessages: {
            $sum: {
              $cond: [
                {
                  $not: {
                    $in: [
                      "$status",
                      ["failed", "bounced", "complained", "unsubscribed"],
                    ],
                  },
                },
                1,
                0,
              ],
            },
          },

          // DELIVERED: Messages with delivered OR higher status (read, opened, clicked)
          deliveredMessages: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["delivered", "read", "opened", "clicked"]],
                },
                1,
                0,
              ],
            },
          },

          // READ: Messages with read OR higher status (opened, clicked)
          readMessages: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["read", "opened", "clicked"]],
                },
                1,
                0,
              ],
            },
          },

          // OPENED: Messages with opened OR clicked status
          openedMessages: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["opened", "clicked"]],
                },
                1,
                0,
              ],
            },
          },

          // CLICKED: Messages with clicked status only
          clickedMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "clicked"] }, 1, 0],
            },
          },

          // FAILED: Messages with failed status only
          failedMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },

          // UNSUBSCRIBED: Messages with unsubscribed status only
          unsubscribedMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "unsubscribed"] }, 1, 0],
            },
          },

          // BOUNCED: Messages with bounced status only
          bouncedMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "bounced"] }, 1, 0],
            },
          },

          // COMPLAINED: Messages with complained status only
          complainedMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "complained"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Create a map of campaignId to stats for quick lookup
    const statsMap = {};
    messageStats.forEach((stat) => {
      statsMap[stat._id.toString()] = stat;
    });

    // Enrich campaigns with aggregated message stats
    const enrichedCampaigns = campaigns.map((campaign) => {
      const stats = statsMap[campaign._id.toString()] || {};

      return {
        ...campaign,
        totalMessages: stats.totalMessages || 0,
        sentMessages: stats.sentMessages || 0,
        deliveredMessages: stats.deliveredMessages || 0,
        readMessages: stats.readMessages || 0,
        openedMessages: stats.openedMessages || 0,
        clickedMessages: stats.clickedMessages || 0,
        failedMessages: stats.failedMessages || 0,
        unsubscribedMessages: stats.unsubscribedMessages || 0,
        bouncedMessages: stats.bouncedMessages || 0,
        complainedMessages: stats.complainedMessages || 0,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      data: enrichedCampaigns,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        totalResults: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (err) {
    console.error("Error fetching campaigns:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}
