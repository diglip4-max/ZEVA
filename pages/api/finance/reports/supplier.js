// pages/api/finance/reports/supplier.js
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
    const { dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    const match = { clinicId, entryType: "bill" };
    if (dateFrom || dateTo) {
      match.invoiceDate = {};
      if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) match.invoiceDate.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$supplierId",
          totalBilled: { $sum: "$amount" },
          totalPaid: { $sum: "$paidAmount" },
          totalBalance: {
            $sum: {
              $cond: [
                { $in: ["$status", ["paid", "cancelled"]] },
                0,
                { $subtract: ["$amount", "$paidAmount"] },
              ],
            },
          },
          billCount: { $sum: 1 },
        },
      },
      { $sort: { totalBilled: -1 } },
    ];

    const [rows, totalRows] = await Promise.all([
      FinanceTransaction.aggregate([
        ...pipeline,
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $lookup: {
            from: "suppliers",
            localField: "_id",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            supplierId: "$_id",
            supplierName: { $ifNull: ["$supplier.name", "Unknown supplier"] },
            totalBilled: 1,
            totalPaid: 1,
            totalBalance: 1,
            billCount: 1,
          },
        },
      ]),
      FinanceTransaction.aggregate([...pipeline, { $count: "total" }]),
    ]);

    const total = totalRows[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
