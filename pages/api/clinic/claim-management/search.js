import dbConnect from "../../../../lib/database";
import mongoose from "mongoose";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import PatientRegistration from "../../../../models/PatientRegistration";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

/**
 * GET /api/clinic/claim-management/search
 *
 * Read-only claim search for the claim-management page. Combines:
 *  - free-text search `q` across doctor name, insurance provider name,
 *    patient first/last name and department name (case-insensitive), and
 *  - exact dropdown filters: doctorId, patientId, departmentId,
 *    insuranceProvider.
 *
 * Clinic scoping, the admin clinicId override and the doctorStaff
 * self-scoping rule are identical to /api/clinic/claim-management and the
 * insurance-claims list endpoint, so results never leave the caller's
 * clinic. EMR numbers are enriched the same way as the list endpoint
 * (display-only denormalization from PatientRegistration).
 */

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  await dbConnect();

  // Verify authentication
  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { clinicId: userClinicId, isAdmin } = await getClinicIdFromUser(user);

    const query = {};
    if (isAdmin) {
      // Admin can search all, optionally filter by clinicId
      if (req.query.clinicId) query.clinicId = req.query.clinicId;
    } else if (userClinicId) {
      query.clinicId = userClinicId;
    }

    // doctorStaff always sees only their own claims (same rule as list/dashboard)
    if (user.role === "doctorStaff") query.doctorId = user._id;

    const andClauses = [];

    // Free-text search: doctor / insurance / patient / department
    const q = (req.query.q || "").trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      andClauses.push({
        $or: [
          { patientFirstName: rx },
          { patientLastName: rx },
          { patientMobileNumber: rx },
          { doctorName: rx },
          { insuranceProvider: rx },
          { departmentName: rx },
        ],
      });
    }

    // Dropdown filters (validated ObjectIds; insurance provider is an exact match).
    // IDs are passed as strings and cast by Mongoose per the schema path type.
    const { doctorId, patientId, departmentId, insuranceProvider } = req.query;
    if (doctorId && mongoose.isValidObjectId(doctorId)) {
      andClauses.push({ doctorId: String(doctorId) });
    }
    if (patientId && mongoose.isValidObjectId(patientId)) {
      andClauses.push({ patientId: String(patientId) });
    }
    if (departmentId && mongoose.isValidObjectId(departmentId)) {
      andClauses.push({ departmentId: String(departmentId) });
    }
    if (insuranceProvider && String(insuranceProvider).trim()) {
      andClauses.push({ insuranceProvider: String(insuranceProvider).trim() });
    }

    if (andClauses.length > 0) query.$and = andClauses;

    const claims = await InsuranceClaim.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Enrich with patient EMR numbers (display-only denormalization —
    // EMR lives only on PatientRegistration; single batched indexed query)
    const patientIds = [...new Set(claims.map((c) => c.patientId).filter(Boolean).map(String))];
    if (patientIds.length > 0) {
      const patients = await PatientRegistration.find({ _id: { $in: patientIds } })
        .select("_id emrNumber")
        .lean();
      const emrMap = {};
      for (const p of patients) emrMap[String(p._id)] = p.emrNumber || "";
      for (const c of claims) c.patientEmrNumber = emrMap[String(c.patientId)] || "";
    }

    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.status(200).json({ success: true, count: claims.length, data: claims });
  } catch (error) {
    console.error("Error searching insurance claims:", error);
    return res.status(500).json({ success: false, message: "Failed to search claims" });
  }
}
