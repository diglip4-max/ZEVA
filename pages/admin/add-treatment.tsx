'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import AdminLayout from '../../components/AdminLayout';
import withAdminAuth from '../../components/withAdminAuth';
import { useAgentPermissions } from '../../hooks/useAgentPermissions';
import {
  BeakerIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { NextPageWithLayout } from '../_app';

type SubTreatment = {
  name: string;
  slug: string;
};

type Treatment = {
  _id: string;
  name: string;
  slug: string;
  subcategories: SubTreatment[];
};

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// Toast Component
const Toast = ({ toast, onClose }: { toast: Toast; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircleIcon className="w-4 h-4" />,
    error: <XCircleIcon className="w-4 h-4" />,
    info: <InformationCircleIcon className="w-4 h-4" />,
    warning: <ExclamationTriangleIcon className="w-4 h-4" />,
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };

  return (
    <div
      className={`${colors[toast.type]} text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs animate-slide-in`}
    >
      {icons[toast.type]}
      <span className="flex-1 font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="hover:bg-white/20 rounded p-0.5 transition-colors"
      >
        <XMarkIcon className="w-3 h-3" />
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map((toast) => (
      <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
    ))}
  </div>
);

const AddTreatment: NextPageWithLayout = () => {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [newMainTreatment, setNewMainTreatment] = useState<string>('');
  const [newSubTreatment, setNewSubTreatment] = useState<string>('');
  const [selectedMainTreatment, setSelectedMainTreatment] = useState<string>('');
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast helper functions
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Check if user is an admin or agent
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAgent, setIsAgent] = useState<boolean>(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminToken = !!localStorage.getItem('adminToken');
      const agentToken = !!localStorage.getItem('agentToken');
      const isAgentRoute = router.pathname?.startsWith('/agent/') || window.location.pathname?.startsWith('/agent/');
      
      if (isAgentRoute && agentToken) {
        setIsAdmin(false);
        setIsAgent(true);
      } else if (adminToken) {
        setIsAdmin(true);
        setIsAgent(false);
      } else if (agentToken) {
        setIsAdmin(false);
        setIsAgent(true);
      } else {
        setIsAdmin(false);
        setIsAgent(false);
      }
    }
  }, [router.pathname]);
  
  const agentPermissionsData: any = useAgentPermissions(isAgent ? "admin_add_treatment" : (null as any));
  const agentPermissions = isAgent ? agentPermissionsData?.permissions : null;
  const permissionsLoading = isAgent ? agentPermissionsData?.loading : false;

  const fetchTreatments = async () => {
    setFetching(true);
    try {
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
      const token = adminToken || agentToken;

      if (!token) {
        showToast('No authentication token found', 'error');
        return;
      }

      const res = await axios.get<{ treatments: Treatment[] }>('/api/doctor/getTreatment', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTreatments(res.data.treatments || []);
    } catch (err: any) {
      console.error('Failed to fetch treatments', err);
      showToast('Failed to load treatments', 'error');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAdmin || !isAgent || !permissionsLoading) {
      fetchTreatments();
    }
  }, [isAdmin, isAgent, permissionsLoading]);

  useEffect(() => {
    if (showDeleteModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showDeleteModal]);

  const handleAddMainTreatment = async () => {
    if (!newMainTreatment.trim()) {
      showToast('Treatment name required', 'error');
      return;
    }

    if (!isAdmin && isAgent && agentPermissions && !agentPermissions.canCreate && !agentPermissions.canAll) {
      showToast('Permission denied', 'error');
      return;
    }

    setLoading(true);

    try {
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
      const token = adminToken || agentToken;

      if (!token) {
        showToast('Authentication required', 'error');
        setLoading(false);
        return;
      }

      const res = await axios.post('/api/admin/addTreatment', {
        name: newMainTreatment,
        slug: newMainTreatment.toLowerCase().replace(/\s+/g, '-'),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 201) {
        showToast('Treatment added', 'success');
        setNewMainTreatment('');
        fetchTreatments();
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to add treatment';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubTreatment = async () => {
    if (!selectedMainTreatment) {
      showToast('Select main treatment first', 'warning');
      return;
    }

    if (!newSubTreatment.trim()) {
      showToast('Sub-treatment name required', 'error');
      return;
    }

    if (!isAdmin && isAgent && agentPermissions && !agentPermissions.canCreate && !agentPermissions.canAll) {
      showToast('Permission denied', 'error');
      return;
    }

    setLoading(true);

    try {
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
      const token = adminToken || agentToken;

      if (!token) {
        showToast('Authentication required', 'error');
        setLoading(false);
        return;
      }

      const res = await axios.post('/api/admin/addSubTreatment', {
        mainTreatmentId: selectedMainTreatment,
        subTreatmentName: newSubTreatment,
        subTreatmentSlug: newSubTreatment.toLowerCase().replace(/\s+/g, '-'),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 201) {
        showToast('Sub-treatment added', 'success');
        setNewSubTreatment('');
        setSelectedMainTreatment('');
        fetchTreatments();
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to add sub-treatment';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setTreatmentToDelete({ id, name });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!treatmentToDelete) return;

    if (!isAdmin && isAgent && agentPermissions && !agentPermissions.canDelete && !agentPermissions.canAll) {
      showToast('Permission denied', 'error');
      setShowDeleteModal(false);
      setTreatmentToDelete(null);
      return;
    }

    setIsDeleting(true);
    
    try {
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const agentToken = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
      const token = adminToken || agentToken;

      if (!token) {
        showToast('Authentication required', 'error');
        setIsDeleting(false);
        return;
      }

      await axios.delete(`/api/admin/deleteTreatment?id=${treatmentToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Treatment deleted', 'success');
      fetchTreatments();
      setShowDeleteModal(false);
      setTreatmentToDelete(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setTreatmentToDelete(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent, type: 'main' | 'sub') => {
    if (e.key === 'Enter') {
      if (type === 'main') {
        handleAddMainTreatment();
      } else {
        handleAddSubTreatment();
      }
    }
  };

  const totalSubTreatments = treatments.reduce((total, treatment) => total + (treatment.subcategories?.length || 0), 0);
  const treatmentsWithSub = treatments.filter((treatment) => (treatment.subcategories?.length || 0) > 0).length;
  const subCoveragePercent = treatments.length
    ? Math.round((treatmentsWithSub / treatments.length) * 100)
    : 0;
  const avgSubsPerMain = treatments.length
    ? parseFloat((totalSubTreatments / treatments.length).toFixed(1))
    : 0;
  const topTreatments = [...treatments]
    .map((treatment) => ({
      ...treatment,
      subCount: treatment.subcategories?.length || 0,
    }))
    .sort((a, b) => b.subCount - a.subCount)
    .slice(0, 5);
  const maxSubCount = Math.max(...topTreatments.map((t) => t.subCount), 1);

  // Show access denied message only for agents without read permission
  if (!isAdmin && isAgent && !permissionsLoading && agentPermissions && !agentPermissions.canRead && !agentPermissions.canAll) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <XCircleIcon className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-700">
            You do not have permission to view treatments.
          </p>
        </div>
      </div>
    );
  }

  if (fetching && treatments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

 return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Compact Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gray-800 p-2 rounded-lg">
                <BeakerIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Treatment Management</h1>
                <p className="text-xs text-gray-700">Add and manage treatments</p>
              </div>
            </div>
            <button
              onClick={fetchTreatments}
              disabled={fetching}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {fetching ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-700 mb-1">Main</p>
            <p className="text-xl font-bold text-gray-900">{treatments.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-700 mb-1">Sub</p>
            <p className="text-xl font-bold text-gray-900">{totalSubTreatments}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-700 mb-1">Total</p>
            <p className="text-xl font-bold text-gray-900">{treatments.length + totalSubTreatments}</p>
          </div>
        </div>

        {/* Graphical Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Treatment Distribution</p>
              <p className="text-xs text-gray-600">Share of sub-treatments by top mains</p>
            </div>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {totalSubTreatments} sub treatments
            </span>
          </div>
          {topTreatments.length === 0 || totalSubTreatments === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500">No data yet</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative flex items-center justify-center">
                <svg viewBox="0 0 220 220" className="w-48 h-48">
                  <defs>
                    <radialGradient id="innerCircle" cx="50%" cy="50%" r="50%">
                      <stop offset="70%" stopColor="#111827" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </radialGradient>
                    <linearGradient id="donutColor1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                    <linearGradient id="donutColor2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#facc15" />
                    </linearGradient>
                    <linearGradient id="donutColor3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fde047" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <linearGradient id="donutColor4" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <linearGradient id="donutColor5" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  {topTreatments.reduce(
                    (segments: { paths: React.ReactElement[]; currentAngle: number }, treatment, index) => {
                      const fraction = (treatment.subCount || 0) / totalSubTreatments;
                      const startAngle = segments.currentAngle;
                      const endAngle = startAngle + fraction * Math.PI * 2;
                      const largeArcFlag = fraction > 0.5 ? 1 : 0;
                      const radiusOuter = 90;
                      const radiusInner = 45;
                      const startOuterX = 110 + radiusOuter * Math.cos(startAngle);
                      const startOuterY = 110 + radiusOuter * Math.sin(startAngle);
                      const endOuterX = 110 + radiusOuter * Math.cos(endAngle);
                      const endOuterY = 110 + radiusOuter * Math.sin(endAngle);
                      const startInnerX = 110 + radiusInner * Math.cos(endAngle);
                      const startInnerY = 110 + radiusInner * Math.sin(endAngle);
                      const endInnerX = 110 + radiusInner * Math.cos(startAngle);
                      const endInnerY = 110 + radiusInner * Math.sin(startAngle);

                      segments.paths.push(
                        <path
                          key={treatment._id}
                          d={`M ${startOuterX} ${startOuterY} A ${radiusOuter} ${radiusOuter} 0 ${largeArcFlag} 1 ${endOuterX} ${endOuterY} L ${startInnerX} ${startInnerY} A ${radiusInner} ${radiusInner} 0 ${largeArcFlag} 0 ${endInnerX} ${endInnerY} Z`}
                          fill={`url(#donutColor${(index % 5) + 1})`}
                          className="shadow-sm"
                        />
                      );

                      segments.currentAngle = endAngle;
                      return segments;
                    },
                    { paths: [] as React.ReactElement[], currentAngle: -Math.PI / 2 }
                  ).paths}
                  <circle cx="110" cy="110" r="40" fill="url(#innerCircle)" />
                </svg>
                <div className="absolute text-center">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-semibold text-gray-900">{totalSubTreatments}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                {topTreatments.map((treatment, index) => {
                  const percent = ((treatment.subCount / totalSubTreatments) * 100).toFixed(1);
                  const legendColors = [
                    "text-pink-500",
                    "text-orange-500",
                    "text-yellow-500",
                    "text-green-500",
                    "text-blue-500",
                  ];
                  return (
                    <div
                      key={treatment._id}
                      className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${legendColors[index % legendColors.length]}`}>
                          {percent}%
                        </span>
                        <span className="font-medium text-gray-900 truncate">{treatment.name}</span>
                      </div>
                      <span className="text-gray-500 font-semibold">{treatment.subCount} sub</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
            <span>Main with sub treatments: {treatmentsWithSub}</span>
            <span>
              Avg sub/main:{" "}
              {treatments.length ? (totalSubTreatments / treatments.length).toFixed(1) : "0.0"}
            </span>
          </div>
        </div>

        {/* Coverage & Activity Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center relative"
              style={{
                background: `conic-gradient(#111 ${subCoveragePercent}%, #e5e7eb ${subCoveragePercent}% 100%)`,
              }}
            >
              <div className="absolute w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-gray-900">
                  {subCoveragePercent}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Coverage</p>
              <p className="text-xs text-gray-600 mb-2">
                Main treatments with at least one sub-treatment
              </p>
              <p className="text-sm text-gray-700">
                {treatmentsWithSub} of {treatments.length || 0} mains
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center relative"
              style={{
                background: `conic-gradient(#4b5563 ${Math.min(
                  (avgSubsPerMain / 5) * 100,
                  100
                )}%, #e5e7eb ${Math.min((avgSubsPerMain / 5) * 100, 100)}% 100%)`,
              }}
            >
              <div className="absolute w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-gray-900">
                  {avgSubsPerMain}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Avg. Sub Count</p>
              <p className="text-xs text-gray-600 mb-2">
                Average sub-treatments per main (target 5+)
              </p>
              <p className="text-sm text-gray-700">
                {totalSubTreatments} subs / {treatments.length || 0} mains
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Add Treatment Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Treatment</h2>

            <div className="space-y-4">
              {/* Main Treatment */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Main Treatment
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMainTreatment}
                    onChange={(e) => setNewMainTreatment(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'main')}
                    placeholder="Enter name"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-800"
                  />
                  {(isAdmin || (isAgent && !permissionsLoading && agentPermissions && (agentPermissions.canCreate || agentPermissions.canAll))) && (
                    <button
                      onClick={handleAddMainTreatment}
                      disabled={loading}
                      className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? '...' : 'Add'}
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Sub-Treatment
                </label>
                
                <select
                  value={selectedMainTreatment}
                  onChange={(e) => setSelectedMainTreatment(e.target.value)}
                  className="w-full mb-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-800"
                >
                  <option value="">Select main treatment</option>
                  {treatments.map((treatment) => (
                    <option key={treatment._id} value={treatment._id}>
                      {treatment.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubTreatment}
                    onChange={(e) => setNewSubTreatment(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'sub')}
                    placeholder="Enter sub-treatment name"
                    disabled={!selectedMainTreatment}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-800 disabled:opacity-50"
                  />
                  {(isAdmin || (isAgent && !permissionsLoading && agentPermissions && (agentPermissions.canCreate || agentPermissions.canAll))) && (
                    <button
                      onClick={handleAddSubTreatment}
                      disabled={loading || !selectedMainTreatment}
                      className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? '...' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Treatment List */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">All Treatments</h2>
              <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {treatments.length}
              </span>
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {treatments.length === 0 ? (
                <div className="text-center py-8">
                  <BeakerIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-700">No treatments yet</p>
                </div>
              ) : (
                treatments.map((treatment, index) => {
                  const adminTokenExists = typeof window !== 'undefined' ? !!localStorage.getItem('adminToken') : false;
                  const agentTokenExists = typeof window !== 'undefined' ? !!localStorage.getItem('agentToken') : false;
                  const isAgentRoute = router.pathname?.startsWith('/agent/') || (typeof window !== 'undefined' && window.location.pathname?.startsWith('/agent/'));
                  
                  const canDelete = isAdmin || (isAgent && !permissionsLoading && agentPermissions && (agentPermissions.canDelete || agentPermissions.canAll));
                  
                  return (
                    <div
                      key={treatment._id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className="text-xs text-gray-700 font-medium pt-0.5">
                            {index + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {treatment.name}
                            </h4>
                            {treatment.subcategories && treatment.subcategories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {treatment.subcategories.map((sub, subIndex) => (
                                  <span
                                    key={subIndex}
                                    className="text-xs text-gray-700 bg-white border border-gray-300 px-2 py-0.5 rounded"
                                  >
                                    {sub.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(treatment._id, treatment.name)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={handleDeleteCancel}
          />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-5">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Delete Treatment?
              </h3>
              <p className="text-xs text-gray-700 mb-3">
                This action cannot be undone.
              </p>
              <div className="bg-gray-50 rounded px-3 py-2">
                <p className="text-sm font-medium text-gray-900">
                  &quot;{treatmentToDelete?.name}&quot;
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
);
};

AddTreatment.getLayout = function PageLayout(page: React.ReactNode) {
  return <AdminLayout>{page}</AdminLayout>;
};

const ProtectedDashboard: NextPageWithLayout = withAdminAuth(AddTreatment);
ProtectedDashboard.getLayout = AddTreatment.getLayout;

export default ProtectedDashboard;
