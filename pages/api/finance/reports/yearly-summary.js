// pages/api/finance/reports/yearly-summary.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

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
    const { year } = req.query;

    if (year) {
      // Monthly breakdown for a specific year
      const yearNum = parseInt(year);
      const start = new Date(`${yearNum}-01-01`);
      const end = new Date(`${yearNum + 1}-01-01`);

      const monthly = await FinanceTransaction.aggregate([
        {
          $match: {
            clinicId,
            invoiceDate: { $gte: start, $lt: end },
            entryType: { $in: ["bill", "expense", "petty_cash", "receivable"] },
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
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$paidAmount", 0] },
            },
          },
        },
        { $sort: { "_id.month": 1 } },
      ]);

      const months = Array.from({ length: 12 }, (_, i) => {
        const found = monthly.find((m) => m._id.month === i + 1);
        return {
          month: i + 1,
          expense: found?.expense || 0,
          income: found?.income || 0,
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
    const byYear = await FinanceTransaction.aggregate([
      {
        $match: {
          clinicId,
          entryType: { $in: ["bill", "expense", "petty_cash", "receivable"] },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$invoiceDate" } },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$paidAmount", 0] },
          },
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$paidAmount", 0] },
          },
        },
      },
      { $sort: { "_id.year": 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: byYear.map((y) => ({
        year: y._id.year,
        expense: y.expense,
        income: y.income,
        net: y.income - y.expense,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
