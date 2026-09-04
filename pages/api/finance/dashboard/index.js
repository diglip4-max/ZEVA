// pages/api/finance/dashboard/index.js
import {
  FinanceTransaction,
  FinancePayment,
  FinanceCheque,
  BankAccount,
} from "../../../../models/finance";
import {
  withDashboardAuth,
  parseNumber,
} from "../../../../lib/finance/dashboardAuth";
import {
  resolveDateRange,
  buildDueMatch,
  buildCreatedMatch,
  resolveTransactionIdsForMethod,
} from "../../../../lib/finance/dashboardFilters";
import Supplier from "../../../../models/stocks/Supplier";
import { getPettyCashBreakdown } from "../../../../lib/finance/pettyCash";

export default withDashboardAuth(async (req, res, { clinicId, currency }) => {
  const now = new Date();
  const { start: rangeStart, end: rangeEnd } = resolveDateRange(req.query);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Payment-method filter resolves to a set of transaction ids once, reused
  // across every expense-side aggregate below.
  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query: req.query,
    FinancePayment,
  });

  const createdMatch = (restrictByMethod = false) =>
    buildCreatedMatch({
      clinicId,
      query: req.query,
      transactionIds: methodTransactionIds,
      restrictByMethod,
    });
  const dueMatch = () =>
    buildDueMatch({
      clinicId,
      query: req.query,
      transactionIds: methodTransactionIds,
    });

  // --- Signal Stats ---
  const [incomeAgg] = await FinanceTransaction.aggregate([
    { $match: { ...createdMatch(), type: "income" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [spentAgg] = await FinanceTransaction.aggregate([
    { $match: { ...createdMatch(true), type: "expense", entryType: "bill" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [outstandingAgg] = await FinanceTransaction.aggregate([
    {
      $match: {
        ...dueMatch(),
        entryType: "bill",
        status: { $nin: ["paid", "cancelled"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const [overdueAgg] = await FinanceTransaction.aggregate([
    {
      $match: {
        ...dueMatch(),
        entryType: "bill",
        $expr: {
          $and: [
            { $lt: ["$dueDate", new Date()] },
            { $not: { $in: ["$status", ["paid", "cancelled"]] } },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const [upcomingAgg] = await FinanceTransaction.aggregate([
    {
      $match: {
        ...dueMatch(),
        entryType: "bill",
        status: { $in: ["upcoming", "pending"] },
        dueDate: { $gte: now, $lte: in30Days },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  // --- Bank + Petty Cash (allocations + expenses + manual entries) ---
  const bankAccounts = await BankAccount.find({
    clinicId,
    isActive: true,
  }).lean();
  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + parseNumber(a.currentBalance),
    0,
  );

  const pettyCash = await getPettyCashBreakdown({ clinicId });
  const pettyCashBalance = pettyCash.balance;

  // Period-scoped petty cash movement, so "Money Received" / "Money Spent"
  // reflect manual petty cash entries too, not just billed transactions.
  const pettyCashPeriod = await getPettyCashBreakdown({
    clinicId,
    dateRange:
      rangeStart || rangeEnd ? { $gte: rangeStart, $lte: rangeEnd } : null,
  });

  const moneyReceived =
    parseNumber(incomeAgg?.total || 0) + pettyCashPeriod.receivedIntoPettyCash;
  const moneySpent =
    parseNumber(spentAgg?.total || 0) + pettyCashPeriod.spentFromPettyCash;
  const outstandingBills = parseNumber(outstandingAgg?.total || 0);
  const overdueAmount = parseNumber(overdueAgg?.total || 0);
  const overdueCount = overdueAgg?.count || 0;
  const upcomingAmount = parseNumber(upcomingAgg?.total || 0);
  const upcomingCount = upcomingAgg?.count || 0;
  const availableCash = totalBankBalance + pettyCashBalance;

  // --- Trends (previous month vs current filtered period) ---
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [prevIncome] = await FinanceTransaction.aggregate([
    {
      $match: {
        clinicId,
        type: "income",
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [prevSpent] = await FinanceTransaction.aggregate([
    {
      $match: {
        clinicId,
        type: "expense",
        entryType: "bill",
        createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const prevIncomeAmt = parseNumber(prevIncome?.total || 0);
  const prevSpentAmt = parseNumber(prevSpent?.total || 0);

  const incomeTrend =
    prevIncomeAmt > 0
      ? ((moneyReceived - prevIncomeAmt) / prevIncomeAmt) * 100
      : 0;
  const spentTrend =
    prevSpentAmt > 0 ? ((moneySpent - prevSpentAmt) / prevSpentAmt) * 100 : 0;

  // --- Financial Position ---
  const cashCoverage =
    upcomingAmount > 0
      ? Math.round((availableCash / upcomingAmount) * 100)
      : 999;

  let positionStatus = "healthy";
  let positionHeadline = "Financial Position — Healthy";
  let positionDescription = "All bills are on schedule.";

  if (overdueAmount > 20000) {
    positionStatus = "critical";
    positionHeadline = "Financial Position — Critical";
    positionDescription = `${currency} ${(overdueAmount / 1000).toFixed(1)}K overdue across ${overdueCount} supplier bills.`;
  } else if (overdueAmount > 5000 || upcomingAmount > 50000) {
    positionStatus = "warn";
    positionHeadline = "Financial Position — Needs Attention";
    positionDescription = `${currency} ${(overdueAmount / 1000).toFixed(1)}K overdue, ${currency} ${(upcomingAmount / 1000).toFixed(1)}K due soon.`;
  }

  // --- Recent Bills (respects category / supplier / method / date filters) ---
  const recentBills = await FinanceTransaction.find({
    ...dueMatch(),
    entryType: "bill",
  })
    .populate("supplierId", "name")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const billsData = recentBills.map((b) => ({
    id: b.invoiceNumber,
    supplier: b.supplierId?.name || "Unknown",
    amount: parseNumber(b.amount),
    paid: parseNumber(b.paidAmount),
    dueDate: b.dueDate,
    status: b.status,
    category: b.category || "Uncategorized",
  }));

  const [overdueAgingAgg] = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch(), entryType: "bill", status: "overdue" } },
    {
      $group: {
        _id: null,
        d1to7: {
          $sum: {
            $cond: [
              {
                $gte: [
                  "$dueDate",
                  new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                ],
              },
              { $subtract: ["$amount", "$paidAmount"] },
              0,
            ],
          },
        },
        d8to30: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $lt: [
                      "$dueDate",
                      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                  {
                    $gte: [
                      "$dueDate",
                      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                    ],
                  },
                ],
              },
              { $subtract: ["$amount", "$paidAmount"] },
              0,
            ],
          },
        },
        d31plus: {
          $sum: {
            $cond: [
              {
                $lt: [
                  "$dueDate",
                  new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                ],
              },
              { $subtract: ["$amount", "$paidAmount"] },
              0,
            ],
          },
        },
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const [highestRiskSupplierAgg] = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch(), entryType: "bill", status: "overdue" } },
    {
      $group: {
        _id: "$supplierId",
        amount: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: 1 },
  ]);

  let highestRiskSupplier = null;
  if (highestRiskSupplierAgg?.length > 0) {
    const supplierId = highestRiskSupplierAgg[0]._id;
    if (supplierId) {
      try {
        const Supplier = (await import("../../../../models/stocks/Supplier"))
          .default;
        const sup = await Supplier.findById(supplierId).select("name").lean();
        highestRiskSupplier = {
          name: sup?.name || "Unknown Supplier",
          amount: parseNumber(highestRiskSupplierAgg[0].amount),
        };
      } catch {
        highestRiskSupplier = {
          name: "Unknown Supplier",
          amount: parseNumber(highestRiskSupplierAgg[0].amount),
        };
      }
    }
  }

  // --- Cheque Summary (date + supplier filters; no category/method — a
  // cheque IS a payment method, so a method filter that excludes "cheque"
  // zeroes this section out, which is the expected behaviour). ---
  const { method } = req.query;
  const chequesApplicable = !method || method === "all" || method === "cheque";

  let chequeSummary = null;
  let upcomingCheques = [];
  if (chequesApplicable) {
    const chequeDateMatch = {};
    if (rangeStart || rangeEnd) {
      chequeDateMatch.chequeDate = {};
      if (rangeStart) chequeDateMatch.chequeDate.$gte = rangeStart;
      if (rangeEnd) chequeDateMatch.chequeDate.$lte = rangeEnd;
    }
    const supplierMatch =
      req.query.supplierId && req.query.supplierId !== "all"
        ? { supplierId: req.query.supplierId }
        : {};

    [chequeSummary] = await FinanceCheque.aggregate([
      { $match: { clinicId, ...chequeDateMatch, ...supplierMatch } },
      {
        $group: {
          _id: null,
          issued: {
            $sum: { $cond: [{ $eq: ["$status", "issued"] }, "$amount", 0] },
          },
          presented: {
            $sum: { $cond: [{ $eq: ["$status", "presented"] }, "$amount", 0] },
          },
          cleared: {
            $sum: { $cond: [{ $eq: ["$status", "cleared"] }, "$amount", 0] },
          },
        },
      },
    ]);

    upcomingCheques = await FinanceCheque.find({
      clinicId,
      status: { $in: ["issued", "presented"] },
      chequeDate: { $gte: now },
      ...supplierMatch,
    })
      .populate("supplierId", "name")
      .sort({ chequeDate: 1 })
      .limit(3)
      .lean();
  }

  return res.status(200).json({
    success: true,
    data: {
      currency,
      appliedFilters: {
        period: req.query.period || "thisMonth",
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        category: req.query.category || "all",
        supplierId: req.query.supplierId || "all",
        method: req.query.method || "all",
      },
      signalStats: {
        moneyReceived,
        moneySpent,
        moneyReceivedTrend: Math.round(incomeTrend * 10) / 10,
        moneySpentTrend: Math.round(spentTrend * 10) / 10,
        outstandingBills,
        outstandingCount: outstandingAgg?.count || 0,
        overdue: overdueAmount,
        overdueCount,
        upcoming: upcomingAmount,
        upcomingCount,
        availableCash,
      },
      financialPosition: {
        cashCoverage: cashCoverage > 999 ? 999 : cashCoverage,
        status: positionStatus,
        headline: positionHeadline,
        description: positionDescription,
        reasons: [
          `${currency} ${(overdueAmount / 1000).toFixed(1)}K overdue across ${overdueCount} supplier bills.`,
          `${currency} ${(upcomingAmount / 1000).toFixed(1)}K due within the next 30 days.`,
        ],
      },
      bills: billsData,
      cheques: {
        issued: parseNumber(chequeSummary?.issued || 0),
        presented: parseNumber(chequeSummary?.presented || 0),
        cleared: parseNumber(chequeSummary?.cleared || 0),
        upcoming: upcomingCheques.map((c) => ({
          number: c.chequeNumber,
          payee: c.supplierId?.name || c.payee,
          amount: parseNumber(c.amount),
          status: c.status,
        })),
      },
      bankAccounts: bankAccounts.map((a) => ({
        name: a.bankName,
        amount: parseNumber(a.currentBalance),
        manual: true,
      })),
      pettyCash: {
        balance: pettyCashBalance,
        allocated: pettyCash.allocated,
        spentFromAllocations: pettyCash.spentFromAllocations,
        manualIncome: pettyCash.manualIncome,
        manualExpense: pettyCash.manualExpense,
      },
      cashPosition: {
        bankAccounts: bankAccounts.map((a) => ({
          name: a.bankName,
          balance: parseNumber(a.currentBalance),
        })),
        pettyCash: pettyCashBalance,
        totalAvailable: availableCash,
        upcomingObligations: upcomingAmount,
        availableAfterObligations: availableCash - upcomingAmount,
      },
      overdueAging: {
        d1to7: parseNumber(overdueAgingAgg?.d1to7 || 0),
        d8to30: parseNumber(overdueAgingAgg?.d8to30 || 0),
        d31plus: parseNumber(overdueAgingAgg?.d31plus || 0),
        total: parseNumber(overdueAgingAgg?.total || 0),
        count: overdueAgingAgg?.count || 0,
        highestRisk: highestRiskSupplier,
      },
    },
  });
});
