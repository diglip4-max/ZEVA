import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Find the clinic
    let clinic;
    if (clinicUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: clinicUser._id }).lean();
    } else if (["agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
      if (!clinicUser.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
      clinic = await Clinic.findById(clinicUser.clinicId).lean();
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // Format treatments for frontend
    const formattedTreatments = (clinic.treatments || []).map((tr) => ({
      mainTreatment: tr.mainTreatment,
      mainTreatmentSlug: tr.mainTreatmentSlug,
      subTreatments: (tr.subTreatments || []).map((sub) => ({
        name: sub.name,
        slug: sub.slug,
        price: sub.price || 0,
      })),
    }));

    return res.status(200).json({
      success: true,
      clinic: {
        _id: clinic._id,
        treatments: formattedTreatments,
      },
    });
  } catch (error) {
    console.error("Error fetching clinic treatments:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch treatments" });
  }
}

