import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Offer from "../../../models/CreateOffer";
import Users from "../../../models/Users";
import Service from "../../../models/Service";
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
          totalDiscount: { $sum: "$offerDiscountAmount" },
          totalRevenue: { $sum: "$amount" },
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
        },
      },
    ];

    // ═══════════════════════════════════════════════════════
    // SECTION 2: LIABILITY DATA
    // ═══════════════════════════════════════════════════════

    const liabilityPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: "bundle" },
            { offerApplied: true, offerType: "cashback" },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
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

    const serviceIntelligencePipeline = [
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
          _id: "$serviceId",
          offerRevenue: { $sum: "$amount" },
          offerCount: { $sum: 1 },
          patientIds: { $addToSet: "$patientId" },
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
    ] = await Promise.all([
      Billing.aggregate(instantDiscountPipeline),
      Billing.aggregate(bundlePipeline),
      Billing.aggregate(cashbackPipeline),
      Billing.aggregate(liabilityPipeline),
      Billing.aggregate(performancePipeline),
      Billing.aggregate(discountControlPipeline),
      Billing.aggregate(serviceIntelligencePipeline),
      Billing.aggregate(repeatRevenuePipeline),
    ]);

    const instant = instantResult[0] || { count: 0, totalDiscount: 0, totalRevenue: 0 };
    const bundle = bundleResult[0] || { count: 0, totalRevenue: 0, totalFreeSessions: 0, totalRedeemed: 0 };
    const cashback = cashbackResult[0] || { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0 };
    const liability = liabilityResult[0] || { totalFreeSessions: 0, totalRedeemed: 0, totalCashbackEarned: 0, totalWalletUsed: 0 };
    const discountControl = discountControlResult[0] || { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };

    // ═══════════════════════════════════════════════════════
    // CALCULATE DERIVED VALUES
    // ═══════════════════════════════════════════════════════

    // Liability calculations
    const freeSessionsRemaining = liability.totalFreeSessions - liability.totalRedeemed;
    const freeSessionLiability = Math.max(0, freeSessionsRemaining * 100);
    const walletLiability = Math.max(0, liability.totalCashbackEarned - liability.totalWalletUsed);
    const totalLiability = freeSessionLiability + walletLiability;

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

    const staffMembers = await Users.find({
      clinicId: clinicId,
      role: { $in: ["staff", "doctorStaff"] },
    }).select("_id name").lean();

    let staffUsageData = [];
    if (staffMembers.length > 0) {
      const staffIds = staffMembers.map((s) => s._id);

      const staffUsagePipeline = [
        {
          $match: {
            clinicId: clinicId,
            isAdvanceOnly: { $ne: true },
            createdBy: { $in: staffIds },
            $or: [
              { offerApplied: true },
              { isCashbackApplied: true },
            ],
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: "$createdBy",
            offers: { $sum: 1 },
            totalBenefit: {
              $sum: {
                $add: [
                  { $ifNull: ["$offerDiscountAmount", 0] },
                  { $ifNull: ["$cashbackAmount", 0] },
                ],
              },
            },
            manualOverrides: {
              $sum: {
                $cond: [{ $eq: ["$isManualOverride", true] }, 1, 0],
              },
            },
          },
        },
      ];

      const staffUsageResult = await Billing.aggregate(staffUsagePipeline);

      const staffMap = {};
      staffMembers.forEach((s) => {
        staffMap[s._id.toString()] = {
          staffId: s._id.toString(),
          staffName: s.name || "Unknown",
          offers: 0,
          avgBenefit: 0,
          overrides: 0,
        };
      });

      staffUsageResult.forEach((r) => {
        const staffId = r._id.toString();
        if (staffMap[staffId]) {
          staffMap[staffId].offers = r.offers;
          staffMap[staffId].avgBenefit = r.offers > 0 ? Math.round(r.totalBenefit / r.offers) : 0;
          staffMap[staffId].overrides = r.manualOverrides;
        }
      });

      staffUsageData = Object.values(staffMap).map((s) => ({
        ...s,
        status: s.offers === 0 ? "Low" : s.overrides > 0 ? "Needs review" : "Low",
      }));
    }

    // ═══════════════════════════════════════════════════════
    // SECTION 7: SERVICE INTELLIGENCE (with repeat rates)
    // ═══════════════════════════════════════════════════════

    const serviceIds = serviceIntelligenceResult.map((r) => r._id).filter(Boolean);
    const services = await Service.find({ _id: { $in: serviceIds } }).select("_id name").lean();
    const serviceMap = {};
    services.forEach((s) => {
      serviceMap[s._id.toString()] = s.name;
    });

    const serviceIntelligenceData = await Promise.all(
      serviceIntelligenceResult.map(async (r) => {
        const serviceName = serviceMap[r._id?.toString()] || "Unknown Service";
        const offerRevenue = r.offerRevenue;

        // Calculate repeat rate for this service
        const patientVisitCounts = await Billing.aggregate([
          {
            $match: {
              clinicId: clinicId,
              serviceId: r._id,
              isAdvanceOnly: { $ne: true },
              patientId: { $in: r.patientIds },
            },
          },
          {
            $group: {
              _id: "$patientId",
              visitCount: { $sum: 1 },
            },
          },
        ]);

        const repeatPatientsCount = patientVisitCounts.filter((p) => p.visitCount > 1).length;
        const totalPatientsCount = patientVisitCounts.length;
        const repeatRate = totalPatientsCount > 0 ? Math.round((repeatPatientsCount / totalPatientsCount) * 100) : 0;

        return {
          serviceName,
          offerRevenue,
          repeatRate,
        };
      })
    );

    serviceIntelligenceData.sort((a, b) => b.offerRevenue - a.offerRevenue);

    // ═══════════════════════════════════════════════════════
    // SECTION 8: EXPIRY DATA
    // ═══════════════════════════════════════════════════════

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const within7DaysPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          offerExpiryDate: {
            $gte: now,
            $lte: sevenDaysFromNow,
          },
        },
      },
      {
        $group: {
          _id: "$patientId",
          benefitAmount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    {
                      $reduce: {
                        input: "$offerFreeSession",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                    {
                      $reduce: {
                        input: "$usedFreeSessions",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                  ],
                },
                100,
              ],
            },
          },
        },
      },
    ];

    const within30DaysPipeline = [
      {
        $match: {
          clinicId: clinicId,
          offerApplied: true,
          offerType: "bundle",
          isAdvanceOnly: { $ne: true },
          offerExpiryDate: {
            $gte: now,
            $lte: thirtyDaysFromNow,
          },
        },
      },
      {
        $group: {
          _id: "$patientId",
          benefitAmount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    {
                      $reduce: {
                        input: "$offerFreeSession",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                    {
                      $reduce: {
                        input: "$usedFreeSessions",
                        initialValue: 0,
                        in: { $add: ["$$value", 1] },
                      },
                    },
                  ],
                },
                100,
              ],
            },
          },
        },
      },
    ];

    const [within7DaysResult, within30DaysResult] = await Promise.all([
      Billing.aggregate(within7DaysPipeline),
      Billing.aggregate(within30DaysPipeline),
    ]);

    const within7Days = {
      patientCount: within7DaysResult.length,
      benefitAmount: within7DaysResult.reduce((sum, r) => sum + (r.benefitAmount || 0), 0),
    };

    const within30Days = {
      patientCount: within30DaysResult.length,
      benefitAmount: within30DaysResult.reduce((sum, r) => sum + (r.benefitAmount || 0), 0),
    };

    const renewalOpportunity = within30Days.benefitAmount * 0.5;

    // ═══════════════════════════════════════════════════════
    // PREVIOUS PERIOD CALCULATIONS (for percentage changes)
    // ═══════════════════════════════════════════════════════

    let prevInstant = { count: 0, totalDiscount: 0, totalRevenue: 0 };
    let prevBundle = { count: 0, totalRevenue: 0, totalFreeSessions: 0, totalRedeemed: 0 };
    let prevCashback = { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0 };
    let prevDiscountControl = { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };
    let prevRepeatRevenue = 0;
    let prevTotalLiability = 0;

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

      prevInstant = prevInstantResult[0] || { count: 0, totalDiscount: 0, totalRevenue: 0 };
      prevBundle = prevBundleResult[0] || { count: 0, totalRevenue: 0, totalFreeSessions: 0, totalRedeemed: 0 };
      prevCashback = prevCashbackResult[0] || { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0, totalRevenue: 0 };
      prevDiscountControl = prevDiscountResult[0] || { totalDiscount: 0, totalOriginalAmount: 0, count: 0, manualOverrides: 0 };

      // Previous liability
      const prevLiability = prevLiabilityResult[0] || { totalFreeSessions: 0, totalRedeemed: 0, totalCashbackEarned: 0, totalWalletUsed: 0 };
      const prevFreeSessionsRemaining = prevLiability.totalFreeSessions - prevLiability.totalRedeemed;
      const prevFreeSessionLiability = Math.max(0, prevFreeSessionsRemaining * 100);
      const prevWalletLiability = Math.max(0, prevLiability.totalCashbackEarned - prevLiability.totalWalletUsed);
      prevTotalLiability = prevFreeSessionLiability + prevWalletLiability;

      // Previous repeat revenue (same offerType used repeatedly by same patient)
      prevRepeatRevenue = prevRepeatRevenueResult.reduce((sum, r) => sum + r.totalPaid, 0);
    }

    // ═══════════════════════════════════════════════════════
    // CALCULATE PERCENTAGE CHANGES
    // ═══════════════════════════════════════════════════════

    const totalOfferRevenue = instant.totalRevenue + bundle.totalRevenue + cashback.totalRevenue;
    const totalOfferCount = instant.count + bundle.count + cashback.count;

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
        },

        // Liability Data
        liability: {
          freeSessionLiability,
          walletLiability,
          totalLiability,
          freeSessionsRemaining: Math.max(0, freeSessionsRemaining),
        },

        // Expiry Data
        expiry: {
          within7Days,
          within30Days,
          renewalOpportunity,
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

        // Service Intelligence Data
        serviceIntelligence: serviceIntelligenceData,

        // Percentage Changes vs Previous Period
        percentChanges,
      },
    });
  } catch (err) {
    console.error("Error in offer-analytics:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}
