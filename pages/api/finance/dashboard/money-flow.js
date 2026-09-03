// pages/api/finance/dashboard/money-flow.js
import { FinanceTransaction, FinancePayment } from "../../../../models/finance";
import {
  withDashboardAuth,
  parseNumber,
} from "../../../../lib/finance/dashboardAuth";
import {
  buildCreatedMatch,
  resolveTransactionIdsForMethod,
} from "../../../../lib/finance/dashboardFilters";
import { getPettyCashBreakdown } from "../../../../lib/finance/pettyCash";

export default withDashboardAuth(async (req, res, { clinicId, currency }) => {
  // `period` here doubles as both the quick-range preset (daily/weekly/
  // monthly/yearly used by the Money Flow tabs) and the shared dashboard
  // filter. If the client sends one of the legacy Money Flow tab values,
  // translate it to the shared filter vocabulary.
  const legacyPeriodMap = {
    daily: "today",
    weekly: "last7",
    monthly: "thisMonth",
    yearly: "thisYear",
  };
  const query = { ...req.query };
  if (legacyPeriodMap[query.period])
    query.period = legacyPeriodMap[query.period];

  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query,
    FinancePayment,
  });

  const incomeMatch = buildCreatedMatch({
    clinicId,
    query,
    transactionIds: methodTransactionIds,
  });
  const expenseMatch = buildCreatedMatch({
    clinicId,
    query,
    transactionIds: methodTransactionIds,
    restrictByMethod: true,
  });

  const [income] = await FinanceTransaction.aggregate([
    { $match: { ...incomeMatch, type: "income" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [spent] = await FinanceTransaction.aggregate([
    { $match: { ...expenseMatch, type: "expense", entryType: "bill" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  // Fold in manual petty cash movement for the same window so "Received"/
  // "Spent" match the signal cards on the main dashboard.
  const { resolveDateRange } =
    await import("../../../../lib/finance/dashboardFilters");
  const { start, end } = resolveDateRange(query);
  const pettyCashPeriod = await getPettyCashBreakdown({
    clinicId,
    dateRange: start || end ? { $gte: start, $lte: end } : null,
  });

  const received =
    parseNumber(income?.total || 0) + pettyCashPeriod.receivedIntoPettyCash;
  const spentAmount =
    parseNumber(spent?.total || 0) + pettyCashPeriod.spentFromPettyCash;
  const total = received + spentAmount;

  return res.status(200).json({
    success: true,
    data: {
      currency,
      received,
      spent: spentAmount,
      net: received - spentAmount,
      receivedPct: total > 0 ? Math.round((received / total) * 100) : 0,
      spentPct: total > 0 ? Math.round((spentAmount / total) * 100) : 0,
    },
  });
});
