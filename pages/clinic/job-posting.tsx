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

function ClinicJobPostingPage() {
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
        const token = localStorage.getItem("clinicToken");
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
        if (data.success && data.data) {
          const modulePermission = data.data.permissions?.find(
            (p: any) => p.module === "jobs"
          );

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
            const jobPostingAll = jobPostingSubModule?.actions?.all === true;
            const jobPostingCreate = jobPostingSubModule?.actions?.create === true;

            // Check for "See All Jobs" submodule
            const seeAllJobsSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "See All Jobs"
            );
            const seeAllJobsAll = seeAllJobsSubModule?.actions?.all === true;
            const seeAllJobsRead = seeAllJobsSubModule?.actions?.read === true;
            const seeAllJobsUpdate = seeAllJobsSubModule?.actions?.update === true;
            const seeAllJobsDelete = seeAllJobsSubModule?.actions?.delete === true;

            // Check for "See Job Applicants" submodule
            const seeJobApplicantsSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "See Job Applicants"
            );
            const seeJobApplicantsAll = seeJobApplicantsSubModule?.actions?.all === true;
            const seeJobApplicantsRead = seeJobApplicantsSubModule?.actions?.read === true;
            const seeJobApplicantsUpdate = seeJobApplicantsSubModule?.actions?.update === true;
            const seeJobApplicantsDelete = seeJobApplicantsSubModule?.actions?.delete === true;

            // ✅ When module-level "all" is true, it should grant ALL permissions for ALL submodules
            // This means module-level "all" acts as a global override for all submodule permissions
            setPermissions({
              // Create: Module "all" grants all, OR module "create" grants create, OR submodule-specific permissions
              canCreate: moduleAll || moduleCreate || jobPostingAll || jobPostingCreate,
              // Read Jobs: Module "all" grants all, OR module "read" grants read, OR submodule-specific permissions
              canRead: moduleAll || moduleRead || seeAllJobsAll || seeAllJobsRead,
              // Update Jobs: Module "all" grants all, OR module "update" grants update, OR submodule-specific permissions
              canUpdate: moduleAll || moduleUpdate || seeAllJobsAll || seeAllJobsUpdate,
              // Delete Jobs: Module "all" grants all, OR module "delete" grants delete, OR submodule-specific permissions
              canDelete: moduleAll || moduleDelete || seeAllJobsAll || seeAllJobsDelete,
              // Read Applicants: Module "all" grants all (including applicants), OR module "read" grants read, OR submodule-specific permissions
              canReadApplicants: moduleAll || moduleRead || seeJobApplicantsAll || seeJobApplicantsRead,
              // Update Applicants: Module "all" grants all (including applicants), OR module "update" grants update, OR submodule-specific permissions
              canUpdateApplicants: moduleAll || moduleUpdate || seeJobApplicantsAll || seeJobApplicantsUpdate,
              // Delete Applicants: Module "all" grants all (including applicants), OR module "delete" grants delete, OR submodule-specific permissions
              canDeleteApplicants: moduleAll || moduleDelete || seeJobApplicantsAll || seeJobApplicantsDelete,
            });
          } else {
            // No permissions found for this module
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
  }, []);

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
              <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your job postings and applications</p>
            </div>
            {permissions.canCreate && (
              <button
                onClick={handleCreateJobClick}
                className="inline-flex items-center justify-center gap-2 bg-[#2D9AA5] hover:bg-[#247a83] text-white px-4 py-2 rounded-lg shadow hover:shadow-md transition-all duration-200 text-sm font-medium"
              >
                <PlusCircle className="h-5 w-5" />
                <span>Create New Job</span>
              </button>
            )}
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
                  tokenKey: 'clinicToken',
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
                tokenKey="clinicToken"
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

const ProtectedClinicJobPage: NextPageWithLayout = withClinicAuth(ClinicJobPostingPage);
ProtectedClinicJobPage.getLayout = ClinicJobPostingPage.getLayout;

export default ProtectedClinicJobPage;
