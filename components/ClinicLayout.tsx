import React, { useState } from 'react';
import ClinicSidebar from './ClinicSidebar';
import ClinicHeader from './ClinicHeader';

interface ClinicLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideHeader?: boolean;
}

const ClinicLayout = ({ children, hideSidebar = false, hideHeader = false }: ClinicLayoutProps) => {
  const [isDesktopHidden, setIsDesktopHidden] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleDesktop = () => {
    setIsDesktopHidden(prev => !prev);
  };

  const handleToggleMobile = () => {
    setIsMobileOpen(prev => !prev);
  };

  // If both sidebar and header are hidden, render children directly without layout wrapper
  if (hideSidebar && hideHeader) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100" role="application">
      {/* Sidebar */}
      {!hideSidebar && (
        <div className="h-screen sticky top-0 z-30">
          <ClinicSidebar />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen max-h-screen" style={{ overflowX: 'visible', minWidth: 0 }}>
        {/* Header */}
        {!hideHeader && (
          <div className="sticky top-0 z-20">
            <ClinicHeader
              handleToggleDesktop={handleToggleDesktop}
              handleToggleMobile={handleToggleMobile}
              isDesktopHidden={isDesktopHidden}
              isMobileOpen={isMobileOpen}
            />
          </div>
        )}

        {/* Page Content */}
        <main 
          className={`flex-1 ${hideSidebar && hideHeader ? '' : 'p-4 sm:p-6 md:p-8'}`} 
          role="main" 
          style={{ 
            overflowY: 'auto', 
            overflowX: 'visible',
            minWidth: 0,
            width: '100%'
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default ClinicLayout;
