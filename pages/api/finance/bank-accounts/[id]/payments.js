// pages/api/finance/bank-accounts/[id]/payments.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import { BankAccount } from "../../../../../models/finance";
import { FinancePayment } from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

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

  try {
    const account = await BankAccount.findOne({ _id: id, clinicId });
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Bank account not found" });
    }

    const { page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [payments, total] = await Promise.all([
      FinancePayment.find({ clinicId, bankAccountId: id })
        .populate("supplierId", "name")
        .populate("transactionId", "invoiceNumber category")
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      FinancePayment.countDocuments({ clinicId, bankAccountId: id }),
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
