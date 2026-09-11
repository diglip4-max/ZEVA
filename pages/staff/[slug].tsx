// Dynamic staff route handler (OPTIMIZED)
// Converts /staff/[slug] to render admin/clinic/doctor/staff pages with AgentLayout
// Handles token context (clinicToken, doctorToken, agentToken) based on route type
"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import AgentLayout from "../../components/AgentLayout";
import withAgentAuth from "../../components/withAgentAuth";
import { jwtDecode } from "jwt-decode";
import { createContext, useContext } from "react";

// ---------------------------------------------------------------------------
// Token context
// ---------------------------------------------------------------------------
type TokenContextValue = {
  agentToken: string | null;
  clinicToken: string | null;
  doctorToken: string | null;
  userRole: string | null;
  userInfo: any;
};

const EMPTY_TOKEN_CONTEXT: TokenContextValue = {
  agentToken: null,
  clinicToken: null,
  doctorToken: null,
  userRole: null,
  userInfo: null,
};

const TokenContext = createContext<TokenContextValue>(EMPTY_TOKEN_CONTEXT);
export const useTokenContext = () => useContext(TokenContext);

// ---------------------------------------------------------------------------
// Route classification
//
// FIX: previously "lead-" was matched inside the clinic OR-list, which made
// the later `if (slug.startsWith("lead-")) return agent` branch unreachable
// dead code. Every "lead-*" route (e.g. lead-create-lead) was silently
// mis-typed as "clinic" instead of "agent". Order matters here: most
// specific / narrowest prefixes must be checked first.
// ---------------------------------------------------------------------------
type RouteType = "admin" | "clinic" | "doctor" | "agent" | "unknown";

const ADMIN_SLUGS = new Set([
  "AdminClinicApproval",
  "approve-doctors",
  "add-treatment",
  "all-blogs",
  "analytics",
  "get-in-touch",
  "job-manage",
  "manage-clinic-permissions",
  "create-agent",
  "create-staff",
  "admin-add-service",
  "admin-create-vendor",
  "getAllEodNotes",
  "patient-report",
  "track-expenses",
  "contracters",
  "dashboard-admin",
  "seed-navigation",
  "all-clinic",
  "register-clinic",
]);

const getRouteInfo = (
  slug: string,
): { type: RouteType; tokenKey: string | null } => {
  // Most specific first: doctor-staff- before doctor-, clinic-staff- before clinic-
  if (slug.startsWith("lead-") || slug.startsWith("marketingalltype-")) {
    // "lead-" and marketing-alltype routes belong to the agent surface.
    return {
      type: slug.startsWith("lead-") ? "agent" : "clinic",
      tokenKey: slug.startsWith("lead-") ? "agentToken" : "clinicToken",
    };
  }
  if (slug.startsWith("doctor-staff-") || slug.startsWith("doctor-")) {
    return { type: "doctor", tokenKey: "doctorToken" };
  }
  if (slug.startsWith("clinic-staff-") || slug.startsWith("clinic-")) {
    return { type: "clinic", tokenKey: "clinicToken" };
  }
  if (slug.startsWith("admin-") || ADMIN_SLUGS.has(slug)) {
    return { type: "admin", tokenKey: "adminToken" };
  }
  return { type: "unknown", tokenKey: null };
};

// ---------------------------------------------------------------------------
// Route map (unchanged — same imports as before)
// ---------------------------------------------------------------------------
const routeMap: { [key: string]: () => Promise<any> } = {
  // Admin routes
  AdminClinicApproval: () => import("../admin/AdminClinicApproval"),
  "approve-doctors": () => import("../admin/approve-doctors"),
  "add-treatment": () => import("../admin/add-treatment"),
  "all-blogs": () => import("../admin/all-blogs"),
  analytics: () => import("../admin/analytics"),
  "get-in-touch": () => import("../admin/get-in-touch"),
  "job-manage": () => import("../admin/job-manage"),
  "manage-clinic-permissions": () =>
    import("../admin/manage-clinic-permissions"),
  "create-agent": () => import("../admin/create-agent"),
  "create-staff": () => import("../admin/create-staff"),
  "admin-add-service": () => import("../admin/admin-add-service"),
  "admin-create-vendor": () => import("../admin/admin-create-vendor"),
  getAllEodNotes: () => import("../admin/getAllEodNotes"),
  "patient-report": () => import("../admin/patient-report"),
  "track-expenses": () => import("../admin/track-expenses"),
  contracters: () => import("../admin/contractor"),
  "dashboard-admin": () => import("../admin/dashboard-admin"),
  "seed-navigation": () => import("../admin/seed-navigation"),
  "all-clinic": () => import("../admin/all-clinic"),
  "register-clinic": () => import("../admin/register-clinic"),

  // Clinic routes
  myallClinic: () => import("../clinic/myallClinic"),
  "clinic-myallClinic": () => import("../clinic/myallClinic"),
  "clinic-dashboard": () => import("../clinic/clinic-dashboard"),
  "clinic-clinic-dashboard": () => import("../clinic/clinic-dashboard"),
  "clinic-BlogForm": () => import("../clinic/BlogForm"),
  "job-posting": () => import("../clinic/job-posting"),
  "clinic-published-blogs": () => import("../clinic/published-blogs"),
  "clinic-my-jobs": () => import("../clinic/my-jobs"),
  "clinic-job-applicants": () => import("../clinic/job-applicants"),
  "clinic-getAuthorCommentsAndLikes": () =>
    import("../clinic/getAuthorCommentsAndLikes"),
  "clinic-add-room": () => import("../agent/clinic-add-room"),
  "clinic-assigned-leads": () => import("../agent/clinic-assigned-leads"),
  "clinic-get-Enquiry": () => import("../agent/clinic-get-Enquiry"),
  "clinic-appointment": () => import("../agent/clinic-appointment"),
  "clinic-job-posting": () => import("../agent/clinic-job-posting"),
  "clinic-all-appointment": () => import("../agent/clinic-all-appointment"),
  "lead-create-lead": () => import("../agent/lead-create-lead"),
  getAllReview: () => import("../clinic/getAllReview"),
  "clinic-getAllReview": () => import("../clinic/getAllReview"),
  "get-Enquiry": () => import("../clinic/get-Enquiry"),
  "enquiry-form": () => import("../clinic/enquiry-form"),
  "review-form": () => import("../clinic/review-form"),
  "clinic-seed-navigation": () => import("../clinic/seed-navigation"),
  "clinic-staff-dashboard": () => import("../staff/staff-dashboard"),
  "clinic-add-service": () => import("../staff/add-service"),
  "clinic-patient-registration": () => import("../clinic/patient-registration"),
  "clinic-patient-information": () => import("../clinic/patient-information"),
  "clinic-patient-profile-view": () => import("../clinic/patient-profile-view"),
  "clinic-eodNotes": () => import("../staff/eodNotes"),
  "clinic-AddPettyCashForm": () => import("../staff/AddPettyCashForm"),
  "clinic-add-vendor": () => import("../staff/add-vendor"),
  "clinic-membership": () => import("../staff/membership"),
  "clinic-contract": () => import("../staff/contract"),
  "clinic-pending-claims": () => import("../staff/pending-claims"),
  "clinic-cancelled-claims": () => import("../staff/cancelled-claims"),
  "clinic-all-claims": () => import("../clinic/all-claims"),
  "clinic-booked-appointments": () => import("../staff/booked-appointments"),
  "clinic-staff-add-treatment": () => import("../staff/add-treatment"),

  // Marketing routes
  "marketingalltype-sms-marketing": () =>
    import("../marketingalltype/sms-marketing"),
  "marketingalltype-whatsapp-marketing": () =>
    import("../marketingalltype/whatsapp-marketing"),
  "marketingalltype-gmail-marketing": () =>
    import("../marketingalltype/gmail-marketing"),

  // Doctor routes
  "doctor-dashboard": () => import("../doctor/doctor-dashboard"),
  manageDoctor: () => import("../doctor/manageDoctor"),
  getReview: () => import("../doctor/getReview"),
  "doctor-BlogForm": () => import("../doctor/BlogForm"),
  "doctor-published-blogs": () => import("../doctor/published-blogs"),
  "doctor-getAuthorCommentsAndLikes": () =>
    import("../doctor/getAuthorCommentsAndLikes"),
  "create-job": () => import("../doctor/create-job"),
  "doctor-my-jobs": () => import("../doctor/my-jobs"),
  "doctor-job-applicants": () => import("../doctor/job-applicants"),
  "prescription-requests": () => import("../doctor/prescription-requests"),
  "doctor-seed-navigation": () => import("../doctor/seed-navigation"),
  "doctor-staff-dashboard": () => import("../staff/staff-dashboard"),
  "doctor-add-service": () => import("../staff/add-service"),
  "doctor-patient-registration": () => import("../clinic/patient-registration"),
  "doctor-patient-information": () => import("../clinic/patient-information"),
  "doctor-eodNotes": () => import("../staff/eodNotes"),
  "doctor-AddPettyCashForm": () => import("../staff/AddPettyCashForm"),
  "doctor-add-vendor": () => import("../staff/add-vendor"),
  "doctor-membership": () => import("../staff/membership"),
  "doctor-contract": () => import("../staff/contract"),
  "doctor-pending-claims": () => import("../staff/pending-claims"),
  "doctor-cancelled-claims": () => import("../staff/cancelled-claims"),
  "doctor-all-claims": () => import("../clinic/all-claims"),
  "doctor-booked-appointments": () => import("../staff/booked-appointments"),
  "doctor-staff-add-treatment": () => import("../staff/add-treatment"),

  // Direct staff routes
  dashboard: () => import("./dashboard"),
  "assigned-leads": () => import("../agent/assigned-leads"),
  "clinic-create-agent": () => import("../clinic/create-agent"),
  "clinic-create-offer": () => import("../clinic/create-offer"),
  "clinic-create-lead": () => import("../clinic/create-lead"),
  permission: () => import("../agent/lead/permission"),
  "create-lead": () => import("../agent/lead-create-lead"),
  "create-offer": () => import("../agent/lead-create-offer"),

  // Inbox
  "clinic-inbox": () => import("../clinic/inbox"),
  "clinic-email-inbox": () => import("../clinic/email-inbox"),
  "clinic-all-templates": () => import("../clinic/all-templates"),
  "clinic-providers": () => import("../clinic/providers"),
  "clinic-referal": () => import("../clinic/referal"),
  "clinic-commission": () => import("../clinic/commission"),
  "clinic-policy_compliance": () => import("../clinic/policy_compliance"),
  "clinic-services_setup": () => import("../clinic/services_setup"),

  // Automation
  "clinic-automation": () => import("../clinic/automation"),

  // Campaigns
  "clinic-campaigns": () => import("../clinic/campaigns"),

  "clinic-consent": () => import("../clinic/consent"),
  "clinic-userpackages": () => import("../clinic/userpackages"),

  // Stocks
  "clinic-stocks-uom": () => import("../clinic/stocks/uom"),
  "clinic-stocks-locations": () => import("../clinic/stocks/locations"),
  "clinic-stocks-suppliers": () => import("../clinic/stocks/suppliers"),
  "clinic-stocks-purchase-requests": () =>
    import("../clinic/stocks/purchase-requests"),
  "clinic-stocks-purchase-orders": () =>
    import("../clinic/stocks/purchase-orders"),
  "clinic-stocks-grn": () => import("../clinic/stocks/grn"),
  "clinic-stocks-purchase-invoices": () =>
    import("../clinic/stocks/purchase-invoices"),
  "clinic-stocks-purchase-returns": () =>
    import("../clinic/stocks/purchase-returns"),
  "clinic-stocks-stock-qty-adjustment": () =>
    import("../clinic/stocks/stock-qty-adjustment"),
  "clinic-stocks-material-consumptions": () =>
    import("../clinic/stocks/material-consumptions"),
  "clinic-stocks-stock-transfer-direct-stock-transfer": () =>
    import("../clinic/stocks/stock-transfer/direct-stock-transfer"),
  "clinic-stocks-stock-transfer-stock-transfer-requests": () =>
    import("../clinic/stocks/stock-transfer/stock-transfer-requests"),
  "clinic-stocks-stock-transfer-transfer-stock": () =>
    import("../clinic/stocks/stock-transfer/transfer-stock"),
  "clinic-stocks-allocated-stock-items": () =>
    import("../clinic/stocks/allocated-stock-items"),
  "clinic-stocks-custom-stock-items": () =>
    import("../clinic/stocks/custom-stock-items"),
  "clinic-pettycash": () => import("../clinic/pettycash"),
  "clinic-pass-claims": () => import("../clinic/pass-claims"),
  "clinic-report": () => import("../clinic/report"),
  "clinic-authentication": () => import("../clinic/authentication"),
  "clinic-release-requested-claims": () =>
    import("../clinic/release-requested-claims"),
  "all-claims": () => import("../clinic/all-claims"),
  "clinic-invoices": () => import("../clinic/invoices"),

  // Finance routes
  "clinic-finance-management": () => import("../clinic/finance-management"),
};

// ---------------------------------------------------------------------------
// Module-level caches (persist across route changes AND remounts — this is
// what makes revisits instant instead of re-triggering the loading screen)
// ---------------------------------------------------------------------------
const componentCache = new Map<string, React.ComponentType<any>>();
const importPromiseCache = new Map<string, Promise<any>>();

const getModulePromise = (slug: string) => {
  let p = importPromiseCache.get(slug);
  if (!p) {
    const loader = routeMap[slug];
    if (!loader) return null;
    p = loader();
    importPromiseCache.set(slug, p);
  }
  return p;
};

/**
 * Call this on link hover / focus (e.g. onMouseEnter in your sidebar) to
 * start fetching the JS chunk before the user even clicks. Combined with
 * the module cache above, this makes the actual navigation feel instant.
 */
export const preloadStaffRoute = (slug: string) => {
  if (!slug || componentCache.has(slug)) return;
  getModulePromise(slug);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const StaffDynamicPage = () => {
  const router = useRouter();
  const { slug: rawSlug } = router.query;
  const slug = typeof rawSlug === "string" ? rawSlug : null;

  const [PageComponent, setPageComponent] =
    useState<React.ComponentType<any> | null>(
      slug ? (componentCache.get(slug) ?? null) : null,
    );
  // Only show a full loading state when nothing is cached yet for this slug.
  const [loading, setLoading] = useState<boolean>(
    !!slug && !componentCache.has(slug),
  );
  const [error, setError] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<{
    agentToken: string | null;
    userRole: string | null;
    userInfo: any;
  }>({ agentToken: null, userRole: null, userInfo: null });

  // Avoid re-decoding the JWT on every navigation — only when the raw token changes.
  const lastDecodedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError(null);
      return;
    }

    // Fail fast: unknown route → don't touch storage / start an import at all.
    if (!routeMap[slug]) {
      setError(`Page not found: /staff/${slug}`);
      setLoading(false);
      setPageComponent(null);
      return;
    }

    // Already cached from a previous visit this session → render instantly,
    // no spinner, no re-fetch, no re-decode.
    const cached = componentCache.get(slug);
    if (cached) {
      setPageComponent(() => cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        // Kick the chunk import off immediately, in parallel with token lookup,
        // instead of waiting for token retrieval to finish first.
        const modulePromise = getModulePromise(slug);
        if (!modulePromise) {
          if (!cancelled) {
            setError(`Page not found: /staff/${slug}`);
            setLoading(false);
          }
          return;
        }

        let agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") ||
              sessionStorage.getItem("agentToken")
            : null;

        if (!agentToken && typeof window !== "undefined") {
          agentToken =
            localStorage.getItem("userToken") ||
            sessionStorage.getItem("userToken");
        }

        if (!agentToken) {
          if (!cancelled) {
            setError("Agent token not found");
            setLoading(false);
          }
          return;
        }

        let userInfo: any = tokenState.userInfo;
        let userRole: string | null = tokenState.userRole;
        if (lastDecodedTokenRef.current !== agentToken) {
          try {
            const decoded: any = jwtDecode(agentToken);
            userInfo = decoded;
            userRole = decoded.role || null;
            lastDecodedTokenRef.current = agentToken;
          } catch (err) {
            console.error("Error decoding token:", err);
          }
        }

        const module = await modulePromise;
        if (cancelled) return;

        const ExportedComponent = module.default;
        componentCache.set(slug, ExportedComponent);

        if (!cancelled) {
          setTokenState({ agentToken, userRole, userInfo });
          setPageComponent(() => ExportedComponent);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading page:", err);
        // Drop the failed promise from cache so a retry is possible.
        importPromiseCache.delete(slug);
        if (!cancelled) {
          setError(`Failed to load page: ${err.message}`);
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const routeInfo = useMemo(() => (slug ? getRouteInfo(slug) : null), [slug]);

  // Stable-identity context value: only clinicToken/doctorToken slot changes
  // based on route type, avoiding needless re-renders in consumers.
  const tokenContext: TokenContextValue = useMemo(() => {
    const clinicToken =
      routeInfo?.type === "clinic" ? tokenState.agentToken : null;
    const doctorToken =
      routeInfo?.type === "doctor" ? tokenState.agentToken : null;
    return {
      agentToken: tokenState.agentToken,
      clinicToken,
      doctorToken,
      userRole: tokenState.userRole,
      userInfo: tokenState.userInfo,
    };
  }, [tokenState, routeInfo]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  // Loading only shows when there is truly nothing cached to display yet —
  // prevents the full-screen flash on already-visited routes.
  if (loading && !PageComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Page not found</div>
      </div>
    );
  }

  return (
    <TokenContext.Provider value={tokenContext}>
      <PageComponent />
    </TokenContext.Provider>
  );
};

StaffDynamicPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <AgentLayout>{page}</AgentLayout>;
};

const ProtectedStaffDynamicPage = withAgentAuth(StaffDynamicPage);
// @ts-ignore - getLayout is added dynamically
ProtectedStaffDynamicPage.getLayout = StaffDynamicPage.getLayout;

export default ProtectedStaffDynamicPage;
