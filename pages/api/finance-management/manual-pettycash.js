import dbConnect from "../../../lib/database";
import ManualPettyCash from "../../../models/ManualPettyCash";
import Clinic from "../../../models/Clinic";
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

    // Only clinic, agent, admin, and doctor can view manual petty cash
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view manual petty cash.",
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

    // Filter based on role
    const filter = {
      clinicId,
      ...(me.role === "clinic" ? {} : { addedBy: staffId }),
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { vendorName: { $regex: search, $options: "i" } },
              { note: { $regex: search, $options: "i" } },
              { "items.itemName": { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    // Fetch manual petty cash entries
    const manualPettyCashList = await ManualPettyCash.find(filter)
      .populate("addedBy", "name email")
      .populate("vendorId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalRecords = await ManualPettyCash.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const hasMore = page < totalPages;

    // ============================================================
    // SUMMARY STATISTICS - FIXED VERSION
    // ============================================================
    const summary = await ManualPettyCash.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalExpenses: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", true] }, "$amount", 0],
            },
          },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", false] }, "$amount", 0],
            },
          },
          totalRecords: { $sum: 1 },
          expenseCount: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", true] }, 1, 0],
            },
          },
          incomeCount: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", false] }, 1, 0],
            },
          },
          // FIX: Handle missing items field - use $ifNull to provide default empty array
          totalItems: {
            $sum: {
              $cond: [{ $isArray: "$items" }, { $size: "$items" }, 0],
            },
          },
        },
      },
    ]);

    // Get global amounts for the clinic
    const globalAmounts = await ManualPettyCash.aggregate([
      { $match: { clinicId } },
      {
        $group: {
          _id: null,
          globalTotalAmount: { $sum: "$amount" },
          globalTotalExpenses: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", true] }, "$amount", 0],
            },
          },
          globalTotalIncome: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", false] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    // Build summary object
    const summaryData =
      summary.length > 0
        ? summary[0]
        : {
            totalAmount: 0,
            totalExpenses: 0,
            totalIncome: 0,
            totalRecords: 0,
            expenseCount: 0,
            incomeCount: 0,
            totalItems: 0,
          };

    const globalData =
      globalAmounts.length > 0
        ? globalAmounts[0]
        : {
            globalTotalAmount: 0,
            globalTotalExpenses: 0,
            globalTotalIncome: 0,
          };

    if (!manualPettyCashList) {
      return res
        .status(404)
        .json({ success: false, message: "Manual petty cash not found" });
    }

    return res.status(200).json({
      success: true,
      data: manualPettyCashList,
      summary: {
        totalAmount: summaryData.totalAmount || 0,
        totalExpenses: summaryData.totalExpenses || 0,
        totalIncome: summaryData.totalIncome || 0,
        totalRecords: summaryData.totalRecords || 0,
        expenseCount: summaryData.expenseCount || 0,
        incomeCount: summaryData.incomeCount || 0,
        totalItems: summaryData.totalItems || 0,
        // Global clinic totals
        globalTotalAmount: globalData.globalTotalAmount || 0,
        globalTotalExpenses: globalData.globalTotalExpenses || 0,
        globalTotalIncome: globalData.globalTotalIncome || 0,
        globalBalance:
          (globalData.globalTotalIncome || 0) -
          (globalData.globalTotalExpenses || 0),
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
    console.error("Error fetching manual petty cash:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
