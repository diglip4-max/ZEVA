// pages/api/finance/bank-accounts/index.js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { BankAccount } from "../../../../models/finance";
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

  // ---- GET /api/finance/bank-accounts — list ----
  if (req.method === "GET") {
    try {
      const { includeInactive } = req.query;
      const query = { clinicId };
      if (!includeInactive) query.isActive = true;

      const accounts = await BankAccount.find(query).sort({ createdAt: -1 });
      const totalBalance = accounts.reduce(
        (s, a) => s + (a.currentBalance || 0),
        0,
      );

      return res
        .status(200)
        .json({ success: true, data: accounts, totalBalance });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // ---- POST /api/finance/bank-accounts — add account (Owner/Admin only) ----
  if (req.method === "POST") {
    try {
      if (!requireRole(me, ["clinic", "admin"])) {
        return res.status(403).json({
          success: false,
          message: "Only the clinic owner or an admin can add a bank account",
        });
      }

      const {
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        currentBalance,
        notes,
      } = req.body;

      if (!bankName) {
        return res
          .status(400)
          .json({ success: false, message: "bankName is required" });
      }

      const account = await BankAccount.create({
        clinicId,
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        currentBalance: currentBalance || 0,
        notes,
        createdBy: me._id,
      });

      return res
        .status(201)
        .json({ success: true, message: "Bank account added", data: account });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
