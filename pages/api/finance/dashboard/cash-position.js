// pages/api/finance/dashboard/cash-position.js
import {
  BankAccount,
  FinanceTransaction,
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
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Bank accounts
  const bankAccounts = await BankAccount.find({
    clinicId,
    isActive: true,
  }).lean();
  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + parseNumber(a.currentBalance),
    0,
  );

  // Petty cash: allocations + expenses + manual entries, all included.
  const pettyCash = await getPettyCashBreakdown({ clinicId });
  const pettyCashBalance = pettyCash.balance;
  const totalAvailable = totalBankBalance + pettyCashBalance;

  // Upcoming obligations, respecting category / supplier / method / date filters
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

  return res.status(200).json({
    success: true,
    data: {
      currency,
      bankAccounts: bankAccounts.map((a) => ({
        name: a.bankName,
        account: a.accountNumber,
        balance: parseNumber(a.currentBalance),
        manual: true,
      })),
      pettyCash: pettyCashBalance,
      totalAvailable,
      upcomingObligations,
      availableAfterObligations: totalAvailable - upcomingObligations,
    },
  });
});
