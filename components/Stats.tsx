// components/common/JobStats.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Label, LabelList } from 'recharts';

// Type definitions (matching your existing Job interface)
interface Job {
  _id: string;
  jobTitle: string;
  companyName?: string;
  clinicName?: string;
  hospitalName?: string;
  department?: string;
  jobType?: string;
  location?: string;
  salary?: string;
  isActive: boolean;
  role?: string;
  qualification?: string;
  workingDays?: string;
  jobTiming?: string;
  skills?: string[];
  perks?: string[];
  languagesPreferred?: string[];
  description?: string;
  noOfOpenings?: number;
  establishment?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApplicationItem {
  _id: string;
  jobId: {
    _id?: string;
    jobTitle?: string;
    location?: string;
    jobType?: string;
  } | string;
  applicantId?: unknown;
  status?: string;
}

interface JobApplicationsResponse {
  applications?: ApplicationItem[];
}

interface StatsConfig {
  tokenKey: string;
  primaryColor: string;
  title?: string;
  permissions?: {
    canAccessJobs?: boolean;
    canAccessBlogs?: boolean;
    canAccessApplications?: boolean;
  };
}

interface JobStatsProps {
  role?: 'clinic' | 'doctor';
  config?: StatsConfig;
}

interface JobTypeStats {
  [key: string]: number;
}

interface StatsData {
  totalJobs: number;
  activeJobs: number;
  inactiveJobs: number;
  jobTypeStats: JobTypeStats;
  totalOpenings: number;
}

// Blog types
interface BlogPost {
  _id: string;
  title: string;
  likesCount?: number;
  commentsCount?: number;
  createdAt?: string;
  postedBy?: { name?: string };
}

interface BlogFromAPI {
  _id: string;
  title: string;
  likes?: unknown[];
  comments?: unknown[];
  createdAt?: string;
  postedBy?: { _id?: string; name?: string };
}

interface PublishedBlogsResponse {
  success: boolean;
  blogs?: BlogFromAPI[];
  message?: string;
}

const decodeUserIdFromJwt = (token: string | null): string | null => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1]);
    const payload = JSON.parse(payloadJson);
    return payload.userId || null;
  } catch {
    return null;
  }
};

// Responsive breakpoints utility
const useBreakpoints = () => {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return {
    isXs: width < 640,
    isSm: width >= 640 && width < 768,
    isMd: width >= 768 && width < 1024,
    isLg: width >= 1024 && width < 1280,
    isXl: width >= 1280,
    width,
  };
};

const JobStats: React.FC<JobStatsProps> = ({ 
  config = {
    tokenKey: 'clinicToken',
    primaryColor: '#2D9AA5',
    title: 'Job Statistics'
  }
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [blogLoading, setBlogLoading] = useState<boolean>(true);
  const [blogError, setBlogError] = useState<string>('');
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [applicationsError, setApplicationsError] = useState<string>('');
  const [applicationsLoading, setApplicationsLoading] = useState<boolean>(true);

  const fetchJobs = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem(config.tokenKey);
      
      if (!token) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      // Check if job access is explicitly denied via permissions
      if (config.permissions?.canAccessJobs === false) {
        setJobs([]);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get<{ jobs: Job[] }>('/api/job-postings/my-jobs', {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status === 200 || status === 403,
        });

        // Handle 403 - Permission denied
        if (res.status === 403) {
          setJobs([]);
          setError('');
          setLoading(false);
          return;
        }

        setJobs(res.data.jobs || []);
      } catch (axiosError: any) {
        // Handle 403 errors gracefully
        if (axiosError.response?.status === 403) {
          setJobs([]);
          setError('');
          return;
        }
        throw axiosError;
      }
    } catch (error) {
      // Only log non-403 errors
      if (axios.isAxiosError(error) && error.response?.status !== 403) {
        console.error('Error fetching jobs:', error);
        setError('Failed to fetch job statistics');
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [config.tokenKey, config.permissions]);

  const fetchBlogs = useCallback(async (): Promise<void> => {
    try {
      setBlogLoading(true);
      setBlogError('');
      const token = localStorage.getItem(config.tokenKey);
      const userId = decodeUserIdFromJwt(token);

      if (!token || !userId) {
        setBlogs([]);
        setBlogLoading(false);
        return;
      }

      // Check if blog access is explicitly denied via permissions
      if (config.permissions?.canAccessBlogs === false) {
        setBlogs([]);
        setBlogLoading(false);
        return;
      }

      try {
        const res = await axios.get<PublishedBlogsResponse>('/api/blog/published', {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status === 200 || status === 403,
        });

        // Handle 403 - Permission denied
        if (res.status === 403) {
          setBlogs([]);
          setBlogError('');
          setBlogLoading(false);
          return;
        }

        const raw = res.data.blogs || [];
        const normalized = raw.map((b: BlogFromAPI) => ({
          _id: b._id,
          title: b.title,
          likesCount: Array.isArray(b.likes) ? b.likes.length : 0,
          commentsCount: Array.isArray(b.comments) ? b.comments.length : 0,
          createdAt: b.createdAt,
          postedBy: b.postedBy,
        })) as BlogPost[];

        const mine = normalized.filter((b: BlogPost) => {
          const postedBy = b.postedBy as { _id?: string };
          return postedBy && postedBy._id === userId;
        });
        setBlogs(mine);
      } catch (axiosError: any) {
        // Handle 403 errors gracefully
        if (axiosError.response?.status === 403) {
          setBlogs([]);
          setBlogError('');
          return;
        }
        throw axiosError;
      }
    } catch (error) {
      // Only log non-403 errors
      if (axios.isAxiosError(error) && error.response?.status !== 403) {
        console.error('Error fetching blogs:', error);
        setBlogError('Failed to fetch blog statistics');
      }
      setBlogs([]);
    } finally {
      setBlogLoading(false);
    }
  }, [config.tokenKey, config.permissions]);

  const fetchApplications = useCallback(async (): Promise<void> => {
    try {
      setApplicationsLoading(true);
      setApplicationsError('');
      const token = localStorage.getItem(config.tokenKey);
      if (!token) {
        setApplications([]);
        setApplicationsLoading(false);
        return;
      }

      // Check if application access is explicitly denied via permissions
      if (config.permissions?.canAccessApplications === false) {
        setApplications([]);
        setApplicationsLoading(false);
        return;
      }

      try {
        const res = await axios.get<JobApplicationsResponse>('/api/job-postings/job-applications', {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status === 200 || status === 403,
        });

        // Handle 403 - Permission denied
        if (res.status === 403) {
          setApplications([]);
          setApplicationsError('');
          setApplicationsLoading(false);
          return;
        }

        const list = (res.data?.applications || []) as ApplicationItem[];
        setApplications(Array.isArray(list) ? list : []);
      } catch (axiosError: any) {
        // Handle 403 errors gracefully
        if (axiosError.response?.status === 403) {
          setApplications([]);
          setApplicationsError('');
          return;
        }
        throw axiosError;
      }
    } catch (error) {
      // Only log non-403 errors
      if (axios.isAxiosError(error) && error.response?.status !== 403) {
        console.error('Error fetching applications:', error);
        setApplicationsError('Failed to fetch job applications');
      }
      setApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, [config.tokenKey, config.permissions]);

  useEffect(() => {
    fetchJobs();
    fetchBlogs();
    fetchApplications();
  }, [fetchJobs, fetchBlogs, fetchApplications]);

  // Calculate statistics
  const stats: StatsData = useMemo(() => {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(job => job.isActive).length;
    const inactiveJobs = jobs.filter(job => !job.isActive).length;
    
    // Calculate total openings
    const totalOpenings = jobs.reduce((sum, job) => {
      return sum + (job.noOfOpenings || 1);
    }, 0);

    // Calculate job type statistics
    const jobTypeStats: JobTypeStats = {};
    jobs.forEach(job => {
      const jobType = job.jobType || 'Not Specified';
      jobTypeStats[jobType] = (jobTypeStats[jobType] || 0) + 1;
    });

    return {
      totalJobs,
      activeJobs,
      inactiveJobs,
      jobTypeStats,
      totalOpenings
    };
  }, [jobs]);

  // Get job type entries sorted by count
  const sortedJobTypes = useMemo(() => {
    return Object.entries(stats.jobTypeStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6); // Show top 6 job types
  }, [stats.jobTypeStats]);

  // Blog statistics
  const totalBlogs = blogs.length;
  const topLikedBlogs = useMemo(() => {
    return [...blogs]
      .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      .slice(0, 3);
  }, [blogs]);

  // Breakpoints for responsive charts/text
  const {isSm, isMd } = useBreakpoints();
  const nameMaxLen = isMd ? 25 : 15;
  const xAxisFontSize = isSm || isMd ? 12 : 10;
  const yAxisFontSize = xAxisFontSize;
  const legendFontSize = xAxisFontSize + (isMd ? 2 : 0);
  const tooltipFontSize = xAxisFontSize + (isMd ? 2 : 0);
  const barCount = isMd ? 5 : 3;
  const pieOuterRadius = isMd ? 140 : (isSm ? 110 : 90);
  const pieInnerRadius = Math.round(pieOuterRadius * 0.6);

  const topCommentedBlogs = useMemo(() => {
    return [...blogs]
      .sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0))
      .slice(0, 3);
  }, [blogs]);

  // Latest three job posts
  const topAppliedJobs = useMemo(() => {
    const counts = new Map<string, { jobId: string; jobTitle: string; count: number }>();
    for (const app of applications) {
      const jobObj = app.jobId;
      const jobId = (typeof jobObj === 'string') ? jobObj : (jobObj?._id || '');
      if (!jobId) continue;
      const title = (typeof jobObj === 'string') ? (jobs.find(j => j._id === jobObj)?.jobTitle || 'Untitled') : (jobObj?.jobTitle || 'Untitled');
      const existing = counts.get(jobId);
      if (existing) existing.count += 1; else counts.set(jobId, { jobId, jobTitle: title, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [applications, jobs]);

  const totalTopApplications = useMemo(() => {
    return topAppliedJobs.reduce((sum, j) => sum + j.count, 0);
  }, [topAppliedJobs]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-300 rounded w-1/3 mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-medium text-red-900">Unable to load statistics</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchJobs}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

return (
  <div className="w-full space-y-4 sm:space-y-6 px-2 sm:px-4 lg:px-0">
    {/* Main Statistics Cards */}
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      
      {/* Total Jobs */}
      <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg sm:rounded-xl border border-gray-200 hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Jobs</p>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{stats.totalJobs}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {stats.totalOpenings} total openings
            </p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-[#2D9AA5]/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#2D9AA5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8zM16 10h.01M12 14h.01M8 14h.01M8 10h.01" />
            </svg>
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg sm:rounded-xl border border-gray-200 hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Active Jobs</p>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-green-600 mt-1">{stats.activeJobs}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {stats.totalJobs > 0 ? Math.round((stats.activeJobs / stats.totalJobs) * 100) : 0}% of total
            </p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Inactive Jobs */}
      <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg sm:rounded-xl border border-gray-200 hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Inactive Jobs</p>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-orange-600 mt-1">{stats.inactiveJobs}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {stats.totalJobs > 0 ? Math.round((stats.inactiveJobs / stats.totalJobs) * 100) : 0}% of total
            </p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-orange-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
        </div>
      </div>

      {/* Job Types Count */}
      <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg sm:rounded-xl border border-gray-200 hover:shadow-lg transition-shadow duration-200 xs:col-span-2 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Job Types</p>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#2D9AA5] mt-1">{Object.keys(stats.jobTypeStats).length}</p>
            <p className="text-xs text-gray-500 mt-1">Different categories</p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-[#2D9AA5]/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#2D9AA5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    {/* Job Types Pie Chart */}
    {sortedJobTypes.length > 0 && (
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Job Types Distribution</h3>
          <span className="text-xs sm:text-sm text-gray-500">{stats.totalJobs} total jobs</span>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {/* Pie Chart */}
          <div className="h-64 sm:h-80 md:h-96 lg:h-[420px] flex items-center justify-center order-2 xl:order-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="pieGrad1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2D9AA5" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                  <linearGradient id="pieGrad2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient id="pieGrad3" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                  <linearGradient id="pieGrad4" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <linearGradient id="pieGrad5" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                  <linearGradient id="pieGrad6" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
                <Pie
                  data={sortedJobTypes.map(([jobType, count],) => ({
                    name: jobType,
                    value: count,
                    percentage: stats.totalJobs > 0 ? Math.round((count / stats.totalJobs) * 100) : 0
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage}) => {
                    if (window.innerWidth < 640) return `${percentage}%`;
                    if (window.innerWidth < 768) return `${name.length > 8 ? name.substring(0, 8) + '...' : name} (${percentage}%)`;
                    return `${name} (${percentage}%)`;
                  }}
                  innerRadius={window.innerWidth < 640 ? 40 : window.innerWidth < 768 ? 60 : pieInnerRadius}
                  outerRadius={window.innerWidth < 640 ? 80 : window.innerWidth < 768 ? 100 : pieOuterRadius}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sortedJobTypes.map((_, index) => {
                    const fills = [
                      'url(#pieGrad1)',
                      'url(#pieGrad2)',
                      'url(#pieGrad3)',
                      'url(#pieGrad4)',
                      'url(#pieGrad5)',
                      'url(#pieGrad6)'
                    ];
                    return <Cell key={`cell-${index}`} fill={fills[index % fills.length]} stroke="#ffffff" strokeWidth={1} />;
                  })}
                  <Label 
                    value={`${stats.totalJobs} Jobs`} 
                    position="center" 
                    fill="#111827" 
                    fontSize={window.innerWidth < 640 ? 12 : window.innerWidth < 768 ? 14 : 16} 
                  />
                </Pie>
                {/* Removed Tooltip to show data always */}
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with always visible data */}
          <div className="space-y-2 sm:space-y-3 lg:space-y-4 order-1 xl:order-2">
            {sortedJobTypes.map(([jobType, count], index) => {
              const percentage = stats.totalJobs > 0 ? (count / stats.totalJobs) * 100 : 0;
              const colors = [
                'bg-[#2D9AA5]',
                'bg-green-500', 
                'bg-purple-500',
                'bg-orange-500',
                'bg-pink-500',
                'bg-indigo-500'
              ];
              
              return (
                <div key={jobType} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors[index % colors.length]}`}></div>
                    <span className="font-medium text-gray-700 flex-1 text-xs sm:text-sm md:text-base truncate" title={jobType}>{jobType}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    <div className="w-12 sm:w-16 md:w-24 lg:w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${colors[index % colors.length]}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-right min-w-[45px] sm:min-w-[50px] md:min-w-[60px]">
                      <span className="font-bold text-gray-900 text-xs sm:text-sm md:text-base">{count}</span>
                      <span className="text-xs sm:text-sm text-gray-500 ml-1">({Math.round(percentage)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(stats.jobTypeStats).length === 0 && (
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm sm:text-base text-gray-500">No job types data available</p>
          </div>
        )}

        {/* Top Jobs by Applications */}
        <div className="mt-4 sm:mt-6 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className="text-sm sm:text-base font-semibold text-gray-900">Top Jobs by Applications</h4>
            {applicationsLoading ? (
              <span className="text-xs sm:text-sm text-gray-500">Loading…</span>
            ) : (
              <span className="text-xs sm:text-sm text-gray-500">Top 3</span>
            )}
          </div>
          {applicationsError && (
            <div className="text-black mb-2 bg-red-50 border border-red-200 rounded p-2 text-xs sm:text-sm text-red-700">{applicationsError}</div>
          )}
          {(!applicationsLoading && topAppliedJobs.length === 0) ? (
            <p className="text-xs sm:text-sm text-gray-500">No applications yet</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {(applicationsLoading ? [] : topAppliedJobs).map((item) => (
                <div key={item.jobId} className="py-2 sm:py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm md:text-base font-medium text-gray-800 truncate" title={item.jobTitle}>{item.jobTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-1 rounded bg-[#2D9AA5]/10 text-[#2D9AA5] text-xs font-semibold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mini chart for top applied jobs with always visible data */}
          {!applicationsLoading && topAppliedJobs.length > 0 && (
            <div className="text-black mt-3 sm:mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Vertical Bar Chart with data labels */}
              <div className="h-48 sm:h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topAppliedJobs.map((item, idx) => ({
                      rank: `#${idx + 1}`,
                      name: item.jobTitle.length > (window.innerWidth < 640 ? 10 : nameMaxLen) 
                        ? item.jobTitle.substring(0, window.innerWidth < 640 ? 10 : nameMaxLen) + '…' 
                        : item.jobTitle,
                      applications: item.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 8, right: window.innerWidth < 640 ? 25 : 16, left: window.innerWidth < 640 ? 10 : 16, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="appsGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis type="number" tick={{ fontSize: window.innerWidth < 640 ? 10 : xAxisFontSize }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: window.innerWidth < 640 ? 10 : xAxisFontSize }} 
                      width={window.innerWidth < 640 ? 80 : (isSm || isMd) ? 140 : 110} 
                    />
                    {/* Removed Tooltip to show data always */}
                    <Bar dataKey="applications" fill="url(#appsGradient)" radius={[6, 6, 0, 0]} barSize={window.innerWidth < 640 ? 16 : 22}>
                      <LabelList 
                        dataKey="applications" 
                        position="right" 
                        formatter={(label) => `${label as string}`} 
                        style={{ fontSize: `${window.innerWidth < 640 ? 10 : xAxisFontSize}px` }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Donut share of applications with data labels */}
              <div className="h-48 sm:h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="appsDonut1" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#2D9AA5" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                      <linearGradient id="appsDonut2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                      <linearGradient id="appsDonut3" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={topAppliedJobs.map((i) => ({ name: i.jobTitle, value: i.count }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={window.innerWidth < 640 ? 40 : window.innerWidth < 768 ? 50 : isMd ? 70 : 60}
                      outerRadius={window.innerWidth < 640 ? 70 : window.innerWidth < 768 ? 80 : isMd ? 100 : 85}
                      labelLine={false}
                      label={({ value}) => {
                        const percentage = Math.round(((value as number) / Math.max(totalTopApplications, 1)) * 100);
                        if (window.innerWidth < 640) return `${percentage}%`;
                        return `${percentage}% (${value})`;
                      }}
                    >
                      {topAppliedJobs.map((_, idx) => (
                        <Cell key={`apps-slice-${idx}`} fill={`url(#appsDonut${(idx % 3) + 1})`} stroke="#ffffff" strokeWidth={1} />
                      ))}
                    </Pie>
                    {/* Removed Tooltip to show data always */}
                    <Legend 
                      wrapperStyle={{ 
                        fontSize: `${window.innerWidth < 640 ? 10 : legendFontSize}px`,
                        bottom: 0
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Blog Statistics with Bar Chart */}
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Blog Statistics</h3>
        {blogLoading ? (
          <span className="text-xs sm:text-sm text-gray-500">Loading…</span>
        ) : (
          <span className="text-xs sm:text-sm text-gray-500">{totalBlogs} total blogs</span>
        )}
      </div>

      {blogError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs sm:text-sm text-red-700">
          {blogError}
        </div>
      )}

      {/* Blog summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Blogs</p>
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{totalBlogs}</p>
            </div>
            <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-[#2D9AA5]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#2D9AA5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg border border-gray-200">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2 sm:mb-3">Top 3 Most Liked</p>
          <div className="space-y-1 sm:space-y-2">
            {(blogLoading ? [] : topLikedBlogs).map((b) => (
              <div key={b._id} className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-gray-800 truncate flex-1" title={b.title}>{b.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-[#2D9AA5]">{b.likesCount || 0}</span>
                </div>
              </div>
            ))}
            {!blogLoading && topLikedBlogs.length === 0 && (
              <p className="text-xs sm:text-sm text-gray-500">No data</p>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-3 sm:p-4 lg:p-5 rounded-lg border border-gray-200 sm:col-span-2 lg:col-span-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2 sm:mb-3">Top 3 Most Commented</p>
          <div className="space-y-1 sm:space-y-2">
            {(blogLoading ? [] : topCommentedBlogs).map((b) => (
              <div key={b._id} className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-gray-800 truncate flex-1" title={b.title}>{b.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-green-700">{b.commentsCount || 0}</span>
                </div>
              </div>
            ))}
            {!blogLoading && topCommentedBlogs.length === 0 && (
              <p className="text-xs sm:text-sm text-gray-500">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Bar Chart for Blog Performance with always visible data */}
      {!blogLoading && (topLikedBlogs.length > 0 || topCommentedBlogs.length > 0) && (
        <div className="text-black h-48 sm:h-64 md:h-72 lg:h-80 xl:h-96 mt-4 sm:mt-6">
          <h4 className="text-xs sm:text-sm md:text-base font-semibold text-gray-700 mb-3 sm:mb-4">Blog Engagement Overview</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                ...topLikedBlogs.map(blog => ({
                  name: blog.title.length > (window.innerWidth < 640 ? 10 : nameMaxLen) 
                    ? blog.title.substring(0, window.innerWidth < 640 ? 10 : nameMaxLen) + '...' 
                    : blog.title,
                  likes: blog.likesCount || 0,
                  comments: topCommentedBlogs.find(c => c._id === blog._id)?.commentsCount || 0
                })),
                ...topCommentedBlogs
                  .filter(blog => !topLikedBlogs.find(l => l._id === blog._id))
                  .map(blog => ({
                    name: blog.title.length > (window.innerWidth < 640 ? 10 : nameMaxLen) 
                      ? blog.title.substring(0, window.innerWidth < 640 ? 10 : nameMaxLen) + '...' 
                      : blog.title,
                    likes: 0,
                    comments: blog.commentsCount || 0
                  }))
              ].slice(0, window.innerWidth < 640 ? 3 : barCount)}
              margin={{
                top: 10,
                right: window.innerWidth < 640 ? 20 : (isSm || isMd) ? 30 : 10,
                left: window.innerWidth < 640 ? 5 : (isSm || isMd) ? 20 : 10,
                bottom: window.innerWidth < 640 ? 40 : (isSm || isMd) ? 60 : 40,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: window.innerWidth < 640 ? 9 : xAxisFontSize }}
                angle={window.innerWidth < 640 ? -90 : isMd ? -45 : -60}
                textAnchor="end"
                height={window.innerWidth < 640 ? 50 : (isSm || isMd) ? 80 : 60}
                interval={0}
              />
              <YAxis tick={{ fontSize: window.innerWidth < 640 ? 9 : yAxisFontSize }} />
              
              {/* Removed Tooltip to show data always */}
              
              <Legend 
                wrapperStyle={{ 
                  fontSize: `${window.innerWidth < 640 ? 10 : legendFontSize}px` 
                }} 
              />
              <Bar dataKey="likes" fill="#2D9AA5" name="Likes" radius={[2, 2, 0, 0]}>
                <LabelList 
                  dataKey="likes" 
                  position="top" 
                  style={{ fontSize: window.innerWidth < 640 ? 9 : tooltipFontSize }} 
                />
              </Bar>
              <Bar dataKey="comments" fill="#22c55e" name="Comments" radius={[2, 2, 0, 0]}>
                <LabelList 
                  dataKey="comments" 
                  position="top" 
                  style={{ fontSize: window.innerWidth < 640 ? 9 : tooltipFontSize }} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>

    {/* Empty State */}
    {stats.totalJobs === 0 && (
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl border border-gray-200 text-center">
        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8zM16 10h.01M12 14h.01M8 14h.01M8 10h.01" />
          </svg>
        </div>
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-2">No Job Posts Yet</h3>
        <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-4">Create your first job posting to see statistics here.</p>
      </div>
    )}
  </div>
);
};

export default JobStats;