import dbConnect from "../../../lib/database";
import DoctorTreatment from "../../../models/DoctorTreatment";
import Treatment from "../../../models/Treatment";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import {
  formatDoctorTreatments,
  ensureUniqueTreatmentSlug,
  slugifyValue,
} from "../../../server/staff/doctorTreatmentService";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic admin authentication
  let clinicAdmin;
  try {
    clinicAdmin = await getUserFromReq(req);
    if (!clinicAdmin) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "doctor", "admin"].includes(clinicAdmin.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { doctorStaffId } = req.query;

  if (req.method === "GET") {
    if (!doctorStaffId) {
      return res.status(400).json({ success: false, message: "doctorStaffId is required" });
    }

    try {
      // Verify doctorStaff exists and belongs to clinic
      const doctorStaff = await User.findById(doctorStaffId);
      if (!doctorStaff || doctorStaff.role !== "doctorStaff") {
        return res.status(404).json({ success: false, message: "Doctor staff not found" });
      }

      // If clinic admin, verify they own this doctorStaff
      if (clinicAdmin.role === "clinic") {
        // Clinic users don't have clinicId - find their clinic by owner
        const clinic = await Clinic.findOne({ owner: clinicAdmin._id }).select("_id");
        if (!clinic) {
          return res.status(403).json({ success: false, message: "Clinic not found" });
        }
        const clinicId = clinic._id;
        if (doctorStaff.clinicId?.toString() !== clinicId?.toString()) {
          return res.status(403).json({ success: false, message: "Access denied" });
        }
      }

      const treatments = await formatDoctorTreatments(doctorStaffId);
      return res.status(200).json({ success: true, treatments });
    } catch (error) {
      console.error("Error fetching doctor treatments:", error);
      return res.status(500).json({ success: false, message: "Failed to load treatments" });
    }
  }

  if (req.method === "POST") {
    const { doctorStaffId: bodyDoctorStaffId, treatmentId, treatmentName, subTreatments, subcategoryIds, price } = req.body;
    const targetDoctorStaffId = doctorStaffId || bodyDoctorStaffId;

    if (!targetDoctorStaffId) {
      return res.status(400).json({ success: false, message: "doctorStaffId is required" });
    }

    try {
      // Verify doctorStaff exists and belongs to clinic
      const doctorStaff = await User.findById(targetDoctorStaffId);
      if (!doctorStaff || doctorStaff.role !== "doctorStaff") {
        return res.status(404).json({ success: false, message: "Doctor staff not found" });
      }

      // If clinic admin, verify they own this doctorStaff
      if (clinicAdmin.role === "clinic") {
        // Clinic users don't have clinicId - find their clinic by owner
        const clinic = await Clinic.findOne({ owner: clinicAdmin._id }).select("_id");
        if (!clinic) {
          return res.status(403).json({ success: false, message: "Clinic not found" });
        }
        const clinicId = clinic._id;
        if (doctorStaff.clinicId?.toString() !== clinicId?.toString()) {
          return res.status(403).json({ success: false, message: "Access denied" });
        }
      }

      let finalTreatmentId = treatmentId;

      // If creating custom treatment
      if (treatmentName && !treatmentId) {
        if (!treatmentName.trim()) {
          return res.status(400).json({ success: false, message: "Treatment name is required" });
        }

        const treatmentSlug = await ensureUniqueTreatmentSlug(treatmentName);

        const normalizedSubs = Array.isArray(subTreatments)
          ? subTreatments
              .filter((sub) => sub?.name?.trim())
              .map((sub) => ({
                name: sub.name.trim(),
                slug: slugifyValue(sub.name),
                price: sub.price && !Number.isNaN(Number(sub.price)) ? Number(sub.price) : 0,
              }))
          : [];

        const treatmentDoc = await Treatment.create({
          name: treatmentName.trim(),
          slug: treatmentSlug,
          subcategories: normalizedSubs,
        });

        finalTreatmentId = treatmentDoc._id;
      }

      if (!finalTreatmentId) {
        return res.status(400).json({ success: false, message: "Treatment ID or name is required" });
      }

      // Verify treatment exists
      const treatmentExists = await Treatment.findById(finalTreatmentId).lean();
      if (!treatmentExists) {
        return res.status(404).json({ success: false, message: "Treatment not found" });
      }

      const payload = {
        doctorId: targetDoctorStaffId,
        treatmentId: finalTreatmentId,
        subcategoryIds: Array.isArray(subcategoryIds)
          ? subcategoryIds.filter(Boolean)
          : treatmentExists.subcategories?.map((sub) => sub.slug || sub.name) || [],
      };

      if (price !== undefined && price !== null && price !== "") {
        const parsedPrice = Number(price);
        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({ success: false, message: "Price must be a positive number" });
        }
        payload.price = parsedPrice;
      }

      await DoctorTreatment.findOneAndUpdate(
        { doctorId: targetDoctorStaffId, treatmentId: finalTreatmentId },
        payload,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const treatments = await formatDoctorTreatments(targetDoctorStaffId);

      return res.status(201).json({
        success: true,
        message: treatmentName ? "Custom treatment created and assigned successfully" : "Treatment assigned successfully",
        treatments,
      });
    } catch (error) {
      console.error("Error saving doctor treatment:", error);
      return res.status(500).json({ success: false, message: "Failed to save treatment" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

