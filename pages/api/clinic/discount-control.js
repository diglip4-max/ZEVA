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

    // Calculate average discount from instant_discount offers
    const discountPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "instant_discount",
          isAdvanceOnly: { $ne: true },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: "$offerDiscountAmount" },
          totalOriginalAmount: { $sum: "$originalAmount" },
          count: { $sum: 1 },
          manualOverrides: {
            $sum: {
              $cond: [{ $eq: ["$isManualOverride", true] }, 1, 0],
            },
          },
        },
      },
    ];

    const discountResult = await Billing.aggregate(discountPipeline);
    const discountData = discountResult[0] || { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };

    const averageDiscount = discountData.totalOriginalAmount > 0
      ? Math.round((discountData.totalDiscount / discountData.totalOriginalAmount) * 100)
      : 0;

    const allowedMaximum = 10; // Default max discount percentage
    const marginThreshold = 18; // Default margin threshold percentage

    res.status(200).json({
      success: true,
      data: {
        averageDiscount,
        allowedMaximum,
        marginThreshold,
        manualOverrides: discountData.manualOverrides,
      },
    });
  } catch (err) {
    console.error("Error in discount-control:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
