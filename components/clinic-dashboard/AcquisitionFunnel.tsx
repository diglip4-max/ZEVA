import React from 'react';

const AcquisitionFunnel = () => {
  return (
    <div className="mx-8 mt-6 font-sans">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Marketing → Revenue</h3>
        <h2 className="text-xl font-bold text-gray-900 mb-8">Acquisition Funnel</h2>
        
        {/* Top Stats Row */}
        <div className="flex flex-wrap items-center justify-between mb-8 pb-8 border-b border-gray-100 px-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">AED 16K</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Spend</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">340</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Leads</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">162</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bookings</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">131</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visits</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">AED 51K</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revenue</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 mb-1">AED 19K</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Repeat Revenue</p>
          </div>
        </div>

        {/* Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Google */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
              <h4 className="text-base font-bold text-gray-900">Google</h4>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Spend</span>
                <span className="text-sm font-bold text-gray-900">AED 8K</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Leads</span>
                <span className="text-sm font-bold text-gray-900">120</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Patients</span>
                <span className="text-sm font-bold text-gray-900">48</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Revenue</span>
                <span className="text-sm font-bold text-gray-900">AED 32K</span>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
              <h4 className="text-base font-bold text-gray-900">Meta</h4>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Spend</span>
                <span className="text-sm font-bold text-gray-900">AED 8K</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Leads</span>
                <span className="text-sm font-bold text-gray-900">220</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Patients</span>
                <span className="text-sm font-bold text-gray-900">37</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Revenue</span>
                <span className="text-sm font-bold text-gray-900">AED 19K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insight Alert */}
        <div className="bg-[#EAF1EC] rounded-xl p-4 flex gap-3 mb-6 items-center">
          <div className="text-emerald-700 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-sm font-bold text-emerald-900">
            Google currently produces higher-value patients despite generating fewer leads.
          </p>
        </div>

        <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors">
          View acquisition performance
        </button>
      </div>
    </div>
  );
};

export default AcquisitionFunnel;
