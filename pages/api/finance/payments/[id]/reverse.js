// pages/api/finance/payments/[id]/reverse.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import {
  FinanceTransaction,
  FinancePayment,
} from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
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

  const { id } = req.query;

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  // Reverse is Owner/Admin-level per permission rules — Cashier & Accountant excluded
  if (!requireRole(me, ["clinic", "admin"])) {
    return res
      .status(403)
      .json({
        success: false,
        message: "Only Owner or Admin can reverse a payment",
      });
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

  try {
    const { reason } = req.body;
    if (!reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Reason is required to reverse a payment",
        });
    }

    const payment = await FinancePayment.findOne({ _id: id, clinicId });
    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }
    if (payment.reversed) {
      return res
        .status(409)
        .json({ success: false, message: "Payment is already reversed" });
    }

    const txn = await FinanceTransaction.findOne({
      _id: payment.transactionId,
      clinicId,
    });
    if (!txn) {
      return res
        .status(404)
        .json({ success: false, message: "Linked bill not found" });
    }
    if (txn.isClosedMonth) {
      return res
        .status(423)
        .json({
          success: false,
          message: "Linked bill belongs to a closed month",
        });
    }

    payment.reversed = true;
    await payment.save();

    txn.paidAmount -= payment.amount;
    txn.balance = txn.amount - txn.paidAmount;
    txn.status = txn.paidAmount <= 0 ? "pending" : "partial";
    txn.history.push({
      user: me._id,
      action: "payment_reversed",
      oldValue: payment.amount,
      newValue: 0,
      reason,
      at: new Date(),
    });
    await txn.save();

    return res.status(200).json({
      success: true,
      message: "Payment reversed successfully",
      data: { payment, bill: txn },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
