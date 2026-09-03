import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface JourneyDetail {
  patientName: string;
  treatment: string;
  status: string;
  paid: number;
  amount: number;
  pending: number;
}

interface ExpiredStockItem {
  name: string;
  expiryDate: string;
  quantity: number;
}

interface Props {
  controlExceptionsData?: {
    collectedRevenue: number;
    outstandingAmount: number;
    incompleteJourneys: number;
    pendingDischarge: number;
    billingIncomplete: number;
    incompleteJourneyDetails: JourneyDetail[];
    pendingDischargeDetails: JourneyDetail[];
    billingIncompleteDetails: JourneyDetail[];
    criticalItems: number;
    belowReorderLevel: number;
    highCostItems: number;
    expiredStockDetails: ExpiredStockItem[];
    expensesAmount: number;
    payableWithin7Days: number;
  };
}

const ControlAndExceptions = ({ controlExceptionsData }: Props) => {
  const router = useRouter();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'incomplete' | 'discharge' | 'billing'>('incomplete');

  const collectedRevenue = controlExceptionsData?.collectedRevenue || 0;
  const outstandingAmount = controlExceptionsData?.outstandingAmount || 0;
  const incompleteJourneys = controlExceptionsData?.incompleteJourneys || 0;
  const pendingDischarge = controlExceptionsData?.pendingDischarge || 0;
  const billingIncomplete = controlExceptionsData?.billingIncomplete || 0;
  const incompleteJourneyDetails = controlExceptionsData?.incompleteJourneyDetails || [];
  const pendingDischargeDetails = controlExceptionsData?.pendingDischargeDetails || [];
  const billingIncompleteDetails = controlExceptionsData?.billingIncompleteDetails || [];
  const criticalItems = controlExceptionsData?.criticalItems || 0;
  const belowReorderLevel = controlExceptionsData?.belowReorderLevel || 0;
  const highCostItems = controlExceptionsData?.highCostItems || 0;
  const expiredStockDetails = controlExceptionsData?.expiredStockDetails || [];
  const expensesAmount = controlExceptionsData?.expensesAmount || 0;
  const payableWithin7Days = controlExceptionsData?.payableWithin7Days || 0;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="mx-8 mt-12 mb-12 font-sans">
      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider whitespace-nowrap">Control & Exceptions</h3>
        <div className="h-px bg-gray-200 w-full"></div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Finance & Cash Control */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Finance & Cash Control</h3>
            
            <div className="flex flex-col mb-6">
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Collected revenue</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(collectedRevenue)}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Outstanding</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(outstandingAmount)}</span>
              </div>
              {/* <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Overdue</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(4100)}</span>
              </div> */}
              {/* <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Refunds</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(1200)}</span>
              </div> */}
              <div className="flex justify-between items-center py-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Expenses (period)</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(expensesAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-medium text-gray-600">Payable within 7 days</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(payableWithin7Days)}</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() => router.push('/clinic/finance-management?view=billsPayable')}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors"
            >
              Review payables
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Alerts */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Inventory Alerts</h3>
              
              <div className="flex flex-col mb-6">
                <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Critical items</span>
                  <span className="text-sm font-bold text-red-600">{criticalItems}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Below reorder level</span>
                  <span className="text-sm font-bold text-red-600">{belowReorderLevel}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">High-cost items — unusual usage</span>
                  <span className="text-sm font-bold text-red-600">{highCostItems}</span>
                </div>
                {/* <div className="flex justify-between items-center py-4">
                  <span className="text-sm font-medium text-gray-600">Services at operational risk</span>
                  <span className="text-sm font-bold text-gray-900">2</span>
                </div> */}
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowInventoryModal(true)}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors"
              >
                Review inventory
              </button>
            </div>
          </div>

          {/* Patient Journey Exceptions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Patient Journey Exceptions</h3>
              
              <div className="flex flex-col mb-6">
                <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Incomplete journeys</span>
                  <span className="text-sm font-bold text-red-600">{incompleteJourneys}</span>
                </div>
                {/* <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Missing required documentation</span>
                  <span className="text-sm font-bold text-gray-900">2</span>
                </div> */}
                <div className="flex justify-between items-center py-4 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Pending discharge</span>
                  <span className="text-sm font-bold text-gray-900">{pendingDischarge}</span>
                </div>
                <div className="flex justify-between items-center py-4">
                  <span className="text-sm font-medium text-gray-600">Billing incomplete</span>
                  <span className="text-sm font-bold text-gray-900">{billingIncomplete}</span>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => { setShowReviewModal(true); setActiveTab('incomplete'); }}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 z-0" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl max-h-[85vh] flex flex-col z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Patient Journey Exceptions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Detailed view of incomplete patient journeys</p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              <button
                onClick={() => setActiveTab('incomplete')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'incomplete'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Incomplete Journeys
                <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-bold rounded-full">{incompleteJourneys}</span>
              </button>
              <button
                onClick={() => setActiveTab('discharge')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'discharge'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Pending Discharge
                <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full">{pendingDischarge}</span>
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'billing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Billing Incomplete
                <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">{billingIncomplete}</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {activeTab === 'incomplete' && (
                <JourneyTable
                  data={incompleteJourneyDetails}
                  formatCurrency={formatCurrency}
                  emptyMessage="All journeys are complete"
                  highlightColor="red"
                />
              )}
              {activeTab === 'discharge' && (
                <JourneyTable
                  data={pendingDischargeDetails}
                  formatCurrency={formatCurrency}
                  emptyMessage="All patients have been discharged"
                  highlightColor="amber"
                />
              )}
              {activeTab === 'billing' && (
                <JourneyTable
                  data={billingIncompleteDetails}
                  formatCurrency={formatCurrency}
                  emptyMessage="All billings are complete"
                  highlightColor="blue"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 z-0" onClick={() => setShowInventoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl max-h-[85vh] flex flex-col z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Inventory Alerts</h2>
                <p className="text-xs text-gray-400 mt-0.5">Expired stock items with details</p>
              </div>
              <button
                onClick={() => setShowInventoryModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary Row */}
            <div className="flex gap-6 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-red-600">{criticalItems}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Critical items</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-red-600">{belowReorderLevel}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Below reorder level</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-red-600">{highCostItems}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">High-cost items</span>
              </div>
            </div>

            {/* Stock Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {expiredStockDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium">No expired stock items found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Stock Name</th>
                      <th className="pb-3 pr-4">Expiry Date</th>
                      <th className="pb-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredStockDetails.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4 text-gray-400">{idx + 1}</td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-800">{item.name}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700">
                            {item.expiryDate}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-gray-700">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for the journey table
const JourneyTable = ({
  data,
  formatCurrency,
  emptyMessage,
  highlightColor,
}: {
  data: JourneyDetail[];
  formatCurrency: (amount: number) => string;
  emptyMessage: string;
  highlightColor: 'red' | 'amber' | 'blue';
}) => {
  const colorMap = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
          <th className="pb-3 pr-4">Patient Name</th>
          <th className="pb-3 pr-4">Treatment</th>
          <th className="pb-3 pr-4">Appointment Status</th>
          <th className="pb-3 pr-4 text-right">Amount</th>
          <th className="pb-3 pr-4 text-right">Paid</th>
          <th className="pb-3 text-right">Pending</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <td className="py-3 pr-4">
              <span className="font-medium text-gray-800">{item.patientName}</span>
            </td>
            <td className="py-3 pr-4 text-gray-600">{item.treatment || '—'}</td>
            <td className="py-3 pr-4">
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${colorMap[highlightColor]}`}>
                {item.status}
              </span>
            </td>
            <td className="py-3 pr-4 text-right font-medium text-gray-700">{formatCurrency(item.amount)}</td>
            <td className="py-3 pr-4 text-right font-medium text-green-600">{formatCurrency(item.paid)}</td>
            <td className="py-3 text-right font-medium text-red-600">{item.pending > 0 ? formatCurrency(item.pending) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ControlAndExceptions;
