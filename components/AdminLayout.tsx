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

  if (hideSidebar && hideHeader) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50" role="application">
      {/* Sidebar */}
      {!hideSidebar && (
        <div className="fixed lg:sticky top-0 left-0 z-50 h-screen">
          <AdminSidebar 
            onItemsChange={setSidebarItems}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-0">
        {/* Header - Hidden on mobile when sidebar might be open */}
        {!hideHeader && (
          <div className="sticky top-0 z-10 hidden lg:block">
            <AdminHeader 
              sidebarItems={sidebarItems}
            />
          </div>
        )}

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto relative z-0"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
