// pages/api/finance/dashboard/expense-trend.js
//
// Supports ?mode=bills|expenses|payments (default "bills") so the
// Expenses / Payments / Bills tabs on the dashboard actually show
// different data instead of all rendering the same series.
import { FinanceTransaction, FinancePayment } from "../../../../models/finance";
import {
  withDashboardAuth,
  parseNumber,
} from "../../../../lib/finance/dashboardAuth";
import {
  buildBaseMatch,
  resolveTransactionIdsForMethod,
  applyTransactionIdFilter,
} from "../../../../lib/finance/dashboardFilters";

const monthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });

export default withDashboardAuth(async (req, res, { clinicId, currency }) => {
  const now = new Date();
  const months = [];
  const values = [];

  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query: req.query,
    FinancePayment,
  });

  // Trend is always the trailing 6 months, but category / supplier / method
  // filters still narrow which bills/payments are counted in each month.
  const { category, supplierId, mode = "bills" } = req.query;
  const { method } = req.query;

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    let total = 0;

    if (mode === "payments") {
      // Actual money paid out, regardless of which bill it settles —
      // sourced from FinancePayment, not FinanceTransaction.
      const supplierFilter =
        supplierId && supplierId !== "all" ? { supplierId } : {};
      const methodFilter = method && method !== "all" ? { method } : {};
      const [agg] = await FinancePayment.aggregate([
        {
          $match: {
            clinicId,
            reversed: { $ne: true },
            date: { $gte: start, $lt: end },
            ...supplierFilter,
            ...methodFilter,
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      total = parseNumber(agg?.total || 0);
    } else {
      // "expenses" -> entryType "expense" (direct/petty-cash style entries)
      // "bills" (default) -> entryType "bill" (supplier invoices)
      const entryType = mode === "expenses" ? "expense" : "bill";
      const baseMatch = applyTransactionIdFilter(
        buildBaseMatch({
          clinicId,
          query: { category, supplierId, period: "custom" },
          dateField: "createdAt",
        }),
        methodTransactionIds,
      );
      // buildBaseMatch with period=custom and no startDate/endDate yields no
      // date filter, so set the month window explicitly here instead.
      delete baseMatch.createdAt;

      const [agg] = await FinanceTransaction.aggregate([
        {
          $match: {
            ...baseMatch,
            entryType,
            createdAt: { $gte: start, $lt: end },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      total = parseNumber(agg?.total || 0);
    }

    months.push(monthLabel(d.getFullYear(), d.getMonth()));
    values.push(total);
  }

  let note = "No data available";
  if (
    values.length >= 2 &&
    values[values.length - 1] > 0 &&
    values[values.length - 2] > 0
  ) {
    const change =
      ((values[values.length - 1] - values[values.length - 2]) /
        values[values.length - 2]) *
      100;
    note = `${months[months.length - 1]} spending is ${Math.round(change)}% above ${months[months.length - 2]}.`;
  }

  return res.status(200).json({
    success: true,
    data: { currency, months, values, note, mode },
  });
});
