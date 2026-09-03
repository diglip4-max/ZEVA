import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/package-membership-intelligence?date=YYYY-MM-DD
 *
 * Calculates package & membership intelligence:
 *   - activePackages: packages not yet expired (endDate > today)
 *   - remainingSessions: total remaining sessions across active packages
 *   - expiringSoon: packages expiring within 30 days from today
 *   - renewalOpportunity: packages expiring on the selected date
 *   - membershipRenewalsDue: expired memberships with their value
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

// ─── handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. Auth
    const authUser = await getUserFromReq(req);
    if (!authUser) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) return res.status(404).json({ message: error });

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
      clinicId = clinic._id;
    }
    if (!clinicId) return res.status(404).json({ success: false, message: "Clinic not found" });

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date filter (for renewal opportunity)
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // Today's date for active/expiring calculations (NOT date filter)
    const now = new Date();
    const todayRange = getDayRange(now);
    const todayStart = todayRange.start;

    // 30 days from today for "expiring soon"
    const thirtyDaysFromNow = new Date(todayStart);
    thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);

    // ── Fetch all patients with packages ──
    const patientsWithPackages = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.assignedDate": { $exists: true },
    }).select("firstName lastName packages").lean();

    let activePackageCount = 0;
    let totalRemainingSessions = 0;
    let expiringSoonCount = 0;
    let renewalOpportunityCount = 0;
    let renewalOpportunityValue = 0;

    for (const patient of patientsWithPackages) {
      if (!Array.isArray(patient.packages)) continue;

      for (const pkg of patient.packages) {
        // Calculate effective end date
        let effectiveEndDate;
        if (pkg.endDate) {
          effectiveEndDate = new Date(pkg.endDate);
        } else if (pkg.assignedDate && pkg.validityInMonths) {
          effectiveEndDate = new Date(pkg.assignedDate);
          effectiveEndDate.setUTCMonth(effectiveEndDate.getUTCMonth() + (pkg.validityInMonths || 12));
        } else if (pkg.assignedDate) {
          effectiveEndDate = new Date(pkg.assignedDate);
          effectiveEndDate.setUTCFullYear(effectiveEndDate.getUTCFullYear() + 1);
        } else {
          continue;
        }

        const isExpired = effectiveEndDate < todayStart;
        const isExpiringSoon = !isExpired && effectiveEndDate <= thirtyDaysFromNow;
        const expiresOnSelectedDate = effectiveEndDate >= dayStart && effectiveEndDate <= dayEnd;

        // Active packages: not expired (compared to TODAY)
        if (!isExpired) {
          activePackageCount++;

          // Remaining sessions from packageSnapshot
          const totalSessions = pkg.packageSnapshot?.totalSessions || 0;
          // For now, use totalSessions as remaining (session tracking via appointments is complex)
          // A more accurate count would require checking appointments that used this package
          totalRemainingSessions += totalSessions;
        }

        // Expiring soon: expiring within 30 days from today
        if (isExpiringSoon) {
          expiringSoonCount++;
        }

        // Renewal opportunity: packages expiring on the selected date
        if (expiresOnSelectedDate) {
          renewalOpportunityCount++;
          renewalOpportunityValue += pkg.totalPrice || 0;
        }
      }
    }

    // ── Membership renewals due: expired memberships ──
    const patientsWithMemberships = await PatientRegistration.find({
      clinicId: clinicObjectId,
      $or: [
        { membership: "Yes", membershipEndDate: { $lt: todayStart } },
        { "memberships.endDate": { $lt: todayStart } },
      ],
    }).select("firstName lastName membership membershipEndDate memberships").lean();

    let membershipRenewalsDueCount = 0;
    let membershipRenewalValue = 0;

    for (const patient of patientsWithMemberships) {
      // Check top-level membership
      if (patient.membership === "Yes" && patient.membershipEndDate) {
        const memEnd = new Date(patient.membershipEndDate);
        if (memEnd < todayStart) {
          membershipRenewalsDueCount++;
        }
      }

      // Check memberships array
      if (Array.isArray(patient.memberships)) {
        for (const mem of patient.memberships) {
          if (mem.endDate) {
            const memEnd = new Date(mem.endDate);
            if (memEnd < todayStart) {
              membershipRenewalsDueCount++;
              membershipRenewalValue += mem.paidAmount || 0;
            }
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // DISCOUNT INTELLIGENCE: compare today vs yesterday discount %
    // ════════════════════════════════════════════════════════════════════

    // Previous day range
    const prevDate = new Date(todayStart);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDayStart = prevDate;
    const prevDayEnd = new Date(prevDate);
    prevDayEnd.setUTCHours(23, 59, 59, 999);

    // Helper: calculate avg discount % for billings in a date range (by createdAt)
    async function calcDiscountStats(clinicId, rangeStart, rangeEnd) {
      const billings = await Billing.find({
        clinicId,
        createdAt: { $gte: rangeStart, $lte: rangeEnd },
        treatment: { $ne: "Advance Payment" }, // exclude advance-only billings
      }).select("discountPercent originalAmount amount offerApplied offerDiscountAmount").lean();

      if (billings.length === 0) return { avgDiscountPercent: 0, totalDiscountAmount: 0, billingCount: 0, offerAppliedCount: 0 };

      let totalDiscountPercent = 0;
      let totalDiscountAmount = 0;
      let offerAppliedCount = 0;

      for (const bill of billings) {
        totalDiscountPercent += bill.discountPercent || 0;
        // Discount amount = originalAmount - amount (the actual reduction)
        const discountAmt = (bill.originalAmount || 0) - (bill.amount || 0);
        if (discountAmt > 0) totalDiscountAmount += discountAmt;
        if (bill.offerApplied) offerAppliedCount++;
      }

      return {
        avgDiscountPercent: billings.length > 0 ? Math.round((totalDiscountPercent / billings.length) * 10) / 10 : 0,
        totalDiscountAmount,
        billingCount: billings.length,
        offerAppliedCount,
      };
    }

    const todayDiscount = await calcDiscountStats(clinicObjectId, todayStart, now);
    const yesterdayDiscount = await calcDiscountStats(clinicObjectId, prevDayStart, prevDayEnd);

    // Calculate change
    const discountChange = yesterdayDiscount.avgDiscountPercent > 0
      ? Math.round(((todayDiscount.avgDiscountPercent - yesterdayDiscount.avgDiscountPercent) / yesterdayDiscount.avgDiscountPercent) * 100)
      : todayDiscount.avgDiscountPercent > 0 ? 100 : 0;

    // Estimated margin impact = total discount amount today
    const estimatedMarginImpact = todayDiscount.totalDiscountAmount;

    return res.status(200).json({
      success: true,
      data: {
        activePackageCount,
        totalRemainingSessions,
        expiringSoonCount,
        renewalOpportunityCount,
        renewalOpportunityValue,
        membershipRenewalsDueCount,
        membershipRenewalValue,
        // Discount intelligence
        discount: {
          todayAvgPercent: todayDiscount.avgDiscountPercent,
          yesterdayAvgPercent: yesterdayDiscount.avgDiscountPercent,
          changePercent: discountChange,
          todayTotalDiscount: todayDiscount.totalDiscountAmount,
          todayBillingCount: todayDiscount.billingCount,
          todayOfferCount: todayDiscount.offerAppliedCount,
          estimatedMarginImpact,
        },
      },
    });
  } catch (err) {
    console.error("Error in package-membership-intelligence:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}
