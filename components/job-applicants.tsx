// components/ApplicationsDashboard.tsx
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

interface JobInfo {
  jobTitle: string;
  location: string;
  jobType: string;
}

interface ApplicantInfo {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface Application {
  _id: string;
  jobId: JobInfo;
  applicantId: ApplicantInfo;
  status: string;
  resumeUrl?: string;
  createdAt?: string;
}

// ✅ Added interface for API response
interface ApplicationsResponse {
  applications: Application[];
}

type FilterType = 'All' | 'Part Time' | 'Full Time' | 'Internship';
type StatusFilter = 'All' | 'pending' | 'contacted' | 'rejected';
type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'job-title' | 'status';

interface ApplicationsDashboardProps {
  tokenKey?: string;
  apiEndpoint?: string;
  updateStatusEndpoint?: string;
  deleteEndpoint?: string;
  permissions?: {
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  };
}

const ApplicationsDashboard: React.FC<ApplicationsDashboardProps> = ({
  tokenKey = "clinicToken",
  apiEndpoint = "/api/job-postings/job-applications",
  updateStatusEndpoint = "/api/job-postings/application-status",
  deleteEndpoint = "/api/job-postings/delete-application",
  permissions = {
    canRead: true,
    canUpdate: true,
    canDelete: true,
  }
}) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<FilterType>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  useEffect(() => {
    const fetchApplications = async () => {
      // Don't fetch if no read permission
      if (!permissions.canRead) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem(tokenKey);

      try {
        setLoading(true);
        setError(null);
        
        // ✅ Fixed TypeScript error with proper typing
        const res = await axios.get<ApplicationsResponse>(apiEndpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          validateStatus: (status) => status === 200 || status === 403,
        });

        if (res.status === 403) {
          setApplications([]);
          return;
        }

        setApplications(res.data.applications || []);
      } catch (error) {
        console.error("Failed to load applications", error);
        setError("Failed to load applications. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [tokenKey, apiEndpoint, permissions.canRead]);

  const updateStatus = async (applicationId: string, status: string): Promise<void> => {
    if (!permissions.canUpdate) {
      setError("You do not have permission to update application status.");
      return;
    }

    const token = localStorage.getItem(tokenKey);

    try {
      await axios.put(updateStatusEndpoint, {
        applicationId,
        status
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setApplications((prev) =>
        prev.map((app) =>
          app._id === applicationId ? { ...app, status } : app
        )
      );
    } catch (error) {
      console.error("Status update failed", error);
      setError("Failed to update status. Please try again.");
    }
  };

  const deleteApplication = async (applicationId: string): Promise<void> => {
    if (!permissions.canDelete) {
      setError("You do not have permission to delete applications.");
      return;
    }

    const token = localStorage.getItem(tokenKey);

    try {
      await axios.delete(`${deleteEndpoint}/${applicationId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setApplications(prev => prev.filter(app => app._id !== applicationId));
      setShowDeleteModal(false);
      setApplicationToDelete(null);
    } catch (error) {
      console.error("Failed to delete application", error);
      setError("Failed to delete application. Please try again.");
    }
  };

  const handleDeleteClick = (app: Application): void => {
    setApplicationToDelete(app);
    setShowDeleteModal(true);
  };

  // ✅ Get unique values for filter dropdowns
  const uniqueLocations = useMemo(() => {
    const locations = applications.map(app => app.jobId?.location).filter(Boolean);
    return ['All', ...Array.from(new Set(locations))];
  }, [applications]);

  const uniqueRoles = useMemo(() => {
    const roles = applications.map(app => app.applicantId?.role).filter(Boolean);
    return ['All', ...Array.from(new Set(roles))];
  }, [applications]);

  // ✅ Advanced filtering and sorting logic
  const filteredAndSortedApplications = useMemo(() => {
    const filtered = applications.filter(app => {
      // Job type filter
      if (filter !== 'All' && app.jobId?.jobType !== filter) return false;
      
      // Status filter
      if (statusFilter !== 'All' && (app.status || 'pending') !== statusFilter) return false;
      
      // Location filter
      if (locationFilter !== 'All' && app.jobId?.location !== locationFilter) return false;
      
      // Role filter
      if (roleFilter !== 'All' && app.applicantId?.role !== roleFilter) return false;
      
      // Search query (searches in job title, applicant name, email)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const jobTitle = app.jobId?.jobTitle?.toLowerCase() || '';
        const applicantName = app.applicantId?.name?.toLowerCase() || '';
        const applicantEmail = app.applicantId?.email?.toLowerCase() || '';
        
        if (!jobTitle.includes(query) && !applicantName.includes(query) && !applicantEmail.includes(query)) {
          return false;
        }
      }
      
      return true;
    });

    // Sort applications
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'name-asc':
          return (a.applicantId?.name || '').localeCompare(b.applicantId?.name || '');
        case 'name-desc':
          return (b.applicantId?.name || '').localeCompare(a.applicantId?.name || '');
        case 'job-title':
          return (a.jobId?.jobTitle || '').localeCompare(b.jobId?.jobTitle || '');
        case 'status':
          return (a.status || 'pending').localeCompare(b.status || 'pending');
        default:
          return 0;
      }
    });

    return filtered;
  }, [applications, filter, statusFilter, searchQuery, locationFilter, roleFilter, sortBy]);

  const clearAllFilters = () => {
    setFilter('All');
    setStatusFilter('All');
    setSearchQuery('');
    setLocationFilter('All');
    setRoleFilter('All');
    setSortBy('newest');
  };

  const filterOptions: FilterType[] = ['All', 'Part Time', 'Full Time', 'Internship'];
  const statusOptions: StatusFilter[] = ['All', 'pending', 'contacted', 'rejected'];
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'job-title', label: 'Job Title' },
    { value: 'status', label: 'Status' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D9AA5]"></div>
            <span className="ml-2 text-gray-600">Loading applications...</span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Don't render content if no read permission
  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-4">
              You do not have permission to view job applicants.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your administrator to request access to the Job Applicants module.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Applications</h2>
          <p className="text-gray-600">
            {filteredAndSortedApplications.length} of {applications.length} applications
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <div className="text-black relative">
            <input
              type="text"
              placeholder="Search by job title, applicant name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {filterOptions.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === type
                    ? 'bg-[#2D9AA5] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg className={`h-4 w-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              Advanced Filters
            </button>
            
            {(filter !== 'All' || statusFilter !== 'All' || searchQuery || locationFilter !== 'All' || roleFilter !== 'All' || sortBy !== 'newest') && (
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent"
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>
                      {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent"
                >
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>
                      {location === 'All' ? 'All Locations' : location}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent"
                >
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>
                      {role === 'All' ? 'All Roles' : role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Applications */}
        {filteredAndSortedApplications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              {applications.length === 0 
                ? 'No applications yet.' 
                : 'No applications match your current filters.'
              }
            </p>
            {applications.length > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-3 px-4 py-2 bg-[#2D9AA5] text-white rounded-lg text-sm font-medium hover:bg-[#247a84] transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedApplications.map((app) => (
              <div key={app._id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Left: Job & Applicant Info */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{app.jobId?.jobTitle}</h3>
                        <p className="text-gray-600 text-sm mt-1">
                          {app.jobId?.location} • {app.jobId?.jobType}
                        </p>
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 sm:mt-0 ${
                        app.status === 'contacted' ? 'bg-green-100 text-green-800' :
                        app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {app.status || "Pending"}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Applicant:</span>
                        <span className="ml-2 font-medium text-gray-900">{app.applicantId?.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Role:</span>
                        <span className="ml-2 text-gray-900">{app.applicantId?.role}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <a href={`mailto:${app.applicantId?.email}`} className="ml-2 text-[#2D9AA5] hover:underline">
                          {app.applicantId?.email}
                        </a>
                      </div>
                      <div>
                        <span className="text-gray-500">Phone:</span>
                        <a href={`tel:${app.applicantId?.phone}`} className="ml-2 text-[#2D9AA5] hover:underline">
                          {app.applicantId?.phone}
                        </a>
                      </div>

                      {app.resumeUrl && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Resume:</span>
                          <a
                            href={app.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-[#2D9AA5] hover:underline"
                          >
                            View Resume
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-row lg:flex-col gap-2 lg:min-w-[140px]">
                    {permissions.canUpdate && (
                      <>
                        <button
                          className="px-4 py-2 bg-[#2D9AA5] hover:bg-[#247a84] text-white rounded-lg text-sm font-medium transition-colors flex-1 lg:flex-none"
                          onClick={() => updateStatus(app._id, "contacted")}
                        >
                          Contact
                        </button>
                        <button
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex-1 lg:flex-none"
                          onClick={() => updateStatus(app._id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {permissions.canDelete && (
                      <button
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex-1 lg:flex-none"
                        onClick={() => handleDeleteClick(app)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Delete application from <strong>{applicationToDelete?.applicantId?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                onClick={() => applicationToDelete && deleteApplication(applicationToDelete._id)}
              >
                Delete
              </button>
              <button
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                onClick={() => {
                  setShowDeleteModal(false);
                  setApplicationToDelete(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsDashboard;