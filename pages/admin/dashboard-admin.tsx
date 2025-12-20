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
  BoltIcon,
  CheckCircleIcon,
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
  
  // Quick Actions
  const quickActions = [
    { label: 'Approve Doctors', icon: UserGroupIcon, path: '/admin/approval-doctors', color: 'from-blue-500 to-blue-600' },
    { label: 'Manage Clinics', icon: HomeIcon, path: '/admin/approval-doctors', color: 'from-green-500 to-green-600' },
    { label: 'View Jobs', icon: BriefcaseIcon, path: '/admin/manage-job', color: 'from-purple-500 to-purple-600' },
    { label: 'Create Agent', icon: UserPlusIcon, path: '/admin/create-agent', color: 'from-indigo-500 to-indigo-600' },
  ];

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Enhanced Dashboard Header */}
      <div className="bg-gradient-to-r from-white via-gray-50 to-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-sm">
                <ChartBarIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">{getGreeting()}, Admin</h1>
                <p className="text-[10px] sm:text-[11px] text-gray-600 mt-0.5">Dashboard Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-gray-800 to-gray-900 px-2.5 py-1.5 rounded-lg text-white shadow-sm">
                  <span className="text-[10px]">{formatDate(currentDateTime)}</span>
                  <span className="text-gray-400">•</span>
                  <span className="font-semibold text-[10px]">{formatTime(currentDateTime)}</span>
                </div>
              </div>
              <button
                onClick={fetchStats}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md text-[11px] sm:text-[12px] ml-auto sm:ml-0"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 relative z-0">
        {/* Quick Actions Section - New Feature */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm mb-3 sm:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <BoltIcon className="w-4 h-4 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <a
                  key={idx}
                  href={action.path}
                  className="group relative bg-gradient-to-br from-gray-50 to-white rounded-lg p-2.5 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-br ${action.color} opacity-10 blur-lg`}></div>
                  <div className="relative">
                    <div className={`inline-flex p-1.5 bg-gradient-to-br ${action.color} rounded-lg mb-1.5 shadow-sm group-hover:scale-110 transition-transform`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-gray-800 group-hover:text-gray-900">{action.label}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Priority Stats Row - Enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
          {priorityStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className={`bg-gradient-to-br from-white to-gray-50 rounded-xl border ${stat.borderColor} p-3 sm:p-4 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group`}
              >
                <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bgColor} rounded-full -mr-8 -mt-8 opacity-40 blur-xl`}></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`${stat.bgColor} p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                    </div>
                    {stat.badge && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${stat.badge === 'Attention Needed' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                        {stat.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[10px] sm:text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wide">{stat.title}</h3>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-3 sm:mb-4">
          <div className="flex flex-wrap border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 font-semibold text-[11px] sm:text-[12px] transition-all ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-b from-blue-50 to-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 font-semibold text-[11px] sm:text-[12px] transition-all relative ${
                activeTab === 'approvals'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-b from-blue-50 to-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Approvals
              {pendingApprovals > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm">
                  {pendingApprovals}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 font-semibold text-[11px] sm:text-[12px] transition-all ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-b from-blue-50 to-transparent'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Tab Content - Enhanced */}
          <div className="p-3 sm:p-4 lg:p-5">
            {activeTab === 'overview' && (
              <div className="space-y-3 sm:space-y-4">
                {/* Quick Stats Grid - Enhanced */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5">
                  {quickStats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-2.5 sm:p-3 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-center group"
                      >
                        <div className="p-1.5 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-1.5 group-hover:scale-110 transition-transform inline-block">
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900 mb-0.5">{stat.value.toLocaleString()}</p>
                        <p className="text-[9px] sm:text-[10px] text-gray-600 font-medium">{stat.title}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Main Chart - Enhanced */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <ChartBarIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Platform Overview</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
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

                {/* Two Column Charts - Enhanced */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <UserGroupIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h2 className="text-sm font-bold text-gray-900">Team Comparison</h2>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
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

                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                        <BeakerIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h2 className="text-sm font-bold text-gray-900">Content & Services</h2>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
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
              <div className="space-y-3 sm:space-y-4">
                {/* Approval Status Cards - Enhanced */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-green-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Clinics</h3>
                      <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                        <HomeIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Approved</span>
                        <span className="text-lg sm:text-xl font-bold text-green-600">{stats?.clinics.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Pending</span>
                        <span className="text-lg sm:text-xl font-bold text-amber-600">{stats?.clinics.pending || 0}</span>
                      </div>
                      <div className="text-center pt-1.5 border-t border-gray-200">
                        <span className="text-[10px] text-gray-500">Total: </span>
                        <span className="text-sm sm:text-base font-bold text-gray-900">{stats?.clinics.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-purple-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Doctors</h3>
                      <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <UserGroupIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Approved</span>
                        <span className="text-lg sm:text-xl font-bold text-green-600">{stats?.doctors.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Pending</span>
                        <span className="text-lg sm:text-xl font-bold text-amber-600">{stats?.doctors.pending || 0}</span>
                      </div>
                      <div className="text-center pt-1.5 border-t border-gray-200">
                        <span className="text-[10px] text-gray-500">Total: </span>
                        <span className="text-sm sm:text-base font-bold text-gray-900">{stats?.doctors.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-blue-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Jobs</h3>
                      <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                        <BriefcaseIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Approved</span>
                        <span className="text-lg sm:text-xl font-bold text-green-600">{stats?.jobs.approved || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Pending</span>
                        <span className="text-lg sm:text-xl font-bold text-amber-600">{stats?.jobs.pending || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border border-red-200">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">Declined</span>
                        <span className="text-lg sm:text-xl font-bold text-red-600">{stats?.jobs.declined || 0}</span>
                      </div>
                      <div className="text-center pt-1.5 border-t border-gray-200">
                        <span className="text-[10px] text-gray-500">Total: </span>
                        <span className="text-sm sm:text-base font-bold text-gray-900">{stats?.jobs.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approval Comparison Chart - Enhanced */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                      <ChartBarIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Approval Status Comparison</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
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

                {/* Pie Charts Row - Enhanced */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-[11px] sm:text-[12px] font-bold text-gray-900 mb-3 text-center uppercase tracking-wide">Clinic Status</h3>
                    <ResponsiveContainer width="100%" height={160}>
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
                    <div className="flex justify-center gap-3 mt-3 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                        <span className="font-medium">Approved</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                        <span className="font-medium">Pending</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-[11px] sm:text-[12px] font-bold text-gray-900 mb-3 text-center uppercase tracking-wide">Doctor Status</h3>
                    <ResponsiveContainer width="100%" height={160}>
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
                    <div className="flex justify-center gap-3 mt-3 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                        <span className="font-medium">Approved</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                        <span className="font-medium">Pending</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-[11px] sm:text-[12px] font-bold text-gray-900 mb-3 text-center uppercase tracking-wide">Job Status</h3>
                    <ResponsiveContainer width="100%" height={160}>
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
                    <div className="flex justify-center gap-2 mt-3 text-[9px] flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-medium">Approved</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="font-medium">Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="font-medium">Declined</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-3 sm:space-y-4">
                {/* User Distribution - Enhanced */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                      <UserGroupIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">User Type Distribution</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
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

                {/* Complete Approval Breakdown - Enhanced */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                      <ChartBarIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Complete Approval Breakdown</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
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

                {/* Entity Comparison - Enhanced */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <ChartBarIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Entity Comparison by Category</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
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
