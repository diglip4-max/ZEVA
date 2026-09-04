import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import Clinic from "../../../models/Clinic";

const hasRole = (user, roles = []) => roles.includes(user.role);


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
        city,
        referredBy,
        patientType,
        insurance,
        insuranceType,
        advanceGivenAmount,
        coPayPercent,
        advanceClaimStatus,
        advanceClaimReleasedBy,
        notes,
        membership,
        membershipStartDate,
        membershipEndDate,
        membershipId,
        package: pkgToggle,
        packageId,
        memberships: membershipsArray,
        packages: packagesArray,
      } = req.body;

      const computedInvoicedBy =
        invoicedBy ||
        user.name ||
        user.fullName ||
        user.email ||
        user.username ||
        user.mobileNumber ||
        String(user._id);

      // Only require invoiceNumber, firstName, and mobileNumber (same as clinic API)
      // Gender is optional - will default to "Other" if not provided
      if (
        !invoiceNumber ||
        !firstName ||
        !mobileNumber
      ) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: invoiceNumber, firstName, and mobileNumber are required" 
        });
      }

      const existingPatient = await PatientRegistration.findOne({ invoiceNumber });

      if (existingPatient) {
        // Check access for agents/doctorStaff before updating
        if (user.role === 'agent' || user.role === 'doctorStaff') {
           if (existingPatient.userId && existingPatient.userId.toString() !== user._id.toString()) {
               if (user.clinicId) {
                  const Clinic = (await import("../../../models/Clinic")).default;
                  const clinic = await Clinic.findById(user.clinicId);
                  if (clinic) {
                      const User = (await import("../../../models/Users")).default;
                      const clinicUsers = await User.find({
                          $or: [
                              { _id: clinic.owner },
                              { clinicId: user.clinicId }
                          ]
                      }).select("_id");
                      const allowedIds = clinicUsers.map(u => u._id.toString());
                      if (!allowedIds.includes(existingPatient.userId.toString())) {
                           return res.status(403).json({ success: false, message: "Access denied: Patient belongs to another clinic" });
                      }
                  } else {
                       return res.status(403).json({ success: false, message: "Access denied" });
                  }
               } else {
                   return res.status(403).json({ success: false, message: "Access denied" });
               }
           }
        }

        // Update existing patient with new data
        if (emrNumber !== undefined) existingPatient.emrNumber = emrNumber;
        if (firstName !== undefined) existingPatient.firstName = firstName;
        if (lastName !== undefined) existingPatient.lastName = lastName;
        if (gender !== undefined) existingPatient.gender = gender;
        if (email !== undefined) existingPatient.email = email;
        if (mobileNumber !== undefined) existingPatient.mobileNumber = mobileNumber;
        if (city !== undefined) existingPatient.city = city;
        if (referredBy !== undefined) existingPatient.referredBy = referredBy;
        if (patientType !== undefined && String(patientType).trim() !== "") {
          existingPatient.patientType = patientType;
        }
        if (notes !== undefined) existingPatient.notes = notes;
        
        // Insurance handling
        if (insurance === "Yes") {
          existingPatient.insurance = "Yes";
          existingPatient.insuranceType = insuranceType || existingPatient.insuranceType || "Paid";
          existingPatient.advanceGivenAmount = advanceGivenAmount !== undefined ? Number(advanceGivenAmount) : existingPatient.advanceGivenAmount;
          existingPatient.coPayPercent = coPayPercent !== undefined ? Number(coPayPercent) : existingPatient.coPayPercent;
          if (!existingPatient.advanceClaimStatus) {
            existingPatient.advanceClaimStatus = "Pending";
          }
        } else if (insurance === "No") {
          existingPatient.insurance = "No";
          existingPatient.insuranceType = "Paid";
          existingPatient.advanceGivenAmount = 0;
          existingPatient.coPayPercent = 0;
          existingPatient.advanceClaimStatus = null;
        }

        // Membership handling
        if (membership === "Yes") {
          existingPatient.membership = "Yes";
          if (membershipStartDate) existingPatient.membershipStartDate = new Date(membershipStartDate);
          if (membershipEndDate) existingPatient.membershipEndDate = new Date(membershipEndDate);
        } else if (membership === "No") {
          existingPatient.membership = "No";
          existingPatient.membershipStartDate = null;
          existingPatient.membershipEndDate = null;
        }

        await existingPatient.save();

        return res.status(200).json({
          success: true,
          message: "Patient updated successfully",
          data: existingPatient,
        });
      }

      const normalizedPatientType = (typeof patientType === "string" && patientType.trim() !== "") ? patientType : undefined;

      // ── Resolve missing packageName from Package master (non-breaking) ──
      // Background: clients occasionally omit `packageName` in the body, which
      // previously caused empty names to be persisted in PatientRegistration.packages
      // and broke the {patientId, packageName} grouping key used by the
      // Packages Sold vs Active Packages KPIs. We now batch-lookup the Package
      // master for any input row whose name is blank and fall back to it.
      // This is purely additive: if the client already provided a valid name,
      // we use it as-is and never overwrite it. The whole lookup is wrapped in
      // try/catch so a transient failure here cannot break patient registration.
      let pkgMasterMap = new Map();
      if (Array.isArray(packagesArray) && packagesArray.length > 0) {
        try {
          const { default: Package } = await import("../../../models/Package");
          const idsToLookup = packagesArray
            .map((p) => p && p.packageId)
            .filter((id) => id && /^[a-fA-F0-9]{24}$/.test(String(id)));
          if (idsToLookup.length > 0) {
            const masters = await Package.find({ _id: { $in: idsToLookup } })
              .select("_id name")
              .lean();
            pkgMasterMap = new Map(
              masters.map((m) => [String(m._id), m]),
            );
          }
        } catch (pkgLookupErr) {
          // Never block patient registration on a failed package-name lookup.
          console.warn(
            "[patient-registration] Package master lookup failed (non-blocking):",
            pkgLookupErr?.message || pkgLookupErr,
          );
        }
      }

      const patient = await PatientRegistration.create({
        invoiceNumber,
        invoicedBy: computedInvoicedBy,
        userId: user._id,
        emrNumber: emrNumber || "",
        firstName,
        lastName: lastName || "",
        gender: gender || undefined, // Leave undefined if not provided
        email: email || "",
        mobileNumber,
        city: city || "",
        referredBy: referredBy || "",
        patientType: normalizedPatientType || "New",
        insurance: insurance || "No",
        insuranceType: insuranceType || "Paid",
        advanceGivenAmount: Number(advanceGivenAmount) || 0,
        coPayPercent: Number(coPayPercent) || 0,
        advanceClaimStatus: advanceClaimStatus || "Pending",
        notes: notes || "",
        membership: membership || "No",
        membershipStartDate: membership === "Yes" && membershipStartDate ? new Date(membershipStartDate) : null,
        membershipEndDate: membership === "Yes" && membershipEndDate ? new Date(membershipEndDate) : null,
        membershipId: membership === "Yes" && membershipId ? membershipId : null,
        package: pkgToggle || "No",
        packageId: pkgToggle === "Yes" && packageId ? packageId : null,
        memberships: Array.isArray(membershipsArray)
          ? membershipsArray.map((m) => ({
              membershipId: m.membershipId,
              startDate: m.startDate ? new Date(m.startDate) : undefined,
              endDate: m.endDate ? new Date(m.endDate) : undefined,
            }))
          : (membership === "Yes" && membershipId
              ? [{
                  membershipId,
                  startDate: membershipStartDate ? new Date(membershipStartDate) : undefined,
                  endDate: membershipEndDate ? new Date(membershipEndDate) : undefined,
                }]
              : []),
        packages: Array.isArray(packagesArray)
          ? packagesArray.map((p) => {
              // Preserve client-provided name when present; otherwise resolve from
              // the Package master that we just batch-fetched above. Final fallback
              // is an empty string to keep the existing field-shape unchanged.
              const hasClientName =
                typeof p?.packageName === "string" && p.packageName.trim().length > 0;
              const resolvedName = hasClientName
                ? p.packageName.trim()
                : p?.packageId
                  ? pkgMasterMap.get(String(p.packageId))?.name || ""
                  : "";
              return {
                packageId: p.packageId,
                packageName: resolvedName,
                packageSoldBy: p.packageSoldBy || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                assignedDate: p.assignedDate ? new Date(p.assignedDate) : undefined,
              };
            })
          : (pkgToggle === "Yes" && packageId
              ? [{
                  packageId,
                  assignedDate: new Date(),
                  packageSoldBy: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'
                }]
              : []),
      });

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
          // Build query based on user role - CRITICAL: scope to clinicId OR userId in clinicUsers
      let scopeFilter = {};
      
      // For clinic role: show all patients belonging to the clinic (clinic owner + all agents/doctorStaff linked to clinic)
      if (user.role === 'clinic') {
        const Clinic = (await import("../../../models/Clinic")).default;
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const User = (await import("../../../models/Users")).default;
          const clinicUsers = await User.find({
            $or: [
              { _id: user._id }, // Clinic owner
              { clinicId: clinic._id } // Agents and doctorStaff linked to clinic
            ]
          }).select("_id");
          const clinicUserIds = clinicUsers.map(u => u._id);
          scopeFilter = {
            $or: [
              { userId: { $in: clinicUserIds } },
              { clinicId: clinic._id }
            ]
          };
        } else {
          scopeFilter = { userId: user._id };
        }
      } 
      // For agent/doctorStaff: show all patients belonging to the clinic
      else if (user.role === 'agent' || user.role === 'doctorStaff') {
        if (user.clinicId) {
          const Clinic = (await import("../../../models/Clinic")).default;
          const clinic = await Clinic.findById(user.clinicId);
          if (clinic) {
            const User = (await import("../../../models/Users")).default;
            const clinicUsers = await User.find({
              $or: [
                { _id: clinic.owner },
                { clinicId: user.clinicId }
              ]
            }).select("_id");
            scopeFilter = {
              $or: [
                { userId: { $in: clinicUsers.map(u => u._id) } },
                { clinicId: user.clinicId }
              ]
            };
          } else {
            scopeFilter = { userId: user._id };
          }
        } else {
          scopeFilter = { userId: user._id };
        }
      }
      // For other roles: show their own patients
      else {
        scopeFilter = { userId: user._id };
      }

      // Build overall query using $and to avoid keys/operators collisions
      const andConditions = [scopeFilter];

      if (emrNumber) andConditions.push({ emrNumber: { $regex: emrNumber, $options: "i" } });
      if (invoiceNumber) andConditions.push({ invoiceNumber: { $regex: invoiceNumber, $options: "i" } });
      if (phone) andConditions.push({ mobileNumber: { $regex: phone, $options: "i" } });
      if (claimStatus) andConditions.push({ advanceClaimStatus: claimStatus });
      if (applicationStatus) andConditions.push({ status: applicationStatus });
      if (name) {
        andConditions.push({
          $or: [
            { firstName: { $regex: name, $options: "i" } },
            { lastName: { $regex: name, $options: "i" } },
          ]
        });
      }

      const query = { $and: andConditions };

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

    // ✅ Check permissions for updating patients (admin bypasses all checks)
    if (user.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (user.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "patient_registration",
            "update"
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || "You do not have permission to update patients"
            });
          }
        }
      }
      // For agent role (agentToken): Check agent permissions
      else if (user.role === 'agent') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "update"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to update patients"
          });
        }
      }
      // For doctorStaff role (userToken): Check agent permissions
      else if (user.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "update"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to update patients"
          });
        }
      }
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
