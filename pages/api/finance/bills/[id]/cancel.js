// pages/api/finance/bills/[id]/cancel.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import { FinanceTransaction } from "../../../../../models/finance";
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

  // Cancel is an approval-level action — Cashier excluded (per permission rules)
  if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
    return res.status(403).json({
      success: false,
      message:
        "Access denied. Only clinic, agent, admin, or doctor can cancel a bill.",
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
  } else if (me.role === "agent" || me.role === "doctor") {
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
    const bill = await FinanceTransaction.findOne({
      _id: id,
      clinicId,
      entryType: "bill",
    });

    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });
    }

    if (bill.isClosedMonth) {
      return res.status(423).json({
        success: false,
        message: "This bill belongs to a closed month and cannot be cancelled",
      });
    }

    if (bill.status === "cancelled") {
      return res
        .status(409)
        .json({ success: false, message: "Bill is already cancelled" });
    }

    if (bill.paidAmount > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Bill has payments recorded — reverse the payments before cancelling, not delete (Rule 2)",
      });
    }

    const { reason } = req.body;
    if (!reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Reason is required to cancel a bill",
        });
    }

    const oldStatus = bill.status;
    bill.status = "cancelled";
    bill.history.push({
      user: me._id,
      action: "cancelled",
      oldValue: oldStatus,
      newValue: "cancelled",
      reason,
      at: new Date(),
    });

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Bill cancelled successfully",
      data: bill,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
