// pages/api/finance-management/overview.js
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Billing from "../../../models/Billing";
import Supplier from "../../../models/stocks/Supplier";
import PatientRegistration from "../../../models/PatientRegistration";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import ManualPettyCash from "../../../models/ManualPettyCash";
import ProductSale from "../../../models/stocks/ProductSale";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

// Helper function to safely parse numbers
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
  if (value?._bsontype === "Decimal128") return parseFloat(value.toString());
  return 0;
};

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

    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view overview.",
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

    const staffId = me._id.toString();

    // Date filters from query
    const { startDate, endDate, period = "monthly" } = req.query;
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const baseFilter = {
      clinicId,
    };

    // ============================================================
    // 1. BILLING SUMMARY
    // ============================================================
    const billingFilter = {
      ...baseFilter,
      paymentMethod: { $ne: "Cash" },
      service: { $ne: "Product" },
      ...(me.role === "clinic" ? {} : { invoicedById: staffId }),
      ...(Object.keys(dateFilter).length ? { invoicedDate: dateFilter } : {}),
    };

    const billingSummary = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalPending: { $sum: "$pending" },
          totalAdvance: { $sum: "$advance" },
          count: { $sum: 1 },
        },
      },
    ]);

    // ============================================================
    // 2. BILLING BY SERVICE TYPE
    // ============================================================
    const billingByService = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: "$service",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // ============================================================
    // 3. MONTHLY BILLING TREND
    // ============================================================
    const monthlyBillingTrend = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: {
            year: { $year: "$invoicedDate" },
            month: { $month: "$invoicedDate" },
          },
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalPending: { $sum: "$pending" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // ============================================================
    // 4. WEEKLY BILLING TREND (last 12 weeks)
    // ============================================================
    const weeklyBillingTrend = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: {
            year: { $year: "$invoicedDate" },
            week: { $week: "$invoicedDate" },
          },
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
      { $limit: 12 },
    ]);

    // ============================================================
    // 5. PETTY CASH ALLOCATIONS SUMMARY
    // ============================================================
    const allocationFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { staffId }),
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      isVoided: { $ne: true }, // Exclude voided allocations
    };

    const allocationSummary = await PettyCashAllocation.aggregate([
      { $match: allocationFilter },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$amount" },
          totalAllocations: { $sum: 1 },
          averageAllocation: { $avg: "$amount" },
          minAllocation: { $min: "$amount" },
          maxAllocation: { $max: "$amount" },
        },
      },
    ]);

    // ============================================================
    // 6. PETTY CASH EXPENSES SUMMARY (ONLY usedFromPettyCash: true)
    // ============================================================
    const expenseFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { staffId }),
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      usedFromPettyCash: true, // ONLY count expenses from petty cash
      isVoided: { $ne: true }, // Exclude voided expenses
    };

    const expenseSummary = await PettyCashExpense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$spentAmount" },
          totalExpenses: { $sum: 1 },
          averageExpense: { $avg: "$spentAmount" },
          minExpense: { $min: "$spentAmount" },
          maxExpense: { $max: "$spentAmount" },
          vendors: { $addToSet: "$vendor" },
          vendorNames: { $addToSet: "$vendorName" },
        },
      },
    ]);

    // ============================================================
    // 7. MANUAL PETTY CASH SUMMARY (KEPT - NOT REMOVED)
    // ============================================================
    const manualPettyCashFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { addedBy: staffId }),
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    const manualPettyCashSummary = await ManualPettyCash.aggregate([
      { $match: manualPettyCashFilter },
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
          totalItems: {
            $sum: {
              $cond: [{ $isArray: "$items" }, { $size: "$items" }, 0],
            },
          },
        },
      },
    ]);

    // ============================================================
    // 8. MONTHLY MANUAL PETTY CASH TREND (KEPT)
    // ============================================================
    const monthlyManualPettyCash = await ManualPettyCash.aggregate([
      { $match: manualPettyCashFilter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", false] }, "$amount", 0],
            },
          },
          totalExpenses: {
            $sum: {
              $cond: [{ $eq: ["$isExpense", true] }, "$amount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // ============================================================
    // 9. PETTY CASH RECENT ACTIVITY (last 10 combined)
    // ============================================================
    const recentAllocations = await PettyCashAllocation.find(allocationFilter)
      .populate("staffId", "name email")
      .populate("createdBy", "name email")
      .sort({ date: -1 })
      .limit(5)
      .lean();

    const recentExpenses = await PettyCashExpense.find(expenseFilter)
      .populate("vendor", "name email")
      .populate("createdBy", "name email")
      .sort({ date: -1 })
      .limit(5)
      .lean();

    // Transform recent activity
    const recentActivity = [
      ...recentAllocations.map((a) => ({
        ...a,
        type: "allocation",
        amount: parseNumber(a.amount),
        date: a.date,
        description: `Allocation of ${parseNumber(a.amount)}`,
      })),
      ...recentExpenses.map((e) => ({
        ...e,
        type: "expense",
        amount: parseNumber(e.spentAmount),
        date: e.date,
        description: e.description,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // ============================================================
    // 10. MONTHLY PETTY CASH TREND (Allocations + Expenses)
    // ============================================================
    const monthlyPettyCash = await PettyCashAllocation.aggregate([
      { $match: allocationFilter },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalAllocated: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyExpenses = await PettyCashExpense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalSpent: { $sum: "$spentAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Combine monthly data
    const monthlyPettyCashData = monthlyPettyCash.map((item) => {
      const month = `${item._id.month}/${item._id.year}`;
      const expense = monthlyExpenses.find(
        (e) => e._id.year === item._id.year && e._id.month === item._id.month,
      );
      return {
        month,
        totalAllocated: parseNumber(item.totalAllocated),
        totalSpent: expense ? parseNumber(expense.totalSpent) : 0,
        allocationCount: item.count,
        expenseCount: expense ? expense.count : 0,
      };
    });

    // ============================================================
    // 11. PRODUCT SALES SUMMARY
    // ============================================================
    const productSaleFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { soldBy: staffId }),
      ...(Object.keys(dateFilter).length ? { invoiceDate: dateFilter } : {}),
    };

    const productSaleSummary = await ProductSale.aggregate([
      { $match: productSaleFilter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalPrice" },
          totalPaid: { $sum: "$totalPaidAmount" },
          totalCommission: { $sum: "$totalCommission" },
          totalRecords: { $sum: 1 },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
            },
          },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
          pendingPaymentCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // ============================================================
    // 12. MONTHLY PRODUCT SALES TREND
    // ============================================================
    const monthlyProductSales = await ProductSale.aggregate([
      { $match: productSaleFilter },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
          totalSales: { $sum: "$totalPrice" },
          totalPaid: { $sum: "$totalPaidAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // ============================================================
    // 13. RECENT BILLINGS (last 10)
    // ============================================================
    const recentBillings = await Billing.find(billingFilter)
      .populate("patientId", "firstName lastName email mobileNumber emrNumber")
      .populate("doctorId", "name email")
      .populate("invoicedById", "name email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // ============================================================
    // 14. PAYMENT METHOD BREAKDOWN
    // ============================================================
    const paymentMethodBreakdown = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // ============================================================
    // 15. STATUS BREAKDOWN
    // ============================================================
    const statusBreakdown = await Billing.aggregate([
      { $match: billingFilter },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // ============================================================
    // BUILD RESPONSE
    // ============================================================
    const billingData =
      billingSummary.length > 0
        ? billingSummary[0]
        : {
          totalAmount: 0,
          totalPaid: 0,
          totalPending: 0,
          totalAdvance: 0,
          count: 0,
        };

    const allocationData =
      allocationSummary.length > 0
        ? allocationSummary[0]
        : {
          totalAllocated: 0,
          totalAllocations: 0,
          averageAllocation: 0,
          minAllocation: 0,
          maxAllocation: 0,
        };

    const expenseData =
      expenseSummary.length > 0
        ? expenseSummary[0]
        : {
          totalSpent: 0,
          totalExpenses: 0,
          averageExpense: 0,
          minExpense: 0,
          maxExpense: 0,
          vendors: [],
          vendorNames: [],
        };

    const manualPettyCashData =
      manualPettyCashSummary.length > 0
        ? manualPettyCashSummary[0]
        : {
          totalAmount: 0,
          totalExpenses: 0,
          totalIncome: 0,
          totalRecords: 0,
          expenseCount: 0,
          incomeCount: 0,
          totalItems: 0,
        };

    const productSaleData =
      productSaleSummary.length > 0
        ? productSaleSummary[0]
        : {
          totalSales: 0,
          totalPaid: 0,
          totalCommission: 0,
          totalRecords: 0,
          completedCount: 0,
          pendingCount: 0,
          paidCount: 0,
          pendingPaymentCount: 0,
        };

    const totalAllocated = parseNumber(allocationData.totalAllocated);
    const totalSpent = parseNumber(expenseData.totalSpent);
    const totalBalance = totalAllocated - totalSpent;

    // Calculate total revenue including manual petty cash income
    const totalRevenue =
      billingData.totalPaid +
      productSaleData.totalPaid +
      manualPettyCashData.totalIncome;

    // Total expenses = Petty Cash Expenses + Manual Petty Cash Expenses
    const totalExpenses = totalSpent + manualPettyCashData.totalExpenses;

    const netBalance = totalRevenue - totalExpenses;
    const pendingDues =
      billingData.totalPending +
      (productSaleData.totalSales - productSaleData.totalPaid);

    // Format monthly data for charts
    const formatMonthlyData = (data, type) => {
      return data.map((item) => ({
        month: `${item._id.month}/${item._id.year}`,
        ...item,
      }));
    };

    return res.status(200).json({
      success: true,
      data: {
        billing: {
          totalAmount: billingData.totalAmount,
          totalPaid: billingData.totalPaid,
          totalPending: billingData.totalPending,
          totalAdvance: billingData.totalAdvance,
          count: billingData.count,
        },
        pettyCash: {
          // From PettyCashAllocation
          totalAllocated: totalAllocated,
          totalAllocations: allocationData.totalAllocations || 0,
          averageAllocation: parseNumber(allocationData.averageAllocation),
          minAllocation: parseNumber(allocationData.minAllocation),
          maxAllocation: parseNumber(allocationData.maxAllocation),

          // From PettyCashExpense (only usedFromPettyCash: true)
          totalSpent: totalSpent,
          totalExpenses: expenseData.totalExpenses || 0,
          averageExpense: parseNumber(expenseData.averageExpense),
          minExpense: parseNumber(expenseData.minExpense),
          maxExpense: parseNumber(expenseData.maxExpense),

          // Balance
          totalBalance: totalBalance,

          // Vendors
          uniqueVendors:
            expenseData.vendors?.filter((v) => v !== null).length || 0,
        },
        manualPettyCash: {
          totalAmount: manualPettyCashData.totalAmount,
          totalExpenses: manualPettyCashData.totalExpenses,
          totalIncome: manualPettyCashData.totalIncome,
          totalRecords: manualPettyCashData.totalRecords,
          expenseCount: manualPettyCashData.expenseCount,
          incomeCount: manualPettyCashData.incomeCount,
          totalItems: manualPettyCashData.totalItems,
        },
        productSales: {
          totalSales: productSaleData.totalSales,
          totalPaid: productSaleData.totalPaid,
          totalCommission: productSaleData.totalCommission,
          totalRecords: productSaleData.totalRecords,
          completedCount: productSaleData.completedCount,
          pendingCount: productSaleData.pendingCount,
          paidCount: productSaleData.paidCount,
          pendingPaymentCount: productSaleData.pendingPaymentCount,
        },
        overview: {
          totalRevenue,
          totalExpenses,
          netBalance,
          pendingDues,
        },
        charts: {
          monthlyBillingTrend: formatMonthlyData(
            monthlyBillingTrend,
            "billing",
          ),
          weeklyBillingTrend: weeklyBillingTrend,
          billingByService: billingByService,
          monthlyPettyCash: monthlyPettyCashData,
          monthlyManualPettyCash: formatMonthlyData(
            monthlyManualPettyCash,
            "manual",
          ),
          monthlyProductSales: formatMonthlyData(
            monthlyProductSales,
            "product",
          ),
          paymentMethodBreakdown: paymentMethodBreakdown,
          statusBreakdown: statusBreakdown,
        },
        recentBillings: recentBillings || [],
        recentPettyCashActivity: recentActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching overview data:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
