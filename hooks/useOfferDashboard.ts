import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
}

interface OfferLiabilityData {
  freeSessionLiability: number;
  walletLiability: number;
  totalLiability: number;
  freeSessionsRemaining: number;
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

interface StaffUsageData {
  staffId: string;
  staffName: string;
  offers: number;
  avgBenefit: number;
  overrides: number;
  status: 'Low' | 'Needs review';
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

export function useOfferDashboard(dateFilter: string = 'Today') {
  const [loading, setLoading] = useState(true);
  const [offerBillingData, setOfferBillingData] = useState<OfferBillingData>({
    instantDiscount: { count: 0, totalPaid: 0, totalDiscount: 0 },
    cashback: { count: 0, totalPaid: 0, totalCashback: 0 },
    bundle: { count: 0, totalPaid: 0, totalBundleValue: 0 },
    totalOfferRevenue: 0,
    totalOfferCount: 0,
  });
  const [offerLiabilityData, setOfferLiabilityData] = useState<OfferLiabilityData>({
    freeSessionLiability: 0,
    walletLiability: 0,
    totalLiability: 0,
    freeSessionsRemaining: 0,
  });
  const [offerExpiryData, setOfferExpiryData] = useState<OfferExpiryData>({
    within7Days: { patientCount: 0, benefitAmount: 0 },
    within30Days: { patientCount: 0, benefitAmount: 0 },
    renewalOpportunity: 0,
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
  const [serviceOfferIntelligenceData, setServiceOfferIntelligenceData] = useState<ServiceOfferIntelligenceData[]>([]);
  const [percentChanges, setPercentChanges] = useState<PercentChangesData>({
    attributedRevenue: 0,
    totalBenefit: 0,
    offerUsage: 0,
    repeatRevenue: 0,
    activeLiability: 0,
    marginThreshold: 0,
  });

  // Convert date filter to date range
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    // Check if dateFilter is a custom date (ISO string)
    if (dateFilter && dateFilter !== 'Today') {
      try {
        const customDate = new Date(dateFilter);
        if (!isNaN(customDate.getTime())) {
          // Set start of day
          startDate.setTime(customDate.getTime());
          startDate.setHours(0, 0, 0, 0);
          // Set end of day
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
    }

    // Default to Today
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
          });
        }

        // Set offer mix data
        if (data.offerMix) {
          setOfferMixData(data.offerMix);
        }

        // Set liability data
        if (data.liability) {
          setOfferLiabilityData(data.liability);
        }

        // Set expiry data
        if (data.expiry) {
          setOfferExpiryData(data.expiry);
        }

        // Set performance data
        if (data.performance) {
          setOfferPerformanceData(data.performance);
        }

        // Set discount control data
        if (data.discountControl) {
          setDiscountControlData(data.discountControl);
        }

        // Set staff usage data
        if (data.staffUsage) {
          setStaffUsageData(data.staffUsage);
        }

        // Set service intelligence data
        if (data.serviceIntelligence) {
          setServiceOfferIntelligenceData(data.serviceIntelligence);
        }

        // Set percent changes
        if (data.percentChanges) {
          setPercentChanges(data.percentChanges);
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
    serviceOfferIntelligenceData,
    percentChanges,
    refreshData: fetchOfferData,
  };
}
