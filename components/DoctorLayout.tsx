import React, { useState } from 'react';
import DoctorSidebar from './DoctorSidebar';
import DoctorHeader from './DoctorHeader';

const DoctorLayout = ({ children }: { children: React.ReactNode }) => {
  const [isDesktopHidden, setIsDesktopHidden] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleDesktop = () => {
    setIsDesktopHidden(prev => !prev);
  };

  const handleToggleMobile = () => {
    setIsMobileOpen(prev => !prev);
  };

  const handleCloseMobile = () => {
    setIsMobileOpen(false);
  };

  const handleItemClick = () => {
    setIsMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-100" role="application">
      {/* Sidebar */}
      <DoctorSidebar
        isDesktopHidden={isDesktopHidden}
        isMobileOpen={isMobileOpen}
        handleToggleDesktop={handleToggleDesktop}
        handleToggleMobile={handleToggleMobile}
        handleCloseMobile={handleCloseMobile}
        handleItemClick={handleItemClick}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen max-h-screen transition-all duration-300">
        {/* Header */}
        <div className="sticky top-0 z-20">
          <DoctorHeader
            handleToggleDesktop={handleToggleDesktop}
            handleToggleMobile={handleToggleMobile}
            isDesktopHidden={isDesktopHidden}
            isMobileOpen={isMobileOpen}
          />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" role="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DoctorLayout;