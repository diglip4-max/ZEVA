import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
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

    // Get view type from query: 'allocations', 'expenses', or 'all' (default)
    const viewType = req.query.viewType || "all";
    const search = req.query.search ? req.query.search.trim() : "";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const vendorId = req.query.vendorId;
    const showVoided = req.query.showVoided === "true";

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ============================================================
    // BUILD FILTERS
    // ============================================================
    const baseFilter = {
      clinicId,
      ...(me.role === "clinic" ? {} : { staffId }),
      ...(showVoided ? {} : { isVoided: { $ne: true } }),
      ...(startDate && {
        date: { $gte: new Date(startDate) },
      }),
      ...(endDate && {
        date: { $lte: new Date(endDate) },
      }),
    };

    // Allocation filter
    const allocationFilter = {
      ...baseFilter,
      ...(search
        ? {
            $or: [
              // Search in related PettyCash record
              // We'll handle this by populating and filtering in JS
            ],
          }
        : {}),
    };

    // Expense filter
    const expenseFilter = {
      ...baseFilter,
      ...(search
        ? {
            $or: [
              { description: { $regex: search, $options: "i" } },
              { vendorName: { $regex: search, $options: "i" } },
              { "items.itemName": { $regex: search, $options: "i" } },
            ],
          }
        : {}),
      ...(vendorId && {
        vendor: vendorId,
      }),
    };

    // ============================================================
    // FETCH DATA BASED ON VIEW TYPE
    // ============================================================
    let allocations = [];
    let expenses = [];
    let totalAllocations = 0;
    let totalExpenses = 0;
    let allocationSummary = {};
    let expenseSummary = {};
    let combinedSummary = {};

    if (viewType === "allocations" || viewType === "all") {
      // Fetch allocations
      allocations = await PettyCashAllocation.find(allocationFilter)
        .populate("staffId", "name email role")
        .populate("createdBy", "name email role")
        .populate("voidedBy", "name email")
        .populate({
          path: "pettyCashId",
          select: "patient.name patient.email patient.phone note",
        })
        .sort({ date: -1 })
        .skip(viewType === "allocations" ? skip : 0)
        .limit(viewType === "allocations" ? limit : 100)
        .lean();

      totalAllocations =
        await PettyCashAllocation.countDocuments(allocationFilter);

      // Allocation summary
      const allocSummary = await PettyCashAllocation.aggregate([
        { $match: allocationFilter },
        {
          $group: {
            _id: null,
            totalAllocated: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 0, "$amount"],
              },
            },
            totalAllocations: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 0, 1],
              },
            },
            totalVoided: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 1, 0],
              },
            },
            averageAmount: { $avg: "$amount" },
            minAmount: { $min: "$amount" },
            maxAmount: { $max: "$amount" },
          },
        },
      ]);

      allocationSummary =
        allocSummary.length > 0
          ? allocSummary[0]
          : {
              totalAllocated: 0,
              totalAllocations: 0,
              totalVoided: 0,
              averageAmount: 0,
              minAmount: 0,
              maxAmount: 0,
            };
    }

    if (viewType === "expenses" || viewType === "all") {
      // Fetch expenses
      expenses = await PettyCashExpense.find(expenseFilter)
        .populate("vendor", "name email phone")
        .populate("createdBy", "name email role")
        .populate("voidedBy", "name email")
        .populate({
          path: "pettyCashId",
          select: "patient.name patient.email patient.phone note",
        })
        .sort({ date: -1 })
        .skip(viewType === "expenses" ? skip : 0)
        .limit(viewType === "expenses" ? limit : 100)
        .lean();

      totalExpenses = await PettyCashExpense.countDocuments(expenseFilter);

      // Expense summary
      const expSummary = await PettyCashExpense.aggregate([
        { $match: expenseFilter },
        {
          $group: {
            _id: null,
            totalSpent: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 0, "$spentAmount"],
              },
            },
            totalExpenses: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 0, 1],
              },
            },
            totalVoided: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", true] }, 1, 0],
              },
            },
            averageSpent: { $avg: "$spentAmount" },
            minSpent: { $min: "$spentAmount" },
            maxSpent: { $max: "$spentAmount" },
            vendors: { $addToSet: "$vendor" },
            vendorNames: { $addToSet: "$vendorName" },
            usedFromPettyCashCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$usedFromPettyCash", true] },
                      { $eq: ["$isVoided", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            notUsedFromPettyCashCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$usedFromPettyCash", false] },
                      { $eq: ["$isVoided", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      expenseSummary =
        expSummary.length > 0
          ? expSummary[0]
          : {
              totalSpent: 0,
              totalExpenses: 0,
              totalVoided: 0,
              averageSpent: 0,
              minSpent: 0,
              maxSpent: 0,
              vendors: [],
              vendorNames: [],
              usedFromPettyCashCount: 0,
              notUsedFromPettyCashCount: 0,
            };
    }

    // Combined summary (for 'all' view)
    if (viewType === "all") {
      // Get daily breakdown for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyBreakdown = await PettyCashExpense.aggregate([
        {
          $match: {
            ...expenseFilter,
            date: { $gte: thirtyDaysAgo },
            isVoided: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              day: { $dayOfMonth: "$date" },
            },
            totalSpent: { $sum: "$spentAmount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]);

      // Get vendor breakdown
      const vendorBreakdown = await PettyCashExpense.aggregate([
        {
          $match: {
            ...expenseFilter,
            isVoided: { $ne: true },
            vendor: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$vendor",
            vendorName: { $first: "$vendorName" },
            totalSpent: { $sum: "$spentAmount" },
            expenseCount: { $sum: 1 },
            averageAmount: { $avg: "$spentAmount" },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
      ]);

      combinedSummary = {
        dailyBreakdown: dailyBreakdown.map((day) => ({
          date: `${day._id.year}-${String(day._id.month).padStart(2, "0")}-${String(day._id.day).padStart(2, "0")}`,
          totalSpent: parseFloat(day.totalSpent.toString()),
          count: day.count,
        })),
        topVendors: vendorBreakdown.map((vendor) => ({
          vendorId: vendor._id,
          vendorName: vendor.vendorName || "Unknown Vendor",
          totalSpent: parseFloat(vendor.totalSpent.toString()),
          expenseCount: vendor.expenseCount,
          averageAmount: parseFloat(vendor.averageAmount.toString()),
        })),
      };
    }

    // Calculate total pages based on view type
    const totalRecords =
      viewType === "allocations"
        ? totalAllocations
        : viewType === "expenses"
          ? totalExpenses
          : Math.max(totalAllocations, totalExpenses);

    const totalPages = Math.ceil(totalRecords / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      viewType,
      // Data
      allocations:
        viewType === "allocations" || viewType === "all" ? allocations : [],
      expenses: viewType === "expenses" || viewType === "all" ? expenses : [],

      // Summaries
      allocationSummary:
        viewType === "allocations" || viewType === "all"
          ? {
              totalAllocated: parseFloat(
                allocationSummary.totalAllocated?.toString() || 0,
              ),
              totalAllocations: allocationSummary.totalAllocations || 0,
              totalVoided: allocationSummary.totalVoided || 0,
              averageAmount: parseFloat(
                allocationSummary.averageAmount?.toString() || 0,
              ),
              minAmount: parseFloat(
                allocationSummary.minAmount?.toString() || 0,
              ),
              maxAmount: parseFloat(
                allocationSummary.maxAmount?.toString() || 0,
              ),
            }
          : null,

      expenseSummary:
        viewType === "expenses" || viewType === "all"
          ? {
              totalSpent: parseFloat(
                expenseSummary.totalSpent?.toString() || 0,
              ),
              totalExpenses: expenseSummary.totalExpenses || 0,
              totalVoided: expenseSummary.totalVoided || 0,
              averageSpent: parseFloat(
                expenseSummary.averageSpent?.toString() || 0,
              ),
              minSpent: parseFloat(expenseSummary.minSpent?.toString() || 0),
              maxSpent: parseFloat(expenseSummary.maxSpent?.toString() || 0),
              uniqueVendors:
                expenseSummary.vendors?.filter((v) => v !== null).length || 0,
              usedFromPettyCashCount:
                expenseSummary.usedFromPettyCashCount || 0,
              notUsedFromPettyCashCount:
                expenseSummary.notUsedFromPettyCashCount || 0,
            }
          : null,

      combinedSummary: viewType === "all" ? combinedSummary : null,

      pagination: {
        totalResults: totalRecords,
        totalPages,
        currentPage: page,
        limit,
        hasMore,
        filters: {
          search: search || null,
          startDate: startDate || null,
          endDate: endDate || null,
          vendorId: vendorId || null,
          showVoided: showVoided || false,
          viewType,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching petty cash data:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
