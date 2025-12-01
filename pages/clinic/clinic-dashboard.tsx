import React, { useState, useEffect, useMemo } from 'react';
import { Star, Mail, Settings, Lock, TrendingUp, Users, FileText, Briefcase, MessageSquare, Calendar, CreditCard, BarChart3, Activity, CheckCircle2, XCircle, Crown, Building2, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend } from 'recharts';
import Stats from '../../components/Stats';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import type { NextPageWithLayout } from '../_app';
import Link from 'next/link';
import axios from 'axios';

// Type definitions
interface Stats {
  totalReviews: number;
  totalEnquiries: number;
  totalClinics?: number;
}

interface DashboardStatsResponse {
  success: boolean;
  stats: Stats;
  message?: string;
}

interface ClinicUser {
  name?: string;
  [key: string]: unknown;
}

interface ChartData {
  name: string;
  value: number;
}

interface NavigationItem {
  _id: string;
  label: string;
  path?: string;
  icon: string;
  description?: string;
  order: number;
  moduleKey: string;
  subModules?: Array<{
    name: string;
    path?: string;
    icon: string;
    order: number;
  }>;
}

interface SidebarResponse {
  success: boolean;
  navigationItems: NavigationItem[];
  permissions?: Array<{
    module: string;
    subModules?: Array<{
      name: string;
      actions: {
        all?: boolean;
        create?: boolean;
        read?: boolean;
        update?: boolean;
        delete?: boolean;
      };
    }>;
    actions: {
      all?: boolean;
      create?: boolean;
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  }>;
  clinicId?: string;
}

interface ModuleStats {
  [key: string]: {
    value: number | string;
    label: string;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
    error?: string;
    hasData?: boolean;
  };
}

interface ClinicInfo {
  name?: string;
  ownerName?: string;
}

const ClinicDashboard: NextPageWithLayout = () => {
  const [stats, setStats] = useState<Stats>({ totalReviews: 0, totalEnquiries: 0, totalClinics: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [clinicUser, setClinicUser] = useState<ClinicUser | null>(null);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats>({});
  const [allModules, setAllModules] = useState<NavigationItem[]>([]);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({});
  const [permissions, setPermissions] = useState<SidebarResponse['permissions']>([]);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('You do not have permission to view this dashboard.');

  // Icon mapping
  const iconMap: { [key: string]: React.ReactNode } = {
    '📊': <BarChart3 className="w-5 h-5" />,
    '👥': <Users className="w-5 h-5" />,
    '📝': <FileText className="w-5 h-5" />,
    '💼': <Briefcase className="w-5 h-5" />,
    '💬': <MessageSquare className="w-5 h-5" />,
    '📅': <Calendar className="w-5 h-5" />,
    '💳': <CreditCard className="w-5 h-5" />,
    '⭐': <Star className="w-5 h-5" />,
    '📧': <Mail className="w-5 h-5" />,
    '⚙️': <Settings className="w-5 h-5" />,
    '📈': <TrendingUp className="w-5 h-5" />,
    '🔒': <Lock className="w-5 h-5" />,
  };

  // Get clinic user data from localStorage (same as ClinicHeader)
  useEffect(() => {
    const clinicUserRaw = localStorage.getItem('clinicUser');
    if (clinicUserRaw) {
      try {
        const parsedUser = JSON.parse(clinicUserRaw);
        setClinicUser(parsedUser);
      } catch {
        // console.error('Error parsing clinic user data:', error);
      }
    }
  }, []);

  // Fetch clinic information (name and owner name)
  useEffect(() => {
    const fetchClinicInfo = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
        if (!token) return;

        const clinicRes = await axios.get('/api/clinics/myallClinic', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (clinicRes.data && clinicRes.data.clinics && clinicRes.data.clinics.length > 0) {
          const clinic = clinicRes.data.clinics[0];
          setClinicInfo({
            name: clinic.name || '',
            ownerName: clinicUser?.name || '',
          });
        } else {
          setClinicInfo({
            name: '',
            ownerName: clinicUser?.name || '',
          });
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setAccessDenied(true);
          setAccessMessage('Your clinic account does not have permission to view this dashboard.');
        } else {
          console.error('Error fetching clinic info:', error);
          setClinicInfo({
            name: '',
            ownerName: clinicUser?.name || '',
          });
        }
      }
    };

    if (clinicUser) {
      fetchClinicInfo();
    }
  }, [clinicUser]);

  // Fetch sidebar navigation items (which already have permissions applied)
  useEffect(() => {
    const fetchNavigationItems = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
        if (!token) return;

        const res = await axios.get<SidebarResponse>('/api/clinic/sidebar-permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.navigationItems) {
          setNavigationItems(res.data.navigationItems);
          if (res.data.permissions) {
            setPermissions(res.data.permissions);
          }
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setAccessDenied(true);
          setAccessMessage('You do not have permission to view the dashboard modules.');
        } else {
          console.error('Error fetching navigation items:', error);
        }
      }
    };

    fetchNavigationItems();
  }, []);

  // Fetch all available modules (to show restricted ones)
  useEffect(() => {
    const fetchAllModules = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
        if (!token) return;

        const res = await axios.get<{ success: boolean; data: NavigationItem[] }>('/api/navigation/get-by-role?role=clinic', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.data) {
          setAllModules(res.data.data);
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setAccessDenied(true);
          setAccessMessage('Access to module information is restricted for your account.');
        } else {
          console.error('Error fetching all modules:', error);
        }
      }
    };

    fetchAllModules();
  }, []);

  // Fetch stats for each module
  useEffect(() => {
    const fetchModuleStats = async (): Promise<void> => {
      setStatsLoading(true);
      const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
      if (!token) {
        setStatsLoading(false);
        return;
      }

      const statsMap: ModuleStats = {};

      // Fetch basic dashboard stats
      try {
        const res = await fetch('/api/clinics/dashboardStats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: DashboardStatsResponse = await res.json();
        if (data.success) {
          setStats(data.stats);
          
          // Map to module keys
          statsMap['clinic_reviews'] = {
            value: data.stats.totalReviews,
            label: 'Total Reviews',
            icon: <Star className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_enquiries'] = {
            value: data.stats.totalEnquiries,
            label: 'Total Enquiries',
            icon: <Mail className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }

      // Fetch stats for each navigation item based on moduleKey
      const statsPromises = navigationItems.map(async (item) => {
        try {
          let statValue: number | string = 0;
          let statLabel = item.label;
          let statColor = '#3b82f6';
          let hasData = false;

          // Map module keys to their stats endpoints
          switch (item.moduleKey) {
            case 'clinic_jobs':
            case 'jobs':
              try {
                const jobsRes = await axios.get('/api/job-postings/my-jobs', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const jobs = jobsRes.data.jobs || [];
                statValue = jobs.length;
                statLabel = 'Total Jobs';
                hasData = true;
              } catch (error) {
                console.error(`Error fetching jobs for ${item.moduleKey}:`, error);
                statValue = 0;
                hasData = false;
              }
              break;
            case 'clinic_blogs':
            case 'blogs':
              try {
                const blogsRes = await axios.get('/api/blog/published', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const blogs = blogsRes.data.blogs || [];
                statValue = blogs.length;
                statLabel = 'Total Blogs';
                hasData = true;
              } catch (error) {
                console.error(`Error fetching blogs for ${item.moduleKey}:`, error);
                statValue = 0;
                hasData = false;
              }
              break;
            case 'clinic_staff':
            case 'staff':
              try {
                const staffRes = await axios.get('/api/staff', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const staff = staffRes.data.staff || [];
                statValue = staff.length;
                statLabel = 'Total Staff';
                hasData = true;
              } catch (error) {
                console.error(`Error fetching staff for ${item.moduleKey}:`, error);
                statValue = 0;
                hasData = false;
              }
              break;
            default:
              // For other modules, mark as no data available
              statValue = 0;
              hasData = false;
          }

          statsMap[item.moduleKey] = {
            value: statValue,
            label: statLabel,
            icon: iconMap[item.icon] || <Activity className="w-5 h-5" />,
            color: statColor,
            hasData: hasData,
          };
        } catch (error) {
          console.error(`Error fetching stats for ${item.moduleKey}:`, error);
          statsMap[item.moduleKey] = {
            value: 0,
            label: item.label,
            icon: iconMap[item.icon] || <Activity className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: false,
          };
        }
      });

      await Promise.all(statsPromises);
      setModuleStats(statsMap);
      setStatsLoading(false);
    };

    if (navigationItems.length > 0) {
      fetchModuleStats();
    } else {
      setStatsLoading(false);
    }
  }, [navigationItems]);

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
        const res = await fetch('/api/clinics/dashboardStats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data: DashboardStatsResponse = await res.json();
        if (data.success) {
          setStats(data.stats);
        } else if (res.status === 403) {
          setStats({ totalReviews: 0, totalEnquiries: 0, totalClinics: 0 });
        }
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setStats({ totalReviews: 0, totalEnquiries: 0, totalClinics: 0 });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  const getGreeting = (): string => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get modules that have permission (from navigationItems)
  const modulesWithPermission = useMemo(() => {
    return navigationItems.map(item => item.moduleKey);
  }, [navigationItems]);

  // Get restricted modules (all modules minus modules with permission)
  const restrictedModules = useMemo(() => {
    const permissionKeys = new Set(modulesWithPermission);
    return allModules.filter(module => !permissionKeys.has(module.moduleKey));
  }, [allModules, modulesWithPermission]);

  // Calculate subscription summary (must be before any conditional returns)
  const subscriptionSummary = useMemo(() => {
    const totalModules = allModules.length;
    const subscribedModules = navigationItems.length; // Use navigationItems.length as they already have permissions
    const restrictedCount = restrictedModules.length;
    const subscriptionPercentage = totalModules > 0 ? Math.round((subscribedModules / totalModules) * 100) : 0;
    
    return {
      totalModules,
      subscribedModules,
      restrictedCount,
      subscriptionPercentage
    };
  }, [allModules, navigationItems, restrictedModules]);

  // Prepare chart data for graphical representation (must be before any conditional returns)
  const subscriptionChartData = useMemo(() => {
    return [
      { name: 'Active', value: subscriptionSummary.subscribedModules, color: '#1f2937' }, // gray-800
      { name: 'Locked', value: subscriptionSummary.restrictedCount, color: '#6b7280' },
    ];
  }, [subscriptionSummary]);

  const statsChartData = useMemo(() => {
    return [
      { name: 'Reviews', value: stats.totalReviews },
      { name: 'Enquiries', value: stats.totalEnquiries },
    ];
  }, [stats]);

  // Render stat card component - Professional minimal design matching sidebar theme
  const renderStatCard = (
    label: string,
    value: number | string,
    icon: React.ReactNode,
    hasPermission: boolean = true,
    moduleKey?: string
  ) => {
    if (!hasPermission) {
      return (
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 relative">
          <div className="absolute top-3 right-3 bg-gray-500 text-white px-2 py-1 text-xs font-semibold rounded">
            LOCKED
          </div>
          <div className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gray-100 rounded-lg">
                <Lock className="w-5 h-5 text-gray-500" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{label}</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Subscription Required
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    Contact administrator to enable this feature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group">
        <div className="absolute top-3 right-3 bg-gray-800 text-white px-2 py-1 text-xs font-semibold rounded flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          ACTIVE
        </div>
        <div className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
              <div className="text-gray-700">{icon}</div>
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-700 mb-2">{label}</h3>
          {statsLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800"></div>
              <span className="text-sm text-gray-700">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{value}</p>
              {value === 0 && (
                <p className="text-xs text-gray-700 mt-1">No data available</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Access Restricted</h2>
          <p className="text-sm text-gray-700">{accessMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="p-3 sm:p-4 lg:p-5 space-y-3 lg:space-y-4">
        {/* Professional Header - Compact */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-gray-700" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {clinicInfo.name || 'Clinic Dashboard'}
                </h1>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium">Owner:</span>
                  <span>{clinicInfo.ownerName || clinicUser?.name || 'N/A'}</span>
                </div>
                <span>•</span>
                <span>{formatDate(currentTime)}</span>
                <span>•</span>
                <span>{formatTime(currentTime)}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <p className="text-xs sm:text-sm font-medium text-gray-700">{getGreeting()}</p>
            </div>
          </div>
        </div>

        {/* Subscription Status Summary - Compact */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Subscription Overview</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Stats Cards - More compact */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-gray-800" />
                <span className="text-xs font-semibold text-gray-700">Active</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {navigationItems.length}
              </p>
              <p className="text-xs text-gray-700 mb-2">Active modules</p>
              <div className="bg-gray-100 rounded-full h-1.5">
                <div 
                  className="bg-gray-800 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${subscriptionSummary.subscriptionPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">Locked</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {subscriptionSummary.restrictedCount}
              </p>
              <p className="text-xs text-gray-700 mb-2">Not subscribed</p>
              <div className="bg-gray-100 rounded-full h-1.5">
                <div 
                  className="bg-gray-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${100 - subscriptionSummary.subscriptionPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-gray-700" />
                <span className="text-xs font-semibold text-gray-700">Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {subscriptionSummary.totalModules}
              </p>
              <p className="text-xs text-gray-700">Available modules</p>
            </div>

            {/* Compact Chart */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Distribution</h3>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subscriptionChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" fontSize={10} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#6b7280" 
                      fontSize={10}
                      width={50}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 4, 4, 0]}
                    >
                      {subscriptionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="right" 
                        style={{ fill: '#1f2937', fontSize: '11px', fontWeight: '500' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Key Statistics Section - Compact */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-gray-800" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Key Statistics</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Reviews Stat */}
            <div>
              {renderStatCard(
                'Total Reviews',
                stats.totalReviews,
                <Star className="w-5 h-5" />,
                true,
                'reviews'
              )}
            </div>

            {/* Enquiries Stat */}
            <div>
              {renderStatCard(
                'Total Enquiries',
                stats.totalEnquiries,
                <Mail className="w-5 h-5" />,
                true,
                'enquiries'
              )}
            </div>

            {/* Active Modules Count */}
            <div>
              {renderStatCard(
                'Active Modules',
                navigationItems.length,
                <CheckCircle2 className="w-5 h-5" />,
                true,
                'modules'
              )}
            </div>

            {/* Subscription Status */}
            <div>
              {renderStatCard(
                'Subscription',
                `${subscriptionSummary.subscriptionPercentage}%`,
                <Crown className="w-5 h-5" />,
                true,
                'subscription'
              )}
            </div>
          </div>
        </div>

        {/* Detailed Feature Breakdown Section - Compact */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Feature Breakdown</h2>
          </div>

          <div className="space-y-3">
            {/* Show modules with permissions */}
            {allModules.map((module) => {
              const modulePermission = permissions?.find(p => {
                const moduleKey = p.module;
                return moduleKey === module.moduleKey || 
                       moduleKey === module.moduleKey.replace('clinic_', '') ||
                       moduleKey === module.moduleKey.replace(/^(admin|clinic|doctor)_/, '');
              });

              const hasModulePermission = modulePermission && (
                modulePermission.actions?.read === true || 
                modulePermission.actions?.all === true
              );

              // Get all submodules from the module definition
              const allSubModules = module.subModules || [];
              
              // Get submodules that have permission
              const activeSubModules = allSubModules.filter(subModule => {
                if (!modulePermission) return false;
                
                // Check if module has "all" permission (grants all submodules)
                if (modulePermission.actions?.all === true) return true;
                
                // Check if submodule has explicit permission
                const subModulePerm = modulePermission.subModules?.find(sm => sm.name === subModule.name);
                return subModulePerm && (
                  subModulePerm.actions?.read === true || 
                  subModulePerm.actions?.all === true
                );
              });

              const lockedSubModules = allSubModules.filter(subModule => {
                if (!modulePermission) return true;
                
                // Check if module has "all" permission (grants all submodules)
                if (modulePermission.actions?.all === true) return false;
                
                // Check if submodule has explicit permission
                const subModulePerm = modulePermission.subModules?.find(sm => sm.name === subModule.name);
                return !subModulePerm || (
                  subModulePerm.actions?.read !== true && 
                  subModulePerm.actions?.all !== true
                );
              });

              return (
                <div key={module._id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-1.5 bg-gray-100 rounded-lg flex-shrink-0">
                        {iconMap[module.icon] || <Activity className="w-4 h-4 text-gray-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{module.label}</h3>
                        {module.description && (
                          <p className="text-xs text-gray-700 truncate">{module.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {hasModulePermission ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-semibold rounded border border-gray-300 whitespace-nowrap">
                          <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded border border-gray-300 whitespace-nowrap">
                          <Lock className="w-2.5 h-2.5 inline mr-1" />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>

                  {allSubModules.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {/* Active Submodules */}
                      {activeSubModules.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-700">
                              Active Features ({activeSubModules.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {activeSubModules.map((subModule, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                <CheckCircle2 className="w-4 h-4 text-gray-800 flex-shrink-0" />
                                <span className="text-sm text-gray-800">{subModule.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Locked Submodules */}
                      {lockedSubModules.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-700">
                              Locked Features ({lockedSubModules.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {lockedSubModules.map((subModule, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                <Lock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{subModule.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If no submodules but module is active */}
                      {allSubModules.length === 0 && hasModulePermission && (
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <CheckCircle2 className="w-4 h-4 text-gray-800" />
                          <span className="text-sm text-gray-800">All features are active</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* If module is completely locked */}
                  {!hasModulePermission && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          This entire module is locked. Contact administrator to subscribe.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Restricted Modules Section - Compact */}
        {restrictedModules.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Locked Modules</h2>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded border border-gray-300">
                {subscriptionSummary.restrictedCount} Locked
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {restrictedModules.map((item) => (
                <div key={item._id}>
                  {renderStatCard(
                    item.label,
                    0,
                    iconMap[item.icon] || <Activity className="w-5 h-5" />,
                    false,
                    item.moduleKey
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Overview Chart - Compact */}
        {(stats.totalEnquiries > 0 || stats.totalReviews > 0) && (
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Analytics Overview</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Bar Chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                      angle={-45}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#1f2937">
                      <LabelList
                        dataKey="value"
                        position="top"
                        fill="#1f2937"
                        fontSize={11}
                        fontWeight={500}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line Chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statsChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#1f2937" 
                      strokeWidth={2}
                      dot={{ fill: '#1f2937', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart Summary Cards - Compact */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 mb-0.5">Total Enquiries</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalEnquiries}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Mail className="w-4 h-4 text-gray-800" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 mb-0.5">Total Reviews</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalReviews}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Star className="w-4 h-4 text-gray-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats Component */}
        <Stats
          role="clinic"
          config={{
            tokenKey: 'clinicToken',
            primaryColor: '#3b82f6',
            permissions: {
              canAccessJobs: modulesWithPermission.some(key => 
                key === 'clinic_jobs' || key === 'jobs'
              ) || modulesWithPermission.length === 0,
              canAccessBlogs: modulesWithPermission.some(key => 
                key === 'clinic_blogs' || key === 'blogs'
              ) || modulesWithPermission.length === 0,
              canAccessApplications: modulesWithPermission.some(key => 
                key === 'clinic_jobs' || key === 'jobs'
              ) || modulesWithPermission.length === 0,
            }
          }}
        />
      </div>
    </div>
  );
};

ClinicDashboard.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

// Apply HOC and assign correct type
const ProtectedDashboard: NextPageWithLayout = withClinicAuth(ClinicDashboard);

// Reassign layout (TS-safe now)
ProtectedDashboard.getLayout = ClinicDashboard.getLayout;

export default ProtectedDashboard;