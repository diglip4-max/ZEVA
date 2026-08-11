import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import PettyCash from "../../../models/PettyCash";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Only clinic, agent, admin, and doctor can view petty cash
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view petty cash.",
      });
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

    const user = await getAuthorizedStaffUser(req, {
      allowedRoles: [
        "staff",
        "doctorStaff",
        "doctor",
        "clinic",
        "agent",
        "admin",
      ],
    });

    const staffId = user._id.toString();

    const search = req.query.search ? req.query.search.trim() : "";

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      clinicId,
      ...(me.role === "clinic" ? {} : { staffId }),
      ...(search
        ? {
            $or: [
              { patientName: { $regex: search, $options: "i" } },
              { patientEmail: { $regex: search, $options: "i" } },
              { patientPhone: { $regex: search, $options: "i" } },
              { note: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const pettyCashList = await PettyCash.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalRecords = await PettyCash.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const hasMore = page < totalPages;

    // ============================================================
    // SUMMARY STATISTICS
    // ============================================================
    const summary = await PettyCash.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$totalAllocated" },
          totalSpent: { $sum: "$totalSpent" },
          totalBalance: { $sum: "$totalAmount" },
          totalRecords: { $sum: 1 },
          // Count records with balance > 0 (Available)
          availableCount: {
            $sum: {
              $cond: [{ $gte: ["$totalAmount", 0] }, 1, 0],
            },
          },
          // Count records with balance < 0 (Overspent)
          overspentCount: {
            $sum: {
              $cond: [{ $lt: ["$totalAmount", 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Get global amounts for the clinic
    const globalAmounts = await PettyCash.getGlobalAmounts(clinicId);

    // Build summary object
    const summaryData =
      summary.length > 0
        ? summary[0]
        : {
            totalAllocated: 0,
            totalSpent: 0,
            totalBalance: 0,
            totalRecords: 0,
            availableCount: 0,
            overspentCount: 0,
          };

    if (!pettyCashList) {
      return res
        .status(404)
        .json({ success: false, message: "Petty cash not found" });
    }

    return res.status(200).json({
      success: true,
      data: pettyCashList,
      summary: {
        totalAllocated: summaryData.totalAllocated || 0,
        totalSpent: summaryData.totalSpent || 0,
        totalBalance: summaryData.totalBalance || 0,
        totalRecords: summaryData.totalRecords || 0,
        availableCount: summaryData.availableCount || 0,
        overspentCount: summaryData.overspentCount || 0,
        globalTotalAmount: globalAmounts.globalTotalAmount || 0,
        globalSpentAmount: globalAmounts.globalSpentAmount || 0,
        globalRemainingAmount: globalAmounts.globalRemainingAmount || 0,
      },
      pagination: {
        totalResults: totalRecords,
        totalPages,
        currentPage: page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching petty cash:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
