// pages/api/finance/cheques/index.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceCheque } from "../../../../models/finance";
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
      status,
      bank,
      supplierId,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { clinicId };
    if (status) query.status = status;
    if (bank) query.bank = bank;
    if (supplierId) query.supplierId = supplierId;
    if (search) {
      query.$or = [
        { chequeNumber: { $regex: search, $options: "i" } },
        { payee: { $regex: search, $options: "i" } },
      ];
    }
    if (dateFrom || dateTo) {
      query.chequeDate = {};
      if (dateFrom) query.chequeDate.$gte = new Date(dateFrom);
      if (dateTo) query.chequeDate.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [cheques, total] = await Promise.all([
      FinanceCheque.find(query)
        .populate("supplierId", "name")
        .populate("transactionId", "invoiceNumber category")
        .populate("paymentId", "paymentNumber")
        .sort({ chequeDate: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      FinanceCheque.countDocuments(query),
    ]);

    // Summary matches the same filters as the list (minus pagination/status)
    // so switching status tabs doesn't skew the cards
    const { status: _drop, ...summaryFilters } = query;

    // Helper to build a { count, amount } accumulator pair for a given status
    const statusSum = (statuses) => ({
      $sum: {
        $cond: [{ $in: ["$status", statuses] }, 1, 0],
      },
    });
    const statusAmountSum = (statuses) => ({
      $sum: {
        $cond: [{ $in: ["$status", statuses] }, "$amount", 0],
      },
    });

    const summaryResult = await FinanceCheque.aggregate([
      { $match: summaryFilters },
      {
        $group: {
          _id: null,
          totalCheques: { $sum: 1 },
          totalAmount: { $sum: "$amount" },

          // Per-status counts
          issuedCount: statusSum(["issued"]),
          presentedCount: statusSum(["presented"]),
          clearedCount: statusSum(["cleared"]),
          returnedCount: statusSum(["returned"]),
          bouncedCount: statusSum(["bounced", "returned"]),
          cancelledCount: statusSum(["cancelled"]),

          // Per-status amounts — used by the Cheque Manager stats row
          issuedAmount: statusAmountSum(["issued"]),
          presentedAmount: statusAmountSum(["presented"]),
          clearedAmount: statusAmountSum(["cleared"]),
          returnedAmount: statusAmountSum(["returned"]),
          bouncedAmount: statusAmountSum(["bounced"]),
          cancelledAmount: statusAmountSum(["cancelled"]),

          // Legacy aggregate fields kept for backward compatibility
          pendingCount: statusSum(["issued", "presented"]),
          pendingAmount: statusAmountSum(["issued", "presented"]),
        },
      },
    ]);

    const s = summaryResult[0] || {
      totalCheques: 0,
      totalAmount: 0,
      issuedCount: 0,
      presentedCount: 0,
      clearedCount: 0,
      returnedCount: 0,
      bouncedCount: 0,
      cancelledCount: 0,
      issuedAmount: 0,
      presentedAmount: 0,
      clearedAmount: 0,
      returnedAmount: 0,
      bouncedAmount: 0,
      cancelledAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
    };
    delete s._id;

    return res.status(200).json({
      success: true,
      data: cheques,
      summary: s,
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
