import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!requireRole(user, ["clinic", "agent", "admin", "doctor", "doctorStaff", "staff"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;

    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent" || user.role === "doctorStaff" || user.role === "staff") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinicId = adminClinicId;
      }
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    // Parse date range
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.invoicedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get unique patients who received offers in the date range
    const offerPatientsPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$patientId",
          offerCount: { $sum: 1 },
          totalPaid: { $sum: "$amount" },
        },
      },
    ];

    const offerPatientsResult = await Billing.aggregate(offerPatientsPipeline);
    const eligiblePatients = offerPatientsResult.length;

    // Get repeat visits (patients with multiple billings)
    const repeatPatients = offerPatientsResult.filter((p) => p.offerCount > 1);
    const repeatVisits = repeatPatients.reduce((sum, p) => sum + (p.offerCount - 1), 0);
    const repeatRevenue = repeatPatients.reduce((sum, p) => sum + p.totalPaid * ((p.offerCount - 1) / p.offerCount), 0);

    // Calculate funnel metrics
    const totalPatients = await PatientRegistration.countDocuments({ clinicId: clinicId });
    const offerViews = totalPatients; // All patients are eligible to view offers
    const offerUses = eligiblePatients;
    const completedVisits = offerPatientsResult.filter((p) => p.offerCount > 0).length;

    res.status(200).json({
      success: true,
      data: {
        eligiblePatients: totalPatients,
        offerViews,
        offerUses,
        completedVisits,
        repeatVisits,
        repeatRevenue: Math.round(repeatRevenue),
      },
    });
  } catch (err) {
    console.error("Error in offer-performance:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
