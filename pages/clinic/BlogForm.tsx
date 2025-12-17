"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import type { NextPageWithLayout } from '../_app';
import PublishedBlogs from '../../components/PublishedBlogs';
import GetAuthorCommentsAndLikes from '../../components/GetAuthorCommentsAndLikes';
import BlogEditor from '../../components/createBlog';
import DraftBlogs from '../../components/DraftBlogs';
import axios from 'axios';
import { 
  PlusCircle, 
  X, 
  BarChart3, 
  BookOpen,
  Edit3,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Settings,
  Archive,
  Sparkles,
  Grid3x3,
  List,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { useAgentPermissions } from '../../hooks/useAgentPermissions';

type TabType = 'published' | 'analytics' | 'drafts' | 'scheduled' | 'archived';
type ViewMode = 'grid' | 'list';

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value =
      localStorage.getItem(key) ||
      sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

function ClinicBlog() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('published');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [blogEditorKey, setBlogEditorKey] = useState(0);
  const [editBlogId, setEditBlogId] = useState<string | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
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
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      setHasAgentToken(Boolean(localStorage.getItem("agentToken")));
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath =
      router?.pathname?.startsWith("/agent/") ||
      window.location.pathname?.startsWith("/agent/");
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [router.pathname, hasAgentToken]);

  // Use agent permissions hook for agent routes
  const agentPermissionsHook: any = useAgentPermissions(isAgentRoute ? "clinic_write_blog" : null);
  const agentPermissions = agentPermissionsHook?.permissions || {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  // Handle agent permissions
  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    
    // ✅ Ensure permissions are properly set from hook response
    const newPermissions = {
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canReadPublished: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canUpdatePublished: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDeletePublished: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
      canReadAnalytics: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canUpdateAnalytics: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDeleteAnalytics: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
    };
    
    console.log('Setting permissions from agentPermissions:', {
      agentPermissions,
      newPermissions,
      hasAnyPermission: newPermissions.canCreate || newPermissions.canReadPublished || newPermissions.canUpdatePublished || newPermissions.canDeletePublished
    });
    
    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  // Handle clinic permissions
  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;
    const token = getStoredToken();
    if (!token) {
      setPermissions({
        canCreate: false,
        canReadPublished: false,
        canUpdatePublished: false,
        canDeletePublished: false,
        canReadAnalytics: false,
        canUpdateAnalytics: false,
        canDeleteAnalytics: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    const fetchClinicPermissions = async () => {
      try {
        setPermissionsLoaded(false);
        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        console.log('[Blog Form] Permissions API response:', JSON.stringify(data, null, 2));
        
        if (!isMounted) return;
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
            if (isMounted) {
              setPermissions({
                canCreate: moduleAll || moduleCreate,
                canReadPublished: moduleAll || moduleRead,
                canUpdatePublished: moduleAll || moduleUpdate,
                canDeletePublished: moduleAll || moduleDelete,
                canReadAnalytics: moduleAll || moduleRead,
                canUpdateAnalytics: moduleAll || moduleUpdate,
                canDeleteAnalytics: moduleAll || moduleDelete,
              });
            }
          } else {
            // No permissions found for write_blog module
            console.log('[Blog Form] No write_blog module permission found. Available modules:', 
              data.data.permissions?.map((p: any) => p.module) || []
            );
            // If no permissions are set up at all, allow access (backward compatibility)
            // Otherwise, deny access
            const hasAnyPermissions = data.data.permissions && data.data.permissions.length > 0;
            if (isMounted) {
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
          }
        } else {
          // API failed or no permissions data
          if (isMounted) {
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
        }
      } catch (err: any) {
        console.error("Error fetching permissions:", err);
        if (isMounted) {
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
      } finally {
        if (isMounted) {
          setPermissionsLoaded(true);
        }
      }
    };

    fetchClinicPermissions();

    return () => {
      isMounted = false;
    };
  }, [isAgentRoute]);

  const handleBlogCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsCreateModalOpen(false);
    setEditBlogId(null);
    setEditDraftId(null);
  };

  // Check for blogId or draftId in query params and open editor
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const { blogId, draftId } = router.query as {
      blogId?: string;
      draftId?: string;
    };

    if (blogId && typeof blogId === 'string') {
      setEditBlogId(blogId);
      setEditDraftId(null);
      setBlogEditorKey(prev => prev + 1);
      setIsCreateModalOpen(true);
      // Clear the query param from URL without reloading
      router.replace(router.pathname, undefined, { shallow: true });
    } else if (draftId && typeof draftId === 'string') {
      setEditDraftId(draftId);
      setEditBlogId(null);
      setBlogEditorKey(prev => prev + 1);
      setIsCreateModalOpen(true);
      // Clear the query param from URL without reloading
      router.replace(router.pathname, undefined, { shallow: true });
    }
  }, [router.query, router.pathname]);

  const handleCreateBlogClick = () => {
    if (!permissions.canCreate) {
      alert("You do not have permission to create blogs");
      return;
    }
    // Reset editor key to force fresh mount and prevent loading old drafts
    setEditBlogId(null);
    setEditDraftId(null);
    setBlogEditorKey(prev => prev + 1);
    setIsCreateModalOpen(true);
  };

  const handleEditBlog = (blogId: string, type: 'published' | 'drafts') => {
    if (type === 'published') {
      setEditBlogId(blogId);
      setEditDraftId(null);
    } else {
      setEditDraftId(blogId);
      setEditBlogId(null);
    }
    setBlogEditorKey(prev => prev + 1);
    setIsCreateModalOpen(true);
  };

  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-slate-200 border-t-slate-400"></div>
          <p className="text-slate-500 text-sm">Loading your blog workspace...</p>
        </div>
      </div>
    );
  }

  const sidebarItems = [
    {
      id: 'published',
      label: 'Published',
      icon: BookOpen,
      count: null,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      activeBgColor: 'bg-blue-100',
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: Edit3,
      count: null,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      activeBgColor: 'bg-amber-100',
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      icon: Calendar,
      count: null,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      activeBgColor: 'bg-purple-100',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      count: null,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      activeBgColor: 'bg-emerald-100',
    },
    {
      id: 'archived',
      label: 'Archived',
      icon: Archive,
      count: null,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      activeBgColor: 'bg-slate-100',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-white/80 backdrop-blur-sm border-r border-slate-200/60 transition-all duration-300 flex flex-col shadow-sm`}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-slate-200/60">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800">Blog Studio</h1>
                    <p className="text-xs text-slate-500">Content Hub</p>
                  </div>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm mx-auto">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Create Button */}
          {permissions.canCreate && (
            <div className="p-4 border-b border-slate-200/60">
              <button
                onClick={handleCreateBlogClick}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium text-sm group"
              >
                <PlusCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                {!sidebarCollapsed && <span>New Post</span>}
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? `${item.activeBgColor} ${item.color} shadow-sm`
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? item.color : 'text-slate-500 group-hover:text-slate-700'}`} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
                      {item.count !== null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isActive ? 'bg-white/60' : 'bg-slate-100'
                        }`}>
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-200/60 space-y-2">
            {!sidebarCollapsed && (
              <>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors">
                  <Settings className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium">Settings</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors">
                  <HelpCircle className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium">Help & Support</span>
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <div className="flex flex-col gap-2">
                <button className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors mx-auto">
                  <Settings className="h-5 w-5" />
                </button>
                <button className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors mx-auto">
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search blogs, tags, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm text-slate-700 placeholder-slate-400"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Filter Button */}
                  <button 
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className={`p-2.5 border rounded-xl transition-colors ${
                      showFilterPanel 
                        ? 'bg-blue-50 border-blue-300 text-blue-700' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Filter className="h-5 w-5" />
                  </button>

                  {/* More Options */}
                  <button className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-800 transition-colors">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 sm:p-6">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                {sidebarItems.find(item => item.id === activeTab) && (
                  <>
                    {React.createElement(sidebarItems.find(item => item.id === activeTab)!.icon, {
                      className: `h-6 w-6 ${sidebarItems.find(item => item.id === activeTab)!.color}`
                    })}
                    <h2 className="text-2xl font-bold text-slate-800">
                      {sidebarItems.find(item => item.id === activeTab)!.label}
                    </h2>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-500 ml-9">
                {activeTab === 'published' && 'Manage and view all your published blog posts'}
                {activeTab === 'drafts' && 'Continue working on your draft posts'}
                {activeTab === 'scheduled' && 'Posts scheduled for future publication'}
                {activeTab === 'analytics' && 'Track performance, engagement, and insights'}
                {activeTab === 'archived' && 'Browse your archived blog posts'}
              </p>
            </div>

            {/* Content based on active tab */}
            <div className="space-y-6">
              {activeTab === 'published' && (
                permissions.canReadPublished ? (
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <PublishedBlogs
                      key={`published-${refreshKey}`}
                      tokenKey={isAgentRoute ? "agentToken" : "clinicToken"}
                      permissions={{
                        canRead: permissions.canReadPublished,
                        canUpdate: permissions.canUpdatePublished,
                        canDelete: permissions.canDeletePublished,
                      }}
                      onEditBlog={handleEditBlog}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-8 max-w-md mx-auto">
                      {permissions.canCreate ? (
                        <>
                          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Read Permission Required
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You only have permission to create blogs. You cannot view, update, or delete blogs.
                          </p>
                          <p className="text-xs text-slate-500">
                            Contact your administrator to request read permissions for the Write Blog module.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <X className="w-8 h-8 text-red-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Access Denied
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You do not have permission to view published blogs.
                          </p>
                          <p className="text-xs text-slate-500">
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
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <GetAuthorCommentsAndLikes
                      key={`analytics-${refreshKey}`}
                      tokenKey={isAgentRoute ? "agentToken" : "clinicToken"}
                      permissions={{
                        canRead: permissions.canReadAnalytics,
                        canUpdate: permissions.canUpdateAnalytics,
                        canDelete: permissions.canDeleteAnalytics,
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-8 max-w-md mx-auto">
                      {permissions.canCreate ? (
                        <>
                          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Read Permission Required
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You only have permission to create blogs. You cannot view blog analytics.
                          </p>
                          <p className="text-xs text-slate-500">
                            Contact your administrator to request read permissions for the Write Blog module.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BarChart3 className="w-8 h-8 text-red-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Access Denied
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You do not have permission to view blog analytics.
                          </p>
                          <p className="text-xs text-slate-500">
                            Please contact your administrator to request access to the Write Blog module.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}

              {activeTab === 'drafts' && (
                permissions.canReadPublished ? (
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <DraftBlogs
                      key={`drafts-${refreshKey}`}
                      tokenKey={isAgentRoute ? "agentToken" : "clinicToken"}
                      permissions={{
                        canRead: permissions.canReadPublished,
                        canUpdate: permissions.canUpdatePublished,
                        canDelete: permissions.canDeletePublished,
                      }}
                      searchQuery={searchQuery}
                      viewMode={viewMode}
                      onEditBlog={handleEditBlog}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-8 max-w-md mx-auto">
                      {permissions.canCreate ? (
                        <>
                          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Edit3 className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Read Permission Required
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You only have permission to create blogs. You cannot view, update, or delete drafts.
                          </p>
                          <p className="text-xs text-slate-500">
                            Contact your administrator to request read permissions for the Write Blog module.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <X className="w-8 h-8 text-red-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Access Denied
                          </h3>
                          <p className="text-sm text-slate-600 mb-4">
                            You do not have permission to view drafts.
                          </p>
                          <p className="text-xs text-slate-500">
                            Please contact your administrator to request access to the Write Blog module.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}

              {(activeTab === 'scheduled' || activeTab === 'archived') && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    {activeTab === 'scheduled' && <Calendar className="w-10 h-10 text-slate-400" />}
                    {activeTab === 'archived' && <Archive className="w-10 h-10 text-slate-400" />}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    {activeTab === 'scheduled' && 'No Scheduled Posts'}
                    {activeTab === 'archived' && 'No Archived Posts'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">
                    {activeTab === 'scheduled' && 'Schedule posts to see them here'}
                    {activeTab === 'archived' && 'Archived posts will appear here'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Blog Modal - No header, let createBlog component handle it */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl flex flex-col border border-slate-200 overflow-hidden">
            {/* No header here - createBlog component will render its own */}
            <div className="flex-1 overflow-hidden">
              <BlogEditor 
                key={blogEditorKey}
                tokenKey={isAgentRoute ? "agentToken" : "clinicToken"} 
                skipLandingPage={true}
                editBlogId={editBlogId || undefined}
                editDraftId={editDraftId || undefined}
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
  // Wrap page in ClinicLayout for persistent layout
  // When getLayout is used, Next.js keeps the layout mounted and only swaps page content
  // This prevents sidebar and header from re-rendering on navigation
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedClinicBlog: NextPageWithLayout = withClinicAuth(ClinicBlog);
ProtectedClinicBlog.getLayout = ClinicBlog.getLayout;

export default ProtectedClinicBlog;
