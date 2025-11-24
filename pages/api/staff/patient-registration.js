import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import PettyCash from "../../../models/PettyCash";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

const hasRole = (user, roles = []) => roles.includes(user.role);

// ---------------- Add to PettyCash if payment method is Cash ----------------
async function addToPettyCashIfCash(user, patient, paidAmount) {
  if (patient.paymentMethod === "Cash" && paidAmount > 0) {
    try {
      // Create a separate PettyCash record for each patient
      const pettyCashRecord = await PettyCash.create({
        staffId: user._id,
        patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
        patientEmail: patient.email || '',
        patientPhone: patient.mobileNumber || '',
        note: `Auto-added from patient registration - Invoice: ${patient.invoiceNumber}`,
        allocatedAmounts: [{
          amount: paidAmount,
          receipts: [],
          date: new Date()
        }],
        expenses: []
      });

      // Update global total amount
      await PettyCash.updateGlobalTotalAmount(paidAmount, 'add');
      
      console.log(`Added د.إ${paidAmount} to PettyCash for staff ${user.name} and updated global total - Patient: ${patient.firstName} ${patient.lastName}`);
    } catch (error) {
      console.error("Error adding to PettyCash:", error);
      // Don't throw error to avoid breaking patient registration
    }
  }
}

// ---------------- API Handler ----------------
export default async function handler(req, res) {
  await dbConnect();

  let user;
  try {
    user = await getAuthorizedStaffUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ success: false, message: err.message });
  }

  // ---------------- POST: create a new patient ----------------
  if (req.method === "POST") {
    if (!hasRole(user, ["clinic", "staff", "admin", "agent", "doctorStaff", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
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
        doctor,
        service,
        treatment,
        package: packageName,
        amount,
        paid,
        advance,
        paymentMethod,
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
        !gender ||
        !mobileNumber ||
        !doctor ||
        !service ||
        amount === undefined ||
        paid === undefined ||
        !paymentMethod
      ) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const existingPatient = await PatientRegistration.findOne({ invoiceNumber });

      if (existingPatient) {
        const normalizedAmount = Number(amount) || 0;
        const normalizedPaidIncrement = Number(paid) || 0;

        // Apply increments
        existingPatient.amount += normalizedAmount;
        existingPatient.paid += normalizedPaidIncrement;

        // Membership removed

        // Derive correct advance/pending from paid vs amount (avoid double counting)
        const derivedAdvance = Math.max(0, existingPatient.paid - existingPatient.amount);
        const derivedPending = Math.max(0, existingPatient.amount - existingPatient.paid);
        existingPatient.advance = derivedAdvance;
        existingPatient.pending = derivedPending;

        // Record history snapshot after applying the change
        existingPatient.paymentHistory.push({
          amount: existingPatient.amount,
          paid: existingPatient.paid,
          advance: existingPatient.advance,
          pending: existingPatient.pending,
          paymentMethod,
          updatedAt: new Date(),
        });

        await existingPatient.save();

        // Add to PettyCash if payment method is Cash
        await addToPettyCashIfCash(user, existingPatient, normalizedPaidIncrement);

        return res.status(200).json({
          success: true,
          message: "Payment added to existing patient",
          data: existingPatient,
        });
      }

      const normalizedAmount = Number(amount) || 0;
      const normalizedPaid = Number(paid) || 0;
      const derivedAdvanceOnCreate = Math.max(0, normalizedPaid - normalizedAmount);
      const derivedPendingOnCreate = Math.max(0, normalizedAmount - normalizedPaid);

      const patient = await PatientRegistration.create({
        invoiceNumber,
        invoicedBy: computedInvoicedBy,
        userId: user._id,
        emrNumber,
        firstName,
        lastName,
        gender,
        email,
        mobileNumber,
        referredBy,
        patientType,
        doctor,
        service,
        treatment,
        package: packageName,
        amount: normalizedAmount,
        paid: normalizedPaid,
        advance: derivedAdvanceOnCreate,
        paymentMethod,
        insurance,
        insuranceType,
        advanceGivenAmount: Number(advanceGivenAmount) || 0,
        coPayPercent: Number(coPayPercent) || 0,
        advanceClaimStatus,
        advanceClaimReleasedBy,
        notes,
        paymentHistory: [
          {
            amount: normalizedAmount,
            paid: normalizedPaid,
            advance: derivedAdvanceOnCreate,
            pending: derivedPendingOnCreate,
            paymentMethod,
            updatedAt: new Date(),
          },
        ],
      });

      // Add to PettyCash if payment method is Cash
      await addToPettyCashIfCash(user, patient, Number(paid) || 0);

      return res.status(201).json({
        success: true,
        message: "Patient registered successfully",
        data: patient,
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

  // ---------------- GET: list/filter patients ----------------
  if (req.method === "GET") {
    // Allow clinic, staff, admin, agent, and doctorStaff roles
    if (!hasRole(user, ["clinic", "staff", "admin", "agent", "doctorStaff", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
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

  // ---------------- PUT: update patient status/membership ----------------
  if (req.method === "PUT") {
    // Allow staff, admin, agent, doctorStaff, doctor, and clinic roles
    if (!hasRole(user, ["staff", "admin", "agent", "doctorStaff", "doctor", "clinic"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    try {
      const { id, status, membership } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, message: "id is required" });
      }

      const patient = await PatientRegistration.findOne({ _id: id, userId: user._id });
      if (!patient)
        return res.status(404).json({ success: false, message: "Patient not found or unauthorized" });

      if (typeof status === "string") {
        patient.status = status;
      }

      if (typeof membership === "string" && (membership === "Yes" || membership === "No")) {
        patient.membership = membership;
      }
      await patient.save();

      return res.status(200).json({
        success: true,
        message: "Patient updated successfully",
        data: patient,
      });
    } catch (err) {
      console.error("PUT error:", err);
      return res.status(500).json({ success: false, message: "Failed to update patient status" });
    }
  }

  // ---------------- Default response for unsupported methods ----------------
  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}