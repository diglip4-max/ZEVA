import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";

// Helper to get base URL
function getBaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return process.env.NEXT_PUBLIC_BASE_URL || "https://zeva360.com";
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { treatment } = req.query;

    if (!treatment || !treatment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Treatment parameter is required",
      });
    }

    const treatmentQuery = treatment.trim();

    // Fetch all approved clinics with their treatments
    const clinics = await Clinic.find({ isApproved: true })
      .populate({
        path: "owner",
        model: User,
        select: "name email phone isApproved declined role",
      })
      .select(
        "name address location owner treatments pricing timings photos slug slugLocked servicesName"
      )
      .lean();

    // Filter only registered and available clinics
    // Show clinics that are approved, only filter out if owner is declined or doesn't exist
    const availableClinics = clinics.filter(
      (clinic) => {
        // Clinic must be approved (already filtered in query)
        // Owner must exist and not be declined
        // Don't require owner.isApproved === true, just check they're not declined
        if (!clinic.owner) {
          return false; // No owner = exclude
        }
        if (clinic.owner.declined === true) {
          return false; // Owner declined = exclude
        }
        if (clinic.owner.role !== "clinic") {
          return false; // Wrong role = exclude
        }
        // Include clinic if owner exists, not declined, and has clinic role
        return true;
      }
    );

    // Filter clinics that have the specified treatment (case-insensitive match on main treatment or sub-treatment)
    const matchingClinics = availableClinics.filter((clinic) => {
      if (!clinic.treatments || !Array.isArray(clinic.treatments)) {
        return false;
      }

      // Check if any treatment's mainTreatment or subTreatment matches (case-insensitive)
      return clinic.treatments.some((treatment) => {
        const mainTreatment = treatment.mainTreatment?.trim() || "";
        // Check main treatment
        if (mainTreatment.toLowerCase() === treatmentQuery.toLowerCase()) {
          return true;
        }

        // Check sub-treatments
        if (treatment.subTreatments && Array.isArray(treatment.subTreatments)) {
          return treatment.subTreatments.some((sub) => {
            const subName = sub.name?.trim() || "";
            return subName.toLowerCase() === treatmentQuery.toLowerCase();
          });
        }

        return false;
      });
    });

    // Process clinics to format photos
    const formattedClinics = matchingClinics.map((clinic) => {
      const owner = clinic.owner || {};
      
      // Process photos array
      const photos = (clinic.photos || [])
        .map((photo) => {
          if (!photo) return null;
          if (photo.startsWith("http://") || photo.startsWith("https://")) {
            return photo;
          }
          if (photo.startsWith("/uploads/")) {
            return `${getBaseUrl()}${photo}`;
          }
          if (photo.includes("uploads/clinic/")) {
            const uploadsIndex = photo.indexOf("uploads/clinic/");
            const relativePath = "/" + photo.substring(uploadsIndex);
            return `${getBaseUrl()}${relativePath}`;
          }
          return `${getBaseUrl()}/uploads/clinic/${photo}`;
        })
        .filter(Boolean);

      return {
        ...clinic,
        owner: {
          ...owner,
        },
        photos,
      };
    });

    return res.status(200).json({
      success: true,
      clinics: formattedClinics,
      count: formattedClinics.length,
      treatment: treatmentQuery,
    });
  } catch (error) {
    console.error("Error searching clinics by treatment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search clinics",
      error: error.message,
    });
  }
}

