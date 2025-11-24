import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import jwt from "jsonwebtoken";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ✅ Resolve clinicId correctly
    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    }

    // ✅ Check permission for reading clinic (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "health_center",
        "read"
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to view clinic information"
        });
      }
    }

    const clinic = await Clinic.findOne({ owner: me._id }).lean();

    // ✅ Log result of DB query
    console.log("🏥 Clinic found:", clinic);

    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });

    // Helper to get base URL
    function getBaseUrl() {
      if (process.env.NODE_ENV === "production") {
        return "https://zeva360.com";
      }
      return process.env.NEXT_PUBLIC_BASE_URL ;
    }

    // Ensure photos are absolute URLs
    if (clinic.photos && Array.isArray(clinic.photos)) {
      clinic.photos = clinic.photos.map((photo) =>
        photo.startsWith("http") ? photo : `${getBaseUrl()}${photo}`
      );
    }
    if (clinic.licenseDocumentUrl) {
      clinic.licenseDocumentUrl = clinic.licenseDocumentUrl.startsWith("http")
        ? clinic.licenseDocumentUrl
        : `${getBaseUrl()}${clinic.licenseDocumentUrl}`;
    }

    // Transform treatments to include main treatments with their sub-treatments
    if (clinic.treatments && Array.isArray(clinic.treatments)) {
      clinic.treatments = clinic.treatments.map((treatment) => ({
        mainTreatment: treatment.mainTreatment,
        mainTreatmentSlug: treatment.mainTreatmentSlug,
        subTreatments: (treatment.subTreatments || []).map((sub) => ({
          name: sub.name,
          slug: sub.slug,
          price: sub.price || 0,
        })),
      }));
    }

    return res.status(200).json({ success: true, clinic });
  } catch (err) {
    console.error("❌ Error in myallClinic API:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
