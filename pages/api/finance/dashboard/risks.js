// pages/api/finance/dashboard/risks.js
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

export default withDashboardAuth(async (req, res, { clinicId }) => {
  const now = new Date();
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
  const { supplierId, method } = req.query;
  const supplierFilter =
    supplierId && supplierId !== "all" ? { supplierId } : {};
  const chequesApplicable = !method || method === "all" || method === "cheque";

  // Overdue bills
  const [overdueAgg] = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch, entryType: "bill", status: "overdue" } },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
      },
    },
  ]);
  const overdueAmount = parseNumber(overdueAgg?.total || 0);

  // Cheque exposure
  let chequeAmount = 0;
  if (chequesApplicable) {
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
    chequeAmount = parseNumber(chequeExposure?.total || 0);
  }

  // Upcoming commitments
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

  // Unusual expense increase (current month vs previous month, filters applied)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { category } = req.query;
  const categoryFilter = category && category !== "all" ? { category } : {};

  const [currentMonth, prevMonth] = await Promise.all([
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          createdAt: { $gte: monthStart },
          ...supplierFilter,
          ...categoryFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: "bill",
          createdAt: { $gte: prevMonthStart, $lt: monthStart },
          ...supplierFilter,
          ...categoryFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const currentTotal = parseNumber(currentMonth?.[0]?.total || 0);
  const prevTotal = parseNumber(prevMonth?.[0]?.total || 0);
  const unusualIncrease = Math.max(0, currentTotal - prevTotal);

  let status = "Healthy";
  let riskLevel = "low";

  if (overdueAmount > 20000) {
    status = "Critical";
    riskLevel = "critical";
  } else if (overdueAmount > 5000 || chequeAmount > 50000) {
    status = "Needs Attention";
    riskLevel = "warn";
  }

  const items = [
    { label: "Overdue bills", amount: overdueAmount },
    { label: "Cheque exposure", amount: chequeAmount },
    { label: "Upcoming commitments", amount: upcomingAmount },
    { label: "Unusual expense increase", amount: unusualIncrease },
  ];

  return res.status(200).json({
    success: true,
    data: { status: `Financial Control: ${status}`, riskLevel, items },
  });
});
