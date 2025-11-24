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

  return (
    <div className="flex min-h-screen bg-gray-50" role="application">
      {/* Sidebar */}
      {!hideSidebar && (
        <div className="sticky top-0 z-30 h-screen">
          <AdminSidebar 
            onItemsChange={setSidebarItems}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen max-h-screen flex-1 flex-col">
        {/* Header */}
        {!hideHeader && (
          <div className="sticky top-0 z-20">
            <AdminHeader 
              handleToggleDesktop={() => setIsDesktopHidden(!isDesktopHidden)}
              handleToggleMobile={() => setIsMobileOpen(!isMobileOpen)}
              isDesktopHidden={isDesktopHidden}
              isMobileOpen={isMobileOpen}
              sidebarItems={sidebarItems}
            />
          </div>
        )}

        {/* Page Content */}
        <main
          className={`flex-1 overflow-y-auto ${
            hideSidebar && hideHeader ? '' : ''
          }`}
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
