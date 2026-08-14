// pages/api/finance/bills/[id]/history.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import { FinanceTransaction } from "../../../../../models/finance";
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
  } else if (
    me.role === "agent" ||
    me.role === "doctor" ||
    me.role === "doctorStaff"
  ) {
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
    })
      .select("history invoiceNumber supplierId amount status")
      .populate("history.user", "name email")
      .populate("supplierId", "name");

    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        invoiceNumber: bill.invoiceNumber,
        supplier: bill.supplierId,
        currentStatus: bill.status,
        history: bill.history.sort((a, b) => new Date(b.at) - new Date(a.at)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
