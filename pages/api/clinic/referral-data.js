import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/referral-data
 *
 * Calculates referral metrics for the clinic:
 *   - referralPatients: count of patients who have a referredBy value
 *   - referralRevenue: sum of Billing.paid for those referred patients
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. Auth
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ message: error });
    }

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Find patients who were referred (have a referredBy value that is an actual person name)
    //    Exclude empty, null, and "No" — only count patients with a real referral person name
    const referredPatients = await PatientRegistration.find({
      clinicId: clinicObjectId,
      referredBy: { $exists: true, $ne: "", $ne: null, $ne: "No" },
    })
      .select("_id")
      .lean();

    const referralPatientCount = referredPatients.length;
    const referredPatientIds = referredPatients.map((p) => p._id);

    // 4. Sum Billing.paid for those referred patients
    let referralRevenue = 0;
    if (referredPatientIds.length > 0) {
      const billings = await Billing.find({
        clinicId: clinicObjectId,
        patientId: { $in: referredPatientIds },
      })
        .select("paid")
        .lean();

      for (const bill of billings) {
        referralRevenue += bill.paid || 0;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        referralPatients: referralPatientCount,
        referralRevenue,
      },
    });
  } catch (err) {
    console.error("Error in referral-data:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}
