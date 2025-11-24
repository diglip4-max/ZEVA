import React from 'react';
import AdminSidebar from './StaffSidebar';
import AdminHeader from './StaffHeader';

const AdminLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-100" role="application">
      {/* Sidebar */}
      <div className="h-screen sticky top-0 z-30">
        <AdminSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen max-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-20">
          <AdminHeader />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" role="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
