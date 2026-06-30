import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";
import PatientRegistration from "../../../../models/PatientRegistration";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }

  let user;

  try {
    user = await getUserFromReq(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (
      !["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(
        user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);

  if (clinicError && user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: clinicError,
    });
  }

  const moduleKey = "clinic_reporting";

  const { hasPermission } = await checkClinicPermission(
    clinicId,
    moduleKey,
    "read"
  );

  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view reports",
    });
  }

  const { startDate, endDate, limit = "10" } = req.query;

  const lim = Math.max(1, Math.min(25, parseInt(limit, 10) || 10));

  try {
    const match = {};

    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      match.clinicId = new mongoose.Types.ObjectId(
        String(req.query.clinicId)
      );
    }

    const startAt = startDate
      ? new Date(
          new Date(startDate).getFullYear(),
          new Date(startDate).getMonth(),
          new Date(startDate).getDate(),
          0,
          0,
          0,
          0
        )
      : null;

    const endAt = endDate
      ? new Date(
          new Date(endDate).getFullYear(),
          new Date(endDate).getMonth(),
          new Date(endDate).getDate(),
          23,
          59,
          59,
          999
        )
      : null;

    const pipeline = [
      {
        $match: match,
      },

      {
        $unwind: "$packages",
      },

      ...(startAt || endAt
        ? [
            {
              $match: {
                "packages.assignedDate": {
                  ...(startAt ? { $gte: startAt } : {}),
                  ...(endAt ? { $lte: endAt } : {}),
                },
              },
            },
          ]
        : []),

      {
        $group: {
          _id: "$packages.packageSoldByUserId",

          totalPackagesSold: {
            $sum: 1,
          },

          totalRevenue: {
            $sum: {
              $ifNull: ["$packages.totalPrice", 0],
            },
          },

          totalPaid: {
            $sum: {
              $ifNull: ["$packages.paidAmount", 0],
            },
          },

          totalPending: {
            $sum: {
              $subtract: [
                {
                  $ifNull: ["$packages.totalPrice", 0],
                },
                {
                  $ifNull: ["$packages.paidAmount", 0],
                },
              ],
            },
          },

          paidPackages: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    {
                      $ifNull: ["$packages.paidAmount", 0],
                    },
                    {
                      $ifNull: ["$packages.totalPrice", 0],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          partiallyPaidPackages: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $gt: [
                        {
                          $ifNull: ["$packages.paidAmount", 0],
                        },
                        0,
                      ],
                    },
                    {
                      $lt: [
                        {
                          $ifNull: ["$packages.paidAmount", 0],
                        },
                        {
                          $ifNull: ["$packages.totalPrice", 0],
                        },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          unpaidPackages: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    {
                      $ifNull: ["$packages.paidAmount", 0],
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $unwind: {
          path: "$staff",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,

          staffId: "$_id",

          name: {
            $ifNull: [
              "$staff.name",
              {
                $trim: {
                  input: {
                    $concat: [
                      {
                        $ifNull: ["$staff.firstName", ""],
                      },
                      " ",
                      {
                        $ifNull: ["$staff.lastName", ""],
                      },
                    ],
                  },
                },
              },
            ],
          },

          totalPackagesSold: 1,
          totalRevenue: 1,
          totalPaid: 1,
          totalPending: 1,

          outstanding: "$totalPending",

          paidPackages: 1,
          partiallyPaidPackages: 1,
          unpaidPackages: 1,
        },
      },

      {
        $sort: {
          totalPackagesSold: -1,
        },
      },

      {
        $limit: lim,
      },
    ];

    const leaderboard = await PatientRegistration.aggregate(pipeline);

    const leaderboardWithFallback =
      leaderboard.length > 0
        ? leaderboard
        : [
            {
              staffId: null,
              name: "Unknown Sales Staff",
              totalPackagesSold: 0,
              totalRevenue: 0,
              totalPaid: 0,
              totalPending: 0,
              outstanding: 0,
              paidPackages: 0,
              partiallyPaidPackages: 0,
              unpaidPackages: 0,
            },
          ];

    return res.status(200).json({
      success: true,
      data: leaderboardWithFallback,
    });
  } catch (error) {
    console.error("sales-staff-performance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales staff performance",
    });
  }
}