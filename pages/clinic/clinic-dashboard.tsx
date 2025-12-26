import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Star, Mail, Settings, Lock, TrendingUp, Users, FileText, Briefcase, MessageSquare, Calendar, CreditCard, BarChart3, Activity, XCircle, CheckCircle2, ArrowUpRight, ArrowDownRight, User, Crown, Stethoscope, Building2, Package, Gift, DoorOpen, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, LineChart, Line, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import Stats from '../../components/Stats';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import type { NextPageWithLayout } from '../_app';
import axios from 'axios';

// Type definitions
interface Stats {
  totalReviews: number;
  totalEnquiries: number;
  totalClinics?: number;
  totalAppointments?: number;
  totalLeads?: number;
  totalTreatments?: number;
  totalRooms?: number;
  totalDepartments?: number;
  totalPackages?: number;
  totalOffers?: number;
  totalPatients?: number;
  totalJobs?: number;
  appointmentStatusBreakdown?: { [key: string]: number };
  leadStatusBreakdown?: { [key: string]: number };
  offerStatusBreakdown?: { [key: string]: number };
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
  const [stats, setStats] = useState<Stats>({
    totalReviews: 0,
    totalEnquiries: 0,
    totalClinics: 0,
    totalAppointments: 0,
    totalLeads: 0,
    totalTreatments: 0,
    totalRooms: 0,
    totalDepartments: 0,
    totalPackages: 0,
    totalOffers: 0,
    appointmentStatusBreakdown: {},
    leadStatusBreakdown: {},
    offerStatusBreakdown: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [clinicUser, setClinicUser] = useState<ClinicUser | null>(null);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats>({});
  const [allModules, setAllModules] = useState<NavigationItem[]>([]);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({});
  const [_permissions, setPermissions] = useState<SidebarResponse['permissions']>([]);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('You do not have permission to view this dashboard.');
  const [moduleAccess, setModuleAccess] = useState<{ canRead: boolean; canUpdate: boolean; canCreate: boolean }>({
    canRead: true,
    canUpdate: true,
    canCreate: true,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [navigationItemsLoaded, setNavigationItemsLoaded] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [quickActions] = useState([
    { label: 'New Review', icon: Star, path: '/clinic/getAllReview', color: 'bg-yellow-500' },
    { label: 'New Enquiry', icon: Mail, path: '/clinic/get-Enquiry', color: 'bg-blue-500' },
    { label: 'Add Staff', icon: Users, path: '/clinic/patient-information', color: 'bg-green-500' },
    { label: 'Create Blog', icon: FileText, path: '/clinic/BlogForm', color: 'bg-purple-500' },
    { label: 'Job Posting', icon: Briefcase, path: '/clinic/job-posting', color: 'bg-indigo-500' },
    { label: 'Create Agent', icon: UserPlus, path: '/admin/create-agent', color: 'bg-teal-500' },
    { label: 'Create Lead', icon: UserPlus, path: '/clinic/lead-create-lead', color: 'bg-orange-500' },
  ]);

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
          // Only set access denied if user is agent/doctorStaff and doesn't have permission
          // Don't set it for clinic/doctor roles as they have full access
          const role = getUserRole();
          if (['agent', 'doctorStaff'].includes(role || '')) {
          setAccessDenied(true);
          setAccessMessage('Your clinic account does not have permission to view this dashboard.');
          }
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

  // Token helpers (shared across agent and doctorStaff)
  const getAuthToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('clinicToken') ||
      sessionStorage.getItem('clinicToken') ||
      localStorage.getItem('agentToken') ||
      sessionStorage.getItem('agentToken') ||
      localStorage.getItem('userToken') ||
      sessionStorage.getItem('userToken')
    );
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getAuthToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [getAuthToken]);

  const getUserRole = useCallback((): string | null => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    } catch {
      return null;
    }
  }, [getAuthToken]);

  // Fetch module permissions for dashboard (applies to agent and doctorStaff)
  useEffect(() => {
    const fetchPermissions = async () => {
      const role = getUserRole();
      setUserRole(role);

      if (role === 'clinic' || role === 'doctor' || role === null) {
        setModuleAccess({ canRead: true, canUpdate: true, canCreate: true });
        setPermissionsLoaded(true);
        return;
      }

      if (!['agent', 'doctorStaff'].includes(role)) {
        setModuleAccess({ canRead: true, canUpdate: true, canCreate: true });
        setPermissionsLoaded(true);
        return;
      }

      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) {
          console.warn("⚠️ No authorization token found");
          setModuleAccess({ canRead: false, canUpdate: false, canCreate: false });
          setAccessDenied(true);
          setAccessMessage('Authentication required. Please log in again.');
          setPermissionsLoaded(true);
          return;
        }

        const res = await axios.get(
          '/api/agent/get-module-permissions?moduleKey=clinic_dashboard',
          { headers }
        );

        console.log("🔍 Full API response:", JSON.stringify(res.data, null, 2));

        if (res.data?.success && res.data.permissions) {
          const actions = res.data.permissions.actions || {};
          
          // Helper to convert value to boolean
          const toBool = (value: any): boolean => {
            if (value === true || value === false) return value;
            if (typeof value === "string") {
              const lowered = value.toLowerCase();
              return lowered === "true" || lowered === "1" || lowered === "yes";
            }
            return Boolean(value);
          };
          
          const canAll = toBool(actions.all);
          const canRead = toBool(actions.read);
          const canUpdate = toBool(actions.update);
          const canCreate = toBool(actions.create);
          
          console.log("📊 Dashboard permissions check:", {
            module: res.data.permissions.module,
            rawActions: actions,
            convertedActions: {
              all: canAll,
              read: canRead,
              update: canUpdate,
              create: canCreate,
            },
            finalAccess: {
              canRead: canAll || canRead,
              canUpdate: canAll || canUpdate,
              canCreate: canAll || canCreate,
            }
          });
          
          const finalCanRead = canAll || canRead;
          const finalCanUpdate = canAll || canUpdate;
          const finalCanCreate = canAll || canCreate;
          
          console.log("🔐 Setting moduleAccess:", {
            canRead: finalCanRead,
            canUpdate: finalCanUpdate,
            canCreate: finalCanCreate,
          });
          
          setModuleAccess({
            canRead: finalCanRead,
            canUpdate: finalCanUpdate,
            canCreate: finalCanCreate,
          });
          
          // Reset accessDenied if permission is granted
          if (finalCanRead) {
            console.log("✅ Access granted - setting accessDenied to false");
            setAccessDenied(false);
        } else {
            console.log("❌ Access denied - setting accessDenied to true");
            setAccessDenied(true);
            setAccessMessage('You do not have read permission for the clinic dashboard.');
          }
        } else {
          console.warn("⚠️ No permissions data received or success is false:", res.data);
          setModuleAccess({ canRead: false, canUpdate: false, canCreate: false });
          setAccessDenied(true);
          setAccessMessage('Unable to verify permissions. Access denied.');
        }
      } catch (error) {
        console.error('Error fetching dashboard permissions:', error);
        setModuleAccess({ canRead: false, canUpdate: false, canCreate: false });
        setAccessDenied(true);
        setAccessMessage('Error loading permissions. Please try again.');
      } finally {
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, [getAuthHeaders, getUserRole]);

  // Reset accessDenied when permissions are granted
  useEffect(() => {
    if (!permissionsLoaded) return;
    
    // For agent and doctorStaff, check if they have read permission
    if (['agent', 'doctorStaff'].includes(userRole || '')) {
      if (moduleAccess.canRead) {
        console.log("✅ Resetting accessDenied to false - read permission granted");
        setAccessDenied(false);
      } else {
        console.log("❌ Setting accessDenied to true - read permission denied");
        setAccessDenied(true);
        setAccessMessage('You do not have read permission for the clinic dashboard.');
      }
    } else {
      // For other roles (clinic, doctor, admin), always grant access
      setAccessDenied(false);
    }
  }, [permissionsLoaded, moduleAccess.canRead, userRole]);

  // Fetch sidebar navigation items (which already have permissions applied)
  useEffect(() => {
    if (!permissionsLoaded) return;
    
    // Only check access for agent and doctorStaff roles
    if (['agent', 'doctorStaff'].includes(userRole || '')) {
      console.log("🔍 Checking access for role:", userRole, "canRead:", moduleAccess.canRead);
      
      if (!moduleAccess.canRead) {
        console.log("❌ Access denied - moduleAccess.canRead is false");
      setAccessDenied(true);
        setAccessMessage('You do not have read permission for the clinic dashboard.');
      setLoading(false);
      setNavigationItemsLoaded(true);
      return;
      } else {
        console.log("✅ Access granted - moduleAccess.canRead is true");
        setAccessDenied(false);
      }
    } else {
      // For other roles (clinic, doctor, etc.), always grant access
      setAccessDenied(false);
    }

    const fetchNavigationItems = async (): Promise<void> => {
      try {
        // Check for multiple token types (clinicToken, userToken, agentToken, etc.)
        const token = 
          localStorage.getItem('clinicToken') || 
          sessionStorage.getItem('clinicToken') ||
          localStorage.getItem('userToken') || 
          sessionStorage.getItem('userToken') ||
          localStorage.getItem('agentToken') || 
          sessionStorage.getItem('agentToken') ||
          localStorage.getItem('doctorToken') || 
          sessionStorage.getItem('doctorToken') ||
          localStorage.getItem('adminToken') || 
          sessionStorage.getItem('adminToken');
          
        if (!token) {
          setNavigationItemsLoaded(true);
          return;
        }

        const res = await axios.get<SidebarResponse>('/api/clinic/sidebar-permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.navigationItems) {
          setNavigationItems(res.data.navigationItems);
          if (res.data.permissions) {
            setPermissions(res.data.permissions);
          }
          // If we successfully got navigation items, ensure access is not denied
          // (unless permissions explicitly deny it)
          if (['agent', 'doctorStaff'].includes(userRole || '')) {
            if (moduleAccess.canRead) {
              setAccessDenied(false);
            }
          } else {
            setAccessDenied(false);
          }
        }
        setNavigationItemsLoaded(true);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          // Only set access denied if user is agent/doctorStaff
          // and doesn't have read permission
          if (['agent', 'doctorStaff'].includes(userRole || '')) {
            if (!moduleAccess.canRead) {
          setAccessDenied(true);
          setAccessMessage('You do not have permission to view the dashboard modules.');
            }
          }
        } else {
          console.error('Error fetching navigation items:', error);
        }
        setNavigationItemsLoaded(true);
      }
    };

    fetchNavigationItems();
  }, [permissionsLoaded, moduleAccess.canRead, userRole]);

  // Fetch all available modules (to show restricted ones)
  useEffect(() => {
    if (!permissionsLoaded) return;
    
    // Only check access for agent and doctorStaff roles
    if (['agent', 'doctorStaff'].includes(userRole || '')) {
      if (!moduleAccess.canRead) {
      setAccessDenied(true);
        setAccessMessage('You do not have read permission for the clinic dashboard.');
      setLoading(false);
      return;
      } else {
        setAccessDenied(false);
      }
    } else {
      // For other roles, always grant access
      setAccessDenied(false);
    }

    const fetchAllModules = async (): Promise<void> => {
      try {
        // Check for multiple token types (clinicToken, userToken, agentToken, etc.)
        const token = 
          localStorage.getItem('clinicToken') || 
          sessionStorage.getItem('clinicToken') ||
          localStorage.getItem('userToken') || 
          sessionStorage.getItem('userToken') ||
          localStorage.getItem('agentToken') || 
          sessionStorage.getItem('agentToken') ||
          localStorage.getItem('doctorToken') || 
          sessionStorage.getItem('doctorToken') ||
          localStorage.getItem('adminToken') || 
          sessionStorage.getItem('adminToken');
          
        if (!token) return;

        const res = await axios.get<{ success: boolean; data: NavigationItem[] }>('/api/navigation/get-by-role?role=clinic', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.data) {
          setAllModules(res.data.data);
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          // Only set access denied if user is agent/doctorStaff and doesn't have read permission
          // Don't block access just because we can't fetch all modules
          if (['agent', 'doctorStaff'].includes(userRole || '')) {
            if (!moduleAccess.canRead) {
          setAccessDenied(true);
          setAccessMessage('Access to module information is restricted for your account.');
            }
          }
        } else {
          console.error('Error fetching all modules:', error);
        }
      }
    };

    fetchAllModules();
  }, [permissionsLoaded, moduleAccess.canRead, userRole]);

  // Fetch stats for each module
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (['agent', 'doctorStaff'].includes(userRole || '') && !moduleAccess.canRead) {
      setModuleStats({});
      setStatsLoading(false);
      return;
    }

    const fetchModuleStats = async (): Promise<void> => {
      setStatsLoading(true);
      const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
      if (!token) {
        setStatsLoading(false);
        return;
      }

      const statsMap: ModuleStats = {};
      let dashboardStatsData: Stats | null = null;

      // Fetch basic dashboard stats
      try {
        const res = await fetch('/api/clinics/dashboardStats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: DashboardStatsResponse = await res.json();
        if (data.success && data.stats) {
          dashboardStatsData = data.stats;
          setStats(data.stats);
          
          // Map dashboardStats API data to module keys
          // Common module key patterns
          statsMap['clinic_reviews'] = {
            value: data.stats.totalReviews || 0,
            label: 'Total Reviews',
            icon: <Star className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['reviews'] = {
            value: data.stats.totalReviews || 0,
            label: 'Total Reviews',
            icon: <Star className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_enquiries'] = {
            value: data.stats.totalEnquiries || 0,
            label: 'Total Enquiries',
            icon: <Mail className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['enquiries'] = {
            value: data.stats.totalEnquiries || 0,
            label: 'Total Enquiries',
            icon: <Mail className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_appointments'] = {
            value: data.stats.totalAppointments || 0,
            label: 'Total Appointments',
            icon: <Calendar className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['appointments'] = {
            value: data.stats.totalAppointments || 0,
            label: 'Total Appointments',
            icon: <Calendar className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_leads'] = {
            value: data.stats.totalLeads || 0,
            label: 'Total Leads',
            icon: <Users className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['leads'] = {
            value: data.stats.totalLeads || 0,
            label: 'Total Leads',
            icon: <Users className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_offers'] = {
            value: (data.stats.totalOffers || (data.stats as any).totaloffers) || 0,
            label: 'Total Offers',
            icon: <Gift className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['offers'] = {
            value: (data.stats.totalOffers || (data.stats as any).totaloffers) || 0,
            label: 'Total Offers',
            icon: <Gift className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_treatments'] = {
            value: data.stats.totalTreatments || 0,
            label: 'Total Treatments',
            icon: <Stethoscope className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['treatments'] = {
            value: data.stats.totalTreatments || 0,
            label: 'Total Treatments',
            icon: <Stethoscope className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_rooms'] = {
            value: data.stats.totalRooms || 0,
            label: 'Total Rooms',
            icon: <DoorOpen className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['rooms'] = {
            value: data.stats.totalRooms || 0,
            label: 'Total Rooms',
            icon: <DoorOpen className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['clinic_packages'] = {
            value: data.stats.totalPackages || 0,
            label: 'Total Packages',
            icon: <Package className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['packages'] = {
            value: data.stats.totalPackages || 0,
            label: 'Total Packages',
            icon: <Package className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          // Map specific modules for first graph
          statsMap['health_center'] = {
            value: 1, // Will be updated if clinic count is fetched
            label: 'Health Centers',
            icon: <Building2 className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['enquiry'] = {
            value: data.stats.totalEnquiries || 0,
            label: 'Total Enquiries',
            icon: <Mail className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['create_lead'] = {
            value: data.stats.totalLeads || 0,
            label: 'Total Leads',
            icon: <Users className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
          statsMap['assignedLead'] = {
            value: data.stats.totalLeads || 0,
            label: 'Assigned Leads',
            icon: <Users className="w-5 h-5" />,
            color: '#3b82f6',
            hasData: true,
          };
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }

      // Fetch stats for each navigation item based on moduleKey
      // First check if we already have data from dashboardStats, otherwise fetch from specific APIs
      const statsPromises = navigationItems.map(async (item) => {
        try {
          // If we already have data from dashboardStats, use it
          if (statsMap[item.moduleKey]) {
            return; // Already set, skip
          }

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
            case 'health_center':
              try {
                // For health center, show clinic count (usually 1, but could be more)
                const clinicRes = await axios.get('/api/clinics/myallClinic', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const clinics = clinicRes.data?.clinics || [];
                statValue = clinics.length || 1; // At least 1 if clinic exists
                statLabel = 'Health Centers';
                hasData = true;
              } catch (error) {
                console.error(`Error fetching health center for ${item.moduleKey}:`, error);
                statValue = 1; // Default to 1 if clinic exists
                hasData = true;
              }
              break;
            case 'create_agent':
              try {
                // Fetch agents count
                const agentsRes = await axios.get('/api/agent/get-all-agents', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const agents = agentsRes.data?.agents || agentsRes.data?.data || [];
                statValue = Array.isArray(agents) ? agents.length : 0;
                statLabel = 'Total Agents';
                hasData = true;
              } catch (error) {
                console.error(`Error fetching agents for ${item.moduleKey}:`, error);
                statValue = 0;
                hasData = false;
              }
              break;
            case 'create_lead':
            case 'assignedLead':
              // These are already covered by totalLeads from dashboardStats
              // But we can show specific counts if needed
              statValue = dashboardStatsData?.totalLeads || 0;
              statLabel = item.moduleKey === 'assignedLead' ? 'Assigned Leads' : 'Total Leads';
              hasData = (dashboardStatsData?.totalLeads || 0) > 0;
              break;
            case 'enquiry':
              // Enquiry module
              statValue = dashboardStatsData?.totalEnquiries || 0;
              statLabel = 'Total Enquiries';
              hasData = (dashboardStatsData?.totalEnquiries || 0) > 0;
              break;
            default:
              // For other modules, try to get from dashboardStatsData if available
              const moduleKeyLower = item.moduleKey.toLowerCase();
              if (moduleKeyLower.includes('enquiry')) {
                statValue = dashboardStatsData?.totalEnquiries || 0;
                statLabel = 'Total Enquiries';
                hasData = (dashboardStatsData?.totalEnquiries || 0) > 0;
              } else {
              statValue = 0;
              hasData = false;
              }
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
  }, [navigationItems, permissionsLoaded, moduleAccess.canRead, userRole]);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (['agent', 'doctorStaff'].includes(userRole || '') && !moduleAccess.canRead) {
      setStats({
        totalReviews: 0,
        totalEnquiries: 0,
        totalClinics: 0,
        totalAppointments: 0,
        totalLeads: 0,
        totalTreatments: 0,
        totalRooms: 0,
        totalDepartments: 0,
        totalPackages: 0,
        totalOffers: 0,
        appointmentStatusBreakdown: {},
        leadStatusBreakdown: {},
        offerStatusBreakdown: {},
      });
      setLoading(false);
      return;
    }

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
          setStats({
            totalReviews: 0,
            totalEnquiries: 0,
            totalClinics: 0,
            totalAppointments: 0,
            totalLeads: 0,
            totalTreatments: 0,
            totalRooms: 0,
            totalDepartments: 0,
            totalPackages: 0,
            totalOffers: 0,
            appointmentStatusBreakdown: {},
            leadStatusBreakdown: {},
            offerStatusBreakdown: {},
          });
        }
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setStats({
            totalReviews: 0,
            totalEnquiries: 0,
            totalClinics: 0,
            totalAppointments: 0,
            totalLeads: 0,
            totalTreatments: 0,
            totalRooms: 0,
            totalDepartments: 0,
            totalPackages: 0,
            totalOffers: 0,
            appointmentStatusBreakdown: {},
            leadStatusBreakdown: {},
            offerStatusBreakdown: {},
          });
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
  }, [permissionsLoaded, moduleAccess.canRead, userRole]);

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

  // Memoize permissions config to prevent unnecessary re-renders
  // Calculate permissions values first
  // For clinic/doctor roles, always allow access. For agent/doctorStaff, check modules
  const hasJobsPermission = useMemo(() => {
    // For clinic/doctor roles, always allow (don't wait for navigationItems)
    if (userRole === 'clinic' || userRole === 'doctor' || !userRole) {
      return true;
    }
    // For agent/doctorStaff, check modules (but default to true while loading)
    if (!navigationItemsLoaded) {
      return true; // Default to true while loading for agent/doctorStaff
    }
    return modulesWithPermission.some(key => key === 'clinic_jobs' || key === 'jobs');
  }, [modulesWithPermission, navigationItemsLoaded, userRole]);
  
  const hasBlogsPermission = useMemo(() => {
    // For clinic/doctor roles, always allow (don't wait for navigationItems)
    if (userRole === 'clinic' || userRole === 'doctor' || !userRole) {
      return true;
    }
    // For agent/doctorStaff, check modules (but default to true while loading)
    if (!navigationItemsLoaded) {
      return true; // Default to true while loading for agent/doctorStaff
    }
    return modulesWithPermission.some(key => key === 'clinic_blogs' || key === 'blogs');
  }, [modulesWithPermission, navigationItemsLoaded, userRole]);
  
  const hasApplicationsPermission = useMemo(() => {
    // For clinic/doctor roles, always allow (don't wait for navigationItems)
    if (userRole === 'clinic' || userRole === 'doctor' || !userRole) {
      return true;
    }
    // For agent/doctorStaff, check modules (but default to true while loading)
    if (!navigationItemsLoaded) {
      return true; // Default to true while loading for agent/doctorStaff
    }
    return modulesWithPermission.some(key => key === 'clinic_jobs' || key === 'jobs');
  }, [modulesWithPermission, navigationItemsLoaded, userRole]);

  // Create stable permissions object - only recreate when values actually change
  const statsPermissions = useMemo(() => ({
    canAccessJobs: hasJobsPermission,
    canAccessBlogs: hasBlogsPermission,
    canAccessApplications: hasApplicationsPermission,
  }), [hasJobsPermission, hasBlogsPermission, hasApplicationsPermission]);

  // Memoize the entire Stats config to prevent unnecessary re-fetches
  // This ensures the config object reference only changes when permissions actually change
  const statsConfig = useMemo(() => ({
    tokenKey: 'clinicToken' as const,
    primaryColor: '#3b82f6',
    permissions: statsPermissions
  }), [statsPermissions]);

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

  // Helper function to get value for a module
  const getModuleValue = useCallback((item: NavigationItem): number => {
    // First try to get from moduleStats
    const moduleStat = moduleStats[item.moduleKey];
    
    if (moduleStat?.value !== undefined && moduleStat.value !== null) {
      if (typeof moduleStat.value === 'number') {
        return moduleStat.value;
      } else if (typeof moduleStat.value === 'string') {
        const parsed = parseFloat(moduleStat.value);
        return isNaN(parsed) ? 0 : parsed;
      }
    }
    
    // Fallback: Map moduleKey to stats directly
    const moduleKeyLower = item.moduleKey.toLowerCase();
    
    // Direct moduleKey matching (most reliable)
    if (moduleKeyLower.includes('review') || moduleKeyLower === 'reviews' || moduleKeyLower === 'clinic_reviews') {
      return stats.totalReviews || 0;
    } else if (moduleKeyLower.includes('enquiry') || moduleKeyLower === 'enquiries' || moduleKeyLower === 'clinic_enquiries') {
      return stats.totalEnquiries || 0;
    } else if (moduleKeyLower.includes('appointment') || moduleKeyLower === 'appointments' || moduleKeyLower === 'clinic_appointments') {
      return stats.totalAppointments || 0;
    } else if (moduleKeyLower.includes('lead') || moduleKeyLower === 'leads' || moduleKeyLower === 'clinic_leads' || moduleKeyLower === 'assignedlead') {
      return stats.totalLeads || 0;
    } else if (moduleKeyLower.includes('offer') || moduleKeyLower === 'offers' || moduleKeyLower === 'clinic_offers') {
      return stats.totalOffers || 0;
    } else if (moduleKeyLower.includes('treatment') || moduleKeyLower === 'treatments' || moduleKeyLower === 'clinic_treatments') {
      return stats.totalTreatments || 0;
    } else if (moduleKeyLower.includes('room') || moduleKeyLower === 'rooms' || moduleKeyLower === 'clinic_rooms') {
      return stats.totalRooms || 0;
    } else if (moduleKeyLower.includes('package') || moduleKeyLower === 'packages' || moduleKeyLower === 'clinic_packages') {
      return stats.totalPackages || 0;
    } else if (moduleKeyLower.includes('department') || moduleKeyLower === 'departments' || moduleKeyLower === 'clinic_departments') {
      return stats.totalDepartments || 0;
    } else if (moduleKeyLower.includes('health') || moduleKeyLower === 'health_center') {
      // For health center, we might want to show clinic count or 1 if exists
      return 1; // Or you can fetch actual clinic count
    }
    
    // For modules like create_agent, create_lead, assignedLead - use moduleStats or default
    return moduleStat?.value as number || 0;
  }, [moduleStats, stats]);

  // First Graph (Bar Chart): Shows Appointments, Leads, Offers, Jobs
  const modulesChartData = useMemo(() => {
    // Use totalJobs from stats API (more accurate than moduleStats)
    const jobsCount = stats.totalJobs || 0;
    
    return [
      { name: 'Appointments', value: stats.totalAppointments || 0 },
      { name: 'Leads', value: stats.totalLeads || 0 },
      { name: 'Offers', value: stats.totalOffers || 0 },
      { name: 'Jobs', value: jobsCount },
    ].filter(item => item.value > 0 || !statsLoading); // Show items with data or while loading
  }, [stats.totalAppointments, stats.totalLeads, stats.totalOffers, stats.totalJobs, statsLoading]);

  // Second Graph (Line Chart): Shows Reviews, Enquiries, Patients, Rooms
  const statsChartData = useMemo(() => {
    return [
      { name: 'Reviews', value: stats.totalReviews || 0 },
      { name: 'Enquiries', value: stats.totalEnquiries || 0 },
      { name: 'Patients', value: stats.totalPatients || 0 },
      { name: 'Rooms', value: stats.totalRooms || 0 },
    ].filter(item => item.value > 0 || !statsLoading); // Only show items with data or while loading
  }, [stats.totalReviews, stats.totalEnquiries, stats.totalPatients, stats.totalRooms, statsLoading]);

  // Prepare breakdown chart data
  const appointmentStatusData = useMemo(() => {
    if (!stats.appointmentStatusBreakdown) return [];
    return Object.entries(stats.appointmentStatusBreakdown).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [stats.appointmentStatusBreakdown]);

  const leadStatusData = useMemo(() => {
    if (!stats.leadStatusBreakdown) return [];
    return Object.entries(stats.leadStatusBreakdown).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [stats.leadStatusBreakdown]);

  const offerStatusData = useMemo(() => {
    if (!stats.offerStatusBreakdown) return [];
    return Object.entries(stats.offerStatusBreakdown).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [stats.offerStatusBreakdown]);

  // Colors for pie charts
  const pieColors = ['#2D9AA5', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#6366f1', '#ef4444', '#10b981', '#3b82f6', '#f59e0b'];

  // Render stat card component - Enhanced modern design
  const renderStatCard = (
    label: string,
    value: number | string,
    icon: React.ReactNode,
    hasPermission: boolean = true,
    _moduleKey?: string,
    trend?: { value: number; isPositive: boolean }
  ) => {
    if (!hasPermission) {
      return (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-0.5 text-[10px] font-semibold rounded-full">
            LOCKED
          </div>
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                <Lock className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <h3 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase tracking-wide">{label}</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-start gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-medium text-gray-700 mb-0.5">
                    Subscription Required
                  </p>
                  <p className="text-[10px] text-gray-600 leading-relaxed">
                    Contact administrator
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden">
        <div className="absolute top-2 right-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          ACTIVE
        </div>
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg group-hover:from-gray-200 group-hover:to-gray-300 transition-all">
              <div className="text-gray-700">{icon}</div>
            </div>
            {trend && (
              <div className={`flex items-center gap-0.5 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span className="text-[10px] font-semibold">{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          <h3 className="text-[10px] font-medium text-gray-600 mb-1.5 uppercase tracking-wide">{label}</h3>
          {statsLoading ? (
            <div className="flex items-center gap-1.5">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-800"></div>
              <span className="text-[11px] text-gray-600">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{value}</p>
              {value === 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5">No data</p>
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
      {/* Modern Dashboard Layout */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Dashboard Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                    {clinicInfo.name || 'Clinic Dashboard'}
                  </h1>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>{clinicInfo.ownerName || clinicUser?.name || 'N/A'}</span>
                </div>
                <span>•</span>
                <span>{formatDate(currentTime)}</span>
                <span>•</span>
                  <span className="font-semibold">{formatTime(currentTime)}</span>
                </div>
                </div>
            <div className="bg-gray-900 text-white px-4 py-2 rounded-lg">
              <p className="text-sm font-medium">{getGreeting()}</p>
            </div>
          </div>
        </div>

        {/* Packages and Offers - Enhanced Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Packages Card */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl border-2 border-indigo-200 shadow-lg p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-2xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-200/30 to-purple-200/30 rounded-full blur-xl -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                    <Package className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Packages</h3>
                    <p className="text-xs text-gray-600">Total available packages</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-indigo-100 rounded-full">
                  <span className="text-xs font-semibold text-indigo-700">ACTIVE</span>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
                  {stats.totalPackages || 0}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span>Available packages</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-indigo-200/50">
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">Status:</span> Active
                </div>
              </div>
            </div>
          </div>

          {/* Offers Card */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-xl border-2 border-amber-200 shadow-lg p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-full blur-2xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-200/30 to-orange-200/30 rounded-full blur-xl -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                    <Gift className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Offers</h3>
                    <p className="text-xs text-gray-600">Current active offers</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-amber-100 rounded-full">
                  <span className="text-xs font-semibold text-amber-700">ACTIVE</span>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 mb-2">
                  {stats.totalOffers || 0}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span>Active offers</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-amber-200/50">
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">Status:</span> Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content - Full Width */}
        <div className="space-y-6 mb-6">
            {/* Key Statistics Row - Primary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {renderStatCard(
                'Total Reviews',
                stats.totalReviews,
                <Star className="w-5 h-5" />,
                true,
                'reviews'
              )}
              {renderStatCard(
                'Total Enquiries',
                stats.totalEnquiries,
                <Mail className="w-5 h-5" />,
                true,
                'enquiries'
              )}
              {renderStatCard(
                'Active Modules',
                navigationItems.length,
                <CheckCircle2 className="w-5 h-5" />,
                true,
                'modules'
              )}
              {renderStatCard(
                'Subscription',
                `${subscriptionSummary.subscriptionPercentage}%`,
                <Crown className="w-5 h-5" />,
                true,
                'subscription'
              )}
            </div>

            {/* Additional Statistics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {renderStatCard(
                'Appointments',
                stats.totalAppointments || 0,
                <Calendar className="w-5 h-5" />,
                true,
                'appointments'
              )}
              {renderStatCard(
                'Leads',
                stats.totalLeads || 0,
                <Users className="w-5 h-5" />,
                true,
                'leads'
              )}
              {renderStatCard(
                'Treatments',
                stats.totalTreatments || 0,
                <Stethoscope className="w-5 h-5" />,
                true,
                'treatments'
              )}
              {renderStatCard(
                'Rooms',
                stats.totalRooms || 0,
                <DoorOpen className="w-5 h-5" />,
                true,
                'rooms'
              )}
              {renderStatCard(
                'Departments',
                stats.totalDepartments || 0,
                <Building2 className="w-5 h-5" />,
                true,
                'departments'
              )}
                </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <a
                      key={idx}
                      href={action.path}
                      className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all group"
                    >
                      <div className={`p-2 ${action.color} rounded-lg mb-2 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-xs font-medium text-gray-700 text-center">{action.label}</p>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Status Breakdown Charts - Expanded */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Appointment Status Breakdown */}
              {appointmentStatusData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-6">Appointment Status</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={appointmentStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {appointmentStatusData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Lead Status Breakdown */}
              {leadStatusData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-6">Lead Status</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value" 
                        >
                          {leadStatusData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Offer Status Breakdown */}
              {offerStatusData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-6">Offer Status</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={offerStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {offerStatusData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Analytics Overview - Full Width */}
        {((stats.totalEnquiries > 0 || stats.totalReviews > 0 || (stats.totalAppointments || 0) > 0 || (stats.totalLeads || 0) > 0 || (stats.totalOffers || 0) > 0 || (stats.totalPatients || 0) > 0 || (stats.totalRooms || 0) > 0) || modulesChartData.length > 0 || statsChartData.length > 0) && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-6">Analytics Overview</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Bar Chart - Appointments, Leads, Offers, Jobs */}
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Appointments, Leads, Offers & Jobs</h4>
                {modulesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modulesChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                      angle={-45}
                      textAnchor="end"
                        height={60}
                    />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                        domain={[0, 'auto']}
                        type="number"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}
                        formatter={(value: number, name: string, props: any) => {
                          if (props.payload?.fullName) {
                            return [`${value}`, props.payload.fullName];
                          }
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3b82f6">
                      <LabelList
                        dataKey="value"
                        position="top"
                          fill="#3b82f6"
                        fontSize={11}
                        fontWeight={500}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Loading modules data...
              </div>
                )}
              </div>
              {/* Line Chart - Reviews, Enquiries, Patients, Rooms */}
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Reviews, Enquiries, Patients & Rooms</h4>
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
                      domain={[0, 'auto']}
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
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Active vs Inactive Graph */}
            <div className="h-80">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Active vs Inactive</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[
                    { name: 'Active', value: navigationItems.length, status: 'Active' },
                    { name: 'Inactive', value: restrictedModules.length, status: 'Inactive' },
                    { name: 'Total', value: allModules.length, status: 'Total' }
                  ]} 
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
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
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="#1f2937"
                      fontSize={11}
                      fontWeight={500}
                    />
                    {[
                      { name: 'Active', value: navigationItems.length, status: 'Active' },
                      { name: 'Inactive', value: restrictedModules.length, status: 'Inactive' },
                      { name: 'Total', value: allModules.length, status: 'Total' }
                    ].map((_entry, index) => {
                      const status = index === 0 ? 'Active' : index === 1 ? 'Inactive' : 'Total';
                      const fill = status === 'Active' ? '#22c55e' : status === 'Inactive' ? '#ef4444' : '#6366f1';
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Subscription Status - Enhanced Design */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Subscription Status</h3>
                <p className="text-xs text-gray-500">Manage your module access</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{subscriptionSummary.subscriptionPercentage}%</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Active Modules Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Active Modules</span>
                </div>
                <span className="text-2xl font-bold text-green-700">{navigationItems.length}</span>
              </div>
              <div className="w-full bg-green-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${subscriptionSummary.subscriptionPercentage}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {subscriptionSummary.subscriptionPercentage > 0 ? (
                  <span className="text-green-600 font-medium">✓ Fully operational</span>
                ) : (
                  <span className="text-gray-500">No active modules</span>
                )}
              </div>
            </div>

            {/* Subscription Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Subscription</span>
                </div>
                <span className="text-2xl font-bold text-blue-700">{subscriptionSummary.subscriptionPercentage}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${subscriptionSummary.subscriptionPercentage}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <span className="text-blue-600 font-medium">
                  {subscriptionSummary.subscribedModules} of {subscriptionSummary.totalModules} modules
                </span>
              </div>
            </div>

            {/* Locked Modules Card */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-400 rounded-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Locked Modules</span>
                </div>
                <span className="text-2xl font-bold text-gray-600">{subscriptionSummary.restrictedCount}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-gray-400 to-slate-400 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${100 - subscriptionSummary.subscriptionPercentage}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {subscriptionSummary.restrictedCount > 0 ? (
                  <span className="text-gray-600 font-medium">Requires upgrade</span>
                ) : (
                  <span className="text-green-600 font-medium">All unlocked</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Summary Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">Module Summary</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{subscriptionSummary.totalModules} Total</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="text-2xl font-bold text-green-700">{navigationItems.length}</div>
                <div className="text-xs text-gray-600 mt-1">Active</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-2xl font-bold text-gray-700">{subscriptionSummary.restrictedCount}</div>
                <div className="text-xs text-gray-600 mt-1">Locked</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{subscriptionSummary.subscriptionPercentage}%</div>
                <div className="text-xs text-gray-600 mt-1">Coverage</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="text-2xl font-bold text-purple-700">{subscriptionSummary.totalModules}</div>
                <div className="text-xs text-gray-600 mt-1">Total</div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Component - Job and Blog Analytics */}
        {/* Render after permissions are loaded - for clinic/doctor, this happens immediately */}
        {permissionsLoaded && (
          <Stats
            key={`stats-${permissionsLoaded}-${navigationItemsLoaded}-${userRole || 'default'}`}
            role="clinic"
            config={statsConfig}
          />
        )}
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
