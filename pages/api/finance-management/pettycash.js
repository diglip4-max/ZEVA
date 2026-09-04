import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import PettyCash from "../../../models/PettyCash";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import Users from "../../../models/Users";

// Helper function to safely parse Decimal128 or Number values
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value.$numberDecimal) return parseFloat(value.$numberDecimal);
  if (value._bsontype === "Decimal128") return parseFloat(value.toString());
  return 0;
};

// Helper to transform allocation data
const transformAllocation = (alloc) => ({
  ...alloc,
  amount: parseNumber(alloc.amount),
});

// Helper to transform expense data
const transformExpense = (exp) => ({
  ...exp,
  spentAmount: parseNumber(exp.spentAmount),
  items: (exp.items || []).map((item) => ({
    ...item,
    amount: parseNumber(item.amount),
  })),
});

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

    // Get view type from query
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

    // Expense filter with search
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

    // Allocation filter
    const allocationFilter = {
      ...baseFilter,
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
      let allocationQuery = PettyCashAllocation.find(allocationFilter)
        .populate("staffId", "name email role")
        .populate("createdBy", "name email role")
        .populate("voidedBy", "name email")
        .populate({
          path: "pettyCashId",
          select: "patient.name patient.email patient.phone note",
        })
        .sort({ date: -1 });

      if (viewType === "allocations") {
        allocationQuery = allocationQuery.skip(skip).limit(limit);
      } else {
        allocationQuery = allocationQuery.limit(100);
      }

      allocations = await allocationQuery.lean();
      allocations = allocations.map(transformAllocation);

      // Filter allocations by search (if needed)
      if (search && viewType === "allocations") {
        const searchLower = search.toLowerCase();
        allocations = allocations.filter((alloc) => {
          const pettyCash = alloc.pettyCashId || {};
          const patient = pettyCash.patient || {};
          return (
            (patient.name?.toLowerCase() || "").includes(searchLower) ||
            (patient.email?.toLowerCase() || "").includes(searchLower) ||
            (patient.phone?.toLowerCase() || "").includes(searchLower) ||
            (pettyCash.note?.toLowerCase() || "").includes(searchLower)
          );
        });
        totalAllocations = allocations.length;
      } else {
        totalAllocations =
          await PettyCashAllocation.countDocuments(allocationFilter);
      }

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
          ? {
              totalAllocated: parseNumber(allocSummary[0].totalAllocated),
              totalAllocations: allocSummary[0].totalAllocations || 0,
              totalVoided: allocSummary[0].totalVoided || 0,
              averageAmount: parseNumber(allocSummary[0].averageAmount),
              minAmount: parseNumber(allocSummary[0].minAmount),
              maxAmount: parseNumber(allocSummary[0].maxAmount),
            }
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
      const qLength = await PettyCashExpense.countDocuments({ clinicId });
      console.log({
        baseFilter,
        expenseFilter,
        viewType,
        expenseQueryLength: qLength,
        clinicId,
      });
      let expenseQuery = PettyCashExpense.find(expenseFilter)
        .populate("vendor", "name email phone")
        .populate("createdBy", "name email role")
        .populate("voidedBy", "name email")
        .populate({
          path: "pettyCashId",
          select: "patient.name patient.email patient.phone note",
        })
        .sort({ date: -1 });

      if (viewType === "expenses") {
        expenseQuery = expenseQuery.skip(skip).limit(limit);
      } else {
        expenseQuery = expenseQuery.limit(100);
      }

      expenses = await expenseQuery.lean();
      expenses = expenses.map(transformExpense);

      totalExpenses = await PettyCashExpense.countDocuments(expenseFilter);

      // ============================================================
      // EXPENSE SUMMARY - ONLY COUNT usedFromPettyCash: true
      // ============================================================
      const expSummary = await PettyCashExpense.aggregate([
        { $match: expenseFilter },
        {
          $group: {
            _id: null,
            // 🔥 NAYA: Total spent (sabhi expenses - chahe petty cash ho ya info)
            totalAllSpent: {
              $sum: {
                $cond: [{ $eq: ["$isVoided", false] }, "$spentAmount", 0],
              },
            },
            // ONLY count expenses where usedFromPettyCash is true
            totalSpent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$usedFromPettyCash", true] },
                      { $eq: ["$isVoided", false] },
                    ],
                  },
                  "$spentAmount",
                  0,
                ],
              },
            },
            // Count of expenses used from petty cash
            pettyCashExpenseCount: {
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
            // Count of informational expenses (not from petty cash)
            infoExpenseCount: {
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
            averageSpent: {
              $avg: {
                $cond: [
                  { $eq: ["$usedFromPettyCash", true] },
                  "$spentAmount",
                  null,
                ],
              },
            },
            minSpent: {
              $min: {
                $cond: [
                  { $eq: ["$usedFromPettyCash", true] },
                  "$spentAmount",
                  null,
                ],
              },
            },
            maxSpent: {
              $max: {
                $cond: [
                  { $eq: ["$usedFromPettyCash", true] },
                  "$spentAmount",
                  null,
                ],
              },
            },
            vendors: {
              $addToSet: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$usedFromPettyCash", true] },
                      { $ne: ["$vendor", null] },
                    ],
                  },
                  "$vendor",
                  null,
                ],
              },
            },
            vendorNames: {
              $addToSet: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$usedFromPettyCash", true] },
                      { $ne: ["$vendorName", null] },
                    ],
                  },
                  "$vendorName",
                  null,
                ],
              },
            },
          },
        },
      ]);

      expenseSummary =
        expSummary.length > 0
          ? {
              totalAllSpent: parseNumber(expSummary[0].totalAllSpent), // 🔥 Sabhi expenses
              totalSpent: parseNumber(expSummary[0].totalSpent), // Sirf petty cash
              totalExpenses: expSummary[0].totalExpenses || 0,
              pettyCashExpenseCount: expSummary[0].pettyCashExpenseCount || 0,
              infoExpenseCount: expSummary[0].infoExpenseCount || 0,
              totalVoided: expSummary[0].totalVoided || 0,
              averageSpent: parseNumber(expSummary[0].averageSpent),
              minSpent: parseNumber(expSummary[0].minSpent),
              maxSpent: parseNumber(expSummary[0].maxSpent),
              uniqueVendors:
                expSummary[0].vendors?.filter((v) => v !== null).length || 0,
              vendorNames:
                expSummary[0].vendorNames?.filter((v) => v !== null) || [],
            }
          : {
              totalSpent: 0,
              totalExpenses: 0,
              pettyCashExpenseCount: 0,
              infoExpenseCount: 0,
              totalVoided: 0,
              averageSpent: 0,
              minSpent: 0,
              maxSpent: 0,
              uniqueVendors: 0,
              vendorNames: [],
            };
    }

    // Combined summary (for 'all' view)
    if (viewType === "all") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Daily breakdown - ONLY from petty cash expenses
      const dailyBreakdown = await PettyCashExpense.aggregate([
        {
          $match: {
            ...expenseFilter,
            date: { $gte: thirtyDaysAgo },
            isVoided: { $ne: true },
            usedFromPettyCash: true, // Only include petty cash expenses
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

      // Vendor breakdown - ONLY from petty cash expenses
      const vendorBreakdown = await PettyCashExpense.aggregate([
        {
          $match: {
            ...expenseFilter,
            isVoided: { $ne: true },
            vendor: { $ne: null },
            usedFromPettyCash: true, // Only include petty cash expenses
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
          totalSpent: parseNumber(day.totalSpent),
          count: day.count,
        })),
        topVendors: vendorBreakdown.map((vendor) => ({
          vendorId: vendor._id,
          vendorName: vendor.vendorName || "Unknown Vendor",
          totalSpent: parseNumber(vendor.totalSpent),
          expenseCount: vendor.expenseCount,
          averageAmount: parseNumber(vendor.averageAmount),
        })),
      };
    }

    // Calculate total pages
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
      data: {
        allocations:
          viewType === "allocations" || viewType === "all" ? allocations : [],
        expenses: viewType === "expenses" || viewType === "all" ? expenses : [],
      },
      summaries: {
        allocation:
          viewType === "allocations" || viewType === "all"
            ? allocationSummary
            : null,
        expense:
          viewType === "expenses" || viewType === "all" ? expenseSummary : null,
        combined: viewType === "all" ? combinedSummary : null,
      },
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
