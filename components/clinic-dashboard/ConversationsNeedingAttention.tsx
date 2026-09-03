import React from 'react';

const ConversationsNeedingAttention = () => {
  return (
    <div className="mx-8 mt-6 mb-12 font-sans">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lead & Communication Opportunity</h3>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Conversations Needing Attention</h2>
        
        <div className="flex items-center gap-8 mb-6">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Conversations</p>
            <p className="text-2xl font-bold text-gray-900">7</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Potential Value</p>
            <p className="text-2xl font-bold text-amber-700">AED 5,400</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Response Time</p>
            <p className="text-2xl font-bold text-amber-700">24 min</p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">High-Intent</p>
            <p className="text-2xl font-bold text-gray-900">3</p>
          </div>
        </div>

        <button className="w-full bg-[#427A5B] hover:bg-[#36664B] text-white font-semibold py-3 rounded-xl transition-colors mt-2">
          Open Inbox
        </button>
      </div>
    </div>
  );
};

export default ConversationsNeedingAttention;
