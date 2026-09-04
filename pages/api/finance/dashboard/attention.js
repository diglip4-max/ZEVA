// pages/api/finance/dashboard/attention.js
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
import { getPettyCashBreakdown } from "../../../../lib/finance/pettyCash";

export default withDashboardAuth(async (req, res, { clinicId, currency }) => {
  const now = new Date();

  const methodTransactionIds = await resolveTransactionIdsForMethod({
    clinicId,
    query: req.query,
    FinancePayment,
  });
  const dueMatch = () =>
    buildDueMatch({
      clinicId,
      query: req.query,
      transactionIds: methodTransactionIds,
    });

  // Overdue bills
  const [overdueAgg] = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch(), entryType: "bill", status: "overdue" } },
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

  // Highest risk supplier
  const highestRisk = await FinanceTransaction.aggregate([
    { $match: { ...dueMatch(), entryType: "bill", status: "overdue" } },
    {
      $group: {
        _id: "$supplierId",
        total: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 1 },
  ]);

  let highestRiskName = "suppliers";
  if (highestRisk.length > 0 && highestRisk[0]._id) {
    const supplier = await import("../../../../models/stocks/Supplier").then(
      (m) => m.default.findOne({ _id: highestRisk[0]._id }).select("name"),
    );
    if (supplier) highestRiskName = supplier.name;
  }

  // Petty cash balance (allocations + expenses + manual entries)
  const pettyCash = await getPettyCashBreakdown({ clinicId });
  const pettyCashBalance = pettyCash.balance;

  // Upcoming cheques (skipped entirely if method filter excludes "cheque")
  const { method, supplierId } = req.query;
  const chequesApplicable = !method || method === "all" || method === "cheque";
  let upcomingCheques = [];
  if (chequesApplicable) {
    upcomingCheques = await FinanceCheque.find({
      clinicId,
      status: "presented",
      ...(supplierId && supplierId !== "all" ? { supplierId } : {}),
    })
      .populate("supplierId", "name")
      .limit(1)
      .lean();
  }

  // Upcoming bills
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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

  const upcomingAmount = parseNumber(upcomingAgg?.total || 0);
  const upcomingCount = upcomingAgg?.count || 0;

  // Build attention items
  const attentionItems = [];

  if (overdueAmount > 5000) {
    attentionItems.push({
      severity: "red",
      title: `${currency} ${(overdueAmount / 1000).toFixed(1)}K overdue`,
      description: `${overdueCount} supplier bills have passed their due date.`,
      impact: `${currency} ${(overdueAmount / 1000).toFixed(1)}K of this belongs to ${highestRiskName}.`,
      action: "Review overdue",
      link: "/clinic/finance-management/?view=billsPayable",
    });
  }

  if (pettyCashBalance < 2000 && pettyCashBalance > 0) {
    attentionItems.push({
      severity: "amber",
      title: "Petty cash critically low",
      description: `Balance: ${currency} ${pettyCashBalance} — below ${currency} 2,000 minimum.`,
      impact: "Daily clinic incidentals may not be covered.",
      action: "Replenish",
      link: "/clinic/finance-management/?view=ppettyCash",
    });
  }

  if (upcomingCheques.length > 0) {
    const c = upcomingCheques[0];
    attentionItems.push({
      severity: "red",
      title: `Cheque ${c.chequeNumber} — ${currency} ${(parseNumber(c.amount) / 1000).toFixed(1)}K`,
      description: "Status: Presented. Awaiting clearance.",
      impact: "Will further reduce available bank balance.",
      action: "View cheque",
      link: "/clinic/finance-management/?view=cheques",
    });
  }

  if (upcomingAmount > 30000) {
    attentionItems.push({
      severity: "amber",
      title: `${currency} ${(upcomingAmount / 1000).toFixed(1)}K due in next 30 days`,
      description: `${upcomingCount} upcoming bills.`,
      impact: "Combined with overdue amount, cash pressure is rising.",
      action: "View schedule",
      link: "/clinic/finance-management/?view=billsPayable",
    });
  }

  return res.status(200).json({ success: true, data: attentionItems });
});
