import React from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface RecentOffer {
  id: string;
  title: string;
  offerType: string;
  status: string;
  code: string | null;
  detail: string;
  discountValue: number;
  cashbackAmount: number;
  usesCount: number;
  maxUses: number | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

interface ReferralData {
  referralPatients: number;
  referralRevenue: number;
}

interface PackageMembershipData {
  activePackageCount: number;
  totalRemainingSessions: number;
  expiringSoonCount: number;
  renewalOpportunityCount: number;
  renewalOpportunityValue: number;
  membershipRenewalsDueCount: number;
  membershipRenewalValue: number;
  discount: {
    todayAvgPercent: number;
    yesterdayAvgPercent: number;
    changePercent: number;
    todayTotalDiscount: number;
    todayBillingCount: number;
    todayOfferCount: number;
    estimatedMarginImpact: number;
  };
}

interface Props {
  recentOffers?: RecentOffer[];
  referralData?: ReferralData;
  packageMembershipData?: PackageMembershipData;
}

const PackageAndOfferIntelligence = ({ recentOffers = [], referralData, packageMembershipData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  // Filter to only show active offers
  const activeOffers = (recentOffers || []).filter((offer) => offer.status === 'active');

  const referralPatients = referralData?.referralPatients || 0;
  const referralRevenue = referralData?.referralRevenue || 0;

  const activePackageCount = packageMembershipData?.activePackageCount || 0;
  const totalRemainingSessions = packageMembershipData?.totalRemainingSessions || 0;
  const expiringSoonCount = packageMembershipData?.expiringSoonCount || 0;
  const renewalOpportunityCount = packageMembershipData?.renewalOpportunityCount || 0;
  const renewalOpportunityValue = packageMembershipData?.renewalOpportunityValue || 0;
  const membershipRenewalsDueCount = packageMembershipData?.membershipRenewalsDueCount || 0;
  const membershipRenewalValue = packageMembershipData?.membershipRenewalValue || 0;

  // Discount data
  const discount = packageMembershipData?.discount;
  const todayAvgPercent = discount?.todayAvgPercent || 0;
  const yesterdayAvgPercent = discount?.yesterdayAvgPercent || 0;
  const discountChange = discount?.changePercent || 0;
  const estimatedMarginImpact = discount?.estimatedMarginImpact || 0;
  const todayBillingCount = discount?.todayBillingCount || 0;
  const todayOfferCount = discount?.todayOfferCount || 0;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  // Calculate average patient value
  const avgPatientValue = referralPatients > 0 ? referralRevenue / referralPatients : 0;

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="text-[10px] font-bold text-emerald-700 bg-[#EAF1EC] px-2 py-0.5 rounded-full">Active</span>;
      case 'draft':
        return <span className="text-[10px] font-bold text-gray-600 bg-[#F5F4F0] px-2 py-0.5 rounded-full">Draft</span>;
      case 'paused':
        return <span className="text-[10px] font-bold text-amber-700 bg-[#FFF8E7] px-2 py-0.5 rounded-full">Paused</span>;
      case 'expired':
        return <span className="text-[10px] font-bold text-red-600 bg-[#FBEBEB] px-2 py-0.5 rounded-full">Expired</span>;
      default:
        return <span className="text-[10px] font-bold text-gray-600 bg-[#F5F4F0] px-2 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="mx-8 mt-6 mb-12 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Package & Membership Intelligence */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Package & Membership Intelligence</h3>
            
            <div className="flex items-center gap-8 mb-8">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Active Packages</p>
                <p className="text-xl font-bold text-gray-900">{activePackageCount.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sessions Remaining</p>
                <p className="text-xl font-bold text-gray-900">{totalRemainingSessions.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expiring Soon</p>
                <p className="text-xl font-bold text-amber-700">{expiringSoonCount.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex flex-col mb-2">
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Renewal opportunity <span className="text-xs text-gray-400">({renewalOpportunityCount})</span></span>
                <span className="text-sm font-bold text-amber-700">{formatCurrency(renewalOpportunityValue)}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Membership renewals due</span>
                <span className="text-sm font-bold text-gray-900">{membershipRenewalsDueCount}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-600">Expected renewal value</span>
                <span className="text-sm font-bold text-amber-700">{formatCurrency(membershipRenewalValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Offers & Discount Intelligence */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Recent Offers</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              {activeOffers.length > 0 ? (
                activeOffers.map((offer, index) => (
                  <div 
                    key={offer.id} 
                    className={`rounded-xl p-5 ${index === 0 ? 'bg-[#EAF1EC]' : 'border border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-sm font-bold text-gray-900 truncate pr-2">{offer.title}</p>
                      {getStatusBadge(offer.status)}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Type</span>
                        <span className="text-xs font-bold text-gray-900 capitalize">
                          {offer.offerType === 'instant_discount' ? 'Discount' : offer.offerType === 'cashback' ? 'Cashback' : 'Bundle'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Offer</span>
                        <span className={`text-xs font-bold ${index === 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {offer.detail || 'No details'}
                        </span>
                      </div>
                      {offer.code && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Code</span>
                          <span className="text-xs font-bold text-gray-900 font-mono">{offer.code}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Uses</span>
                        <span className="text-xs font-bold text-gray-900">
                          {offer.usesCount}{offer.maxUses ? `/${offer.maxUses}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2">
                  <p className="text-sm text-gray-400 text-center py-6">No active offers</p>
                </div>
              )}
            </div>
          </div>

          {activeOffers.length > 0 && (
            <div className="bg-[#F5F4F0] rounded-lg p-4">
              <p className="text-xs text-gray-700">
                Showing <span className="font-bold">{activeOffers.length}</span> active offer{activeOffers.length !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referral Engine */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Referral Engine</h3>
            
            <div className="flex flex-col mb-6">
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Referral patients</span>
                <span className="text-sm font-bold text-gray-900">{referralPatients}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Referral revenue</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(referralRevenue)}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Avg referred patient value</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(avgPatientValue)}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-600">Total registered patients</span>
                <span className="text-sm font-bold text-gray-900">{referralPatients}</span>
              </div>
            </div>
          </div>

          {referralPatients > 0 && (
            <div className="bg-[#EAF1EC] rounded-lg p-4">
              <p className="text-xs text-gray-700">
                <span className="font-bold text-emerald-700">{referralPatients} patients</span> were referred by others — generating <span className="font-bold text-emerald-700">{formatCurrency(referralRevenue)}</span> in paid revenue.
              </p>
            </div>
          )}
        </div>

        {/* Price & Discount Intelligence */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Price & Discount Intelligence</h3>
            
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-gray-900">
                  {yesterdayAvgPercent}% → {todayAvgPercent}%
                </span>
                <span className={`text-sm font-bold ${discountChange <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  avg discount
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                {discountChange !== 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    discountChange <= 0 ? 'bg-[#EAF1EC] text-emerald-700' : 'bg-[#FBEBEB] text-red-600'
                  }`}>
                    {discountChange > 0 ? '↑' : '↓'} {Math.abs(discountChange)}%
                  </span>
                )}
                <span className="text-xs text-gray-500">vs yesterday</span>
              </div>
              <p className="text-sm text-gray-600">
                {todayBillingCount} billing{todayBillingCount !== 1 ? 's' : ''} today{todayOfferCount > 0 ? `, ${todayOfferCount} with offer applied` : ''}.
              </p>
            </div>
            
            <div className="flex justify-between items-center py-4 mb-2">
              <span className="text-sm font-medium text-gray-600">Estimated margin impact</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(estimatedMarginImpact)}</span>
            </div>
          </div>

          <div className="pt-2">
            <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors">
              Review discounting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageAndOfferIntelligence;
