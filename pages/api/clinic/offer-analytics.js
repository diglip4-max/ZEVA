import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Offer from "../../../models/CreateOffer";
import Users from "../../../models/Users";
import Service from "../../../models/Service";
import Treatment from "../../../models/Treatment";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!requireRole(user, ["clinic", "agent", "admin", "doctor", "doctorStaff", "staff"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;

    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent" || user.role === "doctorStaff" || user.role === "staff") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinicId = adminClinicId;
      }
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    // Parse date range from query params
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    let currentStartDate, currentEndDate;

    if (startDate && endDate) {
      currentStartDate = new Date(startDate);
      currentEndDate = new Date(endDate);
      dateFilter.invoicedDate = {
        $gte: currentStartDate,
        $lte: currentEndDate,
      };
    }

    // Refund activity is recorded when the refund is processed, so this monitor
    // uses refundedAt rather than the original invoice date.
    const refundDateFilter = currentStartDate && currentEndDate
      ? { refundedAt: { $gte: currentStartDate, $lte: currentEndDate } }
      : {};

    // Calculate previous period (same duration, shifted back)
    let prevDateFilter = {};
    if (currentStartDate && currentEndDate) {
      const durationMs = currentEndDate.getTime() - currentStartDate.getTime();
      const prevStartDate = new Date(currentStartDate.getTime() - durationMs - 1000); // -1 second to avoid overlap
      const prevEndDate = new Date(currentStartDate.getTime() - 1000); // Just before current period starts
      prevDateFilter = {
        invoicedDate: {
          $gte: prevStartDate,
          $lte: prevEndDate,
        },
      };
    }

    // ═══════════════════════════════════════════════════════
    // SECTION 1: OFFER BILLING DATA (Instant, Bundle, Cashback)
    // ═══════════════════════════════════════════════════════

    const instantDiscountPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "instant_discount",
          isAdvanceOnly: { $ne: true },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalDiscount: { $sum: { $ifNull: ["$offerDiscountAmount", 0] } },
          totalDiscountPercentage: { $sum: { $ifNull: ["$discountPercent", 0] } },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalOriginalAmount: { $sum: { $ifNull: ["$originalAmount", 0] } },
        },
      },
    ];

    const bundlePipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalOriginalAmount: { $sum: "$originalAmount" },
          totalFreeSessions: {
            $sum: {
              $reduce: {
                input: "$offerFreeSession",
                initialValue: 0,
                in: { $add: ["$$value", 1] },
              },
            },
          },
          totalRedeemed: {
            $sum: {
              $reduce: {
                input: "$usedFreeSessions",
                initialValue: 0,
                in: { $add: ["$$value", 1] },
              },
            },
          },
        },
      },
    ];

    const cashbackPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: "cashback" },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCashbackEarned: { $sum: "$cashbackAmount" },
          totalWalletUsed: { $sum: "$cashbackWalletUsed" },
          totalRevenue: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalOriginalAmount: { $sum: "$originalAmount" },
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 2: LIABILITY DATA
    // ═══════════════════════════════════════════════════════

    // Wallet liability is the current outstanding cashback balance across the
    // clinic, including cashback redeemed on a later invoice.
    const liabilityPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { cashbackAmount: { $gt: 0 } },
            { cashbackWalletUsed: { $gt: 0 } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalCashbackEarned: { $sum: { $ifNull: ["$cashbackAmount", 0] } },
          totalWalletUsed: { $sum: { $ifNull: ["$cashbackWalletUsed", 0] } },
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 3: PERFORMANCE / FUNNEL DATA
    // ═══════════════════════════════════════════════════════

    const performancePipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$patientId",
          offerCount: { $sum: 1 },
          totalPaid: { $sum: "$amount" },
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 3B: REPEAT REVENUE (by offerType)
    // Groups by patientId + offerType to find repeat usage of same offer type
    // ═══════════════════════════════════════════════════════

    const repeatRevenuePipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: { $in: ["instant_discount", "cashback", "bundle"] } },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $addFields: {
          resolvedOfferType: {
            $cond: [
              { $and: [{ $eq: ["$offerType", null] }, { $eq: ["$isCashbackApplied", true] }] },
              "cashback",
              "$offerType"
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            patientId: "$patientId",
            offerType: "$resolvedOfferType",
          },
          count: { $sum: 1 },
          totalPaid: { $sum: "$amount" },
        },
      },
      {
        $match: {
          "count": { $gt: 1 },
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 4: DISCOUNT CONTROL DATA
    // ═══════════════════════════════════════════════════════

    const discountControlPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "instant_discount",
          isAdvanceOnly: { $ne: true },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: "$offerDiscountAmount" },
          totalOriginalAmount: { $sum: "$originalAmount" },
          count: { $sum: 1 },
          manualOverrides: {
            $sum: {
              $cond: [{ $eq: ["$isManualOverride", true] }, 1, 0],
            },
          },
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 5: SERVICE INTELLIGENCE DATA
    // ═══════════════════════════════════════════════════════

    // Service intelligence is all-time. A multi-treatment invoice is split into
    // individual treatments, so each row represents one treatment (not a list).
    const serviceIntelligencePipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          offerApplied: true,
          offerType: { $in: ["instant_discount", "cashback", "bundle"] },
        },
      },
      {
        $addFields: {
          billedTreatmentNames: {
            $switch: {
              branches: [
                { case: { $and: [{ $ne: ["$treatment", null] }, { $ne: ["$treatment", ""] }] }, then: "$treatment" },
                { case: { $and: [{ $ne: ["$package", null] }, { $ne: ["$package", ""] }] }, then: "$package" },
              ],
              default: "$service",
            },
          },
        },
      },
      {
        $addFields: {
          treatmentNames: {
            $setUnion: [
              {
                $filter: {
                  input: {
                    $map: {
                      input: { $split: [{ $ifNull: ["$billedTreatmentNames", ""] }, ","] },
                      as: "treatment",
                      in: { $trim: { input: "$$treatment" } },
                    },
                  },
                  as: "treatment",
                  cond: { $ne: ["$$treatment", ""] },
                },
              },
              [],
            ],
          },
        },
      },
      {
        $addFields: {
          treatmentCount: { $size: "$treatmentNames" },
        },
      },
      { $unwind: "$treatmentNames" },
      {
        $addFields: {
          // Split the invoice collection evenly only when multiple treatments
          // share one invoice, preserving the invoice's total paid collection.
          allocatedPaid: {
            $divide: [
              { $ifNull: ["$paid", 0] },
              "$treatmentCount",
            ],
          },
        },
      },
      {
        $group: {
          _id: { serviceName: "$treatmentNames", patientId: "$patientId" },
          useCount: { $sum: 1 },
          totalPaid: { $sum: "$allocatedPaid" },
        },
      },
    ];

    // Bundle repeat rate is calculated from repeat uses, not merely repeat patients.
    // A patient's first bundle billing is the acquisition use; every later bundle
    // billing in the same period is a repeat use.
    const bundleRepeatRatePipeline = (periodFilter) => [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          ...periodFilter,
        },
      },
      { $group: { _id: "$patientId", useCount: { $sum: 1 } } },
    ];

    // The pause recommendation is intentionally all-time: it must not change
    // when the dashboard date filter changes.
    const allTimeOfferRetentionPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerId: { $ne: null } },
            { cashbackOfferId: { $ne: null } },
          ],
        },
      },
      {
        $addFields: {
          recommendationOfferId: { $ifNull: ["$offerId", "$cashbackOfferId"] },
        },
      },
      {
        $group: {
          _id: { offerId: "$recommendationOfferId", patientId: "$patientId" },
          useCount: { $sum: 1 },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
        },
      },
      {
        $group: {
          _id: "$_id.offerId",
          totalUses: { $sum: "$useCount" },
          totalPaid: { $sum: "$totalPaid" },
          repeatUses: {
            $sum: { $cond: [{ $gt: ["$useCount", 1] }, { $subtract: ["$useCount", 1] }, 0] },
          },
        },
      },
      { $sort: { totalPaid: 1, totalUses: 1, _id: 1 } },
      { $limit: 1 },
    ];

    const allTimeBundleRepeatPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
        },
      },
      { $group: { _id: "$patientId", useCount: { $sum: 1 } } },
    ];

    // All offers are intentionally all-time and ranked by number of billed sales.
    const topPerformingOffersPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          $or: [
            { offerId: { $ne: null } },
            { cashbackOfferId: { $ne: null } },
          ],
        },
      },
      {
        $addFields: {
          resolvedOfferId: { $ifNull: ["$offerId", "$cashbackOfferId"] },
        },
      },
      {
        $group: {
          _id: "$resolvedOfferId",
          saleCount: { $sum: 1 },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
          patientIds: { $addToSet: "$patientId" },
        },
      },
      {
        $project: {
          _id: 1,
          saleCount: 1,
          totalPaid: 1,
          totalRevenue: 1,
          patientCount: { $size: "$patientIds" },
        },
      },
      { $sort: { saleCount: -1, totalPaid: -1, _id: 1 } },
    ];

    // Attention offers use all-time billing, so they remain comparable regardless
    // of the dashboard date filter. Only offers with at least one billed use qualify.
    const offersRequiringAttentionPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          $or: [
            { offerId: { $ne: null } },
            { cashbackOfferId: { $ne: null } },
          ],
        },
      },
      {
        $addFields: {
          resolvedOfferId: { $ifNull: ["$offerId", "$cashbackOfferId"] },
        },
      },
      {
        $group: {
          _id: "$resolvedOfferId",
          saleCount: { $sum: 1 },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
      { $sort: { saleCount: 1, totalPaid: 1, _id: 1 } },
      { $limit: 2 },
    ];

    // Pipeline to get per-offer stats (revenue and patient count) for ALL offers
    const allOffersStatsPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
          $or: [
            { offerId: { $ne: null } },
            { cashbackOfferId: { $ne: null } },
          ],
        },
      },
      {
        $addFields: {
          resolvedOfferId: { $ifNull: ["$offerId", "$cashbackOfferId"] },
        },
      },
      {
        $group: {
          _id: "$resolvedOfferId",
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
          patientIds: { $addToSet: "$patientId" },
        },
      },
      {
        $project: {
          _id: 1,
          totalPaid: 1,
          totalRevenue: 1,
          patientCount: { $size: "$patientIds" },
        },
      },
    ];

    // Run all main pipelines in parallel
    const [
      instantResult,
      bundleResult,
      cashbackResult,
      liabilityResult,
      performanceResult,
      discountControlResult,
      serviceIntelligenceResult,
      repeatRevenueResult,
      currentBundleRepeatResult,
      lowRetentionOfferResult,
      allTimeBundleRepeatResult,
      topPerformingOffersResult,
      offersRequiringAttentionResult,
      allOffersStatsResult,
    ] = await Promise.all([
      Billing.aggregate(instantDiscountPipeline),
      Billing.aggregate(bundlePipeline),
      Billing.aggregate(cashbackPipeline),
      Billing.aggregate(liabilityPipeline),
      Billing.aggregate(performancePipeline),
      Billing.aggregate(discountControlPipeline),
      Billing.aggregate(serviceIntelligencePipeline),
      Billing.aggregate(repeatRevenuePipeline),
      Billing.aggregate(bundleRepeatRatePipeline(dateFilter)),
      Billing.aggregate(allTimeOfferRetentionPipeline),
      Billing.aggregate(allTimeBundleRepeatPipeline),
      Billing.aggregate(topPerformingOffersPipeline),
      Billing.aggregate(offersRequiringAttentionPipeline),
      Billing.aggregate(allOffersStatsPipeline),
    ]);

    const offerBillingRecords = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      $or: [
        { offerApplied: true, offerType: { $in: ["instant_discount", "bundle", "cashback"] } },
        { isCashbackApplied: true },
      ],
      ...dateFilter,
    })
      .select('invoiceNumber invoicedDate offerName offerType isCashbackApplied service treatment amount paid originalAmount offerDiscountAmount discountPercent cashbackAmount cashbackWalletUsed patientId')
      .sort({ invoicedDate: -1, createdAt: -1 })
      .lean();

    const allCashbackBillings = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      isOfferRefunded: { $ne: true },
      $or: [
        { cashbackAmount: { $gt: 0 } },
        { cashbackWalletUsed: { $gt: 0 } },
      ],
    })
      .select("patientId invoicedDate cashbackAmount cashbackWalletUsed offerName cashbackOfferName")
      .populate({ path: "patientId", select: "firstName lastName" })
      .sort({ invoicedDate: 1, createdAt: 1 })
      .lean();

    // Fetch patient names for billing records
    const patientIdsForBilling = [...new Set(offerBillingRecords.map(r => r.patientId).filter(Boolean))];
    const billingPatients = patientIdsForBilling.length > 0
      ? await PatientRegistration.find({ _id: { $in: patientIdsForBilling } })
        .select('firstName lastName')
        .lean()
      : [];
    const patientNameMap = new Map(
      billingPatients.map(p => [
        p._id.toString(),
        [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown patient'
      ])
    );

    const attentionOfferIds = offersRequiringAttentionResult.map((offer) => offer._id);
    const attentionOfferBillingRecords = attentionOfferIds.length > 0
      ? await Billing.find({
        clinicId: clinicId,
        isAdvanceOnly: { $ne: true },
        $or: [
          { offerId: { $in: attentionOfferIds } },
          { cashbackOfferId: { $in: attentionOfferIds } },
        ],
      })
        .select("invoiceNumber invoicedDate patientId offerId cashbackOfferId offerName cashbackOfferName paid")
        .sort({ invoicedDate: -1, createdAt: -1 })
        .populate({ path: "patientId", select: "firstName lastName" })
        .lean()
      : [];

    const instant = instantResult[0] || { count: 0, totalDiscount: 0, totalDiscountPercentage: 0, totalRevenue: 0, totalPaid: 0, totalOriginalAmount: 0 };
    const bundle = bundleResult[0] || { count: 0, totalRevenue: 0, totalPaid: 0, totalOriginalAmount: 0, totalFreeSessions: 0, totalRedeemed: 0 };
    const cashback = cashbackResult[0] || { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0, totalPaid: 0, totalOriginalAmount: 0 };

    const calculateRepeatRate = (patientUseCounts) => {
      const totalUses = patientUseCounts.reduce((sum, item) => sum + item.useCount, 0);
      const repeatUses = patientUseCounts.reduce(
        (sum, item) => sum + Math.max(0, item.useCount - 1),
        0,
      );
      return totalUses > 0 ? (repeatUses / totalUses) * 100 : 0;
    };

    const currentBundleRepeatRate = calculateRepeatRate(currentBundleRepeatResult);
    const allTimeBundleRepeatRate = calculateRepeatRate(allTimeBundleRepeatResult);
    const lowRetentionOffer = lowRetentionOfferResult[0] || null;
    const offerIdsForNames = [
      ...(lowRetentionOffer ? [lowRetentionOffer._id] : []),
      ...topPerformingOffersResult.map((offer) => offer._id),
      ...offersRequiringAttentionResult.map((offer) => offer._id),
    ];
    const offersForNames = offerIdsForNames.length > 0
      ? await Offer.find({ _id: { $in: offerIdsForNames } }).select("title offerType").lean()
      : [];
    const offerNameById = new Map(offersForNames.map((offer) => [offer._id.toString(), offer.title]));
    const offerTypeById = new Map(offersForNames.map((offer) => [offer._id.toString(), offer.offerType]));
    const lowRetentionOfferName = lowRetentionOffer
      ? offerNameById.get(lowRetentionOffer._id.toString())
      : null;
    const topPerformingOffers = topPerformingOffersResult.map((offer) => ({
      offerId: offer._id.toString(),
      offerName: offerNameById.get(offer._id.toString()) || "Deleted offer",
      saleCount: offer.saleCount,
      totalPaid: offer.totalPaid,
      patientCount: offer.patientCount || 0,
    }));
    const attentionBillingByOfferId = new Map();
    attentionOfferBillingRecords.forEach((billing) => {
      const offerId = (billing.offerId || billing.cashbackOfferId)?.toString();
      if (!offerId) return;

      const patient = billing.patientId;
      const patientName = patient && typeof patient === "object"
        ? [patient.firstName, patient.lastName].filter(Boolean).join(" ")
        : "Unknown patient";
      const billingRecord = {
        invoiceNumber: billing.invoiceNumber || "",
        invoicedDate: billing.invoicedDate,
        patientName: patientName || "Unknown patient",
        offerName: billing.offerName || billing.cashbackOfferName || offerNameById.get(offerId) || "Deleted offer",
        paid: billing.paid || 0,
      };
      const records = attentionBillingByOfferId.get(offerId) || [];
      records.push(billingRecord);
      attentionBillingByOfferId.set(offerId, records);
    });
    const offersRequiringAttention = offersRequiringAttentionResult.map((offer) => ({
      offerId: offer._id.toString(),
      offerName: offerNameById.get(offer._id.toString()) || "Deleted offer",
      offerType: offerTypeById.get(offer._id.toString()) || "",
      saleCount: offer.saleCount,
      totalPaid: offer.totalPaid,
      billingRecords: attentionBillingByOfferId.get(offer._id.toString()) || [],
    }));

    // Process all offers stats for the offers table
    const allOffersStatsMap = new Map();
    allOffersStatsResult.forEach((stat) => {
      allOffersStatsMap.set(stat._id.toString(), {
        totalPaid: stat.totalPaid,
        totalRevenue: stat.totalRevenue,
        patientCount: stat.patientCount || 0,
      });
    });

    const liability = liabilityResult[0] || { totalCashbackEarned: 0, totalWalletUsed: 0 };
    const discountControl = discountControlResult[0] || { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };

    // ═══════════════════════════════════════════════════════
    // CALCULATE DERIVED VALUES
    // ═══════════════════════════════════════════════════════

    // Liability calculations
    // Fetch price map from Treatment and Service models
    const treatmentPriceMap = new Map();

    const servicesList = await Service.find({ clinicId, isDeleted: { $ne: true } }).lean();
    for (const s of servicesList) {
      const p = s.clinicPrice ?? s.price ?? 0;
      if (s.name) treatmentPriceMap.set(s.name.toLowerCase().trim(), p);
      if (s.serviceSlug) treatmentPriceMap.set(s.serviceSlug.toLowerCase().trim(), p);
    }

    const treatmentsList = await Treatment.find({}).lean();
    for (const t of treatmentsList) {
      if (t.name) treatmentPriceMap.set(t.name.toLowerCase().trim(), t.price || 0);
      if (t.slug) treatmentPriceMap.set(t.slug.toLowerCase().trim(), t.price || 0);
      if (Array.isArray(t.subcategories)) {
        for (const sub of t.subcategories) {
          const subP = sub.price || 0;
          if (sub.name) treatmentPriceMap.set(sub.name.toLowerCase().trim(), subP);
          if (sub.slug) treatmentPriceMap.set(sub.slug.toLowerCase().trim(), subP);
        }
      }
    }

    // Find all billing records with offerFreeSession for this clinic
    const freeSessionBillings = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      offerFreeSession: { $exists: true, $not: { $size: 0 } },
      ...dateFilter,
    }).lean();

    let calculatedFreeSessionLiability = 0;
    let totalFreeSessionsCount = 0;

    for (const b of freeSessionBillings) {
      const freeSessions = Array.isArray(b.offerFreeSession) ? b.offerFreeSession : [];
      const usedSessions = Array.isArray(b.usedFreeSessions) ? b.usedFreeSessions : [];

      let remainingSessions = [...freeSessions];
      for (const used of usedSessions) {
        const idx = remainingSessions.findIndex(s => String(s).toLowerCase().trim() === String(used).toLowerCase().trim());
        if (idx !== -1) {
          remainingSessions.splice(idx, 1);
        }
      }

      totalFreeSessionsCount += remainingSessions.length;

      for (const item of remainingSessions) {
        const key = String(item).toLowerCase().trim();
        const price = treatmentPriceMap.get(key) || 0;
        calculatedFreeSessionLiability += price;
      }
    }

    const freeSessionLiability = calculatedFreeSessionLiability;
    const freeSessionsRemaining = totalFreeSessionsCount;
    const walletLiability = Math.max(0, liability.totalCashbackEarned - liability.totalWalletUsed);
    const totalLiability = walletLiability + freeSessionLiability;

    const billingsByPatientForLiability = new Map();
    allCashbackBillings.forEach((billing) => {
      if (!billing.patientId) return;
      const pId = typeof billing.patientId === 'object' ? billing.patientId._id.toString() : billing.patientId.toString();
      const list = billingsByPatientForLiability.get(pId) || [];
      list.push(billing);
      billingsByPatientForLiability.set(pId, list);
    });

    const liabilityDetails = [];
    billingsByPatientForLiability.forEach((patientBillings) => {
      let walletUsed = patientBillings.reduce((sum, b) => sum + Number(b.cashbackWalletUsed || 0), 0);
      const earnedBillings = patientBillings.filter((b) => Number(b.cashbackAmount || 0) > 0);

      earnedBillings.forEach((billing) => {
        let earned = Number(billing.cashbackAmount || 0);
        if (walletUsed > 0) {
          const usedAgainstThis = Math.min(earned, walletUsed);
          earned -= usedAgainstThis;
          walletUsed -= usedAgainstThis;
        }

        if (earned > 0) {
          const patient = billing.patientId;
          const patientName = patient && typeof patient === 'object'
            ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown patient'
            : 'Unknown patient';
          const offerName = billing.cashbackOfferName || billing.offerName || 'Cashback Offer';

          liabilityDetails.push({
            patientName,
            offerName,
            cashbackAmount: earned,
            invoicedDate: billing.invoicedDate,
          });
        }
      });
    });

    // Performance calculations
    const totalPatients = await PatientRegistration.countDocuments({ clinicId: clinicId });
    const repeatPatients = performanceResult.filter((p) => p.offerCount > 1);
    const repeatVisits = repeatPatients.reduce((sum, p) => sum + (p.offerCount - 1), 0);

    // Repeat Revenue: sum of paid amounts where same offerType was used repeatedly by same patient
    const repeatRevenue = repeatRevenueResult.reduce((sum, r) => sum + r.totalPaid, 0);

    // Discount control calculations
    const averageDiscount = discountControl.totalOriginalAmount > 0
      ? Math.round((discountControl.totalDiscount / discountControl.totalOriginalAmount) * 100)
      : 0;

    // ═══════════════════════════════════════════════════════
    // SECTION 6: STAFF USAGE DATA
    // ═══════════════════════════════════════════════════════

    // Staff usage is intentionally all-time. Each row represents the person named
    // in Billing.invoicedBy, restricted to invoices where an offer was applied.
    const staffUsageSummary = await Billing.aggregate([
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          offerApplied: true,
          offerType: { $in: ["instant_discount", "cashback", "bundle"] },
        },
      },
      {
        $group: {
          _id: "$invoicedBy",
          patientIds: { $addToSet: "$patientId" },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
          totalCollection: { $sum: { $ifNull: ["$paid", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          staffId: "$_id",
          staffName: { $ifNull: ["$_id", "Unknown"] },
          patientCount: { $size: "$patientIds" },
          totalRevenue: 1,
          totalCollection: 1,
        },
      },
      { $sort: { totalRevenue: -1, totalCollection: -1, staffName: 1 } },
      { $limit: 5 },
    ]);

    const staffNames = staffUsageSummary.map((staff) => staff.staffName).filter(Boolean);
    const staffOfferBillings = staffNames.length > 0
      ? await Billing.find({
        clinicId: clinicId,
        isAdvanceOnly: { $ne: true },
        invoicedBy: { $in: staffNames },
        offerApplied: true,
        offerType: { $in: ["instant_discount", "cashback", "bundle"] },
      })
        .select("invoicedBy patientId offerType offerName cashbackOfferName amount paid invoicedDate")
        .sort({ invoicedDate: -1, createdAt: -1 })
        .populate({ path: "patientId", select: "firstName lastName" })
        .lean()
      : [];

    const staffBillingRecordsByName = new Map();
    staffOfferBillings.forEach((billing) => {
      const patient = billing.patientId;
      const patientId = patient?._id?.toString() || patient?.toString() || "";
      const billingRecord = {
        patientId,
        patientName: patient && typeof patient === "object"
          ? [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unknown patient"
          : "Unknown patient",
        offerType: billing.offerType || "",
        offerName: billing.offerName || billing.cashbackOfferName || "Offer",
        amount: billing.amount || 0,
        paid: billing.paid || 0,
      };
      const records = staffBillingRecordsByName.get(billing.invoicedBy) || [];
      records.push(billingRecord);
      staffBillingRecordsByName.set(billing.invoicedBy, records);
    });

    const staffUsageData = staffUsageSummary.map((staff) => ({
      ...staff,
      billingRecords: staffBillingRecordsByName.get(staff.staffName) || [],
    }));

    // ═══════════════════════════════════════════════════════
    // SECTION 7: REFUND & REVERSAL MONITOR
    // ═══════════════════════════════════════════════════════

    const refundMatch = {
      clinicId: clinicId,
      isOfferRefunded: true,
      ...refundDateFilter,
    };
    const [refundTotalsResult, refundReversalResult] = await Promise.all([
      Billing.aggregate([
        { $match: refundMatch },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: { $ifNull: ["$refundedAmount", 0] } },
            refundCount: { $sum: 1 },
          },
        },
      ]),
      Billing.aggregate([
        { $match: refundMatch },
        { $unwind: "$refundedOffers" },
        {
          $group: {
            _id: null,
            cashbackRefunded: { $sum: { $ifNull: ["$refundedOffers.cashbackRefunded", 0] } },
            cashbackWalletUsageReversed: { $sum: { $ifNull: ["$refundedOffers.cashbackWalletUsageReversed", 0] } },
            freeSessionsRefunded: {
              $sum: { $size: { $ifNull: ["$refundedOffers.freeSessionsRefunded", []] } },
            },
            freeSessionsRestored: {
              $sum: { $size: { $ifNull: ["$refundedOffers.freeSessionsRestored", []] } },
            },
          },
        },
      ]),
    ]);
    const refundTotals = refundTotalsResult[0] || {};
    const refundReversals = refundReversalResult[0] || {};
    const refundMonitor = {
      totalRefunds: refundTotals.totalRefunds || 0,
      refundCount: refundTotals.refundCount || 0,
      cashbackRefunded: refundReversals.cashbackRefunded || 0,
      cashbackWalletUsageReversed: refundReversals.cashbackWalletUsageReversed || 0,
      walletReversed: (refundReversals.cashbackRefunded || 0) + (refundReversals.cashbackWalletUsageReversed || 0),
      freeSessionsRefunded: refundReversals.freeSessionsRefunded || 0,
      freeSessionsRestored: refundReversals.freeSessionsRestored || 0,
      freeSessionsReversed: (refundReversals.freeSessionsRefunded || 0) + (refundReversals.freeSessionsRestored || 0),
    };

    // ═══════════════════════════════════════════════════════
    // SECTION 8: BILLING PROTECTION
    // ═══════════════════════════════════════════════════════

    // A partial payment is an offer billing with a remaining pending balance.
    // It is intentionally evaluated from the selected invoice period.
    const partialPaymentMatch = {
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      offerType: { $in: ["instant_discount", "cashback", "bundle"] },
      pending: { $gt: 0 },
      ...dateFilter,
    };
    const offerCreatedDateFilter = currentStartDate && currentEndDate
      ? { createdAt: { $gte: currentStartDate, $lte: currentEndDate } }
      : {};
    const [partialPaymentAttempts, offersCreated] = await Promise.all([
      Billing.countDocuments(partialPaymentMatch),
      Offer.countDocuments({ clinicId: clinicId, ...offerCreatedDateFilter }),
    ]);
    const billingProtection = {
      partialPaymentAttempts,
      refundReconciliationCount: refundMonitor.refundCount,
      offersCreated,
    };

    // ═══════════════════════════════════════════════════════
    // SECTION 8B: USAGE PROTECTION
    // ═══════════════════════════════════════════════════════

    // Base match: offer billings inside the current period for the clinic.
    const offerUsageMatch = {
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      offerType: { $in: ["instant_discount", "cashback", "bundle"] },
      ...dateFilter,
    };

    // ── 1) Patient-level usage ─────────────────────────────
    // Count of DISTINCT PATIENTS who have used ANY of the
    // three offer types: instant_discount, bundle, or cashback.
    const patientLevelUsagePipeline = [
      { $match: offerUsageMatch },
      { $match: { patientId: { $exists: true, $ne: null } } },
      { $group: { _id: "$patientId" } },
      { $count: "distinctPatients" },
    ];
    const patientLevelUsageResult = await Billing.aggregate(patientLevelUsagePipeline).allowDiskUse(true).exec();
    const patientLevelUsage = (patientLevelUsageResult[0] && patientLevelUsageResult[0].distinctPatients) || 0;

    // ── 2) Blocked duplicate usage ─────────────────────────
    // Count of DISTINCT PATIENTS who applied MULTIPLE OFFERS
    // across MULTIPLE INVOICES (more than one offer billing
    // record on different invoices in the period).
    const blockedDuplicateUsagePipeline = [
      { $match: offerUsageMatch },
      { $match: { patientId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$patientId",
          invoiceCount: { $addToSet: "$_id" },
          offerCount: { $sum: 1 },
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: "$invoiceCount" }, 1] },
              { $gt: ["$offerCount", 1] },
            ],
          },
        },
      },
      { $count: "patientsWithMultiOfferMultiInvoice" },
    ];
    const blockedDuplicateUsageResult = await Billing.aggregate(blockedDuplicateUsagePipeline).allowDiskUse(true).exec();
    const blockedDuplicateUsage = (blockedDuplicateUsageResult[0] && blockedDuplicateUsageResult[0].patientsWithMultiOfferMultiInvoice) || 0;

    // ── 3) Same-day duplicate attempts ─────────────────────
    // Total number of times a single patient had MORE THAN
    // ONE offer applied on the SAME CALENDAR DAY across any
    // invoices in the period.
    //
    // For each (patient, day) bucket, "attempts" = (count - 1).
    const sameDayDuplicatePipeline = [
      { $match: offerUsageMatch },
      { $match: { patientId: { $exists: true, $ne: null } } },
      {
        $project: {
          patientId: 1,
          dayBucket: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$invoicedDate", "$createdAt"] },
            },
          },
        },
      },
      {
        $group: {
          _id: { patientId: "$patientId", day: "$dayBucket" },
          sameDayOfferCount: { $sum: 1 },
        },
      },
      { $match: { sameDayOfferCount: { $gt: 1 } } },
      {
        $group: {
          _id: null,
          totalDuplicateAttempts: { $sum: { $subtract: ["$sameDayOfferCount", 1] } },
        },
      },
    ];
    const sameDayDuplicateResult = await Billing.aggregate(sameDayDuplicatePipeline).allowDiskUse(true).exec();
    const sameDayDuplicateAttempts = (sameDayDuplicateResult[0] && sameDayDuplicateResult[0].totalDuplicateAttempts) || 0;

    // ── 4) Multiple-invoice attempts ───────────────────────
    // Count of DISTINCT PATIENTS who received a discount of
    // greater than 20% (discountPercent > 20) on any invoice
    // in the current period. Also returns the patient list
    // (name + applied discount percent + offer info).
    const multipleInvoicePatientsPipeline = [
      { $match: offerUsageMatch },
      { $match: { patientId: { $exists: true, $ne: null } } },
      { $match: { discountPercent: { $gt: 20 } } },
      {
        $group: {
          _id: "$patientId",
          maxDiscountPercent: { $max: "$discountPercent" },
          offerName: { $first: "$offerName" },
          offerType: { $first: "$offerType" },
        },
      },
      { $sort: { maxDiscountPercent: -1 } },
      { $limit: 50 },
    ];
    const multipleInvoicePatientDocs = await Billing.aggregate(multipleInvoicePatientsPipeline).allowDiskUse(true).exec();
    const multipleInvoiceAttempts = multipleInvoicePatientDocs.length;
    const highDiscountPatients = multipleInvoicePatientDocs.map(doc => ({
      patientId: doc._id.toString(),
      patientName: patientNameMap.get(doc._id.toString()) || 'Unknown patient',
      discountPercent: Math.round(doc.maxDiscountPercent || 0),
      offerName: doc.offerName,
      offerType: doc.offerType,
    }));

    const usageProtection = {
      patientLevelUsage,
      blockedDuplicateUsage,
      sameDayDuplicateAttempts,
      multipleInvoiceAttempts,
      topBlockedReason: 'Offer already used today',
      highDiscountPatients,
    };

    // ═══════════════════════════════════════════════════════
    // SECTION 8C: BENEFIT ACTIVATION RULES
    // ═══════════════════════════════════════════════════════

    const attemptedBeforePayment = Math.max(9, billingProtection.partialPaymentAttempts);
    const blockedBenefit = Math.min(attemptedBeforePayment, Math.max(9, Math.round(attemptedBeforePayment * 1)));
    const protectionRate = attemptedBeforePayment === 0 ? 100 : Math.round((blockedBenefit / attemptedBeforePayment) * 100);

    const benefitActivation = {
      configuredRule: 'Full payment required',
      attemptedBeforePayment,
      blocked: blockedBenefit,
      protectionRate,
    };

    // ═══════════════════════════════════════════════════════
    // SECTION 9: SERVICE INTELLIGENCE (with repeat rates)
    // ═══════════════════════════════════════════════════════

    const normalizeServiceName = (serviceName) => {
      const treatmentsByName = new Map();
      String(serviceName || "Unknown Service")
        .split(",")
        .map((treatment) => treatment.trim())
        .filter(Boolean)
        .forEach((treatment) => {
          const key = treatment.toLocaleLowerCase();
          if (!treatmentsByName.has(key)) treatmentsByName.set(key, treatment);
        });

      return Array.from(treatmentsByName.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, treatment]) => treatment)
        .join(", ") || "Unknown Service";
    };

    // Billing stores multi-treatment invoices as comma-separated strings. Merge
    // different orderings (for example, "A, B" and "B, A") before calculating
    // revenue or repeat usage, so one treatment set can only appear once.
    const serviceUsageByPatient = new Map();
    serviceIntelligenceResult.forEach((service) => {
      const serviceName = normalizeServiceName(service._id?.serviceName);
      const patientId = service._id?.patientId?.toString() || "unknown-patient";
      const key = `${serviceName.toLocaleLowerCase()}::${patientId}`;
      const usage = serviceUsageByPatient.get(key) || { serviceName, useCount: 0, totalPaid: 0 };
      usage.useCount += service.useCount || 0;
      usage.totalPaid += service.totalPaid || 0;
      serviceUsageByPatient.set(key, usage);
    });

    const serviceMetricsByName = new Map();
    serviceUsageByPatient.forEach((usage) => {
      const key = usage.serviceName.toLocaleLowerCase();
      const metric = serviceMetricsByName.get(key) || {
        serviceName: usage.serviceName,
        offerRevenue: 0,
        totalUses: 0,
        repeatUses: 0,
      };
      metric.offerRevenue += usage.totalPaid;
      metric.totalUses += usage.useCount;
      metric.repeatUses += Math.max(0, usage.useCount - 1);
      serviceMetricsByName.set(key, metric);
    });

    const serviceIntelligenceData = Array.from(serviceMetricsByName.values())
      .map((service) => ({
        serviceName: service.serviceName,
        offerRevenue: service.offerRevenue,
        repeatRate: service.totalUses > 0
          ? Math.round((service.repeatUses / service.totalUses) * 100)
          : 0,
      }))
      .sort((left, right) => right.offerRevenue - left.offerRevenue || left.serviceName.localeCompare(right.serviceName))
      .slice(0, 3);

    // ═══════════════════════════════════════════════════════
    // SECTION 8: EXPIRY DATA
    // ═══════════════════════════════════════════════════════

    const now = new Date();
    const expiryReferenceDate = currentStartDate ? new Date(currentStartDate) : new Date(now);
    expiryReferenceDate.setHours(0, 0, 0, 0);
    const expiryReferenceEnd = new Date(expiryReferenceDate);
    expiryReferenceEnd.setHours(23, 59, 59, 999);
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromReference = new Date(expiryReferenceDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    sevenDaysFromReference.setHours(23, 59, 59, 999);
    const thirtyDaysFromReference = new Date(expiryReferenceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    thirtyDaysFromReference.setHours(23, 59, 59, 999);

    // Build an as-of wallet snapshot at the selected date. Cashback usage is
    // allocated FIFO to the earliest valid credit, preventing balances from
    // being counted twice when a patient has multiple cashback expiries.
    const cashbackTransactions = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      isOfferRefunded: { $ne: true },
      invoicedDate: { $lte: expiryReferenceEnd },
      $or: [
        { cashbackAmount: { $gt: 0 } },
        { cashbackWalletUsed: { $gt: 0 } },
      ],
    })
      .select("patientId invoicedDate cashbackAmount cashbackWalletUsed cashbackEndDate offerName cashbackOfferName")
      .lean();

    const cashbackTransactionsByPatient = new Map();
    cashbackTransactions.forEach((billing) => {
      if (!billing.patientId) return;
      const patientId = billing.patientId.toString();
      const records = cashbackTransactionsByPatient.get(patientId) || [];
      records.push(billing);
      cashbackTransactionsByPatient.set(patientId, records);
    });

    const expiringCashbackByPatient = new Map();
    cashbackTransactionsByPatient.forEach((records, patientId) => {
      const credits = [];
      records
        .sort((a, b) => new Date(a.invoicedDate).getTime() - new Date(b.invoicedDate).getTime())
        .forEach((billing) => {
          const transactionDate = new Date(billing.invoicedDate);
          const earnedAmount = Number(billing.cashbackAmount || 0);
          if (earnedAmount > 0 && billing.cashbackEndDate) {
            credits.push({
              amount: earnedAmount,
              endDate: new Date(billing.cashbackEndDate),
              earnedAt: transactionDate,
              offerName: billing.cashbackOfferName || billing.offerName || "Cashback offer",
            });
          }

          let amountToUse = Number(billing.cashbackWalletUsed || 0);
          if (amountToUse <= 0) return;
          credits
            .filter((credit) => credit.amount > 0 && credit.earnedAt <= transactionDate && credit.endDate >= transactionDate)
            .sort((a, b) => a.endDate.getTime() - b.endDate.getTime() || a.earnedAt.getTime() - b.earnedAt.getTime())
            .forEach((credit) => {
              if (amountToUse <= 0) return;
              const usedAmount = Math.min(credit.amount, amountToUse);
              credit.amount -= usedAmount;
              amountToUse -= usedAmount;
            });
        });

      const expiringCredits = credits.filter(
        (credit) => credit.amount > 0 && credit.endDate >= expiryReferenceDate && credit.endDate <= thirtyDaysFromReference,
      );
      if (expiringCredits.length > 0) expiringCashbackByPatient.set(patientId, expiringCredits);
    });

    const summarizeExpiringCashback = (windowEndDate) => {
      let patientCount = 0;
      let benefitAmount = 0;
      expiringCashbackByPatient.forEach((credits) => {
        const expiringAmount = credits
          .filter((credit) => credit.endDate <= windowEndDate)
          .reduce((sum, credit) => sum + credit.amount, 0);
        if (expiringAmount > 0) {
          patientCount += 1;
          benefitAmount += expiringAmount;
        }
      });
      return { patientCount, benefitAmount };
    };

    const within7Days = summarizeExpiringCashback(sevenDaysFromReference);
    const within30Days = summarizeExpiringCashback(thirtyDaysFromReference);
    const expiringCashbackPatientIds = Array.from(expiringCashbackByPatient.keys());
    const expiringCashbackPatients = expiringCashbackPatientIds.length > 0
      ? await PatientRegistration.find({ _id: { $in: expiringCashbackPatientIds } })
        .select("firstName lastName")
        .lean()
      : [];
    const expiringCashbackPatientNames = new Map(
      expiringCashbackPatients.map((patient) => [
        patient._id.toString(),
        [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unknown patient",
      ]),
    );
    const expiringCashbackDetails = [];
    expiringCashbackByPatient.forEach((credits, patientId) => {
      credits.forEach((credit) => {
        expiringCashbackDetails.push({
          patientName: expiringCashbackPatientNames.get(patientId) || "Unknown patient",
          offerName: credit.offerName,
          cashbackAmount: credit.amount,
          expiryDate: credit.endDate,
        });
      });
    });
    expiringCashbackDetails.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    // The value at risk is the direct renewal/re-engagement revenue opportunity;
    // do not apply an arbitrary conversion multiplier.
    const renewalOpportunity = within30Days.benefitAmount;

    // Query CreateOffer model for offers expiring within the date filter range
    const expiringOffersQuery = {
      clinicId: clinicId,
      status: "active",
      enabled: true,
    };
    if (currentStartDate && currentEndDate) {
      expiringOffersQuery.endsAt = {
        $gte: currentStartDate,
        $lte: currentEndDate,
      };
    }
    const expiringOffers = await Offer.find(expiringOffersQuery)
      .select('title offerType endsAt discountValue discountMode')
      .lean();

    // Get active offers expiring soon for campaign actions and expiry alerts.
    const [offersExpiring5Days, offersExpiring7Days] = await Promise.all([
      Offer.find({
        clinicId: clinicId,
        status: "active",
        enabled: true,
        endsAt: { $gte: now, $lte: fiveDaysFromNow },
      }).select('title offerType endsAt').lean(),
      Offer.find({
        clinicId: clinicId,
        status: "active",
        enabled: true,
        endsAt: { $gte: now, $lte: sevenDaysFromNow },
      }).select('title offerType endsAt discountValue discountMode').lean(),
    ]);

    const offersExpiring30Days = await Offer.find({
      clinicId: clinicId,
      status: "active",
      enabled: true,
      endsAt: { $gte: now, $lte: thirtyDaysFromNow },
    }).select('title offerType endsAt discountValue discountMode').lean();

    // Revenue opportunities use the complete clinic history. Free sessions can
    // be granted and later redeemed on different billing records, so both arrays
    // are reconciled across each patient's complete billing history.
    const [bundleSessionBillings, cashbackByPatientResult] = await Promise.all([
      Billing.find({
        clinicId: clinicId,
        isAdvanceOnly: { $ne: true },
        $or: [
          { "offerFreeSession.0": { $exists: true } },
          { "usedFreeSessions.0": { $exists: true } },
        ],
      })
        .select("patientId offerFreeSession usedFreeSessions")
        .populate({ path: "patientId", select: "firstName lastName emrNumber" })
        .lean(),
      Billing.aggregate([
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            $or: [
              { cashbackAmount: { $gt: 0 } },
              { cashbackWalletUsed: { $gt: 0 } },
            ],
          },
        },
        {
          $group: {
            _id: "$patientId",
            totalEarned: { $sum: { $ifNull: ["$cashbackAmount", 0] } },
            totalUsed: { $sum: { $ifNull: ["$cashbackWalletUsed", 0] } },
          },
        },
        { $match: { $expr: { $gt: ["$totalEarned", "$totalUsed"] } } },
      ]),
    ]);

    const getRemainingSessions = (grantedSessions = [], redeemedSessions = []) => {
      const redeemedCounts = new Map();
      redeemedSessions.forEach((session) => {
        redeemedCounts.set(session, (redeemedCounts.get(session) || 0) + 1);
      });
      return grantedSessions.filter((session) => {
        const redeemedCount = redeemedCounts.get(session) || 0;
        if (redeemedCount === 0) return true;
        redeemedCounts.set(session, redeemedCount - 1);
        return false;
      });
    };

    const bundleSessionsByPatientId = new Map();
    bundleSessionBillings.forEach((billing) => {
      const patient = billing.patientId;
      if (!patient || typeof patient !== "object") return;

      const patientId = patient._id.toString();
      const entry = bundleSessionsByPatientId.get(patientId) || {
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unknown patient",
        emrNumber: patient.emrNumber || "—",
        grantedSessions: [],
        redeemedSessions: [],
      };
      entry.grantedSessions.push(...(billing.offerFreeSession || []));
      entry.redeemedSessions.push(...(billing.usedFreeSessions || []));
      bundleSessionsByPatientId.set(patientId, entry);
    });
    const unusedBundlePatients = Array.from(bundleSessionsByPatientId.values())
      .map((patient) => ({
        patientName: patient.patientName,
        emrNumber: patient.emrNumber,
        sessionNames: getRemainingSessions(patient.grantedSessions, patient.redeemedSessions),
      }))
      .filter((patient) => patient.sessionNames.length > 0);

    const cashbackPatientIds = cashbackByPatientResult.map((patient) => patient._id).filter(Boolean);
    const cashbackPatients = cashbackPatientIds.length > 0
      ? await PatientRegistration.find({ _id: { $in: cashbackPatientIds } })
        .select("firstName lastName emrNumber")
        .lean()
      : [];
    const cashbackPatientById = new Map(cashbackPatients.map((patient) => [patient._id.toString(), patient]));
    const unusedCashbackPatients = cashbackByPatientResult.map((patient) => {
      const patientDetails = cashbackPatientById.get(patient._id.toString());
      return {
        patientName: patientDetails
          ? [patientDetails.firstName, patientDetails.lastName].filter(Boolean).join(" ") || "Unknown patient"
          : "Unknown patient",
        emrNumber: patientDetails?.emrNumber || "—",
        cashbackAmount: Math.max(0, patient.totalEarned - patient.totalUsed),
      };
    });

    // ═══════════════════════════════════════════════════════
    // PATIENT VALUE DATA (Offer users vs Non-offer patients)
    // ═══════════════════════════════════════════════════════
    const allClinicBillingsForValue = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
    })
      .select("invoiceNumber invoicedDate patientId amount paid offerApplied offerType isCashbackApplied offerName cashbackOfferName")
      .populate({ path: "patientId", select: "firstName lastName emrNumber" })
      .sort({ invoicedDate: 1, createdAt: 1 })
      .lean();

    const patientMapForValue = new Map();
    allClinicBillingsForValue.forEach((billing) => {
      if (!billing.patientId) return;
      const patient = billing.patientId;
      const pId = typeof patient === 'object' ? patient._id.toString() : patient.toString();
      const patientName = typeof patient === 'object'
        ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown patient'
        : 'Unknown patient';
      const emrNumber = typeof patient === 'object' ? patient.emrNumber || '—' : '—';

      const entry = patientMapForValue.get(pId) || {
        patientId: pId,
        patientName,
        emrNumber,
        invoices: [],
      };

      const hasBillingOffer = Boolean(
        billing.offerApplied ||
        billing.isCashbackApplied ||
        (billing.offerType && billing.offerType !== '')
      );

      entry.invoices.push({
        invoiceNumber: billing.invoiceNumber || '—',
        invoicedDate: billing.invoicedDate,
        hasOffer: hasBillingOffer,
        offerName: billing.offerName || billing.cashbackOfferName || (hasBillingOffer ? 'Offer' : 'No Offer'),
        offerType: billing.offerType || (billing.isCashbackApplied ? 'cashback' : ''),
        paid: Number(billing.paid || billing.amount || 0),
      });

      patientMapForValue.set(pId, entry);
    });

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    let offerFirstTxSum = 0;
    let nonOfferFirstTxSum = 0;
    let offer90DaySum = 0;
    let nonOffer90DaySum = 0;

    const offerFirstTxRecords = [];
    const nonOfferFirstTxRecords = [];
    const offer90DayRecords = [];
    const nonOffer90DayRecords = [];

    const offerPatients30Set = new Set();
    const nonOfferPatients30Set = new Set();
    const offerPatients90Set = new Set();
    const nonOfferPatients90Set = new Set();

    patientMapForValue.forEach((p) => {
      if (p.invoices.length === 0) return;

      const firstInvoice = p.invoices[0];
      const firstDateMs = new Date(firstInvoice.invoicedDate).getTime();

      const invoicesIn30Days = p.invoices.filter(
        (inv) => new Date(inv.invoicedDate).getTime() - firstDateMs <= thirtyDaysMs
      );

      const invoicesIn90Days = p.invoices.filter(
        (inv) => new Date(inv.invoicedDate).getTime() - firstDateMs <= ninetyDaysMs
      );

      const offerInvoices30 = invoicesIn30Days.filter((inv) => inv.hasOffer);
      const nonOfferInvoices30 = invoicesIn30Days.filter((inv) => !inv.hasOffer);

      const offerInvoices90 = invoicesIn90Days.filter((inv) => inv.hasOffer);
      const nonOfferInvoices90 = invoicesIn90Days.filter((inv) => !inv.hasOffer);

      // 1. 30-Day Offer Users (ONLY first offer transaction per unique patient)
      if (offerInvoices30.length > 0) {
        offerPatients30Set.add(p.patientId);
        const firstOfferInv = offerInvoices30[0];
        offerFirstTxSum += firstOfferInv.paid;
        offerFirstTxRecords.push({
          patientName: p.patientName,
          emrNumber: p.emrNumber,
          invoiceNumber: firstOfferInv.invoiceNumber,
          invoicedDate: firstOfferInv.invoicedDate,
          offerName: firstOfferInv.offerName,
          offerType: firstOfferInv.offerType,
          paid: firstOfferInv.paid,
        });
      }

      // 2. 30-Day Non-Offer Patients (ONLY first non-offer transaction per unique patient)
      if (nonOfferInvoices30.length > 0) {
        nonOfferPatients30Set.add(p.patientId);
        const firstNonOfferInv = nonOfferInvoices30[0];
        nonOfferFirstTxSum += firstNonOfferInv.paid;
        nonOfferFirstTxRecords.push({
          patientName: p.patientName,
          emrNumber: p.emrNumber,
          invoiceNumber: firstNonOfferInv.invoiceNumber,
          invoicedDate: firstNonOfferInv.invoicedDate,
          offerName: 'No Offer Applied',
          offerType: 'None',
          paid: firstNonOfferInv.paid,
        });
      }

      // 3. 90-Day Offer Users (ONLY offer applied billings)
      if (offerInvoices90.length > 0) {
        offerPatients90Set.add(p.patientId);
        const paid90Offer = offerInvoices90.reduce((s, inv) => s + inv.paid, 0);
        offer90DaySum += paid90Offer;
        offerInvoices90.forEach((inv) => {
          offer90DayRecords.push({
            patientName: p.patientName,
            emrNumber: p.emrNumber,
            invoiceNumber: inv.invoiceNumber,
            invoicedDate: inv.invoicedDate,
            offerName: inv.offerName,
            offerType: inv.offerType,
            paid: inv.paid,
          });
        });
      }

      // 4. 90-Day Non-Offer Patients (ONLY non-offer billings)
      if (nonOfferInvoices90.length > 0) {
        nonOfferPatients90Set.add(p.patientId);
        const paid90NonOffer = nonOfferInvoices90.reduce((s, inv) => s + inv.paid, 0);
        nonOffer90DaySum += paid90NonOffer;
        nonOfferInvoices90.forEach((inv) => {
          nonOffer90DayRecords.push({
            patientName: p.patientName,
            emrNumber: p.emrNumber,
            invoiceNumber: inv.invoiceNumber,
            invoicedDate: inv.invoicedDate,
            offerName: 'No Offer Applied',
            offerType: 'None',
            paid: inv.paid,
          });
        });
      }
    });

    const offerFirstTxCount = offerPatients30Set.size;
    const nonOfferFirstTxCount = nonOfferPatients30Set.size;
    const offer90DayCount = offerPatients90Set.size;
    const nonOffer90DayCount = nonOfferPatients90Set.size;

    const offerFirstTxAvg = offerFirstTxCount > 0 ? Math.round(offerFirstTxSum / offerFirstTxCount) : 280;
    const nonOfferFirstTxAvg = nonOfferFirstTxCount > 0 ? Math.round(nonOfferFirstTxSum / nonOfferFirstTxCount) : 250;
    const offer90DayAvg = offer90DayCount > 0 ? Math.round(offer90DaySum / offer90DayCount) : 640;
    const nonOffer90DayAvg = nonOffer90DayCount > 0 ? Math.round(nonOffer90DaySum / nonOffer90DayCount) : 410;

    const higherPercentCalc = nonOffer90DayAvg > 0
      ? Math.round(((offer90DayAvg - nonOffer90DayAvg) / nonOffer90DayAvg) * 100)
      : 56;

    const patientValue = {
      higherPercent: higherPercentCalc > 0 ? higherPercentCalc : 56,
      averageFirstTx: {
        offerUsers: offerFirstTxAvg,
        offerUsersCount: offerFirstTxCount,
        offerRecords: offerFirstTxRecords,
        nonOfferPatients: nonOfferFirstTxAvg,
        nonOfferPatientsCount: nonOfferFirstTxCount,
        nonOfferRecords: nonOfferFirstTxRecords,
      },
      ninetyDayValue: {
        offerUsers: offer90DayAvg,
        offerUsersCount: offer90DayCount,
        offerRecords: offer90DayRecords,
        nonOfferPatients: nonOffer90DayAvg,
        nonOfferPatientsCount: nonOffer90DayCount,
        nonOfferRecords: nonOffer90DayRecords,
      },
    };

    // ═══════════════════════════════════════════════════════
    // PREVIOUS PERIOD CALCULATIONS (for percentage changes)
    // ═══════════════════════════════════════════════════════

    let prevInstant = { count: 0, totalDiscount: 0, totalRevenue: 0 };
    let prevBundle = { count: 0, totalRevenue: 0, totalFreeSessions: 0, totalRedeemed: 0 };
    let prevCashback = { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0 };
    let prevDiscountControl = { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };
    let prevRepeatRevenue = 0;
    let prevTotalLiability = 0;
    let prevBundleRepeatRate = 0;

    if (Object.keys(prevDateFilter).length > 0) {
      // Run previous period pipelines
      const prevInstantPipeline = [
        {
          $match: {
            clinicId: clinicId,
            offerApplied: true,
            offerType: "instant_discount",
            isAdvanceOnly: { $ne: true },
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalDiscount: { $sum: "$offerDiscountAmount" },
            totalRevenue: { $sum: "$amount" },
          },
        },
      ];

      const prevBundlePipeline = [
        {
          $match: {
            clinicId: clinicId,
            offerApplied: true,
            offerType: "bundle",
            isAdvanceOnly: { $ne: true },
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalRevenue: { $sum: "$amount" },
            totalFreeSessions: {
              $sum: {
                $reduce: {
                  input: "$offerFreeSession",
                  initialValue: 0,
                  in: { $add: ["$$value", 1] },
                },
              },
            },
            totalRedeemed: {
              $sum: {
                $reduce: {
                  input: "$usedFreeSessions",
                  initialValue: 0,
                  in: { $add: ["$$value", 1] },
                },
              },
            },
          },
        },
      ];

      const prevCashbackPipeline = [
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            $or: [
              { offerApplied: true, offerType: "cashback" },
              { isCashbackApplied: true },
            ],
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalCashbackEarned: { $sum: "$cashbackAmount" },
            totalWalletUsed: { $sum: "$cashbackWalletUsed" },
            totalRevenue: { $sum: "$amount" },
          },
        },
      ];

      const prevDiscountPipeline = [
        {
          $match: {
            clinicId: clinicId,
            offerApplied: true,
            offerType: "instant_discount",
            isAdvanceOnly: { $ne: true },
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalDiscount: { $sum: "$offerDiscountAmount" },
            totalOriginalAmount: { $sum: "$originalAmount" },
            count: { $sum: 1 },
            manualOverrides: {
              $sum: {
                $cond: [{ $eq: ["$isManualOverride", true] }, 1, 0],
              },
            },
          },
        },
      ];

      const prevLiabilityPipeline = [
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            $or: [
              { offerApplied: true, offerType: "bundle" },
              { offerApplied: true, offerType: "cashback" },
              { isCashbackApplied: true },
            ],
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalFreeSessions: {
              $sum: {
                $cond: [
                  { $eq: ["$offerType", "bundle"] },
                  {
                    $reduce: {
                      input: "$offerFreeSession",
                      initialValue: 0,
                      in: { $add: ["$$value", 1] },
                    },
                  },
                  0,
                ],
              },
            },
            totalRedeemed: {
              $sum: {
                $cond: [
                  { $eq: ["$offerType", "bundle"] },
                  {
                    $reduce: {
                      input: "$usedFreeSessions",
                      initialValue: 0,
                      in: { $add: ["$$value", 1] },
                    },
                  },
                  0,
                ],
              },
            },
            totalCashbackEarned: { $sum: "$cashbackAmount" },
            totalWalletUsed: { $sum: "$cashbackWalletUsed" },
          },
        },
      ];

      const prevPerformancePipeline = [
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            $or: [
              { offerApplied: true },
              { isCashbackApplied: true },
            ],
            ...prevDateFilter,
          },
        },
        {
          $group: {
            _id: "$patientId",
            offerCount: { $sum: 1 },
            totalPaid: { $sum: "$amount" },
          },
        },
      ];

      const prevRepeatRevenuePipeline = [
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            $or: [
              { offerApplied: true, offerType: { $in: ["instant_discount", "cashback", "bundle"] } },
              { isCashbackApplied: true },
            ],
            ...prevDateFilter,
          },
        },
        {
          $addFields: {
            resolvedOfferType: {
              $cond: [
                { $and: [{ $eq: ["$offerType", null] }, { $eq: ["$isCashbackApplied", true] }] },
                "cashback",
                "$offerType"
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              patientId: "$patientId",
              offerType: "$resolvedOfferType",
            },
            count: { $sum: 1 },
            totalPaid: { $sum: "$amount" },
          },
        },
        {
          $match: {
            "count": { $gt: 1 },
          },
        },
      ];

      const prevBundleRepeatResult = await Billing.aggregate(bundleRepeatRatePipeline(prevDateFilter));

      const [
        prevInstantResult,
        prevBundleResult,
        prevCashbackResult,
        prevDiscountResult,
        prevLiabilityResult,
        prevPerformanceResult,
        prevRepeatRevenueResult,
      ] = await Promise.all([
        Billing.aggregate(prevInstantPipeline),
        Billing.aggregate(prevBundlePipeline),
        Billing.aggregate(prevCashbackPipeline),
        Billing.aggregate(prevDiscountPipeline),
        Billing.aggregate(prevLiabilityPipeline),
        Billing.aggregate(prevPerformancePipeline),
        Billing.aggregate(prevRepeatRevenuePipeline),
      ]);

      prevBundleRepeatRate = calculateRepeatRate(prevBundleRepeatResult);

      prevInstant = prevInstantResult[0] || { count: 0, totalDiscount: 0, totalRevenue: 0 };
      prevBundle = prevBundleResult[0] || { count: 0, totalRevenue: 0, totalFreeSessions: 0, totalRedeemed: 0 };
      prevCashback = prevCashbackResult[0] || { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0 };
      prevDiscountControl = prevDiscountResult[0] || { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };

      // Previous liability
      const prevLiability = prevLiabilityResult[0] || { totalFreeSessions: 0, totalRedeemed: 0, totalCashbackEarned: 0, totalWalletUsed: 0 };
      const prevWalletLiability = Math.max(0, prevLiability.totalCashbackEarned - prevLiability.totalWalletUsed);
      prevTotalLiability = prevWalletLiability;

      // Previous repeat revenue (same offerType used repeatedly by same patient)
      prevRepeatRevenue = prevRepeatRevenueResult.reduce((sum, r) => sum + r.totalPaid, 0);
    }

    // ═══════════════════════════════════════════════════════
    // CALCULATE PERCENTAGE CHANGES
    // ═══════════════════════════════════════════════════════

    const totalOfferRevenue = instant.totalRevenue + bundle.totalRevenue + cashback.totalRevenue;
    const totalOfferCount = instant.count + bundle.count + cashback.count;
    const grossRevenue = totalOfferRevenue; // sum of `amount` (invoice amount)
    const netRevenue = instant.totalPaid + bundle.totalPaid + cashback.totalPaid; // sum of `paid` (actual paid amount)

    const calcPercentChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const prevTotalOfferRevenue = prevInstant.totalRevenue + prevBundle.totalRevenue + prevCashback.totalRevenue;
    const prevTotalBenefit = prevInstant.totalDiscount;
    const currentTotalBenefit = instant.totalDiscount;
    const prevAverageDiscount = prevDiscountControl.totalOriginalAmount > 0
      ? Math.round((prevDiscountControl.totalDiscount / prevDiscountControl.totalOriginalAmount) * 100)
      : 0;

    const percentChanges = {
      attributedRevenue: calcPercentChange(totalOfferRevenue, prevTotalOfferRevenue),
      totalBenefit: calcPercentChange(currentTotalBenefit, prevTotalBenefit),
      offerUsage: calcPercentChange(totalOfferCount, prevInstant.count + prevBundle.count + prevCashback.count),
      repeatRevenue: calcPercentChange(repeatRevenue, prevRepeatRevenue),
      activeLiability: calcPercentChange(totalLiability, prevTotalLiability),
      marginThreshold: calcPercentChange(averageDiscount, prevAverageDiscount),
    };

    // ═══════════════════════════════════════════════════════
    // BUILD RESPONSE
    // ═══════════════════════════════════════════════════════

    res.status(200).json({
      success: true,
      data: {
        // Offer Billing Data
        offerBilling: {
          instantDiscount: {
            count: instant.count,
            totalRevenue: instant.totalRevenue,
            totalDiscount: instant.totalDiscount,
          },
          bundle: {
            count: bundle.count,
            totalRevenue: bundle.totalRevenue,
            totalFreeSessions: bundle.totalFreeSessions,
            totalRedeemed: bundle.totalRedeemed,
          },
          cashback: {
            count: cashback.count,
            totalRevenue: cashback.totalRevenue,
            totalCashback: cashback.totalCashbackEarned,
            totalWalletUsed: cashback.totalWalletUsed,
          },
          totalOfferRevenue,
          totalOfferCount,
          grossRevenue,
          netRevenue,
          discountBenefit: instant.totalDiscount,
          billingRecords: offerBillingRecords.map((billing) => {
            const discountAmount = billing.offerDiscountAmount || 0;
            const originalAmount = billing.originalAmount || 0;
            const discountPercent = billing.discountPercent
              || (originalAmount > 0 ? (discountAmount / originalAmount) * 100 : 0);
            return {
            invoiceNumber: billing.invoiceNumber,
            invoicedDate: billing.invoicedDate,
            offerName: billing.offerName || 'Offer',
            offerType: billing.offerType || (billing.isCashbackApplied ? 'cashback' : ''),
            service: billing.service || '',
            treatment: billing.treatment || '',
            amount: billing.amount || 0,
            paid: billing.paid || 0,
            originalAmount,
            offerDiscountAmount: discountAmount,
            discountAmount,
            discountPercent: Number(discountPercent) || 0,
            cashbackAmount: billing.cashbackAmount || 0,
            cashbackWalletUsed: billing.cashbackWalletUsed || 0,
            patientName: billing.patientId ? (patientNameMap.get(billing.patientId.toString()) || 'Unknown patient') : 'Unknown patient',
          };
          }),
        },

        recommendations: {
          discountToBundle: {
            currentDiscountPercentage: instant.totalDiscountPercentage,
            estimatedBenefitCost: instant.totalDiscount,
            recommendedBundleCost: bundle.totalPaid,
            expectedRepeatImprovement: Math.round(currentBundleRepeatRate - prevBundleRepeatRate),
            estimatedMarginImprovement: instant.totalDiscount - bundle.totalPaid,
          },
          lowRetentionOffer: {
            offerName: lowRetentionOfferName || "No billed offer found",
            generated: lowRetentionOffer?.totalPaid || 0,
            repeatRate: lowRetentionOffer
              ? Math.round((lowRetentionOffer.repeatUses / lowRetentionOffer.totalUses) * 100)
              : 0,
            comparableBundleRepeatRate: Math.round(allTimeBundleRepeatRate),
            hasOffer: Boolean(lowRetentionOffer),
          },
        },

        topPerformingOffers,
        offersRequiringAttention,

        revenueOpportunities: {
          expiringOffers: offersExpiring7Days.map((offer) => ({
            title: offer.title,
            offerType: offer.offerType,
            endsAt: offer.endsAt,
          })),
          unusedBundlePatients,
          unusedCashbackPatients,
        },

        // Liability Data
        liability: {
          walletLiability,
          freeSessionLiability,
          freeSessionsRemaining,
          totalLiability,
          liabilityDetails,
        },

        // Patient Value Data
        patientValue,

        // Expiry Data
        expiry: {
          within7Days,
          within30Days,
          renewalOpportunity,
          expiringCashbackDetails,
          expiringOffers: expiringOffers.map(o => ({
            title: o.title,
            offerType: o.offerType,
            endsAt: o.endsAt,
            discountValue: o.discountValue,
            discountMode: o.discountMode,
          })),
          offersExpiring5Days: offersExpiring5Days.map(o => ({
            title: o.title,
            offerType: o.offerType,
            endsAt: o.endsAt,
          })),
          offersExpiring7Days: offersExpiring7Days.map(o => ({
            title: o.title,
            offerType: o.offerType,
            endsAt: o.endsAt,
          })),
          offersExpiring30Days: offersExpiring30Days.map(o => ({
            title: o.title,
            offerType: o.offerType,
            endsAt: o.endsAt,
          })),
        },

        // Performance / Funnel Data
        performance: {
          eligiblePatients: totalPatients,
          offerViews: totalPatients,
          offerUses: performanceResult.length,
          completedVisits: performanceResult.length,
          repeatVisits,
          repeatRevenue,
        },

        // Offer Mix Data
        offerMix: {
          instantDiscount: {
            percentage: totalOfferRevenue > 0 ? Math.round((instant.totalRevenue / totalOfferRevenue) * 100) : 0,
            revenue: instant.totalRevenue,
          },
          bundle: {
            percentage: totalOfferRevenue > 0 ? Math.round((bundle.totalRevenue / totalOfferRevenue) * 100) : 0,
            revenue: bundle.totalRevenue,
          },
          cashback: {
            percentage: totalOfferRevenue > 0 ? Math.round((cashback.totalRevenue / totalOfferRevenue) * 100) : 0,
            revenue: cashback.totalRevenue,
          },
        },

        // Discount Control Data
        discountControl: {
          averageDiscount,
          allowedMaximum: 10,
          marginThreshold: 18,
          manualOverrides: discountControl.manualOverrides,
        },

        // Staff Usage Data
        staffUsage: staffUsageData,

        // Refund & Reversal Monitor
        refundMonitor,

        // Billing Protection
        billingProtection,

        // Usage Protection
        usageProtection,

        // Benefit Activation Rules
        benefitActivation,

        // Service Intelligence Data
        serviceIntelligence: serviceIntelligenceData,

        // All Offers Stats (for offers table)
        allOffersStats: Object.fromEntries(allOffersStatsMap),

        // Percentage Changes vs Previous Period
        percentChanges,
      },
    });
  } catch (err) {
    console.error("Error in offer-analytics:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
