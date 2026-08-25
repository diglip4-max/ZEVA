// pages/api/finance/bank-accounts/[id]/index.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import { BankAccount } from "../../../../../models/finance";
import { FinancePayment } from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
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

  const account = await BankAccount.findOne({ _id: id, clinicId });
  if (!account) {
    return res
      .status(404)
      .json({ success: false, message: "Bank account not found" });
  }

  // ---- GET /api/finance/bank-accounts/[id] — detail + balance ----
  if (req.method === "GET") {
    try {
      const paymentTotals = await FinancePayment.aggregate([
        { $match: { clinicId, bankAccountId: account._id, reversed: false } },
        {
          $group: {
            _id: null,
            totalPaidOut: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);
      const t = paymentTotals[0] || { totalPaidOut: 0, count: 0 };

      return res.status(200).json({
        success: true,
        data: {
          ...account.toObject(),
          totalPaidOut: t.totalPaidOut,
          totalPayments: t.count,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // ---- PATCH /api/finance/bank-accounts/[id] — edit (Owner/Admin only) ----
  if (req.method === "PATCH") {
    try {
      if (!requireRole(me, ["clinic", "admin"])) {
        return res.status(403).json({
          success: false,
          message: "Only the clinic owner or an admin can edit a bank account",
        });
      }

      const editable = [
        "bankName",
        "accountName",
        "accountNumber",
        "ifscCode",
        "currentBalance",
        "notes",
        "isActive",
      ];
      const changes = [];

      for (const field of editable) {
        if (req.body[field] === undefined) continue;
        const oldValue = account[field];
        const newValue = req.body[field];
        if (String(oldValue) !== String(newValue)) {
          changes.push({
            field,
            oldValue,
            newValue,
            changedBy: me._id,
            at: new Date(),
          });
          account[field] = newValue;
        }
      }

      if (changes.length) account.history.push(...changes);
      await account.save();

      return res.status(200).json({
        success: true,
        message: "Bank account updated",
        data: account,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
