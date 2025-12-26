import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import Appointment from "../../../models/Appointment";
import { getUserFromReq } from "../lead-ms/auth";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ✅ Check permissions for creating patients (admin bypasses all checks)
    if (clinicUser.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (clinicUser.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: clinicUser._id });
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
      else if (clinicUser.role === 'agent') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          clinicUser._id,
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
      else if (clinicUser.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          clinicUser._id,
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

    // Find clinic
    let clinic;
    if (clinicUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: clinicUser._id });
    } else if (["agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
      if (!clinicUser.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
      clinic = await Clinic.findById(clinicUser.clinicId);
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const {
      invoiceNumber,
      invoicedDate,
      appointmentId,
      firstName,
      lastName,
      email,
      mobileNumber,
      gender,
      doctor,
      service,
      treatment,
      package: packageName,
      quantity,
      sessions,
      amount,
      paid,
      pending,
      advance,
      paymentMethod,
      notes,
      emrNumber,
      userId, // PatientRegistration ID from appointment (appointment.patientId)
    } = req.body;

    // Validate required fields
    if (!invoiceNumber || !appointmentId || !firstName || !mobileNumber || !gender || !doctor || !service) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Check if invoice number already exists
    const existingInvoice = await Billing.findOne({ invoiceNumber });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }

    // userId in payload is actually PatientRegistration _id
    // Find existing PatientRegistration record
    let patientRegistration;
    
    if (userId) {
      // userId is the PatientRegistration _id
      patientRegistration = await PatientRegistration.findById(userId);
      
      if (!patientRegistration) {
        return res.status(404).json({
          success: false,
          message: "Patient registration not found",
        });
      }
    } else {
      // If no userId provided, try to find by mobile number
      patientRegistration = await PatientRegistration.findOne({
        mobileNumber,
      }).sort({ createdAt: -1 }); // Get the latest one
      
      if (!patientRegistration) {
        return res.status(404).json({
          success: false,
          message: "Patient registration not found. Please register the patient first.",
        });
      }
    }

    // Get the actual user from PatientRegistration
    const patientUser = await User.findById(patientRegistration.userId);
    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: "Patient user not found",
      });
    }

    // Calculate pending and advance (use provided values or calculate)
    const amountNum = parseFloat(amount) || 0;
    const paidNum = parseFloat(paid) || 0;
    const pendingNum = pending !== undefined ? parseFloat(pending) || 0 : 0;
    const advanceNum = advance !== undefined ? parseFloat(advance) || 0 : 0;
    
    // If pending/advance not provided, calculate them
    let finalPending = pendingNum;
    let finalAdvance = advanceNum;
    
    if (pending === undefined && advance === undefined) {
      // Auto-calculate if not provided
      if (paidNum >= amountNum) {
        finalPending = 0;
        finalAdvance = paidNum - amountNum;
      } else {
        finalAdvance = 0;
        finalPending = amountNum - paidNum;
      }
    } else {
      // Use provided values (user may have manually edited)
      finalPending = pendingNum;
      finalAdvance = advanceNum;
    }

    // Create billing record
    const billingData = {
      clinicId: clinic._id,
      appointmentId: appointment._id,
      patientId: patientRegistration._id,
      invoiceNumber,
      invoicedDate: new Date(invoicedDate),
      invoicedBy: clinicUser.name || "Clinic Staff",
      service,
      treatment: service === "Treatment" ? (treatment || "") : "",
      package: service === "Package" ? (packageName || "") : "",
      quantity: service === "Treatment" ? (parseInt(quantity) || 1) : 1,
      sessions: service === "Package" ? (parseInt(sessions) || 0) : 0,
      amount: amountNum,
      paid: paidNum,
      pending: finalPending,
      advance: finalAdvance,
      paymentMethod,
      paymentHistory: [
        {
          amount: amountNum,
          paid: paidNum,
          pending: finalPending,
          paymentMethod,
          status: "Active",
          updatedAt: new Date(),
        },
      ],
      notes: notes || "",
    };

    const billing = await Billing.create(billingData);

    return res.status(201).json({
      success: true,
      message: "Billing created successfully",
      data: {
        _id: billing._id,
        invoiceNumber: billing.invoiceNumber,
      },
    });
  } catch (error) {
    console.error("Error creating billing:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create billing",
    });
  }
}

