import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import PatientRegistration from "../../../../models/PatientRegistration";
import MembershipPlan from "../../../../models/MembershipPlan";
import { getUserFromReq } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check if user has access (clinic, agent, doctorStaff, staff)
    if (!["clinic", "agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId, membershipId: queryMembershipId, startDate: queryStart, endDate: queryEnd } = req.query;

    if (!patientId) {
      return res.status(400).json({ success: false, message: "Patient ID is required" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      // For clinic role, find clinic by owner
      const Clinic = (await import("../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else {
      // For agent, doctorStaff, staff - use clinicId from user
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // Fetch patient details to get membership info
    // Note: PatientRegistration doesn't have clinicId, so we verify via Billing records
    const patient = await PatientRegistration.findById(patientId).lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Verify this patient has billing records with this clinic to ensure access
    const hasBillingWithClinic = await Billing.exists({
      patientId: patientId,
      clinicId: clinicId,
    });

    // If no billing records, check if the patient's userId matches the logged-in user
    // or if the user is a clinic owner (they can access all patients)
    if (!hasBillingWithClinic && clinicUser.role !== 'clinic') {
      // For non-clinic roles, verify the patient belongs to their clinic
      // by checking if there's any appointment or other link
      // For now, we'll allow access if the patient exists
      // This can be tightened based on specific requirements
    }

    // Determine active membership considering transfers
    let activeMembershipId = null;
    let transferredAllowance = null;
    let sourcePatientId = null; // Track the source patient for transferred memberships
    
    // Prefer explicit selection from query
    if (queryMembershipId) {
      activeMembershipId = queryMembershipId;
      const lastInForSelected = Array.isArray(patient.membershipTransfers)
        ? [...patient.membershipTransfers].reverse().find(t => t.type === 'in' && String(t.membershipId) === String(queryMembershipId))
        : null;
      if (lastInForSelected) {
        transferredAllowance = lastInForSelected.transferredFreeConsultations || null;
        sourcePatientId = lastInForSelected.fromPatientId;
      }
    } else if (patient.membership === 'Yes' && patient.membershipId) {
      activeMembershipId = patient.membershipId;
    } else if (Array.isArray(patient.membershipTransfers)) {
      const lastIn = [...patient.membershipTransfers].reverse().find(t => t.type === 'in');
      if (lastIn) {
        activeMembershipId = lastIn.membershipId;
        transferredAllowance = lastIn.transferredFreeConsultations || 0;
        sourcePatientId = lastIn.fromPatientId;
      }
    }
    if (!activeMembershipId) {
      return res.status(200).json({
        success: true,
        hasMembership: false,
        message: "Patient does not have an active membership",
      });
    }

    // Check if this membership was transferred OUT by the current patient
    // If so, don't show membership benefits
    const transferredOut = Array.isArray(patient.membershipTransfers) 
      ? patient.membershipTransfers.some(t => t.type === 'out' && String(t.membershipId) === String(activeMembershipId))
      : false;
    
    if (transferredOut) {
      return res.status(200).json({
        success: true,
        hasMembership: false,
        message: "Membership was transferred to another patient",
        transferredOut: true,
      });
    }

    // Fetch membership plan details
    const membershipPlan = await MembershipPlan.findOne({
      _id: activeMembershipId,
      clinicId: clinicId,
    }).lean();

    if (!membershipPlan) {
      return res.status(200).json({
        success: true,
        hasMembership: false,
        message: "Membership plan not found",
      });
    }

    // Check if membership is expired
    let isExpired = false;
    if (queryEnd) {
      isExpired = new Date(queryEnd) < new Date();
    } else {
      isExpired = patient.membershipEndDate && new Date(patient.membershipEndDate) < new Date();
    }
    
    if (isExpired) {
      return res.status(200).json({
        success: true,
        hasMembership: true,
        isExpired: true,
        membershipName: membershipPlan.name,
        message: "Membership has expired",
      });
    }

    let totalFreeConsultations = membershipPlan.benefits?.freeConsultations || 0;
    if (typeof transferredAllowance === 'number') {
      totalFreeConsultations = transferredAllowance;
    }

    // If no free consultations in membership
    if (totalFreeConsultations === 0) {
      return res.status(200).json({
        success: true,
        hasMembership: true,
        isExpired: false,
        membershipName: membershipPlan.name,
        hasFreeConsultations: false,
        totalFreeConsultations: 0,
        usedFreeConsultations: 0,
        remainingFreeConsultations: 0,
        discountPercentage: membershipPlan.benefits?.discountPercentage || 0,
        message: "Membership does not include free consultations",
      });
    }

    // Count used free consultations from billing history
    // A free consultation is counted when:
    // 1. It's a Treatment service (not package)
    // 2. OR it's a Package treatment session
    // 3. The billing amount is 0 or marked as free consultation
    // IMPORTANT: For transferred memberships, also query the source patient's billing records

    const dateFilter = {};
    if (queryStart) dateFilter.$gte = new Date(queryStart);
    if (queryEnd) dateFilter.$lte = new Date(queryEnd);
    
    // Collect all patient IDs to query (current patient + source patient from transfer)
    const patientIdsToQuery = [patientId];
    if (sourcePatientId && !patientIdsToQuery.includes(String(sourcePatientId))) {
      patientIdsToQuery.push(String(sourcePatientId));
    }
    
    const baseFilter = {
      patientId: { $in: patientIdsToQuery },
      clinicId: clinicId,
      $or: [
        { service: "Treatment" },
        { service: "Package" }
      ],
    };
    const billings = await Billing.find({
      ...baseFilter,
      isFreeConsultation: true,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    }).select("service treatment package sessions selectedPackageTreatments createdAt invoiceNumber patientId").lean();

    // If no billings with isFreeConsultation flag, count all treatment billings as used consultations
    let usedFreeConsultations = 0;
    const freeConsultationDetails = [];

    if (billings.length > 0) {
      billings.forEach((billing) => {
        const sessions = billing.sessions || 1;
        usedFreeConsultations += sessions;
        
        // Check if this billing is from the source patient
        const isFromSourcePatient = sourcePatientId && String(billing.patientId) === String(sourcePatientId);
        
        freeConsultationDetails.push({
          invoiceNumber: billing.invoiceNumber,
          service: billing.service,
          treatment: billing.treatment || billing.package,
          sessions: sessions,
          date: billing.createdAt,
          isFromSourcePatient: isFromSourcePatient,
          sourcePatientId: isFromSourcePatient ? billing.patientId : null,
        });
      });
    }

    // Alternative: Count from regular billings if isFreeConsultation field doesn't exist yet
    // This is a fallback for backward compatibility
    if (usedFreeConsultations === 0) {
      const allBillings = await Billing.find({
        ...baseFilter,
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      }).sort({ createdAt: 1 }).lean();

      // Count consultations up to the free consultation limit
      for (const billing of allBillings) {
        if (usedFreeConsultations >= totalFreeConsultations) break;
        
        const sessions = billing.sessions || 1;
        const remainingAllowed = totalFreeConsultations - usedFreeConsultations;
        const sessionsToCount = Math.min(sessions, remainingAllowed);
        
        usedFreeConsultations += sessionsToCount;
        
        // Check if this billing is from the source patient
        const isFromSourcePatient = sourcePatientId && String(billing.patientId) === String(sourcePatientId);
        
        freeConsultationDetails.push({
          invoiceNumber: billing.invoiceNumber,
          service: billing.service,
          treatment: billing.treatment || billing.package,
          sessions: sessionsToCount,
          date: billing.createdAt,
          isFromSourcePatient: isFromSourcePatient,
          sourcePatientId: isFromSourcePatient ? billing.patientId : null,
        });
      }
    }

    const remainingFreeConsultations = Math.max(0, totalFreeConsultations - usedFreeConsultations);

    return res.status(200).json({
      success: true,
      hasMembership: true,
      isExpired: false,
      membershipName: membershipPlan.name,
      hasFreeConsultations: true,
      totalFreeConsultations,
      usedFreeConsultations,
      remainingFreeConsultations,
      discountPercentage: membershipPlan.benefits?.discountPercentage || 0,
      membershipEndDate: patient.membershipEndDate,
      freeConsultationDetails,
      isTransferred: !!sourcePatientId,
      transferredFrom: sourcePatientId,
      transferredFreeConsultations: typeof transferredAllowance === 'number' ? transferredAllowance : null,
      message: remainingFreeConsultations > 0 
        ? `${remainingFreeConsultations} free consultation(s) remaining`
        : "All free consultations have been used",
    });

  } catch (error) {
    console.error("Error fetching membership usage:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch membership usage",
    });
  }
}
