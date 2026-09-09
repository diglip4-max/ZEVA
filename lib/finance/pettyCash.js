// lib/finance/pettyCash.js
//
// Petty cash balance in this app is made up of THREE sources, and the
// original dashboard code only ever looked at the first two:
//
//   1. PettyCashAllocation  — money allocated INTO petty cash
//   2. PettyCashExpense     — money spent FROM petty cash (usedFromPettyCash: true)
//   3. ManualPettyCash      — manually logged cash in/out (isExpense: true|false)
//                             that never went through an allocation/expense flow
//
// Signal cards like "Available Cash" and "Money Received" were silently
// dropping (3), which under-reported cash the clinic actually has. This
// helper centralizes the correct calculation so every endpoint agrees.

import PettyCashAllocation from "../../models/PettyCashAllocation";
import PettyCashExpense from "../../models/PettyCashExpense";
import ManualPettyCash from "../../models/ManualPettyCash";
import { parseNumber } from "./dashboardAuth";

/**
 * @param {Object} params
 * @param {import("mongoose").Types.ObjectId} params.clinicId
 * @param {{ $gte?: Date, $lte?: Date }|null} [params.dateRange] optional date
 *   window applied to `date`/`createdAt` on each source when computing
 *   period-scoped totals (e.g. "money received this period"). Pass null/
 *   omit for the clinic's full-time petty cash balance.
 */
export async function getPettyCashBreakdown({ clinicId, dateRange = null }) {
  const dateMatch = (field) =>
    dateRange && (dateRange.$gte || dateRange.$lte)
      ? { [field]: dateRange }
      : {};

  const [allocationAgg] = await PettyCashAllocation.aggregate([
    { $match: { clinicId, isVoided: { $ne: true }, ...dateMatch("date") } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const [expenseAgg] = await PettyCashExpense.aggregate([
    {
      $match: {
        clinicId,
        isVoided: { $ne: true },
        usedFromPettyCash: true,
        ...dateMatch("date"),
      },
    },
    { $group: { _id: null, total: { $sum: "$spentAmount" } } },
  ]);

  const [manualAgg] = await ManualPettyCash.aggregate([
    { $match: { clinicId, ...dateMatch("createdAt") } },
    {
      $group: {
        _id: null,
        manualIncome: {
          $sum: { $cond: [{ $eq: ["$isExpense", false] }, "$amount", 0] },
        },
        manualExpense: {
          $sum: { $cond: [{ $eq: ["$isExpense", true] }, "$amount", 0] },
        },
      },
    },
  ]);

  const allocated = parseNumber(allocationAgg?.total || 0);
  const spentFromAllocations = parseNumber(expenseAgg?.total || 0);
  const manualIncome = parseNumber(manualAgg?.manualIncome || 0);
  const manualExpense = parseNumber(manualAgg?.manualExpense || 0);

  return {
    allocated,
    spentFromAllocations,
    manualIncome,
    manualExpense,
    // Net cash currently sitting in the petty cash tin/box.
    balance: allocated - spentFromAllocations + manualIncome - manualExpense,
    // "Received into petty cash" for signal-card purposes = allocations + manual income.
    receivedIntoPettyCash: allocated + manualIncome,
    // "Spent from petty cash" for signal-card purposes = tracked expenses + manual expense.
    spentFromPettyCash: spentFromAllocations + manualExpense,
  };
}
