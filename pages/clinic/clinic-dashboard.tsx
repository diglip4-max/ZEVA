import React, { useState } from 'react';
import Head from 'next/head';
import { useClinicDashboard } from '../../hooks/useClinicDashboard';
import DashboardGreeting from '../../components/clinic-dashboard/DashboardGreeting';
import WhatNeedsYourAttention from '../../components/clinic-dashboard/WhatNeedsYourAttention';
import DashboardInsights from '../../components/clinic-dashboard/DashboardInsights';
import DashboardRecommendations from '../../components/clinic-dashboard/DashboardRecommendations';
import ClinicCapacity from '../../components/clinic-dashboard/ClinicCapacity';
import BusinessIntelligence from '../../components/clinic-dashboard/BusinessIntelligence';
import RevenueLeakageAndFunnel from '../../components/clinic-dashboard/RevenueLeakageAndFunnel';
import PatientGrowthAndReactivation from '../../components/clinic-dashboard/PatientGrowthAndReactivation';
import AcquisitionFunnel from '../../components/clinic-dashboard/AcquisitionFunnel';
import ConversationsNeedingAttention from '../../components/clinic-dashboard/ConversationsNeedingAttention';
import StaffAndResourceIntelligence from '../../components/clinic-dashboard/StaffAndResourceIntelligence';
import PackageAndOfferIntelligence from '../../components/clinic-dashboard/PackageAndOfferIntelligence';
import ControlAndExceptions from '../../components/clinic-dashboard/ControlAndExceptions';
import ZevaIntelligence from '../../components/clinic-dashboard/ZevaIntelligence';
import StrategicInsights from '../../components/clinic-dashboard/StrategicInsights';
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import type { NextPageWithLayout } from "../_app";

const ClinicDashboard: NextPageWithLayout = () => {
  const today = new Date().toISOString().split('T')[0];
  // Date-range filter: both sides default to today (single-day behaviour).
  // Invariant kept here: "From" never exceeds "To".
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // If the new "From" is after the current "To", push "To" forward to keep the range valid.
    if (value && endDate && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    // If the new "To" is before the current "From", pull "From" back to keep the range valid.
    if (value && startDate && value < startDate) {
      setStartDate(value);
    }
  };

  const { clinicInfo, revenueData, opportunityData, priorityData, revenueAtRiskData, outstandingBalanceData, winBackData, tomorrowBusinessData, clinicCapacityData, liveClinicData, businessIntelligenceData, patientRetentionData, staffIntelligenceData, recentOffers, referralData, revenueLeakageData, packageMembershipData, controlExceptionsData, zevaIntelligenceData, recommendationData } = useClinicDashboard(startDate, endDate);

  return (
    <>
      <Head>
        <title>Clinic Dashboard - ZEVA</title>
      </Head>
      <div className="min-h-screen bg-[#FCFBF8] dark:bg-bg-page">
        <DashboardGreeting
          clinicInfo={clinicInfo}
          revenueData={revenueData}
          opportunityData={opportunityData}
          revenueAtRiskData={revenueAtRiskData}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
        />
        <WhatNeedsYourAttention priorityData={priorityData} outstandingBalanceData={outstandingBalanceData} />
        <DashboardInsights priorityData={priorityData} winBackData={winBackData} tomorrowBusinessData={tomorrowBusinessData} />
        <DashboardRecommendations businessIntelligenceData={businessIntelligenceData} recommendationData={recommendationData} />
        <ClinicCapacity clinicCapacityData={clinicCapacityData} opportunityData={opportunityData} liveClinicData={liveClinicData} />
        <BusinessIntelligence businessIntelligenceData={businessIntelligenceData} revenueData={revenueData} />
        <RevenueLeakageAndFunnel revenueLeakageData={revenueLeakageData} />
        <PatientGrowthAndReactivation patientRetentionData={patientRetentionData} />
        <AcquisitionFunnel />
        <ConversationsNeedingAttention />
        <StaffAndResourceIntelligence staffIntelligenceData={staffIntelligenceData} />
        <PackageAndOfferIntelligence recentOffers={recentOffers} referralData={referralData} packageMembershipData={packageMembershipData} />
        <ControlAndExceptions controlExceptionsData={controlExceptionsData} />
        <ZevaIntelligence zevaIntelligenceData={zevaIntelligenceData} />
        <StrategicInsights />
      </div>
    </>
  );
};

ClinicDashboard.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedDashboard: NextPageWithLayout = withClinicAuth(ClinicDashboard);

ProtectedDashboard.getLayout = ClinicDashboard.getLayout;
export default ProtectedDashboard;
