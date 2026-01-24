import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import Clinic from "../../../models/Clinic";

const hasRole = (user, roles = []) => roles.includes(user.role);

export default async function handler(req, res) {
  await dbConnect();

  let user;
  try {
    user = await getAuthorizedStaffUser(req, {
      allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
    });
  } catch (err) {
    return res.status(err.status || 401).json({ success: false, message: err.message || "Authentication error" });
  }

  // ---------------- GET: list/filter patients ----------------  
  if (req.method === "GET") {
    // Allow clinic, staff, admin, agent, and doctorStaff roles
    if (!hasRole(user, ["clinic", "staff", "admin", "agent", "doctorStaff", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ✅ Check permissions for reading patients (admin bypasses all checks)
    if (user.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (user.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "patient_registration",
            "read"
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || "You do not have permission to view patients"
            });
          }
        }
      }
      // For agent role (agentToken): Check agent permissions
      else if (user.role === 'agent') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "read"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to view patients"
          });
        }
      }
      // For doctorStaff role (userToken): Check agent permissions
      else if (user.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "read"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to view patients"
          });
        }
      }
    }

    try {
      const { emrNumber, invoiceNumber, name, phone, claimStatus, applicationStatus } = req.query;
      const query = { userId: user._id };

      if (emrNumber) query.emrNumber = { $regex: emrNumber, $options: "i" };
      if (invoiceNumber) query.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
      if (phone) query.mobileNumber = { $regex: phone, $options: "i" };
      if (claimStatus) query.advanceClaimStatus = claimStatus;
      if (applicationStatus) query.status = applicationStatus;
      if (name) {
        query.$or = [
          { firstName: { $regex: name, $options: "i" } },
          { lastName: { $regex: name, $options: "i" } },
        ];
      }

      const patients = await PatientRegistration.find(query).sort({ createdAt: -1 });
      return res
        .status(200)
        .json({ success: true, count: patients.length, data: patients });
    } catch (err) {
      console.error("GET error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch patients" });
    }
  }

  // ---------------- POST: create a new patient ----------------
  if (req.method === "POST") {
    if (!hasRole(user, ["clinic", "staff", "admin", "agent", "doctorStaff", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ✅ Check permissions for creating patients (admin bypasses all checks)
    if (user.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (user.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "patient_registration",
            "create"
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || "You do not have permission to create patients"
            });
          }
        }
      }
      // For agent role (agentToken): Check agent permissions
      else if (user.role === 'agent') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "create"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to create patients"
          });
        }
      }
      // For doctorStaff role (userToken): Check agent permissions
      else if (user.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "create"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to create patients"
          });
        }
      }
    }

    try {
      const {
        invoiceNumber,
        invoicedBy,
        emrNumber,
        firstName,
        lastName,
        gender,
        email,
        mobileNumber,
        referredBy,
        patientType,
        insurance,
        insuranceType,
        advanceGivenAmount,
        coPayPercent,
        advanceClaimStatus,
        advanceClaimReleasedBy,
        notes,
      } = req.body;

      const computedInvoicedBy =
        invoicedBy ||
        user.name ||
        user.fullName ||
        user.email ||
        user.username ||
        user.mobileNumber ||
        String(user._id);

      if (
        !invoiceNumber ||
        !firstName ||
        !mobileNumber
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: invoiceNumber, firstName, and mobileNumber are required",
        });
      }

      // Check if invoice number already exists
      const existingInvoice = await PatientRegistration.findOne({ invoiceNumber });
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: "Invoice number already exists",
        });
      }

      const newPatient = await PatientRegistration.create({
        invoiceNumber,
        invoicedDate: new Date(),
        invoicedBy: computedInvoicedBy,
        userId: user._id,
        emrNumber: emrNumber || "",
        firstName,
        lastName: lastName || "",
        gender: gender || "Other",
        email: email || "",
        mobileNumber,
        referredBy: referredBy || "",
        patientType: patientType || "New",
        insurance: insurance || "No",
        insuranceType: insuranceType || "Paid",
        advanceGivenAmount: advanceGivenAmount ? parseFloat(advanceGivenAmount) : 0,
        coPayPercent: coPayPercent || "",
        advanceClaimStatus: advanceClaimStatus || "Pending",
        advanceClaimReleasedBy: advanceClaimReleasedBy || null,
        notes: notes || "",
      });

      return res.status(201).json({
        success: true,
        message: "Patient registered successfully",
        data: newPatient,
      });
    } catch (err) {
      console.error("POST error:", err);
      
      // Handle validation errors
      if (err.name === 'ValidationError') {
        const validationErrors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ 
          success: false, 
          message: "Validation Error", 
          errors: validationErrors 
        });
      }
      
      // Handle duplicate key errors
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({ 
          success: false, 
          message: `${field} already exists` 
        });
      }
      
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }

  // ---------------- Default response for unsupported methods ----------------
  res.setHeader("Allow", ["GET", "POST"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}

