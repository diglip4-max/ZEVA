import React, { useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import { useClinicTheme } from '../context/ClinicThemeContext';

const AdminHeader = () => {
  const { theme, toggleTheme } = useClinicTheme();
  let storedUser = {};
  const token = localStorage.getItem('userToken');

  if (token) {
    try {
      storedUser = jwtDecode(token);
    } catch (err) {
      console.error("Invalid token", err);
      storedUser = {};
    }
  }

  const email = storedUser.email;

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => { });
      }
    } finally {
      localStorage.removeItem('userToken');
      window.location.href = '/staff';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'A';
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
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-5 h-5 text-gray-600 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
                <p className="text-sm text-[#2D9AA5] font-medium -mt-1">Staff Panel</p>
              </div>
            </div>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-gray-900">
                {storedUser.name || 'Staff User'}
              </div>
              <div className="text-xs text-gray-500">
                {storedUser.email || ''}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2D9AA5] rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {storedUser?.name ? getInitials(storedUser.name) : 'A'}
                </span>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-1.5 text-xs font-medium text-gray-600 hover:text-[#2D9AA5] hover:bg-[#2D9AA5]/10 rounded-lg transition-colors duration-200 focus:outline-none flex-shrink-0"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-12.34l-.71.71M5.05 18.95l-.71.71M21 12h-1M4 12H3m15.66 6.34l-.71-.71M5.05 5.05l-.71-.71" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8z" />
                  </svg>
                )}
              </button>

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

export default AdminHeader;
