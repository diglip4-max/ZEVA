// pages/api/finance/reports/petty-cash.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import PettyCashAllocation from "../../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../../models/PettyCashExpense";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

// Amounts may be stored as Decimal128, string, or plain number
// depending on how they were written — normalize consistently.
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value.$numberDecimal) return parseFloat(value.$numberDecimal) || 0;
  if (value._bsontype === "Decimal128")
    return parseFloat(value.toString()) || 0;
  return 0;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("Error connecting to database:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic not found for this user" });
    }
    clinicId = clinic._id;
  } else if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.query.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin in query parameters",
      });
    }
  }

  try {
    const {
      startDate,
      endDate,
      dateFrom: legacyDateFrom,
      dateTo: legacyDateTo,
    } = req.query;

    const dateFrom = startDate || legacyDateFrom;
    const dateTo = endDate || legacyDateTo;

    const buildDateRange = () => {
      if (!dateFrom && !dateTo) return null;
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      const range = {};
      if (from && !isNaN(from.getTime())) range.$gte = from;
      if (to && !isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999); // include the whole end day
        range.$lte = to;
      }
      return Object.keys(range).length > 0 ? range : null;
    };

    const dateRange = buildDateRange();

    // "Cash in" = money allocated to staff (PettyCashAllocation).
    // "Cash out" = money actually drawn FROM petty cash
    // (PettyCashExpense with usedFromPettyCash: true) — expenses
    // logged just for record-keeping (usedFromPettyCash: false)
    // never touched the petty cash balance, so they're excluded.
    // NOTE: unlike the staff-facing petty-cash ledger endpoint, this
    // report is clinic-wide (no staffId filter) — it's meant to show
    // the whole clinic's petty cash picture, not one staff member's.
    const allocationMatch = { clinicId, isVoided: { $ne: true } };
    const expenseMatch = {
      clinicId,
      isVoided: { $ne: true },
      usedFromPettyCash: true,
    };

    if (dateRange) {
      allocationMatch.date = dateRange;
      expenseMatch.date = dateRange;
    }

    const allTimeAllocationMatch = { clinicId, isVoided: { $ne: true } };
    const allTimeExpenseMatch = {
      clinicId,
      isVoided: { $ne: true },
      usedFromPettyCash: true,
    };

    const [
      allocationTotal,
      expenseTotal,
      dailyAllocations,
      dailyExpenses,
      allTimeAllocationTotal,
      allTimeExpenseTotal,
    ] = await Promise.all([
      PettyCashAllocation.aggregate([
        { $match: allocationMatch },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PettyCashExpense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, total: { $sum: "$spentAmount" } } },
      ]),
      PettyCashAllocation.aggregate([
        { $match: allocationMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            total: { $sum: "$amount" },
          },
        },
      ]),
      PettyCashExpense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            total: { $sum: "$spentAmount" },
          },
        },
      ]),
      // All-time balance ignores the date filter on purpose — the
      // running balance is always "since the beginning".
      PettyCashAllocation.aggregate([
        { $match: allTimeAllocationMatch },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PettyCashExpense.aggregate([
        { $match: allTimeExpenseMatch },
        { $group: { _id: null, total: { $sum: "$spentAmount" } } },
      ]),
    ]);

    const cashIn = parseNumber(allocationTotal[0]?.total);
    const cashOut = parseNumber(expenseTotal[0]?.total);
    const allTimeCashIn = parseNumber(allTimeAllocationTotal[0]?.total);
    const allTimeCashOut = parseNumber(allTimeExpenseTotal[0]?.total);

    // Merge the two daily series (allocations in, expenses out) into
    // one row per date for the chart — ReportsTab's LineChart expects
    // { date, cashIn, cashOut } per row.
    const dailyMap = {};
    dailyAllocations.forEach((d) => {
      dailyMap[d._id] = dailyMap[d._id] || {
        date: d._id,
        cashIn: 0,
        cashOut: 0,
      };
      dailyMap[d._id].cashIn = parseNumber(d.total);
    });
    dailyExpenses.forEach((d) => {
      dailyMap[d._id] = dailyMap[d._id] || {
        date: d._id,
        cashIn: 0,
        cashOut: 0,
      };
      dailyMap[d._id].cashOut = parseNumber(d.total);
    });
    const daily = Object.values(dailyMap).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );

    return res.status(200).json({
      success: true,
      summary: {
        cashIn,
        cashOut,
        net: cashIn - cashOut,
        currentBalance: allTimeCashIn - allTimeCashOut,
      },
      daily,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
