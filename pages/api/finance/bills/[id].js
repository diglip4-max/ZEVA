// pages/api/finance/bills/[id].js
import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

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

  // ---- shared: resolve clinicId based on role ----
  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({
      success: false,
      message:
        "Access denied. Only clinic, agent, admin, or doctor can view billing.",
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
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Agent not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
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
  } else {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const bill = await FinanceTransaction.findOne({
    _id: id,
    clinicId,
    entryType: "bill",
  }).populate("supplierId", "name");

  if (!bill) {
    return res.status(404).json({ success: false, message: "Bill not found" });
  }

  // ---- GET /api/finance/bills/[id] — single detail ----
  if (req.method === "GET") {
    try {
      return res.status(200).json({ success: true, data: bill });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // ---- PATCH /api/finance/bills/[id] — edit (draft/pending stage only) ----
  if (req.method === "PATCH") {
    try {
      if (bill.isClosedMonth) {
        return res.status(423).json({
          success: false,
          message: "This bill belongs to a closed month and cannot be edited",
        });
      }

      if (!["draft", "pending", "upcoming"].includes(bill.status)) {
        return res.status(409).json({
          success: false,
          message: `Bill cannot be edited once it is ${bill.status}. Only draft, pending, or upcoming bills can be edited.`,
        });
      }

      const editable = [
        "supplierId",
        "category",
        "supplierInvoiceNumber",
        "invoiceDate",
        "dueDate",
        "amount",
        "notes",
        "attachments",
      ];

      const { reason, editedBy = me._id } = req.body;
      const changes = [];

      for (const field of editable) {
        if (req.body[field] === undefined) continue;
        const oldValue = bill[field];
        let newValue = req.body[field];
        if (field === "invoiceDate" || field === "dueDate")
          newValue = new Date(newValue);

        if (String(oldValue) !== String(newValue)) {
          changes.push({
            user: editedBy,
            action: `updated_${field}`,
            oldValue,
            newValue,
            reason: reason || "Bill updated",
            at: new Date(),
          });
          bill[field] = newValue;
        }
      }

      if (req.body.amount !== undefined && req.body.amount < bill.paidAmount) {
        return res.status(400).json({
          success: false,
          message: "Amount cannot be less than the amount already paid",
        });
      }

      bill.balance = bill.amount - bill.paidAmount;
      if (changes.length) bill.history.push(...changes);

      await bill.save();

      return res.status(200).json({
        success: true,
        message: "Bill updated successfully",
        data: bill,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
