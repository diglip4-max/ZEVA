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
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ✅ Check permissions for creating patients (admin bypasses all checks)
    if (clinicUser.role !== "admin") {
      // For clinic role: Check clinic permissions
      if (clinicUser.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: clinicUser._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } =
            await checkClinicPermission(
              clinic._id,
              "patient_registration",
              "create",
            );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message:
                clinicError || "You do not have permission to create patients",
            });
          }
        }
      }
      // For agent role (agentToken): Check agent permissions
      else if (clinicUser.role === "agent") {
        const { hasPermission: agentHasPermission, error: agentError } =
          await checkAgentPermission(
            clinicUser._id,
            "patient_registration",
            "create",
          );

        // Fallback: Check clinic_ScheduledAppointment if patient_registration is denied
        if (!agentHasPermission) {
          const { hasPermission: appointmentHasPermission } =
            await checkAgentPermission(
              clinicUser._id,
              "clinic_ScheduledAppointment",
              "create",
            );

          if (!appointmentHasPermission) {
            return res.status(403).json({
              success: false,
              message:
                agentError || "You do not have permission to create patients",
            });
          }
        }
      }
      // For doctorStaff role (userToken): Check agent permissions
      else if (clinicUser.role === "doctorStaff") {
        const { hasPermission: agentHasPermission, error: agentError } =
          await checkAgentPermission(
            clinicUser._id,
            "patient_registration",
            "create",
          );

        // Fallback: Check clinic_ScheduledAppointment if patient_registration is denied
        if (!agentHasPermission) {
          const { hasPermission: appointmentHasPermission } =
            await checkAgentPermission(
              clinicUser._id,
              "clinic_ScheduledAppointment",
              "create",
            );

          if (!appointmentHasPermission) {
            return res.status(403).json({
              success: false,
              message:
                agentError || "You do not have permission to create patients",
            });
          }
        }
      }
    }

    // Find clinic
    let clinic;
    if (clinicUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: clinicUser._id });
    } else if (
      ["agent", "doctorStaff", "staff", "doctor"].includes(clinicUser.role)
    ) {
      if (!clinicUser.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
      clinic = await Clinic.findById(clinicUser.clinicId);
    } else if (clinicUser.role === "admin") {
      // For admin, if no clinicId on user, try to get from appointment in body
      if (clinicUser.clinicId) {
        clinic = await Clinic.findById(clinicUser.clinicId);
      } else if (req.body.appointmentId) {
        const appointment = await Appointment.findById(req.body.appointmentId);
        if (appointment && appointment.clinicId) {
          clinic = await Clinic.findById(appointment.clinicId);
        }
      }
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
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
        pastAdvance,
        pastAdvanceUsed,
        applyPastAdvance,
        pastAdvanceUsed50Percent,
        pastAdvanceUsed54Percent,
        pastAdvanceUsed159Flat,
        pastAdvanceType,
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
        isDoctorDiscountApplied,
        doctorDiscountType,
        doctorDiscountAmount,
        isAgentDiscountApplied,
        agentDiscountType,
        agentDiscountAmount,
        discountPercent,
        originalAmount,
        isUserPackage, // Added for user-created packages
        patientPackageId, // Added for user-created packages
        patientPackageSubId, // Added for user-created packages (sub-document ID)
      } = req.body;

    console.log({ bmModify: req.body });

    // Validate required fields
    if (
      !invoiceNumber ||
      !appointmentId ||
      !firstName ||
      !mobileNumber ||
      !doctor ||
      !service
    ) {
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
          message:
            "Patient registration not found. Please register the patient first.",
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

    console.log("=== DEBUG BILLING PACKAGE ===");
    console.log("Service:", service);
    console.log("Package Name:", packageName);
    console.log("isUserPackage:", isUserPackage);
    console.log("patientPackageId:", patientPackageId);
    console.log("PatientRegistration ID (userId):", userId);

    if (service === "Package") {
      if (
        !packageName ||
        !Array.isArray(selectedPackageTreatments) ||
        selectedPackageTreatments.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Please select a package and at least one treatment",
        });
      }
      const Package = (await import("../../../models/Package")).default;
      const UserPackage = (await import("../../../models/UserPackage")).default;

      let pkgDoc;
      if (isUserPackage && (patientPackageId || patientPackageSubId)) {
        console.log("Looking up UserPackage with primary ID:", patientPackageId, "or sub-ID:", patientPackageSubId);
        
        // Try looking up by primary ID first (actual UserPackage document ID)
        if (patientPackageId) {
          pkgDoc = await UserPackage.findById(patientPackageId).lean();
        }
        
        console.log("Initial UserPackage lookup result:", pkgDoc ? "Found" : "NOT FOUND");
        
        // If not found, try looking into patientRegistration.userPackages
        if (!pkgDoc && patientRegistration && patientRegistration.userPackages) {
          console.log("Checking PatientRegistration.userPackages for match...");
          const matchInPatient = patientRegistration.userPackages.find(
            up => (patientPackageId && String(up.packageId) === String(patientPackageId)) || 
                  (patientPackageSubId && String(up._id) === String(patientPackageSubId)) ||
                  (patientPackageId && String(up._id) === String(patientPackageId))
          );
          
          if (matchInPatient) {
            console.log("Found match in PatientRegistration.userPackages:", matchInPatient);
            // Re-try using the actual packageId from the sub-document
            pkgDoc = await UserPackage.findById(matchInPatient.packageId).lean();
            console.log("Retry UserPackage lookup with matchInPatient.packageId:", pkgDoc ? "Found" : "NOT FOUND");
          }
        }
      } else {
        console.log("Looking up regular Package with name:", packageName, "and clinicId:", clinic._id);
        // Otherwise, find it by clinicId and name in the regular Package model
        pkgDoc = await Package.findOne({
          clinicId: clinic._id,
          name: packageName,
        }).lean();
        console.log("Regular Package lookup result:", pkgDoc ? "Found" : "NOT FOUND");
      }

      if (!pkgDoc) {
        console.log("PACKAGE NOT FOUND - details:", {
          packageName,
          isUserPackage,
          patientPackageId,
          clinicId: clinic._id
        });
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

      const previousBillingsQuery = {
        clinicId: clinic._id,
        patientId: patientRegistration._id,
        service: "Package",
      };

      if (isUserPackage && (patientPackageId || patientPackageSubId)) {
        previousBillingsQuery.$or = [
          { patientPackageId: patientPackageId },
          { patientPackageSubId: patientPackageSubId }
        ];
      } else {
        previousBillingsQuery.package = packageName;
      }

      const previousBillings = await Billing.find(previousBillingsQuery)
        .select("selectedPackageTreatments")
        .lean();
      const previouslyUsedMap = new Map();
      previousBillings.forEach((b) => {
        (b.selectedPackageTreatments || []).forEach((t) => {
          if (!t.treatmentSlug) return;
          const prev = previouslyUsedMap.get(t.treatmentSlug) || 0;
          previouslyUsedMap.set(
            t.treatmentSlug,
            prev + (parseInt(t.sessions) || 0),
          );
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
      const sumSessions = selectedPackageTreatments.reduce(
        (sum, it) => sum + (parseInt(it.sessions) || 0),
        0,
      );
      req.body.sessions = sumSessions;
    }

    // Calculate pending and advance (use provided values or calculate)
    const amountNum = parseFloat(amount) || 0;
    const advanceUsedNum =
      advanceUsed !== undefined ? Math.max(0, parseFloat(advanceUsed) || 0) : 0;
    const pastAdvanceUsedNum =
      pastAdvanceUsed !== undefined
        ? Math.max(0, parseFloat(pastAdvanceUsed) || 0)
        : 0;
    const pastAdvanceUsed50PercentNum =
      pastAdvanceUsed50Percent !== undefined
        ? Math.max(0, parseFloat(pastAdvanceUsed50Percent) || 0)
        : 0;
    const pastAdvanceUsed54PercentNum =
      pastAdvanceUsed54Percent !== undefined
        ? Math.max(0, parseFloat(pastAdvanceUsed54Percent) || 0)
        : 0;
    const pastAdvanceUsed159FlatNum =
      pastAdvanceUsed159Flat !== undefined
        ? Math.max(0, parseFloat(pastAdvanceUsed159Flat) || 0)
        : 0;

    const totalPastAdvanceUsed =
      pastAdvanceUsed50PercentNum +
      pastAdvanceUsed54PercentNum +
      pastAdvanceUsed159FlatNum;
    const pendingUsedNum =
      pendingUsed !== undefined ? Math.max(0, parseFloat(pendingUsed) || 0) : 0;
    const pendingNum = pending !== undefined ? parseFloat(pending) || 0 : 0;
    const advanceNum = advance !== undefined ? parseFloat(advance) || 0 : 0;
    const pastAdvanceNum =
      pastAdvance !== undefined ? parseFloat(pastAdvance) || 0 : 0;

    // Calculate paid from multiple payments if provided
    let paidNum = parseFloat(paid) || 0;
    const multiPayArr =
      Array.isArray(multiplePayments) && multiplePayments.length > 0
        ? multiplePayments
        : [];
    if (multiPayArr.length > 0) {
      paidNum = multiPayArr.reduce(
        (sum, mp) => sum + (parseFloat(mp.amount) || 0),
        0,
      );
    }

    // Auto-calculate if pending/advance/pastAdvance are not explicitly provided
    // or ensure they follow the standard logic
    let finalPending = parseFloat(pending) || 0;
    let finalAdvance = parseFloat(advance) || 0;
    let finalPastAdvance = Math.max(0, pastAdvanceNum - pastAdvanceUsedNum);

    // Standard logic for billing calculation:
    // 1. Total Amount
    // 2. Applied Credits (advanceUsed + pastAdvanceUsed)
    // 3. Net Due = Total - Credits
    // 4. Final Pending = Net Due - Paid (if Net Due > Paid)
    // 5. Final Advance = Paid - Net Due (if Paid > Net Due)

    const netDue = Math.max(
      0,
      amountNum - advanceUsedNum - totalPastAdvanceUsed,
    );
    console.log({ netDue, paidNum, advanceUsedNum, pastAdvanceUsedNum });

    if (paidNum > netDue) {
      finalAdvance = paidNum - netDue;
      finalPending = 0;
    } else {
      finalPending = netDue - paidNum;
      finalAdvance = 0;
    }

    // Use the calculated final values for storage
    const pendingToStore = finalPending;
    const advanceToStore = finalAdvance;

    // Create billing record
    const billingData = {
      clinicId: clinic._id,
      appointmentId: appointment._id,
      patientId: patientRegistration._id,
      invoiceNumber,
      invoicedDate: new Date(invoicedDate),
      invoicedBy: clinicUser.name || "Clinic Staff",
      invoicedById: clinicUser._id,
      doctorId: appointment.doctorId || null,
      service,
      treatment: service === "Treatment" ? treatment || "" : "",
      package: service === "Package" ? packageName || "" : "",
      patientPackageId: service === "Package" && isUserPackage && patientPackageId ? patientPackageId : null,
      patientPackageSubId: service === "Package" && isUserPackage && patientPackageSubId ? patientPackageSubId : null,
      quantity: service === "Treatment" ? parseInt(quantity) || 1 : 1,
      sessions: service === "Package" ? parseInt(sessions) || 0 : 0,
      selectedPackageTreatments:
        service === "Package" && Array.isArray(selectedPackageTreatments)
          ? selectedPackageTreatments
          : [],
      amount: amountNum,
      paid: paidNum, // ONLY store actual money received today (not credits)
      advanceUsed: advanceUsedNum, // Use the parsed number
      pendingUsed: pendingUsedNum, // Use the parsed number
      pastAdvanceUsed: totalPastAdvanceUsed,
      pastAdvanceUsed50Percent: pastAdvanceUsed50PercentNum,
      pastAdvanceUsed54Percent: pastAdvanceUsed54PercentNum,
      pastAdvanceUsed159Flat: pastAdvanceUsed159FlatNum,
      pastAdvanceType,
      pending: pendingToStore,
      advance: advanceToStore,
      pastAdvance: finalPastAdvance,
      paymentMethod,
      multiplePayments: multiPayArr.map((mp) => ({
        paymentMethod: mp.paymentMethod,
        amount: parseFloat(mp.amount) || 0,
      })),
      paymentHistory: [
        {
          amount: amountNum,
          paid: paidNum,
          pending: finalPending,
          paymentMethod,
          multiplePayments: multiPayArr.map((mp) => ({
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
      isDoctorDiscountApplied: isDoctorDiscountApplied || false,
      doctorDiscountType: doctorDiscountType || null,
      doctorDiscountAmount: doctorDiscountAmount || 0,
      isAgentDiscountApplied: isAgentDiscountApplied || false,
      agentDiscountType: agentDiscountType || null,
      agentDiscountAmount: agentDiscountAmount || 0,
      discountPercent: discountPercent || 0,
      originalAmount: originalAmount || amountNum,
      isAdvanceOnly: false,
    };

    console.log({ billingData });

    const billing = await Billing.create(billingData);

    // Commission calculation and storage
    try {
      const paidNumForCommission = paidNum;
      const referredByStr = String(referredBy || "").trim();
      if (
        paidNumForCommission > 0 &&
        referredByStr &&
        referredByStr.toLowerCase() !== "no"
      ) {
        // Find referral by combined name within this clinic
        const referrals = await Referral.find({ clinicId: clinic._id }).lean();
        const match = referrals.find((r) => {
          const full =
            `${(r.firstName || "").trim()} ${(r.lastName || "").trim()}`
              .trim()
              .toLowerCase();
          return full && full === referredByStr.toLowerCase();
        });
        if (match) {
          const commissionPercent = Number(match.referralPercent || 0);
          if (commissionPercent > 0) {
            const commissionAmount = Number(
              ((paidNumForCommission * commissionPercent) / 100).toFixed(2),
            );
            // Optionally try to map to a staff user via email or phone
            let staffId = null;
            if (match.email || match.phone) {
              const userCandidate = await User.findOne({
                clinicId: clinic._id,
                $or: [
                  match.email
                    ? { email: String(match.email).toLowerCase() }
                    : { _id: null },
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
              referralName:
                `${(match.firstName || "").trim()} ${(match.lastName || "").trim()}`.trim(),
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
      console.error(
        "Commission calculation/store error (referral):",
        commissionErr,
      );
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
            commissionData.cumulativeAchieved =
              commissionResult.cumulativeAchieved || 0;
            commissionData.isAboveTarget =
              commissionResult.isAboveTarget || false;
          }

          // Add after_deduction specific fields if applicable
          if (commissionResult.commissionType === "after_deduction") {
            commissionData.totalExpenses = commissionResult.totalExpenses || 0;
            commissionData.netAmount = commissionResult.netAmount || 0;
            commissionData.expenseBreakdown =
              commissionResult.expenseBreakdown || [];
            commissionData.complaintsCount =
              commissionResult.complaintsCount || 0;
            commissionData.lastBillingDate =
              commissionResult.lastBillingDate || null;
            commissionData.lastBillingInvoice =
              commissionResult.lastBillingInvoice || null;
            commissionData.isFirstBilling =
              commissionResult.isFirstBilling || false;
          }

          // Add target_plus_expense specific fields if applicable
          if (commissionResult.commissionType === "target_plus_expense") {
            commissionData.targetAmount = commissionResult.targetAmount || 0;
            commissionData.cumulativeAchieved =
              commissionResult.cumulativeAchieved || 0;
            commissionData.isAboveTarget =
              commissionResult.isAboveTarget || false;
            commissionData.amountAboveTarget =
              commissionResult.amountAboveTarget || 0;
            commissionData.totalExpenses = commissionResult.totalExpenses || 0;
            commissionData.netCommissionableAmount =
              commissionResult.netCommissionableAmount || 0;
            commissionData.expenseBreakdown =
              commissionResult.expenseBreakdown || [];
            commissionData.complaintsCount =
              commissionResult.complaintsCount || 0;
          }

          // Store commission base amount (the amount used as basis for commission calculation)
          // and set initial finalCommissionAmount equal to the computed commissionAmount.
          // This base is used later if post-commission expenses are added on the commission page.
          const commissionType = commissionResult.commissionType;
          let commissionBaseAmount = paidNum; // default: full paid amount (flat)
          if (commissionType === "target_based") {
            // Base = only the amount above target (commission is earned only on excess)
            commissionBaseAmount = commissionResult.amountAboveTarget || 0;
          } else if (commissionType === "after_deduction") {
            // netAmount = paidAmount - billingExpenses (already computed by calculator)
            commissionBaseAmount = commissionResult.netAmount || 0;
          } else if (commissionType === "target_plus_expense") {
            // netCommissionableAmount = amountAboveTarget - expenses
            commissionBaseAmount =
              commissionResult.netCommissionableAmount || 0;
          }
          commissionData.commissionBaseAmount = commissionBaseAmount;
          commissionData.finalCommissionAmount =
            commissionResult.commissionAmount || 0;

          await Commission.create(commissionData);
        } else {
          console.log(
            `Commission not created for staff ${appointment.doctorId}: ${commissionResult.reason}`,
          );
        }
      }
    } catch (staffCommissionErr) {
      console.error(
        "Commission calculation/store error (staff):",
        staffCommissionErr,
      );
      // Do not fail the billing creation if commission creation fails
    }

    return res.status(201).json({
      success: true,
      message: "Billing created successfully",
      billing,
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
