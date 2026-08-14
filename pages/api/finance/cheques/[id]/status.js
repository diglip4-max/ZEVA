// pages/api/finance/cheques/[id]/status.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import { FinanceCheque } from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

const VALID_STATUSES = [
  "issued",
  "presented",
  "cleared",
  "returned",
  "bounced",
  "cancelled",
];

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
  } else if (["agent", "doctor"].includes(me.role)) {
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

  try {
    const { status } = req.body;
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

    const oldStatus = cheque.status;
    cheque.status = status;
    cheque.history.push({ status, changedBy: me._id, at: new Date() });
    await cheque.save();

    return res.status(200).json({
      success: true,
      message: `Cheque status updated from ${oldStatus} to ${status}`,
      data: cheque,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
