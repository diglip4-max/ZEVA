import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Service from "../../../models/Service";
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

    // Get service-level offer intelligence
    const serviceOfferPipeline = [
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
          _id: "$serviceId",
          offerRevenue: { $sum: "$amount" },
          offerCount: { $sum: 1 },
          patientIds: { $addToSet: "$patientId" },
        },
      },
    ];

    const serviceOfferResult = await Billing.aggregate(serviceOfferPipeline);

    // Get service names
    const serviceIds = serviceOfferResult.map((r) => r._id).filter(Boolean);
    const services = await Service.find({ _id: { $in: serviceIds } }).select("_id name").lean();
    const serviceMap = {};
    services.forEach((s) => {
      serviceMap[s._id.toString()] = s.name;
    });

    // Calculate repeat rate for each service
    const serviceIntelligenceData = await Promise.all(
      serviceOfferResult.map(async (r) => {
        const serviceName = serviceMap[r._id?.toString()] || "Unknown Service";
        const offerRevenue = r.offerRevenue;
        
        // Calculate repeat rate (patients with multiple visits)
        const patientVisitCounts = await Billing.aggregate([
          {
            $match: {
              clinicId: clinicId,
              serviceId: r._id,
              isAdvanceOnly: { $ne: true },
              patientId: { $in: r.patientIds },
            },
          },
          {
            $group: {
              _id: "$patientId",
              visitCount: { $sum: 1 },
            },
          },
        ]);

        const repeatPatients = patientVisitCounts.filter((p) => p.visitCount > 1).length;
        const totalPatients = patientVisitCounts.length;
        const repeatRate = totalPatients > 0 ? Math.round((repeatPatients / totalPatients) * 100) : 0;

        return {
          serviceName,
          offerRevenue,
          repeatRate,
        };
      })
    );

    // Sort by offer revenue descending
    serviceIntelligenceData.sort((a, b) => b.offerRevenue - a.offerRevenue);

    res.status(200).json({
      success: true,
      data: serviceIntelligenceData,
    });
  } catch (err) {
    console.error("Error in offer-service-intelligence:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
