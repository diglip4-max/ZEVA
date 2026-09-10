import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import axios from 'axios';
import {
  Search, Bell, ChevronDown, ArrowLeftRight,
  TrendingUp, TrendingDown, Zap, Package, Loader2
} from 'lucide-react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { CreateOfferPageBase as OffersComponent } from '../../components/offer/create-offer';
import OverviewComponent from '../../components/offer/overview';
import CreateOfferWizard from '../../components/offer/CreateOfferWizard';
import DateFilter from '../../components/shared/DateFilter';
import UsageAndPerformanceComponent from '../../components/offer/UsageAndPerformance';
import AuditLog from '../../components/offer/AuditLog';
import LiabilitiesComponent from '../../components/offer/Liabilities';
import RulesAndControlsComponent from '../../components/offer/RulesAndControls';
import { useAgentPermissions } from '../../hooks/useAgentPermissions';

const MODULE_KEY = "clinic_create_offers";
const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];

function getStoredToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) return value;
    } catch { }
  }
  return null;
}

function resolveRoleAwareToken() {
  if (typeof window === "undefined") return null;
  try {
    for (const key of TOKEN_PRIORITY) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const base64Url = raw.split(".")[1];
        if (!base64Url) continue;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
        const role = decoded.role;
        const tokenKey = (
          role === "agent" || role === "staff" || role === "doctorStaff" ? "agentToken" :
          role === "clinic" ? "clinicToken" :
          role === "doctor" ? "doctorToken" :
          role === "admin" ? "adminToken" :
          null
        );
        if (tokenKey) {
          const roleMatched = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
          if (roleMatched) return roleMatched;
        }
      } catch { }
    }
  } catch { }
  return getStoredToken();
}

function SmartOffersDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [dateFilter, setDateFilter] = useState('Today');

  const allTabs = [
    'Overview', 'Offers', 'Create Offer', 'Usage & Performance',
    'Liabilities', 'Rules & Controls', 'Audit Log'
  ];

  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);

  const getUserInfo = useCallback(() => {
    if (typeof window === "undefined") return { role: null, id: null };
    // Role-aware token resolution: match decoded.role against storage key
    try {
      for (const key of TOKEN_PRIORITY) {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!token) continue;
        try {
          const base64Url = token.split(".")[1];
          if (!base64Url) continue;
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const decoded = JSON.parse(decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
          const role = decoded.role;
          if (!role) continue;
          const roleMatchesKey =
            (key === "agentToken" && (role === "agent" || role === "staff" || role === "doctorStaff")) ||
            (key === "staffToken" && (role === "staff" || role === "doctorStaff" || role === "agent")) ||
            (key === "clinicToken" && role === "clinic") ||
            (key === "doctorToken" && (role === "doctor" || role === "doctorStaff")) ||
            (key === "adminToken" && role === "admin") ||
            key === "userToken";
          if (roleMatchesKey) {
            return { role, id: decoded.userId || decoded.id || null };
          }
        } catch (e) { }
      }
    } catch (e) { }
    // Fallback: first decodable token
    try {
      for (const key of TOKEN_PRIORITY) {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!token) continue;
        try {
          const base64Url = token.split(".")[1];
          if (!base64Url) continue;
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const decoded = JSON.parse(decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
          if (decoded.role) {
            return { role: decoded.role, id: decoded.userId || decoded.id || null };
          }
        } catch (e) { }
      }
    } catch (e) { }
    return { role: 'clinic', id: null };
  }, []);

  const getUserRole = useCallback(() => {
    return getUserInfo().role;
  }, [getUserInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const agentTok = localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken");
      setHasAgentToken(!!agentTok);
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath = window.location.pathname?.startsWith("/agent/") || window.location.pathname?.startsWith("/staff/");
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [hasAgentToken]);

  const agentPermissionsHook = useAgentPermissions(
    isAgentRoute ? MODULE_KEY : null,
  );
  const agentPermissions = agentPermissionsHook?.permissions || {
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;

    const newPermissions = {
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
    };

    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;

    const clinicToken = typeof window !== "undefined" ? localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken") : null;
    const doctorToken = typeof window !== "undefined" ? localStorage.getItem("doctorToken") || sessionStorage.getItem("doctorToken") : null;
    const agentToken = typeof window !== "undefined" ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken") : null;
    const staffToken = typeof window !== "undefined" ? localStorage.getItem("staffToken") || sessionStorage.getItem("staffToken") : null;
    const userToken = typeof window !== "undefined" ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken") : null;

    const userRole = getUserRole();
    const authToken = clinicToken || doctorToken || agentToken || staffToken || userToken;

    if (userRole === "admin") {
      if (!isMounted) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      });
      setPermissionsLoaded(true);
      return;
    }

    if (userRole === "clinic" || userRole === "doctor") {
      const fetchClinicPermissions = async () => {
        try {
          if (!authToken) {
            if (!isMounted) return;
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
            setPermissionsLoaded(true);
            return;
          }

          const res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!isMounted) return;

          if (res.data.success) {
            if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
              setPermissions({
                canRead: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
              });
            } else {
              const modulePermission = res.data.permissions.find((p) => {
                if (!p?.module) return false;
                if (p.module === MODULE_KEY) return true;
                if (p.module === "clinic_create_offers") return true;
                if (p.module === "create_offers") return true;
                if (p.module === "create_offer") return true;
                if (p.module === "clinic_create_offer") return true;
                if (p.module === "Clinic_create_offers") return true;
                return false;
              });

              if (modulePermission) {
                const actions = modulePermission.actions || {};
                const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
                const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
                const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
                const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
                const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

                setPermissions({
                  canRead: moduleAll || moduleRead,
                  canCreate: moduleAll || moduleCreate,
                  canUpdate: moduleAll || moduleUpdate,
                  canDelete: moduleAll || moduleDelete,
                });
              } else {
                setPermissions({
                  canRead: true,
                  canCreate: false,
                  canUpdate: false,
                  canDelete: false,
                });
              }
            }
          } else {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } catch (err) {
          const status = err.response?.status;
          if (status !== 401 && status !== 403) {
            console.debug("Clinic sidebar permissions fetch issue:", err.message || String(err));
          }
          if (isMounted) {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchClinicPermissions();
      return;
    }

    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    if (agentToken || staffToken || userToken) {
      const fetchPermissions = async () => {
        try {
          setPermissionsLoaded(false);
          let res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: MODULE_KEY },
            headers: { Authorization: `Bearer ${agentStaffToken}` },
          });
          let data = res.data;

          if (!data?.permissions && data?.error?.includes("not found")) {
            res = await axios.get("/api/agent/get-module-permissions", {
              params: { moduleKey: "create_offers" },
              headers: { Authorization: `Bearer ${agentStaffToken}` },
            });
            data = res.data;
          }

          if (!isMounted) return;

          if (!data?.permissions && data?.error?.includes("not found in agent permissions")) {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
            return;
          }

          const actions = data?.permissions?.actions || data?.data?.moduleActions || {};
          const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";

          const canAll = isTrue(actions.all);

          const newPerms = {
            canRead: canAll || isTrue(actions.read),
            canCreate: canAll || isTrue(actions.create),
            canUpdate: canAll || isTrue(actions.update),
            canDelete: canAll || isTrue(actions.delete),
          };

          setPermissions(newPerms);
        } catch (err) {
          const status = err.response?.status;
          if (status !== 401 && status !== 403) {
            console.debug("Agent module permissions fetch issue:", err.message || String(err));
          }
          setPermissions({
            canRead: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
          });
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchPermissions();
    } else {
      if (!isMounted) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      });
      setPermissionsLoaded(true);
    }

    return () => {
      isMounted = false;
    };
  }, [isAgentRoute, getUserRole]);

  const tabs = permissions.canRead ? allTabs : (permissions.canCreate ? ['Create Offer'] : []);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead && permissions.canCreate) {
      if (activeTab !== 'Create Offer') {
        setActiveTab('Create Offer');
      }
    } else if (!permissions.canRead && !permissions.canCreate) {
    } else if (!allTabs.includes(activeTab) || (!permissions.canRead && activeTab !== 'Create Offer')) {
      setActiveTab(tabs[0] || 'Overview');
    }
  }, [permissionsLoaded, permissions.canRead, permissions.canCreate]);

  if (!permissionsLoaded) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          <p className="text-sm text-teal-700 dark:text-teal-300 font-medium">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!permissions.canRead && !permissions.canCreate) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-900/50 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            You do not have permission to view or create clinic offers.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Please contact your administrator to request access to the Offers module.
          </p>
        </div>
      </div>
    );
  }

  const tokenForChildren = typeof window !== 'undefined' ? (resolveRoleAwareToken() || "") : "";

  const accessDeniedBox = (title, message) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm p-12 text-center">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">{message}</p>
    </div>
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans min-h-screen">
      <Head>
        <title>Smart Offers | ZEVA</title>
      </Head>

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 pt-4 pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-start md:items-center mb-6">
            {/* Left side: Title and subtitle */}
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 dark:bg-indigo-600 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl">
                Z
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">Smart Offers</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Control benefits. Protect margin. Increase repeat revenue.</p>
              </div>
            </div>

            {/* Right side: Controls */}
            <div className="hidden lg:flex items-center gap-3">
              <DateFilter selected={dateFilter} onChange={setDateFilter} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar border-b border-gray-100 dark:border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                  ? 'border-emerald-600 dark:border-emerald-400 text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'Offers' ? (
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <OffersComponent
              dateFilter={dateFilter}
              setActiveTab={setActiveTab}
              pageLevelPermissions={permissions}
            />
          </div>
        ) : activeTab === 'Create Offer' ? (
          <div className="-mx-4 sm:-mx-6 lg:-mx-8 p-4">
            {permissions.canCreate ? (
              <CreateOfferWizard
                onCancel={() => permissions.canRead ? setActiveTab('Offers') : undefined}
                onCreated={() => permissions.canRead ? setActiveTab('Offers') : undefined}
                token={tokenForChildren}
                pageLevelPermissions={permissions}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Permission Required</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                  You do not have permission to create new offers. Please contact your administrator.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'Overview' ? (
          permissions.canRead ? (
            <OverviewComponent dateFilter={dateFilter} />
          ) : accessDeniedBox("Access Denied", "You do not have permission to view this section.")
        ) : activeTab === 'Usage & Performance' ? (
          permissions.canRead ? (
            <UsageAndPerformanceComponent dateFilter={dateFilter} />
          ) : accessDeniedBox("Access Denied", "You do not have permission to view this section.")
        ) : activeTab === 'Liabilities' ? (
          permissions.canRead ? (
            <LiabilitiesComponent dateFilter={dateFilter} />
          ) : accessDeniedBox("Access Denied", "You do not have permission to view this section.")
        ) : activeTab === 'Rules & Controls' ? (
          permissions.canRead ? (
            <RulesAndControlsComponent dateFilter={dateFilter} />
          ) : accessDeniedBox("Access Denied", "You do not have permission to view this section.")
        ) : activeTab === 'Audit Log' ? (
          permissions.canRead ? (
            <AuditLog dateFilter={dateFilter} />
          ) : accessDeniedBox("Access Denied", "You do not have permission to view this section.")
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm p-12 text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{activeTab}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">This section is currently under construction. Check back later for updates to the {activeTab} module.</p>
          </div>
        )}
      </main>

      {/* Hide scrollbar styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}

// Wrap in layout
SmartOffersDashboard.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

const ProtectedDashboard = withClinicAuth(SmartOffersDashboard);
ProtectedDashboard.getLayout = SmartOffersDashboard.getLayout;

export default ProtectedDashboard;
