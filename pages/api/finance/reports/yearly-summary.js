// pages/api/finance/reports/yearly-summary.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import PettyCashExpense from "../../../../models/PettyCashExpense";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

// Amounts may be stored as Decimal128, string, or plain number.
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

  // Real petty cash spend lives in PettyCashExpense (usedFromPettyCash: true),
  // NOT as entryType: "petty_cash" on FinanceTransaction — that entryType is
  // never actually written, so leaving it out of this file silently dropped
  // every petty cash expense from the yearly numbers. Merge it in below.
  const pettyCashExpenseMatch = {
    clinicId,
    isVoided: { $ne: true },
    // usedFromPettyCash: true,
  };

  try {
    const { year } = req.query;

    if (year) {
      // Monthly breakdown for a specific year
      const yearNum = parseInt(year);
      const start = new Date(`${yearNum}-01-01`);
      const end = new Date(`${yearNum + 1}-01-01`);

      const [monthly, pettyCashMonthly] = await Promise.all([
        FinanceTransaction.aggregate([
          {
            $match: {
              clinicId,
              invoiceDate: { $gte: start, $lt: end },
              entryType: { $in: ["bill", "expense", "receivable"] },
            },
          },
          {
            $group: {
              _id: { month: { $month: "$invoiceDate" } },
              expense: {
                $sum: {
                  $cond: [{ $eq: ["$type", "expense"] }, "$paidAmount", 0],
                },
              },
              income: {
                $sum: {
                  $cond: [{ $eq: ["$type", "income"] }, "$paidAmount", 0],
                },
              },
            },
          },
          { $sort: { "_id.month": 1 } },
        ]),
        PettyCashExpense.aggregate([
          {
            $match: {
              ...pettyCashExpenseMatch,
              date: { $gte: start, $lt: end },
            },
          },
          {
            $group: {
              _id: { month: { $month: "$date" } },
              expense: { $sum: "$spentAmount" },
            },
          },
        ]),
      ]);

      const months = Array.from({ length: 12 }, (_, i) => {
        const found = monthly.find((m) => m._id.month === i + 1);
        const pettyFound = pettyCashMonthly.find((m) => m._id.month === i + 1);
        const expense =
          parseNumber(found?.expense) + parseNumber(pettyFound?.expense);
        return {
          month: i + 1,
          expense,
          income: parseNumber(found?.income),
        };
      });

      const totalExpense = months.reduce((s, m) => s + m.expense, 0);
      const totalIncome = months.reduce((s, m) => s + m.income, 0);

      return res.status(200).json({
        success: true,
        year: yearNum,
        months,
        summary: { totalExpense, totalIncome, net: totalIncome - totalExpense },
      });
    }

    // No year given — totals grouped by year, across all years
    const [byYear, pettyCashByYear] = await Promise.all([
      FinanceTransaction.aggregate([
        {
          $match: {
            clinicId,
            entryType: { $in: ["bill", "expense", "receivable"] },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$invoiceDate" } },
            expense: {
              $sum: {
                $cond: [{ $eq: ["$type", "expense"] }, "$paidAmount", 0],
              },
            },
            income: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$paidAmount", 0] },
            },
          },
        },
        { $sort: { "_id.year": 1 } },
      ]),
      PettyCashExpense.aggregate([
        { $match: pettyCashExpenseMatch },
        {
          $group: {
            _id: { year: { $year: "$date" } },
            expense: { $sum: "$spentAmount" },
          },
        },
      ]),
    ]);

    // Merge by year — a year with ONLY petty cash spend (and no bills/
    // expenses in FinanceTransaction) still needs to show up.
    const yearMap = {};
    byYear.forEach((y) => {
      const key = y._id.year;
      yearMap[key] = yearMap[key] || { year: key, expense: 0, income: 0 };
      yearMap[key].expense += parseNumber(y.expense);
      yearMap[key].income += parseNumber(y.income);
    });
    pettyCashByYear.forEach((p) => {
      const key = p._id.year;
      yearMap[key] = yearMap[key] || { year: key, expense: 0, income: 0 };
      yearMap[key].expense += parseNumber(p.expense);
    });

    const data = Object.values(yearMap)
      .map((y) => ({ ...y, net: y.income - y.expense }))
      .sort((a, b) => a.year - b.year);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
