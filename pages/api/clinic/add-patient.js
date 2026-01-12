import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";
import { generateEmrNumber } from "../../../lib/generateEmrNumber";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

    const {
      emrNumber,
      firstName,
      lastName,
      gender,
      email,
      mobileNumber,
      referredBy,
      patientType,
    } = req.body;

    // Validation
    if (!firstName || !gender || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: firstName, gender, and mobileNumber are required",
      });
    }

    // Check if patient with same mobile number exists
    const existingPatient = await PatientRegistration.findOne({ mobileNumber });

    if (existingPatient) {
      return res.status(200).json({
        success: true,
        message: "Patient already exists",
        patient: {
          _id: existingPatient._id.toString(),
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          fullName: `${existingPatient.firstName || ""} ${existingPatient.lastName || ""}`.trim(),
          mobileNumber: existingPatient.mobileNumber,
          email: existingPatient.email,
          emrNumber: existingPatient.emrNumber,
          gender: existingPatient.gender,
        },
      });
    }

    // Generate invoice number
    let invoiceNumber;
    let attempts = 0;
    let invoiceExists = true;
    while (invoiceExists && attempts < 10) {
      invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      invoiceExists = await PatientRegistration.findOne({ invoiceNumber });
      attempts++;
    }
    if (invoiceExists) {
      return res.status(500).json({
        success: false,
        message: "Could not generate unique invoice number. Please try again.",
      });
    }

    // Generate EMR number if not provided or empty
    let finalEmrNumber = emrNumber?.trim() || "";
    if (!finalEmrNumber) {
      finalEmrNumber = await generateEmrNumber();
    }

    // Create new patient with minimal required fields
    const defaultDoctorName =
      clinicUser.name ||
      clinicUser.fullName ||
      clinicUser.email ||
      "Clinic Doctor";

    const newPatient = await PatientRegistration.create({
      invoiceNumber,
      invoicedDate: new Date(),
      invoicedBy: clinicUser.name || clinicUser.email || "Clinic",
      userId: clinicUser._id,
      emrNumber: finalEmrNumber,
      firstName,
      lastName: lastName || "",
      gender,
      email: email || "",
      mobileNumber,
      referredBy: referredBy || "",
      patientType: patientType || "New",
      doctor: defaultDoctorName, // Placeholder; real doctor assigned during appointment booking
      service: "Treatment", // Default
      amount: 0,
      paid: 0,
      advance: 0,
      pending: 0,
      paymentMethod: "Cash", // Default
    });

    return res.status(201).json({
      success: true,
      message: "Patient created successfully",
      patient: {
        _id: newPatient._id.toString(),
        firstName: newPatient.firstName,
        lastName: newPatient.lastName,
        fullName: `${newPatient.firstName || ""} ${newPatient.lastName || ""}`.trim(),
        mobileNumber: newPatient.mobileNumber,
        email: newPatient.email,
        emrNumber: newPatient.emrNumber,
        gender: newPatient.gender,
      },
    });
  } catch (error) {
    console.error("Error creating patient:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Patient with this invoice number already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create patient",
      error: error.message,
    });
  }
}

