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
          // Look for "blogs" module (also check for "clinic_blogs" or "admin_blogs")
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            // Normalize module name (remove clinic_ or admin_ prefix)
            const normalized = p.module.startsWith("clinic_")
              ? p.module.slice(7)
              : p.module.startsWith("admin_")
              ? p.module.slice(6)
              : p.module;
            return normalized === "blogs";
          });
          
          console.log('[Blog Form] Found module permission:', modulePermission ? {
            module: modulePermission.module,
            actions: modulePermission.actions,
            subModules: modulePermission.subModules?.map((sm: any) => ({
              name: sm.name,
              actions: sm.actions
            }))
          } : 'Not found');
          
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            
            // Module-level permissions
            const moduleAll = actions.all === true;
            const moduleCreate = actions.create === true;
            const moduleRead = actions.read === true;
            const moduleUpdate = actions.update === true;
            const moduleDelete = actions.delete === true;

            // Helper function to extract actions from submodule (handle array or object)
            const extractSubModuleActions = (subModule: any) => {
              if (!subModule || !subModule.actions) return {};
              
              if (Array.isArray(subModule.actions)) {
                return subModule.actions.reduce((acc: any, item: any) => {
                  if (typeof item === 'object' && item !== null) {
                    return { ...acc, ...item };
                  }
                  return acc;
                }, {});
              } else if (typeof subModule.actions === 'object' && subModule.actions !== null) {
                return subModule.actions;
              }
              return {};
            };

            // Find submodules
            const writeBlogSubModule = modulePermission.subModules?.find((sm: any) => sm.name === "Write Blog");
            const publishedBlogsSubModule = modulePermission.subModules?.find((sm: any) => sm.name === "Published and Drafts Blogs");
            const analyticsSubModule = modulePermission.subModules?.find((sm: any) => sm.name === "Analytics of blog");

            // Extract actions from submodules
            const writeBlogActions = extractSubModuleActions(writeBlogSubModule);
            const publishedBlogsActions = extractSubModuleActions(publishedBlogsSubModule);
            const analyticsActions = extractSubModuleActions(analyticsSubModule);

            // Helper function to determine permission for a submodule
            const getSubModulePermission = (
              subModule: any,
              subModuleActions: any,
              actionName: 'create' | 'read' | 'update' | 'delete',
              moduleAction: boolean
            ): boolean => {
              // Priority 1: Module-level "all" overrides everything
              if (moduleAll) return true;
              
              // Priority 2: If submodule exists
              if (subModule) {
                // Priority 2a: Submodule "all" grants permission
                const subModuleAll = subModuleActions.all === true || subModuleActions.all === "true";
                if (subModuleAll) return true;
                
                // Priority 2b: Check if action is explicitly set in submodule
                const actionExists = subModuleActions.hasOwnProperty?.(actionName) ||
                                    Object.prototype.hasOwnProperty.call(subModuleActions, actionName) ||
                                    actionName in subModuleActions ||
                                    subModuleActions[actionName] !== undefined;
                
                if (actionExists) {
                  const actionValue = subModuleActions[actionName];
                  
                  // Explicitly false = deny
                  if (actionValue === false || 
                      actionValue === "false" || 
                      String(actionValue).toLowerCase() === "false" ||
                      actionValue === 0) {
                    console.log(`[Blog Form] ${actionName} is explicitly denied in submodule:`, subModule.name);
                    return false;
                  }
                  
                  // Explicitly true = allow
                  if (actionValue === true || 
                      actionValue === "true" || 
                      String(actionValue).toLowerCase() === "true" ||
                      actionValue === 1) {
                    return true;
                  }
                  
                  // If value is null or undefined, fall through to module-level
                  if (actionValue === null || actionValue === undefined) {
                    // Fall through
                  } else {
                    // Unexpected value, deny
                    console.warn(`[Blog Form] Unexpected ${actionName} value in submodule ${subModule.name}:`, actionValue);
                    return false;
                  }
                }
              }
              
              // Priority 3: Fall back to module-level permission
              return moduleAction;
            };

            // Calculate permissions
            const finalCanCreate = getSubModulePermission(
              writeBlogSubModule,
              writeBlogActions,
              'create',
              moduleCreate
            );

            const finalCanReadPublished = getSubModulePermission(
              publishedBlogsSubModule,
              publishedBlogsActions,
              'read',
              moduleRead
            );

            const finalCanUpdatePublished = getSubModulePermission(
              publishedBlogsSubModule,
              publishedBlogsActions,
              'update',
              moduleUpdate
            );

            const finalCanDeletePublished = getSubModulePermission(
              publishedBlogsSubModule,
              publishedBlogsActions,
              'delete',
              moduleDelete
            );

            const finalCanReadAnalytics = getSubModulePermission(
              analyticsSubModule,
              analyticsActions,
              'read',
              moduleRead
            );

            const finalCanUpdateAnalytics = getSubModulePermission(
              analyticsSubModule,
              analyticsActions,
              'update',
              moduleUpdate
            );

            const finalCanDeleteAnalytics = getSubModulePermission(
              analyticsSubModule,
              analyticsActions,
              'delete',
              moduleDelete
            );

            console.log('[Blog Form] Final permissions:', {
              canCreate: finalCanCreate,
              canReadPublished: finalCanReadPublished,
              canUpdatePublished: finalCanUpdatePublished,
              canDeletePublished: finalCanDeletePublished,
              canReadAnalytics: finalCanReadAnalytics,
              canUpdateAnalytics: finalCanUpdateAnalytics,
              canDeleteAnalytics: finalCanDeleteAnalytics,
            });

            setPermissions({
              canCreate: finalCanCreate,
              canReadPublished: finalCanReadPublished,
              canUpdatePublished: finalCanUpdatePublished,
              canDeletePublished: finalCanDeletePublished,
              canReadAnalytics: finalCanReadAnalytics,
              canUpdateAnalytics: finalCanUpdateAnalytics,
              canDeleteAnalytics: finalCanDeleteAnalytics,
            });
          } else {
            // No permissions found for this module - deny all access by default
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
                  Please contact your administrator to request access to the "Published and Drafts Blogs" submodule.
                </p>
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
                  Please contact your administrator to request access to the "Analytics of blog" submodule.
                </p>
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
