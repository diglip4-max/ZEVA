// pages/api/finance/expenses/index.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import {
  FinanceTransaction,
  FinancePayment,
  FinanceCheque,
} from "../../../../models/finance";
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
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin in query parameters",
      });
    }
  }

  // ---- GET /api/finance/expenses — list + summary ----
  if (req.method === "GET") {
    try {
      const {
        category,
        search,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = req.query;

      const query = { clinicId, entryType: "expense" };
      if (category) query.category = category;
      if (search) query.notes = { $regex: search, $options: "i" };
      if (dateFrom || dateTo) {
        query.invoiceDate = {};
        if (dateFrom) query.invoiceDate.$gte = new Date(dateFrom);
        if (dateTo) query.invoiceDate.$lte = new Date(dateTo);
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const [expenses, total] = await Promise.all([
        FinanceTransaction.find(query)
          .sort({ invoiceDate: -1, createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        FinanceTransaction.countDocuments(query),
      ]);

      // Each expense has exactly one linked payment (created at the same time) —
      // pull method/paymentNumber in for display without a separate round trip
      const txnIds = expenses.map((e) => e._id);
      const payments = await FinancePayment.find({
        clinicId,
        transactionId: { $in: txnIds },
      })
        .select("transactionId method paymentNumber attachment")
        .lean();
      const paymentByTxn = Object.fromEntries(
        payments.map((p) => [String(p.transactionId), p]),
      );

      const enriched = expenses.map((e) => ({
        ...e,
        payment: paymentByTxn[String(e._id)] || null,
      }));

      const summaryMatch = { ...query };
      const summaryResult = await FinanceTransaction.aggregate([
        { $match: summaryMatch },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: "$amount" },
            totalCount: { $sum: 1 },
          },
        },
      ]);
      const s = summaryResult[0] || { totalSpend: 0, totalCount: 0 };
      const avgExpense = s.totalCount ? s.totalSpend / s.totalCount : 0;

      return res.status(200).json({
        success: true,
        data: enriched,
        summary: {
          totalSpend: s.totalSpend,
          totalCount: s.totalCount,
          avgExpense,
        },
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

  // ---- POST /api/finance/expenses — instant bill + payment ----
  if (req.method === "POST") {
    try {
      const {
        category,
        amount,
        method = "cash",
        bankAccountId,
        chequeDetails, // { chequeNumber, bank, payee, chequeDate } — rare for expenses, kept for consistency
        date,
        notes,
        attachment,
        createdBy = me._id,
      } = req.body;

      if (!category || !amount) {
        return res.status(400).json({
          success: false,
          message: "Category and amount are required",
        });
      }
      if (amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Amount must be greater than 0" });
      }

      // Section 6: expense is paid the moment it's created — no due date, no pending state
      const expense = await FinanceTransaction.create({
        clinicId,
        type: "expense",
        entryType: "expense",
        category,
        invoiceDate: date ? new Date(date) : new Date(),
        amount,
        paidAmount: amount,
        balance: 0,
        status: "paid",
        notes,
        attachments: attachment ? [attachment] : [],
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

      // Section 7: every payment the clinic makes — including instant expense payments —
      // is stored in the Payment Center, so create the linked FinancePayment here too
      const payment = await FinancePayment.create({
        clinicId,
        transactionId: expense._id,
        amount,
        method,
        bankAccountId,
        attachment,
        notes,
      });

      if (method === "cheque") {
        if (!chequeDetails?.chequeNumber) {
          return res.status(400).json({
            success: false,
            message:
              "chequeDetails.chequeNumber is required for cheque payments",
          });
        }
        const cheque = await FinanceCheque.create({
          clinicId,
          paymentId: payment._id,
          transactionId: expense._id,
          amount,
          ...chequeDetails,
        });
        payment.chequeId = cheque._id;
        await payment.save();
      }

      return res.status(201).json({
        success: true,
        message: "Expense recorded successfully",
        data: { expense, payment },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
