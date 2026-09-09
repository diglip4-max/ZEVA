// pages/api/finance/dashboard/what-changed.js
import { FinanceTransaction, FinancePayment } from "../../../../models/finance";
import { withDashboardAuth } from "../../../../lib/finance/dashboardAuth";
import {
  applyTransactionIdFilter,
  resolveTransactionIdsForMethod,
} from "../../../../lib/finance/dashboardFilters";

export default withDashboardAuth(async (req, res, { clinicId }) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query: req.query,
    FinancePayment,
  });
  const { supplierId } = req.query;
  const supplierFilter =
    supplierId && supplierId !== "all" ? { supplierId } : {};

  const baseMatch = applyTransactionIdFilter(
    { clinicId, entryType: "bill", ...supplierFilter },
    methodTransactionIds,
  );

  const [currentMonthCats, prevMonthCats] = await Promise.all([
    FinanceTransaction.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    FinanceTransaction.aggregate([
      {
        $match: {
          ...baseMatch,
          createdAt: { $gte: prevMonthStart, $lt: monthStart },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const prevMap = Object.fromEntries(
    prevMonthCats.map((c) => [c._id, c.amount]),
  );

  const whatChanged = currentMonthCats
    .map((c) => {
      const prev = prevMap[c._id] || 0;
      const change =
        prev > 0 ? ((c.amount - prev) / prev) * 100 : c.amount > 0 ? 100 : 0;
      return {
        label: c._id,
        change: Math.abs(Math.round(change)),
        up: change > 0,
        amount: c.amount,
      };
    })
    .filter((c) => c.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 4);

  return res.status(200).json({ success: true, data: whatChanged });
});
