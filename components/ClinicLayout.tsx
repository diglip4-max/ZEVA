import React, { useState } from 'react';
import ClinicSidebar from './ClinicSidebar';
import ClinicHeader from './ClinicHeader';

interface ClinicLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideHeader?: boolean;
}

const ClinicLayout = ({ children, hideSidebar = false, hideHeader = false }: ClinicLayoutProps) => {
  // If both sidebar and header are hidden, render children directly without layout wrapper
  if (hideSidebar && hideHeader) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100" role="application">
      {/* Sidebar - ClinicSidebar manages its own state */}
      {!hideSidebar && (
        <div className="h-screen sticky top-0 z-50">
          <ClinicSidebar />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen max-h-screen" style={{ overflowX: 'visible', minWidth: 0 }}>
        {/* Header - Hidden on mobile when sidebar might be open */}
        {!hideHeader && (
          <div className="sticky top-0 z-10 hidden lg:block">
            <ClinicHeader />
          </div>
        )}

        {/* Page Content */}
        <main 
          className={`flex-1 ${hideSidebar && hideHeader ? '' : ''}`} 
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
