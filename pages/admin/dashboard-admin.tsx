import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/AdminLayout';
import withAdminAuth from '../../components/withAdminAuth';
import type { NextPageWithLayout } from '../_app';
import {
  HomeIcon,
  CheckCircleIcon,
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
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
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

const COLORS = ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af'];

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Update date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch dashboard stats
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  const radialData = stats ? [
    { name: 'Approved', value: (stats.clinics.approved + stats.doctors.approved + stats.jobs.approved), fill: '#10b981' },
    { name: 'Pending', value: (stats.clinics.pending + stats.doctors.pending + stats.jobs.pending), fill: '#f59e0b' },
    { name: 'Declined', value: stats.jobs.declined, fill: '#ef4444' },
  ] : [];

  const entityComparisonData = stats ? [
    { category: 'People', users: stats.users.total, doctors: stats.doctors.total, staff: stats.staff.total, agents: stats.agents.total },
    { category: 'Services', clinics: stats.clinics.total, treatments: stats.treatments.total, jobs: stats.jobs.total },
    { category: 'Content', blogs: stats.blogs.total, permissions: stats.permissions.total, callbacks: stats.callBackRequests.total },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-white rounded-lg shadow-sm"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-white rounded-lg shadow-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircleIcon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={fetchStats}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {getGreeting()}, Admin!
              </h1>
              <p className="text-gray-700 mb-4">
                Welcome back to your dashboard. Here's what's happening today.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(currentDateTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatTime(currentDateTime)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={fetchStats}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors self-start lg:self-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Users', value: stats?.users.total || 0, icon: UserGroupIcon, color: 'bg-gray-800' },
            { title: 'Total Clinics', value: stats?.clinics.total || 0, icon: HomeIcon, color: 'bg-gray-800' },
            { title: 'Total Doctors', value: stats?.doctors.total || 0, icon: UserGroupIcon, color: 'bg-gray-800' },
            { title: 'Total Blogs', value: stats?.blogs.total || 0, icon: NewspaperIcon, color: 'bg-gray-800' },
            { title: 'Job Postings', value: stats?.jobs.total || 0, icon: BriefcaseIcon, color: 'bg-gray-800' },
            { title: 'Call Requests', value: stats?.callBackRequests.total || 0, icon: PhoneIcon, color: 'bg-gray-800' },
            { title: 'Total Staff', value: stats?.staff.total || 0, icon: UserGroupIcon, color: 'bg-gray-800' },
            { title: 'Total Agents', value: stats?.agents.total || 0, icon: UserPlusIcon, color: 'bg-gray-800' },
            { title: 'Treatments', value: stats?.treatments.total || 0, icon: BeakerIcon, color: 'bg-gray-800' },
            { title: 'Permissions', value: stats?.permissions.total || 0, icon: Cog6ToothIcon, color: 'bg-gray-800' },
            { title: 'Pending Approvals', value: (stats?.clinics.pending || 0) + (stats?.doctors.pending || 0) + (stats?.jobs.pending || 0), icon: ClockIcon, color: 'bg-gray-800' },
            { title: 'Total Entities', value: (stats?.users.total || 0) + (stats?.clinics.total || 0) + (stats?.doctors.total || 0) + (stats?.blogs.total || 0) + (stats?.jobs.total || 0), icon: ChartBarIcon, color: 'bg-gray-800' },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.color} p-3 rounded-lg text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">{stat.title}</h3>
                <p className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        {/* Overview Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Platform Overview</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={overviewBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }} 
              />
              <Legend wrapperStyle={{ color: '#374151' }} />
              <Bar dataKey="value" fill="#1f2937" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Charts Grid - Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clinic Status Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Clinic Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clinicData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {clinicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }} />
                <Legend wrapperStyle={{ color: '#374151' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700">Total: {stats?.clinics.total || 0}</p>
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-700">Approved: {stats?.clinics.approved || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-sm text-gray-700">Pending: {stats?.clinics.pending || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Status Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Doctor Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={doctorData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {doctorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }} />
                <Legend wrapperStyle={{ color: '#374151' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700">Total: {stats?.doctors.total || 0}</p>
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-700">Approved: {stats?.doctors.approved || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-sm text-gray-700">Pending: {stats?.doctors.pending || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid - Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Status Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Job Posting Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={jobData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {jobData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }} />
                <Legend wrapperStyle={{ color: '#374151' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700">Total: {stats?.jobs.total || 0}</p>
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-700">Approved: {stats?.jobs.approved || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-sm text-gray-700">Pending: {stats?.jobs.pending || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-sm text-gray-700">Declined: {stats?.jobs.declined || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">User Type Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {userDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }} />
                <Legend wrapperStyle={{ color: '#374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Approval Status Comparison */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Approval Status Comparison</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={approvalStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }} 
              />
              <Legend wrapperStyle={{ color: '#374151' }} />
              <Bar dataKey="approved" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Charts Grid - Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Comparison Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Comparison</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staffComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#374151" />
                <YAxis stroke="#374151" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#374151'
                  }} 
                />
                <Bar dataKey="value" fill="#1f2937" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Content & Services Line Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Content & Services Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={contentServicesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#374151" />
                <YAxis stroke="#374151" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#374151'
                  }} 
                />
                <Line type="monotone" dataKey="value" stroke="#1f2937" strokeWidth={3} dot={{ fill: '#1f2937', r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Content & Services Area Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Content & Services Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={contentServicesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }} 
              />
              <Area type="monotone" dataKey="value" stroke="#1f2937" fill="#1f2937" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Composed Chart - Total Approvals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Complete Approval Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={totalApprovalsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }} 
              />
              <Legend wrapperStyle={{ color: '#374151' }} />
              <Bar dataKey="approved" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              <Bar dataKey="declined" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Entity Comparison Multi-Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Entity Comparison by Category</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={entityComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151'
                }} 
              />
              <Legend wrapperStyle={{ color: '#374151' }} />
              <Bar dataKey="users" fill="#1f2937" radius={[8, 8, 0, 0]} />
              <Bar dataKey="doctors" fill="#374151" radius={[8, 8, 0, 0]} />
              <Bar dataKey="staff" fill="#4b5563" radius={[8, 8, 0, 0]} />
              <Bar dataKey="agents" fill="#6b7280" radius={[8, 8, 0, 0]} />
              <Bar dataKey="clinics" fill="#9ca3af" radius={[8, 8, 0, 0]} />
              <Bar dataKey="treatments" fill="#d1d5db" radius={[8, 8, 0, 0]} />
              <Bar dataKey="jobs" fill="#e5e7eb" radius={[8, 8, 0, 0]} />
              <Bar dataKey="blogs" fill="#f3f4f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="permissions" fill="#f9fafb" radius={[8, 8, 0, 0]} />
              <Bar dataKey="callbacks" fill="#111827" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
