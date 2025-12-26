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
    setIsDesktopHidden(!isDesktopHidden);
  };

  const handleToggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // If both sidebar and header are hidden, render children directly without layout wrapper
  if (hideSidebar && hideHeader) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100" role="application">
      {/* Sidebar - ClinicSidebar with external state */}
      {!hideSidebar && (
        <div className="fixed lg:sticky top-0 left-0 z-50 h-screen">
          <ClinicSidebar 
            externalIsDesktopHidden={isDesktopHidden}
            externalIsMobileOpen={isMobileOpen}
            onExternalToggleDesktop={handleToggleDesktop}
            onExternalToggleMobile={handleToggleMobile}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen lg:ml-0" style={{ overflowX: 'visible', minWidth: 0 }}>
        {/* Header - Visible on both mobile and desktop */}
        {!hideHeader && (
          <div className="sticky top-0 z-40">
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
          className="flex-1 overflow-y-auto relative z-0" 
          role="main" 
          style={{ 
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
