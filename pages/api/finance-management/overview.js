// pages/api/finance-management/overview.js
//
// Finance Manager — Dashboard Overview
// Aggregates data ONLY from the Finance Manager's own domains:
//   Bills & Payables  -> FinanceTransaction (entryType: "bill")
//   Payment Center     -> FinancePayment
//   Cheque Manager      -> FinanceCheque
//   Bank Accounts        -> BankAccount
//   Petty Cash             -> PettyCashAllocation + PettyCashExpense
//
// Deliberately does NOT touch patient Billing / ProductSale — that belongs
// to a different module and was the source of the previous (wrong) overview.

import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Supplier from "../../../models/stocks/Supplier";
import {
  FinanceTransaction,
  FinancePayment,
  FinanceCheque,
  BankAccount,
} from "../../../models/finance";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value?.$numberDecimal) return parseFloat(value.$numberDecimal) || 0;
  if (value?._bsontype === "Decimal128")
    return parseFloat(value.toString()) || 0;
  return 0;
};

const monthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (!me) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
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

    // ---- resolve clinicId ----
    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic) {
        return res
          .status(400)
          .json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
      if (!me.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "User not tied to a clinic" });
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
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ---- date scaffolding ----
    const { startDate, endDate } = req.query;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // trend-chart window: explicit filter, else last 6 months
    const trendFrom = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const trendTo = endDate ? new Date(endDate) : now;

    // date range filter for breakdowns (only applied when user sets a filter)
    const hasDateFilter = !!(startDate || endDate);
    const dateRangeFilter = hasDateFilter
      ? { $gte: trendFrom, $lte: trendTo }
      : undefined;

    const clinicMatch = { clinicId };

    // ================================================================
    // 1. BILLS & PAYABLES  (FinanceTransaction, entryType: "bill")
    // ================================================================
    const billMatch = { ...clinicMatch, entryType: "bill" };
    // filtered bill match — applies date range to invoiceDate when user has selected a filter
    const billMatchFiltered = hasDateFilter
      ? { ...billMatch, invoiceDate: dateRangeFilter }
      : billMatch;

    const [billSummaryAgg] = await FinanceTransaction.aggregate([
      { $match: billMatchFiltered },
      {
        $group: {
          _id: null,
          totalBillsAmount: { $sum: "$amount" },
          totalPaidAmount: { $sum: "$paidAmount" },
          totalBills: { $sum: 1 },
          totalOutstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", ["paid", "cancelled"]] },
                0,
                { $subtract: ["$amount", "$paidAmount"] },
              ],
            },
          },
          overdueAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "overdue"] },
                { $subtract: ["$amount", "$paidAmount"] },
                0,
              ],
            },
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
          },
          upcomingAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "upcoming"] },
                { $subtract: ["$amount", "$paidAmount"] },
                0,
              ],
            },
          },
          upcomingCount: {
            $sum: { $cond: [{ $eq: ["$status", "upcoming"] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ["$status", "partial"] }, 1, 0] },
          },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        },
      },
    ]);

    const billSummary = billSummaryAgg || {
      totalBillsAmount: 0,
      totalPaidAmount: 0,
      totalBills: 0,
      totalOutstanding: 0,
      overdueAmount: 0,
      overdueCount: 0,
      upcomingAmount: 0,
      upcomingCount: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0,
    };

    const billStatusBreakdown = await FinanceTransaction.aggregate([
      { $match: billMatchFiltered },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const billCategoryBreakdown = await FinanceTransaction.aggregate([
      { $match: billMatchFiltered },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const monthlyBillTrend = await FinanceTransaction.aggregate([
      {
        $match: {
          ...billMatch,
          invoiceDate: { $gte: trendFrom, $lte: trendTo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
          billed: { $sum: "$amount" },
          paid: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // unpaid suppliers — grouped outstanding > 0
    const unpaidSupplierAgg = await FinanceTransaction.aggregate([
      {
        $match: {
          ...billMatchFiltered,
          status: { $nin: ["paid", "cancelled"] },
        },
      },
      {
        $group: {
          _id: "$supplierId",
          outstanding: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
          billCount: { $sum: 1 },
        },
      },
      { $match: { outstanding: { $gt: 0 } } },
      { $sort: { outstanding: -1 } },
      { $limit: 8 },
    ]);

    const supplierIds = unpaidSupplierAgg.map((s) => s._id).filter(Boolean);
    const suppliers = supplierIds.length
      ? await Supplier.find({ _id: { $in: supplierIds } })
          .select("name")
          .lean()
      : [];
    const supplierNameMap = Object.fromEntries(
      suppliers.map((s) => [s._id.toString(), s.name]),
    );

    const topUnpaidSuppliers = unpaidSupplierAgg.map((s) => ({
      supplierId: s._id,
      name: (s._id && supplierNameMap[s._id.toString()]) || "Unknown Supplier",
      outstanding: parseNumber(s.outstanding),
      billCount: s.billCount,
    }));

    const totalUnpaidSuppliers = await FinanceTransaction.aggregate([
      {
        $match: {
          ...billMatchFiltered,
          status: { $nin: ["paid", "cancelled"] },
        },
      },
      {
        $group: {
          _id: "$supplierId",
          outstanding: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        },
      },
      { $match: { outstanding: { $gt: 0 } } },
      { $count: "count" },
    ]);

    // ================================================================
    // 2. PAYMENT CENTER  (FinancePayment)
    // ================================================================
    const paymentMatch = { ...clinicMatch, reversed: false };
    const paymentMatchFiltered = hasDateFilter
      ? { ...paymentMatch, date: dateRangeFilter }
      : paymentMatch;

    const [paymentSummaryAgg] = await FinancePayment.aggregate([
      { $match: paymentMatchFiltered },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
          paidThisMonth: {
            $sum: { $cond: [{ $gte: ["$date", monthStart] }, "$amount", 0] },
          },
          paidThisYear: {
            $sum: { $cond: [{ $gte: ["$date", yearStart] }, "$amount", 0] },
          },
        },
      },
    ]);

    const paymentSummary = paymentSummaryAgg || {
      totalPaid: 0,
      totalPayments: 0,
      paidThisMonth: 0,
      paidThisYear: 0,
    };

    const paymentMethodBreakdown = await FinancePayment.aggregate([
      { $match: paymentMatchFiltered },
      {
        $group: {
          _id: "$method",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const monthlyPaymentTrend = await FinancePayment.aggregate([
      { $match: { ...paymentMatch, date: { $gte: trendFrom, $lte: trendTo } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // ================================================================
    // 3. CHEQUE MANAGER  (FinanceCheque)
    // ================================================================
    const chequeMatch = { ...clinicMatch };
    const chequeMatchFiltered = hasDateFilter
      ? { ...chequeMatch, chequeDate: dateRangeFilter }
      : chequeMatch;

    const [chequeSummaryAgg] = await FinanceCheque.aggregate([
      { $match: chequeMatchFiltered },
      {
        $group: {
          _id: null,
          totalCheques: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ["$status", ["issued", "presented"]] }, 1, 0],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["issued", "presented"]] },
                "$amount",
                0,
              ],
            },
          },
          clearedCount: {
            $sum: { $cond: [{ $eq: ["$status", "cleared"] }, 1, 0] },
          },
          clearedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "cleared"] }, "$amount", 0] },
          },
          bouncedCount: {
            $sum: {
              $cond: [{ $in: ["$status", ["bounced", "returned"]] }, 1, 0],
            },
          },
          bouncedAmount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["bounced", "returned"]] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const chequeSummary = chequeSummaryAgg || {
      totalCheques: 0,
      totalAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      clearedCount: 0,
      clearedAmount: 0,
      bouncedCount: 0,
      bouncedAmount: 0,
    };

    const chequeStatusBreakdown = await FinanceCheque.aggregate([
      { $match: chequeMatchFiltered },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const [upcomingChequeAgg] = await FinanceCheque.aggregate([
      {
        $match: {
          ...chequeMatch,
          status: { $in: ["issued", "presented"] },
          chequeDate: { $gte: now },
        },
      },
      {
        $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } },
      },
    ]);

    const upcomingCheques = await FinanceCheque.find({
      ...chequeMatch,
      status: { $in: ["issued", "presented"] },
      chequeDate: { $gte: now },
    })
      .sort({ chequeDate: 1 })
      .limit(5)
      .populate("supplierId", "name")
      .lean();

    // ================================================================
    // 4. BANK ACCOUNTS
    // ================================================================
    const bankAccounts = await BankAccount.find({
      ...clinicMatch,
      isActive: true,
    })
      .sort({ currentBalance: -1 })
      .lean();
    const totalBankBalance = bankAccounts.reduce(
      (sum, a) => sum + parseNumber(a.currentBalance),
      0,
    );

    // ================================================================
    // 5. PETTY CASH  (PettyCashAllocation + PettyCashExpense)
    // ================================================================
    const pettyCashClinicMatch = { clinicId, isVoided: { $ne: true } };

    const [allocationAgg] = await PettyCashAllocation.aggregate([
      { $match: pettyCashClinicMatch },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$amount" },
          totalAllocations: { $sum: 1 },
        },
      },
    ]);

    const pettyCashExpenseMatch = {
      clinicId,
      isVoided: { $ne: true },
      // usedFromPettyCash: true,
    };

    const [expenseAgg] = await PettyCashExpense.aggregate([
      { $match: pettyCashExpenseMatch },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$spentAmount" },
          totalExpenses: { $sum: 1 },
          spentThisMonth: {
            $sum: {
              $cond: [{ $gte: ["$date", monthStart] }, "$spentAmount", 0],
            },
          },
          spentThisYear: {
            $sum: {
              $cond: [{ $gte: ["$date", yearStart] }, "$spentAmount", 0],
            },
          },
        },
      },
    ]);

    const totalAllocated = parseNumber(allocationAgg?.totalAllocated);
    const totalSpentPettyCash = parseNumber(expenseAgg?.totalSpent);
    const pettyCashBalance = totalAllocated - totalSpentPettyCash;

    const monthlyPettyCashAllocated = await PettyCashAllocation.aggregate([
      {
        $match: {
          ...pettyCashClinicMatch,
          date: { $gte: trendFrom, $lte: trendTo },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          allocated: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyPettyCashSpent = await PettyCashExpense.aggregate([
      {
        $match: {
          ...pettyCashExpenseMatch,
          date: { $gte: trendFrom, $lte: trendTo },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          spent: { $sum: "$spentAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // merge petty cash monthly trend into one array
    const pettyCashMonthKeys = new Set([
      ...monthlyPettyCashAllocated.map((m) => `${m._id.year}-${m._id.month}`),
      ...monthlyPettyCashSpent.map((m) => `${m._id.year}-${m._id.month}`),
    ]);
    const monthlyPettyCashTrend = Array.from(pettyCashMonthKeys)
      .map((key) => {
        const [year, month] = key.split("-").map(Number);
        const alloc = monthlyPettyCashAllocated.find(
          (m) => m._id.year === year && m._id.month === month,
        );
        const spent = monthlyPettyCashSpent.find(
          (m) => m._id.year === year && m._id.month === month,
        );
        return {
          month: monthLabel(year, month),
          sortKey: year * 100 + month,
          allocated: parseNumber(alloc?.allocated),
          spent: parseNumber(spent?.spent),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...rest }) => rest);

    // ================================================================
    // 6. THIS MONTH / THIS YEAR EXPENSES  (bills paid + petty cash spent)
    // ================================================================
    const thisMonthExpenses =
      paymentSummary.paidThisMonth + parseNumber(expenseAgg?.spentThisMonth);
    const thisYearExpenses =
      paymentSummary.paidThisYear + parseNumber(expenseAgg?.spentThisYear);

    // ================================================================
    // 7. RECENT ACTIVITY  (bills + payments + cheques, merged timeline)
    // ================================================================
    const [recentBills, recentPayments, recentCheques] = await Promise.all([
      FinanceTransaction.find(billMatch)
        .populate("supplierId", "name")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      FinancePayment.find(paymentMatch)
        .populate("supplierId", "name")
        .populate("transactionId", "invoiceNumber category")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      FinanceCheque.find(chequeMatch)
        .populate("supplierId", "name")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const recentActivity = [
      ...recentBills.map((b) => ({
        type: "bill",
        id: b._id,
        title: b.invoiceNumber,
        subtitle: b.supplierId?.name || b.category || "Bill",
        amount: parseNumber(b.amount),
        status: b.status,
        date: b.createdAt,
        details: {
          invoiceNumber: b.invoiceNumber,
          supplierName: b.supplierId?.name || null,
          supplierInvoiceNumber: b.supplierInvoiceNumber || null,
          category: b.category || null,
          invoiceDate: b.invoiceDate || null,
          dueDate: b.dueDate || null,
          totalAmount: parseNumber(b.amount),
          paidAmount: parseNumber(b.paidAmount),
          balance: parseNumber(b.balance ?? b.amount - b.paidAmount),
          status: b.status,
          notes: b.notes || null,
          attachments: (b.attachments || []).length,
          createdAt: b.createdAt,
        },
      })),
      ...recentPayments.map((p) => ({
        type: "payment",
        id: p._id,
        title: p.paymentNumber,
        subtitle:
          p.supplierId?.name || p.transactionId?.invoiceNumber || "Payment",
        amount: parseNumber(p.amount),
        status: p.method,
        date: p.createdAt,
        details: {
          paymentNumber: p.paymentNumber,
          supplierName: p.supplierId?.name || null,
          billInvoiceNumber: p.transactionId?.invoiceNumber || null,
          billCategory: p.transactionId?.category || null,
          amount: parseNumber(p.amount),
          paymentDate: p.date || null,
          method: p.method,
          hasAttachment: !!p.attachment,
          notes: p.notes || null,
          reversed: !!p.reversed,
          createdAt: p.createdAt,
        },
      })),
      ...recentCheques.map((c) => ({
        type: "cheque",
        id: c._id,
        title: c.chequeNumber,
        subtitle: c.supplierId?.name || c.payee || "Cheque",
        amount: parseNumber(c.amount),
        status: c.status,
        date: c.createdAt,
        details: {
          chequeNumber: c.chequeNumber,
          supplierName: c.supplierId?.name || null,
          payee: c.payee || null,
          bank: c.bank || null,
          amount: parseNumber(c.amount),
          chequeDate: c.chequeDate || null,
          status: c.status,
          createdAt: c.createdAt,
        },
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // ================================================================
    // RESPONSE
    // ================================================================
    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          outstandingBills: {
            amount: parseNumber(billSummary.totalOutstanding),
            count: billSummary.totalBills - billSummary.paidCount,
          },
          overdueBills: {
            amount: parseNumber(billSummary.overdueAmount),
            count: billSummary.overdueCount,
          },
          upcomingBills: {
            amount: parseNumber(billSummary.upcomingAmount),
            count: billSummary.upcomingCount,
          },
          upcomingCheques: {
            amount: parseNumber(upcomingChequeAgg?.amount),
            count: upcomingChequeAgg?.count || 0,
          },
          pettyCashBalance,
          bankBalance: totalBankBalance,
          thisMonthExpenses,
          thisYearExpenses,
          unpaidSuppliers: totalUnpaidSuppliers[0]?.count || 0,
          totalPaidAllTime: parseNumber(paymentSummary.totalPaid),
          totalPaidThisMonth: parseNumber(paymentSummary.paidThisMonth),
          totalPaidThisYear: parseNumber(paymentSummary.paidThisYear),
        },
        bills: {
          totalBillsAmount: parseNumber(billSummary.totalBillsAmount),
          totalPaidAmount: parseNumber(billSummary.totalPaidAmount),
          totalBills: billSummary.totalBills,
          totalOutstanding: parseNumber(billSummary.totalOutstanding),
          statusBreakdown: billStatusBreakdown.map((s) => ({
            status: s._id || "unknown",
            count: s.count,
            amount: parseNumber(s.amount),
          })),
          categoryBreakdown: billCategoryBreakdown.map((c) => ({
            category: c._id,
            amount: parseNumber(c.amount),
            count: c.count,
          })),
          monthlyTrend: monthlyBillTrend.map((m) => ({
            month: monthLabel(m._id.year, m._id.month),
            billed: parseNumber(m.billed),
            paid: parseNumber(m.paid),
            count: m.count,
          })),
        },
        payments: {
          totalPaid: parseNumber(paymentSummary.totalPaid),
          totalPayments: paymentSummary.totalPayments,
          avgPayment: paymentSummary.totalPayments
            ? paymentSummary.totalPaid / paymentSummary.totalPayments
            : 0,
          methodBreakdown: paymentMethodBreakdown.map((m) => ({
            method: m._id || "unknown",
            amount: parseNumber(m.amount),
            count: m.count,
          })),
          monthlyTrend: monthlyPaymentTrend.map((m) => ({
            month: monthLabel(m._id.year, m._id.month),
            amount: parseNumber(m.amount),
            count: m.count,
          })),
        },
        cheques: {
          totalCheques: chequeSummary.totalCheques,
          totalAmount: parseNumber(chequeSummary.totalAmount),
          pendingCount: chequeSummary.pendingCount,
          pendingAmount: parseNumber(chequeSummary.pendingAmount),
          clearedCount: chequeSummary.clearedCount,
          clearedAmount: parseNumber(chequeSummary.clearedAmount),
          bouncedCount: chequeSummary.bouncedCount,
          bouncedAmount: parseNumber(chequeSummary.bouncedAmount),
          statusBreakdown: chequeStatusBreakdown.map((s) => ({
            status: s._id || "unknown",
            count: s.count,
            amount: parseNumber(s.amount),
          })),
          upcoming: upcomingCheques.map((c) => ({
            _id: c._id,
            chequeNumber: c.chequeNumber,
            payee: c.supplierId?.name || c.payee,
            bank: c.bank,
            amount: parseNumber(c.amount),
            chequeDate: c.chequeDate,
            status: c.status,
          })),
        },
        bankAccounts: {
          totalBalance: totalBankBalance,
          accounts: bankAccounts.map((a) => ({
            _id: a._id,
            bankName: a.bankName,
            accountName: a.accountName,
            accountNumber: a.accountNumber,
            currentBalance: parseNumber(a.currentBalance),
          })),
        },
        pettyCash: {
          totalAllocated,
          totalSpent: totalSpentPettyCash,
          balance: pettyCashBalance,
          monthlyTrend: monthlyPettyCashTrend,
        },
        topUnpaidSuppliers,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching finance overview:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}
