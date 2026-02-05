import dbConnect from "../../../../lib/database";
import Commission from "../../../../models/Commission";
import PatientRegistration from "../../../../models/PatientRegistration";
import Appointment from "../../../../models/Appointment";
import Billing from "../../../../models/Billing";
import User from "../../../../models/Users";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import { checkClinicPermission } from "../../lead-ms/permissions-helper";
import { checkAgentPermission } from "../../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const source = String(req.query.source || "");
    const referralId = req.query.referralId || null;
    const staffId = req.query.staffId || null;

    let clinicId = null;
    let clinic = null;
    if (me.role === "clinic") {
      clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(me.role)) {
      if (!me.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      const qClinicId = req.query.clinicId;
      if (!qClinicId) {
        return res.status(400).json({ success: false, message: "Admin must provide clinicId" });
      }
      clinicId = qClinicId;
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (me.role !== "admin") {
      if (me.role === "clinic") {
        const { hasPermission, error } = await checkClinicPermission(clinicId, "clinic_commission", "read");
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: error || "No permission to view commissions" });
        }
      } else if (["agent", "doctorStaff"].includes(me.role)) {
        const { hasPermission, error } = await checkAgentPermission(me._id, "clinic_commission", "read");
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: error || "No permission to view commissions" });
        }
      }
    }

    const filter = { clinicId };
    if (source === "referral") {
      if (!referralId) {
        return res.status(400).json({ success: false, message: "referralId is required for referral source" });
      }
      filter.referralId = referralId;
    } else if (source === "staff") {
      if (!staffId) {
        return res.status(400).json({ success: false, message: "staffId is required for staff source" });
      }
      filter.staffId = staffId;
    } else {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    const commissions = await Commission.find(filter)
      .sort({ createdAt: -1 })
      .populate([
        { path: "patientId", model: PatientRegistration, select: "firstName lastName mobileNumber" },
        {
          path: "appointmentId",
          model: Appointment,
          select: "doctorId",
          populate: { path: "doctorId", model: User, select: "name role" },
        },
        { path: "billingId", model: Billing, select: "invoiceNumber invoicedDate service treatment package paid" },
      ])
      .lean();

    const items = commissions.map((c) => {
      const patient = c.patientId || {};
      const appointment = c.appointmentId || {};
      const doctor = appointment?.doctorId || {};
      const billing = c.billingId || {};
      return {
        commissionId: c._id.toString(),
        patientName: `${(patient.firstName || "").trim()} ${(patient.lastName || "").trim()}`.trim(),
        patientMobile: patient.mobileNumber || "",
        invoiceNumber: billing.invoiceNumber || "",
        invoicedDate: billing.invoicedDate || c.invoicedDate || null,
        service: billing.service || "",
        treatment: billing.treatment || "",
        package: billing.package || "",
        paidAmount: Number(c.amountPaid || billing.paid || 0),
        commissionPercent: Number(c.commissionPercent || 0),
        commissionAmount: Number(c.commissionAmount || 0),
        doctorName: doctor.name || "",
      };
    });

    return res.status(200).json({ success: true, items });
  } catch (err) {
    console.error("Error in commissions by-person:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}
