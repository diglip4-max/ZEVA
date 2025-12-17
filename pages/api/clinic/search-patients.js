import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Verify clinic authentication
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (clinicUser.role !== "clinic") {
      return res.status(403).json({ success: false, message: "Access denied. Clinic role required." });
    }

    const { search } = req.query;

    // Allow single character search for better UX
    if (!search || search.trim().length < 1) {
      return res.status(200).json({ success: true, patients: [] });
    }

    const searchTerm = search.trim();

    // Search by firstName, lastName, mobileNumber, email, or EMR number
    // Using case-insensitive regex for partial matching
    const patients = await PatientRegistration.find({
      $or: [
        { firstName: { $regex: searchTerm, $options: "i" } },
        { lastName: { $regex: searchTerm, $options: "i" } },
        { mobileNumber: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { emrNumber: { $regex: searchTerm, $options: "i" } },
        // Also search in full name combination
        { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: searchTerm, options: "i" } } },
      ],
    })
      .select("_id firstName lastName mobileNumber email emrNumber gender")
      .limit(30) // Increased limit for better results
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      patients: patients.map((patient) => ({
        _id: patient._id.toString(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
        mobileNumber: patient.mobileNumber,
        email: patient.email,
        emrNumber: patient.emrNumber,
        gender: patient.gender,
      })),
    });
  } catch (error) {
    console.error("Error searching patients:", error);
    return res.status(500).json({ success: false, message: "Failed to search patients" });
  }
}

