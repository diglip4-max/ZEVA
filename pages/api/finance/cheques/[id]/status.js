// pages/api/finance/cheques/[id]/status.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import {
  FinanceCheque,
  FinancePayment,
  FinanceTransaction,
} from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

const VALID_STATUSES = [
  "issued",
  "presented",
  "cleared",
  "returned",
  "bounced",
  "cancelled",
];
const FAILURE_STATUSES = ["returned", "bounced"]; // money never actually came in
const RECOVERY_STATUSES = ["presented", "cleared"]; // money came in but not cleared

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

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
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
    const { status, reason } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const cheque = await FinanceCheque.findOne({ _id: id, clinicId });
    if (!cheque) {
      return res
        .status(404)
        .json({ success: false, message: "Cheque not found" });
    }

    if (cheque.status === status) {
      return res
        .status(409)
        .json({ success: false, message: `Cheque is already ${status}` });
    }

    const oldStatus = cheque.status;
    cheque.status = status;
    cheque.history.push({ status, changedBy: me._id, at: new Date() });
    await cheque.save();

    // If the cheque bounced/was returned, the money never actually came in —
    // reverse the linked payment so the bill's balance is restored (Rule 2: reverse, never delete)
    let paymentReversed = false;
    let paymentReinstated = false;
    if (cheque.paymentId) {
      const payment = await FinancePayment.findOne({
        _id: cheque.paymentId,
        clinicId,
      });

      // Case 1: cheque newly bounced/returned — reverse the payment
      if (FAILURE_STATUSES.includes(status) && payment && !payment.reversed) {
        payment.reversed = true;
        await payment.save();

        const txn = await FinanceTransaction.findOne({
          _id: payment.transactionId,
          clinicId,
        });
        if (txn && !txn.isClosedMonth) {
          txn.paidAmount -= payment.amount;
          txn.balance = txn.amount - txn.paidAmount;
          txn.status = txn.paidAmount <= 0 ? "pending" : "partial";
          txn.history.push({
            user: me._id,
            action: "payment_reversed",
            oldValue: payment.amount,
            newValue: 0,
            reason: reason || `Cheque ${cheque.chequeNumber} ${status}`,
            at: new Date(),
          });
          await txn.save();
        }
        paymentReversed = true;
      }

      // Case 2: a previously bounced/returned cheque is now clearing — reinstate the payment
      if (
        FAILURE_STATUSES.includes(oldStatus) &&
        RECOVERY_STATUSES.includes(status) &&
        payment &&
        payment.reversed
      ) {
        payment.reversed = false;
        await payment.save();

        const txn = await FinanceTransaction.findOne({
          _id: payment.transactionId,
          clinicId,
        });
        if (txn && !txn.isClosedMonth) {
          if (txn.paidAmount + payment.amount > txn.amount) {
            return res.status(409).json({
              success: false,
              message:
                "Cannot reinstate — bill amount has changed since this payment was reversed",
            });
          }
          txn.paidAmount += payment.amount;
          txn.balance = txn.amount - txn.paidAmount;
          txn.status = txn.balance === 0 ? "paid" : "partial";
          txn.history.push({
            user: me._id,
            action: "payment_reinstated",
            oldValue: 0,
            newValue: payment.amount,
            reason:
              reason ||
              `Cheque ${cheque.chequeNumber} cleared after ${oldStatus}`,
            at: new Date(),
          });
          await txn.save();
        }
        paymentReinstated = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Cheque status updated from ${oldStatus} to ${status}`,
      data: cheque,
      paymentReversed,
      paymentReinstated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
