//pages/clinic/Track-Members.jsx
'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  XCircle, Clock, RefreshCw,
  Image as ImageIcon, Calendar, Clock as ClockIcon,
  ChevronLeft, ChevronRight, Download,
  Maximize2, Minimize2, Play, Pause, Eye
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import ClinicLayout from '../../components/ClinicLayout';
import AgentDesktime from '../../components/AgentDesktime';
import DoctorDesktime from '../../components/DoctorDesktime';
import WorkSessionModal from '../../components/WorkSessionModal';

const TrackMembersPage = () => {
  const [agents, setAgents] = useState([]);
  const [doctorStaff, setDoctorStaff] = useState([]);
  const [activeTab, setActiveTab] = useState('agents');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [arrivalTimeMap, setArrivalTimeMap] = useState({});


  // Filter dropdown state
const [filteredAgents, setFilteredAgents] = useState([]);
const [filteredDoctors, setFilteredDoctors] = useState([]);
const [showAgentDropdown, setShowAgentDropdown] = useState(false);
const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
const [loading, setLoading] = useState(false);

  // Screenshot modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Work session modal state
  const [selectedWorkMember, setSelectedWorkMember] = useState(null);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  console.log('Selected work member ID for work session:', selectedWorkMember?._id);


  console.log('Active Tab:', activeTab);


  // Gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playInterval, setPlayInterval] = useState(null);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('clinicToken') ||
      localStorage.getItem('doctorToken') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('agentToken') ||
      null
    );
  };
  const token = getToken();

  const loadData = async (showToast = false) => {
    if (!token) {
      toast.error('Authentication required');
      setIsLoading(false);
      return;
    }
    try {
      setIsRefreshing(showToast);
      if (!showToast) setIsLoading(true);
      const [agentsRes, dsRes] = await Promise.all([
        axios.get('/api/lead-ms/get-agents?role=agent', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/lead-ms/get-agents?role=doctorStaff', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      setAgents(agentsRes?.data?.success ? agentsRes.data.agents || [] : []);
      console.log('agentsRes Response:', agentsRes);
      setDoctorStaff(dsRes?.data?.success ? dsRes.data.agents || [] : []);
      console.log('doctorStaff Response:', dsRes);
      if (showToast) toast.success('Team list refreshed');
    } catch (err) {
      console.error('Failed to load team members:', err);
      if (err.response?.status !== 403) {
        toast.error('Failed to load team members');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const getTodayArrivalTimeForUser = async (userId) => {
    try {
      const rolePath = activeTab === 'agents' ? 'agent' : 'doctor';

      const res = await axios.get(`/api/${rolePath}/work-session/today?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && res.data.data?.arrivalTime) {
        return new Date(res.data.data.arrivalTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return '—';
    } catch (err) {
      console.error('Failed to load arrival time:', err);
      return '—';
    }
  };

  const loadArrivalTimes = async (members) => {
    try {
      const results = await Promise.all(
        members.map(async (m) => {
          const arrivalTime = await getTodayArrivalTimeForUser(m._id);
          return { memberId: m._id, arrivalTime };
        })
      );
      const map = {};
      results.forEach(r => {
        map[r.memberId] = r.arrivalTime;
      });
      setArrivalTimeMap(map);
    } catch (err) {
      console.error("Failed to load arrival times:", err);
    }
  };


  useEffect(() => {
    if (token) loadData();
  }, [token]);

  useEffect(() => {
    if (currentList.length > 0) {
      loadArrivalTimes(currentList);
    }
  }, [activeTab, agents, doctorStaff]);

  const fetchScreenshots = async (memberId) => {
    if (!memberId) return;

    setLoadingScreenshots(true);
    setScreenshots([]);
    setSelectedImageIndex(0);

    try {
      // Determine endpoint based on active tab
      const endpoint = activeTab === 'agents'
        ? `/api/screenshot/agent/${memberId}`
        : `/api/screenshot/doctor/${memberId}`;
      console.log('[Debug] Fetching from:', endpoint);

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
          limit: 200
        }
      });
      if (response.data.success && response.data.screenshots.length > 0) {
        setScreenshots(response.data.screenshots);
        toast.success(`Loaded ${response.data.count} screenshots`);

        // Debug log
        console.log('[Debug] First screenshot:', response.data.screenshots[0]);
      } else {
        toast.error('No screenshots found for this period');
      }
    } catch (err) {
      console.error('Error fetching screenshots:', err);

      console.log('[Debug] Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.response?.config?.url
      });

      if (err.response?.status === 404) {
        toast.error('Screenshot endpoint not found. Contact administrator.');
      } else if (err.response?.status === 401) {
        toast.error('Unauthorized. Your session may have expired.');
      } else {
        toast.error(`Failed to load screenshots: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoadingScreenshots(false);
    }
  };

  // Start auto-play slideshow
  const startAutoPlay = () => {
    if (playInterval) {
      clearInterval(playInterval);
    }

    const interval = setInterval(() => {
      setSelectedImageIndex(prev => {
        if (prev >= screenshots.length - 1) {
          clearInterval(interval);
          setAutoPlay(false);
          return 0;
        }
        return prev + 1;
      });
    }, 3000); // 3 seconds per image

    setPlayInterval(interval);
    setAutoPlay(true);
  };

  // Stop auto-play
  const stopAutoPlay = () => {
    if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }
    setAutoPlay(false);
  };

  const handleViewImages = (member) => {
    setSelectedMember(member);
    fetchScreenshots(member._id);
  };

  // const handleViewWork = (member) => {
  //   setSelectedWorkMember(member);
  //   setWorkModalOpen(true);
  // };

  // const handleViewWork = (member) => {
  //   console.log('🔍 handleViewWork called:', {
  //     memberId: member._id,
  //     memberName: member.name,
  //     activeTab: activeTab, // Should be 'doctorStaff'
  //     userRole: activeTab === 'agents' ? 'agent' : 'doctor',
  //     token: token ? 'Present' : 'Missing'
  //   });

  //   setSelectedWorkMember(member);
  //   setWorkModalOpen(true);
  // };

  const handleViewWork = async (member) => {
    console.log('🔍 handleViewWork called:', {
      memberId: member._id,
      memberName: member.name,
      activeTab: activeTab,
      userRole: activeTab === 'agents' ? 'agent' : 'doctorStaff',
      tokenType: getTokenType() // Add this function
    });
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('🔓 Token payload:', {
          role: payload.role,
          id: payload.id,
          clinicId: payload.clinicId
        });
      } catch (e) {
        console.error('Cannot decode token:', e);
      }
    }

    setSelectedWorkMember(member);
    setWorkModalOpen(true);
  };

  const getTokenType = () => {
    if (typeof window === 'undefined') return 'none';

    if (localStorage.getItem('adminToken')) return 'adminToken';
    if (localStorage.getItem('clinicToken')) return 'clinicToken';
    if (localStorage.getItem('doctorToken')) return 'doctorToken';
    if (localStorage.getItem('agentToken')) return 'agentToken';

    return 'none';
  };


  const closeModal = () => {
    stopAutoPlay();
    setSelectedMember(null);
    setScreenshots([]);
    setSelectedImageIndex(0);
    setIsFullscreen(false);
  };

  const closeWorkModal = () => {
    setSelectedWorkMember(null);
  };

  const nextImage = () => {
    if (selectedImageIndex < screenshots.length - 1) {
      setSelectedImageIndex(prev => prev + 1);
    }
  };

  const prevImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(prev => prev - 1);
    }
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyDateFilter = () => {
    if (selectedMember) {
      fetchScreenshots(selectedMember._id);
    }
  };

  const downloadImage = (imageUrl, timestamp) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `screenshot-${new Date(timestamp).toISOString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };






  // const handleFilterAgents = (filterType) => {
  //   setShowAgentDropdown(false);

  //   if (filterType === 'mostProductive') {
  //     // Filter or sort agents for most productive
  //     const filteredAgents = [...agents].sort((a, b) => b.productivity - a.productivity);
  //     setFilteredAgents(filteredAgents);
  //     console.log('Filter: Most Productive Agents');
  //   } else if (filterType === 'leastProductive') {
  //     // Filter or sort agents for least productive
  //     const filteredAgents = [...agents].sort((a, b) => a.productivity - b.productivity);
  //     setFilteredAgents(filteredAgents);
  //     console.log('Filter: Least Productive Agents');
  //   } else {
  //     // Show all agents
  //     setFilteredAgents(agents);
  //     console.log('Filter: All Agents');
  //   }
  // };

  // const handleFilterDoctors = (filterType) => {
  //   setShowDoctorDropdown(false);

  //   if (filterType === 'mostProductive') {
  //     // Filter or sort doctors for most productive
  //   const filteredDoctors = [...doctorStaff].sort((a, b) => b.patientsTreated - a.patientsTreated);
  //     setFilteredDoctors(filteredDoctors);
  //     console.log('Filter: Most Productive Doctors');
  //   } else if (filterType === 'leastProductive') {
  //     // Filter or sort doctors for least productive
  //    const filteredDoctors = [...doctorStaff].sort((a, b) => a.patientsTreated - b.patientsTreated);
  //     setFilteredDoctors(filteredDoctors);
  //     console.log('Filter: Least Productive Doctors');
  //   } else {
  //     setFilteredDoctors(doctorStaff);
  //     console.log('Filter: All Doctors');
  //   }
  // };



const fetchProductivityData = async (role, filterType) => {
  try {
    setLoading(true);
    const response = await fetch(`/api/productivity?role=${role}&filter=${filterType}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    
    if (role === 'agent') {
      setFilteredAgents(data);
    } else {
      setFilteredDoctors(data);
    }
  } catch (error) {
    console.error('Error fetching productivity data:', error);
  } finally {
    setLoading(false);
  }
};

// Initial fetch when component mounts
useEffect(() => {
  fetchProductivityData('agent', 'all');
  fetchProductivityData('doctor', 'all');
}, []);

const handleFilterAgents = async (filterType) => {
  setShowAgentDropdown(false);
  await fetchProductivityData('agent', filterType);
};

const handleFilterDoctors = async (filterType) => {
  setShowDoctorDropdown(false);
  await fetchProductivityData('doctor', filterType);
};


  const currentList = activeTab === 'agents' ? agents : doctorStaff;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Track Members
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor agent activity and screenshots
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
        {/* <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'agents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Agents ({agents.length})
            </button>
            <button
              onClick={() => setActiveTab('doctorStaff')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'doctorStaff'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              Doctors ({doctorStaff.length})
            </button>
          </nav>
        </div> */}


        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'agents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Agents ({agents.length})
              </button>
              <button
                onClick={() => setActiveTab('doctorStaff')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'doctorStaff'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Doctors ({doctorStaff.length})
              </button>
            </nav>

            {/* Dropdown menu */}
            <div className="pr-4">
              {activeTab === 'agents' && (
                <div className="relative inline-block text-left">
                  <button
                    type="button"
                    className="inline-flex justify-center items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                  >
                    Filter Agents
                    <svg className="-mr-1 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {showAgentDropdown && (
                    <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="py-1">
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterAgents('mostProductive')}
                        >
                          Most Productive Agents
                        </a>
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterAgents('leastProductive')}
                        >
                          Least Productive Agents
                        </a>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterAgents('all')}
                        >
                          Show All Agents
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'doctorStaff' && (
                <div className="relative inline-block text-left">
                  <button
                    type="button"
                    className="inline-flex justify-center items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                  >
                    Filter Doctors
                    <svg className="-mr-1 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {showDoctorDropdown && (
                    <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="py-1">
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterDoctors('mostProductive')}
                        >
                          Most Productive Doctors
                        </a>
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterDoctors('leastProductive')}
                        >
                          Least Productive Doctors
                        </a>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <a
                          href="#"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleFilterDoctors('all')}
                        >
                          Show All Doctors
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Agent Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email / Agent ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Arrival Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  View Images
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  View Work-Session
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    No {activeTab === 'agents' ? 'agents' : 'doctors'} found
                  </td>
                </tr>
              ) : (
                currentList.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-900 flex items-center justify-center text-white font-semibold">
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.name || 'Unnamed'}

                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {member.email || member._id?.slice(-8) || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={member.declined ? 'declined' : member.isApproved ? 'approved' : 'pending'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {arrivalTimeMap[member._id] || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewImages(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
                        disabled={loadingScreenshots}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {loadingScreenshots ? 'Loading...' : 'View Images'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewWork(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Work Session
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Screenshot Viewer Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-xl w-full ${isFullscreen ? 'h-full max-h-full' : 'max-w-7xl max-h-[90vh]'} overflow-hidden flex flex-col`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-semibold">
                  {selectedMember.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Screenshots - {selectedMember.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeTab === 'agents' ? 'Agent' : 'Doctor Staff'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Date Filter */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-md">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    name="start"
                    value={dateRange.start}
                    onChange={handleDateRangeChange}
                    className="bg-transparent text-sm border-none outline-none w-32"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    name="end"
                    value={dateRange.end}
                    onChange={handleDateRangeChange}
                    className="bg-transparent text-sm border-none outline-none w-32"
                  />
                  <button
                    onClick={applyDateFilter}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>

                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            {/* Controls */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {screenshots.length} screenshots found
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={prevImage}
                    disabled={selectedImageIndex === 0}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="text-sm font-medium">
                    {selectedImageIndex + 1} / {screenshots.length}
                  </span>

                  <button
                    onClick={nextImage}
                    disabled={selectedImageIndex === screenshots.length - 1}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">

                {screenshots[selectedImageIndex] && (
                  <button
                    onClick={() => downloadImage(
                      screenshots[selectedImageIndex].url,
                      screenshots[selectedImageIndex].timestamp
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
              </div>
            </div>
            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Thumbnail Sidebar */}
              <div className={`w-48 border-r border-gray-200 dark:border-gray-700 overflow-y-auto ${isFullscreen ? 'hidden lg:block' : ''}`}>
                <div className="p-3">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Thumbnails
                  </h3>
                  <div className="space-y-2">
                    {screenshots.map((screenshot, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`w-full aspect-video relative rounded overflow-hidden border-2 transition-all ${index === selectedImageIndex
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                      >
                        <div className="absolute inset-0 bg-black/10 dark:bg-white/5" />
                        <img
                          src={screenshot.url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs text-white">
                            {new Date(screenshot.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Main Image Viewer */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {loadingScreenshots ? (
                  <div className="flex-1 flex justify-center items-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-300">Loading screenshots...</p>
                    </div>
                  </div>
                ) : screenshots.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center p-8">
                    <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No screenshots available
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                      No screenshots were captured for {selectedMember.name} during the selected period.
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                      <ClockIcon className="w-4 h-4" />
                      <span>Try adjusting the date range above</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Image Display */}
                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                      <div className="absolute top-4 left-4 z-10 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm">
                        <ClockIcon className="w-4 h-4 inline mr-2" />
                        {screenshots[selectedImageIndex] &&
                          new Date(screenshots[selectedImageIndex].timestamp).toLocaleString()}
                      </div>

                      <img
                        src={screenshots[selectedImageIndex]?.url}
                        alt={`Screenshot ${selectedImageIndex + 1}`}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://via.placeholder.com/800x600/1e40af/ffffff?text=Screenshot+${selectedImageIndex + 1}`;
                        }}
                      />

                      {/* Navigation Arrows */}
                      <button
                        onClick={prevImage}
                        disabled={selectedImageIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white transition-all"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>

                      <button
                        onClick={nextImage}
                        disabled={selectedImageIndex === screenshots.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white transition-all"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Work Session Viewer Modal */}
      {selectedWorkMember && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white font-semibold">
                  {selectedWorkMember.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Work Session - {selectedWorkMember.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeTab === 'agents' ? 'Agent' : 'Doctor Staff'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorkMember(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Work Session Modal */}
            <WorkSessionModal
              isOpen={!!selectedWorkMember}
              onClose={() => setSelectedWorkMember(null)}
              userId={selectedWorkMember?._id}
              userName={selectedWorkMember?.name}
              userRole={activeTab === 'agents' ? 'agent' : 'doctorStaff'}
              clinicToken={token}
            />




            {/* i am going to use AgentDesktime And DoctorDesktime component instead of WorkSessionModal for the work-session in track-members page */}

            {/* <div className="flex-1 overflow-auto">
              {activeTab === 'agents' ? (
                <AgentDesktime
                  agentId={selectedWorkMember._id}
                  agentName={selectedWorkMember.name}
                  clinicToken={token}
                />
              ) : (
                <DoctorDesktime
                  doctorStaffId={selectedWorkMember._id}
                  doctorStaffName={selectedWorkMember.name}
                  clinicToken={token}
                />
              )}
              </div> */}

          </div>
        </div>
      )}
    </div>
  );
};


const StatusBadge = ({ status }) => {
  const styles = {
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    declined: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  };
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {status === 'approved' ? 'Approved' : status === 'declined' ? 'Declined' : 'Pending'}
    </span>
  );
};

TrackMembersPage.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

export default TrackMembersPage;