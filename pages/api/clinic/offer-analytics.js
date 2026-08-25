import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Offer from "../../../models/CreateOffer";
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

    // ── Instant Discount Analytics ──
    const instantDiscountPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "instant_discount",
          isAdvanceOnly: { $ne: true },
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

    // ── Bundle Offer Analytics ──
    const bundlePipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
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

    // ── Cashback Analytics ──
    const cashbackPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: "cashback" },
            { isCashbackApplied: true },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCashbackEarned: { $sum: "$cashbackAmount" },
          totalWalletUsed: { $sum: "$cashbackWalletUsed" },
        },
      },
    ];

    // ── Free Session Redemption Analytics (standalone) ──
    const freeSessionPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          usedFreeSessions: { $exists: true, $not: { $size: 0 } },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
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

    // Run all pipelines in parallel
    const [instantResult, bundleResult, cashbackResult, freeSessionResult] = await Promise.all([
      Billing.aggregate(instantDiscountPipeline),
      Billing.aggregate(bundlePipeline),
      Billing.aggregate(cashbackPipeline),
      Billing.aggregate(freeSessionPipeline),
    ]);

    const instant = instantResult[0] || { count: 0, totalDiscount: 0, totalRevenue: 0 };
    const bundle = bundleResult[0] || { count: 0, totalFreeSessions: 0, totalRedeemed: 0 };
    const cashback = cashbackResult[0] || { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0 };
    const freeSession = freeSessionResult[0] || { count: 0, totalRedeemed: 0 };

    // Total offer usage count and revenue (any billing with any offer activity)
    const offersUsedMatch = {
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      $or: [
        { offerApplied: true },
        { isCashbackApplied: true },
        { usedFreeSessions: { $exists: true, $not: { $size: 0 } } },
        { cashbackWalletUsed: { $gt: 0 } },
      ],
    };
    const totalOfferBillings = await Billing.countDocuments(offersUsedMatch);

    // Fetch billing details for Total Offers Used modal
    const PatientRegistration = (await import("../../../models/PatientRegistration")).default;
    const offersUsedBillings = await Billing.find(offersUsedMatch)
      .select("invoiceNumber patientId invoicedDate offerName offerType cashbackOfferName isCashbackApplied")
      .sort({ invoicedDate: -1 })
      .lean();

    // Get patient names for offers-used billings
    const offersUsedPatientIds = [...new Set(offersUsedBillings.map((b) => b.patientId?.toString()).filter(Boolean))];
    const offersUsedPatients = await PatientRegistration.find({ _id: { $in: offersUsedPatientIds } }).select("firstName lastName").lean();
    const offersUsedPatientMap = {};
    offersUsedPatients.forEach((p) => {
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      offersUsedPatientMap[p._id.toString()] = fullName || "Unknown";
    });

    const offersUsedList = offersUsedBillings.map((b) => {
      let offerDisplayName = b.offerName || null;
      if (!offerDisplayName && b.cashbackOfferName) offerDisplayName = b.cashbackOfferName;
      let resolvedOfferType = b.offerType;
      if (!resolvedOfferType && b.isCashbackApplied) resolvedOfferType = "cashback";
      return {
        invoiceNumber: b.invoiceNumber,
        patientName: offersUsedPatientMap[b.patientId?.toString()] || "Unknown",
        invoicedDate: b.invoicedDate,
        offerName: offerDisplayName,
        offerType: resolvedOfferType,
      };
    });

    // Fetch billing details for Total Discount Applied modal (instant_discount only)
    const discountBillings = await Billing.find({
      clinicId: clinicId,
      offerApplied: true,
      offerType: "instant_discount",
      isAdvanceOnly: { $ne: true },
    })
      .select("invoiceNumber patientId invoicedDate offerName offerDiscountAmount discountPercent originalAmount amount")
      .sort({ invoicedDate: -1 })
      .lean();

    // Get patient names for discount billings
    const discountPatientIds = [...new Set(discountBillings.map((b) => b.patientId?.toString()).filter(Boolean))];
    const discountPatients = await PatientRegistration.find({ _id: { $in: discountPatientIds } }).select("firstName lastName").lean();
    const discountPatientMap = {};
    discountPatients.forEach((p) => {
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      discountPatientMap[p._id.toString()] = fullName || "Unknown";
    });

    const instantDiscountList = discountBillings.map((b) => ({
      invoiceNumber: b.invoiceNumber,
      patientName: discountPatientMap[b.patientId?.toString()] || "Unknown",
      invoicedDate: b.invoicedDate,
      offerName: b.offerName || "—",
      discountPercent: b.discountPercent || 0,
      discountAmount: b.offerDiscountAmount || 0,
      originalAmount: b.originalAmount || 0,
      finalAmount: b.amount || 0,
    }));

    // Total revenue from billings where any offer type is applied
    const totalRevenueResult = await Billing.aggregate([
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: { $in: ["instant_discount", "cashback", "bundle"] } },
            { isCashbackApplied: true },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;

    // Fetch billing details for revenue modal (patient name, invoice number, paid amount, offer info)
    const revenueBillings = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      $or: [
        { offerApplied: true, offerType: { $in: ["instant_discount", "cashback", "bundle"] } },
        { isCashbackApplied: true },
      ],
    })
    .select("invoiceNumber amount patientId invoicedDate offerName offerType offerDiscountAmount cashbackOfferName cashbackAmount isCashbackApplied")
    .sort({ invoicedDate: -1 })
    .lean();

    // Get patient names for the billings
    const patientIds = [...new Set(revenueBillings.map((b) => b.patientId?.toString()).filter(Boolean))];
    const patients = await PatientRegistration.find({ _id: { $in: patientIds } }).select("firstName lastName").lean();
    const patientMap = {};
    patients.forEach((p) => {
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      patientMap[p._id.toString()] = fullName || "Unknown";
    });

    const revenueBillingList = revenueBillings.map((b) => {
      // Determine the offer display name
      let offerDisplayName = b.offerName || null;
      if (!offerDisplayName && b.cashbackOfferName) offerDisplayName = b.cashbackOfferName;

      // Infer offerType for older cashback billings where offerType was null
      let resolvedOfferType = b.offerType;
      if (!resolvedOfferType && b.isCashbackApplied) resolvedOfferType = "cashback";

      return {
        invoiceNumber: b.invoiceNumber,
        amount: b.amount,
        patientName: patientMap[b.patientId?.toString()] || "Unknown",
        invoicedDate: b.invoicedDate,
        offerName: offerDisplayName,
        offerType: resolvedOfferType,
        offerDiscountAmount: b.offerDiscountAmount || 0,
        cashbackAmount: b.cashbackAmount || 0,
      };
    });

    // ── Most Used Offer: group by offerType, find max count, return offer names ──
    const offerTypeCounts = await Billing.aggregate([
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
          _id: "$offerType",
          count: { $sum: 1 },
          offerNames: { $addToSet: "$offerName" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    let mostUsedOffers = [];
    if (offerTypeCounts.length > 0) {
      const maxCount = offerTypeCounts[0].count;
      mostUsedOffers = offerTypeCounts
        .filter((o) => o.count === maxCount)
        .map((o) => ({
          offerType: o._id,
          count: o.count,
          offerNames: o.offerNames.filter(Boolean),
        }));
    }

    // ── Underperforming Offer: find offer(s) with lowest usage from Billing ──
    const allOffers = await Offer.find({ clinicId: clinicId }).select("title offerType").lean();

    let underperformingOffers = [];
    if (allOffers.length > 0) {
      const offerTitles = allOffers.map((o) => o.title);

      // Count usage from regular offers (offerApplied: true + offerName match)
      const regularUsageCounts = await Billing.aggregate([
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            offerApplied: true,
            offerName: { $in: offerTitles },
          },
        },
        {
          $group: {
            _id: "$offerName",
            count: { $sum: 1 },
          },
        },
      ]);

      // Count usage from cashback offers (isCashbackApplied: true + cashbackOfferName match)
      const cashbackUsageCounts = await Billing.aggregate([
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            isCashbackApplied: true,
            cashbackOfferName: { $in: offerTitles },
          },
        },
        {
          $group: {
            _id: "$cashbackOfferName",
            count: { $sum: 1 },
          },
        },
      ]);

      // Merge both usage maps (add counts if same offer name appears in both)
      const usageMap = {};
      regularUsageCounts.forEach((u) => { usageMap[u._id] = (usageMap[u._id] || 0) + u.count; });
      cashbackUsageCounts.forEach((u) => { usageMap[u._id] = (usageMap[u._id] || 0) + u.count; });

      // Attach usage to each offer (default 0 if never used)
      const offersWithUsage = allOffers.map((o) => ({
        title: o.title,
        offerType: o.offerType,
        usedCount: usageMap[o.title] || 0,
      }));

      // Return offers used 0 times or just 1 time
      underperformingOffers = offersWithUsage
        .filter((o) => o.usedCount <= 1)
        .map((o) => ({
          title: o.title,
          offerType: o.offerType,
          usedCount: o.usedCount,
        }));
    }

    // ── Top 5 Patients by offer usage frequency ──
    const topPatientsPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true },
            { isCashbackApplied: true },
          ],
        },
      },
      {
        $group: {
          _id: "$patientId",
          count: { $sum: 1 },
          offers: { $push: { offerName: "$offerName", cashbackOfferName: "$cashbackOfferName", offerType: "$offerType", isCashbackApplied: "$isCashbackApplied" } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ];

    const topPatientsResult = await Billing.aggregate(topPatientsPipeline);

    // Resolve patient names
    const topPatientIds = topPatientsResult.map((r) => r._id).filter(Boolean);
    const topPatients = await PatientRegistration.find({ _id: { $in: topPatientIds } }).select("firstName lastName").lean();
    const topPatientMap = {};
    topPatients.forEach((p) => {
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      topPatientMap[p._id.toString()] = fullName || "Unknown";
    });

    const topPatientsList = topPatientsResult.map((r) => {
      // Get unique offer names from the billings
      const offerNamesSet = new Set();
      (r.offers || []).forEach((o) => {
        const name = o.offerName || (o.isCashbackApplied ? o.cashbackOfferName : null);
        if (name) offerNamesSet.add(name);
      });
      return {
        patientId: r._id,
        patientName: topPatientMap[r._id?.toString()] || "Unknown",
        count: r.count,
        offerNames: [...offerNamesSet],
      };
    });

    res.status(200).json({
      success: true,
      analytics: {
        instantDiscount: {
          count: instant.count,
          totalDiscount: instant.totalDiscount,
          totalRevenue: instant.totalRevenue,
          list: instantDiscountList,
        },
        bundle: {
          count: bundle.count,
          totalFreeSessions: bundle.totalFreeSessions,
          totalRedeemed: bundle.totalRedeemed,
        },
        cashback: {
          count: cashback.count,
          totalCashbackEarned: cashback.totalCashbackEarned,
          totalWalletUsed: cashback.totalWalletUsed,
        },
        freeSessionRedemption: {
          count: freeSession.count,
          totalRedeemed: freeSession.totalRedeemed,
        },
        totalOfferBillings,
        offersUsedList,
        totalRevenue,
        revenueBillingList,
        mostUsedOffers,
        underperformingOffers,
        topPatientsList,
      },
    });
  } catch (err) {
    console.error("Error in offer-analytics:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
