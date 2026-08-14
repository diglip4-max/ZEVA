// pages/api/finance/expenses/index.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
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
      return res
        .status(400)
        .json({
          success: false,
          message: "clinicId is required for admin in query parameters",
        });
    }
  }

  // ---- GET /api/finance/expenses — list ----
  if (req.method === "GET") {
    try {
      const {
        category,
        method,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = req.query;

      const query = { clinicId, entryType: "expense" };
      if (category) query.category = category;
      if (method) query["payments.method"] = method; // adjust if method lives on FinancePayment instead

      if (dateFrom || dateTo) {
        query.invoiceDate = {};
        if (dateFrom) query.invoiceDate.$gte = new Date(dateFrom);
        if (dateTo) query.invoiceDate.$lte = new Date(dateTo);
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const [expenses, total] = await Promise.all([
        FinanceTransaction.find(query)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        FinanceTransaction.countDocuments(query),
      ]);

      const totalSpend = await FinanceTransaction.aggregate([
        { $match: { clinicId: query.clinicId, entryType: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      return res.status(200).json({
        success: true,
        data: expenses,
        summary: { totalSpend: totalSpend[0]?.total || 0 },
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

  // ---- POST /api/finance/expenses — create (bill + payment instant, per doc Section 6) ----
  if (req.method === "POST") {
    try {
      const {
        category,
        amount,
        method = "cash",
        notes,
        attachments,
        date,
        createdBy = me._id,
      } = req.body;

      if (!category || !amount) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Category and amount are required",
          });
      }
      if (amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Amount must be greater than 0" });
      }

      const expense = await FinanceTransaction.create({
        clinicId,
        type: "expense",
        entryType: "expense",
        category,
        invoiceDate: date ? new Date(date) : new Date(),
        amount,
        paidAmount: amount, // instant — Rule Section 6: no due date, paid immediately
        status: "paid",
        notes,
        attachments: attachments || [],
        createdBy,
        history: [
          {
            user: createdBy,
            action: "created",
            newValue: "paid",
            reason: "Expense recorded",
            at: new Date(),
          },
        ],
      });

      return res.status(201).json({
        success: true,
        message: "Expense recorded successfully",
        data: expense,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
