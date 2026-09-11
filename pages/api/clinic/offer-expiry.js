import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!requireRole(user, ["clinic", "agent", "admin", "doctor", "doctorStaff", "staff"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;

    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent" || user.role === "doctorStaff" || user.role === "staff") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinicId = adminClinicId;
      }
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find billings with bundle offers that have unused free sessions expiring soon
    const within7DaysPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          offerExpiryDate: {
            $gte: now,
            $lte: sevenDaysFromNow,
          },
        },
      },
      {
        $group: {
          _id: "$patientId",
          benefitAmount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    {
                      $reduce: {
                        input: "$offerFreeSession",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                    {
                      $reduce: {
                        input: "$usedFreeSessions",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                  ],
                },
                100, // Estimated value per session
              ],
            },
          },
        },
      },
    ];

    const within30DaysPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          offerExpiryDate: {
            $gte: now,
            $lte: thirtyDaysFromNow,
          },
        },
      },
      {
        $group: {
          _id: "$patientId",
          benefitAmount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    {
                      $reduce: {
                        input: "$offerFreeSession",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                    {
                      $reduce: {
                        input: "$usedFreeSessions",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                  ],
                },
                100,
              ],
            },
          },
        },
      },
    ];

    const [within7DaysResult, within30DaysResult] = await Promise.all([
      Billing.aggregate(within7DaysPipeline),
      Billing.aggregate(within30DaysPipeline),
    ]);

    const within7Days = {
      patientCount: within7DaysResult.length,
      benefitAmount: within7DaysResult.reduce((sum, r) => sum + (r.benefitAmount || 0), 0),
    };

    const within30Days = {
      patientCount: within30DaysResult.length,
      benefitAmount: within30DaysResult.reduce((sum, r) => sum + (r.benefitAmount || 0), 0),
    };

    const renewalOpportunity = within30Days.benefitAmount * 0.5; // 50% renewal rate estimate

    res.status(200).json({
      success: true,
      data: {
        within7Days,
        within30Days,
        renewalOpportunity,
      },
    });
  } catch (err) {
    console.error("Error in offer-expiry:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
