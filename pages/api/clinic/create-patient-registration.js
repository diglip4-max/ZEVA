import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import Appointment from "../../../models/Appointment";
import Referral from "../../../models/Referral";
import Commission from "../../../models/Commission";
import AgentProfile from "../../../models/AgentProfile";
import { getUserFromReq } from "../lead-ms/auth";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import { calculateCommissionForStaff } from "../../../lib/commissionCalculator";

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
      advanceUsed,
      paymentMethod,
      notes,
      emrNumber,
      userId, // PatientRegistration ID from appointment (appointment.patientId)
      referredBy,
      selectedPackageTreatments, // Array of treatments with sessions used from package
      // Multiple payment methods for split payments
      multiplePayments, // Array of { paymentMethod, amount }
      pendingUsed, // Amount of previous pending being cleared
      // Membership tracking fields
      isFreeConsultation,
      freeConsultationCount,
      membershipDiscountApplied,
      originalAmount,
    } = req.body;

    // Validate required fields
    if (!invoiceNumber || !appointmentId || !firstName || !mobileNumber || !doctor || !service) {
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

    if (service === "Package") {
      if (!packageName || !Array.isArray(selectedPackageTreatments) || selectedPackageTreatments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select a package and at least one treatment",
        });
      }
      const Package = (await import("../../../models/Package")).default;
      const pkgDoc = await Package.findOne({ clinicId: clinic._id, name: packageName }).lean();
      if (!pkgDoc) {
        return res.status(404).json({
          success: false,
          message: "Selected package not found",
        });
      }
      const maxSessionsMap = new Map();
      (pkgDoc.treatments || []).forEach((t) => {
        if (t.treatmentSlug) {
          maxSessionsMap.set(t.treatmentSlug, parseInt(t.sessions) || 0);
        }
      });
      const previousBillings = await Billing.find({
        clinicId: clinic._id,
        patientId: patientRegistration._id,
        service: "Package",
        package: packageName,
      })
        .select("selectedPackageTreatments")
        .lean();
      const previouslyUsedMap = new Map();
      previousBillings.forEach((b) => {
        (b.selectedPackageTreatments || []).forEach((t) => {
          if (!t.treatmentSlug) return;
          const prev = previouslyUsedMap.get(t.treatmentSlug) || 0;
          previouslyUsedMap.set(t.treatmentSlug, prev + (parseInt(t.sessions) || 0));
        });
      });
      for (const t of selectedPackageTreatments) {
        const slug = t.treatmentSlug;
        const newSessions = parseInt(t.sessions) || 0;
        const maxSessions = maxSessionsMap.get(slug);
        if (maxSessions === undefined) {
          return res.status(400).json({
            success: false,
            message: `Treatment not part of package: ${t.treatmentName || slug}`,
          });
        }
        const previouslyUsed = previouslyUsedMap.get(slug) || 0;
        const remaining = Math.max(0, (maxSessions || 0) - previouslyUsed);
        if (remaining <= 0) {
          return res.status(400).json({
            success: false,
            message: "This treatment has already used all available sessions.",
            details: {
              treatmentSlug: slug,
              treatmentName: t.treatmentName,
              totalSessions: maxSessions,
              usedSessions: previouslyUsed,
              remainingSessions: 0,
            },
          });
        }
        if (newSessions < 1 || newSessions > remaining) {
          return res.status(400).json({
            success: false,
            message: `Invalid session count for ${t.treatmentName || slug}. You can bill 1–${remaining} session(s).`,
            details: {
              treatmentSlug: slug,
              treatmentName: t.treatmentName,
              totalSessions: maxSessions,
              usedSessions: previouslyUsed,
              remainingSessions: remaining,
              requestedSessions: newSessions,
            },
          });
        }
      }
      const sumSessions = selectedPackageTreatments.reduce((sum, it) => sum + (parseInt(it.sessions) || 0), 0);
      req.body.sessions = sumSessions;
    }

    // Calculate pending and advance (use provided values or calculate)
    const amountNum = parseFloat(amount) || 0;
    const advanceUsedNum = advanceUsed !== undefined ? Math.max(0, parseFloat(advanceUsed) || 0) : 0;
    const pendingUsedNum = pendingUsed !== undefined ? Math.max(0, parseFloat(pendingUsed) || 0) : 0;
    const pendingNum = pending !== undefined ? parseFloat(pending) || 0 : 0;
    const advanceNum = advance !== undefined ? parseFloat(advance) || 0 : 0;

    // Calculate paid from multiple payments if provided
    let paidNum = parseFloat(paid) || 0;
    const multiPayArr = Array.isArray(multiplePayments) && multiplePayments.length > 0 ? multiplePayments : [];
    if (multiPayArr.length > 0) {
      paidNum = multiPayArr.reduce((sum, mp) => sum + (parseFloat(mp.amount) || 0), 0);
    }
    
    // If pending/advance not provided, calculate them
    let finalPending = pendingNum;
    let finalAdvance = advanceNum;
    
    if (pending === undefined && advance === undefined) {
      // Auto-calculate if not provided, considering applied advanceUsed
      const effectiveDue = Math.max(0, amountNum - advanceUsedNum);
      finalPending = Math.max(0, effectiveDue - paidNum);
      finalAdvance = Math.max(0, paidNum - effectiveDue);
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
      selectedPackageTreatments: service === "Package" && Array.isArray(selectedPackageTreatments) ? selectedPackageTreatments : [],
      amount: amountNum,
      paid: paidNum,
      advanceUsed: advanceUsedNum,
      pendingUsed: pendingUsedNum,
      pending: finalPending,
      advance: finalAdvance,
      paymentMethod,
      multiplePayments: multiPayArr.map(mp => ({
        paymentMethod: mp.paymentMethod,
        amount: parseFloat(mp.amount) || 0,
      })),
      paymentHistory: [
        {
          amount: amountNum,
          paid: paidNum,
          pending: finalPending,
          paymentMethod,
          multiplePayments: multiPayArr.map(mp => ({
            paymentMethod: mp.paymentMethod,
            amount: parseFloat(mp.amount) || 0,
          })),
          status: "Active",
          updatedAt: new Date(),
        },
      ],
      notes: notes || "",
      // Membership tracking fields
      isFreeConsultation: isFreeConsultation || false,
      freeConsultationCount: freeConsultationCount || 0,
      membershipDiscountApplied: membershipDiscountApplied || 0,
      originalAmount: originalAmount || amountNum,
    };

    const billing = await Billing.create(billingData);

    // Commission calculation and storage
    try {
      const paidNumForCommission = paidNum;
      const referredByStr = String(referredBy || "").trim();
      if (paidNumForCommission > 0 && referredByStr && referredByStr.toLowerCase() !== "no") {
        // Find referral by combined name within this clinic
        const referrals = await Referral.find({ clinicId: clinic._id }).lean();
        const match = referrals.find((r) => {
          const full = `${(r.firstName || "").trim()} ${(r.lastName || "").trim()}`.trim().toLowerCase();
          return full && full === referredByStr.toLowerCase();
        });
        if (match) {
          const commissionPercent = Number(match.referralPercent || 0);
          if (commissionPercent > 0) {
            const commissionAmount = Number(((paidNumForCommission * commissionPercent) / 100).toFixed(2));
            // Optionally try to map to a staff user via email or phone
            let staffId = null;
            if (match.email || match.phone) {
              const userCandidate = await User.findOne({
                clinicId: clinic._id,
                $or: [
                  match.email ? { email: String(match.email).toLowerCase() } : { _id: null },
                  match.phone ? { phone: String(match.phone) } : { _id: null },
                ],
              }).lean();
              if (userCandidate) {
                staffId = userCandidate._id;
              }
            }
            await Commission.create({
              clinicId: clinic._id,
              source: "referral",
              referralId: match._id,
              referralName: `${(match.firstName || "").trim()} ${(match.lastName || "").trim()}`.trim(),
              staffId,
              appointmentId: appointment._id,
              patientId: patientRegistration._id,
              billingId: billing._id,
              commissionPercent,
              amountPaid: paidNumForCommission,
              commissionAmount,
              invoicedDate: new Date(invoicedDate),
              notes: notes || "",
              createdBy: clinicUser._id,
            });
          }
        }
      }
    } catch (commissionErr) {
      console.error("Commission calculation/store error (referral):", commissionErr);
      // Do not fail the billing creation if commission creation fails
    }

    // Doctor/Staff commission based on AgentProfile (supports flat, target-based, and after_deduction)
    try {
      if (paidNum > 0 && appointment?.doctorId) {
        // Use the commission calculator to determine commission
        const commissionResult = await calculateCommissionForStaff({
          staffId: appointment.doctorId,
          clinicId: clinic._id,
          paidAmount: paidNum,
          patientId: patientRegistration._id,
          appointmentId: appointment._id,
          currentBillingId: billing._id, // Pass the billing ID to exclude it from "last billing" query
        });

        if (commissionResult.shouldCreateCommission) {
          const commissionData = {
            clinicId: clinic._id,
            source: "staff",
            staffId: appointment.doctorId,
            commissionType: commissionResult.commissionType,
            appointmentId: appointment._id,
            patientId: patientRegistration._id,
            billingId: billing._id,
            commissionPercent: commissionResult.commissionPercentage,
            amountPaid: paidNum,
            commissionAmount: commissionResult.commissionAmount,
            invoicedDate: new Date(invoicedDate),
            notes: notes || "",
            createdBy: clinicUser._id,
          };

          // Add target-based specific fields if applicable
          if (commissionResult.commissionType === "target_based") {
            commissionData.targetAmount = commissionResult.targetAmount || 0;
            commissionData.cumulativeAchieved = commissionResult.cumulativeAchieved || 0;
            commissionData.isAboveTarget = commissionResult.isAboveTarget || false;
          }

          // Add after_deduction specific fields if applicable
          if (commissionResult.commissionType === "after_deduction") {
            commissionData.totalExpenses = commissionResult.totalExpenses || 0;
            commissionData.netAmount = commissionResult.netAmount || 0;
            commissionData.expenseBreakdown = commissionResult.expenseBreakdown || [];
            commissionData.complaintsCount = commissionResult.complaintsCount || 0;
            commissionData.lastBillingDate = commissionResult.lastBillingDate || null;
            commissionData.lastBillingInvoice = commissionResult.lastBillingInvoice || null;
            commissionData.isFirstBilling = commissionResult.isFirstBilling || false;
          }

          await Commission.create(commissionData);
        } else {
          console.log(`Commission not created for staff ${appointment.doctorId}: ${commissionResult.reason}`);
        }
      }
    } catch (staffCommissionErr) {
      console.error("Commission calculation/store error (staff):", staffCommissionErr);
      // Do not fail the billing creation if commission creation fails
    }

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

