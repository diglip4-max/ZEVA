import dbConnect from "../../../../lib/database";
import Commission from "../../../../models/Commission";
import Referral from "../../../../models/Referral";
import User from "../../../../models/Users";
import AgentProfile from "../../../../models/AgentProfile";
import PatientRegistration from "../../../../models/PatientRegistration";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import { checkClinicPermission } from "../../lead-ms/permissions-helper";
import { checkAgentPermission } from "../../agent/permissions-helper";

/**
 * Scalable per-source commission grouping config.
 * Adding a new commission source = add one entry here; the $match, $_id and
 * any extra $group fields are derived from this single definition so all
 * sources (referrer / doctor-staff / agent / product) stay consistent.
 */
const SOURCE_CONFIGS = {
  referral: {
    // Referrers are grouped by referralId; also catch legacy rows where only
    // referralId is set but source was not stamped.
    personKey: "$referralId",
    match: {
      $or: [{ source: "referral" }, { referralId: { $ne: null } }],
      referralId: { $ne: null },
    },
    // Extra $group fields only relevant to this source.
    extraGroup: {
      lastReferralName: { $last: "$referralName" },
    },
  },
  staff: {
    // Doctor / staff / agent commissions are grouped by staffId.
    personKey: "$staffId",
    match: {
      $or: [{ source: "staff" }, { staffId: { $ne: null } }],
      staffId: { $ne: null },
    },
    extraGroup: {},
  },
  product: {
    // Product-sale commissions belong to the selling staff member.
    personKey: "$staffId",
    match: {
      source: "product",
      productSaleId: { $ne: null },
      staffId: { $ne: null },
    },
    extraGroup: {},
  },
};

// Effective commission amount for a single record (final if recomputed, else original).
const AMOUNT_EXPR = {
  $cond: [
    { $gt: ["$finalCommissionAmount", 0] },
    "$finalCommissionAmount",
    "$commissionAmount",
  ],
};

// Build the $match stage: always clinic-scoped, plus the source filter and
// optional date range. Centralised so every source gets identical treatment.
function buildMatchStage(cfg, clinicId, dateMatch) {
  const matchStage = { clinicId, ...cfg.match };
  if (Object.keys(dateMatch).length > 0) {
    Object.assign(matchStage, dateMatch);
  }
  return matchStage;
}

/**
 * Build the full per-person aggregation pipeline for a source config.
 * One shared $group spec emits all workflow buckets (submitted / pending-approval
 * / unsubmitted / approved / deductions / oldest-pending-date) for every source,
 * so signals and summaries read the same field names regardless of role.
 */
function buildPerSourcePipeline(cfg, matchStage) {
  return [
    { $match: matchStage },
    {
      $group: {
        _id: cfg.personKey,
        totalCommissionAmount: { $sum: AMOUNT_EXPR },
        totalAmountPaid: { $sum: "$amountPaid" },
        count: { $sum: 1 },
        lastCommissionPercent: { $last: "$commissionPercent" },
        // Commissions ticked as submitted (isSubmitted true), regardless of approval.
        submittedCount: {
          $sum: { $cond: [{ $eq: ["$isSubmitted", true] }, 1, 0] },
        },
        // Submitted but not yet approved — the approval backlog count.
        pendingApprovalCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", true] },
                  { $eq: ["$isApproved", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
        // Value of submitted-but-not-yet-approved commissions (approval backlog amount).
        pendingApprovalEarnedAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", true] },
                  { $eq: ["$isApproved", false] },
                ],
              },
              AMOUNT_EXPR,
              0,
            ],
          },
        },
        // Not yet marked submitted AND not approved — held-from-payout amount.
        pendingEarnedAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", false] },
                  { $eq: ["$isApproved", false] },
                ],
              },
              AMOUNT_EXPR,
              0,
            ],
          },
        },
        // Count of isSubmitted:false (+ not approved) invoices for this person.
        pendingCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", false] },
                  { $eq: ["$isApproved", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
        // Fully approved (submitted + approved) amount & count.
        approvedEarnedAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", true] },
                  { $eq: ["$isApproved", true] },
                ],
              },
              AMOUNT_EXPR,
              0,
            ],
          },
        },
        approvedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", true] },
                  { $eq: ["$isApproved", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        // Total deductions = bank deduction + referral commission deducted.
        deductionsAmount: {
          $sum: {
            $add: [
              { $ifNull: ["$bankDeduction.deductionAmount", 0] },
              { $ifNull: ["$referralCommissionDeducted", 0] },
            ],
          },
        },
        // Oldest not-yet-submitted/not-approved commission (for pending-age signal).
        oldestPendingDate: {
          $min: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isSubmitted", false] },
                  { $eq: ["$isApproved", false] },
                ],
              },
              { $ifNull: ["$invoicedDate", "$createdAt"] },
              "$$REMOVE",
            ],
          },
        },
        // Source-specific extras (e.g. denormalised referrer name).
        ...cfg.extraGroup,
      },
    },
    { $sort: { totalCommissionAmount: -1 } },
  ];
}


/**
 * Recover a human name for a staff/doctor/agent commission when the primary
 * User lookup fails (dangling or foreign staffId — e.g. package-sold-by ids
 * whose User account was removed). Tries, in order:
 *   1. The stored `packageSoldBy` name on any patient package tagged with this id
 *   2. A Referral document with the same id
 *   3. A PatientRegistration document with the same id
 * Returns "" if nothing matches so the caller can apply its own placeholder.
 */
async function resolveStaffNameFallback(staffId, clinicId) {
  if (!staffId) return "";
  const holder = await PatientRegistration.findOne({
    clinicId,
    "packages.packageSoldByUserId": staffId,
  })
    .select("packages.packageSoldBy packages.packageSoldByUserId")
    .lean();
  const pkgEntry = holder?.packages?.find(
    (p) =>
      String(p.packageSoldByUserId) === String(staffId) &&
      (p.packageSoldBy || "").trim(),
  );
  if (pkgEntry) return pkgEntry.packageSoldBy.trim();

  const ref = await Referral.findById(staffId).lean();
  if (ref) {
    const refName =
      `${(ref.firstName || "").trim()} ${(ref.lastName || "").trim()}`.trim();
    if (refName) return refName;
  }

  const pat = await PatientRegistration.findById(staffId).lean();
  if (pat) {
    const patName =
      `${(pat.firstName || "").trim()} ${(pat.lastName || "").trim()}`.trim();
    if (patName) return patName;
  }
  return "";
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const source = req.query.source ? String(req.query.source) : null; // "referral" | "staff" | null

    let clinicId = null;
    let clinic = null;
    if (me.role === "clinic") {
      clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(me.role)) {
      if (!me.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      const qClinicId = req.query.clinicId;
      if (!qClinicId) {
        return res
          .status(400)
          .json({ success: false, message: "Admin must provide clinicId" });
      }
      clinicId = qClinicId;
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (me.role !== "admin") {
      if (me.role === "clinic") {
        const { hasPermission, error } = await checkClinicPermission(
          clinicId,
          "clinic_commission",
          "read",
        );
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "No permission to view commissions",
          });
        }
      } else if (["agent", "doctorStaff"].includes(me.role)) {
        const { hasPermission, error } = await checkAgentPermission(
          me._id,
          "clinic_commission",
          "read",
        );
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "No permission to view commissions",
          });
        }
      }
    }

    // Build date filter for match stage
    const dateMatch = {};
    if (req.query.date) {
      const date = new Date(req.query.date);
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999,
      );
      dateMatch.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.query.startDate || req.query.endDate) {
      const range = {};
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0);
        range.$gte = startDate;
      }
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        range.$lte = endDate;
      }
      dateMatch.createdAt = range;
    }

    // Month-wise approved vs not-approved breakdown (overview chart)
    if (req.query.groupBy === "month") {
      const monthMatch = { clinicId };
      if (source === "referral") {
        monthMatch.$or = [{ source: "referral" }, { referralId: { $ne: null } }];
        monthMatch.referralId = { $ne: null };
      } else if (source === "staff") {
        monthMatch.$or = [{ source: "staff" }, { staffId: { $ne: null } }];
        monthMatch.staffId = { $ne: null };
      } else if (source === "product") {
        monthMatch.source = "product";
        monthMatch.productSaleId = { $ne: null };
        monthMatch.staffId = { $ne: null };
      }
      if (Object.keys(dateMatch).length > 0) {
        Object.assign(monthMatch, dateMatch);
      }
      const amountExpr = {
        $cond: [
          { $gt: ["$finalCommissionAmount", 0] },
          "$finalCommissionAmount",
          "$commissionAmount",
        ],
      };
      const monthly = await Commission.aggregate([
        { $match: monthMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m",
                date: { $ifNull: ["$invoicedDate", "$createdAt"] },
              },
            },
            approved: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isSubmitted", true] },
                      { $eq: ["$isApproved", true] },
                    ],
                  },
                  amountExpr,
                  0,
                ],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isSubmitted", false] },
                      { $eq: ["$isApproved", false] },
                    ],
                  },
                  amountExpr,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return res.status(200).json({
        success: true,
        items: monthly.map((m) => ({
          month: m._id,
          approved: Number((m.approved || 0).toFixed(2)),
          pending: Number((m.pending || 0).toFixed(2)),
        })),
      });
    }

    let grouped = [];
    // Per-person grouping runs through the shared SOURCE_CONFIGS pipeline builder
    // so every commission source (referrer / doctor-staff / agent / any future
    // source) stays consistent and scalable — one group spec for all sources.
    const cfg = SOURCE_CONFIGS[source];
    if (!cfg) {
      return res.status(200).json({ success: true, items: [] });
    }
    const matchStage = buildMatchStage(cfg, clinicId, dateMatch);
    grouped = await Commission.aggregate(
      buildPerSourcePipeline(cfg, matchStage),
    );

    const results = [];
    for (const g of grouped) {
      if (source === "referral") {
        const referralId = g._id;
        let name = g.lastReferralName || "";
        let percent = g.lastCommissionPercent || 0;
        if (referralId) {
          const ref = await Referral.findById(referralId).lean();
          if (ref) {
            name =
              `${(ref.firstName || "").trim()} ${(ref.lastName || "").trim()}`.trim() ||
              name;
            percent = Number(ref.referralPercent ?? percent);
          }
        }
        results.push({
          source: "referral",
          personId: referralId?.toString() || null,
          name,
          percent,
          totalEarned: Number(g.totalCommissionAmount.toFixed(2)),
          totalPaid: Number(g.totalAmountPaid.toFixed(2)),
          count: g.count,
          submittedCount: g.submittedCount || 0,
          pendingApprovalCount: g.pendingApprovalCount || 0,
          pendingApprovalEarnedAmount: Number((g.pendingApprovalEarnedAmount || 0).toFixed(2)),
          pendingEarnedAmount: Number((g.pendingEarnedAmount || 0).toFixed(2)),
          pendingCount: g.pendingCount || 0,
          approvedEarnedAmount: Number((g.approvedEarnedAmount || 0).toFixed(2)),
          approvedCount: g.approvedCount || 0,
          deductionsAmount: Number((g.deductionsAmount || 0).toFixed(2)),
          oldestPendingDate: g.oldestPendingDate || null,
        });
      } else {
        const staffId = g._id;
        let name = "";
        let staffRole = "";
        let percent = g.lastCommissionPercent || 0;
        let commissionType = "flat";
        let targetAmount = 0;
        let targetProgress = 0;
        let isAboveTarget = false;

        if (staffId) {
          const user = await User.findById(staffId).select("name role").lean();
          if (user) {
            name = user.name || "";
            staffRole = user.role || "";
          }
          // staffId may be dangling/foreign (e.g. package-sold-by) — recover the
          // real name from stored package/referral/patient data instead of blank.
          if (!name) {
            name = await resolveStaffNameFallback(staffId, clinicId);
          }
          const profile = await AgentProfile.findOne({
            userId: staffId,
          }).lean();
          if (profile) {
            if (profile.commissionPercentage != null) {
              percent = Number(profile.commissionPercentage);
            }
            commissionType = profile.commissionType || "flat";

            // For target-based commission, calculate progress
            if (commissionType === "target_based" && profile.targetAmount) {
              targetAmount = Number(profile.targetAmount);
              // Get the latest commission record to get cumulative achieved
              const latestCommission = await Commission.findOne({
                clinicId,
                staffId,
                source: "staff",
                commissionType: "target_based",
              })
                .sort({ createdAt: -1 })
                .lean();

              if (latestCommission && latestCommission.cumulativeAchieved) {
                const currentAchieved = latestCommission.cumulativeAchieved;
                targetProgress =
                  targetAmount > 0 ? (currentAchieved / targetAmount) * 100 : 0;
                isAboveTarget = currentAchieved >= targetAmount;
              } else {
                // Fallback: use total paid amount
                targetProgress =
                  targetAmount > 0
                    ? (g.totalAmountPaid / targetAmount) * 100
                    : 0;
                isAboveTarget = g.totalAmountPaid >= targetAmount;
              }
            }
          }
        }

        const result = {
          source: "staff",
          personId: staffId?.toString() || null,
          name,
          staffRole,
          percent,
          commissionType,
          totalEarned: Number(g.totalCommissionAmount.toFixed(2)),
          totalPaid: Number(g.totalAmountPaid.toFixed(2)),
          count: g.count,
          submittedCount: g.submittedCount || 0,
          pendingApprovalCount: g.pendingApprovalCount || 0,
          pendingApprovalEarnedAmount: Number((g.pendingApprovalEarnedAmount || 0).toFixed(2)),
          pendingEarnedAmount: Number((g.pendingEarnedAmount || 0).toFixed(2)),
          pendingCount: g.pendingCount || 0,
          approvedEarnedAmount: Number((g.approvedEarnedAmount || 0).toFixed(2)),
          approvedCount: g.approvedCount || 0,
          deductionsAmount: Number((g.deductionsAmount || 0).toFixed(2)),
          oldestPendingDate: g.oldestPendingDate || null,
        };

        // Add target-specific fields if applicable
        if (commissionType === "target_based") {
          result.targetAmount = targetAmount;
          result.targetProgress = Number(targetProgress.toFixed(2));
          result.isAboveTarget = isAboveTarget;
        }

        results.push(result);
      }
    }

    return res.status(200).json({ success: true, items: results });
  } catch (err) {
    console.error("Error in commissions summary:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}
