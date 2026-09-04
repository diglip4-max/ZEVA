// pages/api/finance/dashboard/insights.js
import {
  FinanceTransaction,
  FinanceCheque,
  FinancePayment,
} from "../../../../models/finance";
import {
  withDashboardAuth,
  parseNumber,
} from "../../../../lib/finance/dashboardAuth";
import {
  buildDueMatch,
  resolveTransactionIdsForMethod,
} from "../../../../lib/finance/dashboardFilters";

export default withDashboardAuth(async (req, res, { clinicId, currency }) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query: req.query,
    FinancePayment,
  });
  const dueMatch = buildDueMatch({
    clinicId,
    query: req.query,
    transactionIds: methodTransactionIds,
  });
  const { supplierId } = req.query;
  const supplierFilter =
    supplierId && supplierId !== "all" ? { supplierId } : {};

  // Overdue
  const [overdueAgg] = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch, entryType: "bill", status: "overdue" } },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);
  const overdueAmount = parseNumber(overdueAgg?.total || 0);
  const overdueCount = overdueAgg?.count || 0;

  // Upcoming
  const [upcomingAgg] = await FinanceTransaction.aggregate([
    {
      $match: {
        ...dueMatch,
        entryType: "bill",
        status: { $in: ["upcoming", "pending"] },
        dueDate: { $gte: now, $lte: in30Days },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
      },
    },
  ]);
  const upcomingAmount = parseNumber(upcomingAgg?.total || 0);

  // Medical purchases trend (category filter, if set, is respected via req.query.category)
  const { category } = req.query;
  const medicalCategory =
    category && category !== "all" ? category : "Medical Purchase";

  const [currentMedical, prevMedical] = await Promise.all([
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          category: medicalCategory,
          createdAt: { $gte: monthStart },
          ...supplierFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          category: medicalCategory,
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            $lt: monthStart,
          },
          ...supplierFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const currentMed = parseNumber(currentMedical?.[0]?.total || 0);
  const prevMed = parseNumber(prevMedical?.[0]?.total || 0);
  const medChange =
    prevMed > 0 ? Math.round(((currentMed - prevMed) / prevMed) * 100) : 0;

  // Rent percentage
  const [rentAgg, totalSpent] = await Promise.all([
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          category: "Rent",
          createdAt: { $gte: monthStart },
          ...supplierFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          createdAt: { $gte: monthStart },
          ...supplierFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const rentAmount = parseNumber(rentAgg?.[0]?.total || 0);
  const totalSpentAmount = parseNumber(totalSpent?.[0]?.total || 0);
  const rentPct =
    totalSpentAmount > 0
      ? Math.round((rentAmount / totalSpentAmount) * 100)
      : 0;

  // Upcoming cheques count / exposure (skipped if method filter excludes cheque)
  const { method } = req.query;
  const chequesApplicable = !method || method === "all" || method === "cheque";
  let upcomingChequesCount = 0;
  let chequeExposureTotal = 0;
  if (chequesApplicable) {
    upcomingChequesCount = await FinanceCheque.countDocuments({
      clinicId,
      status: { $in: ["issued", "presented"] },
      chequeDate: { $gte: now },
      ...supplierFilter,
    });

    const [chequeExposure] = await FinanceCheque.aggregate([
      {
        $match: {
          clinicId,
          status: { $in: ["issued", "presented"] },
          ...supplierFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    chequeExposureTotal = parseNumber(chequeExposure?.total || 0);
  }

  const insights = [
    `Medical purchases are ${medChange}% higher than last month.`,
    `${currency} ${(overdueAmount / 1000).toFixed(1)}K is currently overdue across ${overdueCount} bills.`,
    `${currency} ${(upcomingAmount / 1000).toFixed(1)}K is due within the next 30 days.`,
    `Rent represents ${rentPct}% of monthly spending.`,
    `${upcomingChequesCount} recurring payments are due this week.`,
    `Cheque exposure is ${currency} ${(chequeExposureTotal / 1000).toFixed(1)}K.`,
  ];

  return res.status(200).json({ success: true, data: insights });
});
