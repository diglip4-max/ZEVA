// lib/finance/dashboardFilters.js
//
// Shared query-string -> Mongo match-object logic for the finance dashboard.
// Every dashboard endpoint accepts the same filter query params:
//
//   period       "today" | "yesterday" | "last7" | "last30" | "thisMonth" |
//                "lastMonth" | "thisQuarter" | "thisYear" | "allTime" | "custom"
//                (default "thisMonth")
//   startDate    ISO date string, only used when period=custom
//   endDate      ISO date string, only used when period=custom
//   category     category name, or "all" / omitted for no filter
//   supplierId   Supplier ObjectId, or "all" / omitted for no filter
//   branchId     Branch ObjectId, or "all" / omitted for no filter
//   method       payment method (cash | bank_transfer | cheque | card | online |
//                petty_cash), or "all" / omitted for no filter
//
// `method` lives on FinancePayment, not FinanceTransaction, so it's resolved
// separately via resolveTransactionIdsForMethod() and then intersected with
// the aggregate's match using applyTransactionIdFilter().

import { Types } from "mongoose";

export function resolveDateRange(query = {}) {
  const { period = "thisMonth", startDate, endDate } = query;
  const now = new Date();
  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let start = null;
  let end = null;

  switch (period) {
    case "today":
      start = startOfDay(now);
      end = endOfDay(now);
      break;
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = startOfDay(y);
      end = endOfDay(y);
      break;
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      start = startOfDay(s);
      end = endOfDay(now);
      break;
    }
    case "last30": {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      start = startOfDay(s);
      end = endOfDay(now);
      break;
    }
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0));
      break;
    }
    case "thisYear":
      start = new Date(now.getFullYear(), 0, 1);
      end = endOfDay(new Date(now.getFullYear(), 11, 31));
      break;
    case "allTime":
      start = null;
      end = null;
      break;
    case "custom":
      start = startDate ? startOfDay(new Date(startDate)) : null;
      end = endDate ? endOfDay(new Date(endDate)) : null;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  return { start, end, period };
}

/**
 * Build a base Mongo match object for FinanceTransaction-style queries.
 * `dateField` should be "dueDate" for bill-schedule queries (outstanding,
 * overdue, upcoming, next-30-days) and "createdAt" for money-movement
 * queries (received, spent, trends).
 */
export function buildBaseMatch({
  clinicId,
  query = {},
  dateField = "createdAt",
}) {
  const match = { clinicId };
  const { category, supplierId, branchId } = query;
  const { start, end } = resolveDateRange(query);

  if (start || end) {
    match[dateField] = {};
    if (start) match[dateField].$gte = start;
    if (end) match[dateField].$lte = end;
  }
  if (category && category !== "all") match.category = category;
  if (
    supplierId &&
    supplierId !== "all" &&
    Types.ObjectId.isValid(supplierId)
  ) {
    match.supplierId = new Types.ObjectId(supplierId);
  }
  if (branchId && branchId !== "all" && Types.ObjectId.isValid(branchId)) {
    match.branchId = new Types.ObjectId(branchId);
  }
  return match;
}

/**
 * Resolve the set of FinanceTransaction _ids that have at least one
 * non-reversed FinancePayment matching the requested `method`.
 * Returns `null` when no method filter is active — callers should treat
 * null as "don't restrict by transaction id".
 */
export async function resolveTransactionIdsForMethod({
  clinicId,
  query = {},
  FinancePayment,
}) {
  const { method } = query;
  if (!method || method === "all") return null;

  const payments = await FinancePayment.find({
    clinicId,
    method,
    reversed: { $ne: true },
  })
    .select("transactionId")
    .lean();

  return payments.map((p) => p.transactionId).filter(Boolean);
}

export function applyTransactionIdFilter(match, transactionIds) {
  if (transactionIds === null) return match;
  return { ...match, _id: { $in: transactionIds } };
}

// Convenience: builds the bill-side match (dueDate based) AND applies the
// method filter in one call. Pass `transactionIds` from
// resolveTransactionIdsForMethod (computed once per request and reused).
export function buildDueMatch({ clinicId, query, transactionIds }) {
  const base = buildBaseMatch({ clinicId, query, dateField: "dueDate" });
  return applyTransactionIdFilter(base, transactionIds);
}

// Convenience: builds the money-movement match (createdAt based).
// Method filter is intentionally NOT applied to income transactions
// (income rarely has an associated FinancePayment/method); pass
// `restrictByMethod: true` only for expense-side aggregates.
export function buildCreatedMatch({
  clinicId,
  query,
  transactionIds,
  restrictByMethod,
}) {
  const base = buildBaseMatch({ clinicId, query, dateField: "createdAt" });
  return restrictByMethod
    ? applyTransactionIdFilter(base, transactionIds)
    : base;
}
