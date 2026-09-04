// pages/api/finance/dashboard/filters-meta.js
//
// Populates the dashboard filter bar: categories + suppliers actually used
// by this clinic, plus the fixed list of payment methods.

import { withDashboardAuth } from "../../../../lib/finance/dashboardAuth";
import { FinanceTransaction } from "../../../../models/finance";

export default withDashboardAuth(async (req, res, { clinicId }) => {
  const [categories, suppliers] = await Promise.all([
    FinanceTransaction.distinct("category", {
      clinicId,
      category: { $nin: [null, ""] },
    }),
    (async () => {
      try {
        const Supplier = (await import("../../../../models/stocks/Supplier"))
          .default;
        return await Supplier.find({ clinicId })
          .select("name")
          .sort({ name: 1 })
          .limit(200)
          .lean();
      } catch {
        return [];
      }
    })(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      categories: categories.filter(Boolean).sort(),
      suppliers: suppliers.map((s) => ({ id: String(s._id), name: s.name })),
      paymentMethods: [
        { value: "cash", label: "Cash" },
        { value: "bank_transfer", label: "Bank Transfer" },
        { value: "cheque", label: "Cheque" },
        { value: "card", label: "Card" },
        { value: "online", label: "Online" },
        { value: "petty_cash", label: "Petty Cash" },
      ],
      periods: [
        { value: "today", label: "Today" },
        { value: "yesterday", label: "Yesterday" },
        { value: "last7", label: "Last 7 Days" },
        { value: "last30", label: "Last 30 Days" },
        { value: "thisMonth", label: "This Month" },
        { value: "lastMonth", label: "Last Month" },
        { value: "thisQuarter", label: "This Quarter" },
        { value: "thisYear", label: "This Year" },
        { value: "allTime", label: "All Time" },
        { value: "custom", label: "Custom" },
      ],
    },
  });
});
