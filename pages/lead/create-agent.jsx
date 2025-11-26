'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  Users,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import CreateAgentModal from '../../components/CreateAgentModal';
import AgentPermissionModal from '../../components/AgentPermissionModal';
import DoctorTreatmentModal from '../../components/DoctorTreatmentModal';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { useAgentPermissions } from '../../hooks/useAgentPermissions';

const TOKEN_PRIORITY = [
  'clinicToken',
  'doctorToken',
  'agentToken',
  'staffToken',
  'adminToken',
];

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  for (const key of TOKEN_PRIORITY) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const ManageAgentsPage = () => {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [doctorStaff, setDoctorStaff] = useState([]);
  const [activeView, setActiveView] = useState('agents');
  const [menuAgentId, setMenuAgentId] = useState(null);
  const [passwordAgent, setPasswordAgent] = useState(null);
  const [permissionAgent, setPermissionAgent] = useState(null);
  const [treatmentAgent, setTreatmentAgent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState(null);

  // Get the appropriate token based on what's available (clinic > doctor > admin)
  // This ensures we use the correct token for the logged-in user
  const clinicToken = typeof window !== 'undefined' ? localStorage.getItem('clinicToken') : null;
  const doctorToken = typeof window !== 'undefined' ? localStorage.getItem('doctorToken') : null;
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
  
  // Determine which token to use based on what's available
  // Priority: clinicToken > doctorToken > adminToken
  const token = clinicToken || doctorToken || adminToken || agentToken;

  const [isAgentRoute, setIsAgentRoute] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const agentRoute =
      router.pathname?.startsWith('/agent/') ||
      window.location.pathname?.startsWith('/agent/');
    setIsAgentRoute(Boolean(agentToken) && agentRoute);
  }, [router.pathname, agentToken]);

  const { permissions: agentPermissions, loading: permissionsLoading } = useAgentPermissions(
    isAgentRoute ? 'create_agent' : null
  );

  const agentCanRead = agentPermissions.canRead || agentPermissions.canAll;
  const agentCanCreate = agentPermissions.canCreate || agentPermissions.canAll;
  const agentCanUpdate = agentPermissions.canUpdate || agentPermissions.canAll;
  const agentCanDelete = agentPermissions.canDelete || agentPermissions.canAll;

  const [clinicPerms, setClinicPerms] = useState({
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });
  const [clinicPermsLoading, setClinicPermsLoading] = useState(false);

  useEffect(() => {
    if (!clinicToken) return;
    setClinicPermsLoading(true);
    const headers = getAuthHeaders();
    if (!headers) {
      setClinicPerms({
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      });
      setClinicPermsLoading(false);
      return;
    }

    axios
      .get('/api/clinic/sidebar-permissions', { headers })
      .then(({ data }) => {
        const modulePerm =
          data?.permissions?.find(
            (perm) =>
              perm.module === 'clinic_create_agent' ||
              perm.module === 'create_agent' ||
              perm.module?.endsWith('create_agent')
          ) || {};
        const actions = modulePerm.actions || {};
        setClinicPerms({
          canCreate: actions.all === true || actions.create === true,
          canRead: actions.all === true || actions.read === true,
          canUpdate: actions.all === true || actions.update === true,
          canDelete: actions.all === true || actions.delete === true,
        });
      })
      .catch(() => {
        setClinicPerms({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
        });
      })
      .finally(() => setClinicPermsLoading(false));
  }, [clinicToken]);

  const isClinicUser = Boolean(clinicToken);
  const canClinicRead = clinicPerms.canRead;
  const canClinicCreate = clinicPerms.canCreate;
  const canClinicUpdate = clinicPerms.canUpdate;
  const canClinicDelete = clinicPerms.canDelete;

  const canRead = isAgentRoute ? agentCanRead : canClinicRead;
  const canCreate = isAgentRoute ? agentCanCreate : canClinicCreate;
  const canUpdate = isAgentRoute ? agentCanUpdate : canClinicUpdate;
  const canDelete = isAgentRoute ? agentCanDelete : canClinicDelete;

  async function loadAgents() {
    try {
      const { data } = await axios.get('/api/lead-ms/get-agents?role=agent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setAgents(data.agents || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load agents');
    }
  }

  async function loadDoctorStaff() {
    try {
      const { data } = await axios.get('/api/lead-ms/get-agents?role=doctorStaff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setDoctorStaff(data.agents || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load doctor staff');
    }
  }

  async function loadAll(initial = false) {
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      await Promise.all([loadAgents(), loadDoctorStaff()]);
      if (!initial) {
        toast.success('Data refreshed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if ((isAgentRoute && permissionsLoading) || (isClinicUser && clinicPermsLoading)) return;
    if (!canRead) {
      setAgents([]);
      setDoctorStaff([]);
      setIsLoading(false);
      return;
    }
    loadAll(true);
  }, [
    token,
    isAgentRoute,
    permissionsLoading,
    canRead,
    isClinicUser,
    clinicPermsLoading,
  ]);

  async function handleAction(agentId, action) {
    if (!canRead) return;
    const requiresUpdate = action === 'approve' || action === 'decline';
    if (requiresUpdate && !canUpdate) {
      toast.error("You don't have permission to perform this action");
      return;
    }
    try {
      const { data } = await axios.patch(
        '/api/lead-ms/get-agents',
        { agentId, action },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data.success) {
        if (data.agent.role === 'doctorStaff') {
          setDoctorStaff((prev) =>
            prev.map((a) => (a._id === agentId ? data.agent : a))
          );
        } else {
          setAgents((prev) =>
            prev.map((a) => (a._id === agentId ? data.agent : a))
          );
        }
        toast.success(`Member ${action === 'approve' ? 'approved' : 'declined'} successfully`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update member status');
    }
  }

  async function handleDelete(agentId) {
    if (!canDelete) {
      toast.error("You don't have permission to delete members");
      return;
    }
    if (!agentId) return;
    try {
      const { data } = await axios.delete(
        '/api/lead-ms/delete-agent',
        {
          data: { agentId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data.success) {
        // Remove from the appropriate list
        if (data.deletedUser.role === 'doctorStaff') {
          setDoctorStaff((prev) => prev.filter((a) => a._id !== agentId));
        } else {
          setAgents((prev) => prev.filter((a) => a._id !== agentId));
        }
        setDeleteAgent(null);
        setMenuAgentId(null);
        toast.success(`${data.deletedUser.role === 'doctorStaff' ? 'Doctor' : 'Agent'} deleted successfully`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to delete member');
      setDeleteAgent(null);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    if (!canUpdate) {
      toast.error("You don't have permission to update members");
      return;
    }
    if (!passwordAgent) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const { data } = await axios.patch(
        '/api/lead-ms/get-agents',
        { agentId: passwordAgent._id, action: 'resetPassword', newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        if (data.agent.role === 'doctorStaff') {
          setDoctorStaff((prev) => prev.map((a) => (a._id === passwordAgent._id ? data.agent : a)));
        } else {
          setAgents((prev) => prev.map((a) => (a._id === passwordAgent._id ? data.agent : a)));
        }
        setPasswordAgent(null);
        setNewPassword('');
        setConfirmPassword('');
        setMenuAgentId(null);
        toast.success('Password updated successfully');
      } else {
        toast.error(data?.message || 'Failed to reset password');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset password');
    }
  }

  const currentList = activeView === 'agents' ? agents : doctorStaff;
  const totalAgents = agents.length;
  const approvedAgents = useMemo(() => agents.filter((a) => a.isApproved).length, [agents]);
  const declinedAgents = useMemo(() => agents.filter((a) => a.declined).length, [agents]);
  const pendingAgents = useMemo(() => agents.filter((a) => !a.isApproved && !a.declined).length, [agents]);
  const totalDoctorStaff = doctorStaff.length;
  const approvedDoctorStaff = useMemo(() => doctorStaff.filter((a) => a.isApproved).length, [doctorStaff]);
  const declinedDoctorStaff = useMemo(() => doctorStaff.filter((a) => a.declined).length, [doctorStaff]);
  const pendingDoctorStaff = useMemo(() => doctorStaff.filter((a) => !a.isApproved && !a.declined).length, [doctorStaff]);
  const totalTeam = totalAgents + totalDoctorStaff;
  const totalApproved = approvedAgents + approvedDoctorStaff;
  const totalDeclined = declinedAgents + declinedDoctorStaff;
  const totalPending = pendingAgents + pendingDoctorStaff;
  const approvalRate = totalTeam > 0 ? Math.round((totalApproved / totalTeam) * 100) : 0;

  // Status and trend visualizations removed per request

  const handleCreateClick = () => {
    if (!canCreate) {
      toast.error("You don't have permission to create agents");
      return;
    }
    setIsCreateOpen(true);
  };

  if ((isAgentRoute && permissionsLoading) || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          <p className="text-sm text-gray-700">Loading team data...</p>
        </div>
      </div>
    );
  }

  if (isAgentRoute && !canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access denied</h2>
          <p className="text-sm text-gray-700">
            You do not have permission to view the Create Agent module. Please contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm font-medium',
          style: { background: '#1f2937', color: '#f8fafc' },
        }}
      />
      <div className="w-full space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team Management</h1>
            <p className="text-xs sm:text-sm text-gray-700 mt-1">Manage agents and doctor staff accounts</p>
          </div>
          <button
            onClick={() => loadAll(false)}
            disabled={isRefreshing || !canRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Total Team</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalTeam}</p>
                <p className="text-xs text-gray-700 mt-1">{approvalRate}% approved</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-700" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalApproved}</p>
                <p className="text-xs text-gray-700 mt-1">Active members</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{totalPending}</p>
                <p className="text-xs text-gray-700 mt-1">Awaiting review</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Declined</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{totalDeclined}</p>
                <p className="text-xs text-gray-700 mt-1">Not approved</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeView === 'agents' ? 'Agents' : 'Doctor Staff'}
            </h2>
            <p className="text-sm text-gray-700 mt-0.5">
              {currentList.length} {activeView === 'agents' ? 'agents' : 'doctors'} total
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add {activeView === 'agents' ? 'Agent' : 'Doctor'}
            </button>
          )}
        </div>

        {/* Agents/Doctors Cards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {currentList.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-gray-700" />
                </div>
                <p className="text-base font-semibold text-gray-900">No {activeView === 'agents' ? 'agents' : 'doctors'} found</p>
                <p className="text-sm text-gray-700 mt-1 mb-4">
                  {canCreate
                    ? `Get started by adding your first ${activeView === 'agents' ? 'agent' : 'doctor'} to the team`
                    : 'You have read-only access.'}
                </p>
                {canCreate && (
                  <button
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add {activeView === 'agents' ? 'Agent' : 'Doctor'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentList.map((agent) => (
                  <div
                    key={agent._id}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-base font-semibold shadow-md">
                          {agent.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold text-gray-900 truncate">
                            {agent.name}
                          </div>
                          <div className="mt-1.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                agent.declined
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : agent.isApproved
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              }`}
                            >
                              {agent.declined
                                ? 'Declined'
                                : agent.isApproved
                                ? 'Approved'
                                : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAgentId(menuAgentId === agent._id ? null : agent._id);
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                          aria-label="More actions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                          </svg>
                        </button>
                        {menuAgentId === agent._id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuAgentId(null);
                              }}
                            />
                            <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                              {canUpdate && (
                                <>
                                  <button
                                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPasswordAgent(agent);
                                      setMenuAgentId(null);
                                    }}
                                  >
                                    Change password
                                  </button>
                                  <button
                                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 transition-colors border-t border-gray-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPermissionAgent(agent);
                                      setMenuAgentId(null);
                                    }}
                                  >
                                    Rights
                                  </button>
                                  {agent.role === 'doctorStaff' && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 transition-colors border-t border-gray-200"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTreatmentAgent(agent);
                                        setMenuAgentId(null);
                                      }}
                                    >
                                      Add Treatment
                                    </button>
                                  )}
                                </>
                              )}
                              {canDelete && (
                                <button
                                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-red-50 text-red-700 transition-colors border-t border-gray-200 flex items-center gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteAgent(agent);
                                    setMenuAgentId(null);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="space-y-2.5 mb-4">
                      <div className="text-sm text-gray-700 truncate">
                        <span className="font-medium text-gray-800">Email:</span> {agent.email}
                      </div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium text-gray-800">Phone:</span> {agent.phone || 'N/A'}
                      </div>
                    </div>

                    {/* Card Footer - Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      {canUpdate && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(agent._id, 'approve');
                            }}
                            disabled={agent.isApproved}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              agent.isApproved
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm hover:shadow-md'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(agent._id, 'decline');
                            }}
                            disabled={agent.declined}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              agent.declined
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Agent Modal */}
      <CreateAgentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={loadAll}
        token={clinicToken || undefined}
        doctorToken={doctorToken || undefined}
        adminToken={adminToken || undefined}
      />

      {/* Agent Permission Modal */}
      {permissionAgent && (
        <AgentPermissionModal
          isOpen={!!permissionAgent}
          onClose={() => setPermissionAgent(null)}
          agentId={permissionAgent._id}
          agentName={permissionAgent.name}
          token={token || null}
          userRole={clinicToken ? 'clinic' : doctorToken ? 'doctor' : 'admin'}
        />
      )}

      {/* Doctor Treatment Modal */}
      {treatmentAgent && (
        <DoctorTreatmentModal
          isOpen={!!treatmentAgent}
          onClose={() => setTreatmentAgent(null)}
          doctorStaffId={treatmentAgent._id}
          doctorStaffName={treatmentAgent.name}
          token={token || null}
        />
      )}

      {/* Change Password Modal */}
      {passwordAgent && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-xl">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Change password</h3>
              <p className="text-[11px] text-gray-700 mt-0.5">{passwordAgent.name} • {passwordAgent.email}</p>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="p-5">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1.5">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition-colors"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition-colors"
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setPasswordAgent(null); setNewPassword(''); setConfirmPassword(''); }}
                  className="px-3.5 py-2 rounded-md border border-gray-300 text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-[11px] font-medium rounded-md transition-colors shadow-sm"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteAgent && (
        <div 
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteAgent(null);
            }
          }}
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-red-200 shadow-2xl">
            <div className="px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-red-900">Confirm Deletion</h3>
                  <p className="text-xs text-red-700 mt-0.5">{deleteAgent.name} • {deleteAgent.email}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Are you sure you want to delete this {deleteAgent.role === 'doctorStaff' ? 'doctor' : 'agent'}?
                </p>
                <p className="text-sm text-gray-700">
                  This action cannot be undone. All data associated with this {deleteAgent.role === 'doctorStaff' ? 'doctor' : 'agent'} will be permanently removed.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteAgent(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteAgent._id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {deleteAgent.role === 'doctorStaff' ? 'Doctor' : 'Agent'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Apply Layout
ManageAgentsPage.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

// Preserve layout on wrapped component
const ProtectedManageAgentsPage = withClinicAuth(ManageAgentsPage);
ProtectedManageAgentsPage.getLayout = ManageAgentsPage.getLayout;

export default ProtectedManageAgentsPage;