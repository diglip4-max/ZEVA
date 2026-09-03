import React from 'react';

const StrategicInsights = () => {
  return (
    <div className="mx-8 mt-6 mb-12 font-sans">
      <div className="flex flex-col gap-6">
        {/* Your Biggest Revenue Levers */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-6">Your Biggest Revenue Levers</h3>
          
          <div className="w-full">
            {/* Header */}
            <div className="grid grid-cols-12 pb-4 border-b border-gray-100">
              <div className="col-span-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lever</div>
              <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current</div>
              <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Potential</div>
            </div>

            {/* Rows */}
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100">
              <div className="col-span-6 text-sm font-bold text-gray-900">Repeat visits</div>
              <div className="col-span-3 text-sm text-gray-700">43%</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 11K</div>
            </div>
            
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100 bg-[#FAF6EA] -mx-6 px-6">
              <div className="col-span-6 text-sm font-bold text-gray-900">Fill unused capacity</div>
              <div className="col-span-3 text-sm text-gray-700">72%</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 12K</div>
            </div>
            
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100">
              <div className="col-span-6 text-sm font-bold text-gray-900">Reactivate patients</div>
              <div className="col-span-3 text-sm text-gray-700">—</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 9K</div>
            </div>
            
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100">
              <div className="col-span-6 text-sm font-bold text-gray-900">Package renewals</div>
              <div className="col-span-3 text-sm text-gray-700">58%</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 6K</div>
            </div>
            
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100">
              <div className="col-span-6 text-sm font-bold text-gray-900">Recover cancellations</div>
              <div className="col-span-3 text-sm text-gray-700">61%</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 5K</div>
            </div>
            
            <div className="grid grid-cols-12 items-center py-4 border-b border-gray-100">
              <div className="col-span-6 text-sm font-bold text-gray-900">Payment leakage</div>
              <div className="col-span-3 text-sm text-gray-700">—</div>
              <div className="col-span-3 text-sm font-bold text-amber-700">+AED 4K</div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-6">
              <span className="text-sm text-gray-500">Total identified opportunity</span>
              <span className="text-xl font-bold text-amber-700">AED 47K / month</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Benchmarking */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Benchmarking</h3>
            <p className="text-xs text-gray-500 mb-8">Anonymized comparable clinics</p>
            
            <div className="flex flex-col gap-6">
              {/* Utilization */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-900 w-24">Utilization</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-full h-2 relative">
                  <div className="bg-[#427A5B] h-full rounded-full" style={{ width: '71%' }}></div>
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400" style={{ left: '78%' }}></div>
                </div>
                <div className="flex gap-3 w-32 justify-end">
                  <span className="text-[11px] font-bold text-[#427A5B]">You 71%</span>
                  <span className="text-[11px] font-bold text-gray-500">Peers 78%</span>
                </div>
              </div>
              
              {/* Repeat rate */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-900 w-24">Repeat rate</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-full h-2 relative">
                  <div className="bg-[#427A5B] h-full rounded-full" style={{ width: '43%' }}></div>
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400" style={{ left: '51%' }}></div>
                </div>
                <div className="flex gap-3 w-32 justify-end">
                  <span className="text-[11px] font-bold text-[#427A5B]">You 43%</span>
                  <span className="text-[11px] font-bold text-gray-500">Peers 51%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expansion Readiness */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Expansion Readiness</h3>
              
              <div className="flex items-start gap-6 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Utilization</p>
                  <p className="text-xl font-bold text-gray-900">87%</p>
                </div>
                <div className="h-8 w-px bg-gray-200 mt-1"></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Demand Exceeding Capacity</p>
                  <p className="text-xl font-bold text-gray-900">18%</p>
                </div>
                <div className="h-8 w-px bg-gray-200 mt-1"></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Room Utilization</p>
                  <p className="text-xl font-bold text-gray-900">91%</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Revenue Growth</p>
                <p className="text-xl font-bold text-gray-900">19%</p>
              </div>
            </div>

            <div className="bg-[#FAF6EA] rounded-lg p-4">
              <p className="text-sm font-bold text-amber-900">
                Your clinic is approaching capacity. Expansion may be worth evaluating.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategicInsights;
