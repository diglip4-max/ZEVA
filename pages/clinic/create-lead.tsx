// pages/clinic/leads.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import type { NextPage } from "next";
import type { ReactNode } from "react";
import axios from "axios";
import type { AxiosResponse } from "axios";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import CreateLeadModal from "../../components/CreateLeadModal";
import LeadViewModal from "../../components/LeadViewModal";
import ImportLeadsModal from "@/components/ImportLeadsModal";
import CustomAsyncSelect from "@/components/shared/CustomAsyncSelect";
import { loadSegmentOptions } from "@/lib/helper";
import { useRouter } from "next/router";
import useSegment from "@/hooks/useSegment";
import { useAgentPermissions } from "@/hooks/useAgentPermissions";
import {
  PlusCircle,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  Calendar,
  Phone,
  Check,
  Mail,
  Pencil,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import EditLeadModal from "@/components/EditLeadModal";

// ============ TYPES ============
interface Treatment {
  _id: string;
  name: string;
}
interface TreatmentItem {
  treatment?: Treatment;
  subTreatment?: string;
}
interface Note {
  text: string;
  addedBy: string;
  createdAt: string;
}
interface AssignedUser {
  user?: { _id: string; name: string };
  assignedAt: string;
}
interface FollowUp {
  date: string;
}

interface Lead {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  gender?: string;
  age?: number;
  treatments?: TreatmentItem[];
  source?: string;
  customSource?: string;
  offerTag?: string;
  status?: string;
  customStatus?: string;
  notes?: Note[];
  assignedTo?: AssignedUser[];
  followUps?: FollowUp[];
  nextFollowUps?: FollowUp[];
  segments?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  _id: string;
  name: string;
}

interface Filters {
  treatment: string;
  offer: string;
  source: string;
  status: string;
  name: string;
  startDate: string;
  endDate: string;
  assignedTo: string;
  quickFilter: string;
}

interface Permissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRead: boolean;
  canAssign: boolean;
}

interface AgentPermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPrint: boolean;
  canExport: boolean;
  canAll: boolean;
}

interface AgentPermissionsResult {
  permissions?: Partial<AgentPermissions>;
  loading?: boolean;
}

interface ModulePermission {
  module?: string;
  actions?: Record<string, unknown>;
}

interface SegmentOption {
  label: string;
  value: string;
}

interface Pagination {
  totalPages: number;
  totalLeads: number;
  currentPage: number;
}

interface StageStyle {
  bg: string;
  text: string;
  dot: string;
  ring: string;
}

interface LeadsApiResponse {
  success: boolean;
  message?: string;
  leads?: Lead[];
  pagination?: { totalPages?: number; totalLeads?: number };
  statusCounts?: Record<string, number>;
}

type RouteContext = "clinic" | "staff";
type ViewMode = "list" | "grid";
type SortOrder = "asc" | "desc";
type TabKey =
  | "all"
  | "new"
  | "engaged"
  | "qualified"
  | "booked"
  | "visited"
  | "followup"
  | "notinterested";

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactNode) => ReactNode;
};

// ============ CONSTANTS ============
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "userToken",
  "adminToken",
] as const;

const NO_PERMISSIONS: Permissions = {
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canRead: false,
  canAssign: false,
};

const FULL_PERMISSIONS: Permissions = {
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canRead: true,
  canAssign: true,
};

const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
  canPrint: false,
  canExport: false,
  canAll: false,
};

const EMPTY_FILTERS: Filters = {
  treatment: "",
  offer: "",
  source: "",
  status: "",
  name: "",
  startDate: "",
  endDate: "",
  assignedTo: "",
  quickFilter: "",
};

const STATUS_TABS: { key: TabKey; label: string; status?: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New", status: "New" },
  { key: "engaged", label: "Engaged", status: "Contacted" },
  { key: "qualified", label: "Qualified", status: "Qualified" },
  { key: "booked", label: "Booked", status: "Booked" },
  { key: "visited", label: "Visited", status: "Visited" },
  { key: "followup", label: "Follow-up", status: "Follow-up" },
  { key: "notinterested", label: "Not Interested", status: "Not Interested" },
];
// ✅ Quick filter chips config
const QUICK_FILTERS: { key: string; label: string }[] = [
  { key: "no_next_action", label: "No next action" },
  { key: "overdue", label: "Overdue" },
  { key: "idle_48h", label: "Idle 48h+" },
  { key: "duplicates", label: "Possible duplicates" },
];

const BOARD_COLUMNS = [
  "New",
  "Contacted",
  "Qualified",
  "Booked",
  "Visited",
  "Follow-up",
  "Not Interested",
] as const;

const STAGE_LABELS: Record<string, string> = {
  Contacted: "Engaged",
};

const STAGE_STYLES: Record<string, StageStyle> = {
  New: {
    bg: "bg-slate-100 dark:bg-slate-500/15",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
    ring: "ring-slate-200 dark:ring-slate-500/20",
  },
  Contacted: {
    bg: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    ring: "ring-sky-200 dark:ring-sky-500/20",
  },
  Engaged: {
    bg: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    ring: "ring-sky-200 dark:ring-sky-500/20",
  },
  Qualified: {
    bg: "bg-teal-50 dark:bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
    ring: "ring-teal-200 dark:ring-teal-500/20",
  },
  Booked: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-500/20",
  },
  Confirmed: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-500/20",
  },
  Visited: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    ring: "ring-violet-200 dark:ring-violet-500/20",
  },
  "Follow-up": {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    ring: "ring-amber-200 dark:ring-amber-500/20",
  },
  "No-show": {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-500/20",
  },
  "Not Interested": {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-500/20",
  },
  Other: {
    bg: "bg-slate-100 dark:bg-slate-500/15",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
    ring: "ring-slate-200 dark:ring-slate-500/20",
  },
};

const SOURCE_DOTS: Record<string, string> = {
  Instagram: "bg-pink-500",
  Facebook: "bg-blue-600",
  Google: "bg-amber-500",
  WhatsApp: "bg-emerald-500",
  "Walk-in": "bg-slate-500",
  Website: "bg-indigo-500",
};

const AVATAR_COLORS = [
  "from-teal-400 to-teal-700",
  "from-indigo-400 to-indigo-700",
  "from-rose-400 to-rose-700",
  "from-amber-400 to-amber-700",
  "from-emerald-400 to-emerald-700",
  "from-violet-400 to-violet-700",
  "from-cyan-400 to-cyan-700",
  "from-pink-400 to-pink-700",
];

// ============ SHARED CLASS TOKENS ============
const CARD =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/20";

const CONTROL =
  "rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-teal-400 dark:focus:ring-teal-400/10";

const BTN_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800";

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-teal-500 to-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-teal-700/25 ring-1 ring-inset ring-white/10 transition-all hover:from-teal-500 hover:to-teal-800 hover:shadow-lg hover:shadow-teal-700/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-teal-900/40";

const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20";

const ICON_BTN_VIEW = `${ICON_BTN} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white`;
const ICON_BTN_ASSIGN = `${ICON_BTN} border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20`;
const ICON_BTN_DELETE = `${ICON_BTN} border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20`;

const PAGE_BTN =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:text-teal-300";

const TH =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

// ============ PURE HELPERS ============
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || fallback;
  }
  return fallback;
};

const isTrue = (v: unknown): boolean =>
  v === true || String(v).toLowerCase() === "true";

const permissionsFromActions = (
  actions: Record<string, unknown> | undefined,
): Permissions => {
  const a = actions || {};
  const all = isTrue(a.all);
  return {
    canCreate: all || isTrue(a.create),
    canRead: all || isTrue(a.read),
    canUpdate: all || isTrue(a.update),
    canDelete: all || isTrue(a.delete),
    canAssign: all || isTrue(a.update),
  };
};

const getInitials = (name?: string): string => {
  if (!name) return "U";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
};

const getAvatarColor = (name?: string): string => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

const formatRelativeDate = (date: string): string => {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const getStatusStyle = (status?: string): StageStyle =>
  STAGE_STYLES[status || "New"] || STAGE_STYLES.Other;

const getStageLabel = (status?: string): string => {
  const s = status || "New";
  return STAGE_LABELS[s] || s;
};

const normalizeStage = (status?: string): string => {
  if (!status) return "New";
  if (status === "Engaged") return "Contacted";
  if (status === "Confirmed") return "Booked";
  if ((BOARD_COLUMNS as readonly string[]).includes(status)) return status;
  return "Other";
};

const getDueInfo = (
  date?: string,
): { label: string; overdue: boolean } | null => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const overdue = d.getTime() < Date.now();
  if (overdue) {
    const days = Math.max(
      1,
      Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return { label: `${days}d overdue`, overdue: true };
  }
  return {
    label: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    overdue: false,
  };
};

const getPageItems = (current: number, total: number): (number | "…")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
};

const getTreatmentName = (lead: Lead): string => {
  const t = lead.treatments?.[0];
  return t?.subTreatment || t?.treatment?.name || "—";
};

// ============ MAIN COMPONENT ============
const LeadsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { segment: segmentId } = router.query as { segment?: string };
  const { segment } = useSegment({ segmentId: segmentId || "" });

  // ============ STATE ============
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeadsCount, setAllLeadsCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showSortMenu, setShowSortMenu] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [viewLead, setViewLead] = useState<Lead | null>(null);

  const [permissions, setPermissions] = useState<Permissions>(NO_PERMISSIONS);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [jumpValue, setJumpValue] = useState<string>("");
  const [pagination, setPagination] = useState<Pagination>({
    totalPages: 1,
    totalLeads: 0,
    currentPage: 1,
  });
  const [selectedSegment, setSelectedSegment] = useState<SegmentOption | null>(
    null,
  );
  const [routeContext, setRouteContext] = useState<RouteContext>("clinic");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [editLead, setEditLead] = useState<Lead | null>(null);

  // ============ AUTH HELPERS ============
  const getUserRole = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    try {
      for (const key of TOKEN_PRIORITY) {
        const t =
          window.localStorage.getItem(key) ||
          window.sessionStorage.getItem(key);
        if (t) {
          try {
            const payload = JSON.parse(atob(t.split(".")[1])) as {
              role?: string;
            };
            return payload.role || null;
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      console.error("Error getting user role:", error);
    }
    return null;
  }, []);

  const getToken = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const role = getUserRole();
    const staffRoute = routeContext === "staff";
    const read = (key: string): string | null =>
      localStorage.getItem(key) || sessionStorage.getItem(key);

    if (role === "agent") {
      const t = read("agentToken");
      if (t) return t;
    }
    if (role === "doctorStaff") {
      const t = read("userToken");
      if (t) return t;
    }
    if (staffRoute) {
      const aT = read("agentToken");
      if (aT) return aT;
      const uT = read("userToken");
      if (uT) return uT;
    }
    for (const key of TOKEN_PRIORITY) {
      const t = read(key);
      if (t) return t;
    }
    return null;
  }, [getUserRole, routeContext]);

  const token = useMemo(() => getToken(), [getToken]);
  const userRole = useMemo(() => getUserRole(), [getUserRole]);
  const isStaffRoute = routeContext === "staff";
  const isAgentOrDoctorStaff =
    userRole === "agent" || userRole === "doctorStaff";

  // ============ AGENT PERMISSIONS HOOK ============
  const agentPermissionsResult = useAgentPermissions(
    isStaffRoute && isAgentOrDoctorStaff ? "clinic_create_lead" : null,
  ) as unknown as AgentPermissionsResult | null | undefined;

  const agentPermissions: Partial<AgentPermissions> =
    agentPermissionsResult?.permissions || DEFAULT_AGENT_PERMISSIONS;
  const agentPermissionsLoading = Boolean(agentPermissionsResult?.loading);

  // ============ EFFECTS ============
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStaff = window.location.pathname?.startsWith("/staff/") ?? false;
    setRouteContext(isStaff ? "staff" : "clinic");
  }, []);

  useEffect(() => {
    if (!isStaffRoute || !isAgentOrDoctorStaff) return;
    if (agentPermissionsLoading) return;
    setPermissions({
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canAssign: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
    });
    setPermissionsLoaded(true);
  }, [
    isStaffRoute,
    isAgentOrDoctorStaff,
    agentPermissions,
    agentPermissionsLoading,
  ]);

  useEffect(() => {
    if (isStaffRoute && isAgentOrDoctorStaff) return;

    const fetchPermissions = async (): Promise<void> => {
      try {
        const authToken = getToken();
        if (!authToken) {
          setPermissions(NO_PERMISSIONS);
          setPermissionsLoaded(true);
          return;
        }
        const currentUserRole = getUserRole();

        if (currentUserRole === "admin") {
          setPermissions(FULL_PERMISSIONS);
          setPermissionsLoaded(true);
          return;
        }

        if (currentUserRole === "clinic" || currentUserRole === "doctor") {
          try {
            const res = await axios.get<{
              success: boolean;
              permissions?: ModulePermission[];
            }>("/api/clinic/sidebar-permissions", {
              headers: { Authorization: `Bearer ${authToken}` },
            });

            if (res.data.success) {
              const perms = res.data.permissions;
              if (!perms || !Array.isArray(perms) || perms.length === 0) {
                setPermissions(FULL_PERMISSIONS);
              } else {
                const modPerm = perms.find((p) => {
                  if (!p?.module) return false;
                  const k = p.module;
                  const n = k.replace(/^(admin|clinic|doctor|agent)_/, "");
                  return (
                    n === "lead" ||
                    n === "create_lead" ||
                    k === "clinic_lead" ||
                    k === "clinic_create_lead" ||
                    k === "create_lead" ||
                    k === "lead"
                  );
                });
                if (modPerm) {
                  setPermissions(permissionsFromActions(modPerm.actions));
                } else {
                  setPermissions({ ...NO_PERMISSIONS, canRead: true });
                }
              }
            } else {
              setPermissions(FULL_PERMISSIONS);
            }
          } catch (err) {
            console.error("Error fetching clinic permissions:", err);
            setPermissions(FULL_PERMISSIONS);
          }
          setPermissionsLoaded(true);
          return;
        }

        if (currentUserRole === "agent" || currentUserRole === "doctorStaff") {
          try {
            const tokenKey =
              currentUserRole === "agent" ? "agentToken" : "userToken";
            const staffToken =
              localStorage.getItem(tokenKey) ||
              sessionStorage.getItem(tokenKey);
            if (!staffToken) {
              setPermissions(NO_PERMISSIONS);
              setPermissionsLoaded(true);
              return;
            }

            type ModuleRes = {
              success?: boolean;
              permissions?: { actions?: Record<string, unknown> };
            };
            let res: AxiosResponse<ModuleRes> | null = null;
            try {
              res = await axios.get<ModuleRes>(
                "/api/agent/get-module-permissions",
                {
                  params: { moduleKey: "clinic_create_lead" },
                  headers: { Authorization: `Bearer ${staffToken}` },
                },
              );
            } catch {
              try {
                res = await axios.get<ModuleRes>(
                  "/api/agent/get-module-permissions",
                  {
                    params: { moduleKey: "clinic_lead" },
                    headers: { Authorization: `Bearer ${staffToken}` },
                  },
                );
              } catch {
                res = null;
              }
            }
            if (res?.data?.success && res.data.permissions) {
              setPermissions(
                permissionsFromActions(res.data.permissions.actions),
              );
            } else {
              setPermissions(NO_PERMISSIONS);
            }
          } catch (err) {
            console.error("Error fetching agent permissions:", err);
            setPermissions(NO_PERMISSIONS);
          }
          setPermissionsLoaded(true);
          return;
        }

        setPermissions(NO_PERMISSIONS);
        setPermissionsLoaded(true);
      } catch (err) {
        console.error("Error fetching permissions:", err);
        setPermissions(NO_PERMISSIONS);
        setPermissionsLoaded(true);
      }
    };

    void fetchPermissions();
  }, [isStaffRoute, isAgentOrDoctorStaff, routeContext, getToken, getUserRole]);

  // ============ DATA FETCHING ============
  const fetchLeads = useCallback(async (): Promise<void> => {
    if (!token || !permissionsLoaded) return;
    if (!permissions.canRead) {
      setLeads([]);
      return;
    }

    setIsLoading(true);
    try {
      const activeTabDef = STATUS_TABS.find((t) => t.key === activeTab);
      const statusParam = activeTabDef?.status || filters.status || "";

      const res = await axios.get<LeadsApiResponse>("/api/lead-ms/leadFilter", {
        params: {
          ...filters,
          status: statusParam,
          page: currentPage,
          limit: pageSize,
          segmentId: selectedSegment?.value,
          sortBy,
          sortOrder,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setLeads(res.data.leads || []);
        setPagination({
          totalPages: res.data.pagination?.totalPages || 1,
          totalLeads: res.data.pagination?.totalLeads || 0,
          currentPage,
        });
        if (res.data.statusCounts) {
          const counts = res.data.statusCounts;
          setStatusCounts(counts);
          setAllLeadsCount(
            Object.values(counts).reduce<number>(
              (sum, v) => sum + Number(v),
              0,
            ),
          );
        }
      } else if (res.data.message?.includes("permission")) {
        setLeads([]);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    permissionsLoaded,
    permissions.canRead,
    filters,
    currentPage,
    pageSize,
    selectedSegment,
    activeTab,
    sortBy,
    sortOrder,
  ]);

  const fetchAgents = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const res = await axios.get<{ success: boolean; agents?: Agent[] }>(
        "/api/lead-ms/getA",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) setAgents(res.data.agents || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  }, [token]);

  useEffect(() => {
    if (segment) {
      setSelectedSegment({
        label: segment?.name || "",
        value: segment?._id || "",
      });
    }
  }, [segment]);

  useEffect(() => {
    if (permissionsLoaded) {
      void fetchLeads();
      void fetchAgents();
    }
  }, [permissionsLoaded, fetchLeads, fetchAgents]);

  // ============ ACTIONS ============
  const closeReassign = (): void => {
    setSelectedLead(null);
    setSelectedAgent("");
    setFollowUpDate("");
  };

  const assignLead = async (): Promise<void> => {
    if (!selectedLead || !selectedAgent) {
      alert("Please select an agent");
      return;
    }
    if (!permissions.canAssign) {
      alert("You do not have permission to assign leads");
      return;
    }
    try {
      await axios.post(
        "/api/lead-ms/reassign-lead",
        {
          leadId: selectedLead,
          agentIds: [selectedAgent],
          followUpDate: followUpDate
            ? new Date(followUpDate).toISOString()
            : null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alert("Lead assigned!");
      closeReassign();
      void fetchLeads();
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err, "Error assigning lead"));
    }
  };

  const deleteLead = async (leadId: string): Promise<void> => {
    if (!permissions.canDelete) {
      alert("You do not have permission to delete leads");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    try {
      await axios.delete("/api/lead-ms/lead-delete", {
        headers: { Authorization: `Bearer ${token}` },
        data: { leadId },
      });
      alert("Lead deleted");
      void fetchLeads();
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err, "Error deleting lead"));
    }
  };

  const exportLeadsToCSV = async (): Promise<void> => {
    if (!token) {
      alert("Auth token missing");
      return;
    }
    try {
      const activeTabDef = STATUS_TABS.find((t) => t.key === activeTab);
      const statusParam = activeTabDef?.status || filters.status || "";

      const params = {
        ...filters,
        status: statusParam,
        segmentId: selectedSegment?.value || "",
        sortBy,
        sortOrder,
      };

      // Build query string
      const qs = new URLSearchParams(
        Object.entries(params).reduce(
          (acc, [k, v]) => {
            if (v !== undefined && v !== null && v !== "") {
              acc[k] = String(v);
            }
            return acc;
          },
          {} as Record<string, string>,
        ),
      ).toString();

      const res = await axios.get(`/api/lead-ms/export-leads?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob", // ✅ Important for CSV download
      });

      // Extract filename from Content-Disposition if present
      const disposition = res.headers["content-disposition"] || "";
      let filename = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) filename = match[1];

      // Trigger download
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export leads. Please try again.");
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = (): void => {
    setFilters(EMPTY_FILTERS);
    setSelectedSegment(null);
    setActiveTab("all");
    setCurrentPage(1);
  };

  const toggleLeadSelection = (id: string): void => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l._id)));
    }
  };

  const goToPage = (page: number): void => {
    const next = Math.min(Math.max(1, page), pagination.totalPages);
    setCurrentPage(next);
    setSelectedLeads(new Set());
  };

  const handleJump = (): void => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isNaN(n)) goToPage(n);
    setJumpValue("");
  };

  const handlePageSizeChange = (size: number): void => {
    setPageSize(size);
    setCurrentPage(1);
    setSelectedLeads(new Set());
  };

  // ============ DERIVED ============
  const activeFiltersCount = useMemo(
    () =>
      Object.values(filters).filter((v) => v !== "").length +
      (selectedSegment ? 1 : 0),
    [filters, selectedSegment],
  );

  const getTabCount = (tab: TabKey): number => {
    if (tab === "all") return allLeadsCount || pagination.totalLeads;
    const def = STATUS_TABS.find((t) => t.key === tab);
    if (!def?.status) return 0;
    return statusCounts[def.status] || 0;
  };

  const boardColumns = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    BOARD_COLUMNS.forEach((c) => {
      groups[c] = [];
    });
    groups.Other = [];
    leads.forEach((lead) => {
      groups[normalizeStage(lead.status)].push(lead);
    });
    const cols: string[] = [...BOARD_COLUMNS];
    if (groups.Other.length > 0) cols.push("Other");
    return {
      groups,
      cols:
        activeTab === "all" ? cols : cols.filter((c) => groups[c].length > 0),
    };
  }, [leads, activeTab]);

  const pageItems = useMemo(
    () => getPageItems(currentPage, pagination.totalPages),
    [currentPage, pagination.totalPages],
  );

  const rangeStart =
    pagination.totalLeads === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, pagination.totalLeads);

  const reassignTarget = useMemo(
    () => leads.find((l) => l._id === selectedLead) || null,
    [leads, selectedLead],
  );

  // ============ SHARED RENDER PIECES ============
  const renderAvatar = (name: string | undefined, size: "sm" | "md" | "lg") => {
    const dims =
      size === "lg"
        ? "h-11 w-11 text-xs"
        : size === "md"
          ? "h-9 w-9 text-[11px]"
          : "h-6 w-6 text-[9px]";
    return (
      <div
        className={`${dims} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(name)} font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900`}
      >
        {getInitials(name)}
      </div>
    );
  };

  const renderStageBadge = (status?: string) => {
    const s = getStatusStyle(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {getStageLabel(status)}
      </span>
    );
  };

  const renderDue = (date?: string) => {
    const due = getDueInfo(date);
    if (!due)
      return (
        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
      );
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
          due.overdue
            ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20"
            : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
        }`}
      >
        <Calendar className="h-3 w-3" />
        {due.label}
      </span>
    );
  };

  const renderActions = (lead: Lead) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setViewLead(lead)}
        className={ICON_BTN_VIEW}
        title="View lead"
        aria-label={`View ${lead.name}`}
      >
        <Eye className="h-4 w-4" />
      </button>
      {permissions.canUpdate && (
        <button
          type="button"
          onClick={() => setEditLead(lead)}
          className={`${ICON_BTN} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20`}
          title="Edit lead"
          aria-label={`Edit ${lead.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {permissions.canAssign && (
        <button
          type="button"
          onClick={() => setSelectedLead(lead._id)}
          className={ICON_BTN_ASSIGN}
          title="Reassign lead"
          aria-label={`Reassign ${lead.name}`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
      {permissions.canDelete && (
        <button
          type="button"
          onClick={() => void deleteLead(lead._id)}
          className={ICON_BTN_DELETE}
          title="Delete lead"
          aria-label={`Delete ${lead.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // ============ NO READ PERMISSION ============
  if (permissionsLoaded && !permissions.canRead) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className={`${CARD} p-6`}>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Leads
            </h1>
          </div>
          <div className={`${CARD} p-12 text-center`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/20">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              Read permission required
            </h3>
            <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
              You only have permission to create leads. Contact your
              administrator to request read access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statCards: {
    label: string;
    value: number;
    icon: ReactNode;
    tone: string;
  }[] = [
    {
      label: "Total leads",
      value: allLeadsCount || pagination.totalLeads,
      icon: <Users className="h-4 w-4" />,
      tone: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20",
    },
    {
      label: "New",
      value: statusCounts["New"] || 0,
      icon: <Sparkles className="h-4 w-4" />,
      tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
    },
    {
      label: "Booked",
      value: statusCounts["Booked"] || 0,
      icon: <Calendar className="h-4 w-4" />,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    },
    {
      label: "Visited",
      value: statusCounts["Visited"] || 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
    },
  ];

  const viewOptions: { mode: ViewMode; label: string; icon: ReactNode }[] = [
    { mode: "list", label: "Table", icon: <List className="h-3.5 w-3.5" /> },
    {
      mode: "grid",
      label: "Grid",
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
    },
  ];

  // ============ MAIN RENDER ============
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-teal-100/60 via-transparent to-transparent dark:from-teal-500/10" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10" />

      <div className="relative mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        {/* ============ PAGE HEADER ============ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {allLeadsCount || pagination.totalLeads} open
              </span>
              <span>
                {statusCounts["New"] || 0} without an owner or next step
              </span>
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Leads
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {viewOptions.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setViewMode(opt.mode)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === opt.mode
                      ? "bg-teal-50 text-teal-700 shadow-sm ring-1 ring-inset ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={exportLeadsToCSV}
              className={BTN_SECONDARY}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>

            {permissions.canCreate && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className={BTN_SECONDARY}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import
              </button>
            )}

            {permissions.canCreate && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className={BTN_PRIMARY}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                New lead
              </button>
            )}
          </div>
        </div>

        {/* ============ STAT CARDS ============ */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={`${CARD} flex items-center gap-3 p-4`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${s.tone}`}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums leading-none text-slate-900 dark:text-white">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ============ STATUS TABS ============ */}
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_TABS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-600/25 dark:border-teal-500 dark:bg-teal-500 dark:text-white dark:shadow-teal-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:text-teal-300"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ============ SEARCH & FILTER BAR ============ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search name, phone, service, source"
              value={filters.name}
              onChange={(e) => handleFilterChange("name", e.target.value)}
              className={`${CONTROL} w-full py-2.5 pl-10 pr-3 text-sm`}
            />
          </div>

          {/* ✅ Agent / Owner filter */}
          <select
            value={filters.assignedTo}
            onChange={(e) => handleFilterChange("assignedTo", e.target.value)}
            className={`${CONTROL} cursor-pointer px-3 py-2.5 text-xs font-semibold`}
          >
            <option value="">Any owner</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* ✅ Quick filter chips — clickable toggles */}
          {QUICK_FILTERS.map((qf) => {
            const isActive = filters.quickFilter === qf.key;
            return (
              <button
                key={qf.key}
                type="button"
                onClick={() =>
                  handleFilterChange("quickFilter", isActive ? "" : qf.key)
                }
                className={
                  isActive
                    ? "inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-700 shadow-sm dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-300"
                    : BTN_SECONDARY
                }
              >
                {qf.label}
              </button>
            );
          })}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition-all ${
              showFilters || activeFiltersCount > 0
                ? "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-300"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={BTN_SECONDARY}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
                  {[
                    { key: "createdAt", label: "Date created" },
                    { key: "name", label: "Name" },
                    { key: "status", label: "Status" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        if (sortBy === opt.key) {
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy(opt.key);
                          setSortOrder("desc");
                        }
                        setShowSortMenu(false);
                      }}
                      className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        sortBy === opt.key
                          ? "font-semibold text-teal-700 dark:text-teal-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                      {sortBy === opt.key && (
                        <span className="text-[11px] text-slate-400">
                          {sortOrder === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ============ ADVANCED FILTERS ============ */}
        {showFilters && (
          <div className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Advanced filters
              </h3>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                placeholder="Offer tag"
                value={filters.offer}
                onChange={(e) => handleFilterChange("offer", e.target.value)}
                className={`${CONTROL} px-3 py-2.5 text-xs`}
              />
              <select
                value={filters.source}
                onChange={(e) => handleFilterChange("source", e.target.value)}
                className={`${CONTROL} cursor-pointer px-3 py-2.5 text-xs`}
              >
                <option value="">All sources</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>Google</option>
                <option>WhatsApp</option>
                <option>Walk-in</option>
                <option>Website</option>
                <option>Other</option>
              </select>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className={`${CONTROL} px-3 py-2.5 text-xs dark:[color-scheme:dark]`}
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className={`${CONTROL} px-3 py-2.5 text-xs dark:[color-scheme:dark]`}
              />
              <div className="sm:col-span-2">
                <CustomAsyncSelect
                  label=""
                  name="chooseSegment"
                  loadOptions={(inputValue: string) =>
                    loadSegmentOptions(inputValue, token || "")
                  }
                  value={selectedSegment}
                  // @ts-ignore
                  onChange={(value: SegmentOption | null) =>
                    setSelectedSegment(value)
                  }
                  placeholder="Select a segment..."
                />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    void fetchLeads();
                  }}
                  className={BTN_PRIMARY}
                >
                  <Search className="h-3.5 w-3.5" />
                  Apply filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ BULK ACTIONS ============ */}
        {selectedLeads.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-500/30 dark:bg-teal-500/10">
            <p className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-200">
              <Check className="h-4 w-4" />
              {selectedLeads.size} lead{selectedLeads.size > 1 ? "s" : ""}{" "}
              selected
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
              >
                Assign
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedLeads(new Set())}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ============ CONTENT ============ */}
        {isLoading ? (
          <div className={`${CARD} overflow-hidden`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800"
              >
                <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className={`${CARD} p-16 text-center`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:ring-teal-500/20">
              <Users className="h-8 w-8 text-teal-600 dark:text-teal-300" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
              No leads found
            </h3>
            <p className="mx-auto mb-5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Try changing your filters, or add your first lead.
            </p>
            {permissions.canCreate && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className={BTN_PRIMARY}
              >
                <PlusCircle className="h-4 w-4" />
                Create lead
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          /* ============ TABLE VIEW ============ */
          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selectedLeads.size === leads.length &&
                          leads.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600 dark:border-slate-600"
                      />
                    </th>
                    <th className={TH}>Lead</th>
                    <th className={TH}>Stage</th>
                    <th className={TH}>Service</th>
                    <th className={TH}>Source</th>
                    <th className={TH}>Owner</th>
                    <th className={TH}>Next action</th>
                    <th className={TH}>Due</th>
                    <th className={TH}>Last activity</th>
                    <th
                      className={`${TH} sticky right-0 z-10 bg-slate-50 text-right shadow-[-10px_0_12px_-10px_rgba(15,23,42,0.15)] dark:bg-slate-900`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const owner = lead.assignedTo?.[0]?.user?.name;
                    const nextFollowUp = lead.followUps?.[0]?.date;
                    const isSelected = selectedLeads.has(lead._id);
                    const rowBg = isSelected
                      ? "bg-teal-50 dark:bg-teal-950"
                      : "bg-white dark:bg-slate-900";

                    return (
                      <tr
                        key={lead._id}
                        className={`group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800/80 dark:hover:bg-slate-800/40 ${
                          isSelected ? "bg-teal-50/60 dark:bg-teal-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLeadSelection(lead._id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600 dark:border-slate-600"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {renderAvatar(lead.name, "md")}
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="block max-w-[200px] truncate text-left text-sm font-semibold text-slate-900 transition-colors hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-300"
                                onClick={() => setViewLead(lead)}
                              >
                                {lead.name}
                              </button>
                              <div className="flex items-center gap-2">
                                <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone || "—"}
                                </p>

                                {/* Whatsapp Icon */}
                                {lead.phone && (
                                  <p
                                    onClick={() => {
                                      if (
                                        router.pathname?.includes("/clinic/")
                                      ) {
                                        router.push(
                                          `/clinic/inbox?leadId=${lead._id}`,
                                        );
                                      } else if (
                                        router.pathname?.includes("/staff/")
                                      ) {
                                        router.push(
                                          `/staff/clinic_inbox?leadId=${lead._id}`,
                                        );
                                      }
                                    }}
                                    className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400 cursor-pointer"
                                  >
                                    <FaWhatsapp className="h-3.5 w-3.5 text-green-600 dark:text-green-300" />
                                  </p>
                                )}

                                {/* Email Icon */}
                                {lead.email && (
                                  <p
                                    onClick={() => {
                                      if (
                                        router.pathname?.includes("/clinic/")
                                      ) {
                                        router.push(
                                          `/clinic/email-inbox?leadId=${lead._id}`,
                                        );
                                      } else if (
                                        router.pathname?.includes("/staff/")
                                      ) {
                                        router.push(
                                          `/staff/clinic_email_inbox?leadId=${lead._id}`,
                                        );
                                      }
                                    }}
                                    className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400 cursor-pointer"
                                  >
                                    <Mail className="h-3.5 w-3.5 text-red-600 dark:text-gred300" />
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {renderStageBadge(lead.status)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-[180px] truncate text-sm text-slate-700 dark:text-slate-300">
                            {getTreatmentName(lead)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${SOURCE_DOTS[lead.source || ""] || "bg-slate-400"}`}
                            />
                            <span className="max-w-[140px] truncate text-sm text-slate-700 dark:text-slate-300">
                              {lead.source || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {owner ? (
                            <div className="flex items-center gap-2">
                              {renderAvatar(owner, "sm")}
                              <span className="max-w-[110px] truncate text-sm text-slate-700 dark:text-slate-300">
                                {owner}
                              </span>
                            </div>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs italic text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p
                            className={`max-w-[180px] truncate text-sm ${
                              nextFollowUp
                                ? "text-slate-700 dark:text-slate-300"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {nextFollowUp ? "Follow up" : "No next action"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          {renderDue(nextFollowUp)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatRelativeDate(lead.createdAt)}
                          </span>
                        </td>
                        <td
                          className={`sticky right-0 z-[5] px-4 py-3.5 shadow-[-10px_0_12px_-10px_rgba(15,23,42,0.15)] transition-colors group-hover:bg-slate-50 dark:group-hover:bg-slate-800 ${rowBg}`}
                        >
                          {renderActions(lead)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ============ GRID VIEW (Fixed Kanban) ============ */
          <div className="-mx-1 overflow-x-auto px-1 pb-6">
            <div className="flex min-h-[500px] items-start gap-4">
              {boardColumns.cols.map((col) => {
                const colLeads = boardColumns.groups[col] || [];
                const s = getStatusStyle(col);
                return (
                  <div
                    key={col}
                    className="flex h-[calc(100vh-320px)] min-h-[500px] w-[340px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-slate-100/60 shadow-sm dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900/30"
                  >
                    {/* Column header (sticky) */}
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/60 px-4 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg} ring-1 ring-inset ${s.ring}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {getStageLabel(col)}
                          </h3>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {colLeads.length}{" "}
                            {colLeads.length === 1 ? "lead" : "leads"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label={`Add lead to ${col}`}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Scrollable card list */}
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
                      {colLeads.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 py-10 text-center dark:border-slate-700 dark:bg-slate-900/30">
                          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <Users className="h-4 w-4 text-slate-400" />
                          </div>
                          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            No leads here
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-600">
                            Drop a lead to get started
                          </p>
                        </div>
                      )}

                      {colLeads.map((lead) => {
                        const owner = lead.assignedTo?.[0]?.user?.name;
                        const nextFollowUp = lead.followUps?.[0]?.date;
                        const due = getDueInfo(nextFollowUp);
                        const isSelected = selectedLeads.has(lead._id);

                        return (
                          <div
                            key={lead._id}
                            className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-900/5 dark:bg-slate-900 dark:hover:border-teal-500/40 ${
                              isSelected
                                ? "border-teal-400 ring-2 ring-teal-400/20 dark:border-teal-500"
                                : "border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            {/* Left accent bar */}
                            <div
                              className={`absolute inset-y-0 left-0 w-1 ${s.dot}`}
                            />

                            <div className="space-y-3 p-3.5 pl-4">
                              {/* Header: avatar + name + checkbox */}
                              <div className="flex items-start gap-2.5">
                                {renderAvatar(lead.name, "md")}
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => setViewLead(lead)}
                                    className="block w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-300"
                                  >
                                    {lead.name}
                                  </button>
                                  <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                    <Phone className="h-3 w-3 flex-shrink-0" />
                                    {lead.phone || "No phone"}
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleLeadSelection(lead._id)}
                                  className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-teal-600 opacity-0 transition-opacity checked:opacity-100 group-hover:opacity-100 dark:border-slate-600"
                                />
                              </div>

                              {/* Treatment + source chips */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  <Sparkles className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {getTreatmentName(lead)}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  <span
                                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                                      SOURCE_DOTS[lead.source || ""] ||
                                      "bg-slate-400"
                                    }`}
                                  />
                                  <span className="truncate">
                                    {lead.source || "No source"}
                                  </span>
                                </span>
                              </div>

                              {/* Due date chip */}
                              {due && (
                                <div
                                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                                    due.overdue
                                      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20"
                                      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20"
                                  }`}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {due.label}
                                </div>
                              )}
                            </div>

                            {/* Footer: owner + actions */}
                            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5 pl-4 dark:border-slate-800 dark:bg-slate-800/30">
                              <div className="flex items-center gap-2">
                                {owner ? (
                                  <>
                                    {renderAvatar(owner, "sm")}
                                    <span className="max-w-[100px] truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                      {owner}
                                    </span>
                                  </>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium italic text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                    Unassigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                {renderActions(lead)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ PAGINATION ============ */}
        {permissions.canRead && leads.length > 0 && (
          <div
            className={`${CARD} flex flex-col items-center justify-between gap-4 px-4 py-3 lg:flex-row`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {pagination.totalLeads}
                </span>{" "}
                leads
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className={`${CONTROL} cursor-pointer px-2 py-1.5 text-xs font-semibold`}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                aria-label="First page"
                className={PAGE_BTN}
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className={PAGE_BTN}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageItems.map((item, idx) =>
                item === "…" ? (
                  <span
                    key={`gap-${idx}`}
                    className="flex h-8 w-6 items-center justify-center text-xs text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => goToPage(item)}
                    aria-current={currentPage === item ? "page" : undefined}
                    className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold tabular-nums transition-all ${
                      currentPage === item
                        ? "bg-teal-600 text-white shadow-md shadow-teal-600/25 dark:bg-teal-500"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:text-teal-300"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
                aria-label="Next page"
                className={PAGE_BTN}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToPage(pagination.totalPages)}
                disabled={currentPage === pagination.totalPages}
                aria-label="Last page"
                className={PAGE_BTN}
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Go to page
              <input
                type="number"
                min={1}
                max={pagination.totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJump();
                }}
                placeholder={`${currentPage}`}
                className={`${CONTROL} w-16 px-2 py-1.5 text-center text-xs`}
              />
              <button
                type="button"
                onClick={handleJump}
                className={BTN_SECONDARY}
              >
                Go
              </button>
            </div>
          </div>
        )}

        {/* ============ MODALS ============ */}
        <CreateLeadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            void fetchLeads();
            setModalOpen(false);
          }}
          token={token || ""}
          canCreate={permissions.canCreate}
        />
        {editLead && (
          <EditLeadModal
            isOpen={!!editLead}
            onClose={() => setEditLead(null)}
            onUpdated={() => {
              void fetchLeads();
              setEditLead(null);
            }}
            token={token || ""}
            lead={editLead}
            canUpdate={permissions.canUpdate}
          />
        )}
        <ImportLeadsModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={() => {
            void fetchLeads();
            setImportModalOpen(false);
          }}
          token={token || ""}
        />

        {/* Reassign Modal */}
        {selectedLead && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
            onClick={closeReassign}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500" />
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-700/30">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Reassign lead
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {reassignTarget
                        ? reassignTarget.name
                        : "Choose an agent and follow-up"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeReassign}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Agent <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className={`${CONTROL} w-full cursor-pointer px-3 py-2.5 text-sm`}
                  >
                    <option value="" disabled>
                      Choose an agent...
                    </option>
                    {agents.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {selectedAgent && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {agents.find((a) => a._id === selectedAgent)?.name}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Follow-up date{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className={`${CONTROL} w-full px-3 py-2.5 text-sm dark:[color-scheme:dark]`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={closeReassign}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void assignLead()}
                  disabled={!selectedAgent}
                  className={BTN_PRIMARY}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Reassign
                </button>
              </div>
            </div>
          </div>
        )}

        {viewLead && (
          <LeadViewModal lead={viewLead} onClose={() => setViewLead(null)} />
        )}
      </div>
    </div>
  );
};

// ============ LAYOUT ============
LeadsPage.getLayout = function PageLayout(page: ReactNode) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

export const CreateLeadPageBase = LeadsPage;

const ProtectedLeadsPage = withClinicAuth(LeadsPage) as NextPageWithLayout;
ProtectedLeadsPage.getLayout = LeadsPage.getLayout;

export default ProtectedLeadsPage;
