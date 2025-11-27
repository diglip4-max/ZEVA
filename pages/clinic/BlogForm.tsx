"use client";
import React, { useState, useEffect } from 'react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import type { NextPageWithLayout } from '../_app';
import PublishedBlogs from '../../components/PublishedBlogs';
import GetAuthorCommentsAndLikes from '../../components/GetAuthorCommentsAndLikes';
import BlogEditor from '../../components/createBlog';
import axios from 'axios';
import { PlusCircle, X } from 'lucide-react';

type TabType = 'published' | 'analytics';

function ClinicBlog() {
  const [activeTab, setActiveTab] = useState<TabType>('published');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canReadPublished: false,
    canUpdatePublished: false,
    canDeletePublished: false,
    canReadAnalytics: false,
    canUpdateAnalytics: false,
    canDeleteAnalytics: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem("clinicToken");
        if (!token) {
          setPermissionsLoaded(true);
          return;
        }
        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        console.log('[Blog Form] Permissions API response:', JSON.stringify(data, null, 2));
        
        if (data.success && data.data) {
          // Find "write_blog" module permission (not submodule)
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            const moduleKey = p.module || "";
            // Check for "write_blog" module (with or without prefix)
            const normalizedModule = moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "");
            return normalizedModule === "write_blog" || moduleKey === "write_blog" || 
                   moduleKey === "clinic_write_blog" || moduleKey === "doctor_write_blog" ||
                   normalizedModule === "blogs" || moduleKey === "blogs" || moduleKey === "clinic_blogs";
          });
          
          console.log('[Blog Form] Found module permission:', modulePermission ? {
            module: modulePermission.module,
            actions: modulePermission.actions,
          } : 'Not found');
          
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            
            // Helper function to check if a permission value is true (handles boolean and string)
            const isTrue = (value: any) => {
              if (value === true) return true;
              if (value === "true") return true;
              if (String(value).toLowerCase() === "true") return true;
              return false;
            };

            // Module-level permissions - check each action independently
            // If user only has "create", they can ONLY create, not read/update/delete
            const moduleAll = isTrue(actions.all);
            const moduleCreate = isTrue(actions.create);
            const moduleRead = isTrue(actions.read);
            const moduleUpdate = isTrue(actions.update);
            const moduleDelete = isTrue(actions.delete);
            
            console.log('[Blog Form] Permission checks:', {
              moduleAll,
              moduleRead,
              moduleCreate,
              moduleUpdate,
              moduleDelete
            });
            
            // CRUD permissions based on module-level actions
            // If "all" is true, grant everything
            // Otherwise, check each action independently
            setPermissions({
              // Create: Module "all" OR module "create"
              canCreate: moduleAll || moduleCreate,
              // Read Published: Module "all" OR module "read" (independent of create)
              canReadPublished: moduleAll || moduleRead,
              // Update Published: Module "all" OR module "update" (independent of create)
              canUpdatePublished: moduleAll || moduleUpdate,
              // Delete Published: Module "all" OR module "delete" (independent of create)
              canDeletePublished: moduleAll || moduleDelete,
              // Read Analytics: Module "all" OR module "read" (same as read published)
              canReadAnalytics: moduleAll || moduleRead,
              // Update Analytics: Module "all" OR module "update" (same as update published)
              canUpdateAnalytics: moduleAll || moduleUpdate,
              // Delete Analytics: Module "all" OR module "delete" (same as delete published)
              canDeleteAnalytics: moduleAll || moduleDelete,
            });
          } else {
            // No permissions found for write_blog module
            console.log('[Blog Form] No write_blog module permission found. Available modules:', 
              data.data.permissions?.map((p: any) => p.module) || []
            );
            // If no permissions are set up at all, allow access (backward compatibility)
            // Otherwise, deny access
            const hasAnyPermissions = data.data.permissions && data.data.permissions.length > 0;
            setPermissions({
              canCreate: !hasAnyPermissions,
              canReadPublished: !hasAnyPermissions,
              canUpdatePublished: !hasAnyPermissions,
              canDeletePublished: !hasAnyPermissions,
              canReadAnalytics: !hasAnyPermissions,
              canUpdateAnalytics: !hasAnyPermissions,
              canDeleteAnalytics: !hasAnyPermissions,
            });
          }
        } else {
          // API failed or no permissions data
          setPermissions({
            canCreate: false,
            canReadPublished: false,
            canUpdatePublished: false,
            canDeletePublished: false,
            canReadAnalytics: false,
            canUpdateAnalytics: false,
            canDeleteAnalytics: false,
          });
        }
        setPermissionsLoaded(true);
      } catch (err: any) {
        console.error("Error fetching permissions:", err);
        setPermissionsLoaded(true);
      }
    };
    fetchPermissions();
  }, []);

  const handleBlogCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsCreateModalOpen(false);
  };

  const handleCreateBlogClick = () => {
    if (!permissions.canCreate) {
      alert("You do not have permission to create blogs");
      return;
    }
    setIsCreateModalOpen(true);
  };

  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D9AA5]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your blogs and analytics</p>
            </div>
            {permissions.canCreate && (
              <button
                onClick={handleCreateBlogClick}
                className="inline-flex items-center justify-center gap-2 bg-[#2D9AA5] hover:bg-[#247a83] text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-200 text-sm font-medium"
              >
                <PlusCircle className="h-5 w-5" />
                <span>Create New Blog</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg border border-gray-200 p-1 mb-6 inline-flex">
          <button
            onClick={() => setActiveTab('published')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'published'
                ? 'bg-[#2D9AA5] text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Published Blogs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-[#2D9AA5] text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Comments & Likes
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'published' && (
          permissions.canReadPublished ? (
            <PublishedBlogs
              key={`published-${refreshKey}`}
              tokenKey="clinicToken"
              permissions={{
                canRead: permissions.canReadPublished,
                canUpdate: permissions.canUpdatePublished,
                canDelete: permissions.canDeletePublished,
              }}
            />
          ) : (
            <div className="text-center py-12 sm:py-16 w-full">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 max-w-md mx-auto">
                {permissions.canCreate ? (
                  <>
                    <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Read Permission Required
                    </h3>
                    <p className="text-gray-600 mb-4">
                      You only have permission to create blogs. You cannot view, update, or delete blogs.
                    </p>
                    <p className="text-sm text-gray-500">
                      Contact your administrator to request read permissions for the Write Blog module.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <PlusCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Access Denied
                    </h3>
                    <p className="text-gray-600 mb-4">
                      You do not have permission to view published blogs.
                    </p>
                    <p className="text-sm text-gray-500">
                      Please contact your administrator to request access to the Write Blog module.
                    </p>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {activeTab === 'analytics' && (
          permissions.canReadAnalytics ? (
            <GetAuthorCommentsAndLikes
              key={`analytics-${refreshKey}`}
              tokenKey="clinicToken"
              permissions={{
                canRead: permissions.canReadAnalytics,
                canUpdate: permissions.canUpdateAnalytics,
                canDelete: permissions.canDeleteAnalytics,
              }}
            />
          ) : (
            <div className="text-center py-12 sm:py-16 w-full">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 max-w-md mx-auto">
                {permissions.canCreate ? (
                  <>
                    <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Read Permission Required
                    </h3>
                    <p className="text-gray-600 mb-4">
                      You only have permission to create blogs. You cannot view blog analytics.
                    </p>
                    <p className="text-sm text-gray-500">
                      Contact your administrator to request read permissions for the Write Blog module.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <PlusCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Access Denied
                    </h3>
                    <p className="text-gray-600 mb-4">
                      You do not have permission to view blog analytics.
                    </p>
                    <p className="text-sm text-gray-500">
                      Please contact your administrator to request access to the Write Blog module.
                    </p>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Create Blog Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-white rounded-lg shadow-xl w-full h-full max-w-7xl mx-4 my-4 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Create New Blog</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <BlogEditor 
                tokenKey="clinicToken" 
                skipLandingPage={true}
                onClose={() => {
                  setIsCreateModalOpen(false);
                  handleBlogCreated();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ClinicBlog.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout hideSidebar={true} hideHeader={true}>{page}</ClinicLayout>;
};

const ProtectedClinicBlog: NextPageWithLayout = withClinicAuth(ClinicBlog);
ProtectedClinicBlog.getLayout = ClinicBlog.getLayout;

export default ProtectedClinicBlog;
