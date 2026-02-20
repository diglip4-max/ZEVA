/**
 * Commission Calculator Helper
 * Handles different commission calculation types including flat and target-based
 */

import Commission from "../models/Commission.js";
import AgentProfile from "../models/AgentProfile.js";

/**
 * Calculate target-based commission
 * @param {Object} params - Calculation parameters
 * @param {String} params.staffId - Staff/doctor user ID
 * @param {String} params.clinicId - Clinic ID
 * @param {Number} params.paidAmount - Amount paid in this transaction
 * @param {Number} params.commissionPercentage - Commission percentage from profile
 * @param {Number} params.targetAmount - Target amount from profile
 * @returns {Object} Commission calculation result
 */
export async function calculateTargetBasedCommission({
  staffId,
  clinicId,
  paidAmount,
  commissionPercentage,
  targetAmount,
}) {
  try {
    // Get cumulative achieved amount for this staff (sum of all paid amounts)
    const previousCommissions = await Commission.find({
      clinicId,
      staffId,
      source: "staff",
      commissionType: "target_based",
    }).lean();

    // Calculate cumulative achieved amount from previous transactions
    const previousAchieved = previousCommissions.reduce(
      (sum, comm) => sum + Number(comm.amountPaid || 0),
      0
    );

    // New cumulative achieved amount after this transaction
    const newCumulativeAchieved = previousAchieved + paidAmount;

    // Determine commission logic
    let commissionAmount = 0;
    let isAboveTarget = false;

    if (previousAchieved >= targetAmount) {
      // Already crossed target before - apply commission on full paid amount
      commissionAmount = (paidAmount * commissionPercentage) / 100;
      isAboveTarget = true;
    } else if (newCumulativeAchieved > targetAmount) {
      // This transaction crosses the target
      // Apply commission only on the amount above the target
      const amountAboveTarget = newCumulativeAchieved - targetAmount;
      commissionAmount = (amountAboveTarget * commissionPercentage) / 100;
      isAboveTarget = true;
    } else {
      // Still below target - no commission
      commissionAmount = 0;
      isAboveTarget = false;
    }

    return {
      commissionAmount: Number(commissionAmount.toFixed(2)),
      cumulativeAchieved: newCumulativeAchieved,
      isAboveTarget,
      targetAmount,
      previousAchieved,
    };
  } catch (error) {
    console.error("Error calculating target-based commission:", error);
    throw error;
  }
}

/**
 * Calculate flat commission
 * @param {Object} params - Calculation parameters
 * @param {Number} params.paidAmount - Amount paid in this transaction
 * @param {Number} params.commissionPercentage - Commission percentage
 * @returns {Object} Commission calculation result
 */
export function calculateFlatCommission({ paidAmount, commissionPercentage }) {
  const commissionAmount = (paidAmount * commissionPercentage) / 100;
  return {
    commissionAmount: Number(commissionAmount.toFixed(2)),
  };
}

/**
 * Get commission calculation based on staff profile
 * @param {Object} params - Parameters
 * @param {String} params.staffId - Staff/doctor user ID
 * @param {String} params.clinicId - Clinic ID
 * @param {Number} params.paidAmount - Amount paid in this transaction
 * @returns {Object} Commission calculation result
 */
export async function calculateCommissionForStaff({
  staffId,
  clinicId,
  paidAmount,
}) {
  try {
    // Get staff profile
    const profile = await AgentProfile.findOne({ userId: staffId }).lean();
    
    if (!profile) {
      return {
        shouldCreateCommission: false,
        reason: "No profile found",
      };
    }

    const commissionType = String(profile.commissionType || "flat");
    const commissionPercentage = Number(profile.commissionPercentage || 0);

    if (commissionPercentage <= 0) {
      return {
        shouldCreateCommission: false,
        reason: "Commission percentage is 0",
      };
    }

    let result = {
      shouldCreateCommission: true,
      commissionType,
      commissionPercentage,
    };

    if (commissionType === "target_based") {
      const targetAmount = Number(profile.targetAmount || 0);
      
      if (targetAmount <= 0) {
        return {
          shouldCreateCommission: false,
          reason: "Target amount not set",
        };
      }

      const targetCalc = await calculateTargetBasedCommission({
        staffId,
        clinicId,
        paidAmount,
        commissionPercentage,
        targetAmount,
      });

      result = {
        ...result,
        ...targetCalc,
      };
    } else if (commissionType === "flat") {
      const flatCalc = calculateFlatCommission({
        paidAmount,
        commissionPercentage,
      });

      result = {
        ...result,
        ...flatCalc,
      };
    } else {
      // Other commission types (after_deduction, target_plus_expense) can be implemented here
      return {
        shouldCreateCommission: false,
        reason: `Commission type ${commissionType} not yet implemented`,
      };
    }

    return result;
  } catch (error) {
    console.error("Error in calculateCommissionForStaff:", error);
    throw error;
  }
}
