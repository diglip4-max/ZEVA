// pages/api/finance-management/overview.js
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Billing from "../../../models/Billing";
import PettyCash from "../../../models/PettyCash";
import ManualPettyCash from "../../../models/ManualPettyCash";
import ProductSale from "../../../models/stocks/ProductSale";
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
      ...(me.role === "clinic" ? {} : {}),
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

    console.log({ billingFilter, dateFilter });

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
    // 5. PETTY CASH SUMMARY
    // ============================================================
    const pettyCashFilter = {
      ...baseFilter,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      ...(me.role === "clinic" ? {} : { staffId }),
    };

    console.log({ pettyCashFilter, dateFilter });

    const pettyCashSummary = await PettyCash.aggregate([
      { $match: pettyCashFilter },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$totalAllocated" },
          totalSpent: { $sum: "$totalSpent" },
          totalBalance: { $sum: "$totalAmount" },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const globalPettyCash = await PettyCash.getGlobalAmounts(clinicId);

    // ============================================================
    // 6. MANUAL PETTY CASH SUMMARY
    // ============================================================
    const manualPettyCashFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { addedBy: staffId }),
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    console.log({ manualPettyCashFilter, dateFilter });

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
    // 7. MONTHLY MANUAL PETTY CASH TREND
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
    // 8. PRODUCT SALES SUMMARY
    // ============================================================
    const productSaleFilter = {
      ...baseFilter,
      ...(me.role === "clinic" ? {} : { soldBy: staffId }),
      ...(dateFilter.invoiceDate ? { invoiceDate: dateFilter } : {}),
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
    // 9. MONTHLY PRODUCT SALES TREND
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
    // 10. RECENT BILLINGS (last 10)
    // ============================================================
    const recentBillings = await Billing.find(billingFilter)
      .populate("patientId", "firstName lastName email mobileNumber emrNumber")
      .populate("doctorId", "name email")
      .populate("invoicedById", "name email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // ============================================================
    // 11. PAYMENT METHOD BREAKDOWN
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
    // 12. STATUS BREAKDOWN
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

    const pettyCashData =
      pettyCashSummary.length > 0
        ? pettyCashSummary[0]
        : {
            totalAllocated: 0,
            totalSpent: 0,
            totalBalance: 0,
            totalRecords: 0,
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

    const totalRevenue =
      billingData.totalPaid +
      productSaleData.totalPaid +
      manualPettyCashData.totalIncome;
    const totalExpenses =
      pettyCashData.totalSpent + manualPettyCashData.totalExpenses;
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
          totalAllocated: pettyCashData.totalAllocated,
          totalSpent: pettyCashData.totalSpent,
          totalBalance: pettyCashData.totalBalance,
          totalRecords: pettyCashData.totalRecords,
          globalTotalAmount: globalPettyCash.globalTotalAmount || 0,
          globalSpentAmount: globalPettyCash.globalSpentAmount || 0,
          globalRemainingAmount: globalPettyCash.globalRemainingAmount || 0,
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
      },
    });
  } catch (error) {
    console.error("Error fetching overview data:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
