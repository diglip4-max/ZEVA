// pages/api/finance/payments/index.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import { FinancePayment } from "../../../../models/finance";
import { FinanceCheque } from "../../../../models/finance";
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

  // ---- GET /api/finance/payments — list ----
  if (req.method === "GET") {
    try {
      const {
        supplierId,
        method,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = req.query;

      const query = { clinicId };
      if (supplierId) query.supplierId = supplierId;
      if (method) query.method = method;
      if (dateFrom || dateTo) {
        query.date = {};
        if (dateFrom) query.date.$gte = new Date(dateFrom);
        if (dateTo) query.date.$lte = new Date(dateTo);
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const [payments, total] = await Promise.all([
        FinancePayment.find(query)
          .populate("supplierId", "name")
          .populate("transactionId", "invoiceNumber category")
          .sort({ date: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        FinancePayment.countDocuments(query),
      ]);

      return res.status(200).json({
        success: true,
        data: payments,
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

  // ---- POST /api/finance/payments — record payment against a bill ----
  if (req.method === "POST") {
    try {
      const {
        transactionId,
        amount,
        method,
        bankAccountId,
        chequeDetails, // { chequeNumber, bank, payee, chequeDate }
        attachment,
        notes,
        supplierId,
        createdBy = me._id,
      } = req.body;

      if (!transactionId || !amount || !method) {
        return res.status(400).json({
          success: false,
          message: "transactionId, amount and method are required",
        });
      }
      if (amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Amount must be greater than 0" });
      }

      const txn = await FinanceTransaction.findOne({
        _id: transactionId,
        clinicId,
      });
      if (!txn) {
        return res
          .status(404)
          .json({ success: false, message: "Bill/transaction not found" });
      }

      if (txn.isClosedMonth) {
        return res
          .status(423)
          .json({
            success: false,
            message: "This bill belongs to a closed month",
          });
      }

      if (txn.status === "cancelled") {
        return res
          .status(409)
          .json({ success: false, message: "Cannot pay a cancelled bill" });
      }

      // Rule 8 — payment cannot exceed bill amount
      if (txn.paidAmount + amount > txn.amount) {
        return res.status(400).json({
          success: false,
          message: `Payment exceeds bill balance. Remaining balance is ${txn.amount - txn.paidAmount}`,
        });
      }

      const payment = await FinancePayment.create({
        clinicId,
        transactionId,
        supplierId: supplierId || txn.supplierId,
        amount,
        method,
        bankAccountId,
        attachment,
        notes,
      });

      if (method === "cheque") {
        if (!chequeDetails?.chequeNumber) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "chequeDetails.chequeNumber is required for cheque payments",
            });
        }
        const cheque = await FinanceCheque.create({
          clinicId,
          paymentId: payment._id,
          transactionId,
          supplierId: supplierId || txn.supplierId,
          amount,
          ...chequeDetails,
        });
        payment.chequeId = cheque._id;
        await payment.save();
      }

      txn.paidAmount += amount;
      txn.balance = txn.amount - txn.paidAmount;
      txn.status = txn.balance === 0 ? "paid" : "partial";
      txn.history.push({
        user: createdBy,
        action: "payment_recorded",
        oldValue: txn.status,
        newValue: txn.status,
        reason: `Payment of ${amount} via ${method}`,
        at: new Date(),
      });
      await txn.save();

      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: { payment, bill: txn },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
