import React, { useState, useEffect } from 'react';

interface ClinicHeaderProps {
  handleToggleDesktop: () => void;
  handleToggleMobile: () => void;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
}

const ClinicHeader: React.FC<ClinicHeaderProps> = ({
  handleToggleDesktop,
  handleToggleMobile,
  isDesktopHidden,
  isMobileOpen
}) => {
  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('agentToken');
    // sessionStorage.removeItem('resetEmail');
    //  sessionStorage.removeItem('clinicEmailForReset');
    window.location.href = '/staff';
  };
  const leadUserRaw = localStorage.getItem('agentUser');
  const leadUser = leadUserRaw ? JSON.parse(leadUserRaw) : null;
  console.log('lead token', leadUserRaw);
//   console.log('clinicTokensss', localStorage.getItem('clinicToken'));


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setScreenWidth(window.innerWidth);
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleResponsiveToggle = () => {
    if (screenWidth && screenWidth < 1024) {
      handleToggleMobile();
    } else {
      handleToggleDesktop();
    }
  };

//   const getInitials = (name: string) => {
//     return name
//       .split(' ')
//       .map(word => word.charAt(0).toUpperCase())
//       .join('')
//       .slice(0, 2);
//   };

  return (
  <header className="w-full bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
    <div className="px-2 sm:px-4 py-1.5 sm:py-2">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Toggle + Brand */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={handleResponsiveToggle}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 ${screenWidth && screenWidth < 1024 && (isDesktopHidden || isMobileOpen) ? 'rotate-90' : ''}`}
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

          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#2D9AA5] to-[#1e7d87] rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                <div className="w-4 h-4 sm:w-6 sm:h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-[#2D9AA5] rounded-full border-2 border-white"></div>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent truncate">
                ZEVA
              </h1>
              <p className="text-[10px] sm:text-xs text-[#2D9AA5] font-medium -mt-0.5 truncate">Healthcare Excellence</p>
            </div>
          </div>
        </div>

        {/* Right: User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <div className="hidden md:block text-right">
            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">
              {leadUser?.name || ''}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">
              {leadUser?.email || ''}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="w-7 h-7 sm:w-9 sm:h-9 bg-[#2D9AA5] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-medium text-[10px] sm:text-sm">
                {leadUser?.name?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-200"
              aria-label="Logout"
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default ClinicHeader;