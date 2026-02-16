import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import PurchaseInvoice from "../../../../../models/stocks/PurchaseInvoice";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();
  if (req.method !== "PUT") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const me = await getUserFromReq(req);
    if (!me) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic) return res.status(400).json({ success: false, message: "Clinic not found for this user" });
      clinicId = clinic._id;
    } else if (me.role === "agent" || me.role === "doctor") {
      if (!me.clinicId) return res.status(400).json({ success: false, message: "User not tied to a clinic" });
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) return res.status(400).json({ success: false, message: "clinicId is required for admin" });
    }

    const { id } = req.query;
    const { branch, supplier, grn, grns, supplierInvoiceNo, date, notes, status } = req.body;
    const invoice = await PurchaseInvoice.findOne({ _id: id, clinicId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Purchase invoice not found" });
    }

    if (branch !== undefined) invoice.branch = branch;
    if (supplier !== undefined) invoice.supplier = supplier;
    if (grn !== undefined) invoice.grn = grn;
    if (grns !== undefined) invoice.grns = Array.isArray(grns) ? grns : [];
    if (supplierInvoiceNo !== undefined) invoice.supplierInvoiceNo = supplierInvoiceNo;
    if (date !== undefined) invoice.date = new Date(date);
    if (notes !== undefined) invoice.notes = notes;
    if (status !== undefined && invoice.status !== "Deleted") invoice.status = status;

    await invoice.save();
    const saved = await PurchaseInvoice.findById(invoice._id)
      .populate("branch", "name")
      .populate("supplier", "name")
      .populate("grn", "grnNo")
      .populate("grns", "grnNo")
      .populate("createdBy", "name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Purchase invoice updated successfully",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update purchase invoice", error: error.message });
  }
}
