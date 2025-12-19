import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/AdminLayout';
import withAdminAuth from '../../components/withAdminAuth';
import type { NextPageWithLayout } from '../_app';
import {
  HomeIcon,
  UserGroupIcon,
  NewspaperIcon,
  ChartBarIcon,
  PhoneIcon,
  BriefcaseIcon,
  UserPlusIcon,
  Cog6ToothIcon,
  BeakerIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';

interface DashboardStats {
  users: { total: number };
  clinics: { pending: number; approved: number; total: number };
  doctors: { pending: number; approved: number; total: number };
  blogs: { total: number };
  jobs: { pending: number; approved: number; declined: number; total: number };
  callBackRequests: { total: number };
  staff: { total: number };
  agents: { total: number };
  treatments: { total: number };
  permissions: { total: number };
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'analytics'>('overview');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setError('No admin token found');
        return;
      }

      const res = await axios.get('/api/admin/dashboard-stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStats(res.data.stats);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getGreeting = () => {
    const hour = currentDateTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Prepare chart data
  const clinicData = stats ? [
    { name: 'Approved', value: stats.clinics.approved, fill: '#10b981' },
    { name: 'Pending', value: stats.clinics.pending, fill: '#f59e0b' },
  ] : [];

  const doctorData = stats ? [
    { name: 'Approved', value: stats.doctors.approved, fill: '#10b981' },
    { name: 'Pending', value: stats.doctors.pending, fill: '#f59e0b' },
  ] : [];

  const jobData = stats ? [
    { name: 'Approved', value: stats.jobs.approved, fill: '#10b981' },
    { name: 'Pending', value: stats.jobs.pending, fill: '#f59e0b' },
    { name: 'Declined', value: stats.jobs.declined, fill: '#ef4444' },
  ] : [];

  const overviewBarData = stats ? [
    { name: 'Users', value: stats.users.total },
    { name: 'Clinics', value: stats.clinics.total },
    { name: 'Doctors', value: stats.doctors.total },
    { name: 'Blogs', value: stats.blogs.total },
    { name: 'Jobs', value: stats.jobs.total },
    { name: 'Staff', value: stats.staff.total },
    { name: 'Agents', value: stats.agents.total },
    { name: 'Treatments', value: stats.treatments.total },
  ] : [];

  const staffComparisonData = stats ? [
    { name: 'Staff', value: stats.staff.total },
    { name: 'Agents', value: stats.agents.total },
    { name: 'Doctors', value: stats.doctors.total },
  ] : [];

  const approvalStatusData = stats ? [
    { name: 'Clinics', approved: stats.clinics.approved, pending: stats.clinics.pending },
    { name: 'Doctors', approved: stats.doctors.approved, pending: stats.doctors.pending },
    { name: 'Jobs', approved: stats.jobs.approved, pending: stats.jobs.pending },
  ] : [];

  const contentServicesData = stats ? [
    { name: 'Blogs', value: stats.blogs.total },
    { name: 'Treatments', value: stats.treatments.total },
    { name: 'Permissions', value: stats.permissions.total },
    { name: 'Call Requests', value: stats.callBackRequests.total },
  ] : [];

  const userDistributionData = stats ? [
    { name: 'Regular Users', value: stats.users.total, fill: '#1f2937' },
    { name: 'Doctors', value: stats.doctors.total, fill: '#374151' },
    { name: 'Staff', value: stats.staff.total, fill: '#4b5563' },
    { name: 'Agents', value: stats.agents.total, fill: '#6b7280' },
  ] : [];

  const totalApprovalsData = stats ? [
    { name: 'Clinics', approved: stats.clinics.approved, pending: stats.clinics.pending, declined: 0 },
    { name: 'Doctors', approved: stats.doctors.approved, pending: stats.doctors.pending, declined: 0 },
    { name: 'Jobs', approved: stats.jobs.approved, pending: stats.jobs.pending, declined: stats.jobs.declined },
  ] : [];

  const entityComparisonData = stats ? [
    { category: 'People', users: stats.users.total, doctors: stats.doctors.total, staff: stats.staff.total, agents: stats.agents.total },
    { category: 'Services', clinics: stats.clinics.total, treatments: stats.treatments.total, jobs: stats.jobs.total },
    { category: 'Content', blogs: stats.blogs.total, permissions: stats.permissions.total, callbacks: stats.callBackRequests.total },
  ] : [];

  const pendingApprovals = (stats?.clinics.pending || 0) + (stats?.doctors.pending || 0) + (stats?.jobs.pending || 0);
  const totalEntities = (stats?.users.total || 0) + (stats?.clinics.total || 0) + (stats?.doctors.total || 0) + (stats?.blogs.total || 0) + (stats?.jobs.total || 0);

  // Top priority stats
  const priorityStats = [
    { 
      title: 'Pending Approvals', 
      value: pendingApprovals, 
      icon: ClockIcon,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badge: pendingApprovals > 0 ? 'Attention Needed' : 'All Clear'
    },
    { 
      title: 'Total Users', 
      value: stats?.users.total || 0, 
      icon: UserGroupIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    { 
      title: 'Active Clinics', 
      value: stats?.clinics.total || 0, 
      icon: HomeIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    { 
      title: 'Doctors', 
      value: stats?.doctors.total || 0, 
      icon: UserGroupIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
  ];

  // Quick stats grid
  const quickStats = [
    { title: 'Blogs', value: stats?.blogs.total || 0, icon: NewspaperIcon },
    { title: 'Jobs', value: stats?.jobs.total || 0, icon: BriefcaseIcon },
    { title: 'Call Requests', value: stats?.callBackRequests.total || 0, icon: PhoneIcon },
    { title: 'Staff', value: stats?.staff.total || 0, icon: UserGroupIcon },
    { title: 'Agents', value: stats?.agents.total || 0, icon: UserPlusIcon },
    { title: 'Treatments', value: stats?.treatments.total || 0, icon: BeakerIcon },
    { title: 'Permissions', value: stats?.permissions.total || 0, icon: Cog6ToothIcon },
    { title: 'Total Entities', value: totalEntities, icon: ChartBarIcon },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
        <div className="max-w-[1920px] mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-24 bg-white rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border-2 border-red-100">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircleIcon className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={fetchStats}
            className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      {/* Dashboard Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 sm:py-5">
            <div className="flex items-center gap-4 sm:gap-6">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{getGreeting()}, Admin</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Dashboard Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg">
                  <span className="text-gray-600 text-xs sm:text-sm">{formatDate(currentDateTime)}</span>
                  <span className="text-gray-400">•</span>
                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">{formatTime(currentDateTime)}</span>
                </div>
              </div>
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow text-sm sm:text-base ml-auto sm:ml-0"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-0">
        {/* Priority Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {priorityStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className={`bg-white rounded-xl border-2 ${stat.borderColor} p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bgColor} rounded-full -mr-10 -mt-10 opacity-50`}></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`${stat.bgColor} p-2.5 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    {stat.badge && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.badge === 'Attention Needed' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {stat.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.title}</h3>
                  <p className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-wrap border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-6 py-4 font-semibold text-sm transition-colors relative ${
                activeTab === 'approvals'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Approvals
              {pendingApprovals > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {pendingApprovals}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {quickStats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors text-center"
                      >
                        <Icon className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                        <p className="text-xl font-bold text-gray-900 mb-1">{stat.value.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">{stat.title}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Main Chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Platform Overview</h2>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={overviewBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Two Column Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">Team Comparison</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={staffComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">Content & Services</h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={contentServicesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                        <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'approvals' && (
              <div className="space-y-6">
                {/* Approval Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Clinics</h3>
                      <HomeIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Approved</span>
                        <span className="text-xl font-bold text-green-600">{stats?.clinics.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Pending</span>
                        <span className="text-xl font-bold text-amber-600">{stats?.clinics.pending || 0}</span>
                      </div>
                      <div className="text-center pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-500">Total: </span>
                        <span className="text-lg font-bold text-gray-900">{stats?.clinics.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Doctors</h3>
                      <UserGroupIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Approved</span>
                        <span className="text-xl font-bold text-green-600">{stats?.doctors.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Pending</span>
                        <span className="text-xl font-bold text-amber-600">{stats?.doctors.pending || 0}</span>
                      </div>
                      <div className="text-center pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-500">Total: </span>
                        <span className="text-lg font-bold text-gray-900">{stats?.doctors.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Jobs</h3>
                      <BriefcaseIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Approved</span>
                        <span className="text-xl font-bold text-green-600">{stats?.jobs.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Pending</span>
                        <span className="text-xl font-bold text-amber-600">{stats?.jobs.pending || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Declined</span>
                        <span className="text-xl font-bold text-red-600">{stats?.jobs.declined || 0}</span>
                      </div>
                      <div className="text-center pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-500">Total: </span>
                        <span className="text-lg font-bold text-gray-900">{stats?.jobs.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approval Comparison Chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Approval Status Comparison</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={approvalStatusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="approved" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 text-center">Clinic Status</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={clinicData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {clinicData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span>Pending</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 text-center">Doctor Status</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={doctorData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {doctorData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span>Pending</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 text-center">Job Status</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={jobData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {jobData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-2 mt-4 text-xs flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Approved</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Declined</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {/* User Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">User Type Distribution</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={userDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {userDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Complete Approval Breakdown */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Complete Approval Breakdown</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={totalApprovalsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="approved" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="declined" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Entity Comparison */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Entity Comparison by Category</h2>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={entityComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="category" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="users" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="doctors" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="staff" fill="#ec4899" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="agents" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="clinics" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="treatments" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="jobs" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="blogs" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="permissions" fill="#64748b" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="callbacks" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

AdminDashboard.getLayout = function PageLayout(page: React.ReactNode) {
  return <AdminLayout>{page}</AdminLayout>;
};

const ProtectedDashboard: NextPageWithLayout = withAdminAuth(AdminDashboard);
ProtectedDashboard.getLayout = AdminDashboard.getLayout;

export default ProtectedDashboard;
