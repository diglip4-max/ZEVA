import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

interface AdminLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideHeader?: boolean;
}

interface NavItem {
  label: string;
  path?: string;
  icon?: any;
  children?: NavItem[];
}

const AdminLayout = ({
  children,
  hideSidebar = false,
  hideHeader = false,
}: AdminLayoutProps) => {
  const [sidebarItems, setSidebarItems] = useState<NavItem[]>([]);
  const [isDesktopHidden, setIsDesktopHidden] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (hideSidebar && hideHeader) {
    return <>{children}</>;
  }

  const toggleDesktop = () => {
    setIsDesktopHidden(!isDesktopHidden);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <div className="flex min-h-screen bg-gray-50" role="application">
      {/* Sidebar */}
      {!hideSidebar && (
        <div className="fixed lg:sticky top-0 left-0 z-50 h-screen">
          <AdminSidebar 
            onItemsChange={setSidebarItems}
            externalIsDesktopHidden={isDesktopHidden}
            externalIsMobileOpen={isMobileOpen}
            onExternalToggleDesktop={toggleDesktop}
            onExternalToggleMobile={toggleMobile}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-0">
        {/* Header */}
        {!hideHeader && (
          <div className="z-40">
            <AdminHeader 
              sidebarItems={sidebarItems}
              isDesktopHidden={isDesktopHidden}
              isMobileOpen={isMobileOpen}
              onToggleDesktop={toggleDesktop}
              onToggleMobile={toggleMobile}
            />
          </div>
        )}

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto relative"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
