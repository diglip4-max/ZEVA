import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import axios from "axios";
import Loader from "../../components/Loader";
import { FileText } from "lucide-react";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
];

// next/dynamic requires the options to be an inline object literal (SWC build
// check), so the shared `loading` fallback is repeated per call. It lets the
// gate also cover the JS chunk download the first time a report tab is opened.
const DepartmentReport = dynamic(() => import("../../components/reports/DepartmentReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const PackageReport = dynamic(() => import("../../components/reports/PackageReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const MembershipReport = dynamic(() => import("../../components/reports/MembershipReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const AppointmentReport = dynamic(() => import("../../components/reports/AppointmentReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const PatientReport = dynamic(() => import("../../components/reports/PatientReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const LeadReport = dynamic(() => import("../../components/reports/LeadReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const DoctorStaffReport = dynamic(() => import("../../components/reports/DoctorStaffReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const RevenueReport = dynamic(() => import("../../components/reports/RevenueReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const RoomResourceReport = dynamic(() => import("../../components/reports/RoomResourceReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const StockReport = dynamic(() => import("../../components/reports/StockReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const OfferTrackReport = dynamic(() => import("../../components/reports/OfferTrackReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const InsuranceClaimsReport = dynamic(() => import("../../components/reports/InsuranceClaimsReport"), { ssr: false, loading: () => <ReportChunkFallback /> });
const AdvanceReport = dynamic(() => import("../../components/reports/AdvanceReport"), { ssr: false, loading: () => <ReportChunkFallback /> });

/**
 * Loading gate for the report tabs.
 *
 * Every report page in components/reports fires several parallel fetches as
 * soon as it mounts (and again whenever the date range changes), and each
 * component renders its own partial content as responses trickle in. The gate
 * keeps a single overlay up until all of those requests have landed, so a tab
 * never shows half-populated sections while the remaining APIs are still
 * running. Requests are counted through a temporary window.fetch patch, which
 * keeps the 13 report components untouched.
 */

// Only report endpoints are tracked; unrelated background calls such as the
// notification bell (/api/push-notification) must not drive the overlay.
const REPORT_API_PATTERNS = ["/api/clinic/", "/api/lead-ms/", "/api/reports"];
// Small grace window so a follow-up call in the same waterfall does not
// briefly unhide partially rendered data.
const REPORT_SETTLE_MS = 300;
// First paint of a lazily imported report also waits for its JS chunk.
const REPORT_CHUNK_SETTLE_MS = 350;
// Safety net: never leave the overlay stuck if a request never settles.
const REPORT_WATCHDOG_MS = 25000;

function isReportApiUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  return REPORT_API_PATTERNS.some((pattern) => url.includes(pattern));
}

interface ReportGateApi {
  /** Mark a lazily loaded report chunk as pending; returns the release fn. */
  registerChunk: () => () => void;
}

const ReportGateContext = createContext<ReportGateApi | null>(null);

/** Fallback rendered by next/dynamic while a report chunk is downloading. */
function ReportChunkFallback() {
  const gate = useContext(ReportGateContext);
  useEffect(() => {
    if (!gate) return;
    return gate.registerChunk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);
  return null;
}

function ReportLoadingGate({ resetKey, children }: { resetKey: string; children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const inflightRef = useRef(0);
  const chunksRef = useRef(0);
  const settleTimerRef = useRef<any>(null);
  const watchdogRef = useRef<any>(null);
  // The patched fetch and the chunk fallback need the same bookkeeping, so the
  // helpers created inside the effect are published through this ref.
  const apiRef = useRef<Record<string, () => void>>({});

  useLayoutEffect(() => {
    setLoading(true);
    inflightRef.current = 0;
    chunksRef.current = 0;

    const cancelSettle = () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    const armWatchdog = () => {
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        watchdogRef.current = null;
        inflightRef.current = 0;
        chunksRef.current = 0;
        cancelSettle();
        setLoading(false);
      }, REPORT_WATCHDOG_MS);
    };

    const isIdle = () => inflightRef.current === 0 && chunksRef.current === 0;

    const scheduleSettle = (delay = REPORT_SETTLE_MS) => {
      cancelSettle();
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        if (isIdle()) {
          clearWatchdog();
          setLoading(false);
        }
      }, delay);
    };

    const markBusy = () => {
      cancelSettle();
      armWatchdog();
      setLoading(true);
    };

    apiRef.current = { markBusy, scheduleSettle, clearWatchdog };
    markBusy();

    const originalFetch = window.fetch;
    const countingFetch: typeof window.fetch = (input: any, init?: any) => {
      const url =
        typeof input === "string"
          ? input
          : input?.url ||
            (typeof Request !== "undefined" && input instanceof Request ? input.url : "");
      if (!isReportApiUrl(url)) return originalFetch(input as any, init);

      inflightRef.current += 1;
      markBusy();

      const settle = () => {
        inflightRef.current = Math.max(0, inflightRef.current - 1);
        if (inflightRef.current === 0) scheduleSettle();
      };

      return originalFetch(input as any, init).then(
        (res) => {
          settle();
          return res;
        },
        (err) => {
          settle();
          throw err;
        }
      );
    };

    (window as any).fetch = countingFetch;
    // Nothing was ever issued (e.g. instant cached responses): settle anyway
    scheduleSettle(REPORT_CHUNK_SETTLE_MS);

    return () => {
      cancelSettle();
      clearWatchdog();
      apiRef.current = {};
      (window as any).fetch = originalFetch;
    };
  }, [resetKey]);

  const gateApi = useMemo<ReportGateApi>(
    () => ({
      registerChunk: () => {
        chunksRef.current += 1;
        apiRef.current.markBusy?.();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          chunksRef.current = Math.max(0, chunksRef.current - 1);
          apiRef.current.scheduleSettle?.();
        };
      },
    }),
    [resetKey]
  );

  return (
    <ReportGateContext.Provider value={gateApi}>
      {/* min-h mirrors the card body so the overlay still covers the area while
          a freshly opened report has rendered no content yet */}
      <div className="relative flex-1 w-full min-h-[460px] sm:min-h-[560px]">
        {children}
        {loading && (
          <div className="report-overlay absolute inset-0 z-[900] flex justify-center items-start px-4 pt-10 sm:pt-16 pb-12 min-h-[280px]">
            <div className="report-card w-full max-w-xs rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-2xl shadow-teal-900/10 overflow-hidden">
              {/* Gradient accent strip */}
              <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-blue-500"></div>
              <div className="px-5 pt-5 pb-5 flex flex-col items-center gap-3">
                {/* Layered animated spinner with center glyph + glow */}
                <div className="relative h-12 w-12">
                  <div className="report-glow absolute inset-0 rounded-full bg-teal-400/30 blur-lg"></div>
                  <div className="absolute inset-0 rounded-full border-[3px] border-slate-100"></div>
                  <div className="report-ring-a absolute inset-0 rounded-full border-[3px] border-transparent border-t-teal-600 border-r-teal-500"></div>
                  <div className="report-ring-b absolute inset-1.5 rounded-full border-2 border-transparent border-b-blue-500 border-l-sky-400"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="M7 15l3-4 3 2 4-6" />
                    </svg>
                  </div>
                </div>
                {/* Title with animated ellipsis */}
                <div className="text-center space-y-0.5">
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">
                    Preparing your report
                    <span className="report-dots inline-flex w-6 justify-start">
                      <span className="report-dot">.</span>
                      <span className="report-dot">.</span>
                      <span className="report-dot">.</span>
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">Crunching the latest analytics…</p>
                </div>
                {/* Glowing indeterminate progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                  <div className="report-loading-bar h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-blue-500"></div>
                </div>
              </div>
            </div>
            <style jsx>{`
              .report-overlay {
                background:
                  radial-gradient(1200px 400px at 50% -10%, rgba(20, 184, 166, 0.08), rgba(255, 255, 255, 0) 60%),
                  #ffffff;
              }
              .report-card {
                animation: reportCardIn 0.35s ease-out both;
              }
              @keyframes reportCardIn {
                from { opacity: 0; transform: translateY(8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .report-ring-a { animation: reportSpin 0.9s linear infinite; }
              .report-ring-b { animation: reportSpinRev 1.4s linear infinite; }
              @keyframes reportSpin { to { transform: rotate(360deg); } }
              @keyframes reportSpinRev { to { transform: rotate(-360deg); } }
              .report-glow { animation: reportPulse 2s ease-in-out infinite; }
              @keyframes reportPulse {
                0%, 100% { opacity: 0.5; transform: scale(0.9); }
                50% { opacity: 1; transform: scale(1.05); }
              }
              .report-loading-bar {
                width: 42%;
                animation: reportLoadingSlide 1.2s ease-in-out infinite;
              }
              @keyframes reportLoadingSlide {
                0% { transform: translateX(-120%); }
                50% { transform: translateX(150%); }
                100% { transform: translateX(320%); }
              }
              .report-dot { animation: reportBlink 1.2s infinite both; }
              .report-dot:nth-child(2) { animation-delay: 0.2s; }
              .report-dot:nth-child(3) { animation-delay: 0.4s; }
              @keyframes reportBlink {
                0%, 60%, 100% { opacity: 0.2; }
                30% { opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>
    </ReportGateContext.Provider>
  );
}

const TAB_CONFIG = {
  department: { label: "Department", color: "bg-teal-800 hover:bg-teal-900" },
  package: { label: "Package", color: "bg-teal-800 hover:bg-teal-900" },
  membership: { label: "Membership", color: "bg-teal-800 hover:bg-teal-900" },
  appointment: { label: "Appointment", color: "bg-teal-800 hover:bg-teal-900" },
  patient: { label: "Patient", color: "bg-teal-800 hover:bg-teal-900" },
  lead: { label: "Lead", color: "bg-teal-800 hover:bg-teal-900" },
  doctorStaff: { label: "Doctor Staff", color: "bg-teal-800 hover:bg-teal-900" },
  revenue: { label: "Revenue", color: "bg-teal-800 hover:bg-teal-900" },
  rooms: { label: "Rooms", color: "bg-teal-800 hover:bg-teal-900" },
  stock: { label: "Stock", color: "bg-teal-800 hover:bg-teal-900" },
  offerTrack: { label: "Offer Track", color: "bg-teal-800 hover:bg-teal-900" },
  insuranceClaims: { label: "Insurance Claims", color: "bg-teal-800 hover:bg-teal-900" },
  advancePending: { label: "Advance & Pending", color: "bg-teal-800 hover:bg-teal-900" },
};

function ReportPage() {
  const [activeTab, setActiveTab] = useState<
    "department" | "package" | "membership" | "appointment" | "patient" | "lead" | "doctorStaff" | "rooms" | "revenue" | "stock" | "offerTrack" | "insuranceClaims" | "advancePending"
  >("department");
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("clinicToken") ||
        sessionStorage.getItem("clinicToken") ||
        localStorage.getItem("doctorToken") ||
        sessionStorage.getItem("doctorToken") ||
        localStorage.getItem("agentToken") ||
        sessionStorage.getItem("agentToken") ||
        localStorage.getItem("staffToken") ||
        sessionStorage.getItem("staffToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken")
      : "";

  const headers = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    }),
    [token]
  );

  // Determine if we're on an agent route
  const isAgentRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/agent/") || window.location.pathname.startsWith("/staff/");

  // Use agent permissions hook for agent routes
  const agentPermissionsHook: any = useAgentPermissions(
    isAgentRoute ? "clinic_report" : null,
  );
  const agentPermissions = agentPermissionsHook?.permissions || {
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  // Multi-token role detection — checks all stored token types
  const getUserInfo = (): { role: string | null; id: string | null } => {
    if (typeof window === "undefined") return { role: null, id: null };
    const tokenKeys = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];
    for (const key of tokenKeys) {
      try {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!token) continue;
        const base64Url = token.split(".")[1];
        if (!base64Url) continue;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
        if (decoded.role) {
          return { role: decoded.role, id: decoded.userId || decoded.id || null };
        }
      } catch (e) { /* ignore */ }
    }
    return { role: 'clinic', id: null };
  };

  const getUserRole = (): string | null => {
    return getUserInfo().role;
  };

  // Helper function to get stored token
  const getStoredToken = (): string | null => {
    if (typeof window === "undefined") return null;
    for (const key of TOKEN_PRIORITY) {
      const token =
        window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (token) return token;
    }
    return null;
  };

  // Handle agent permissions
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

  // Handle clinic permissions - clinic, doctor have admin-level permissions; agent/doctorStaff need checks
  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;

    // Check which token type is being used
    const clinicToken =
      typeof window !== "undefined"
        ? localStorage.getItem("clinicToken") ||
          sessionStorage.getItem("clinicToken")
        : null;
    const doctorToken =
      typeof window !== "undefined"
        ? localStorage.getItem("doctorToken") ||
          sessionStorage.getItem("doctorToken")
        : null;
    const agentToken =
      typeof window !== "undefined"
        ? localStorage.getItem("agentToken") ||
          sessionStorage.getItem("agentToken")
        : null;
    const staffToken =
      typeof window !== "undefined"
        ? localStorage.getItem("staffToken") ||
          sessionStorage.getItem("staffToken")
        : null;
    const userToken =
      typeof window !== "undefined"
        ? localStorage.getItem("userToken") ||
          sessionStorage.getItem("userToken")
        : null;

    const userRole = getUserRole();
    const authToken =
      clinicToken || doctorToken || agentToken || staffToken || userToken;

    // For admin role, grant full access (bypass permission checks)
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

    // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
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
            timeout: 6000,
          });

          if (!isMounted) return;

          if (res.data.success) {
            // Check if permissions array exists and is not null
            // If permissions is null, admin hasn't set any restrictions yet - allow full access (backward compatibility)
            if (
              res.data.permissions === null ||
              !Array.isArray(res.data.permissions) ||
              res.data.permissions.length === 0
            ) {
              // No admin restrictions set yet - default to full access for backward compatibility
              setPermissions({
                canRead: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
              });
            } else {
              // Admin has set permissions - check the clinic_report module
              const modulePermission = res.data.permissions.find((p: any) => {
                if (!p?.module) return false;
                // Check for clinic_report module variations
                if (p.module === "clinic_report") return true;
                if (p.module === "clinic_Report") return true;
                if (p.module === "report") return true;
                return false;
              });

              if (modulePermission) {
                const actions = modulePermission.actions || {};

                // Check if "all" is true, which grants all permissions
                const moduleAll =
                  actions.all === true ||
                  actions.all === "true" ||
                  String(actions.all).toLowerCase() === "true";
                const moduleCreate =
                  actions.create === true ||
                  actions.create === "true" ||
                  String(actions.create).toLowerCase() === "true";
                const moduleRead =
                  actions.read === true ||
                  actions.read === "true" ||
                  String(actions.read).toLowerCase() === "true";
                const moduleUpdate =
                  actions.update === true ||
                  actions.update === "true" ||
                  String(actions.update).toLowerCase() === "true";
                const moduleDelete =
                  actions.delete === true ||
                  actions.delete === "true" ||
                  String(actions.delete).toLowerCase() === "true";

                setPermissions({
                  canRead: moduleAll || moduleRead,
                  canCreate: moduleAll || moduleCreate,
                  canUpdate: moduleAll || moduleUpdate,
                  canDelete: moduleAll || moduleDelete,
                });
              } else {
                // Module permission not found in the permissions array - default to read-only
                setPermissions({
                  canRead: true, // Clinic/doctor can always read their own data
                  canCreate: false,
                  canUpdate: false,
                  canDelete: false,
                });
              }
            }
          } else {
            // API response doesn't have permissions, default to full access (backward compatibility)
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } catch (err: any) {
          console.error("Error fetching clinic sidebar permissions:", err);
          // On error, default to full access (backward compatibility)
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

    // For agent/doctorStaff tokens (when not on agent route), check permissions
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

    // Only check permissions for agent/doctorStaff roles when not on agent route
    if (agentToken || staffToken || userToken) {
      const fetchPermissions = async () => {
        try {
          console.log(
            "Fetching Agent/Staff Permissions for clinic_report...",
          );
          setPermissionsLoaded(false);
          // Use agent permissions API for agent/doctorStaff
          const res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: "clinic_report" },
            headers: { Authorization: `Bearer ${agentStaffToken}` },
            timeout: 6000,
          });
          const data = res.data;
          console.log("Agent Permissions API Response:", data);

          if (!isMounted) return;

          // Default to true if module not found in permissions (matches backend logic)
          if (
            !data?.permissions &&
            data?.error?.includes("not found in agent permissions")
          ) {
            console.log(
              "Module not found in permissions, denying access by default",
            );
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
            return;
          }

          const actions =
            data?.permissions?.actions || data?.data?.moduleActions || {};
          const isTrue = (val: any) =>
            val === true ||
            val === "true" ||
            String(val || "").toLowerCase() === "true";

          const canAll = isTrue(actions.all);

          const newPerms = {
            canRead: canAll || isTrue(actions.read),
            canCreate: canAll || isTrue(actions.create),
            canUpdate: canAll || isTrue(actions.update),
            canDelete: canAll || isTrue(actions.delete),
          };

          console.log("Final Agent/Staff Permissions:", newPerms);
          setPermissions(newPerms);
        } catch (err: any) {
          console.error("Error fetching agent permissions:", err);
          // Swallow agent permission errors; they will just result in no extra access
          setPermissions({
            canRead: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          });
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchPermissions();
      return;
    }

    // Default: no token, no permissions
    if (!authToken) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      });
      setPermissionsLoaded(true);
    }
  }, [isAgentRoute]);

  // Show loading while permissions are being fetched
  if (!permissionsLoaded) return <Loader />;

  // Show access denied message if no permission
  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-sm text-gray-700">
            You do not have permission to view reports. Please contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Section - Responsive */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[90%] sm:max-w-9xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">View detailed performance metrics and insights</p>
            </div>
            <div className="bg-blue-50 rounded-lg px-3 sm:px-4 py-2 border border-blue-100 w-full sm:w-auto">
              <div className="text-xs text-gray-600 font-medium">Date Range</div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900">
                {dayjs(startDate).format("MMM DD, YYYY")} - {dayjs(endDate).format("MMM DD, YYYY")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 py-4 sm:py-8 flex-1 flex flex-col">
        {/* Date Filter & Tabs Container - Responsive */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-4 sm:mb-6 overflow-hidden">
          {/* Tabs Navigation - Scrollable on Mobile */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-3 sm:px-6 py-2 sm:py-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                {Object.entries(TAB_CONFIG).map(([key, config]) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={`group px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? `${config.color} text-white shadow-md`
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date Range Selector - Stacked on Mobile */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-auto bg-white border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-auto bg-white border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 dark:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 italic w-full sm:w-auto text-center sm:text-left">
                Select date range to view analytics
              </div>
            </div>
          </div>
        </div>

        {/* Report Content - Responsive, fills remaining viewport height */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-6 flex-1 flex flex-col min-h-[500px] sm:min-h-[600px] overflow-x-auto relative">
          <ReportLoadingGate resetKey={`${activeTab}|${startDate}|${endDate}`}>
            {activeTab === "department" && <DepartmentReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "package" && <PackageReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "membership" && <MembershipReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "appointment" && <AppointmentReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "patient" && <PatientReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "lead" && <LeadReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "doctorStaff" && <DoctorStaffReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "revenue" && <RevenueReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "rooms" && <RoomResourceReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "stock" && <StockReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "offerTrack" && <OfferTrackReport startDate={startDate} endDate={endDate} headers={headers} canUpdate={permissions.canUpdate} />}
            {activeTab === "insuranceClaims" && <InsuranceClaimsReport startDate={startDate} endDate={endDate} headers={headers} />}
            {activeTab === "advancePending" && <AdvanceReport startDate={startDate} endDate={endDate} headers={headers} />}
          </ReportLoadingGate>
        </div>
      </div>
    </div>
  );
}

ReportPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const Protected = withClinicAuth(ReportPage as any);
(Protected as any).getLayout = ReportPage.getLayout;

export default Protected;
