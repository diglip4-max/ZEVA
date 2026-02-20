'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  RefreshCw,
  Trash2,
  X,
  Eye,
  Upload,
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import CreateAgentModal from '../../components/CreateAgentModal';
import AgentPermissionModal from '../../components/AgentPermissionModal';
import DoctorTreatmentModal from '../../components/DoctorTreatmentModal';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import Loader from '../../components/Loader';

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
  const [profileAgent, setProfileAgent] = useState(null);
  const [viewAgent, setViewAgent] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    idType: "aadhaar",
    idNumber: "",
    idDocumentFrontUrl: "",
    idDocumentBackUrl: "",
    passportNumber: "",
    passportDocumentFrontUrl: "",
    passportDocumentBackUrl: "",
    emergencyPhone: "",
    emergencyName: "",
    baseSalary: "",
    commissionType: "flat",
    commissionPercentage: "",
    targetMultiplier: "1",
    targetAmount: "",
    contractFrontUrl: "",
    contractBackUrl: "",
    contractType: "full"
    ,
    employeeVisaFrontUrl: "",
    employeeVisaBackUrl: ""
  });
  const [uploadingIdDocFront, setUploadingIdDocFront] = useState(false);
  const [uploadingIdDocBack, setUploadingIdDocBack] = useState(false);
  const [uploadingPassportDocFront, setUploadingPassportDocFront] = useState(false);
  const [uploadingPassportDocBack, setUploadingPassportDocBack] = useState(false);
  const [uploadingContractFront, setUploadingContractFront] = useState(false);
  const [uploadingContractBack, setUploadingContractBack] = useState(false);
  const [uploadingEmployeeVisaFront, setUploadingEmployeeVisaFront] = useState(false);
  const [uploadingEmployeeVisaBack, setUploadingEmployeeVisaBack] = useState(false);
  const [completionMap, setCompletionMap] = useState({});
  const [agentProfiles, setAgentProfiles] = useState({});
  const [passwordAgent, setPasswordAgent] = useState(null);
  const [permissionAgent, setPermissionAgent] = useState(null);
  const [treatmentAgent, setTreatmentAgent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Get the appropriate token based on what's available (clinic > doctor > admin)
  // This ensures we use the correct token for the logged-in user
  const clinicToken = typeof window !== 'undefined' ? localStorage.getItem('clinicToken') : null;
  const doctorToken = typeof window !== 'undefined' ? localStorage.getItem('doctorToken') : null;
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
  
  // Determine which token to use based on what's available
  // Priority: clinicToken > doctorToken > adminToken
  const token = clinicToken || doctorToken || adminToken || agentToken;

  // Helper function to get user role from token
  const getUserRole = () => {
    if (typeof window === 'undefined') return null;
    try {
      for (const key of TOKEN_PRIORITY) {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role || null;
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error getting user role:', error);
    }
    return null;
  };

  // Fetch permissions - same pattern as myallClinic.tsx and create-offer.jsx
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          setPermissions({
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canRead: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        const userRole = getUserRole();
        
        // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
        if (userRole === "clinic" || userRole === "doctor") {
          try {
            const res = await axios.get("/api/clinic/sidebar-permissions", {
              headers: authHeaders,
            });
            
            if (res.data.success) {
              // Check if permissions array exists and is not null
              // If permissions is null, admin hasn't set any restrictions yet - allow full access (backward compatibility)
              if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
                // No admin restrictions set yet - default to full access for backward compatibility
                setPermissions({
                  canCreate: true,
                  canRead: true,
                  canUpdate: true,
                  canDelete: true,
                });
              } else {
                // Admin has set permissions - check the clinic_create_agent module
                const modulePermission = res.data.permissions.find((p) => {
                  if (!p?.module) return false;
                  // Check for clinic_create_agent module
                  if (p.module === "clinic_create_agent") return true;
                  if (p.module === "create_agent") return true;
                  if (p.module === "clinic-create-agent") return true;
                  if (p.module === "create-agent") return true;
                  return false;
                });

                if (modulePermission) {
                  const actions = modulePermission.actions || {};
                  
                  // Check if "all" is true, which grants all permissions
                  const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
                  const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
                  const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
                  const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
                  const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

                  setPermissions({
                    canCreate: moduleAll || moduleCreate,
                    canRead: moduleAll || moduleRead,
                    canUpdate: moduleAll || moduleUpdate,
                    canDelete: moduleAll || moduleDelete,
                  });
                } else {
                  // Module permission not found in the permissions array - default to read-only
                  setPermissions({
                    canCreate: false,
                    canRead: true, // Clinic/doctor can always read their own data
                    canUpdate: false,
                    canDelete: false,
                  });
                }
              }
            } else {
              // API response doesn't have permissions, default to full access (backward compatibility)
              setPermissions({
                canCreate: true,
                canRead: true,
                canUpdate: true,
                canDelete: true,
              });
            }
          } catch (err) {
            console.error("Error fetching clinic sidebar permissions:", err);
            // On error, default to full access (backward compatibility)
            setPermissions({
              canCreate: true,
              canRead: true,
              canUpdate: true,
              canDelete: true,
            });
          }
          setPermissionsLoaded(true);
          return;
        }

        // For agents, staff, and doctorStaff, fetch from /api/agent/permissions
        if (["agent", "staff", "doctorStaff"].includes(userRole || "")) {
          let permissionsData = null;
          try {
            // Get agentId from token
            const token = getStoredToken();
            if (token) {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const agentId = payload.userId || payload.id;
              
              if (agentId) {
                const res = await axios.get(`/api/agent/permissions?agentId=${agentId}`, {
                  headers: authHeaders,
                });
                
                if (res.data.success && res.data.data) {
                  permissionsData = res.data.data;
                }
              }
            }
          } catch (err) {
            console.error("Error fetching agent permissions:", err);
          }

          if (permissionsData && permissionsData.permissions) {
            const modulePermission = permissionsData.permissions.find((p) => {
              if (!p?.module) return false;
              if (p.module === "create_agent") return true;
              if (p.module === "clinic_create_agent") return true;
              if (p.module === "clinic-create-agent") return true;
              if (p.module === "create-agent") return true;
              if (p.module.startsWith("clinic_") && p.module.slice(7) === "create_agent") {
                return true;
              }
              return false;
            });

            if (modulePermission) {
              const actions = modulePermission.actions || {};
              
              // Module-level "all" grants all permissions
              const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
              const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
              const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
              const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
              const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

              setPermissions({
                canCreate: moduleAll || moduleCreate,
                canRead: moduleAll || moduleRead,
                canUpdate: moduleAll || moduleUpdate,
                canDelete: moduleAll || moduleDelete,
              });
            } else {
              // No permissions found for this module, default to false
              setPermissions({
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false,
              });
            }
          } else {
            // API failed or no permissions data, default to false
            setPermissions({
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
            });
          }
        } else {
          // Unknown role, default to false
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
        }
        setPermissionsLoaded(true);
      } catch (err) {
        console.error("Error fetching permissions:", err);
        // On error, default to false (no permissions)
        setPermissions({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
        });
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, []);

  const userRole = getUserRole();
  
  // Admin role bypasses all permission checks
  const canRead = userRole === 'admin' ? true : permissions.canRead;
  const canCreate = userRole === 'admin' ? true : permissions.canCreate;
  const canUpdate = userRole === 'admin' ? true : permissions.canUpdate;
  const canDelete = userRole === 'admin' ? true : permissions.canDelete;

  async function loadAgents() {
    try {
      const { data } = await axios.get('/api/lead-ms/get-agents?role=agent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setAgents(data.agents || []);
    } catch (err) {
      console.error(err);
      // Don't show error toast if read permission is false (access denied scenario)
      // Also check for 403 status code (Forbidden/Access Denied)
      const status = err.response?.status;
      if (!canRead || status === 403) {
        // Access denied - don't show error message
        return;
      }
      // Only show error for other failures (network errors, etc.)
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
      // Don't show error toast if read permission is false (access denied scenario)
      // Also check for 403 status code (Forbidden/Access Denied)
      const status = err.response?.status;
      if (!canRead || status === 403) {
        // Access denied - don't show error message
        return;
      }
      // Only show error for other failures (network errors, etc.)
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

  async function fetchAgentProfile(agentId) {
    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders) return null;
      const res = await axios.get(`/api/lead-ms/get-agents?agentId=${agentId}`, { headers: authHeaders });
      if (res.data.success) return res.data.profile || {};
    } catch {
      return null;
    }
    return null;
  }

  function computeCompletion(agent, profile) {
    let total = 7;
    let score = 0;
    if (profile?.emergencyPhone) score += 1;
    if (agent?.phone) score += 1;
    if (profile?.idNumber && profile?.idDocumentFrontUrl && profile?.idDocumentBackUrl) score += 1;
    if (profile?.passportNumber && profile?.passportDocumentFrontUrl && profile?.passportDocumentBackUrl) score += 1;
    if (profile?.contractFrontUrl && profile?.contractBackUrl) score += 1;
    if (typeof profile?.baseSalary === "number" ? profile.baseSalary > 0 : parseFloat(profile?.baseSalary) > 0) score += 1;
    if (profile?.commissionType) score += 1;
    return Math.round((score / total) * 100);
  }

  useEffect(() => {
    async function loadCompletions() {
      const authHeaders = getAuthHeaders();
      if (!authHeaders) return;
      const list = activeView === "agents" ? agents : doctorStaff;
      const updates = {};
      const profiles = {};
      await Promise.all(
        list.map(async (u) => {
          const profile = await fetchAgentProfile(u._id);
          updates[u._id] = computeCompletion(u, profile || {});
          profiles[u._id] = profile || {};
        })
      );
      setCompletionMap((prev) => ({ ...prev, ...updates }));
      setAgentProfiles((prev) => ({ ...prev, ...profiles }));
    }
    if (canRead === true && (agents.length > 0 || doctorStaff.length > 0)) {
      loadCompletions();
    }
  }, [agents, doctorStaff, activeView, canRead]);

  async function openProfile(agent) {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;
    setProfileAgent(agent);
    setProfileForm((f) => ({
      ...f,
      name: agent.name || "",
      email: agent.email || "",
      phone: agent.phone || ""
    }));
    try {
      const res = await axios.get(`/api/lead-ms/get-agents?agentId=${agent._id}`, { headers: authHeaders });
      if (res.data.success) {
        const p = res.data.profile || {};
        setProfileForm({
          name: agent.name || "",
          email: agent.email || "",
          phone: agent.phone || "",
          idType: p.idType || "aadhaar",
          idNumber: p.idNumber || "",
          idDocumentFrontUrl: p.idDocumentFrontUrl || "",
          idDocumentBackUrl: p.idDocumentBackUrl || "",
          passportNumber: p.passportNumber || "",
          passportDocumentFrontUrl: p.passportDocumentFrontUrl || "",
          passportDocumentBackUrl: p.passportDocumentBackUrl || "",
          emergencyPhone: p.emergencyPhone || "",
          emergencyName: p.emergencyName || "",
          baseSalary: typeof p.baseSalary === "number" ? String(p.baseSalary) : (p.baseSalary || ""),
          commissionType: p.commissionType || "flat",
          commissionPercentage: p.commissionPercentage || "",
          targetMultiplier: p.targetMultiplier != null ? String(p.targetMultiplier) : "1",
          targetAmount: typeof p.targetAmount === "number" ? String(p.targetAmount) : (p.targetAmount || ""),
          contractFrontUrl: p.contractFrontUrl || "",
          contractBackUrl: p.contractBackUrl || "",
          contractType: p.contractType || "full",
          employeeVisaFrontUrl: p.employeeVisaFrontUrl || "",
          employeeVisaBackUrl: p.employeeVisaBackUrl || ""
        });
      }
    } catch {}
  }

  const getFileNameFromUrl = (url) => {
    try {
      if (!url || typeof url !== 'string') return '';
      const u = new URL(url);
      const pathname = u.pathname || '';
      const name = pathname.split('/').filter(Boolean).pop() || '';
      return name || url.split('?')[0].split('/').pop() || '';
    } catch {
      return url?.split('?')[0]?.split('/')?.pop() || '';
    }
  };

  async function openView(agent) {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;
    setViewAgent(agent);
    setViewLoading(true);
    try {
      const res = await axios.get(`/api/lead-ms/get-agents?agentId=${agent._id}`, { headers: authHeaders });
      if (res.data.success) {
        setViewProfile(res.data.profile || {});
      } else {
        setViewProfile(null);
      }
    } catch {
      setViewProfile(null);
    } finally {
      setViewLoading(false);
    }
  }

  async function uploadFile(file, setUrl, setLoading) {
    if (!file) return;
    const authHeaders = getAuthHeaders();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post("/api/upload", formData, {
        headers: { ...(authHeaders || {}), "Content-Type": "multipart/form-data" }
      });
      if (res.data.success && res.data.url) {
        setUrl(res.data.url);
        toast.success("Uploaded");
      } else {
        toast.error(res.data.message || "Upload failed");
      }
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!profileAgent) return;
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;
    try {
      const payload = {
        agentId: profileAgent._id,
        action: "updateProfile",
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        emergencyPhone: profileForm.emergencyPhone,
        emergencyName: profileForm.emergencyName,
        idType: profileForm.idType,
        idNumber: profileForm.idNumber,
        idDocumentFrontUrl: profileForm.idDocumentFrontUrl,
        idDocumentBackUrl: profileForm.idDocumentBackUrl,
        passportNumber: profileForm.passportNumber,
        passportDocumentFrontUrl: profileForm.passportDocumentFrontUrl,
        passportDocumentBackUrl: profileForm.passportDocumentBackUrl,
        contractFrontUrl: profileForm.contractFrontUrl,
        contractBackUrl: profileForm.contractBackUrl,
        contractType: profileForm.contractType,
        baseSalary: parseFloat(profileForm.baseSalary || "0"),
        commissionType: profileForm.commissionType,
        commissionPercentage: profileForm.commissionPercentage,
        targetMultiplier: parseFloat(profileForm.targetMultiplier || "1"),
        targetAmount: (() => {
          const isTarget = profileForm.commissionType === 'target_based' || profileForm.commissionType === 'target_plus_expense';
          const base = parseFloat(profileForm.baseSalary || "0");
          const mult = parseFloat(profileForm.targetMultiplier || "1");
          return isTarget ? base * mult : parseFloat(profileForm.targetAmount || "0");
        })(),
        employeeVisaFrontUrl: profileForm.employeeVisaFrontUrl,
        employeeVisaBackUrl: profileForm.employeeVisaBackUrl
      };
      const res = await axios.patch("/api/lead-ms/get-agents", payload, { headers: authHeaders });
      if (res.data.success) {
        const pct = computeCompletion(
          { ...profileAgent, phone: payload.phone },
          {
            emergencyPhone: payload.emergencyPhone,
            idNumber: payload.idNumber,
            idDocumentFrontUrl: payload.idDocumentFrontUrl,
            idDocumentBackUrl: payload.idDocumentBackUrl,
            passportNumber: payload.passportNumber,
            passportDocumentFrontUrl: payload.passportDocumentFrontUrl,
            passportDocumentBackUrl: payload.passportDocumentBackUrl,
            contractFrontUrl: payload.contractFrontUrl,
            contractBackUrl: payload.contractBackUrl,
            baseSalary: payload.baseSalary,
            commissionType: payload.commissionType,
            commissionPercentage: payload.commissionPercentage
          }
        );
        setCompletionMap((prev) => ({ ...prev, [profileAgent._id]: pct }));
        setProfileAgent(null);
        toast.success("Profile updated");
      } else {
        toast.error(res.data.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    }
  }

  useEffect(() => {
    if (!token) return;
    if (!permissionsLoaded) return;
    if (canRead !== true) {
      setAgents([]);
      setDoctorStaff([]);
      setIsLoading(false);
      return;
    }
    loadAll(true);
  }, [token, permissionsLoaded, canRead]);

  async function handleAction(agentId, action) {
    if (canRead !== true) return;
    const requiresUpdate = action === 'approve' || action === 'decline';
    if (requiresUpdate && canUpdate !== true) {
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
    if (canDelete !== true) {
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
    if (canUpdate !== true) {
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
    if (canCreate !== true) {
      toast.error("You don't have permission to create agents");
      return;
    }
    setIsCreateOpen(true);
  };

  // Wait for permissions to load before showing UI
  if (!permissionsLoaded || isLoading) {
    return <Loader />;
  }

  // If read permission is false, show access denied
  if (canRead !== true) {
    if (canCreate === true) {
      // Show create button only
      return (
      <div className="w-full min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <Toaster
            position="top-right"
            toastOptions={{
              className: 'text-sm font-medium',
              style: { background: '#1f2937', color: '#f8fafc' },
            }}
          />
          <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-teal-900">Team Management</h1>
                <p className="text-xs sm:text-sm text-teal-700 mt-1">Manage Staffs and Doctors accounts</p>
              </div>
            </div>

            {/* Access Denied Message */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <h2 className="text-xl font-semibold text-teal-900 mb-2">Access Denied</h2>
              <p className="text-sm text-teal-700 mb-4">
                You do not have permission to view team members. However, you can create new members.
              </p>
              {canCreate === true && (
                <button
                  onClick={handleCreateClick}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add {activeView === 'agents' ? 'Agent' : 'Doctor'}
                </button>
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
            defaultRole={activeView === 'doctorStaff' ? 'doctorStaff' : 'agent'}
          />
        </div>
      );
    } else {
      // Show full access denied
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-teal-900 mb-2">Access denied</h2>
            <p className="text-sm text-teal-700">
              You do not have permission to view the Create Agent module. Please contact your
              administrator.
            </p>
          </div>
        </div>
      );
    }
  }


  return (
    <div className="w-full min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm font-medium',
          style: { background: '#1f2937', color: '#f8fafc' },
        }}
      />
      <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-teal-900">Team Management</h1>
            <p className="text-xs sm:text-sm text-teal-700 mt-1">Manage agents and doctor staff accounts</p>
          </div>
          <button
            onClick={() => loadAll(false)}
            disabled={isRefreshing || !canRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
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
                <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Total Team</p>
                <p className="text-3xl font-bold text-teal-900 mt-2">{totalTeam}</p>
                <p className="text-xs text-teal-700 mt-1">{approvalRate}% approved</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-teal-700" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalApproved}</p>
                <p className="text-xs text-teal-700 mt-1">Active members</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{totalPending}</p>
                <p className="text-xs text-teal-700 mt-1">Awaiting review</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Declined</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{totalDeclined}</p>
                <p className="text-xs text-teal-700 mt-1">Not approved</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-teal-900">Team Members</h2>
                <p className="text-sm text-teal-700 mt-0.5">
                  {currentList.length} {activeView === 'agents' ? 'agents' : 'doctors'} total
                </p>
              </div>
              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveView('agents')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'agents'
                      ? 'bg-white text-teal-900 shadow-sm'
                      : 'text-teal-600 hover:text-teal-900'
                  }`}
                >
                  Agents ({agents.length})
                </button>
                <button
                  onClick={() => setActiveView('doctorStaff')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'doctorStaff'
                      ? 'bg-white text-teal-900 shadow-sm'
                      : 'text-teal-600 hover:text-teal-900'
                  }`}
                >
                  Doctors ({doctorStaff.length})
                </button>
              </div>
            </div>
            {canCreate === true && (
              <button
                onClick={handleCreateClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm w-full sm:w-auto justify-center"
              >
                <UserPlus className="w-4 h-4" />
                Add {activeView === 'agents' ? 'Agent' : 'Doctor'}
              </button>
            )}
          </div>
        </div>

        {/* Agents/Doctors Cards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {currentList.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-teal-700" />
                </div>
                <p className="text-base font-semibold text-teal-900">No {activeView === 'agents' ? 'agents' : 'doctors'} found</p>
                <p className="text-sm text-teal-700 mt-1 mb-4">
                  {canCreate === true
                    ? `Get started by adding your first ${activeView === 'agents' ? 'agent' : 'doctor'} to the team`
                    : 'You have read-only access.'}
                </p>
                {canCreate === true && (
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
                        <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gradient-to-br from-teal-700 to-teal-900 text-white flex items-center justify-center text-base font-semibold shadow-md">
                          {agent.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold text-teal-900 truncate">
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
                      {/* Only show 3-dot menu if canUpdate or canDelete is true */}
                      {(canUpdate === true || canDelete === true) && (
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
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-teal-600">
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
                            <button
                              className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 text-teal-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuAgentId(null);
                                openView(agent);
                              }}
                            >
                              View
                            </button>
                                <button
                                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 text-teal-700 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuAgentId(null);
                                    openProfile(agent);
                                  }}
                                >
                                  Profile
                                </button>
                                {canUpdate === true && (
                                  <>
                                    <button
                                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 text-teal-700 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPasswordAgent(agent);
                                        setMenuAgentId(null);
                                      }}
                                    >
                                      Change password
                                    </button>
                                    <button
                                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 text-teal-700 transition-colors border-t border-gray-200"
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
                                        className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 text-teal-700 transition-colors border-t border-gray-200"
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
                                {canDelete === true && (
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
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="space-y-2.5 mb-4">
                      <div className="text-sm text-teal-700 truncate">
                        <span className="font-medium text-teal-800">Name:</span> {agent.name}
                      </div>
                      <div className="text-sm text-teal-700">
                        <span className="font-medium text-teal-800">Email:</span> {agent.email || 'N/A'}
                      </div>
                      <div className="text-sm text-teal-700">
                        <span className="font-medium text-teal-800">Mobile Number:</span> {agent.phone || 'N/A'}
                      </div>
                      <div className="mt-1">
                        <div className="h-2 bg-gray-100 rounded">
                          <div
                            className="h-2 bg-gray-900 rounded"
                            style={{ width: `${completionMap[agent._id] || 0}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-teal-700 mt-1">
                          Profile {completionMap[agent._id] || 0}% complete
                        </div>
                      </div>
                    </div>

                    {/* Card Footer - Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      {canUpdate === true && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(agent._id, 'approve');
                            }}
                            disabled={agent.isApproved}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              agent.isApproved
                                ? 'bg-gray-50 text-teal-400 cursor-not-allowed border border-gray-200'
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
                                ? 'bg-gray-50 text-teal-400 cursor-not-allowed border border-gray-200'
                                : 'bg-gray-100 text-teal-700 hover:bg-gray-200 border border-gray-200 hover:border-gray-300'
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
        defaultRole={activeView === 'doctorStaff' ? 'doctorStaff' : 'agent'}
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
          useClinicTreatments={true}
          isOpen={!!treatmentAgent}
          onClose={() => setTreatmentAgent(null)}
          doctorStaffId={treatmentAgent._id}
          doctorStaffName={treatmentAgent.name}
          token={token || null}
        />
      )}

      {/* Change Password Modal */}
      {passwordAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-xl">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-sm font-semibold text-teal-900">Change password</h3>
                <p className="text-[11px] text-teal-700 mt-0.5">{passwordAgent.name} • {passwordAgent.email}</p>
              </div>
              <button
                type="button"
                onClick={() => { setPasswordAgent(null); setNewPassword(''); setConfirmPassword(''); }}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-teal-500 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="p-5">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-teal-700 mb-1.5">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray300 dark:border-gray600 rounded-md text-xs bg-white dark:bg-gray-700 text-teal-900 dark:text-teal-100 placeholder-teal-400 dark:placeholder-teal-400 focus:ring-1 focus:ring-teal-900 dark:focus:ring-blue-500 focus:border-gray900 dark:focus:border-blue-500 outline-none transition-colors"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-teal-700 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray300 dark:border-gray600 rounded-md text-xs bg-white dark:bg-gray-700 text-teal-900 dark:text-teal-100 placeholder-teal-400 dark:placeholder-teal-400 focus:ring-1 focus:ring-teal-900 dark:focus:ring-blue-500 focus:border-gray900 dark:focus:border-blue-500 outline-none transition-colors"
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
                  className="px-3.5 py-2 rounded-md border border-gray300 dark:border-gray600 text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

      {profileAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col border border-teal-100">
            <div className="sticky top-0 bg-gray-50 px-4 sm:px-6 py-3 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Profile Information
              </h2>
              <button
                onClick={() => { setProfileAgent(null); }}
                className="p-2 hover:bg-white/20 rounded-lg text-white hover:text-white transition-colors flex-shrink-0 backdrop-blur-sm"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-900" />
              </button>
            </div>
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-gray-50">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-teal-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Name *</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Email *</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Mobile Number *</label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter mobile number"
                      />
                    </div>
                  </div>
                </div>

                {/* Identity Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-teal-900 mb-4">Identity Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">ID Type</label>
                      <select
                        value={profileForm.idType}
                        onChange={(e) => setProfileForm((f) => ({ ...f, idType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                      >
                        <option value="aadhaar">Aadhaar</option>
                        <option value="pan">PAN</option>
                        <option value="passport">Passport</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">ID Number</label>
                      <input
                        type="text"
                        value={profileForm.idNumber}
                        onChange={(e) => setProfileForm((f) => ({ ...f, idNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter ID number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload ID Front</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingIdDocFront ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, idDocumentFrontUrl: url })), setUploadingIdDocFront);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.idDocumentFrontUrl ? getFileNameFromUrl(profileForm.idDocumentFrontUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload ID Back</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingIdDocBack ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, idDocumentBackUrl: url })), setUploadingIdDocBack);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.idDocumentBackUrl ? getFileNameFromUrl(profileForm.idDocumentBackUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-teal-900 mb-4">Additional Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Passport Number</label>
                      <input
                        type="text"
                        value={profileForm.passportNumber}
                        onChange={(e) => setProfileForm((f) => ({ ...f, passportNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter passport number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload Passport Front</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingPassportDocFront ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, passportDocumentFrontUrl: url })), setUploadingPassportDocFront);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.passportDocumentFrontUrl ? getFileNameFromUrl(profileForm.passportDocumentFrontUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload Passport Back</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingPassportDocBack ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, passportDocumentBackUrl: url })), setUploadingPassportDocBack);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.passportDocumentBackUrl ? getFileNameFromUrl(profileForm.passportDocumentBackUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Emergency Contact</label>
                      <input
                        type="tel"
                        value={profileForm.emergencyPhone}
                        onChange={(e) => setProfileForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter emergency contact"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Emergency Name</label>
                      <input
                        type="text"
                        value={profileForm.emergencyName}
                        onChange={(e) => setProfileForm((f) => ({ ...f, emergencyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter emergency contact name"
                      />
                    </div>
                  </div>
                </div>

                {/* Employment Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-teal-900 mb-4">Employment Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Base Salary</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={profileForm.baseSalary}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProfileForm((f) => {
                            const isTarget = f.commissionType === 'target_based' || f.commissionType === 'target_plus_expense';
                            const base = parseFloat(val || "0");
                            const mult = parseFloat(f.targetMultiplier || "1");
                            return {
                              ...f,
                              baseSalary: val,
                              targetAmount: isTarget ? String(base * mult) : f.targetAmount
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter salary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Commission Type</label>
                      <select
                        value={profileForm.commissionType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProfileForm((f) => {
                            const isTarget = val === 'target_based' || val === 'target_plus_expense';
                            const base = parseFloat(f.baseSalary || "0");
                            const mult = parseFloat(f.targetMultiplier || "1");
                            return {
                              ...f,
                              commissionType: val,
                              targetAmount: isTarget ? String(base * mult) : ""
                            };
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                      >
                        <option value="no_commission">No Commission</option>
                        <option value="flat">Flat</option>
                        <option value="after_deduction">After deduction</option>
                        <option value="target_based">Target based</option>
                        <option value="target_plus_expense">Target + expense</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Commission Percentage</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={profileForm.commissionPercentage}
                        onChange={(e) => setProfileForm((f) => ({ ...f, commissionPercentage: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                        placeholder="Enter commission %"
                      />
                    </div>
                    {(profileForm.commissionType === 'target_based' || profileForm.commissionType === 'target_plus_expense') && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-teal-700 mb-1.5">Target</label>
                          <select
                            value={profileForm.targetMultiplier}
                            onChange={(e) => {
                              const mult = e.target.value;
                              setProfileForm((f) => {
                                const base = parseFloat(f.baseSalary || "0");
                                const m = parseFloat(mult || "1");
                                return {
                                  ...f,
                                  targetMultiplier: mult,
                                  targetAmount: String(base * m)
                                };
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                          >
                            <option value="1">1x</option>
                            <option value="2">2x</option>
                            <option value="3">3x</option>
                            <option value="4">4x</option>
                            <option value="5">5x</option>
                            <option value="6">6x</option>
                            <option value="7">7x</option>
                            <option value="8">8x</option>
                            <option value="9">9x</option>
                            <option value="10">10x</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-teal-700 mb-1.5">Target Amount</label>
                          <input
                            type="number"
                            value={profileForm.targetAmount}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Contract Type</label>
                      <select
                        value={profileForm.contractType}
                        onChange={(e) => setProfileForm((f) => ({ ...f, contractType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                      >
                        <option value="full">Full</option>
                        <option value="part">Part</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload Contract Front</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingContractFront ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, contractFrontUrl: url })), setUploadingContractFront);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.contractFrontUrl ? getFileNameFromUrl(profileForm.contractFrontUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Upload Contract Back</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingContractBack ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, contractBackUrl: url })), setUploadingContractBack);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.contractBackUrl ? getFileNameFromUrl(profileForm.contractBackUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Other Document Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-teal-900 mb-4">Other Document</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Employee Visa Front</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingEmployeeVisaFront ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, employeeVisaFrontUrl: url })), setUploadingEmployeeVisaFront);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.employeeVisaFrontUrl ? getFileNameFromUrl(profileForm.employeeVisaFrontUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Employee Visa Back</label>
                      <label className="flex flex-col gap-1.5 w-full cursor-pointer group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                          {uploadingEmployeeVisaBack ? (
                            <span className="animate-pulse text-teal-600">Uploading...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2 text-teal-600" />
                              <span className="text-teal-600">Choose file</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file, (url) => setProfileForm((f) => ({ ...f, employeeVisaBackUrl: url })), setUploadingEmployeeVisaBack);
                          }}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {profileForm.employeeVisaBackUrl ? getFileNameFromUrl(profileForm.employeeVisaBackUrl) : "No file chosen"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => { setProfileAgent(null); }}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveProfile}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {viewAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-lg border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto mx-auto">
            <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex items-start justify-between sticky top-0 z-10">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-sm font-semibold text-teal-900">View profile</h3>
                <p className="text-[11px] text-teal-700 mt-0.5">{viewAgent.name} • {viewAgent.email}</p>
              </div>
              <button
                type="button"
                onClick={() => { setViewAgent(null); setViewProfile(null); }}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-teal-500 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {viewLoading ? (
                <div className="py-8 text-center text-sm text-teal-700">Loading...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="text-xs text-teal-700"><span className="font-semibold">Name:</span> {viewAgent.name || 'N/A'}</div>
                    <div className="text-xs text-teal-700"><span className="font-semibold">Email:</span> {viewAgent.email || 'N/A'}</div>
                    <div className="text-xs text-teal-700"><span className="font-semibold">Mobile Number:</span> {viewAgent.phone || 'N/A'}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="text-xs text-teal-700"><span className="font-semibold">Role:</span> {viewAgent.role}</div>
                    <div className="text-xs text-teal-700"><span className="font-semibold">Status:</span> {viewAgent.declined ? 'Declined' : viewAgent.isApproved ? 'Approved' : 'Pending'}</div>
                    <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Commission:</span> {viewProfile?.commissionType === 'no_commission' ? 'No Commission' : viewProfile?.commissionType || '—'} {viewProfile?.commissionPercentage ? `(${viewProfile.commissionPercentage}%)` : ''}</div>
                  </div>
                  <div className="border border-gray200 dark:border-gray700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">Identity Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Identity Type:</span> {viewProfile?.idType || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Identity No:</span> {viewProfile?.idNumber || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">ID Front:</span>{' '}
                          {viewProfile?.idDocumentFrontUrl ? (
                            <>
                              <a href={viewProfile.idDocumentFrontUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.idDocumentFrontUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">ID Back:</span>{' '}
                          {viewProfile?.idDocumentBackUrl ? (
                            <>
                              <a href={viewProfile.idDocumentBackUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.idDocumentBackUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {viewProfile?.idDocumentFrontUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.idDocumentFrontUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.idDocumentFrontUrl} alt="ID Front" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No ID front image
                          </div>
                        )}
                        {viewProfile?.idDocumentBackUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.idDocumentBackUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.idDocumentBackUrl} alt="ID Back" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No ID back image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray200 dark:border-gray700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">Passport Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Passport No:</span> {viewProfile?.passportNumber || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Emergency Phone:</span> {viewProfile?.emergencyPhone || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Emergency Name:</span> {viewProfile?.emergencyName || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Passport Front:</span>{' '}
                          {viewProfile?.passportDocumentFrontUrl ? (
                            <>
                              <a href={viewProfile.passportDocumentFrontUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.passportDocumentFrontUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Passport Back:</span>{' '}
                          {viewProfile?.passportDocumentBackUrl ? (
                            <>
                              <a href={viewProfile.passportDocumentBackUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.passportDocumentBackUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {viewProfile?.passportDocumentFrontUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.passportDocumentFrontUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.passportDocumentFrontUrl} alt="Passport Front" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No passport front image
                          </div>
                        )}
                        {viewProfile?.passportDocumentBackUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.passportDocumentBackUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.passportDocumentBackUrl} alt="Passport Back" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No passport back image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray200 dark:border-gray700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">Employment Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Salary:</span> {typeof viewProfile?.baseSalary === 'number' ? viewProfile.baseSalary : (viewProfile?.baseSalary || '—')}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Contract Type:</span> {viewProfile?.contractType || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Commission Type:</span> {viewProfile?.commissionType || '—'}</div>
                        <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Commission %:</span> {typeof viewProfile?.commissionPercentage === 'number' ? viewProfile.commissionPercentage : (viewProfile?.commissionPercentage || '—')}</div>
                        {(viewProfile?.commissionType === 'target_based' || viewProfile?.commissionType === 'target_plus_expense') && (
                          <>
                            <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Target:</span> {viewProfile?.targetMultiplier ? `${viewProfile.targetMultiplier}x` : '—'}</div>
                            <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Target Amount:</span> {typeof viewProfile?.targetAmount === 'number' ? viewProfile.targetAmount : (viewProfile?.targetAmount || '—')}</div>
                          </>
                        )}
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Contract Front:</span>{' '}
                          {viewProfile?.contractFrontUrl ? (
                            <>
                              <a href={viewProfile.contractFrontUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.contractFrontUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Contract Back:</span>{' '}
                          {viewProfile?.contractBackUrl ? (
                            <>
                              <a href={viewProfile.contractBackUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.contractBackUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {viewProfile?.contractFrontUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.contractFrontUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.contractFrontUrl} alt="Contract Front" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No contract front image
                          </div>
                        )}
                        {viewProfile?.contractBackUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.contractBackUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.contractBackUrl} alt="Contract Back" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No contract back image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray200 dark:border-gray700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">Additional Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Joining Date:</span> {viewProfile?.joiningDate ? new Date(viewProfile.joiningDate).toLocaleDateString() : '—'}</div>
                      <div className="text-xs text-teal-700 dark:text-teal-300"><span className="font-semibold">Active:</span> {viewProfile?.isActive === false ? 'No' : 'Yes'}</div>
                      <div />
                    </div>
                  </div>
                  <div className="border border-gray200 dark:border-gray700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">Other Document</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Employee Visa Front:</span>{' '}
                          {viewProfile?.employeeVisaFrontUrl ? (
                            <>
                              <a href={viewProfile.employeeVisaFrontUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.employeeVisaFrontUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                        <div className="text-xs text-teal-700 dark:text-teal-300">
                          <span className="font-semibold">Employee Visa Back:</span>{' '}
                          {viewProfile?.employeeVisaBackUrl ? (
                            <>
                              <a href={viewProfile.employeeVisaBackUrl} target="_blank" rel="noreferrer" className="text-teal-900 dark:text-blue-400 underline">Open</a>
                              <span className="ml-2 text-[11px]">{getFileNameFromUrl(viewProfile.employeeVisaBackUrl)}</span>
                            </>
                          ) : '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {viewProfile?.employeeVisaFrontUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.employeeVisaFrontUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.employeeVisaFrontUrl} alt="Employee Visa Front" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No visa front image
                          </div>
                        )}
                        {viewProfile?.employeeVisaBackUrl && /\.(png|jpe?g|gif|webp)$/i.test(viewProfile.employeeVisaBackUrl) ? (
                          <div className="flex items-center justify-center">
                            <img src={viewProfile.employeeVisaBackUrl} alt="Employee Visa Back" className="rounded border border-gray200 dark:border-gray700 max-h-32 object-contain shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-sm">
                            No visa back image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => { setViewAgent(null); setViewProfile(null); }}
                      className="px-3.5 py-2 rounded-md border border-gray300 dark:border-gray600 text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteAgent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteAgent(null);
            }
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-2xl">
            <div className="px-6 py-4 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-red-900 dark:text-red-300">Confirm Deletion</h3>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{deleteAgent.name} • {deleteAgent.email}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-sm font-medium text-teal-900 dark:text-teal-100 mb-2">
                  Are you sure you want to delete this {deleteAgent.role === 'doctorStaff' ? 'doctor' : 'agent'}?
                </p>
                <p className="text-sm text-teal-700 dark:text-teal-400">
                  This action cannot be undone. All data associated with this {deleteAgent.role === 'doctorStaff' ? 'doctor' : 'agent'} will be permanently removed.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteAgent(null)}
                  className="px-4 py-2 rounded-lg border border-gray300 dark:border-gray600 text-sm font-medium text-teal-700 dark:text-teal-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

// Export base component for reuse (e.g., agent portal)
export const CreateAgentPageBase = ManageAgentsPage;

// Preserve layout on wrapped component
const ProtectedManageAgentsPage = withClinicAuth(ManageAgentsPage);
ProtectedManageAgentsPage.getLayout = ManageAgentsPage.getLayout;

export default ProtectedManageAgentsPage;
