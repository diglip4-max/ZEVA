// pages/api/notifications/logs/index.ts

import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { NotificationLog } from "../../../models/notification/NotificationLog";
import PatientRegistration from "../../../models/PatientRegistration";
import Template from "../../../models/Template";
import Provider from "../../../models/Provider";
import Message from "../../../models/Message";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  if (!["GET"].includes(req.method)) {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("Error connecting to database:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }

  // ---- shared: resolve clinicId based on role ----
  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({
      success: false,
      message:
        "Access denied. Only clinic, agent, admin, or doctor can view notification logs.",
    });
  }

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
      return res.status(400).json({
        success: false,
        message: "Agent not tied to a clinic",
      });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res.status(400).json({
        success: false,
        message: "Doctor not tied to a clinic",
      });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.query.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin in query parameters",
      });
    }
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // ---- GET /api/notifications/logs — list + filters ----
  try {
    const {
      status,
      channel,
      category,
      patientId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { clinicId };

    // Filters
    if (status && status !== "all") query.status = status;
    if (channel && channel !== "all") query.channel = channel;
    if (category && category !== "all") query.category = category;
    if (patientId) query.patientId = patientId;

    // Date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    // Search
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
        { "trigger.event": { $regex: search, $options: "i" } },
        { actionSummary: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      NotificationLog.find(query)
        .populate("patientId", "firstName lastName gender email mobileNumber")
        .populate(
          "messageId",
          "subject preheader content direction errorCode errorMessage status source",
        )
        .populate("templateId")
        .populate("providerId", "name label phone email type")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      NotificationLog.countDocuments(query),
    ]);

    // ---- ANALYTICS / METRICS ----
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const analyticsResult = await NotificationLog.aggregate([
      { $match: { clinicId } },
      {
        $facet: {
          // Overall stats
          overall: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                enabled: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          ["delivered", "read", "opened", "clicked"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                disabled: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          ["pending", "queued", "sent", "failed"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                delivered: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          ["delivered", "read", "opened", "clicked"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                failed: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
                  },
                },
                opened: {
                  $sum: {
                    $cond: [{ $in: ["$status", ["opened", "clicked"]] }, 1, 0],
                  },
                },
                clicked: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "clicked"] }, 1, 0],
                  },
                },
                read: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "read"] }, 1, 0],
                  },
                },
                sent: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "sent"] }, 1, 0],
                  },
                },
                pending: {
                  $sum: {
                    $cond: [{ $in: ["$status", ["pending", "queued"]] }, 1, 0],
                  },
                },
              },
            },
          ],
          // By category
          byCategory: [
            {
              $group: {
                _id: "$category",
                total: { $sum: 1 },
                delivered: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          ["delivered", "read", "opened", "clicked"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                failed: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
                  },
                },
                opened: {
                  $sum: {
                    $cond: [{ $in: ["$status", ["opened", "clicked"]] }, 1, 0],
                  },
                },
              },
            },
            { $sort: { total: -1 } },
          ],
          // By channel
          byChannel: [
            {
              $group: {
                _id: "$channel",
                total: { $sum: 1 },
                delivered: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          ["delivered", "read", "opened", "clicked"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                failed: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
                  },
                },
              },
            },
            { $sort: { total: -1 } },
          ],
          // Today vs yesterday
          today: [
            {
              $match: {
                createdAt: { $gte: todayStart },
              },
            },
            { $count: "count" },
          ],
          yesterday: [
            {
              $match: {
                createdAt: { $gte: yesterdayStart, $lt: todayStart },
              },
            },
            { $count: "count" },
          ],
          // By status
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);

    const analytics = analyticsResult[0] || {
      overall: [
        {
          total: 0,
          enabled: 0,
          disabled: 0,
          delivered: 0,
          failed: 0,
          opened: 0,
          clicked: 0,
          read: 0,
          sent: 0,
          pending: 0,
        },
      ],
      byCategory: [],
      byChannel: [],
      today: [{ count: 0 }],
      yesterday: [{ count: 0 }],
      byStatus: [],
    };

    const overall = analytics.overall[0] || {
      total: 0,
      enabled: 0,
      disabled: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      clicked: 0,
      read: 0,
      sent: 0,
      pending: 0,
    };

    const todayCount = analytics.today[0]?.count || 0;
    const yesterdayCount = analytics.yesterday[0]?.count || 0;
    const trend =
      yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : todayCount > 0
          ? 100
          : 0;

    // ---- META ----
    // Get unique categories for filter
    const categories = await NotificationLog.distinct("category", { clinicId });

    return res.status(200).json({
      success: true,
      data: logs,
      analytics: {
        total: overall.total,
        enabled: overall.enabled,
        disabled: overall.disabled,
        delivered: overall.delivered,
        failed: overall.failed,
        opened: overall.opened,
        clicked: overall.clicked,
        read: overall.read,
        sent: overall.sent,
        pending: overall.pending,
        byCategory: analytics.byCategory.reduce((acc, item) => {
          acc[item._id] = {
            total: item.total,
            delivered: item.delivered,
            failed: item.failed,
            opened: item.opened,
          };
          return acc;
        }, {}),
        byChannel: analytics.byChannel.reduce((acc, item) => {
          acc[item._id] = {
            total: item.total,
            delivered: item.delivered,
            failed: item.failed,
          };
          return acc;
        }, {}),
        byStatus: analytics.byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        today: todayCount,
        yesterday: yesterdayCount,
        trend: Math.round(trend * 10) / 10,
      },
      categories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
