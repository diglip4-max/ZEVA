// pages/api/finance/dashboard/pressure.js
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
  const { supplierId, method, category } = req.query;
  const supplierFilter =
    supplierId && supplierId !== "all" ? { supplierId } : {};
  const categoryFilter = category && category !== "all" ? { category } : {};
  const chequesApplicable = !method || method === "all" || method === "cheque";

  // Known outstanding
  const [outstandingAgg] = await FinanceTransaction.aggregate([
    {
      $match: {
        ...dueMatch,
        entryType: "bill",
        status: { $nin: ["paid", "cancelled"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
      },
    },
  ]);
  const knownOutstanding = parseNumber(outstandingAgg?.total || 0);

  // Upcoming obligations (next 30 days)
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
  const upcomingObligations = parseNumber(upcomingAgg?.total || 0);

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

  // Expected payments (last month's billed amount * 1.2), filters applied
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [lastMonthPayments] = await FinanceTransaction.aggregate([
    {
      $match: {
        clinicId,
        type: "expense",
        entryType: "bill",
        createdAt: { $gte: monthStart, $lte: monthEnd },
        ...supplierFilter,
        ...categoryFilter,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const avgMonthly = parseNumber(lastMonthPayments?.total || 0);
  const expectedPayments = Math.round(avgMonthly * 1.2);

  // Recurring obligations (rent + utilities + software + maintenance).
  // TODO: replace this fixed figure with a real aggregation over recurring
  // bill categories once those are consistently tagged; kept as-is to match
  // existing behaviour while filters are layered on top of everything else.
  const recurringObligations = 26000 + 950 + 150 + 4200 + 8500; // 39,800

  // Potential pressure = upcoming obligations + overdue + cheque exposure
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
  const potential = upcomingObligations + overdueAmount + chequeAmount;

  return res.status(200).json({
    success: true,
    data: {
      expectedPayments,
      recurringObligations,
      knownOutstanding,
      potential,
      note: "Recurring rent and government renewal both land within the next 30 days — the main driver of the projected pressure.",
    },
  });
});
