import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Users from "../../../models/Users";
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

    // Get staff members for this clinic
    const staffMembers = await Users.find({
      clinicId: clinicId,
      role: { $in: ["staff", "doctorStaff"] },
    }).select("_id name").lean();

    if (staffMembers.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const staffIds = staffMembers.map((s) => s._id);

    // Get offer usage by staff
    const staffUsagePipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          createdBy: { $in: staffIds },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$createdBy",
          offers: { $sum: 1 },
          totalBenefit: {
            $sum: {
              $add: [
                { $ifNull: ["$offerDiscountAmount", 0] },
                { $ifNull: ["$cashbackAmount", 0] },
              ],
            },
          },
          manualOverrides: {
            $sum: {
              $cond: [{ $eq: ["$isManualOverride", true] }, 1, 0],
            },
          },
        },
      },
    ];

    const staffUsageResult = await Billing.aggregate(staffUsagePipeline);

    // Map results to staff members
    const staffMap = {};
    staffMembers.forEach((s) => {
      staffMap[s._id.toString()] = {
        staffId: s._id.toString(),
        staffName: s.name || "Unknown",
        offers: 0,
        avgBenefit: 0,
        overrides: 0,
      };
    });

    staffUsageResult.forEach((r) => {
      const staffId = r._id.toString();
      if (staffMap[staffId]) {
        staffMap[staffId].offers = r.offers;
        staffMap[staffId].avgBenefit = r.offers > 0 ? Math.round(r.totalBenefit / r.offers) : 0;
        staffMap[staffId].overrides = r.manualOverrides;
      }
    });

    // Convert to array and determine status
    const staffUsageData = Object.values(staffMap).map((s) => ({
      ...s,
      status: s.offers === 0 ? "Low" : s.overrides > 0 ? "Needs review" : "Low",
    }));

    res.status(200).json({
      success: true,
      data: staffUsageData,
    });
  } catch (err) {
    console.error("Error in offer-staff-usage:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
