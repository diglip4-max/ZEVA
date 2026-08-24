// pages/api/finance/reports/petty-cash.js
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
    const { dateFrom, dateTo } = req.query;

    const match = { clinicId, entryType: "petty_cash" };
    if (dateFrom || dateTo) {
      match.invoiceDate = {};
      if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) match.invoiceDate.$lte = new Date(dateTo);
    }

    const [totals, daily, allTimeBalance] = await Promise.all([
      FinanceTransaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            cashIn: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            cashOut: {
              $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
            },
          },
        },
      ]),
      FinanceTransaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" },
            },
            cashIn: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            cashOut: {
              $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Running balance is always "since the beginning", regardless of the date filter above
      FinanceTransaction.aggregate([
        { $match: { clinicId, entryType: "petty_cash" } },
        {
          $group: {
            _id: null,
            cashIn: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            cashOut: {
              $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
            },
          },
        },
      ]),
    ]);

    const t = totals[0] || { cashIn: 0, cashOut: 0 };
    const overall = allTimeBalance[0] || { cashIn: 0, cashOut: 0 };

    return res.status(200).json({
      success: true,
      summary: {
        cashIn: t.cashIn,
        cashOut: t.cashOut,
        net: t.cashIn - t.cashOut,
        currentBalance: overall.cashIn - overall.cashOut,
      },
      daily: daily.map((d) => ({
        date: d._id,
        cashIn: d.cashIn,
        cashOut: d.cashOut,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
