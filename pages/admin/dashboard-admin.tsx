import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import withAdminAuth from '../../components/withAdminAuth';
import type { NextPageWithLayout } from '../_app';
import {
  XCircleIcon,
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Update date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);


  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getGreeting = () => {
    const hour = currentDateTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };



  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {getGreeting()}, Admin!
              </h1>
              <p className="text-gray-700 mb-4">
                Welcome back to your dashboard. Here's what's happening today.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(currentDateTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatTime(currentDateTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

AdminDashboard.getLayout = function PageLayout(page: React.ReactNode) {
  return <AdminLayout>{page}</AdminLayout>;
};

const ProtectedDashboard: NextPageWithLayout = withAdminAuth(AdminDashboard);
ProtectedDashboard.getLayout = AdminDashboard.getLayout;

export default ProtectedDashboard;
