import React, { useState } from 'react';
import AgentSidebar from './AgentSidebar';
import AgentHeader from './AgentHeader';

const AgentLayout = ({ children }: { children: React.ReactNode }) => {
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
    <div className="flex min-h-screen bg-slate-50" role="application">
      <AgentSidebar
        isDesktopHidden={isDesktopHidden}
        isMobileOpen={isMobileOpen}
        handleToggleDesktop={handleToggleDesktop}
        handleToggleMobile={handleToggleMobile}
        handleCloseMobile={handleCloseMobile}
        handleItemClick={handleItemClick}
      />

      <div className="flex flex-col flex-1 min-h-screen max-h-screen">
        <div className="sticky top-0 z-20">
          <AgentHeader
            handleToggleDesktop={handleToggleDesktop}
            handleToggleMobile={handleToggleMobile}
            isDesktopHidden={isDesktopHidden}
            isMobileOpen={isMobileOpen}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" role="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;