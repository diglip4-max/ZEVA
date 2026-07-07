import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import Appointment from "../../../models/Appointment";
import Referral from "../../../models/Referral";
import Commission from "../../../models/Commission";
import AgentProfile from "../../../models/AgentProfile";
import InsuranceClaim from "../../../models/InsuranceClaim";
import PettyCash from "../../../models/PettyCash";
import StaffTip from "../../../models/StaffTip";
import { getUserFromReq } from "../lead-ms/auth";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import { calculateCommissionForStaff, calculateBankDeduction } from "../../../lib/commissionCalculator";

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

        // Fallback: Check clinic_Appointment or clinic_ScheduledAppointment if patient_registration is denied
        if (!agentHasPermission) {
          let appointmentHasPermission = false;
          
          // Check clinic_Appointment first
          const { hasPermission: app1 } = await checkAgentPermission(
            clinicUser._id,
            "clinic_Appointment",
            "create",
          );
          if (app1) {
            appointmentHasPermission = true;
          } else {
            // Fallback to clinic_ScheduledAppointment for backward compatibility
            const { hasPermission: app2 } = await checkAgentPermission(
              clinicUser._id,
              "clinic_ScheduledAppointment",
              "create",
            );
            appointmentHasPermission = app2;
          }

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

        // Fallback: Check clinic_Appointment or clinic_ScheduledAppointment if patient_registration is denied
        if (!agentHasPermission) {
          let appointmentHasPermission = false;
          
          // Check clinic_Appointment first
          const { hasPermission: app1 } = await checkAgentPermission(
            clinicUser._id,
            "clinic_Appointment",
            "create",
          );
          if (app1) {
            appointmentHasPermission = true;
          } else {
            // Fallback to clinic_ScheduledAppointment for backward compatibility
            const { hasPermission: app2 } = await checkAgentPermission(
              clinicUser._id,
              "clinic_ScheduledAppointment",
              "create",
            );
            appointmentHasPermission = app2;
          }

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
        claimAmountUsed,
        pastAdvance,
        pastAdvanceUsed,
        applyPastAdvance,
        pendingClaimUsed, // Track pending claim amount being paid
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
        selectedTreatments, // Array of selected treatments with slugs and service IDs
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
        // Offer fields
        isOfferApplied,
        offerId,
        offerTitle,
        offerType,
        offerDiscountAmount,
        cashbackEarned,
        bundleSessionsAdded,
        // Bundle offer fields
        offerFreeSession,
        freeOfferSessionCount,
        // Free sessions being REDEEMED in this billing
        usedFreeSessions,
        usedFreeSessionCount,
        // Cashback offer fields
        isCashbackApplied,
        cashbackOfferId,
        cashbackOfferName,
        cashbackAmount,
        // Cashback WALLET usage (when patient uses previously earned cashback)
        cashbackWalletUsed,
        // Unpaid packages being paid in this billing
        unpaidPackagesPaid,
        // Staff tips
        staffTips,
      } = req.body;

    console.log({ bmModify: req.body });
    console.log("multiplePayments from req.body:", multiplePayments);
    console.log('[BundleAPI] Extracted offerFreeSession:', offerFreeSession);
    console.log('[BundleAPI] Extracted freeOfferSessionCount:', freeOfferSessionCount);

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

    // Validate payment method(s)
    const multiPayArr =
      Array.isArray(multiplePayments) && multiplePayments.length > 0
        ? multiplePayments
        : [];
    console.log("multiPayArr created as:", multiPayArr);
    
    if (multiPayArr.length === 0 && !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required when not using multiple payments",
      });
    }
    
    if (multiPayArr.length > 0) {
      // Check that at least one payment has an amount > 0
      const hasValidPayment = multiPayArr.some(mp => 
        mp.paymentMethod && parseFloat(mp.amount) > 0
      );
      if (!hasValidPayment) {
        return res.status(400).json({
          success: false,
          message: "Please provide at least one payment method with a positive amount",
        });
      }
      
      // Check that all payments with amount >0 have a payment method
      const hasInvalidPayment = multiPayArr.some(mp => 
        parseFloat(mp.amount) > 0 && !mp.paymentMethod
      );
      if (hasInvalidPayment) {
        return res.status(400).json({
          success: false,
          message: "All payments with an amount must have a payment method selected",
        });
      }
    }

    // Validate appointment exists
    const appointment = await Appointment.findById(appointmentId);
    console.log("===========================================");
    console.log("========== BILLING DEBUG START ===========");
    console.log("===========================================");
    console.log("Appointment ID:", appointmentId);
    console.log("Full Appointment Object:", JSON.stringify(appointment, null, 2));
    console.log("Full req.body:", JSON.stringify(req.body, null, 2));
    console.log("req.body.treatment:", treatment);
    console.log("req.body.service:", service);
    console.log("req.body.package:", packageName);
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

    // console.log("=== DEBUG BILLING PACKAGE ===");
    // console.log("Service:", service);
    // console.log("Package Name:", packageName);
    // console.log("isUserPackage:", isUserPackage);
    // console.log("patientPackageId:", patientPackageId);
    // console.log("PatientRegistration ID (userId):", userId);

    const hasPendingAmount = (pendingUsed && parseFloat(pendingUsed) > 0) || 
                              (pendingClaimUsed && parseFloat(pendingClaimUsed) > 0) || 
                              (unpaidPackagesPaid && Array.isArray(unpaidPackagesPaid) && unpaidPackagesPaid.length > 0);

    // NOTE: Treatments and a Package can now be billed in the same invoice.
    // Run package validation whenever a packageName is present.
    // For NEW packages being purchased (without consuming sessions), selectedPackageTreatments may be empty.
    // For EXISTING packages, selectedPackageTreatments will have the sessions being consumed.
    const hasPackagePayload = !!packageName;
    
    // Declare package-related variables outside the block so they are accessible later
    let pkgDoc = null;
    let packageSoldByUserId = null;
    let packagePaymentStatus = 'Unpaid';
    let packagePaidAmount = 0;
    let packageTotalPrice = 0;
    let totalPackageSessionValue = 0;

    if (hasPackagePayload) {
      // Always set up package variables if hasPackagePayload is true, even if hasPendingAmount is true
      const Package = (await import("../../../models/Package")).default;
      const UserPackage = (await import("../../../models/UserPackage")).default;

      if (isUserPackage && (patientPackageId || patientPackageSubId)) {
        console.log("Looking up UserPackage with primary ID:", patientPackageId, "or sub-ID:", patientPackageSubId);
        
        // Try looking up by primary ID first (actual UserPackage document ID)
        if (patientPackageId) {
          pkgDoc = await UserPackage.findById(patientPackageId).lean();
        }
        
        // console.log("Initial UserPackage lookup result:", pkgDoc ? "Found" : "NOT FOUND");
        
        // If not found, try looking into patientRegistration.userPackages
        if (!pkgDoc && patientRegistration && patientRegistration.userPackages) {
          // console.log("Checking PatientRegistration.userPackages for match...");
          const matchInPatient = patientRegistration.userPackages.find(
            up => (patientPackageId && String(up.packageId) === String(patientPackageId)) || 
                  (patientPackageSubId && String(up._id) === String(patientPackageSubId)) ||
                  (patientPackageId && String(up._id) === String(patientPackageId))
          );
          
          if (matchInPatient) {
            // console.log("Found match in PatientRegistration.userPackages:", matchInPatient);
            // Re-try using the actual packageId from the sub-document
            pkgDoc = await UserPackage.findById(matchInPatient.packageId).lean();
            // console.log("Retry UserPackage lookup with matchInPatient.packageId:", pkgDoc ? "Found" : "NOT FOUND");
          }
        }
      } else {
        // console.log("Looking up regular Package with name:", packageName, "and clinicId:", clinic._id);
        // Otherwise, find it by clinicId and name in the regular Package model
        pkgDoc = await Package.findOne({
          clinicId: clinic._id,
          name: packageName,
        }).lean();
        // console.log("Regular Package lookup result:", pkgDoc ? "Found" : "NOT FOUND");
      }

      if (!pkgDoc && !isUserPackage) {
        // Package not found in master catalogue — it may have been deleted AFTER being sold.
        // Attempt to reconstruct a synthetic pkgDoc from the packageSnapshot stored in the
        // patient's packages sub-document. This preserves full billing capability for patients
        // who already hold the package.
        const patientPkgEntry = (patientRegistration.packages || []).find(
          (p) => (p.packageName === packageName) ||
                 (p.packageSnapshot && p.packageSnapshot.name === packageName)
        );
        if (patientPkgEntry && patientPkgEntry.packageSnapshot && patientPkgEntry.packageSnapshot.name) {
          const snap = patientPkgEntry.packageSnapshot;
          pkgDoc = {
            _id: patientPkgEntry.packageId,
            name: snap.name,
            totalPrice: snap.totalPrice || patientPkgEntry.totalPrice || 0,
            totalSessions: snap.totalSessions || 0,
            sessionPrice: snap.sessionPrice || 0,
            validityInMonths: snap.validityInMonths || patientPkgEntry.validityInMonths || 0,
            treatments: Array.isArray(snap.treatments) ? snap.treatments : [],
            isDeletedMaster: true,
          };
          console.log(`[PKG_BILLING] Deleted-master package "${packageName}" reconstructed from snapshot for patient ${patientRegistration._id}`);
        }
      }

      if (!pkgDoc) {
        // Only return error if !hasPendingAmount (since if hasPendingAmount, it's probably unpaid package payment)
        if (!hasPendingAmount) {
          return res.status(404).json({
            success: false,
            message: "Selected package not found",
          });
        }
      } else {
        // Find packageSoldByUserId from patientRegistration
        if (isUserPackage && patientPackageSubId) {
          // Find in userPackages
          const userPkgInPatient = patientRegistration.userPackages?.find(up => String(up._id) === String(patientPackageSubId));
          if (userPkgInPatient) {
            packageSoldByUserId = userPkgInPatient.packageSoldByUserId;
            // If userPackage has payment status, we need to get it from UserPackage model
            const userPackage = await UserPackage.findById(userPkgInPatient.packageId);
            if (userPackage) {
              packagePaymentStatus = userPackage.paymentStatus;
              packagePaidAmount = userPackage.paidAmount || 0;
              packageTotalPrice = userPackage.totalPrice || 0;
            }
            
            // If packageSoldByUserId is not available, try to find user by name
            if (!packageSoldByUserId && userPkgInPatient.packageSoldBy) {
              console.log("Trying to find user by packageSoldBy name (userPackage):", userPkgInPatient.packageSoldBy);
              
              // Find user by name (try both `name` and `firstName + lastName`)
              const name = userPkgInPatient.packageSoldBy.trim();
              const foundUser = await User.findOne({
                clinicId: clinic._id,
                $or: [
                  { name: name },
                  { $expr: { $eq: [ { $concat: ['$firstName', ' ', '$lastName'] }, name ] } }
                ]
              });
              
              console.log("Found user by name (userPackage):", foundUser);
              if (foundUser) {
                packageSoldByUserId = foundUser._id;
                console.log("Set packageSoldByUserId to found user's ID (userPackage):", packageSoldByUserId);
              }
            }
          }
        } else {
        // Find in packages
        console.log("=== Looking in patientRegistration.packages ===");
        console.log("patientRegistration.packages:", patientRegistration.packages);
        console.log("pkgDoc._id:", pkgDoc._id);
        
        const regularPkgInPatient = patientRegistration.packages?.find(p => String(p.packageId) === String(pkgDoc._id));
        console.log("regularPkgInPatient found:", regularPkgInPatient);
        
        if (regularPkgInPatient) {
          packageSoldByUserId = regularPkgInPatient.packageSoldByUserId;
          packagePaymentStatus = regularPkgInPatient.paymentStatus;
          packagePaidAmount = regularPkgInPatient.paidAmount || 0;
          packageTotalPrice = regularPkgInPatient.totalPrice || 0;
          
          console.log("regularPkgInPatient.packageSoldByUserId:", regularPkgInPatient.packageSoldByUserId);
          
          // If packageSoldByUserId is not available, try to find user by name
          if (!packageSoldByUserId && regularPkgInPatient.packageSoldBy) {
            console.log("Trying to find user by packageSoldBy name:", regularPkgInPatient.packageSoldBy);
            
            // Find user by name (try both `name` and `firstName + lastName`)
            const name = regularPkgInPatient.packageSoldBy.trim();
            const foundUser = await User.findOne({
              clinicId: clinic._id,
              $or: [
                { name: name },
                { $expr: { $eq: [ { $concat: ['$firstName', ' ', '$lastName'] }, name ] } }
              ]
            });
            
            console.log("Found user by name:", foundUser);
            if (foundUser) {
              packageSoldByUserId = foundUser._id;
              console.log("Set packageSoldByUserId to found user's ID:", packageSoldByUserId);
            }
          }
        }
      }
        
        // Calculate total session value from selectedPackageTreatments
        console.log("=== Calculating totalPackageSessionValue ===");
        console.log("selectedPackageTreatments:", selectedPackageTreatments);
        console.log("pkgDoc.treatments:", pkgDoc.treatments);
        
        selectedPackageTreatments.forEach(t => {
          const sessions = parseInt(t.sessions) || 0;
          
          // Get session price from t if available, otherwise get from pkgDoc.treatments
          let sessionPrice = parseFloat(t.sessionPrice) || 0;
          
          if (!sessionPrice && pkgDoc && pkgDoc.treatments) {
            const pkgTreatment = pkgDoc.treatments.find(treat => treat.treatmentSlug === t.treatmentSlug);
            if (pkgTreatment) {
              // Calculate session price from allocatedPrice and sessions if available
              if (pkgTreatment.sessionPrice) {
                sessionPrice = parseFloat(pkgTreatment.sessionPrice);
              } else if (pkgTreatment.allocatedPrice && pkgTreatment.sessions) {
                sessionPrice = parseFloat(pkgTreatment.allocatedPrice) / parseInt(pkgTreatment.sessions);
              }
            }
          }
          
          console.log("Treatment:", t.treatmentName, "sessions:", sessions, "sessionPrice:", sessionPrice);
          totalPackageSessionValue += sessions * sessionPrice;
        });
        
        console.log("Total package session value:", totalPackageSessionValue);
      }
      
      if (!hasPendingAmount) {
        // Only run the validation if !hasPendingAmount
        // For NEW packages being purchased (without consuming sessions), selectedPackageTreatments can be empty
        // For EXISTING packages, at least one treatment must be selected
        const hasSelectedTreatments = Array.isArray(selectedPackageTreatments) && selectedPackageTreatments.length > 0;
        
        if (!packageName) {
          return res.status(400).json({
            success: false,
            message: "Please select a package",
          });
        }
        
        // If no treatments selected, check if this is a new package purchase (allowed) or existing package (not allowed)
        if (!hasSelectedTreatments) {
          // Check if package already exists in patient's profile (existing package)
          const existingPkgCheck = (patientRegistration.packages || []).find(
            (p) => String(p.packageId) === String(pkgDoc._id)
          );
          const isMainPkgCheck = String(patientRegistration.packageId) === String(pkgDoc._id);
          
          // If package exists in patient profile, require treatment selection
          if (existingPkgCheck || isMainPkgCheck) {
            return res.status(400).json({
              success: false,
              message: "Please select at least one treatment from the package",
            });
          }
          // New package purchase without treatments is allowed - skip session validation
        }
        
        const maxSessionsMap = new Map();
        (pkgDoc.treatments || []).forEach((t) => {
          if (t.treatmentSlug) {
            maxSessionsMap.set(t.treatmentSlug, parseInt(t.sessions) || 0);
          }
        });
        console.log(`[BILLING_DEBUG] Step 1 - maxSessionsMap from pkgDef:`, Object.fromEntries(maxSessionsMap));

        // For transferred packages, scale down max sessions proportionally to the transferred amount.
        const transferredInRecord = (patientRegistration.packageTransfers || []).find(
          (t) => t.type === "in" && t.packageName === packageName
        );
        console.log(`[BILLING_DEBUG] Step 2 - transferredInRecord:`, transferredInRecord ? { packageName: transferredInRecord.packageName, transferredSessions: transferredInRecord.transferredSessions, type: transferredInRecord.type } : 'NOT FOUND');
        if (transferredInRecord) {
          const totalPkgSessions = (pkgDoc.treatments || []).reduce(
            (sum, t) => sum + (parseInt(t.sessions) || 0), 0
          );
          const transferredSessions = transferredInRecord.transferredSessions || 0;
          console.log(`[BILLING_DEBUG] Step 2b - totalPkgSessions=${totalPkgSessions}, transferredSessions=${transferredSessions}`);
          if (totalPkgSessions > 0 && transferredSessions < totalPkgSessions) {
            const scale = transferredSessions / totalPkgSessions;
            console.log(`[BILLING_DEBUG] Step 2c - Scaling by factor ${scale.toFixed(4)}`);
            maxSessionsMap.forEach((sessions, slug) => {
              const scaled = Math.max(0, Math.round(sessions * scale));
              console.log(`[BILLING_DEBUG]   treatment ${slug}: ${sessions} -> ${scaled}`);
              maxSessionsMap.set(slug, scaled);
            });
          } else if (totalPkgSessions > 0 && transferredSessions >= totalPkgSessions) {
            console.log(`[BILLING_DEBUG] Step 2c - transferredSessions >= totalPkgSessions, no scaling needed`);
          } else if (totalPkgSessions === 0) {
            console.log(`[BILLING_DEBUG] Step 2c - totalPkgSessions=0, setting each treatment to ${transferredSessions}`);
            maxSessionsMap.forEach((_, slug) => {
              maxSessionsMap.set(slug, transferredSessions);
            });
          }
        }
        console.log(`[BILLING_DEBUG] Step 3 - Final maxSessionsMap:`, Object.fromEntries(maxSessionsMap));

        // Previous billings that consumed this package's sessions.
        // Treatments and a Package can now coexist on a single billing, so we no longer
        // restrict by `service: "Package"`. Instead we match by patient + package identifier(s).
        const previousBillingsQuery = {
          clinicId: clinic._id,
          patientId: patientRegistration._id,
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
        console.log(`[BILLING_DEBUG] Step 4 - previousBillings count: ${previousBillings.length}, previouslyUsedMap:`, Object.fromEntries(previouslyUsedMap));
        console.log(`[BILLING_DEBUG] Step 5 - selectedPackageTreatments:`, selectedPackageTreatments.map(t => ({ name: t.treatmentName, slug: t.treatmentSlug, sessions: t.sessions })));
        for (const t of selectedPackageTreatments) {
          const slug = t.treatmentSlug;
          const newSessions = parseInt(t.sessions) || 0;
          const maxSessions = maxSessionsMap.get(slug);
          console.log(`[BILLING_DEBUG] Step 5b - Validating "${t.treatmentName}": maxSessions=${maxSessions}, previouslyUsed=${previouslyUsedMap.get(slug) || 0}, newSessions=${newSessions}`);
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
              message: "This treatment has already used all available sessions",
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

        // For transferred packages, also enforce a total sessions cap across all treatments.
        // Per-treatment scaling with rounding could allow more total sessions than transferred.
        if (transferredInRecord) {
          const transferredSessions = transferredInRecord.transferredSessions || 0;
          const totalPreviouslyUsed = Array.from(previouslyUsedMap.values()).reduce((sum, v) => sum + v, 0);
          const totalRequested = selectedPackageTreatments.reduce((sum, it) => sum + (parseInt(it.sessions) || 0), 0);
          const totalRemaining = Math.max(0, transferredSessions - totalPreviouslyUsed);
          console.log(`[BILLING_DEBUG] Step 6 - Total cap check: transferredSessions=${transferredSessions}, totalPreviouslyUsed=${totalPreviouslyUsed}, totalRequested=${totalRequested}, totalRemaining=${totalRemaining}`);
          if (totalRemaining <= 0) {
            return res.status(400).json({
              success: false,
              message: `All ${transferredSessions} transferred session(s) of "${packageName}" have already been used.`,
            });
          }
          if (totalRequested > totalRemaining) {
            return res.status(400).json({
              success: false,
              message: `Invalid total session count. You can bill at most ${totalRemaining} more session(s) out of ${transferredSessions} transferred.`,
            });
          }
        }

        const sumSessions = selectedPackageTreatments.reduce(
          (sum, it) => sum + (parseInt(it.sessions) || 0),
          0,
        );
        req.body.sessions = sumSessions;
      }
    }


    // Calculate pending and advance (use provided values or calculate)
    const amountNum = parseFloat(amount) || 0;
    const advanceUsedNum =
      advanceUsed !== undefined ? Math.max(0, parseFloat(advanceUsed) || 0) : 0;
    const claimAmountUsedNum =
      claimAmountUsed !== undefined ? Math.max(0, parseFloat(claimAmountUsed) || 0) : 0;
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
    const pendingClaimUsedNum =
      pendingClaimUsed !== undefined ? Math.max(0, parseFloat(pendingClaimUsed) || 0) : 0;
    const pendingNum = pending !== undefined ? parseFloat(pending) || 0 : 0;
    const advanceNum = advance !== undefined ? parseFloat(advance) || 0 : 0;
    const pastAdvanceNum =
      pastAdvance !== undefined ? parseFloat(pastAdvance) || 0 : 0;

    // Calculate paid from multiple payments if provided
    let paidNum = parseFloat(paid) || 0;
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

    console.log('[AdvanceDebug] Input values:', {
      amountNum,
      paidNum,
      advanceUsedNum,
      claimAmountUsedNum,
      totalPastAdvanceUsed,
      pendingUsedNum,
      frontendAdvance: parseFloat(advance) || 0
    });

    const netDue = Math.max(
      0,
      amountNum - advanceUsedNum - claimAmountUsedNum - totalPastAdvanceUsed,
    );

    console.log('[AdvanceDebug] Calculated netDue:', netDue);

    if (paidNum > netDue) {
      finalAdvance = paidNum - netDue;
      finalPending = 0;
    } else {
      finalPending = netDue - paidNum;
      finalAdvance = 0;
    }

    console.log('[AdvanceDebug] Final calculated values:', {
      finalAdvance,
      finalPending,
      paidNum,
      netDue
    });

    // Use the calculated final values for storage
    const pendingToStore = finalPending;
    const advanceToStore = finalAdvance;

    // Calculate cashback validity dates if cashback is applied
    let cashbackStartDate = null;
    let cashbackEndDate = null;
    if (isCashbackApplied && cashbackAmount && cashbackAmount > 0) {
      // Use dynamic import for ES6 modules
      const CreateOfferModule = await import('../../../models/CreateOffer');
      const CreateOffer = CreateOfferModule.default;
      const cashbackOffer = cashbackOfferId ? await CreateOffer.findById(cashbackOfferId).lean() : null;
      const cashbackExpiryDays = cashbackOffer?.cashbackExpiryDays || 365; // Default to 1 year if not set
      
      cashbackStartDate = new Date(invoicedDate);
      cashbackStartDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      cashbackEndDate = new Date(invoicedDate);
      cashbackEndDate.setHours(23, 59, 59, 999); // Normalize to end of day
      // Strictly X days from the purchase date
      cashbackEndDate.setDate(cashbackEndDate.getDate() + cashbackExpiryDays);
      
      console.log('[CashbackAPI] Cashback validity period:', {
        invoicedDate,
        cashbackStartDate: cashbackStartDate.toISOString(),
        cashbackExpiryDays,
        cashbackEndDate: cashbackEndDate.toISOString(),
        calculation: `Start Date + ${cashbackExpiryDays} days = End Date`
      });
    }

    // Get invoicedByRate from AgentProfile if available
    let invoicedByRate = 0;
    try {
      const agentProfile = await AgentProfile.findOne({ userId: clinicUser._id }).lean();
      if (agentProfile && agentProfile.commissionPercentage) {
        invoicedByRate = agentProfile.commissionPercentage;
      }
    } catch (profileError) {
      console.error("[CreatePatientRegistration] Error fetching agent profile for rate:", profileError);
    }

    // Build multiplePayments array: include user-provided payments plus advance, claim, pending, cashback usage
    const finalMultiPayArr = [
      ...multiPayArr.map((mp) => ({
        paymentMethod: mp.paymentMethod,
        amount: parseFloat(mp.amount) || 0,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "PAYMENT"
      })),
      ...(advanceUsedNum > 0 ? [{
        paymentMethod: "Advance Balance",
        amount: advanceUsedNum,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "ADVANCE_USAGE"
      }] : []),
      ...(claimAmountUsedNum > 0 ? [{
        paymentMethod: "Insurance Claim",
        amount: claimAmountUsedNum,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "CLAIM_USAGE"
      }] : []),
      ...(pendingUsedNum > 0 ? [{
        paymentMethod: paymentMethod || "Cash",
        amount: pendingUsedNum,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "PENDING_CLEARANCE"
      }] : []),
      ...(cashbackWalletUsed > 0 ? [{
        paymentMethod: "Cashback Wallet",
        amount: cashbackWalletUsed,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "CASHBACK_USAGE"
      }] : [])
    ];

    // Create billing record
    const billingData = {
      clinicId: clinic._id,
      invoicedByRole: clinicUser.role,
      invoicedByRate: invoicedByRate,
      appointmentId: appointment._id,
      patientId: patientRegistration._id,
      invoiceNumber,
      invoicedDate: new Date(invoicedDate),
      invoicedBy: clinicUser.name || "Clinic Staff",
      invoicedById: clinicUser._id,
      doctorId: appointment.doctorId || null,
      doctorName: doctor || "",
      service,
      // Treatments AND a Package can now be billed in the same invoice. Preserve whatever the frontend sends.
      treatment: treatment || "",
      package: packageName || "",
      patientPackageId: isUserPackage && patientPackageId ? patientPackageId : null,
      patientPackageSubId: isUserPackage && patientPackageSubId ? patientPackageSubId : null,
      quantity: parseInt(quantity) || (treatment || packageName ? 1 : 0),
      sessions: parseInt(sessions) || 0,
      selectedPackageTreatments: Array.isArray(selectedPackageTreatments)
        ? selectedPackageTreatments
        : [],
      selectedTreatments: Array.isArray(selectedTreatments)
        ? selectedTreatments
        : [],
      // Track unpaid packages paid in this billing
      unpaidPackagesPaid: Array.isArray(unpaidPackagesPaid) 
        ? unpaidPackagesPaid 
        : [],
      amount: amountNum,
      paid: paidNum, // ONLY store actual money received today (not credits)
      advanceUsed: advanceUsedNum, // Use the parsed number
      claimAmountUsed: claimAmountUsedNum, // Use the parsed number
      pendingUsed: pendingUsedNum, // Use the parsed number
      pendingClaimUsed: pendingClaimUsedNum, // Track pending claim amount paid
      pastAdvanceUsed: totalPastAdvanceUsed,
      pastAdvanceUsed50Percent: pastAdvanceUsed50PercentNum,
      pastAdvanceUsed54Percent: pastAdvanceUsed54PercentNum,
      pastAdvanceUsed159Flat: pastAdvanceUsed159FlatNum,
      pastAdvanceType,
      pending: pendingToStore,
      advance: advanceToStore,
      pastAdvance: finalPastAdvance,
      multiplePayments: finalMultiPayArr,
      paymentHistory: [
        {
          amount: amountNum,
          paid: paidNum,
          pending: finalPending,
          multiplePayments: finalMultiPayArr,
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
      // Offer tracking fields
      offerApplied: isOfferApplied || false,
      offerId: offerId || null,
      offerName: offerTitle || null,
      offerType: offerType || null,
      offerDiscountAmount: offerDiscountAmount || 0,
      cashbackEarned: cashbackEarned || 0,
      bundleSessionsAdded: bundleSessionsAdded || 0,
      // Bundle offer tracking fields
      offerFreeSession: Array.isArray(offerFreeSession) ? offerFreeSession : [],
      freeOfferSessionCount: freeOfferSessionCount || 0,
      // Free sessions being REDEEMED in this billing (consumed from previous billings)
      usedFreeSessions: Array.isArray(usedFreeSessions) ? usedFreeSessions : [],
      usedFreeSessionCount: usedFreeSessionCount || 0,
      // Cashback offer tracking fields
      isCashbackApplied: isCashbackApplied || false,
      cashbackOfferId: cashbackOfferId || null,
      cashbackOfferName: cashbackOfferName || null,
      cashbackAmount: cashbackAmount || 0,
      // Cashback validity period - calculated above based on offer's cashbackExpiryDays
      cashbackStartDate: cashbackStartDate,
      cashbackEndDate: cashbackEndDate,
      // Cashback WALLET usage (when patient uses previously earned cashback)
      cashbackWalletUsed: cashbackWalletUsed || 0,
    };

    // Only add paymentMethod if we're not using multiple payments
    if (multiPayArr.length === 0 && paymentMethod) {
      billingData.paymentMethod = paymentMethod;
      billingData.paymentHistory[0].paymentMethod = paymentMethod;
    }

    // console.log({ billingData });
    // console.log('[BundleAPI] billingData.offerFreeSession:', billingData.offerFreeSession);
    // console.log('[BundleAPI] billingData.freeOfferSessionCount:', billingData.freeOfferSessionCount);
    // console.log('[BundleAPI] typeof billingData.offerFreeSession:', typeof billingData.offerFreeSession);
    // console.log('[BundleAPI] Array.isArray(billingData.offerFreeSession):', Array.isArray(billingData.offerFreeSession));
    // console.log('[BundleAPI] usedFreeSessions (being redeemed):', usedFreeSessions);
    // console.log('[BundleAPI] usedFreeSessionCount:', usedFreeSessionCount);
    // console.log('[BundleAPI] billingData.usedFreeSessions:', billingData.usedFreeSessions);
    // console.log('[BundleAPI] billingData.usedFreeSessionCount:', billingData.usedFreeSessionCount);

    const billing = await Billing.create(billingData);

    // Handle staff tips
    let createdStaffTips = [];
    if (staffTips && Array.isArray(staffTips) && staffTips.length > 0) {
      for (const tip of staffTips) {
        try {
          const createdTip = await StaffTip.create({
            clinicId: clinic._id,
            billingId: billing._id,
            appointmentId: appointment._id,
            patientId: patientRegistration._id,
            staffId: tip.staffId,
            staffName: tip.staffName,
            staffRole: tip.staffRole,
            amount: tip.amount,
            paymentMethod: tip.paymentMethod,
            notes: tip.notes || "",
            createdBy: clinicUser._id,
            createdByName: clinicUser.name || `${clinicUser.firstName || ''} ${clinicUser.lastName || ''}`.trim() || 'Unknown',
          });
          createdStaffTips.push(createdTip);
        } catch (tipError) {
          console.error('[CreatePatientRegistration] Error creating staff tip:', tipError);
          // Don't fail the billing if tip creation fails
        }
      }
    }
   

    // ============================================================
    // Enterprise Pending Ledger: whenever a billing is created with
    // pending > 0, create a corresponding PatientPendingLedger row
    // so the pending amount is traceable to a specific treatment /
    // package / invoice. Source of truth lives in the ledger; the
    // Billing.pending scalar becomes a cached aggregate.
    // ============================================================
    try {
     
      
      if (finalPending > 0) {
        
        try {
        
          const pendingLedgerModule = await import("../../../lib/pendingLedger");
         
          
          const { createLedgerEntry } = pendingLedgerModule;
          if (!createLedgerEntry) {
            throw new Error("createLedgerEntry not found in pendingLedger module");
          }
          
         
          const entry = await createLedgerEntry({
            clinicId: clinic._id,
            branchId: null,
            patientId: patientRegistration._id,
            parentBillingId: billing._id,
            appointmentId: appointment._id,
            invoiceNumber,
            service,
            // Both treatment and package fields may be present when billed together.
            treatmentSlug: treatment || null,
            treatmentName: treatment || null,
            packageId: hasPackagePayload && pkgDoc ? pkgDoc._id : null,
            packageName: packageName || null,
            serviceId:
              treatment && appointment.serviceId
                ? appointment.serviceId
                : null,
            patientPackageId:
              hasPackagePayload && isUserPackage ? patientPackageId : null,
            patientPackageSubId:
              hasPackagePayload && isUserPackage ? patientPackageSubId : null,
            amount: finalPending,
            createdBy: clinicUser._id,
          });
         
        } catch (importErr) {
         
          throw importErr;
        }
      } else {
        
      }
    } catch (ledgerErr) {
      // Never fail the billing because the ledger write failed;
      // log and continue. A backfill migration can repair this.
     
    }

    // ============================================================
    // NEW PACKAGE ASSIGNMENT: If a package is being billed that does
    // NOT yet exist in the patient's packages array, assign it now.
    // This handles the scenario where a patient purchases a new
    // package through billing (same as assign-package-to-patient +
    // package-billing combined).
    // ============================================================
    try {
      if (hasPackagePayload && pkgDoc && !isUserPackage) {
        // Check if this package is already assigned to the patient
        const existingPkgInPatient = (patientRegistration.packages || []).find(
          (p) => String(p.packageId) === String(pkgDoc._id)
        );

        if (!existingPkgInPatient) {
          console.log(`[NewPackageAssign] Package "${packageName}" not in patient packages — assigning now.`);

          // Calculate paid amount for the package portion.
          // When billing treatments + package together, use totalPackageSessionValue
          // as the package's total; otherwise use pkgDoc.totalPrice.
          const pkgTotalForAssignment = totalPackageSessionValue > 0 ? totalPackageSessionValue : (pkgDoc.totalPrice || 0);

          // Determine how much of the total paid amount applies to the package.
          // Proportional split: if total billing = 100 and package = 40, then 40% of paid goes to package.
          let pkgPaidAmount = 0;
          if (amountNum > 0 && pkgTotalForAssignment > 0) {
            const pkgRatio = pkgTotalForAssignment / amountNum;
            pkgPaidAmount = Number((paidNum * pkgRatio).toFixed(2));
          }

          // Determine payment status for the package assignment
          let pkgAssignPaymentStatus = "Unpaid";
          if (pkgPaidAmount >= pkgTotalForAssignment && pkgTotalForAssignment > 0) {
            pkgAssignPaymentStatus = "Full";
          } else if (pkgPaidAmount > 0) {
            pkgAssignPaymentStatus = "Partial";
          }

          // Build package snapshot for resilience
          const snapshotName = pkgDoc.name || packageName;
          const snapshotTotalPrice = pkgTotalForAssignment;
          const snapshotTotalSessions = pkgDoc.totalSessions || 0;
          const snapshotSessionPrice = pkgDoc.sessionPrice || 0;
          const snapshotValidity = pkgDoc.validityInMonths || 0;
          const snapshotTreatments = Array.isArray(pkgDoc.treatments) ? pkgDoc.treatments.map((t) => ({
            treatmentName: t.treatmentName || '',
            treatmentSlug: t.treatmentSlug || '',
            allocatedPrice: t.allocatedPrice || 0,
            sessions: t.sessions || 1,
            sessionPrice: t.sessionPrice || 0,
          })) : [];

          const packageSnapshot = {
            name: snapshotName,
            totalPrice: snapshotTotalPrice,
            totalSessions: snapshotTotalSessions,
            sessionPrice: snapshotSessionPrice,
            validityInMonths: snapshotValidity,
            startDate: pkgDoc.startDate ? new Date(pkgDoc.startDate) : new Date(),
            endDate: pkgDoc.endDate ? new Date(pkgDoc.endDate) : null,
            treatments: snapshotTreatments,
            snapshotCreatedAt: new Date(),
          };

          const newPackageEntry = {
            packageId: pkgDoc._id,
            packageName: snapshotName,
            packageSoldBy: clinicUser.name || `${clinicUser.firstName || ''} ${clinicUser.lastName || ''}`.trim() || 'Unknown',
            packageSoldByUserId: clinicUser._id,
            assignedDate: new Date(),
            validityInMonths: pkgDoc.validityInMonths || 0,
            startDate: pkgDoc.startDate ? new Date(pkgDoc.startDate) : new Date(),
            endDate: pkgDoc.endDate ? new Date(pkgDoc.endDate) : null,
            totalPrice: pkgTotalForAssignment,
            paidAmount: pkgPaidAmount,
            paymentStatus: pkgAssignPaymentStatus,
            paymentMethod: multiPayArr.length > 0 ? "Multiple Payments" : (paymentMethod || "Cash"),
            advanceBalanceUsed: advanceUsedNum,
            claimAmountUsed: claimAmountUsedNum,
            packageSnapshot,
          };

          await PatientRegistration.findByIdAndUpdate(
            patientRegistration._id,
            {
              $push: { packages: newPackageEntry },
              $set: { package: "Yes" },
            }
          );

          console.log(`[NewPackageAssign] ✓ Package "${packageName}" assigned to patient ${patientRegistration._id}`, {
            totalPrice: pkgTotalForAssignment,
            paidAmount: pkgPaidAmount,
            paymentStatus: pkgAssignPaymentStatus,
          });
        } else {
          console.log(`[NewPackageAssign] Package "${packageName}" already in patient packages — skipping assignment.`);
        }
      }
    } catch (pkgAssignErr) {
      // Never fail the billing because the package assignment failed;
      // log and continue. The billing record is already created.
      console.error("[NewPackageAssign] ✗ Failed to assign new package to patient:", pkgAssignErr.message);
    }

    // Calculate cash amount (handle single and multiple payments)
    let cashAmount = 0;
    if (multiPayArr.length > 0) {
      // Multiple payments: sum all Cash payments
      cashAmount = multiPayArr
        .filter(mp => mp.paymentMethod === "Cash")
        .reduce((sum, mp) => sum + (parseFloat(mp.amount) || 0), 0);
    } else if (paymentMethod === "Cash") {
      // Single payment: use paidNum
      cashAmount = paidNum;
    }

    // Add to PettyCash if we have cash amount > 0
    if (cashAmount > 0) {
      try {
        const pettyCashEntry = new PettyCash({
          clinicId: clinic._id,
          staffId: clinicUser._id,
          staffName: clinicUser.name || "Staff",
          patientId: patientRegistration._id,
          patientName: `${patientRegistration.firstName || ''} ${patientRegistration.lastName || ''}`.trim(),
          patientFirstName: patientRegistration.firstName || "",
          patientLastName: patientRegistration.lastName || "",
          patientMobileNumber: patientRegistration.mobileNumber || "",
          emrNumber: patientRegistration.emrNumber || "",
          invoiceNumber: invoiceNumber,
          invoicedDate: new Date(invoicedDate),
          invoicedBy: clinicUser.name || "Clinic Staff",
          service: service,
          // Both treatment and package fields may be present when billed together.
          treatment: treatment || "",
          package: packageName || "",
          selectedPackageTreatments: Array.isArray(selectedPackageTreatments) ? selectedPackageTreatments : [],
          amount: amountNum,
          paid: paidNum,
          cashAmount: cashAmount,
          paymentMethod: multiPayArr.length > 0 ? "Multiple Payments" : paymentMethod,
          multiplePayments: multiPayArr.length > 0 ? multiPayArr : []
        });

        await pettyCashEntry.save();
        await PettyCash.updateGlobalTotalAmount(clinic._id, cashAmount, 'add');
        console.log('[CreatePatientRegistration] Added to PettyCash:', pettyCashEntry._id);
      } catch (pettyCashError) {
        console.error('[CreatePatientRegistration] Error adding to PettyCash:', pettyCashError);
        // Don't fail the billing if petty cash fails
      }
    }
    
    // Explicitly verify the cashback fields were saved
    const savedBilling = await Billing.findById(billing._id).lean();
    // console.log('[CashbackAPI] Saved billing isCashbackApplied:', savedBilling?.isCashbackApplied);
    // console.log('[CashbackAPI] Saved billing cashbackAmount:', savedBilling?.cashbackAmount);
    // console.log('[CashbackAPI] Saved billing cashbackOfferName:', savedBilling?.cashbackOfferName);
    // console.log('[CashbackAPI] Saved billing has isCashbackApplied key:', 'isCashbackApplied' in (savedBilling || {}));
    // console.log('[CashbackAPI] Saved billing has cashbackAmount key:', 'cashbackAmount' in (savedBilling || {}));
    // console.log('[CashbackAPI] Saved billing cashbackStartDate:', savedBilling?.cashbackStartDate);
    // console.log('[CashbackAPI] Saved billing cashbackEndDate:', savedBilling?.cashbackEndDate);
    // console.log('[CashbackAPI] Saved billing has cashbackStartDate key:', 'cashbackStartDate' in (savedBilling || {}));
    // console.log('[CashbackAPI] Saved billing has cashbackEndDate key:', 'cashbackEndDate' in (savedBilling || {}));
    // console.log('[FreeSessionAPI] Saved billing usedFreeSessions:', savedBilling?.usedFreeSessions);
    // console.log('[FreeSessionAPI] Saved billing usedFreeSessionCount:', savedBilling?.usedFreeSessionCount);
    // console.log('[FreeSessionAPI] Saved billing offerFreeSession:', savedBilling?.offerFreeSession);
    // console.log('[FreeSessionAPI] Saved billing freeOfferSessionCount:', savedBilling?.freeOfferSessionCount);

    // If free sessions are being REDEEMED, update previous billings to remove them
    if (usedFreeSessions && Array.isArray(usedFreeSessions) && usedFreeSessions.length > 0) {
      // console.log('[BundleAPI] Consuming free sessions:', usedFreeSessions);
      
      // Find all previous billings for this patient with free sessions
      const previousBillings = await Billing.find({
        patientId: userId,  // Use userId from request body
        offerType: 'bundle',
        freeOfferSessionCount: { $gt: 0 },
        _id: { $ne: billing._id } // Exclude current billing
      }).sort({ createdAt: 1 }); // Oldest first (FIFO)

      // console.log('[BundleAPI] Found', previousBillings.length, 'previous billings with free sessions');

      // Consume free sessions from previous billings (FIFO)
      let sessionsToConsume = [...usedFreeSessions];
      
      for (const prevBilling of previousBillings) {
        if (sessionsToConsume.length === 0) break;
        
        const currentFreeSessions = prevBilling.offerFreeSession || [];
        const updatedSessions = [];
        let consumedFromThisBilling = 0;

        for (const session of currentFreeSessions) {
          const sessionIndex = sessionsToConsume.findIndex(
            (s) => s.toLowerCase() === session.toLowerCase()
          );
          
          if (sessionIndex !== -1) {
            // This session is being redeemed, remove it
            sessionsToConsume.splice(sessionIndex, 1);
            consumedFromThisBilling++;
          } else {
            // Keep this session
            updatedSessions.push(session);
          }
        }

        // Update the previous billing if sessions were consumed
        if (consumedFromThisBilling > 0) {
          await Billing.findByIdAndUpdate(prevBilling._id, {
            $set: {
              offerFreeSession: updatedSessions,
              freeOfferSessionCount: updatedSessions.length
            }
          });
          // console.log(`[BundleAPI] Updated billing ${prevBilling.invoiceNumber}: ${consumedFromThisBilling} sessions consumed, ${updatedSessions.length} remaining`);
        }
      }

      if (sessionsToConsume.length > 0) {
        // console.warn('[BundleAPI] Warning: Could not find free sessions for:', sessionsToConsume);
      } else {
        // console.log('[BundleAPI] All free sessions successfully consumed!');
      }
    }

    // If patient is using cashback from wallet, deduct it
    if (cashbackWalletUsed && cashbackWalletUsed > 0) {
      // console.log('[CashbackWalletAPI] Deducting cashback from wallet:', { 
      //   patientId: userId, 
      //   amount: cashbackWalletUsed,
      //   invoiceNumber: invoiceNumber
      // });
      
      try {
        const PatientRegistration = require('../../../models/PatientRegistration');
        
        // Find the patient
        const patient = await PatientRegistration.findById(userId);
        if (patient) {
          const currentWalletBalance = patient.walletBalance || 0;
          
          // Check if patient has enough balance
          if (currentWalletBalance < cashbackWalletUsed) {
            // console.error('[CashbackWalletAPI] Insufficient wallet balance:', {
            //   current: currentWalletBalance,
            //   requested: cashbackWalletUsed
            // });
          } else {
            // Deduct from wallet balance
            const newWalletBalance = Math.max(0, currentWalletBalance - cashbackWalletUsed);
            
            await PatientRegistration.findByIdAndUpdate(userId, {
              $set: {
                walletBalance: newWalletBalance,
                updatedAt: new Date()
              },
              $push: {
                walletTransactions: {
                  amount: cashbackWalletUsed,
                  type: 'debit',
                  source: 'cashback_usage',
                  billingId: billing._id,
                  invoiceNumber: invoiceNumber,
                  description: `Cashback used for billing ${invoiceNumber}`,
                  createdAt: new Date()
                }
              }
            });
            
            // console.log('[CashbackWalletAPI] Wallet debited successfully. New balance:', newWalletBalance);
            
            // If wallet balance is now 0, also clear the expiry date
            if (newWalletBalance === 0) {
              await PatientRegistration.findByIdAndUpdate(userId, {
                $set: {
                  walletCreditExpiry: null
                }
              });
              // console.log('[CashbackWalletAPI] Wallet balance is 0, cleared expiry date');
            }
          }
        } else {
          // console.warn('[CashbackWalletAPI] Patient not found:', userId);
        }
      } catch (walletError) {
        // console.error('[CashbackWalletAPI] Error deducting from wallet:', walletError);
        // Don't fail the billing if wallet update fails
      }
    }

    // If cashback is applied, credit the patient's wallet
    if (isCashbackApplied && cashbackAmount && cashbackAmount > 0) {
      // console.log('[CashbackAPI] Crediting wallet:', { patientId: userId, amount: cashbackAmount, offerName: cashbackOfferName });
      
      try {
        // Fetch the offer to get cashbackExpiryDays
        const CreateOfferModule = await import('../../../models/CreateOffer');
        const CreateOffer = CreateOfferModule.default;
        const cashbackOffer = cashbackOfferId ? await CreateOffer.findById(cashbackOfferId).lean() : null;
        const cashbackExpiryDays = cashbackOffer?.cashbackExpiryDays || 365; // Default to 1 year if not set
        
        // console.log('[CashbackAPI] Cashback offer details:', {
        //   offerName: cashbackOffer?.title,
        //   cashbackAmount: cashbackOffer?.cashbackAmount,
        //   cashbackExpiryDays: cashbackExpiryDays
        // });
        
        // Update PatientRegistration with wallet credit
        const PatientRegistration = require('../../../models/PatientRegistration');
        
        // Find the patient
        const patient = await PatientRegistration.findById(userId);
        if (patient) {
          // Add to wallet balance
          const currentWalletBalance = patient.walletBalance || 0;
          const newWalletBalance = currentWalletBalance + cashbackAmount;
          
          // Use the cashbackEndDate from billing record (calculated from invoicedDate)
          const walletCreditExpiry = cashbackEndDate || new Date();
          
          await PatientRegistration.findByIdAndUpdate(userId, {
            $set: {
              walletBalance: newWalletBalance,
              walletCreditExpiry: walletCreditExpiry,
              updatedAt: new Date()
            },
            $push: {
              walletTransactions: {
                amount: cashbackAmount,
                type: 'credit',
                source: 'cashback',
                offerId: cashbackOfferId,
                offerName: cashbackOfferName,
                billingId: billing._id,
                invoiceNumber: billing.invoiceNumber,
                description: `Cashback earned from ${cashbackOfferName || 'offer'}`,
                expiryDate: walletCreditExpiry,
                createdAt: new Date()
              }
            }
          });
          
          // console.log('[CashbackAPI] Wallet credited successfully. New balance:', newWalletBalance);
          // console.log('[CashbackAPI] Wallet credit expires:', walletCreditExpiry);
        } else {
          // console.warn('[CashbackAPI] Patient not found:', userId);
        }
      } catch (walletError) {
        // console.error('[CashbackAPI] Error crediting wallet:', walletError);
        // Don't fail the billing if wallet update fails
      }
    }

    // Helper to map payment method names to bankDetails keys
    const getBankPaymentDetails = (paymentMethodName) => {
      const methodMap = {
        "Card": "card",
        "Bank Transfer": "bankTransfer",
        "BT": "bankTransfer",
        "Tabby": "tabby",
        "Tamara": "tamara"
      };
      const key = methodMap[paymentMethodName];
      if (key && clinic.bankDetails && clinic.bankDetails[key]) {
        return clinic.bankDetails[key];
      }
      return { enabled: false };
    };

    // Get the selected payment method's bank details (handle multiple payments)
    let selectedBankPaymentDetails= { enabled: false };
    // console.log("=== BANK DETAILS DEBUGGING ===");
    if (multiPayArr.length > 0) {
      // console.log("Checking bank details for multiple payments");
      // For multiple payments, check each payment method and use the first one with enabled bank details
      // Or if you need to apply deductions for all, we'll adjust, but let's start with checking all
      for (const mp of multiPayArr) {
        const mpBankDetails = getBankPaymentDetails(mp.paymentMethod);
        if (mpBankDetails.enabled) {
          selectedBankPaymentDetails = mpBankDetails;
          
          break; // Use first one with enabled details for now (can adjust later if needed)
        }
      }
    } else if (paymentMethod) {
      
      selectedBankPaymentDetails = getBankPaymentDetails(paymentMethod);
     
    }
   
    // console.log("[CreatePatientRegistration] Selected bank payment details (clinic-level):", selectedBankPaymentDetails);

    // Check if we have a doctor/agent, get their bank permissions (handle multiple payments)
    if (appointment?.doctorId && selectedBankPaymentDetails.enabled) {
      // console.log("[CreatePatientRegistration] Checking agent/doctor bank permissions for doctorId:", appointment.doctorId);
      try {
        const agentProfile = await AgentProfile.findOne({ userId: appointment.doctorId });
        // console.log("[CreatePatientRegistration] Fetched agent profile:", agentProfile);
        if (agentProfile && agentProfile.bankPermissions) {
          const methodMap = {
            "Card": "card",
            "Bank Transfer": "bankTransfer",
            "BT": "bankTransfer",
            "Tabby": "tabby",
            "Tamara": "tamara"
          };
          
          let allPermissionsEnabled = true;
          if (multiPayArr.length > 0) {
            // For multiple payments, check all payment methods
            for (const mp of multiPayArr) {
              const key = methodMap[mp.paymentMethod];
              if (key && agentProfile.bankPermissions[key] === false) {
                allPermissionsEnabled = false;
                break;
              }
            }
          } else {
            // Single payment method check
            const key = methodMap[paymentMethod];
            if (key && agentProfile.bankPermissions[key] === false) {
              allPermissionsEnabled = false;
            }
          }
          
          if (!allPermissionsEnabled) {
            // console.log("[CreatePatientRegistration] Doctor/agent has bank permission disabled for this method, disabling globally");
            selectedBankPaymentDetails = { enabled: false };
          }
        }
      } catch (err) {
        // console.error("[CreatePatientRegistration] Error getting agent profile for bank permissions:", err);
      }
    }
    //console.log("[CreatePatientRegistration] Final selected bank payment details:", selectedBankPaymentDetails);
    const earnedAmountForCommission = amountNum; // Amount before any deductions
    
    console.log("\n=== Package/Service Amount Split ===");
    console.log("amountNum:", amountNum);
    console.log("paidNum:", paidNum);
    console.log("pendingUsedNum:", pendingUsedNum);
    console.log("pendingClaimUsedNum:", pendingClaimUsedNum);
    console.log("hasPackagePayload:", hasPackagePayload);
    console.log("selectedPackageTreatments.length:", selectedPackageTreatments?.length);
    console.log("selectedTreatments (from req.body):", selectedTreatments);
    console.log("appointment.serviceId:", appointment?.serviceId);
    console.log("appointment.serviceIds:", appointment?.serviceIds);
    console.log("appointment.services:", appointment?.services);
    
    // Calculate package and service parts
    const hasPackageTreatments = hasPackagePayload && selectedPackageTreatments.length > 0;
    
    // For NEW package purchases without treatments (package-only billing):
    // - totalPackageSessionValue = 0 (no treatments consumed)
    // - The entire amountNum is for the package purchase
    // For EXISTING package billing with treatments:
    // - totalPackageSessionValue > 0 (sessions consumed)
    // - Split between service and package amounts
    let serviceAmount, packageAmount;
    if (hasPackageTreatments) {
      // Has selected treatments - split between service and package
      serviceAmount = Math.max(0, amountNum - totalPackageSessionValue);
      packageAmount = totalPackageSessionValue;
    } else if (hasPackagePayload && totalPackageSessionValue === 0) {
      // New package purchase without treatments - entire amount is for package
      serviceAmount = 0;
      packageAmount = amountNum;
    } else {
      // No package - entire amount is for service
      serviceAmount = amountNum;
      packageAmount = 0;
    }
    
    console.log("hasPackageTreatments:", hasPackageTreatments);
    console.log("serviceAmount:", serviceAmount);
    console.log("packageAmount:", packageAmount);
    console.log("totalPackageSessionValue:", totalPackageSessionValue);
    
    // Calculate commissionable amounts:
    let commissionablePaidAmount = Math.max(0, paidNum - pendingUsedNum - pendingClaimUsedNum);
    commissionablePaidAmount = Math.min(commissionablePaidAmount, amountNum);
    
    console.log("commissionablePaidAmount (before service split):", commissionablePaidAmount);
    
    // Split service amount into appointment treatments and direct treatments
    let appointmentTreatmentsAmount = 0;
    let directTreatmentsAmount = 0;
    const appointmentServiceIds = new Set();
    if (appointment?.serviceId) appointmentServiceIds.add(String(appointment.serviceId));
    if (appointment?.serviceIds) {
      appointment.serviceIds.forEach(id => appointmentServiceIds.add(String(id)));
    }
    console.log("appointmentServiceIds:", Array.from(appointmentServiceIds));
    
    if (selectedTreatments && selectedTreatments.length > 0) {
      selectedTreatments.forEach(t => {
        const tServiceId = String(t.treatmentServiceId || t.treatmentSlug || "");
        const isFromAppointment = tServiceId && appointmentServiceIds.has(tServiceId);
        const originalQty = t.originalAppointmentQuantity || 0;
        const currentQty = t.quantity || 1;
        const unitPrice = t.price || 0;
        
        console.log(`
        Treatment: ${t.treatmentName}
        Service ID: ${tServiceId}
        Is from appointment: ${isFromAppointment}
        Original appointment qty: ${originalQty}
        Current qty: ${currentQty}
        Unit price: ${unitPrice}
        `);
        
        if (isFromAppointment) {
          // If it's from appointment, split the quantity
          const appointmentQty = Math.min(currentQty, originalQty);
          const directQty = Math.max(0, currentQty - originalQty);
          
          console.log(`Appointment qty: ${appointmentQty}, Direct qty: ${directQty}`);
          
          appointmentTreatmentsAmount += unitPrice * appointmentQty;
          directTreatmentsAmount += unitPrice * directQty;
        } else {
          // Not from appointment: all to direct
          directTreatmentsAmount += unitPrice * currentQty;
        }
      });
    } else {
      // If no selectedTreatments array, assume all is from appointment (backward compatibility)
      appointmentTreatmentsAmount = serviceAmount;
    }
    
    console.log("appointmentTreatmentsAmount:", appointmentTreatmentsAmount);
    console.log("directTreatmentsAmount:", directTreatmentsAmount);
    
    // Split commissionable paid amount proportionally between appointment and direct treatments
    const totalServiceAmount = appointmentTreatmentsAmount + directTreatmentsAmount;
    let appointmentCommissionablePaidAmount = 0;
    let directCommissionablePaidAmount = 0;
    
    if (totalServiceAmount > 0) {
      const appointmentRatio = appointmentTreatmentsAmount / totalServiceAmount;
      const directRatio = directTreatmentsAmount / totalServiceAmount;
      appointmentCommissionablePaidAmount = commissionablePaidAmount * appointmentRatio;
      directCommissionablePaidAmount = commissionablePaidAmount * directRatio;
    } else {
      appointmentCommissionablePaidAmount = 0;
      directCommissionablePaidAmount = 0;
    }
    
    console.log("appointmentCommissionablePaidAmount:", appointmentCommissionablePaidAmount);
    console.log("directCommissionablePaidAmount:", directCommissionablePaidAmount);
   
    if (multiPayArr.length > 0) {
    }
   
    // console.log("[CreatePatientRegistration] Original paid amount:", paidNum);
    // console.log("[CreatePatientRegistration] Pending used amount:", pendingUsedNum);
    // console.log("[CreatePatientRegistration] Pending claim used amount:", pendingClaimUsedNum);
    // console.log("[CreatePatientRegistration] Treatment/package amount (cap):", amountNum);
    // console.log("[CreatePatientRegistration] Final commissionable paid amount (capped):", commissionablePaidAmount);

    // Track referral commission amount (will be used to adjust doctor/staff commission if both are applicable
    let referralCommissionAmount = 0;
    let referralShareForAppointment = 0;
    let referralShareForDirect = 0;
    
    // Commission calculation and storage
    try {
      // Referral commission only for service part
      const paidNumForReferralCommission = commissionablePaidAmount;
      const referredByStr = String(referredBy || "").trim();
      
      console.log("=== Referral Commission Check ===");
      console.log("paidNumForReferralCommission:", paidNumForReferralCommission);
      console.log("referredByStr:", referredByStr);
      console.log("appointmentCommissionablePaidAmount:", appointmentCommissionablePaidAmount);
      console.log("directCommissionablePaidAmount:", directCommissionablePaidAmount);
      
      if (
        paidNumForReferralCommission > 0 &&
        referredByStr &&
        referredByStr.toLowerCase() !== "no"
      ) {
        // Find referral by combined name within this clinic
        const referrals = await Referral.find({ clinicId: clinic._id }).lean();
        console.log("Found referrals:", referrals);
        
        const match = referrals.find((r) => {
          const full =
            `${(r.firstName || "").trim()} ${(r.lastName || "").trim()}`
              .trim()
              .toLowerCase();
          console.log("Checking referral:", full, "vs", referredByStr.toLowerCase());
          return full && full === referredByStr.toLowerCase();
        });
        
        console.log("Referral match found:", !!match);
        
        if (match) {
          const commissionPercent = Number(match.referralPercent || 0);
          console.log("Referral commission percent:", commissionPercent);
          if (commissionPercent > 0) {
            // Check if we need to apply bank deduction before or after commission
            const applyDeductionAfterCommission = selectedBankPaymentDetails.enabled && selectedBankPaymentDetails.applyOn === "earned";
            // console.log("[CreatePatientRegistration] Referral: applyDeductionAfterCommission:", applyDeductionAfterCommission);
            
            let adjustedAmount = paidNumForReferralCommission;
            let bankDeductionResult = {
              enabled: false,
              type: null,
              value: null,
              applyOn: null,
              deductionAmount: 0,
              finalEarnedAmount: earnedAmountForCommission,
              finalPaidAmount: paidNumForReferralCommission,
              deductionApplied: false
            };

            if (selectedBankPaymentDetails.enabled && !applyDeductionAfterCommission) {
              // Apply bank deduction first (applyOn: paid)
              // console.log("[CreatePatientRegistration] Calculating referral commission with bank deductions BEFORE commission");
              bankDeductionResult = calculateBankDeduction({
                earnedAmount: earnedAmountForCommission,
                paidAmount: paidNumForReferralCommission,
                bankPaymentDetails: selectedBankPaymentDetails
              });
              // console.log("[CreatePatientRegistration] Referral bank deduction result:", bankDeductionResult);
              adjustedAmount = bankDeductionResult.finalPaidAmount;
            } else if (applyDeductionAfterCommission) {
              // console.log("[CreatePatientRegistration] Will apply bank deductions AFTER referral commission");
            }

            // Calculate referral commission (based on full paid amount)
            let commissionAmount = Number(
              ((adjustedAmount * commissionPercent) / 100).toFixed(2)
            );
            // console.log("[CreatePatientRegistration] Original referral commission amount before deduction:", commissionAmount);

            // Now apply bank deduction to commission amount if applyOn is "earned"
            if (applyDeductionAfterCommission) {
              // console.log("[CreatePatientRegistration] Applying bank deduction AFTER referral commission (applyOn: earned)");
              
              let deductionAmount = 0;
              // console.log("[CreatePatientRegistration] Referral bank payment details for deduction:", {
              //   type: selectedBankPaymentDetails.type,
              //   value: selectedBankPaymentDetails.value
              // });
              
              if (selectedBankPaymentDetails.type === "flat") {
                deductionAmount = Number(selectedBankPaymentDetails.value);
                // console.log(`[CreatePatientRegistration] Applying flat deduction: ${deductionAmount}`);
              } else if (selectedBankPaymentDetails.type === "percentage") {
                deductionAmount = (commissionAmount * Number(selectedBankPaymentDetails.value)) / 100;
                // console.log(`[CreatePatientRegistration] Applying percentage deduction: ${selectedBankPaymentDetails.value}% of ${commissionAmount} = ${deductionAmount}`);
              }
              
              // Apply deduction
              commissionAmount = Math.max(0, commissionAmount - deductionAmount);
              commissionAmount = Number(commissionAmount.toFixed(2));
              
              bankDeductionResult = {
                enabled: true,
                type: selectedBankPaymentDetails.type,
                value: selectedBankPaymentDetails.value,
                applyOn: selectedBankPaymentDetails.applyOn,
                deductionAmount: Number(deductionAmount.toFixed(2)),
                finalEarnedAmount: earnedAmountForCommission,
                finalPaidAmount: paidNumForReferralCommission,
                deductionApplied: true
              };
              
              console.log("[CreatePatientRegistration] Referral bank deduction on commission:", {
                deductionAmount,
                finalCommissionAmount: commissionAmount
              });
            }

            // console.log("[CreatePatientRegistration] Final referral commission amount:", commissionAmount);
            
            // Store referral commission amount to adjust doctor/staff commission
            referralCommissionAmount = Number(commissionAmount);
            
            // Split referral commission into appointment and direct shares
            const totalServiceCommissionable = appointmentCommissionablePaidAmount + directCommissionablePaidAmount || 1;
            referralShareForAppointment = (appointmentCommissionablePaidAmount / totalServiceCommissionable) * referralCommissionAmount;
            referralShareForDirect = (directCommissionablePaidAmount / totalServiceCommissionable) * referralCommissionAmount;
            
            console.log("Referral split:");
            console.log("- referralCommissionAmount:", referralCommissionAmount);
            console.log("- referralShareForAppointment:", referralShareForAppointment);
            console.log("- referralShareForDirect:", referralShareForDirect);
            
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
            // Set commission base amount: use capped commissionable amount regardless of applyOn
            const referralCommissionBase = selectedBankPaymentDetails.enabled && selectedBankPaymentDetails.applyOn === "paid" ? adjustedAmount : paidNumForReferralCommission;
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
              amountPaid: paidNumForReferralCommission, // Already the capped amount!
              commissionAmount,
              commissionBaseAmount: referralCommissionBase,
              finalCommissionAmount: commissionAmount,
              invoicedDate: new Date(invoicedDate),
              notes: notes || "",
              createdBy: clinicUser._id,
              paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
              multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
              bankDeduction: {
                enabled: selectedBankPaymentDetails.enabled,
                type: selectedBankPaymentDetails.type,
                value: selectedBankPaymentDetails.value,
                applyOn: selectedBankPaymentDetails.applyOn,
                deductionAmount: bankDeductionResult.deductionAmount
              }
            });
          }
        }
      }
    } catch (commissionErr) {
      // console.error(
      //   "Commission calculation/store error (referral):",
      //   commissionErr,
      // );
      // Do not fail the billing creation if commission creation fails
    }

    // Update package payment status if unpaid packages are being paid
    if (unpaidPackagesPaid && Array.isArray(unpaidPackagesPaid) && unpaidPackagesPaid.length > 0) {
      // console.log('[PackagePaymentAPI] Updating package payment status for:', unpaidPackagesPaid);
      
      try {
        for (const pkgPayment of unpaidPackagesPaid) {
          const { packageId, packageSubId, amount, packageName } = pkgPayment;
          
          if (!packageId || !packageSubId) {
            console.warn('[PackagePaymentAPI] Skipping package with missing IDs:', pkgPayment);
            continue;
          }
          
          // Find the package in the patient's packages array and update it
          const patient = await PatientRegistration.findById(userId);
          
          if (patient && patient.packages && patient.packages.length > 0) {
            const packageIndex = patient.packages.findIndex(
              (pkg) => String(pkg._id) === String(packageSubId) && String(pkg.packageId) === String(packageId)
            );
            
            if (packageIndex !== -1) {
              // Update the package payment status - ADD the amount to existing paidAmount
              const currentPaid = patient.packages[packageIndex].paidAmount || 0;
              const newPaidAmount = currentPaid + (amount || 0);
              const totalPrice = patient.packages[packageIndex].totalPrice || 0;
              
              patient.packages[packageIndex].paidAmount = newPaidAmount;
              patient.packages[packageIndex].paymentMethod = paymentMethod || 'Cash';
              
              // Update payment status based on new paid amount
              if (newPaidAmount >= totalPrice) {
                patient.packages[packageIndex].paymentStatus = 'Full';
              } else if (newPaidAmount > 0) {
                patient.packages[packageIndex].paymentStatus = 'Partial';
              } else {
                patient.packages[packageIndex].paymentStatus = 'Unpaid';
              }
              
             
              
              await patient.save();
            } else {
              // console.warn('[PackagePaymentAPI] Package not found in patient packages array:', {
              //   packageId,
              //   packageSubId
              // });
            }
          }
        }
      } catch (packageUpdateError) {
        // console.error('[PackagePaymentAPI] Error updating package payment status:', packageUpdateError);
        // Don't fail the billing if package update fails
      }
    }

    // Update existing pending invoices if pendingUsedNum > 0
    if (pendingUsedNum > 0) {
      // console.log('[CreatePatientRegistration] Updating pending invoices with pendingUsed:', pendingUsedNum);
      
      // Fetch all pending invoices (oldest first)
      const pendingInvoices = await Billing.find({
        clinicId: clinic._id,
        patientId: patientRegistration._id,
        pending: { $gt: 0 },
        isAdvanceOnly: { $ne: true }
      }).sort({ invoicedDate: 1, createdAt: 1 });

      let remainingPendingUsed = pendingUsedNum;

      for (const invoice of pendingInvoices) {
        if (remainingPendingUsed <= 0) break;

        const paymentForInvoice = Math.min(remainingPendingUsed, invoice.pending);

        invoice.paid = (invoice.paid || 0) + paymentForInvoice;
        invoice.pending = invoice.pending - paymentForInvoice;

        await invoice.save();

        // Record the pending clearance payment on the ORIGINAL invoice
        // so the View modal shows the complete payment snapshot.
        try {
          const paymentEntry = {
            paymentMethod: paymentMethod || "Cash",
            amount: paymentForInvoice,
            paidAt: new Date(),
            paidBy: clinicUser._id,
            paidByName: clinicUser.name || clinicUser.firstName || "Staff",
            transactionType: "PENDING_CLEARANCE",
          };
          await Billing.findByIdAndUpdate(
            invoice._id,
            {
              $push: {
                multiplePayments: paymentEntry,
                paymentHistory: {
                  amount: invoice.amount || 0,
                  paid: invoice.paid,
                  pending: invoice.pending,
                  paymentMethod: paymentMethod || "Cash",
                  multiplePayments: [paymentEntry],
                  status: invoice.pending <= 0 ? "Completed" : "Active",
                  updatedAt: new Date(),
                  amountPaid: paymentForInvoice,
                  advanceAmountUsed: 0,
                  remainingPending: invoice.pending,
                },
              },
            },
            { new: false },
          );
        } catch (origUpdateErr) {
          console.error(
            "[PendingLedger] Failed to update original invoice",
            invoice.invoiceNumber,
            origUpdateErr.message,
          );
        }

        remainingPendingUsed -= paymentForInvoice;
      }

     
      try {
        const { default: PatientPendingLedger } = await import(
          "../../../models/PatientPendingLedger"
        );
        const { applyClearance } = await import("../../../lib/pendingLedger");

        // Build FIFO allocations against Open/Partial ledger rows
        const openLedgers = await PatientPendingLedger.find({
          patientId: patientRegistration._id,
          clinicId: clinic._id,
          status: { $in: ["Open", "Partial"] },
        })
          .sort({ createdAt: 1 })
          .lean();

        const allocations = [];
        let remainingLedger = pendingUsedNum;
        for (const l of openLedgers) {
          if (remainingLedger <= 0) break;
          const take = Math.min(
            remainingLedger,
            Number(l.remainingAmount || 0),
          );
          if (take > 0) {
            allocations.push({ ledgerId: l.ledgerId, amount: take });
            remainingLedger = Number((remainingLedger - take).toFixed(2));
          }
        }

        if (allocations.length > 0) {
          const clearanceResult = await applyClearance({
            allocations,
            clearingBillingId: billing._id,
            clearingInvoiceNumber: invoiceNumber,
            paymentMethod: paymentMethod || "Cash",
            paidBy: clinicUser._id,
            paidByName: clinicUser.name || "Clinic Staff",
            transactionType: "PENDING_CLEARANCE",
            notes: `Cleared via invoice ${invoiceNumber}`,
            // Standalone MongoDB (local dev) doesn't support multi-doc txns;
            // each ledger.save() + recomputeBillingCache is still atomic per doc.
            useTransaction: false,
          });

          const breakdown = Array.isArray(clearanceResult?.breakdown)
            ? clearanceResult.breakdown
            : [];

          if (breakdown.length > 0) {
            // Persist the per-treatment breakdown onto the new billing so
            // the audit trail (which treatment / which invoice this
            // payment cleared) is visible from the billing record itself.
            await Billing.findByIdAndUpdate(
              billing._id,
              {
                $set: {
                  pendingClearedBreakdown: breakdown.map((b) => ({
                    ledgerId: b.ledgerId,
                    invoiceNumber: b.invoiceNumber,
                    service: b.service,
                    treatmentSlug: b.treatmentSlug || null,
                    treatmentName: b.treatmentName || null,
                    packageId: b.packageId || null,
                    packageName: b.packageName || null,
                    amountCleared: b.amountCleared,
                    newStatus: b.newStatus,
                    newRemaining: b.newRemaining,
                    paymentMethod: b.paymentMethod || paymentMethod || null,
                  })),
                },
              },
              { new: false },
            );

            // Also push the breakdown onto each ORIGINAL invoice so the
            // View modal shows the pending clearance details.
            const breakdownByInvoice = new Map();
            for (const b of breakdown) {
              const inv = breakdownByInvoice.get(b.invoiceNumber) || [];
              inv.push({
                ledgerId: b.ledgerId,
                invoiceNumber: b.invoiceNumber,
                service: b.service,
                treatmentSlug: b.treatmentSlug || null,
                treatmentName: b.treatmentName || null,
                packageId: b.packageId || null,
                packageName: b.packageName || null,
                amountCleared: b.amountCleared,
                newStatus: b.newStatus,
                newRemaining: b.newRemaining,
                paymentMethod: b.paymentMethod || paymentMethod || null,
              });
              breakdownByInvoice.set(b.invoiceNumber, inv);
            }
            for (const [invNum, items] of breakdownByInvoice) {
              try {
                await Billing.findOneAndUpdate(
                  { invoiceNumber: invNum, clinicId: clinic._id },
                  { $push: { pendingClearedBreakdown: { $each: items } } },
                  { new: false },
                );
              } catch (origBreakdownErr) {
                console.error(
                  "[PendingLedger] Failed to push breakdown to original invoice",
                  invNum,
                  origBreakdownErr.message,
                );
              }
            }

            console.log(
              "[PendingLedger] Cleared",
              breakdown.length,
              "ledger row(s) via invoice",
              invoiceNumber,
            );
          }
        } else {
          console.warn(
            "[PendingLedger] pendingUsed=" +
              pendingUsedNum +
              " but no Open/Partial ledger rows found for patient " +
              String(patientRegistration._id) +
              ". Legacy Billing.pending was still updated. Run scripts/migrate-pending-ledger.js to backfill historical billings.",
          );
        }
      } catch (ledgerClearErr) {
        // Never fail the billing because the ledger sync failed; the
        // legacy fields were already updated above.
        console.error(
          "[PendingLedger] Failed to mirror clearance into ledger for invoice",
          invoiceNumber,
          ledgerClearErr,
        );
      }
    }

    // Update insurance claim pendingClaim when pendingClaimUsedNum > 0
    // This mirrors the pending invoice update logic above - reduces claim's pendingClaim field
    // so the patient profile correctly reflects paid status
    if (pendingClaimUsedNum > 0) {
      try {
        // Find Released insurance claims with pending claim for this patient (oldest first)
        const pendingClaims = await InsuranceClaim.find({
          clinicId: clinic._id,
          patientId: patientRegistration._id,
          status: "Released",
          pendingClaim: { $gt: 0 }
        }).sort({ createdAt: 1 });

        let remainingPendingClaimUsed = pendingClaimUsedNum;

        for (const claim of pendingClaims) {
          if (remainingPendingClaimUsed <= 0) break;

          const currentPending = Number(claim.pendingClaim || 0);
          const paymentForClaim = Math.min(remainingPendingClaimUsed, currentPending);
          const newPendingClaim = Math.max(0, currentPending - paymentForClaim);

          claim.pendingClaim = newPendingClaim;

          // If pending claim is fully paid, update advanceStatus to Full Pay
          // and set advanceAmount to finalClaimAmount (full payment completed)
          if (newPendingClaim === 0) {
            claim.advanceStatus = "Full Pay";
            // For "Paid" type claims, manually set advanceAmount to finalClaimAmount
            // (pre-save hook only handles "Advance" type automatically)
            if (claim.claimType === "Paid") {
              claim.advanceAmount = Number(claim.finalClaimAmount || claim.claimAmount || 0);
            }
            // For "Advance" type, the pre-save hook sets advanceAmount = claimAmount
          }

          await claim.save();
          remainingPendingClaimUsed -= paymentForClaim;
        }
      } catch (claimUpdateError) {
        console.error('[CreatePatientRegistration] Error updating insurance claim pendingClaim:', claimUpdateError.message);
        // Don't fail the billing if claim update fails
      }
    }

    // Doctor/Staff commission based on AgentProfile (supports flat, target-based, and after_deduction)
    try {
      console.log("\n=== Doctor/Staff Commission Check ===");
      console.log("appointmentCommissionablePaidAmount:", appointmentCommissionablePaidAmount);
      console.log("appointment?.doctorId:", appointment?.doctorId);
      console.log("Condition (appointmentCommissionablePaidAmount > 0 && appointment?.doctorId):", appointmentCommissionablePaidAmount > 0 && appointment?.doctorId);
      
      // Calculate adjusted paid amount for doctor/staff: if referral commission was given, subtract it from the paid amount
        const adjustedDoctorStaffPaidAmount = Math.max(0, appointmentCommissionablePaidAmount - referralShareForAppointment);
      
      
      if (appointmentCommissionablePaidAmount > 0 && appointment?.doctorId) {
      
        // console.log("[CreatePatientRegistration] Doctor/Staff commission calculation:");
        // console.log("[CreatePatientRegistration]   - Original paid amount:", commissionablePaidAmount);
        // console.log("[CreatePatientRegistration]   - Referral commission amount:", referralCommissionAmount);
        // console.log("[CreatePatientRegistration]   - Adjusted paid amount for doctor/staff:", adjustedDoctorStaffPaidAmount);
        
        // Use the commission calculator to determine commission
        // console.log("Calling calculateCommissionForStaff with:", {
        //   staffId: appointment.doctorId,
        //   clinicId: clinic._id,
        //   paidAmount: adjustedDoctorStaffPaidAmount,
        //   earnedAmount: earnedAmountForCommission,
        //   patientId: patientRegistration._id,
        //   appointmentId: appointment._id,
        //   currentBillingId: billing._id,
        //   bankPaymentDetails: selectedBankPaymentDetails
        // });
        const commissionResult = await calculateCommissionForStaff({
          staffId: appointment.doctorId,
          clinicId: clinic._id,
          paidAmount: adjustedDoctorStaffPaidAmount, // Use adjusted amount instead of full amount
          earnedAmount: earnedAmountForCommission,
          patientId: patientRegistration._id,
          appointmentId: appointment._id,
          currentBillingId: billing._id, // Pass the billing ID to exclude it from "last billing" query
          bankPaymentDetails: selectedBankPaymentDetails,
        });
       

        console.log("commissionResult.shouldCreateCommission:", commissionResult.shouldCreateCommission);
        if (commissionResult.shouldCreateCommission) {
          console.log("Creating doctor/staff commission entry...");
          const commissionData = {
            clinicId: clinic._id,
            source: "staff",
            staffId: appointment.doctorId,
            commissionType: commissionResult.commissionType,
            appointmentId: appointment._id,
            patientId: patientRegistration._id,
            billingId: billing._id,
            commissionPercent: commissionResult.commissionPercentage,
            amountPaid: appointmentCommissionablePaidAmount, // Store only the capped treatment/service price
            commissionAmount: commissionResult.commissionAmount,
            invoicedDate: new Date(invoicedDate),
            notes: notes || "",
            createdBy: clinicUser._id,
            paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
            multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
            bankDeduction: {
              enabled: commissionResult.bankDeduction?.enabled || false,
              type: commissionResult.bankDeduction?.type,
              value: commissionResult.bankDeduction?.value,
              applyOn: commissionResult.bankDeduction?.applyOn,
              deductionAmount: commissionResult.bankDeduction?.deductionAmount
            },
            referralCommissionDeducted: referralShareForAppointment // Store referral commission deducted
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
          // If applyOn is paid, use finalPaidAmount as base; if applyOn is earned, use adjusted amount (after referral deducted) as base
          let commissionBaseAmount;
          if (commissionResult.bankDeduction.deductionApplied && selectedBankPaymentDetails.applyOn === "paid") {
            commissionBaseAmount = commissionResult.bankDeduction.finalPaidAmount || adjustedDoctorStaffPaidAmount;
          } else {
            commissionBaseAmount = adjustedDoctorStaffPaidAmount; // Use adjusted amount (after referral deducted)
          }
          
          if (commissionType === "target_based") {
            // Base = only the amount above target (commission is earned only on excess)
            commissionBaseAmount = commissionResult.amountAboveTarget || 0;
          } else if (commissionType === "after_deduction") {
            // netAmount = paidAmount - billingExpenses (already computed by calculator from adjusted amount)
            commissionBaseAmount = commissionResult.netAmount || 0;
          } else if (commissionType === "target_plus_expense") {
            // netCommissionableAmount = amountAboveTarget - expenses (already computed by calculator from adjusted amount)
            commissionBaseAmount =
              commissionResult.netCommissionableAmount || 0;
          }
          commissionData.commissionBaseAmount = commissionBaseAmount;
          commissionData.finalCommissionAmount =
            commissionResult.commissionAmount || 0;

         
          const createdCommission = await Commission.create(commissionData);
          console.log("✅ Doctor/staff commission created successfully:", createdCommission._id);
        
          // console.log(
          //   `Commission not created for staff ${appointment.doctorId}: ${commissionResult.reason}`,
          // );
        }
      }
    } catch (staffCommissionErr) {
      console.error("❌ Commission calculation/store error (staff):", staffCommissionErr);
      // Do not fail the billing creation if commission creation fails
    }

    // Billed person (clinicUser) commission for directly added services
    try {
      console.log("\n=== Billed Person Commission Check ===");
      console.log("directCommissionablePaidAmount:", directCommissionablePaidAmount);
      console.log("clinicUser._id:", clinicUser._id);
      console.log("Condition (directCommissionablePaidAmount > 0):", directCommissionablePaidAmount > 0);
      
      // Check if we should calculate commission for the billed person
      if (directCommissionablePaidAmount > 0) {
        console.log("Conditions met for billed person commission (direct treatments)");
        
        // Calculate adjusted paid amount: subtract referral commission (only the share for direct treatments)
        const adjustedBilledPersonPaidAmount = Math.max(0, directCommissionablePaidAmount - referralShareForDirect);
        console.log("adjustedBilledPersonPaidAmount:", adjustedBilledPersonPaidAmount);
        
        // Use the same commission calculator for consistency
        const commissionResult = await calculateCommissionForStaff({
          staffId: clinicUser._id,
          clinicId: clinic._id,
          paidAmount: adjustedBilledPersonPaidAmount,
          earnedAmount: earnedAmountForCommission,
          patientId: patientRegistration._id,
          appointmentId: appointment?._id, // Use appointment if exists, otherwise undefined
          currentBillingId: billing._id,
          bankPaymentDetails: selectedBankPaymentDetails,
        });
        
        console.log("commissionResult for billed person:", commissionResult);
        
        if (commissionResult.shouldCreateCommission) {
          console.log("Creating commission entry for billed person");
          
          const commissionType = commissionResult.commissionType;
          
          // Determine commission base amount (same as existing logic)
          let commissionBaseAmount;
          if (commissionResult.bankDeduction.deductionApplied && selectedBankPaymentDetails.applyOn === "paid") {
            commissionBaseAmount = commissionResult.bankDeduction.finalPaidAmount || adjustedBilledPersonPaidAmount;
          } else {
            commissionBaseAmount = adjustedBilledPersonPaidAmount;
          }
          
          if (commissionType === "target_based") {
            commissionBaseAmount = commissionResult.amountAboveTarget || 0;
          } else if (commissionType === "after_deduction") {
            commissionBaseAmount = commissionResult.netAmount || 0;
          } else if (commissionType === "target_plus_expense") {
            commissionBaseAmount = commissionResult.netCommissionableAmount || 0;
          }
          
          const commissionData = {
            clinicId: clinic._id,
            source: "staff",
            staffId: clinicUser._id,
            commissionType: commissionResult.commissionType,
            appointmentId: appointment?._id || null,
            patientId: patientRegistration._id,
            billingId: billing._id,
            commissionPercent: commissionResult.commissionPercentage,
            amountPaid: directCommissionablePaidAmount,
            commissionAmount: commissionResult.commissionAmount,
            invoicedDate: new Date(invoicedDate),
            notes: "Billed person commission",
            createdBy: clinicUser._id,
            paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
            multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
            bankDeduction: {
              enabled: commissionResult.bankDeduction?.enabled || false,
              type: commissionResult.bankDeduction?.type,
              value: commissionResult.bankDeduction?.value,
              applyOn: commissionResult.bankDeduction?.applyOn,
              deductionAmount: commissionResult.bankDeduction?.deductionAmount
            },
            referralCommissionDeducted: referralShareForDirect,
            commissionBaseAmount,
            finalCommissionAmount: commissionResult.commissionAmount || 0
          };
          
          // Add target-based specific fields if applicable
          if (commissionType === "target_based") {
            commissionData.targetAmount = commissionResult.targetAmount || 0;
            commissionData.cumulativeAchieved = commissionResult.cumulativeAchieved || 0;
            commissionData.isAboveTarget = commissionResult.isAboveTarget || false;
          }

          // Add after_deduction specific fields if applicable
          if (commissionType === "after_deduction") {
            commissionData.totalExpenses = commissionResult.totalExpenses || 0;
            commissionData.netAmount = commissionResult.netAmount || 0;
            commissionData.expenseBreakdown = commissionResult.expenseBreakdown || [];
            commissionData.complaintsCount = commissionResult.complaintsCount || 0;
            commissionData.lastBillingDate = commissionResult.lastBillingDate || null;
            commissionData.lastBillingInvoice = commissionResult.lastBillingInvoice || null;
            commissionData.isFirstBilling = commissionResult.isFirstBilling || false;
          }

          // Add target_plus_expense specific fields if applicable
          if (commissionType === "target_plus_expense") {
            commissionData.targetAmount = commissionResult.targetAmount || 0;
            commissionData.cumulativeAchieved = commissionResult.cumulativeAchieved || 0;
            commissionData.isAboveTarget = commissionResult.isAboveTarget || false;
            commissionData.amountAboveTarget = commissionResult.amountAboveTarget || 0;
            commissionData.totalExpenses = commissionResult.totalExpenses || 0;
            commissionData.netCommissionableAmount = commissionResult.netCommissionableAmount || 0;
            commissionData.expenseBreakdown = commissionResult.expenseBreakdown || [];
            commissionData.complaintsCount = commissionResult.complaintsCount || 0;
          }
          
          await Commission.create(commissionData);
          console.log("=== Billed Person Commission Created Successfully ===");
        } else {
          console.log("No billed person commission created:", commissionResult.reason);
        }
      } else {
        if (!(directCommissionablePaidAmount > 0)) {
          console.log("No billed person commission: directCommissionablePaidAmount is not > 0");
        }
      }
    } catch (billedPersonCommissionErr) {
      console.error("❌ Commission calculation/store error (billed person):", billedPersonCommissionErr);
      // Do not fail the billing creation if commission creation fails
    }

    // Package Sold By Person commission
    try {
      console.log("=== Package Sold By Person Commission Start ===");
      console.log("hasPackageTreatments:", hasPackageTreatments);
      console.log("hasPackagePayload:", hasPackagePayload);
      console.log("packageSoldByUserId:", packageSoldByUserId);
      console.log("packagePaymentStatus:", packagePaymentStatus);
      
      // For package sold by person commission:
      // - hasPackageTreatments: billing sessions from existing package (totalPackageSessionValue > 0)
      // - hasPackagePayload && !hasPackageTreatments: new package purchase without consuming sessions (packageAmount > 0)
      const shouldCalculatePackageCommission = (hasPackageTreatments || (hasPackagePayload && packageAmount > 0)) && packageSoldByUserId && (packagePaymentStatus === 'Full' || packagePaymentStatus === 'Partial' || packagePaymentStatus === 'paid');
      
      if (shouldCalculatePackageCommission) {
        console.log("Conditions met, checking AgentProfile for packageSoldByUserId:", packageSoldByUserId);
        // Check if packageSoldByUser has commission configured
        const soldByAgentProfile = await AgentProfile.findOne({ userId: packageSoldByUserId });
        console.log("soldByAgentProfile found:", !!soldByAgentProfile);
        console.log("soldByAgentProfile.commissionPercentage:", soldByAgentProfile?.commissionPercentage);
        
        if (soldByAgentProfile && soldByAgentProfile.commissionPercentage && soldByAgentProfile.commissionPercentage > 0) {
          // Calculate commission for sold by person
          const commissionPercent = Number(soldByAgentProfile.commissionPercentage);
          console.log("Commission percent to use:", commissionPercent);
          
          // Check if we need to apply bank deduction before or after commission
          const applyDeductionAfterCommission = selectedBankPaymentDetails.enabled && selectedBankPaymentDetails.applyOn === "earned";
          
          // For package commission base amount:
          // - If hasPackageTreatments: use totalPackageSessionValue (session-based billing)
          // - If new package purchase: use packageAmount (full package price)
          const commissionBaseAmount = hasPackageTreatments ? totalPackageSessionValue : packageAmount;
          console.log("commissionBaseAmount:", commissionBaseAmount);
          console.log("totalPackageSessionValue:", totalPackageSessionValue);
          console.log("packageAmount:", packageAmount);
          
          let baseAmount = commissionBaseAmount;
          let adjustedAmount = baseAmount;
          let bankDeductionResult = {
        enabled: false,
        type: null,
        value: null,
        applyOn: null,
        deductionAmount: 0,
        finalEarnedAmount: commissionBaseAmount,
        finalPaidAmount: commissionBaseAmount,
        deductionApplied: false
      };

          console.log("selectedBankPaymentDetails:", selectedBankPaymentDetails);
          console.log("applyDeductionAfterCommission:", applyDeductionAfterCommission);
          
          if (selectedBankPaymentDetails.enabled && !applyDeductionAfterCommission) {
            // Apply bank deduction first (applyOn: paid)
            console.log("Applying bank deduction BEFORE commission (applyOn: paid)");
            bankDeductionResult = calculateBankDeduction({
              earnedAmount: commissionBaseAmount,
              paidAmount: baseAmount,
              bankPaymentDetails: selectedBankPaymentDetails
            });
            adjustedAmount = bankDeductionResult.finalPaidAmount;
            console.log("Bank deduction result (before commission):", bankDeductionResult);
            console.log("Adjusted amount after bank deduction:", adjustedAmount);
          }

          // Calculate commission
          let commissionAmount = Number(
            ((adjustedAmount * commissionPercent) / 100).toFixed(2)
          );
          console.log("Commission amount before any after deductions:", commissionAmount);

          // Now apply bank deduction to commission amount if applyOn is "earned"
          if (applyDeductionAfterCommission) {
            console.log("Applying bank deduction AFTER commission (applyOn: earned)");
            let deductionAmount = 0;
            
            if (selectedBankPaymentDetails.type === "flat") {
              deductionAmount = Number(selectedBankPaymentDetails.value);
              console.log("Flat deduction amount:", deductionAmount);
            } else if (selectedBankPaymentDetails.type === "percentage") {
              deductionAmount = (commissionAmount * Number(selectedBankPaymentDetails.value)) / 100;
              console.log("Percentage deduction amount:", deductionAmount);
            }
            
            // Apply deduction
            commissionAmount = Math.max(0, commissionAmount - deductionAmount);
            commissionAmount = Number(commissionAmount.toFixed(2));
            console.log("Commission amount after bank deduction:", commissionAmount);
            
            bankDeductionResult = {
              enabled: true,
              type: selectedBankPaymentDetails.type,
              value: selectedBankPaymentDetails.value,
              applyOn: selectedBankPaymentDetails.applyOn,
              deductionAmount: Number(deductionAmount.toFixed(2)),
              finalEarnedAmount: commissionBaseAmount,
              finalPaidAmount: packageCommissionablePaidAmount,
              deductionApplied: true
            };
          }

          // Set commission base amount (for logging purposes, already defined above)
          const finalCommissionBaseAmount = selectedBankPaymentDetails.enabled && selectedBankPaymentDetails.applyOn === "paid" ? adjustedAmount : baseAmount;
          console.log("finalCommissionBaseAmount:", finalCommissionBaseAmount);
          
          // Create commission entry
          console.log("Creating Commission entry with amount:", commissionAmount);
          await Commission.create({
            clinicId: clinic._id,
            source: "staff",
            staffId: packageSoldByUserId,
            commissionType: "flat",
            appointmentId: appointment._id,
            patientId: patientRegistration._id,
            billingId: billing._id,
            commissionPercent,
            amountPaid: baseAmount, // Store the base session value
            commissionAmount,
            commissionBaseAmount,
            finalCommissionAmount: commissionAmount,
            invoicedDate: new Date(invoicedDate),
            notes: "Package sold by person commission",
            createdBy: clinicUser._id,
            paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
            multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
            bankDeduction: {
              enabled: bankDeductionResult.enabled,
              type: bankDeductionResult.type,
              value: bankDeductionResult.value,
              applyOn: bankDeductionResult.applyOn,
              deductionAmount: bankDeductionResult.deductionAmount
            }
          });
          console.log("=== Package Sold By Person Commission Created Successfully ===");
        } else {
          console.log("No commission created because soldByAgentProfile doesn't have a valid commission percentage");
        }
      } else {
        console.log("No package sold by person commission: conditions not met");
      }
    } catch (packageCommissionErr) {
      console.error("❌ Commission calculation/store error (package):", packageCommissionErr);
      // Do not fail the billing creation if commission creation fails
    }

    // ============================================================
    // Refresh the billing document from DB so the response includes
    // the latest cached fields written by the pending-ledger flow:
    //   - pendingLedgerCached, pendingLedgerOpenCount (set by
    //     recomputeBillingCache after createLedgerEntry)
    //   - pendingClearedBreakdown (set after applyClearance when
    //     pendingUsed > 0)
    // Falls back to the in-memory object if the reload fails.
    // ============================================================
    let billingForResponse = billing;
    try {
      // Quick verification: check if ledger row was actually created
      try {
        const { default: PatientPendingLedger } = await import(
          "../../../models/PatientPendingLedger"
        );
        const ledgerCount = await PatientPendingLedger.countDocuments({
          parentBillingId: billing._id,
        });
       
      } catch (verifyErr) {
        console.warn("[PendingLedger] Verification query failed:", verifyErr.message);
      }

      const refreshed = await Billing.findById(billing._id).lean();
      if (refreshed) {
        
        billingForResponse = refreshed;
      }
    } catch (refreshErr) {
      
    }

    return res.status(201).json({
      success: true,
      message: "Billing created successfully",
      billing:
        billingForResponse && typeof billingForResponse.toObject === "function"
          ? billingForResponse.toObject()
          : billingForResponse,
      staffTips: createdStaffTips,
      data: {
        _id: billing._id,
        invoiceNumber: billing.invoiceNumber,
      },
    });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create billing",
    });
  }
}
