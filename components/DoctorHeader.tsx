'use client';

import React, { useState, useEffect } from 'react';

interface DoctorHeaderProps {
  handleToggleDesktop: () => void;
  handleToggleMobile: () => void;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
}

const DoctorHeader: React.FC<DoctorHeaderProps> = ({
  handleToggleDesktop,
  handleToggleMobile,
  isDesktopHidden,
  isMobileOpen
}) => {
  const [screenWidth, setScreenWidth] = useState<number | null>(null);
  const [doctorUser, setDoctorUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userData =
        localStorage.getItem('doctorUser') || sessionStorage.getItem('doctorUser');

      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed.name && parsed.email) {
            setDoctorUser(parsed);
          }
        } catch {
          // console.error('Invalid doctorUser data:', err);
        }
      }

      setScreenWidth(window.innerWidth);
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('doctorToken');
    localStorage.removeItem('doctorUser');
    sessionStorage.removeItem('doctorToken');
    sessionStorage.removeItem('doctorEmailForReset');
    window.location.href = '/doctor/login';
  };

  const handleResponsiveToggle = () => {
    if (screenWidth && screenWidth < 1024) {
      handleToggleMobile();
    } else {
      handleToggleDesktop();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Left: Toggle + Brand */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleResponsiveToggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              aria-label="Toggle sidebar"
            >
              <svg
                className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${screenWidth && screenWidth < 1024 && (isDesktopHidden || isMobileOpen) ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {screenWidth && screenWidth < 1024 ? (
                  (isDesktopHidden || isMobileOpen) ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-[#2D9AA5] to-[#1e7d87] rounded-xl flex items-center justify-center shadow-lg">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#2D9AA5] rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  ZEVA
                </h1>
                <p className="text-sm text-[#2D9AA5] font-medium -mt-1">Doctor Portal</p>
              </div>
            </div>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-gray-900">
                {doctorUser?.name || 'Doctor'}
              </div>
              <div className="text-xs text-gray-500">
                {doctorUser?.email || 'Loading...'}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2D9AA5] rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {doctorUser ? getInitials(doctorUser.name) : 'D'}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label="Logout"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DoctorHeader;