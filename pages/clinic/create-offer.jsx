import React, { useState } from 'react';
import Head from 'next/head';
import { 
  Search, Bell, ChevronDown, ArrowLeftRight, Settings,
  TrendingUp, TrendingDown, Zap
} from 'lucide-react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { CreateOfferPageBase as OffersComponent } from '../../components/offer/create-offer';
import OverviewComponent from '../../components/offer/overview';
import DateFilter from '../../components/shared/DateFilter';

function SmartOffersDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [dateFilter, setDateFilter] = useState('Today');
  
  const tabs = [
    'Overview', 'Offers', 'Create Offer', 'Usage & Performance', 
    'Liabilities', 'Rules & Controls', 'Audit Log', 'Settings'
  ];

  return (
    <div className="bg-[#FDFCFB] text-gray-800 font-sans min-h-screen">
      <Head>
        <title>Smart Offers | ZEVA</title>
      </Head>

      {/* Header */}
      <header className="border-b border-gray-200 bg-[#FDFCFB] sticky top-0 z-10 pt-4 pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-start md:items-center mb-6">
            {/* Left side: Title and subtitle */}
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl">
                Z
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Smart Offers</h1>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Control benefits. Protect margin. Increase repeat revenue.</p>
              </div>
            </div>

            {/* Right side: Controls */}
            <div className="hidden lg:flex items-center gap-3">
              <DateFilter selected={dateFilter} onChange={setDateFilter} />

              <button className="flex items-center gap-2 text-xs font-medium border border-gray-200 bg-white rounded-full px-4 py-2 hover:bg-gray-50 transition-colors">
                All branches <ChevronDown className="w-3 h-3" />
              </button>

              <button className="flex items-center gap-2 text-xs font-medium border border-gray-200 bg-white rounded-full px-4 py-2 hover:bg-gray-50 transition-colors">
                <ArrowLeftRight className="w-3 h-3" /> Compare period
              </button>

              <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                <Search className="w-4 h-4" />
              </button>

              <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 bg-white hover:bg-gray-50 transition-colors relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>

              <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-semibold text-xs flex items-center justify-center border border-orange-200">
                OA
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar border-b border-gray-100 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-emerald-600 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(activeTab === 'Offers' || activeTab === 'Create Offer') ? (
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <OffersComponent dateFilter={dateFilter} />
          </div>
        ) : activeTab === 'Overview' ? (
          <OverviewComponent dateFilter={dateFilter} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
               <Settings className="w-8 h-8 text-gray-400" />
             </div>
             <h2 className="text-lg font-bold text-gray-900 mb-2">{activeTab}</h2>
             <p className="text-gray-500 text-sm max-w-md mx-auto">This section is currently under construction. Check back later for updates to the {activeTab} module.</p>
          </div>
        )}
      </main>
      
      {/* Hide scrollbar styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}

// Wrap in layout
SmartOffersDashboard.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

const ProtectedDashboard = withClinicAuth(SmartOffersDashboard);
ProtectedDashboard.getLayout = SmartOffersDashboard.getLayout;

export default ProtectedDashboard;
