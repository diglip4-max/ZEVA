import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface OfferBillingRecord {
  invoiceNumber: string;
  invoicedDate: string;
  offerName: string;
  offerType: string;
  service: string;
  treatment: string;
  amount: number;
  paid: number;
  offerDiscountAmount: number;
  cashbackAmount: number;
  cashbackWalletUsed: number;
  patientName: string;
}

interface AttentionOfferBillingRecord {
  invoiceNumber: string;
  invoicedDate: string;
  patientName: string;
  offerName: string;
  paid: number;
}

interface OfferRequiringAttention {
  offerId: string;
  offerName: string;
  saleCount: number;
  totalPaid: number;
  billingRecords: AttentionOfferBillingRecord[];
}

interface RevenueOpportunityOffer {
  title: string;
  offerType: string;
  endsAt: string;
}

interface UnusedBundlePatient {
  patientName: string;
  emrNumber: string;
  sessionNames: string[];
}

interface UnusedCashbackPatient {
  patientName: string;
  emrNumber: string;
  cashbackAmount: number;
}

interface RevenueOpportunityData {
  expiringOffers: RevenueOpportunityOffer[];
  unusedBundlePatients: UnusedBundlePatient[];
  unusedCashbackPatients: UnusedCashbackPatient[];
}

interface OfferBillingData {
  instantDiscount: {
    count: number;
    totalPaid: number;
    totalDiscount: number;
  };
  cashback: {
    count: number;
    totalPaid: number;
    totalCashback: number;
  };
  bundle: {
    count: number;
    totalPaid: number;
    totalBundleValue: number;
  };
  totalOfferRevenue: number;
  totalOfferCount: number;
  grossRevenue: number;
  netRevenue: number;
  discountBenefit: number;
  billingRecords: OfferBillingRecord[];
}

interface LiabilityDetailRecord {
  patientName: string;
  offerName: string;
  cashbackAmount: number;
  invoicedDate?: string;
}

interface OfferLiabilityData {
  walletLiability: number;
  freeSessionLiability?: number;
  freeSessionsRemaining?: number;
  totalLiability: number;
  liabilityDetails?: LiabilityDetailRecord[];
}

interface ExpiringOffer {
  title: string;
  offerType: string;
  endsAt: string;
  discountValue?: number;
  discountMode?: string;
}

interface ExpiringCashbackDetail {
  patientName: string;
  offerName: string;
  cashbackAmount: number;
  expiryDate: string;
}

interface OfferExpiryData {
  within7Days: {
    patientCount: number;
    benefitAmount: number;
  };
  within30Days: {
    patientCount: number;
    benefitAmount: number;
  };
  renewalOpportunity: number;
  expiringCashbackDetails: ExpiringCashbackDetail[];
  expiringOffers: ExpiringOffer[];
  offersExpiring5Days: ExpiringOffer[];
  offersExpiring7Days: ExpiringOffer[];
  offersExpiring30Days: ExpiringOffer[];
}

interface OfferPerformanceData {
  eligiblePatients: number;
  offerViews: number;
  offerUses: number;
  completedVisits: number;
  repeatVisits: number;
  repeatRevenue: number;
}

interface OfferMixData {
  instantDiscount: {
    percentage: number;
    revenue: number;
  };
  bundle: {
    percentage: number;
    revenue: number;
  };
  cashback: {
    percentage: number;
    revenue: number;
  };
}

interface DiscountControlData {
  averageDiscount: number;
  allowedMaximum: number;
  marginThreshold: number;
  manualOverrides: number;
}

interface RefundMonitorData {
  totalRefunds: number;
  cashbackRefunded: number;
  cashbackWalletUsageReversed: number;
  walletReversed: number;
  freeSessionsRefunded: number;
  freeSessionsRestored: number;
  freeSessionsReversed: number;
}

interface BillingProtectionData {
  partialPaymentAttempts: number;
  refundReconciliationCount: number;
  offersCreated: number;
}

interface UsageProtectionData {
  patientLevelUsage: number;
  blockedDuplicateUsage: number;
  sameDayDuplicateAttempts: number;
  multipleInvoiceAttempts: number;
  topBlockedReason: string;
  highDiscountPatients: Array<{
    patientId: string;
    patientName: string;
    discountPercent: number;
    offerName?: string;
    offerType?: string;
  }>;
}

interface OfferStatusRecord {
  offerId: string;
  offerName: string;
  status: string;
  offerType: string;
  startsAt?: string;
  endsAt?: string;
}

interface BenefitActivationPaymentRecord {
  invoiceNumber: string;
  invoicedDate?: string;
  patientName: string;
  offerName: string;
  offerType: string;
  amount: number;
  paid: number;
  pending: number;
}

interface BenefitActivationData {
  configuredRule: string;
  attemptedBeforePayment: number;
  blocked: number;
  protectionRate: number;
  offerStatusBreakdown?: {
    draft: number;
    active: number;
    paused: number;
    expiry: number;
  };
  offersByStatusList?: {
    draft: OfferStatusRecord[];
    active: OfferStatusRecord[];
    paused: OfferStatusRecord[];
    expiry: OfferStatusRecord[];
  };
  attemptedBeforePaymentList?: BenefitActivationPaymentRecord[];
  blockedList?: BenefitActivationPaymentRecord[];
}

interface StaffUsageBillingRecord {
  patientId: string;
  patientName: string;
  offerType: string;
  offerName: string;
  amount: number;
  paid: number;
}

interface StaffUsageData {
  staffId: string;
  staffName: string;
  patientCount: number;
  totalRevenue: number;
  totalCollection: number;
  billingRecords: StaffUsageBillingRecord[];
}

interface ServiceOfferIntelligenceData {
  serviceName: string;
  offerRevenue: number;
  repeatRate: number;
}

interface PercentChangesData {
  attributedRevenue: number;
  totalBenefit: number;
  offerUsage: number;
  repeatRevenue: number;
  activeLiability: number;
  marginThreshold: number;
}

interface RecommendationData {
  discountToBundle: {
    currentDiscountPercentage: number;
    estimatedBenefitCost: number;
    recommendedBundleCost: number;
    expectedRepeatImprovement: number;
    estimatedMarginImprovement: number;
  };
  lowRetentionOffer: {
    offerName: string;
    generated: number;
    repeatRate: number;
    comparableBundleRepeatRate: number;
    hasOffer: boolean;
  };
}

interface TopPerformingOffer {
  offerId: string;
  offerName: string;
  saleCount: number;
  totalPaid: number;
  patientCount: number;
}

export interface PatientValueRecord {
  patientName: string;
  emrNumber?: string;
  invoiceNumber: string;
  invoicedDate: string;
  offerName?: string;
  offerType?: string;
  paid: number;
}

export interface PatientValueData {
  higherPercent: number;
  averageFirstTx: {
    offerUsers: number;
    offerUsersCount: number;
    offerRecords: PatientValueRecord[];
    nonOfferPatients: number;
    nonOfferPatientsCount: number;
    nonOfferRecords: PatientValueRecord[];
  };
  ninetyDayValue: {
    offerUsers: number;
    offerUsersCount: number;
    offerRecords: PatientValueRecord[];
    nonOfferPatients: number;
    nonOfferPatientsCount: number;
    nonOfferRecords: PatientValueRecord[];
  };
}

interface AllOffersStats {
  [offerId: string]: {
    totalPaid: number;
    patientCount: number;
  };
}

export function useOfferDashboard(dateFilter: string = 'Today') {
  const [loading, setLoading] = useState(true);
  const [offerBillingData, setOfferBillingData] = useState<OfferBillingData>({
    instantDiscount: { count: 0, totalPaid: 0, totalDiscount: 0 },
    cashback: { count: 0, totalPaid: 0, totalCashback: 0 },
    bundle: { count: 0, totalPaid: 0, totalBundleValue: 0 },
    totalOfferRevenue: 0,
    totalOfferCount: 0,
    grossRevenue: 0,
    netRevenue: 0,
    discountBenefit: 0,
    billingRecords: [],
  });
  const [offerLiabilityData, setOfferLiabilityData] = useState<OfferLiabilityData>({
    walletLiability: 0,
    totalLiability: 0,
  });
  const [offerExpiryData, setOfferExpiryData] = useState<OfferExpiryData>({
    within7Days: { patientCount: 0, benefitAmount: 0 },
    within30Days: { patientCount: 0, benefitAmount: 0 },
    renewalOpportunity: 0,
    expiringCashbackDetails: [],
    expiringOffers: [],
    offersExpiring5Days: [],
    offersExpiring7Days: [],
    offersExpiring30Days: [],
  });
  const [offerPerformanceData, setOfferPerformanceData] = useState<OfferPerformanceData>({
    eligiblePatients: 0,
    offerViews: 0,
    offerUses: 0,
    completedVisits: 0,
    repeatVisits: 0,
    repeatRevenue: 0,
  });
  const [offerMixData, setOfferMixData] = useState<OfferMixData>({
    instantDiscount: { percentage: 0, revenue: 0 },
    bundle: { percentage: 0, revenue: 0 },
    cashback: { percentage: 0, revenue: 0 },
  });
  const [discountControlData, setDiscountControlData] = useState<DiscountControlData>({
    averageDiscount: 0,
    allowedMaximum: 10,
    marginThreshold: 18,
    manualOverrides: 0,
  });
  const [staffUsageData, setStaffUsageData] = useState<StaffUsageData[]>([]);
  const [refundMonitorData, setRefundMonitorData] = useState<RefundMonitorData>({
    totalRefunds: 0,
    cashbackRefunded: 0,
    cashbackWalletUsageReversed: 0,
    walletReversed: 0,
    freeSessionsRefunded: 0,
    freeSessionsRestored: 0,
    freeSessionsReversed: 0,
  });
  const [billingProtectionData, setBillingProtectionData] = useState<BillingProtectionData>({
    partialPaymentAttempts: 0,
    refundReconciliationCount: 0,
    offersCreated: 0,
  });
  const [usageProtectionData, setUsageProtectionData] = useState<UsageProtectionData>({
    patientLevelUsage: 0,
    blockedDuplicateUsage: 0,
    sameDayDuplicateAttempts: 0,
    multipleInvoiceAttempts: 0,
    topBlockedReason: 'Offer already used today',
    highDiscountPatients: [],
  });
  const [benefitActivationData, setBenefitActivationData] = useState<BenefitActivationData>({
    configuredRule: 'Full payment required',
    attemptedBeforePayment: 0,
    blocked: 0,
    protectionRate: 100,
    offerStatusBreakdown: { draft: 0, active: 0, paused: 0, expiry: 0 },
    offersByStatusList: { draft: [], active: [], paused: [], expiry: [] },
    attemptedBeforePaymentList: [],
    blockedList: [],
  });
  const [serviceOfferIntelligenceData, setServiceOfferIntelligenceData] = useState<ServiceOfferIntelligenceData[]>([]);
  const [percentChanges, setPercentChanges] = useState<PercentChangesData>({
    attributedRevenue: 0,
    totalBenefit: 0,
    offerUsage: 0,
    repeatRevenue: 0,
    activeLiability: 0,
    marginThreshold: 0,
  });
  const [recommendationData, setRecommendationData] = useState<RecommendationData>({
    discountToBundle: {
      currentDiscountPercentage: 0,
      estimatedBenefitCost: 0,
      recommendedBundleCost: 0,
      expectedRepeatImprovement: 0,
      estimatedMarginImprovement: 0,
    },
    lowRetentionOffer: {
      offerName: 'No billed offer found',
      generated: 0,
      repeatRate: 0,
      comparableBundleRepeatRate: 0,
      hasOffer: false,
    },
  });
  const [topPerformingOffers, setTopPerformingOffers] = useState<TopPerformingOffer[]>([]);
  const [offersRequiringAttention, setOffersRequiringAttention] = useState<OfferRequiringAttention[]>([]);
  const [revenueOpportunityData, setRevenueOpportunityData] = useState<RevenueOpportunityData>({
    expiringOffers: [],
    unusedBundlePatients: [],
    unusedCashbackPatients: [],
  });
  const [allOffersStats, setAllOffersStats] = useState<AllOffersStats>({});
  const [patientValueData, setPatientValueData] = useState<PatientValueData>({
    higherPercent: 56,
    averageFirstTx: {
      offerUsers: 280,
      offerUsersCount: 0,
      offerRecords: [],
      nonOfferPatients: 250,
      nonOfferPatientsCount: 0,
      nonOfferRecords: [],
    },
    ninetyDayValue: {
      offerUsers: 640,
      offerUsersCount: 0,
      offerRecords: [],
      nonOfferPatients: 410,
      nonOfferPatientsCount: 0,
      nonOfferRecords: [],
    },
  });

  // Convert date filter to date range
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    // Check preset period strings
    if (dateFilter === 'Today' || !dateFilter) {
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    }

    if (dateFilter === '7 Days') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    }

    if (dateFilter === '30 Days') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    }

    if (dateFilter === 'This Month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    }

    // Check if dateFilter is a custom date (ISO string)
    try {
      const customDate = new Date(dateFilter);
      if (!isNaN(customDate.getTime())) {
        startDate.setTime(customDate.getTime());
        startDate.setHours(0, 0, 0, 0);
        endDate.setTime(customDate.getTime());
        endDate.setHours(23, 59, 59, 999);
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      }
    } catch (e) {
      console.error('Invalid custom date:', dateFilter);
    }

    // Default fallback to Today
    startDate.setHours(0, 0, 0, 0);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [dateFilter]);

  const fetchOfferData = useCallback(async () => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken')
      : null;

    if (!token) return;

    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { startDate, endDate } = getDateRange();

      // Single API call to offer-analytics
      const analyticsRes = await axios.get('/api/clinic/offer-analytics', {
        headers,
        params: { startDate, endDate },
      }).catch(() => null);

      if (analyticsRes?.data?.success && analyticsRes.data.data) {
        const data = analyticsRes.data.data;

        // Set offer billing data
        if (data.offerBilling) {
          const ob = data.offerBilling;
          setOfferBillingData({
            instantDiscount: {
              count: ob.instantDiscount?.count || 0,
              totalPaid: ob.instantDiscount?.totalRevenue || 0,
              totalDiscount: ob.instantDiscount?.totalDiscount || 0,
            },
            cashback: {
              count: ob.cashback?.count || 0,
              totalPaid: ob.cashback?.totalRevenue || 0,
              totalCashback: ob.cashback?.totalCashback || 0,
            },
            bundle: {
              count: ob.bundle?.count || 0,
              totalPaid: ob.bundle?.totalRevenue || 0,
              totalBundleValue: (ob.bundle?.totalFreeSessions || 0) * 100,
            },
            totalOfferRevenue: ob.totalOfferRevenue || 0,
            totalOfferCount: ob.totalOfferCount || 0,
            grossRevenue: ob.grossRevenue || 0,
            netRevenue: ob.netRevenue || 0,
            discountBenefit: ob.discountBenefit || 0,
            billingRecords: Array.isArray(ob.billingRecords) ? ob.billingRecords : [],
          });
        }

        // Set offer mix data
        if (data.offerMix) {
          setOfferMixData(data.offerMix);
        }

        // Set liability data
        if (data.liability) {
          setOfferLiabilityData({
            walletLiability: data.liability.walletLiability || 0,
            freeSessionLiability: data.liability.freeSessionLiability || 0,
            freeSessionsRemaining: data.liability.freeSessionsRemaining || 0,
            totalLiability: data.liability.totalLiability || 0,
            liabilityDetails: Array.isArray(data.liability.liabilityDetails) ? data.liability.liabilityDetails : [],
          });
        }

        // Set expiry data
        if (data.expiry) {
          setOfferExpiryData({
            within7Days: data.expiry.within7Days || { patientCount: 0, benefitAmount: 0 },
            within30Days: data.expiry.within30Days || { patientCount: 0, benefitAmount: 0 },
            renewalOpportunity: data.expiry.renewalOpportunity || 0,
            expiringCashbackDetails: Array.isArray(data.expiry.expiringCashbackDetails) ? data.expiry.expiringCashbackDetails : [],
            expiringOffers: Array.isArray(data.expiry.expiringOffers) ? data.expiry.expiringOffers : [],
            offersExpiring5Days: Array.isArray(data.expiry.offersExpiring5Days) ? data.expiry.offersExpiring5Days : [],
            offersExpiring7Days: Array.isArray(data.expiry.offersExpiring7Days) ? data.expiry.offersExpiring7Days : [],
            offersExpiring30Days: Array.isArray(data.expiry.offersExpiring30Days) ? data.expiry.offersExpiring30Days : [],
          });
        }

        // Set performance data
        if (data.performance) {
          setOfferPerformanceData(data.performance);
        }

        // Set discount control data
        if (data.discountControl) {
          setDiscountControlData(data.discountControl);
        }

        // Set all-time staff offer usage and the invoices behind each row.
        if (Array.isArray(data.staffUsage)) {
          setStaffUsageData(data.staffUsage.map((staff: Partial<StaffUsageData>) => ({
            staffId: staff.staffId || '',
            staffName: staff.staffName || 'Unknown',
            patientCount: staff.patientCount || 0,
            totalRevenue: staff.totalRevenue || 0,
            totalCollection: staff.totalCollection || 0,
            billingRecords: Array.isArray(staff.billingRecords) ? staff.billingRecords.map((billing: Partial<StaffUsageBillingRecord>) => ({
              patientId: billing.patientId || '',
              patientName: billing.patientName || 'Unknown patient',
              offerType: billing.offerType || '',
              offerName: billing.offerName || 'Offer',
              amount: billing.amount || 0,
              paid: billing.paid || 0,
            })) : [],
          })));
        }

        // Set refund and reversal monitor data
        if (data.refundMonitor) {
          setRefundMonitorData({
            totalRefunds: data.refundMonitor.totalRefunds || 0,
            cashbackRefunded: data.refundMonitor.cashbackRefunded || 0,
            cashbackWalletUsageReversed: data.refundMonitor.cashbackWalletUsageReversed || 0,
            walletReversed: data.refundMonitor.walletReversed || 0,
            freeSessionsRefunded: data.refundMonitor.freeSessionsRefunded || 0,
            freeSessionsRestored: data.refundMonitor.freeSessionsRestored || 0,
            freeSessionsReversed: data.refundMonitor.freeSessionsReversed || 0,
          });
        }

        // Set selected-period billing protection data
        if (data.billingProtection) {
          setBillingProtectionData({
            partialPaymentAttempts: data.billingProtection.partialPaymentAttempts || 0,
            refundReconciliationCount: data.billingProtection.refundReconciliationCount || 0,
            offersCreated: data.billingProtection.offersCreated || 0,
          });
        }

        // Set usage protection data
        if (data.usageProtection) {
          setUsageProtectionData({
            patientLevelUsage: data.usageProtection.patientLevelUsage ?? 0,
            blockedDuplicateUsage: data.usageProtection.blockedDuplicateUsage ?? 0,
            sameDayDuplicateAttempts: data.usageProtection.sameDayDuplicateAttempts ?? 0,
            multipleInvoiceAttempts: data.usageProtection.multipleInvoiceAttempts ?? 0,
            topBlockedReason: data.usageProtection.topBlockedReason || 'Offer already used today',
            highDiscountPatients: Array.isArray(data.usageProtection.highDiscountPatients)
              ? data.usageProtection.highDiscountPatients.map((p: any) => ({
                  patientId: p.patientId || p._id || '',
                  patientName: p.patientName || 'Unknown patient',
                  discountPercent: p.discountPercent ?? 0,
                  offerName: p.offerName,
                  offerType: p.offerType,
                }))
              : [],
          });
        }

        // Set benefit activation rules data
        if (data.benefitActivation) {
          const ba = data.benefitActivation;
          setBenefitActivationData({
            configuredRule: ba.configuredRule || 'Full payment required',
            attemptedBeforePayment: ba.attemptedBeforePayment ?? 0,
            blocked: ba.blocked ?? 0,
            protectionRate: ba.protectionRate ?? 100,
            offerStatusBreakdown: ba.offerStatusBreakdown || { draft: 0, active: 0, paused: 0, expiry: 0 },
            offersByStatusList: ba.offersByStatusList || { draft: [], active: [], paused: [], expiry: [] },
            attemptedBeforePaymentList: Array.isArray(ba.attemptedBeforePaymentList) ? ba.attemptedBeforePaymentList : [],
            blockedList: Array.isArray(ba.blockedList) ? ba.blockedList : [],
          });
        }

        // Set service intelligence data
        if (data.serviceIntelligence) {
          setServiceOfferIntelligenceData(data.serviceIntelligence);
        }

        // Set percent changes
        if (data.percentChanges) {
          setPercentChanges(data.percentChanges);
        }

        // Set recommendation data
        if (data.recommendations) {
          setRecommendationData({
            discountToBundle: {
              currentDiscountPercentage: data.recommendations.discountToBundle?.currentDiscountPercentage || 0,
              estimatedBenefitCost: data.recommendations.discountToBundle?.estimatedBenefitCost || 0,
              recommendedBundleCost: data.recommendations.discountToBundle?.recommendedBundleCost || 0,
              expectedRepeatImprovement: data.recommendations.discountToBundle?.expectedRepeatImprovement || 0,
              estimatedMarginImprovement: data.recommendations.discountToBundle?.estimatedMarginImprovement || 0,
            },
            lowRetentionOffer: {
              offerName: data.recommendations.lowRetentionOffer?.offerName || 'No billed offer found',
              generated: data.recommendations.lowRetentionOffer?.generated || 0,
              repeatRate: data.recommendations.lowRetentionOffer?.repeatRate || 0,
              comparableBundleRepeatRate: data.recommendations.lowRetentionOffer?.comparableBundleRepeatRate || 0,
              hasOffer: Boolean(data.recommendations.lowRetentionOffer?.hasOffer),
            },
          });
        }

        if (Array.isArray(data.topPerformingOffers)) {
          setTopPerformingOffers(data.topPerformingOffers.map((offer: Partial<TopPerformingOffer>) => ({
            offerId: offer.offerId || '',
            offerName: offer.offerName || 'Deleted offer',
            saleCount: offer.saleCount || 0,
            totalPaid: offer.totalPaid || 0,
          })));
        }

        if (Array.isArray(data.offersRequiringAttention)) {
          setOffersRequiringAttention(data.offersRequiringAttention.map((offer: Partial<OfferRequiringAttention>) => ({
            offerId: offer.offerId || '',
            offerName: offer.offerName || 'Deleted offer',
            saleCount: offer.saleCount || 0,
            totalPaid: offer.totalPaid || 0,
            billingRecords: Array.isArray(offer.billingRecords) ? offer.billingRecords.map((billing: Partial<AttentionOfferBillingRecord>) => ({
              invoiceNumber: billing.invoiceNumber || '',
              invoicedDate: billing.invoicedDate || '',
              patientName: billing.patientName || 'Unknown patient',
              offerName: billing.offerName || offer.offerName || 'Deleted offer',
              paid: billing.paid || 0,
            })) : [],
          })));
        }

        if (data.revenueOpportunities) {
          setRevenueOpportunityData({
            expiringOffers: Array.isArray(data.revenueOpportunities.expiringOffers) ? data.revenueOpportunities.expiringOffers : [],
            unusedBundlePatients: Array.isArray(data.revenueOpportunities.unusedBundlePatients) ? data.revenueOpportunities.unusedBundlePatients : [],
            unusedCashbackPatients: Array.isArray(data.revenueOpportunities.unusedCashbackPatients) ? data.revenueOpportunities.unusedCashbackPatients : [],
          });
        }

        if (data.allOffersStats) {
          setAllOffersStats(data.allOffersStats);
        }

        if (data.patientValue) {
          setPatientValueData({
            higherPercent: data.patientValue.higherPercent || 56,
            averageFirstTx: {
              offerUsers: data.patientValue.averageFirstTx?.offerUsers || 280,
              offerUsersCount: data.patientValue.averageFirstTx?.offerUsersCount || 0,
              offerRecords: Array.isArray(data.patientValue.averageFirstTx?.offerRecords) ? data.patientValue.averageFirstTx.offerRecords : [],
              nonOfferPatients: data.patientValue.averageFirstTx?.nonOfferPatients || 250,
              nonOfferPatientsCount: data.patientValue.averageFirstTx?.nonOfferPatientsCount || 0,
              nonOfferRecords: Array.isArray(data.patientValue.averageFirstTx?.nonOfferRecords) ? data.patientValue.averageFirstTx.nonOfferRecords : [],
            },
            ninetyDayValue: {
              offerUsers: data.patientValue.ninetyDayValue?.offerUsers || 640,
              offerUsersCount: data.patientValue.ninetyDayValue?.offerUsersCount || 0,
              offerRecords: Array.isArray(data.patientValue.ninetyDayValue?.offerRecords) ? data.patientValue.ninetyDayValue.offerRecords : [],
              nonOfferPatients: data.patientValue.ninetyDayValue?.nonOfferPatients || 410,
              nonOfferPatientsCount: data.patientValue.ninetyDayValue?.nonOfferPatientsCount || 0,
              nonOfferRecords: Array.isArray(data.patientValue.ninetyDayValue?.nonOfferRecords) ? data.patientValue.ninetyDayValue.nonOfferRecords : [],
            },
          });
        }
      }

    } catch (err) {
      console.error('Error fetching offer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchOfferData();
  }, [fetchOfferData]);

  return {
    loading,
    offerBillingData,
    offerLiabilityData,
    offerExpiryData,
    offerPerformanceData,
    offerMixData,
    discountControlData,
    staffUsageData,
    refundMonitorData,
    billingProtectionData,
    usageProtectionData,
    benefitActivationData,
    serviceOfferIntelligenceData,
    percentChanges,
    recommendationData,
    topPerformingOffers,
    offersRequiringAttention,
    revenueOpportunityData,
    allOffersStats,
    patientValueData,
    refreshData: fetchOfferData,
  };
}
