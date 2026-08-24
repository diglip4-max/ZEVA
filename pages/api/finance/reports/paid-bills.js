// pages/api/finance/reports/paid-bills.js
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
    const {
      supplierId,
      category,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { clinicId, entryType: "bill", status: "paid" };
    if (supplierId) query.supplierId = supplierId;
    if (category) query.category = category;
    if (dateFrom || dateTo) {
      query.updatedAt = {};
      if (dateFrom) query.updatedAt.$gte = new Date(dateFrom);
      if (dateTo) query.updatedAt.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const [bills, total, summary] = await Promise.all([
      FinanceTransaction.find(query)
        .populate("supplierId", "name")
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      FinanceTransaction.countDocuments(query),
      FinanceTransaction.aggregate([
        { $match: query },
        { $group: { _id: null, totalPaid: { $sum: "$paidAmount" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: bills,
      summary: { totalPaid: summary[0]?.totalPaid || 0 },
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
