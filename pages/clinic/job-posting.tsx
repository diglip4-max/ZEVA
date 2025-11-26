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

  // Fetch permissions
  useEffect(() => {
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

        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;
        console.log('[Job Posting] Permissions API response:', JSON.stringify(data, null, 2));
        
        if (data.success && data.data) {
          // Look for both "jobs" and "jobPosting" (or "clinic_jobPosting") module names
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            // Normalize module name (remove clinic_ or admin_ prefix)
            const normalized = p.module.startsWith("clinic_")
              ? p.module.slice(7)
              : p.module.startsWith("admin_")
              ? p.module.slice(6)
              : p.module;
            // Check for both "jobs" and "jobPosting" module names
            return normalized === "jobs" || normalized === "jobPosting";
          });
          
          console.log('[Job Posting] Found module permission:', modulePermission ? {
            module: modulePermission.module,
            actions: modulePermission.actions,
            subModules: modulePermission.subModules?.map((sm: any) => ({
              name: sm.name,
              actions: sm.actions
            }))
          } : 'Not found');

          if (modulePermission) {
            const actions = modulePermission.actions || {};
            
            // Module-level "all" grants all permissions
            const moduleAll = actions.all === true;
            const moduleCreate = actions.create === true;
            const moduleRead = actions.read === true;
            const moduleUpdate = actions.update === true;
            const moduleDelete = actions.delete === true;

            // Check for "Job Posting" submodule
            const jobPostingSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "Job Posting"
            );
            
            // Properly extract actions object - handle both object and array cases
            let jobPostingActions = {};
            if (jobPostingSubModule) {
              if (Array.isArray(jobPostingSubModule.actions)) {
                // If actions is an array, convert to object
                jobPostingActions = jobPostingSubModule.actions.reduce((acc: any, item: any) => {
                  if (typeof item === 'object' && item !== null) {
                    return { ...acc, ...item };
                  }
                  return acc;
                }, {});
              } else if (typeof jobPostingSubModule.actions === 'object' && jobPostingSubModule.actions !== null) {
                // If actions is already an object, use it directly
                jobPostingActions = jobPostingSubModule.actions;
              }
            }
            
            const jobPostingAll = jobPostingActions.all === true || jobPostingActions.all === "true";
            
            console.log('[Job Posting] Submodule check:', {
              found: !!jobPostingSubModule,
              subModuleName: jobPostingSubModule?.name,
              rawActions: jobPostingSubModule?.actions,
              actionsType: Array.isArray(jobPostingSubModule?.actions) ? 'array' : typeof jobPostingSubModule?.actions,
              processedActions: jobPostingActions,
              create: jobPostingActions.create,
              createType: typeof jobPostingActions.create,
              createValue: jobPostingActions.create,
              hasCreate: 'create' in jobPostingActions || jobPostingActions.hasOwnProperty?.('create')
            });

            // Check for "See All Jobs" submodule
            const seeAllJobsSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "See All Jobs"
            );
            const seeAllJobsActions = seeAllJobsSubModule?.actions || {};
            const seeAllJobsAll = seeAllJobsActions.all === true;
            const seeAllJobsRead = seeAllJobsActions.read === true;
            const seeAllJobsUpdate = seeAllJobsActions.update === true;
            const seeAllJobsDelete = seeAllJobsActions.delete === true;

            // Check for "See Job Applicants" submodule
            const seeJobApplicantsSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "See Job Applicants"
            );
            const seeJobApplicantsActions = seeJobApplicantsSubModule?.actions || {};
            const seeJobApplicantsAll = seeJobApplicantsActions.all === true;
            const seeJobApplicantsRead = seeJobApplicantsActions.read === true;
            const seeJobApplicantsUpdate = seeJobApplicantsActions.update === true;
            const seeJobApplicantsDelete = seeJobApplicantsActions.delete === true;

            // Permission logic: 
            // Priority order:
            // 1. Module-level "all" = true → grant everything (overrides all)
            // 2. "Job Posting" submodule exists:
            //    a. If submodule "all" = true → grant for this submodule
            //    b. If submodule permission is explicitly false → deny (respect false)
            //    c. If submodule permission is explicitly true → allow
            //    d. If submodule permission is undefined → fall back to module-level
            // 3. If "Job Posting" submodule doesn't exist → use module-level permissions
            
            const hasJobPostingSubModule = !!jobPostingSubModule;
            
            // Helper function to determine permission for "Job Posting" submodule
            // This function takes the action name and checks permissions in priority order
            const getJobPostingPermission = (actionName: 'create' | 'update' | 'delete'): boolean => {
              // Priority 1: Module-level "all" overrides everything
              if (moduleAll) {
                console.log(`[Job Posting] ${actionName}: Module "all" is true, granting permission`);
                return true;
              }
              
              // Priority 2: If submodule exists
              if (hasJobPostingSubModule && jobPostingSubModule) {
                // Priority 2a: Submodule "all" grants permission
                if (jobPostingAll) {
                  console.log(`[Job Posting] ${actionName}: Submodule "all" is true, granting permission`);
                  return true;
                }
                
                // Priority 2b: Check if action is explicitly set in submodule
                // Check if the property exists in the actions object
                const actionExists = jobPostingActions.hasOwnProperty?.(actionName) ||
                                    Object.prototype.hasOwnProperty.call(jobPostingActions, actionName) ||
                                    actionName in jobPostingActions ||
                                    jobPostingActions[actionName] !== undefined;
                
                if (actionExists) {
                  const actionValue = jobPostingActions[actionName];
                  console.log(`[Job Posting] ${actionName}: Found in submodule, value:`, actionValue, 'type:', typeof actionValue);
                  
                  // Explicitly false = deny (check for false, "false", 0, null, etc.)
                  if (actionValue === false || 
                      actionValue === "false" || 
                      String(actionValue).toLowerCase() === "false" ||
                      actionValue === 0) {
                    console.log(`[Job Posting] ${actionName}: Explicitly denied in submodule (false)`);
                    return false;
                  }
                  
                  // Explicitly true = allow
                  if (actionValue === true || 
                      actionValue === "true" || 
                      String(actionValue).toLowerCase() === "true" ||
                      actionValue === 1) {
                    console.log(`[Job Posting] ${actionName}: Explicitly allowed in submodule (true)`);
                    return true;
                  }
                  
                  // If value is null or undefined, fall through to module-level
                  if (actionValue === null || actionValue === undefined) {
                    console.log(`[Job Posting] ${actionName}: Value is null/undefined, falling back to module-level`);
                  } else {
                    // If value is neither true nor false (unexpected), deny
                    console.warn(`[Job Posting] ${actionName}: Unexpected value in submodule:`, actionValue);
                    return false;
                  }
                } else {
                  console.log(`[Job Posting] ${actionName}: Not found in submodule actions, falling back to module-level`);
                }
              } else {
                console.log(`[Job Posting] ${actionName}: Submodule not found, using module-level permission`);
              }
              
              // Priority 3: Fall back to module-level permission
              const moduleActionValue = actions[actionName];
              const moduleHasAction = moduleActionValue === true || 
                                     moduleActionValue === "true" || 
                                     String(moduleActionValue).toLowerCase() === "true";
              
              console.log(`[Job Posting] ${actionName}: Final check - module-level:`, moduleActionValue, 'result:', moduleHasAction);
              
              return moduleHasAction;
            };
            
            const finalCanCreate = getJobPostingPermission('create');
            const finalCanUpdate = getJobPostingPermission('update');
            const finalCanDelete = getJobPostingPermission('delete');
            
            console.log('[Job Posting] Final permissions:', {
              canCreate: finalCanCreate,
              canUpdate: finalCanUpdate,
              canDelete: finalCanDelete,
            });
            
            setPermissions({
              // Create: Use submodule permission if exists, otherwise module-level
              canCreate: finalCanCreate,
              // Read Jobs: Module "all" grants all, OR module "read" grants read, OR submodule-specific permissions
              canRead: moduleAll || moduleRead || seeAllJobsAll || seeAllJobsRead,
              // Update: Use submodule permission if exists, otherwise module-level
              canUpdate: finalCanUpdate,
              // Delete: Use submodule permission if exists, otherwise module-level
              canDelete: finalCanDelete,
              // Read Applicants: Module "all" grants all (including applicants), OR module "read" grants read, OR submodule-specific permissions
              canReadApplicants: moduleAll || moduleRead || seeJobApplicantsAll || seeJobApplicantsRead,
              // Update Applicants: Module "all" grants all (including applicants), OR module "update" grants update, OR submodule-specific permissions
              canUpdateApplicants: moduleAll || moduleUpdate || seeJobApplicantsAll || seeJobApplicantsUpdate,
              // Delete Applicants: Module "all" grants all (including applicants), OR module "delete" grants delete, OR submodule-specific permissions
              canDeleteApplicants: moduleAll || moduleDelete || seeJobApplicantsAll || seeJobApplicantsDelete,
            });
          } else {
            // No permissions found for this module - deny all access by default
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
  }, [tokenKey]);

  const handleJobCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsCreateModalOpen(false);
    // The JobManagement component will refresh automatically via its useEffect
  };

  const handleCreateJobClick = () => {
    if (!permissions.canCreate) {
      alert("You do not have permission to create jobs");
      return;
    }
    setIsCreateModalOpen(true);
  };

  const hideClinicChrome = routeContext === "agent";

  if (!permissionsLoaded) {
    return (
      <ClinicLayout hideSidebar={hideClinicChrome} hideHeader={hideClinicChrome}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D9AA5]"></div>
        </div>
      </ClinicLayout>
    );
  }

  return (
    <ClinicLayout hideSidebar={hideClinicChrome} hideHeader={hideClinicChrome}>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your job postings and applications</p>
            </div>
            {(() => {
              console.log('[Job Posting] Button render check - canCreate:', permissions.canCreate, 'permissionsLoaded:', permissionsLoaded);
              return permissions.canCreate && (
                <button
                  onClick={handleCreateJobClick}
                  className="inline-flex items-center justify-center gap-2 bg-[#2D9AA5] hover:bg-[#247a83] text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-200 text-sm font-medium"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span>Create New Job</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg border border-gray-200 p-1 mb-6 inline-flex">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'bg-[#2D9AA5] text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            My All Jobs
          </button>
          <button
            onClick={() => setActiveTab('applicants')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'applicants'
                ? 'bg-[#2D9AA5] text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Job Applicants
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'jobs' ? (
            !permissions.canRead ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6.001" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-600 mb-4">
                  You do not have permission to view job postings.
                </p>
                <p className="text-sm text-gray-500">
                  Please contact your administrator to request access to the Jobs module.
                </p>
              </div>
            ) : (
              <JobManagement 
                role="clinic" 
                config={{
                  title: 'My Job Postings',
                  subtitle: 'Manage and review all your job listings posted as a clinic',
                  tokenKey,
                  primaryColor: '#2D9AA5',
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-600 mb-4">
                  You do not have permission to view job applicants.
                </p>
                <p className="text-sm text-gray-500">
                  Please contact your administrator to request access to the Job Applicants module.
                </p>
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
    </ClinicLayout>
  );
}

ClinicJobPostingPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const ClinicJobPostingPageBase = ClinicJobPostingPage;

const ProtectedClinicJobPage: NextPageWithLayout = withClinicAuth(ClinicJobPostingPage);
ProtectedClinicJobPage.getLayout = ClinicJobPostingPage.getLayout;

export default ProtectedClinicJobPage;
