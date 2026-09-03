import React, { useState } from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface PatientDetail {
  patientName: string;
  patientType?: string;
  phone?: string;
  registeredDate?: string;
  appointmentCount?: number;
  totalRevenue?: number;
}

interface Props {
  patientRetentionData?: {
    newPatients: number;
    returningPatients: number;
    repeatVisitRate: number;
    inactivePatients: number;
    highValuePatients: number;
    avgPatientLTV: number;
    newPatientDetails: PatientDetail[];
    inactivePatientDetails: PatientDetail[];
    highValuePatientDetails: PatientDetail[];
  };
}

const PatientGrowthAndReactivation = ({ patientRetentionData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [showReactivationModal, setShowReactivationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'inactive' | 'highvalue'>('new');

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const newPatients = patientRetentionData?.newPatients || 0;
  const returningPatients = patientRetentionData?.returningPatients || 0;
  const repeatVisitRate = patientRetentionData?.repeatVisitRate || 0;
  const inactivePatients = patientRetentionData?.inactivePatients || 0;
  const highValuePatients = patientRetentionData?.highValuePatients || 0;
  const avgPatientLTV = patientRetentionData?.avgPatientLTV || 0;
  const newPatientDetails = patientRetentionData?.newPatientDetails || [];
  const inactivePatientDetails = patientRetentionData?.inactivePatientDetails || [];
  const highValuePatientDetails = patientRetentionData?.highValuePatientDetails || [];

  // Calculate retention rate: returning / (new + returning)
  const totalPatients = newPatients + returningPatients;
  const retentionRate = totalPatients > 0
    ? Math.round((returningPatients / totalPatients) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 mt-6 mb-12 font-sans">
      {/* Patient Retention */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Patient Growth</h3>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Patient Retention</h2>
          
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-gray-900">{retentionRate}%</span>
          </div>
          
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            <span className="font-bold text-gray-900">{inactivePatients} patients</span> are registered but haven't booked any appointments yet.
          </p>
          
          <div className="flex flex-col mb-8">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">New patients</span>
              <span className="text-sm font-bold text-gray-900">{newPatients}</span>
            </div>
            {/* <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Returning patients</span>
              <span className="text-sm font-bold text-gray-900">{returningPatients}</span>
            </div> */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Repeat visit rate</span>
              <span className="text-sm font-bold text-gray-900">{repeatVisitRate}%</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Inactive patients</span>
              <span className="text-sm font-bold text-gray-900">{inactivePatients}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">High-value patients</span>
              <span className="text-sm font-bold text-gray-900">{highValuePatients}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-medium text-gray-600">Average patient LTV</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(avgPatientLTV)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => { setShowReactivationModal(true); setActiveTab('new'); }}
          className="w-full bg-[#427A5B] hover:bg-[#36664B] text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Start reactivation
        </button>
      </div>

      {/* Patients Ready to Return */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reactivation Engine</h3>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Patients Ready to Return</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#EBF1ED] rounded-xl p-5">
              <span className="block text-3xl font-bold text-gray-900 mb-1">{Math.ceil(inactivePatients * 0.4)}</span>
              <span className="block text-xs font-medium text-gray-500 mb-3">High probability</span>
              <span className="block text-sm font-bold text-amber-700">{formatCurrency(Math.ceil(inactivePatients * 0.4 * avgPatientLTV * 0.5))} potential</span>
            </div>
            
            <div className="bg-[#F5F4F0] rounded-xl p-5">
              <span className="block text-3xl font-bold text-gray-900 mb-1">{Math.ceil(inactivePatients * 0.6)}</span>
              <span className="block text-xs font-medium text-gray-500 mb-3">Medium probability</span>
              <span className="block text-sm font-bold text-amber-700">{formatCurrency(Math.ceil(inactivePatients * 0.6 * avgPatientLTV * 0.3))} potential</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-500">
            Connects directly to CRM, WhatsApp, automation and offers.
          </p>
        </div>

        <button className="w-full bg-[#427A5B] hover:bg-[#36664B] text-white font-semibold py-3 rounded-xl transition-colors mt-6">
          Launch reactivation
        </button>
      </div>

      {/* Reactivation Modal */}
      {showReactivationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 z-0" onClick={() => setShowReactivationModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl max-h-[85vh] flex flex-col z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Patient Reactivation Dashboard</h2>
                <p className="text-xs text-gray-400 mt-0.5">Overview of patient growth and reactivation targets</p>
              </div>
              <button
                onClick={() => setShowReactivationModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-gray-100">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <span className="block text-xl font-bold text-gray-900">{newPatients}</span>
                <span className="block text-[10px] font-medium text-gray-500">New patients</span>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <span className="block text-xl font-bold text-gray-900">{repeatVisitRate}%</span>
                <span className="block text-[10px] font-medium text-gray-500">Repeat visit rate</span>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <span className="block text-xl font-bold text-gray-900">{inactivePatients}</span>
                <span className="block text-[10px] font-medium text-gray-500">Inactive patients</span>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <span className="block text-xl font-bold text-gray-900">{highValuePatients}</span>
                <span className="block text-[10px] font-medium text-gray-500">High-value patients</span>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <span className="block text-xl font-bold text-gray-900">{formatCurrency(avgPatientLTV)}</span>
                <span className="block text-[10px] font-medium text-gray-500">Avg patient LTV</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              <button
                onClick={() => setActiveTab('new')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'new'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                New Patients
                <span className="ml-2 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">{newPatients}</span>
              </button>
              <button
                onClick={() => setActiveTab('inactive')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'inactive'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Inactive Patients
                <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-bold rounded-full">{inactivePatients}</span>
              </button>
              <button
                onClick={() => setActiveTab('highvalue')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'highvalue'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                High-Value Patients
                <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full">{highValuePatients}</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {activeTab === 'new' && (
                <PatientTable
                  data={newPatientDetails}
                  emptyMessage="No new patients registered on this date"
                />
              )}
              {activeTab === 'inactive' && (
                <PatientTable
                  data={inactivePatientDetails}
                  emptyMessage="No inactive patients found"
                />
              )}
              {activeTab === 'highvalue' && (
                <HighValueTable
                  data={highValuePatientDetails}
                  formatCurrency={formatCurrency}
                  emptyMessage="No high-value patients found"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for patient table (new & inactive)
const PatientTable = ({
  data,
  emptyMessage,
}: {
  data: PatientDetail[];
  emptyMessage: string;
}) => {
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
          <th className="pb-3 pr-4">#</th>
          <th className="pb-3 pr-4">Patient Name</th>
          <th className="pb-3">Registered Date</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <td className="py-3 pr-4 text-gray-400 text-xs">{idx + 1}</td>
            <td className="py-3 pr-4 font-medium text-gray-800">{item.patientName}</td>
            <td className="py-3 text-gray-600">{item.registeredDate || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Sub-component for high-value patient table
const HighValueTable = ({
  data,
  formatCurrency,
  emptyMessage,
}: {
  data: PatientDetail[];
  formatCurrency: (amount: number) => string;
  emptyMessage: string;
}) => {
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
          <th className="pb-3 pr-4">#</th>
          <th className="pb-3 pr-4">Patient Name</th>
          <th className="pb-3 pr-4 text-center">Appointments</th>
          <th className="pb-3 text-right">Total Revenue</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <td className="py-3 pr-4 text-gray-400 text-xs">{idx + 1}</td>
            <td className="py-3 pr-4 font-medium text-gray-800">{item.patientName}</td>
            <td className="py-3 pr-4 text-center">
              <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700">
                {item.appointmentCount || 0}
              </span>
            </td>
            <td className="py-3 text-right font-medium text-green-600">{formatCurrency(item.totalRevenue || 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PatientGrowthAndReactivation;
