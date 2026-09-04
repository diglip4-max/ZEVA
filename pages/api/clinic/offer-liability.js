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

    // Parse date range
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.invoicedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Calculate free session liability (bundle offers with unused free sessions)
    const freeSessionLiabilityPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalFreeSessions: {
            $sum: {
              $reduce: {
                input: "$offerFreeSession",
                initialValue: 0,
                in: { $add: ["$$value", 1] },
              },
            },
          },
          totalRedeemed: {
            $sum: {
              $reduce: {
                input: "$usedFreeSessions",
                initialValue: 0,
                in: { $add: ["$$value", 1] },
              },
            },
          },
          totalRevenue: { $sum: "$amount" },
        },
      },
    ];

    // Calculate wallet/cashback liability
    const walletLiabilityPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: "cashback" },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalCashbackEarned: { $sum: "$cashbackAmount" },
          totalWalletUsed: { $sum: "$cashbackWalletUsed" },
        },
      },
    ];

    const [freeSessionResult, walletResult] = await Promise.all([
      Billing.aggregate(freeSessionLiabilityPipeline),
      Billing.aggregate(walletLiabilityPipeline),
    ]);

    const freeSessionData = freeSessionResult[0] || { totalFreeSessions: 0, totalRedeemed: 0, totalRevenue: 0 };
    const walletData = walletResult[0] || { totalCashbackEarned: 0, totalWalletUsed: 0 };

    const freeSessionsRemaining = freeSessionData.totalFreeSessions - freeSessionData.totalRedeemed;
    const freeSessionLiability = freeSessionsRemaining * 100; // Estimated value per session
    const walletLiability = walletData.totalCashbackEarned - walletData.totalWalletUsed;

    res.status(200).json({
      success: true,
      data: {
        freeSessionLiability: Math.max(0, freeSessionLiability),
        walletLiability: Math.max(0, walletLiability),
        freeSessionsRemaining: Math.max(0, freeSessionsRemaining),
      },
    });
  } catch (err) {
    console.error("Error in offer-liability:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
