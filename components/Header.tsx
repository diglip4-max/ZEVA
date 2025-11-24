import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import { useRouter } from 'next/router';
import {
  KeyIcon
} from "@heroicons/react/24/solid";

interface NavItem {
  name: string;
  href: string;
  icon: string | React.ComponentType<{ className?: string }>;
  color: string;
  action?: () => void;
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
  const [isRegisterDropdownOpen, setIsRegisterDropdownOpen] = useState(false);
  const [isModulesDropdownOpen, setIsModulesDropdownOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const dashboardDropdownRef = useRef<HTMLDivElement>(null);
  const registerDropdownRef = useRef<HTMLDivElement>(null);
  const modulesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dashboardDropdownRef.current && !dashboardDropdownRef.current.contains(event.target as Node)) {
        setIsDashboardDropdownOpen(false);
      }
      if (registerDropdownRef.current && !registerDropdownRef.current.contains(event.target as Node)) {
        setIsRegisterDropdownOpen(false);
      }
      if (modulesDropdownRef.current && !modulesDropdownRef.current.contains(event.target as Node)) {
        setIsModulesDropdownOpen(false);
      }
    };

    if (isDashboardDropdownOpen || isRegisterDropdownOpen || isModulesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDashboardDropdownOpen, isRegisterDropdownOpen, isModulesDropdownOpen]);

  const renderIcon = (icon: string | React.ComponentType<{ className?: string }>, color: string, className: string = "w-5 h-5") => {
    if (typeof icon === 'string') {
      return <span className="text-lg">{icon}</span>;
    } else {
      const IconComponent = icon;
      return <IconComponent className={`${className} ${color}`} />;
    }
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setIsMenuOpen(false);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const moduleOptions = [
    { name: 'Home', icon: '🏠', color: 'text-indigo-600', bgColor: 'bg-indigo-50', href: '/' },
    { name: 'Search Health Center', icon: '🏥', color: 'text-red-600', bgColor: 'bg-red-50', href: '/clinic/findclinic' },
    { name: 'Search Doctor', icon: '👨‍⚕️', color: 'text-teal-600', bgColor: 'bg-teal-50', href: '/doctor/search' },
    { name: 'Games', icon: '🎮', color: 'text-purple-600', bgColor: 'bg-purple-50', href: '/games/allgames' },
    { name: 'Carriers', icon: '💼', color: 'text-blue-600', bgColor: 'bg-blue-50', href: '/job-listings' },
    { name: 'Blog', icon: '✍️', color: 'text-blue-600', bgColor: 'bg-blue-50', href: '/blogs/viewBlogs' },
    { name: 'Calculator', icon: '🧮', color: 'text-purple-600', bgColor: 'bg-purple-50', href: '/calculator/allcalc' },
    { name: 'About Us', icon: 'ℹ️', color: 'text-gray-600', bgColor: 'bg-gray-50', href: '/aboutus' },
  ];

  return (
    <>
      <header className="bg-white shadow-lg border-b border-gray-200">
        <nav className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          {/* Main Bar - Logo, Dashboard, Register, User, and Toggle */}
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  Z
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-lg font-bold text-gray-800">Zeva</span>
                  {/* <span className="text-xs text-gray-500">Digital OS</span> */}
                </div>
              </Link>
            </div>

            {/* Right Side - Dashboard, Register, User/Login Section, and Module Toggle */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 xl:space-x-4 flex-shrink-0">
              {/* Dashboard Dropdown */}
              <div className="relative" ref={dashboardDropdownRef}>
                <button
                  onClick={() => setIsDashboardDropdownOpen(!isDashboardDropdownOpen)}
                  className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white px-2 sm:px-3 xl:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium hover:from-teal-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 whitespace-nowrap"
                >
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                  <span>Dashboard</span>
                  <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${isDashboardDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isDashboardDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link href="/clinic/login-clinic" onClick={() => setIsDashboardDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Health Center Login
                      </Link>
                      <Link href="/doctor/login" onClick={() => setIsDashboardDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Doctor Login
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Register Dropdown */}
              <div className="relative" ref={registerDropdownRef}>
                <button
                  onClick={() => setIsRegisterDropdownOpen(!isRegisterDropdownOpen)}
                  className="flex items-center space-x-1 sm:space-x-2 border-2 border-teal-600 text-teal-600 px-2 sm:px-3 xl:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium hover:bg-teal-600 hover:text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
                >
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full"></div>
                  <span>Register</span>
                  <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${isRegisterDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isRegisterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link href="/clinic/register-clinic" onClick={() => setIsRegisterDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Register Health Center
                      </Link>
                      <Link href="/doctor/doctor-register" onClick={() => setIsRegisterDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Register as Doctor
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu or Login/SignUp Button */}
              {isAuthenticated ? (
                <div className="relative group">
                  <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg transition-all duration-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white font-medium text-sm shadow-lg relative">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="hidden lg:flex flex-col items-start">
                      <span className="text-sm font-semibold text-gray-800 max-w-32 truncate">{user?.name}</span>
                    </div>
                    <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <Link href="/user/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Profile
                      </Link>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 sm:px-3 xl:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 whitespace-nowrap"
                >
                  {renderIcon(KeyIcon, 'text-white', "w-3 h-3 sm:w-4 sm:h-4")}
                  <span className="hidden xs:inline sm:inline">Login/SignUp</span>
                  <span className="xs:hidden sm:hidden">Login</span>
                </button>
              )}

              {/* Modules Toggle Button - Extreme Right */}
              <div className="relative" ref={modulesDropdownRef}>
                <button
                  onClick={() => setIsModulesDropdownOpen(!isModulesDropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  title="All Modules"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {isModulesDropdownOpen && (
                  <>
                    {/* Mobile/Tablet View */}
                    <div className="lg:hidden absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] sm:max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">All Modules</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {moduleOptions.map((module) => (
                            <Link
                              key={module.name}
                              href={module.href}
                              onClick={() => setIsModulesDropdownOpen(false)}
                              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-50 transition-all duration-200 group border border-gray-100"
                            >
                              <span className="text-3xl mb-2">{module.icon}</span>
                              <span className="text-sm font-medium text-gray-700 group-hover:font-semibold text-center">
                                {module.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Desktop View - Full Width with 2 columns */}
                    <div className="hidden lg:block fixed left-0 right-0 top-16 bg-white shadow-2xl border-b border-gray-200 z-50">
                      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-base font-semibold text-gray-700">All Modules</h3>
                          <button
                            onClick={() => setIsModulesDropdownOpen(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {moduleOptions.map((module) => (
                            <Link
                              key={module.name}
                              href={module.href}
                              onClick={() => setIsModulesDropdownOpen(false)}
                              className="flex items-center space-x-3 p-3 rounded-md hover:bg-gray-50 transition-all duration-200 group hover:border-gray-200 hover:shadow-sm"
                            >
                              <span className="text-2xl flex-shrink-0">{module.icon}</span>
                              <span className="text-sm font-medium text-gray-700 group-hover:font-semibold">
                                {module.name}
                              </span>
                            </Link>
                          ))}
                        </div>

                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`lg:hidden transition-all duration-300 ${isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Mobile Login/SignUp Button (only show if not authenticated) */}
              {!isAuthenticated && (
                <button
                  onClick={() => {
                    openAuthModal('login');
                    setIsMenuOpen(false);
                  }}
                  className="group flex items-center space-x-3 w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-lg transition-all duration-200"
                >
                  {renderIcon(KeyIcon, 'text-red-500', "w-5 h-5 group-hover:scale-110 transition-transform")}
                  <span>Login/SignUp</span>
                </button>
              )}

              {/* Mobile All Modules Section */}
              <div className="pt-4 space-y-2">
                <details className="group">
                  <summary className="flex items-center justify-between px-3 py-3 text-base font-medium text-gray-700 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-lg transition-all duration-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                      All Modules
                    </div>
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="pl-6 space-y-1 mt-2">
                    {moduleOptions.map((module) => (
                      <Link
                        key={module.name}
                        href={module.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 text-sm ${module.color} hover:bg-gray-50 rounded-lg transition-all duration-200`}
                      >
                        <span className="text-lg">{module.icon}</span>
                        <span>{module.name}</span>
                      </Link>
                    ))}
                  </div>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between px-3 py-3 text-base font-medium text-gray-700 cursor-pointer hover:bg-gradient-to-r hover:from-teal-50 hover:to-blue-50 rounded-lg transition-all duration-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full"></div>
                      Dashboard Login
                    </div>
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="pl-6 space-y-1 mt-2">
                    <Link href="/clinic/login-clinic" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:text-teal-600 hover:bg-green-50 rounded-lg transition-all duration-200">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Health Center
                    </Link>
                    <Link href="/doctor/login" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:text-teal-600 hover:bg-blue-50 rounded-lg transition-all duration-200">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      Doctor
                    </Link>
                  </div>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between px-3 py-3 text-base font-medium text-gray-700 cursor-pointer hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-lg transition-all duration-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                      Register
                    </div>
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="pl-6 space-y-1 mt-2">
                    <Link href="/clinic/register-clinic" onClick={() => setIsRegisterDropdownOpen(false)} className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:text-teal-600 hover:bg-purple-50 rounded-lg transition-all duration-200">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      Health Center
                    </Link>
                    <Link href="/doctor/doctor-register" onClick={() => setIsRegisterDropdownOpen(false)} className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 hover:text-teal-600 hover:bg-orange-50 rounded-lg transition-all duration-200">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      Doctor
                    </Link>
                  </div>
                </details>
              </div>

              {/* Mobile User Menu */}
              {isAuthenticated && (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center px-3 py-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white font-medium shadow-lg">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="ml-3">
                        <div className="text-base font-medium text-gray-800">{user?.name}</div>
                        <div className="text-xs text-gray-500">Welcome back!</div>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Link href="/user/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 px-3 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gradient-to-r hover:from-blue-50 hover:to-teal-50 rounded-lg transition-all duration-200">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Profile
                      </Link>
                      <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="w-full flex items-center space-x-3 px-3 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 rounded-lg transition-all duration-200">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />
    </>
  );
};

export default Header;