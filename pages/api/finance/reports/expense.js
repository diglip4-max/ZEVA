// pages/api/finance/reports/expense.js
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

    const match = { clinicId, entryType: { $in: ["bill", "expense"] } };
    if (dateFrom || dateTo) {
      match.invoiceDate = {};
      if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) match.invoiceDate.$lte = new Date(dateTo);
    }

    const byCategory = await FinanceTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          totalSpent: { $sum: "$paidAmount" },
          totalBilled: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    const grandTotal = byCategory.reduce((s, c) => s + c.totalSpent, 0);

    return res.status(200).json({
      success: true,
      data: byCategory.map((c) => ({
        category: c._id || "Uncategorised",
        totalSpent: c.totalSpent,
        totalBilled: c.totalBilled,
        count: c.count,
      })),
      grandTotal,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
