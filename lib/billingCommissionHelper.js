/**
 * Billing Commission Helper
 * Centralized commission calculation and persistence for all billing/payment APIs.
 * Handles: Doctor commission, Billed person commission, Package sold by commission,
 * and Pending clearance commission.
 *
 * Called from:
 *   - create-patient-registration.js (new billing)
 *   - add-pending-payment/[patientId].js (overview pay button)
 *   - pay-invoice-pending/[billingId].js (invoice pending pay button)
 */

import Commission from "../models/Commission.js";
import AgentProfile from "../models/AgentProfile.js";
import User from "../models/Users.js";
import PatientRegistration from "../models/PatientRegistration.js";
import Billing from "../models/Billing.js";
import {
  calculateCommissionForStaff,
  calculateBankDeduction,
} from "./commissionCalculator.js";

/**
 * Process all commission types for a billing/payment event.
 *
 * @param {Object} params - All context needed for commission calculation
 * @returns {Object} { commissionRecords: [] } — array of created Commission documents
 */
export async function processBillingCommissions(params) {
  const {
    billing,
    appointment,
    patientRegistration,
    clinicId,
    clinicUser,
    directBilling,
    amountNum,
    paidNum,
    adjustedPendingUsed,
    pendingClaimUsedNum,
    totalUnpaidPackagesAmount,
    hasPackagePayload,
    hasPackageTreatments,
    totalPackageSessionValue,
    selectedTreatments,
    selectedPackageTreatments,
    packageSoldByUserId: initialPackageSoldByUserId,
    packagePaymentStatus: initialPackagePaymentStatus,
    pkgDoc,
    packageName,
    paymentMethod,
    multiPayArr,
    selectedBankPaymentDetails,
    invoicedDate,
    earnedAmountForCommission,
    referralCommissionAmount,
    paidNumForReferralCommission,
    processNewBillingCommission,
    processPendingClearanceCommission,
    billingNotes,
  } = params;

  const commissionRecords = [];

  // ============================================================
  // DEBUG: Log all incoming params
  // ============================================================
  console.log("========== COMMISSION HELPER START ==========");
  console.log("[Params] directBilling:", directBilling);
  console.log("[Params] amountNum:", amountNum, "paidNum:", paidNum);
  console.log("[Params] adjustedPendingUsed:", adjustedPendingUsed, "pendingClaimUsedNum:", pendingClaimUsedNum);
  console.log("[Params] totalUnpaidPackagesAmount:", totalUnpaidPackagesAmount);
  console.log("[Params] hasPackagePayload:", hasPackagePayload, "hasPackageTreatments:", hasPackageTreatments);
  console.log("[Params] totalPackageSessionValue:", totalPackageSessionValue);
  console.log("[Params] processNewBillingCommission:", processNewBillingCommission, "processPendingClearanceCommission:", processPendingClearanceCommission);
  console.log("[Params] appointment?._id:", appointment?._id, "appointment?.doctorId:", appointment?.doctorId);
  console.log("[Params] billing._id:", billing._id);
  console.log("[Params] clinicUser._id:", clinicUser?._id);
  console.log("[Params] initialPackageSoldByUserId:", initialPackageSoldByUserId);
  console.log("[Params] packageName:", packageName, "pkgDoc?._id:", pkgDoc?._id);
  console.log("[Params] selectedTreatments count:", Array.isArray(selectedTreatments) ? selectedTreatments.length : "N/A");
  console.log("[Params] selectedBankPaymentDetails:", JSON.stringify(selectedBankPaymentDetails));
  console.log("[Params] earnedAmountForCommission:", earnedAmountForCommission);
  console.log("[Params] referralCommissionAmount:", referralCommissionAmount, "paidNumForReferralCommission:", paidNumForReferralCommission);

  // ============================================================
  // Phase 1: Amount splitting (service vs package)
  // ============================================================
  let serviceAmount, packageAmount;
  if (hasPackageTreatments) {
    serviceAmount = Math.max(0, amountNum - totalPackageSessionValue);
    packageAmount = totalPackageSessionValue;
  } else if (hasPackagePayload && totalPackageSessionValue === 0) {
    const selectedTreatmentsTotal = Array.isArray(selectedTreatments)
      ? selectedTreatments.reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 1)), 0)
      : 0;
    if (selectedTreatmentsTotal > 0) {
      serviceAmount = Math.min(selectedTreatmentsTotal, amountNum);
      packageAmount = Math.max(0, amountNum - serviceAmount);
    } else {
      serviceAmount = 0;
      packageAmount = amountNum;
    }
  } else {
    serviceAmount = amountNum;
    packageAmount = 0;
  }

  // ============================================================
  // Phase 2: Commissionable paid amount calculation
  // ============================================================
  let commissionablePaidAmount = Math.max(0, paidNum - adjustedPendingUsed - pendingClaimUsedNum);
  commissionablePaidAmount = Math.min(commissionablePaidAmount, amountNum);

  // When unpaidPackagesPaid is present without a new package purchase,
  // the paid amount includes payment for previously unpaid packages.
  const unpaidPackagePaymentInPaid = !hasPackagePayload ? (totalUnpaidPackagesAmount || 0) : 0;

  const serviceCommissionablePaidAmount = Math.max(0, commissionablePaidAmount - packageAmount - unpaidPackagePaymentInPaid);

  console.log("[Phase 1] serviceAmount:", serviceAmount, "packageAmount:", packageAmount);
  console.log("[Phase 2] commissionablePaidAmount:", commissionablePaidAmount, "unpaidPackagePaymentInPaid:", unpaidPackagePaymentInPaid, "serviceCommissionablePaidAmount:", serviceCommissionablePaidAmount);

  // ============================================================
  // Phase 3: Split between appointment and direct treatments
  // ============================================================
  let appointmentTreatmentsAmount = 0;
  let directTreatmentsAmount = 0;
  const appointmentServiceIds = new Set();
  if (appointment?.serviceId) appointmentServiceIds.add(String(appointment.serviceId));
  if (appointment?.serviceIds) {
    appointment.serviceIds.forEach(id => appointmentServiceIds.add(String(id)));
  }

  if (selectedTreatments && selectedTreatments.length > 0) {
    selectedTreatments.forEach(t => {
      const tServiceId = String(t.treatmentServiceId || t.treatmentSlug || "");
      const isFromAppointment = tServiceId && appointmentServiceIds.has(tServiceId);
      const originalQty = t.originalAppointmentQuantity || 0;
      const currentQty = t.quantity || 1;
      const unitPrice = t.price || 0;

      if (isFromAppointment) {
        const appointmentQty = Math.min(currentQty, originalQty);
        const directQty = Math.max(0, currentQty - originalQty);
        appointmentTreatmentsAmount += unitPrice * appointmentQty;
        directTreatmentsAmount += unitPrice * directQty;
      } else {
        directTreatmentsAmount += unitPrice * currentQty;
      }
    });
  } else {
    appointmentTreatmentsAmount = serviceAmount;
  }

  const totalServiceAmount = appointmentTreatmentsAmount + directTreatmentsAmount;
  let appointmentCommissionablePaidAmount = 0;
  let directCommissionablePaidAmount = 0;

  if (totalServiceAmount > 0) {
    const appointmentRatio = appointmentTreatmentsAmount / totalServiceAmount;
    const directRatio = directTreatmentsAmount / totalServiceAmount;
    appointmentCommissionablePaidAmount = serviceCommissionablePaidAmount * appointmentRatio;
    directCommissionablePaidAmount = serviceCommissionablePaidAmount * directRatio;
  }

  // ============================================================
  // Phase 4: Referral split
  // ============================================================
  let referralShareForAppointment = 0;
  let referralShareForDirect = 0;

  if (referralCommissionAmount > 0) {
    const totalServiceCommissionable = appointmentCommissionablePaidAmount + directCommissionablePaidAmount || 1;
    referralShareForAppointment = (appointmentCommissionablePaidAmount / totalServiceCommissionable) * referralCommissionAmount;
    referralShareForDirect = (directCommissionablePaidAmount / totalServiceCommissionable) * referralCommissionAmount;
  }

  console.log("[Phase 3] appointmentTreatmentsAmount:", appointmentTreatmentsAmount, "directTreatmentsAmount:", directTreatmentsAmount);
  console.log("[Phase 3] appointmentCommissionablePaidAmount:", appointmentCommissionablePaidAmount, "directCommissionablePaidAmount:", directCommissionablePaidAmount);
  console.log("[Phase 4] referralShareForAppointment:", referralShareForAppointment, "referralShareForDirect:", referralShareForDirect);

  // ============================================================
  // Phase 5: Doctor/Staff commission (new billing)
  // ============================================================
  if (processNewBillingCommission) {
    try {
      const doctorCommissionablePaidAmount = appointmentCommissionablePaidAmount;
      const adjustedDoctorStaffPaidAmount = Math.max(0, doctorCommissionablePaidAmount - referralShareForAppointment);

      console.log("[Phase 5 - Doctor] processNewBillingCommission=true, doctorCommissionablePaidAmount:", doctorCommissionablePaidAmount);
      console.log("[Phase 5 - Doctor] directBilling:", directBilling, "doctorId:", appointment?.doctorId);
      console.log("[Phase 5 - Doctor] Conditions: !directBilling=", !directBilling, "amount>0=", doctorCommissionablePaidAmount > 0, "hasDoctorId=", !!appointment?.doctorId);

      if (!directBilling && doctorCommissionablePaidAmount > 0 && appointment?.doctorId) {
        console.log("[Phase 5 - Doctor] Calling calculateCommissionForStaff with staffId:", appointment.doctorId, "paidAmount:", adjustedDoctorStaffPaidAmount, "earnedAmount:", earnedAmountForCommission);
        const commissionResult = await calculateCommissionForStaff({
          staffId: appointment.doctorId,
          clinicId,
          paidAmount: adjustedDoctorStaffPaidAmount,
          earnedAmount: earnedAmountForCommission,
          patientId: patientRegistration._id,
          appointmentId: appointment._id,
          currentBillingId: billing._id,
          bankPaymentDetails: selectedBankPaymentDetails,
        });

        if (commissionResult.shouldCreateCommission) {
          const commissionData = buildCommissionData({
            clinicId,
            staffId: appointment.doctorId,
            commissionResult,
            appointmentId: appointment._id,
            patientId: patientRegistration._id,
            billingId: billing._id,
            amountPaid: doctorCommissionablePaidAmount,
            adjustedPaidAmount: adjustedDoctorStaffPaidAmount,
            invoicedDate,
            notes: billingNotes || "",
            createdBy: clinicUser._id,
            paymentMethod,
            multiPayArr,
            selectedBankPaymentDetails,
            referralShare: referralShareForAppointment,
          });
          const created = await Commission.create(commissionData);
          commissionRecords.push(created);
          console.log("✅ Doctor/staff commission created successfully:", created._id, "commissionAmount:", created.commissionAmount, "commissionType:", created.commissionType);
        } else {
          console.log("[Phase 5 - Doctor] calculateCommissionForStaff returned shouldCreateCommission=false", JSON.stringify(commissionResult));
        }
      }
    } catch (staffCommissionErr) {
      console.error("❌ Commission calculation/store error (staff):", staffCommissionErr);
    }

    // ============================================================
    // Phase 6: Billed person commission (new billing)
    // ============================================================
    try {
      const billedPersonCommissionablePaidAmount = directCommissionablePaidAmount;
      const billedPersonReferralShare = referralShareForDirect;

      console.log("[Phase 6 - BilledPerson] directBilling:", directBilling, "billedPersonCommissionablePaidAmount:", billedPersonCommissionablePaidAmount);
      console.log("[Phase 6 - BilledPerson] Conditions: directBilling=", directBilling, "amount>0=", billedPersonCommissionablePaidAmount > 0);

      if (directBilling && billedPersonCommissionablePaidAmount > 0) {
        const adjustedBilledPersonPaidAmount = Math.max(0, billedPersonCommissionablePaidAmount - billedPersonReferralShare);
        console.log("[Phase 6 - BilledPerson] Calling calculateCommissionForStaff with staffId:", clinicUser._id, "paidAmount:", adjustedBilledPersonPaidAmount);

        const commissionResult = await calculateCommissionForStaff({
          staffId: clinicUser._id,
          clinicId,
          paidAmount: adjustedBilledPersonPaidAmount,
          earnedAmount: earnedAmountForCommission,
          patientId: patientRegistration._id,
          appointmentId: appointment?._id,
          currentBillingId: billing._id,
          bankPaymentDetails: selectedBankPaymentDetails,
        });

        if (commissionResult.shouldCreateCommission) {
          const commissionData = buildCommissionData({
            clinicId,
            staffId: clinicUser._id,
            commissionResult,
            appointmentId: appointment?._id || null,
            patientId: patientRegistration._id,
            billingId: billing._id,
            amountPaid: billedPersonCommissionablePaidAmount,
            adjustedPaidAmount: adjustedBilledPersonPaidAmount,
            invoicedDate,
            notes: "Billed person commission",
            createdBy: clinicUser._id,
            paymentMethod,
            multiPayArr,
            selectedBankPaymentDetails,
            referralShare: referralShareForDirect,
          });
          const created = await Commission.create(commissionData);
          commissionRecords.push(created);
        }
      }
    } catch (billedPersonCommissionErr) {
      console.error("❌ Billed person commission error:", billedPersonCommissionErr);
    }

    // ============================================================
    // Phase 7: Package Sold By Person commission (new billing)
    // ============================================================
    try {
      let packageSoldByUserId = initialPackageSoldByUserId;
      let packagePaymentStatus = initialPackagePaymentStatus;

      // Fallback: resolve from patient profile if still null
      if (!packageSoldByUserId && hasPackagePayload && packageAmount > 0) {
        const freshPatientForPkg = await PatientRegistration.findById(patientRegistration._id).lean();
        const matchedPkg = freshPatientForPkg?.packages?.find(p =>
          String(p.packageId) === String(pkgDoc?._id) || p.packageName === packageName
        );
        if (matchedPkg) {
          if (matchedPkg.packageSoldByUserId) {
            packageSoldByUserId = matchedPkg.packageSoldByUserId;
          } else if (matchedPkg.packageSoldBy) {
            const pkgSoldByName = matchedPkg.packageSoldBy.trim();
            const foundPkgUser = await User.findOne({
              clinicId,
              $or: [
                { name: pkgSoldByName },
                { $expr: { $eq: [{ $concat: ['$firstName', ' ', '$lastName'] }, pkgSoldByName] } }
              ]
            }).lean();
            if (foundPkgUser) {
              packageSoldByUserId = foundPkgUser._id;
            }
          }
          if (matchedPkg.paymentStatus) {
            packagePaymentStatus = matchedPkg.paymentStatus;
          }
        }
        if (!packageSoldByUserId) {
          packageSoldByUserId = clinicUser._id;
        }
      }

      const shouldCalculatePackageCommission =
        (hasPackageTreatments || (hasPackagePayload && packageAmount > 0)) &&
        packageSoldByUserId &&
        (packagePaymentStatus === 'Full' || packagePaymentStatus === 'Partial' || packagePaymentStatus === 'paid');

      console.log("[Phase 7 - Package] packageSoldByUserId:", packageSoldByUserId, "packagePaymentStatus:", packagePaymentStatus);
      console.log("[Phase 7 - Package] shouldCalculatePackageCommission:", shouldCalculatePackageCommission);
      console.log("[Phase 7 - Package] hasPackageTreatments:", hasPackageTreatments, "hasPackagePayload:", hasPackagePayload, "packageAmount:", packageAmount);

      if (shouldCalculatePackageCommission) {
        const soldByAgentProfile = await AgentProfile.findOne({ userId: packageSoldByUserId });

        if (soldByAgentProfile && soldByAgentProfile.commissionPercentage && soldByAgentProfile.commissionPercentage > 0) {
          const commissionPercent = Number(soldByAgentProfile.commissionPercentage);
          const applyDeductionAfterCommission = selectedBankPaymentDetails.enabled && selectedBankPaymentDetails.applyOn === "earned";
          const commissionBaseAmount = hasPackageTreatments ? totalPackageSessionValue : packageAmount;

          let baseAmount = commissionBaseAmount;
          let adjustedAmount = baseAmount;
          let bankDeductionResult = {
            enabled: false, type: null, value: null, applyOn: null,
            deductionAmount: 0, finalEarnedAmount: commissionBaseAmount,
            finalPaidAmount: commissionBaseAmount, deductionApplied: false
          };

          if (selectedBankPaymentDetails.enabled && !applyDeductionAfterCommission) {
            bankDeductionResult = calculateBankDeduction({
              earnedAmount: commissionBaseAmount,
              paidAmount: baseAmount,
              bankPaymentDetails: selectedBankPaymentDetails
            });
            adjustedAmount = bankDeductionResult.finalPaidAmount;
          }

          let commissionAmount = Number(((adjustedAmount * commissionPercent) / 100).toFixed(2));

          if (applyDeductionAfterCommission) {
            let deductionAmount = 0;
            if (selectedBankPaymentDetails.type === "flat") {
              deductionAmount = Number(selectedBankPaymentDetails.value);
            } else if (selectedBankPaymentDetails.type === "percentage") {
              deductionAmount = (commissionAmount * Number(selectedBankPaymentDetails.value)) / 100;
            }
            commissionAmount = Math.max(0, commissionAmount - deductionAmount);
            commissionAmount = Number(commissionAmount.toFixed(2));
            bankDeductionResult = {
              enabled: true, type: selectedBankPaymentDetails.type,
              value: selectedBankPaymentDetails.value, applyOn: selectedBankPaymentDetails.applyOn,
              deductionAmount: Number(deductionAmount.toFixed(2)),
              finalEarnedAmount: commissionBaseAmount, finalPaidAmount: baseAmount,
              deductionApplied: true
            };
          }

          const created = await Commission.create({
            clinicId,
            source: "staff",
            staffId: packageSoldByUserId,
            commissionType: "flat",
            appointmentId: appointment?._id,
            patientId: patientRegistration._id,
            billingId: billing._id,
            commissionPercent,
            amountPaid: baseAmount,
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
          commissionRecords.push(created);
        }
      }
    } catch (packageCommissionErr) {
      console.error("❌ Commission calculation/store error (package):", packageCommissionErr);
    }
  }

  // ============================================================
  // Phase 8: Pending Clearance Commission
  // ============================================================
  if (processPendingClearanceCommission) {
    try {
      const billingForPendingClearance = await Billing.findById(billing._id).lean();
      const pendingClearanceBreakdown = billingForPendingClearance?.pendingClearedBreakdown || [];

      if (pendingClearanceBreakdown.length > 0) {
        const breakdownByOriginalInvoice = new Map();
        for (const entry of pendingClearanceBreakdown) {
          const invNum = entry.invoiceNumber;
          if (!invNum) continue;
          if (!breakdownByOriginalInvoice.has(invNum)) {
            breakdownByOriginalInvoice.set(invNum, []);
          }
          breakdownByOriginalInvoice.get(invNum).push(entry);
        }

        for (const [originalInvoiceNumber, entries] of breakdownByOriginalInvoice) {
          try {
            const totalAmountCleared = entries.reduce((sum, e) => sum + (Number(e.amountCleared) || 0), 0);
            if (totalAmountCleared <= 0) continue;

            const originalBilling = await Billing.findOne({
              invoiceNumber: originalInvoiceNumber,
              clinicId,
            }).lean();

            if (!originalBilling) {
              console.warn("[PendingClearanceCommission] Original billing not found for invoice:", originalInvoiceNumber);
              continue;
            }

            const origDirectBilling = originalBilling.directBilling !== false;
            let commissionStaffId = null;
            let commissionSource = "";

            const packageEntry = entries.find(e => e.packageId);

            if (packageEntry) {
              const freshPatient = await PatientRegistration.findById(patientRegistration._id).lean();
              const patientPackage = freshPatient?.packages?.find(p => String(p.packageId) === String(packageEntry.packageId));

              if (patientPackage?.packageSoldBy) {
                const packageSoldByName = patientPackage.packageSoldBy;
                const packageSoldByUser = await User.findOne({
                  clinicId,
                  name: { $regex: new RegExp(`^${packageSoldByName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i') }
                }).lean();

                if (packageSoldByUser) {
                  commissionStaffId = packageSoldByUser._id;
                  commissionSource = `Package sold by ${packageSoldByName} (pending clearance)`;
                }
              }
            } else if (!origDirectBilling && originalBilling.doctorId) {
              commissionStaffId = originalBilling.doctorId;
              commissionSource = "Doctor (pending clearance)";
            } else if (origDirectBilling && originalBilling.invoicedById) {
              commissionStaffId = originalBilling.invoicedById;
              commissionSource = "InvoicedBy (pending clearance)";
            }

            if (!commissionStaffId) continue;

            const commissionResult = await calculateCommissionForStaff({
              staffId: commissionStaffId,
              clinicId,
              paidAmount: totalAmountCleared,
              earnedAmount: totalAmountCleared,
              patientId: patientRegistration._id,
              appointmentId: originalBilling.appointmentId,
              currentBillingId: billing._id,
              bankPaymentDetails: selectedBankPaymentDetails,
            });

            if (commissionResult.shouldCreateCommission) {
              const commissionType = commissionResult.commissionType;

              let commissionBaseAmount;
              if (commissionResult.bankDeduction.deductionApplied && selectedBankPaymentDetails.applyOn === "paid") {
                commissionBaseAmount = commissionResult.bankDeduction.finalPaidAmount || totalAmountCleared;
              } else {
                commissionBaseAmount = totalAmountCleared;
              }

              if (commissionType === "target_based") {
                commissionBaseAmount = commissionResult.amountAboveTarget || 0;
              } else if (commissionType === "after_deduction") {
                commissionBaseAmount = commissionResult.netAmount || 0;
              } else if (commissionType === "target_plus_expense") {
                commissionBaseAmount = commissionResult.netCommissionableAmount || 0;
              }

              const commissionData = {
                clinicId,
                source: "staff",
                staffId: commissionStaffId,
                commissionType: commissionResult.commissionType,
                appointmentId: originalBilling.appointmentId || null,
                patientId: patientRegistration._id,
                billingId: billing._id,
                commissionPercent: commissionResult.commissionPercentage,
                amountPaid: totalAmountCleared,
                commissionAmount: commissionResult.commissionAmount,
                invoicedDate: new Date(invoicedDate),
                notes: `${commissionSource} - cleared pending for invoice ${originalInvoiceNumber}`,
                createdBy: clinicUser._id,
                paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
                multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
                bankDeduction: {
                  enabled: commissionResult.bankDeduction?.enabled || false,
                  type: commissionResult.bankDeduction?.type,
                  value: commissionResult.bankDeduction?.value,
                  applyOn: commissionResult.bankDeduction?.applyOn,
                  deductionAmount: commissionResult.bankDeduction?.deductionAmount,
                },
                referralCommissionDeducted: 0,
                commissionBaseAmount,
                finalCommissionAmount: commissionResult.commissionAmount || 0,
                isPendingClearanceCommission: true,
                originalInvoiceNumber,
                originalDirectBilling: origDirectBilling,
              };

              if (commissionType === "target_based") {
                commissionData.targetAmount = commissionResult.targetAmount || 0;
                commissionData.cumulativeAchieved = commissionResult.cumulativeAchieved || 0;
                commissionData.isAboveTarget = commissionResult.isAboveTarget || false;
              }

              if (commissionType === "after_deduction") {
                commissionData.totalExpenses = commissionResult.totalExpenses || 0;
                commissionData.netAmount = commissionResult.netAmount || 0;
                commissionData.expenseBreakdown = commissionResult.expenseBreakdown || [];
                commissionData.complaintsCount = commissionResult.complaintsCount || 0;
                commissionData.lastBillingDate = commissionResult.lastBillingDate || null;
                commissionData.lastBillingInvoice = commissionResult.lastBillingInvoice || null;
                commissionData.isFirstBilling = commissionResult.isFirstBilling || false;
              }

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

              const created = await Commission.create(commissionData);
              commissionRecords.push(created);
              console.log(`✅ Pending clearance commission created for ${commissionSource}, invoice ${originalInvoiceNumber}, amount: ${totalAmountCleared}`);
            }
          } catch (entryErr) {
            console.error("[PendingClearanceCommission] Error processing commission for invoice:", originalInvoiceNumber, entryErr.message);
          }
        }
      }
    } catch (pendingClearanceCommissionErr) {
      console.error("❌ Pending clearance commission error:", pendingClearanceCommissionErr.message);
    }
  }

  console.log("========== COMMISSION HELPER END ==========");
  console.log("[Result] Total commission records created:", commissionRecords.length);
  if (commissionRecords.length > 0) {
    commissionRecords.forEach((r, i) => {
      console.log(`[Result] Record ${i}: staffId=${r.staffId}, type=${r.commissionType}, amount=${r.commissionAmount}, notes=${r.notes}`);
    });
  }
  console.log("===========================================");

  return { commissionRecords };
}

// ============================================================
// Internal helper: Build commission data for doctor/billed person
// ============================================================
function buildCommissionData(opts) {
  const {
    clinicId, staffId, commissionResult, appointmentId, patientId, billingId,
    amountPaid, adjustedPaidAmount, invoicedDate, notes, createdBy,
    paymentMethod, multiPayArr, selectedBankPaymentDetails, referralShare,
  } = opts;

  const commissionType = commissionResult.commissionType;

  let commissionBaseAmount;
  if (commissionResult.bankDeduction.deductionApplied && selectedBankPaymentDetails.applyOn === "paid") {
    commissionBaseAmount = commissionResult.bankDeduction.finalPaidAmount || adjustedPaidAmount;
  } else {
    commissionBaseAmount = adjustedPaidAmount;
  }

  if (commissionType === "target_based") {
    commissionBaseAmount = commissionResult.amountAboveTarget || 0;
  } else if (commissionType === "after_deduction") {
    commissionBaseAmount = commissionResult.netAmount || 0;
  } else if (commissionType === "target_plus_expense") {
    commissionBaseAmount = commissionResult.netCommissionableAmount || 0;
  }

  const commissionData = {
    clinicId,
    source: "staff",
    staffId,
    commissionType: commissionResult.commissionType,
    appointmentId,
    patientId,
    billingId,
    commissionPercent: commissionResult.commissionPercentage,
    amountPaid,
    commissionAmount: commissionResult.commissionAmount,
    invoicedDate: new Date(invoicedDate),
    notes: notes || "",
    createdBy,
    paymentMethod: multiPayArr.length > 0 ? undefined : paymentMethod,
    multiplePayments: multiPayArr.length > 0 ? multiPayArr : [],
    bankDeduction: {
      enabled: commissionResult.bankDeduction?.enabled || false,
      type: commissionResult.bankDeduction?.type,
      value: commissionResult.bankDeduction?.value,
      applyOn: commissionResult.bankDeduction?.applyOn,
      deductionAmount: commissionResult.bankDeduction?.deductionAmount
    },
    referralCommissionDeducted: referralShare,
    commissionBaseAmount,
    finalCommissionAmount: commissionResult.commissionAmount || 0,
  };

  if (commissionType === "target_based") {
    commissionData.targetAmount = commissionResult.targetAmount || 0;
    commissionData.cumulativeAchieved = commissionResult.cumulativeAchieved || 0;
    commissionData.isAboveTarget = commissionResult.isAboveTarget || false;
  }

  if (commissionType === "after_deduction") {
    commissionData.totalExpenses = commissionResult.totalExpenses || 0;
    commissionData.netAmount = commissionResult.netAmount || 0;
    commissionData.expenseBreakdown = commissionResult.expenseBreakdown || [];
    commissionData.complaintsCount = commissionResult.complaintsCount || 0;
    commissionData.lastBillingDate = commissionResult.lastBillingDate || null;
    commissionData.lastBillingInvoice = commissionResult.lastBillingInvoice || null;
    commissionData.isFirstBilling = commissionResult.isFirstBilling || false;
  }

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

  return commissionData;
}
