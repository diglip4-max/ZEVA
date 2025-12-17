"use client";
import React, { useState, useEffect } from 'react';
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import type { NextPageWithLayout } from "../_app";
import JobManagement from "../../components/all-posted-jobs";
import ApplicationsDashboard from "../../components/job-applicants";
import CreateJobModal from "../../components/CreateJobModal";
import axios from 'axios';
import { PlusCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAgentPermissions } from "../../hooks/useAgentPermissions";

type TabType = 'jobs' | 'applicants';
type RouteContext = "clinic" | "agent";

function ClinicJobPostingPage({ contextOverride = null }: { contextOverride?: RouteContext | null }) {
  const [routeContext, setRouteContext] = useState<RouteContext>(contextOverride || "clinic");
  useEffect(() => {
    if (contextOverride) {
      setRouteContext(contextOverride);
      return;
    }
    if (typeof window === "undefined") return;
    const isAgentRoute = window.location.pathname?.startsWith("/agent/") ?? false;
    setRouteContext(isAgentRoute ? "agent" : "clinic");
  }, [contextOverride]);
  const tokenKey = routeContext === "agent" ? "agentToken" : "clinicToken";
  const isAgentRoute = routeContext === "agent";

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return (
      localStorage.getItem(tokenKey) ||
      sessionStorage.getItem(tokenKey) ||
      null
    );
  };
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ Use useAgentPermissions hook for agent routes
  const agentPermissionsResult: any = useAgentPermissions(isAgentRoute ? "job_posting" : null);
  const agentPermissions = agentPermissionsResult?.permissions || {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canApprove: false,
    canPrint: false,
    canExport: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsResult?.loading || false;

  // Permission state
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canReadApplicants: false,
    canUpdateApplicants: false,
    canDeleteApplicants: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // ✅ Handle agent permissions from useAgentPermissions hook
  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    
    // ✅ Ensure permissions are properly set from hook response
    const newPermissions = {
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canReadApplicants: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canUpdateApplicants: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDeleteApplicants: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
    };
    
    console.log('[Job Posting] Setting permissions from agentPermissions:', {
      agentPermissions,
      newPermissions,
      hasAnyPermission: newPermissions.canCreate || newPermissions.canRead || newPermissions.canUpdate || newPermissions.canDelete
    });
    
    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  // ✅ Fetch clinic permissions for clinic routes
  useEffect(() => {
    if (isAgentRoute) return; // Skip if agent route (handled by useAgentPermissions hook)
    
    const fetchPermissions = async () => {
      try {
        const token = getToken();
        if (!token) {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
            canReadApplicants: false,
            canUpdateApplicants: false,
            canDeleteApplicants: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        // ✅ For clinic/admin/doctor roles, grant full access (bypass permission checks)
        // Try to get role from token or localStorage
        let userRole: string | null = null;
        try {
          // Try to get from localStorage/sessionStorage
          userRole = localStorage.getItem('role') || sessionStorage.getItem('role') || 
                     localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
          
          // If not found, try to decode from token
          if (!userRole && token) {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              userRole = payload?.role || payload?.userRole;
            }
          }
        } catch (e) {
          console.error('Error getting user role:', e);
        }
        
        if (["clinic", "admin", "doctor"].includes(userRole || "")) {
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
            canReadApplicants: true,
            canUpdateApplicants: true,
            canDeleteApplicants: true,
          });
          setPermissionsLoaded(true);
          return; // Skip API calls for these roles
        }

        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;
        console.log('[Job Posting] Permissions API response:', JSON.stringify(data, null, 2));
        
        if (data.success && data.data) {
          // Find "job_posting" module permission (not submodule)
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            const moduleKey = p.module || "";
            // Check for "job_posting" module (with or without prefix)
            const normalizedModule = moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "");
            return normalizedModule === "job_posting" || moduleKey === "job_posting" || 
                   moduleKey === "clinic_job_posting" || moduleKey === "doctor_job_posting" ||
                   normalizedModule === "jobs" || moduleKey === "jobs" || moduleKey === "clinic_jobs";
          });
          
          console.log('[Job Posting] Found module permission:', modulePermission ? {
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
            
            console.log('[Job Posting] Permission checks:', {
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
              // Read Jobs: Module "all" OR module "read" (independent of create)
              canRead: moduleAll || moduleRead,
              // Update: Module "all" OR module "update" (independent of create)
              canUpdate: moduleAll || moduleUpdate,
              // Delete: Module "all" OR module "delete" (independent of create)
              canDelete: moduleAll || moduleDelete,
              // Read Applicants: Module "all" OR module "read" (same as read jobs)
              canReadApplicants: moduleAll || moduleRead,
              // Update Applicants: Module "all" OR module "update" (same as update jobs)
              canUpdateApplicants: moduleAll || moduleUpdate,
              // Delete Applicants: Module "all" OR module "delete" (same as delete jobs)
              canDeleteApplicants: moduleAll || moduleDelete,
            });
          } else {
            // No permissions found for job_posting module
            console.log('[Job Posting] No job_posting module permission found. Available modules:', 
              data.data.permissions?.map((p: any) => p.module) || []
            );
            // If no permissions are set up at all, allow access (backward compatibility)
            // Otherwise, deny access
            const hasAnyPermissions = data.data.permissions && data.data.permissions.length > 0;
            setPermissions({
              canCreate: !hasAnyPermissions,
              canRead: !hasAnyPermissions,
              canUpdate: !hasAnyPermissions,
              canDelete: !hasAnyPermissions,
              canReadApplicants: !hasAnyPermissions,
              canUpdateApplicants: !hasAnyPermissions,
              canDeleteApplicants: !hasAnyPermissions,
            });
          }
        } else {
          // API failed or no permissions data
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
            canReadApplicants: false,
            canUpdateApplicants: false,
            canDeleteApplicants: false,
          });
        }
        setPermissionsLoaded(true);
      } catch (err: any) {
        console.error("Error fetching permissions:", err);
        setPermissions({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
          canReadApplicants: false,
          canUpdateApplicants: false,
          canDeleteApplicants: false,
        });
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, [isAgentRoute, tokenKey]);

  const handleJobCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsCreateModalOpen(false);
    // The JobManagement component will refresh automatically via its useEffect
  };

  const handleCreateJobClick = () => {
    if (!permissions.canCreate) {
      // Toast will be handled by the component
      return;
    }
    setIsCreateModalOpen(true);
  };

  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: '14px',
            padding: '12px 16px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
            style: {
              background: '#10b981',
              color: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            style: {
              background: '#ef4444',
              color: '#fff',
            },
          },
        }}
      />
      {/* Compact Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Job Management</h1>
              <p className="text-xs sm:text-sm text-gray-700 mt-0.5">Manage your job postings and applications</p>
            </div>
            {(() => {
              console.log('[Job Posting] Button render check - canCreate:', permissions.canCreate, 'permissionsLoaded:', permissionsLoaded);
              return permissions.canCreate && (
                <button
                  onClick={handleCreateJobClick}
                  className="inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create New Job</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Compact Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-1 mb-3 inline-flex">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'bg-gray-800 text-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            My All Jobs
          </button>
          <button
            onClick={() => setActiveTab('applicants')}
            className={`px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'applicants'
                ? 'bg-gray-800 text-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Job Applicants
          </button>
        </div>

        {/* Compact Tab Content */}
        <div className="mt-3">
          {activeTab === 'jobs' ? (
            !permissions.canRead ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
                {permissions.canCreate ? (
                  <>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Read Permission Required</h3>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3">
                      You only have permission to create job postings. You cannot view, update, or delete job postings.
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-700">
                      Contact your administrator to request read permissions for the Job Posting module.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6.001" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3">
                      You do not have permission to view job postings.
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-700">
                      Please contact your administrator to request access to the Jobs module.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <JobManagement 
                role="clinic" 
                config={{
                  title: 'My Job Postings',
                  subtitle: 'Manage and review all your job listings posted as a clinic',
                  tokenKey,
                  primaryColor: '#1f2937',
                  emptyStateTitle: 'No Job Postings Yet',
                  emptyStateDescription: 'Start posting job opportunities to find new candidates.',
                  emptyStateButtonText: 'Post a New Job'
                }}
                key={refreshKey}
                permissions={permissions}
              />
            )
          ) : (
            !permissions.canReadApplicants ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
                {permissions.canCreate ? (
                  <>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Read Permission Required</h3>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3">
                      You only have permission to create job postings. You cannot view job applicants.
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-700">
                      Contact your administrator to request read permissions for the Job Posting module.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3">
                      You do not have permission to view job applicants.
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-700">
                      Please contact your administrator to request access to the Job Applicants module.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <ApplicationsDashboard 
                tokenKey={tokenKey}
                permissions={permissions}
              />
            )
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onJobCreated={handleJobCreated}
        canCreate={permissions.canCreate}
      />
    </div>
  );
}

ClinicJobPostingPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const ClinicJobPostingPageBase = ClinicJobPostingPage;

const ProtectedClinicJobPage: NextPageWithLayout = withClinicAuth(ClinicJobPostingPage);
ProtectedClinicJobPage.getLayout = ClinicJobPostingPage.getLayout;

export default ProtectedClinicJobPage;
