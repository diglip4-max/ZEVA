import React, { useState, useEffect, useRef, useMemo } from "react";
import useNotificationSetting from "../_hooks/useNotificationSetting";
import { notificationData as notifData } from "../../../../lib/notifications/index";
import { CheckCircle2, ChevronLeft, Clock, XCircle } from "lucide-react";
import {
  MessageCircle,
  MessageSquare,
  Mail,
  Bell,
  Lock,
  Search,
  Pause,
  Play,
  Check,
  CreditCard,
  Calendar,
  Package,
  Activity,
  Heart,
  Gift,
  Star,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import NotificationEditDrawer from "./NotificationEditDrawer";
import { Attachment } from "@/types/campaigns";

export type ChannelId = "whatsapp" | "sms" | "email" | "app_push";
export type TimingMode = "immediate" | "before_event" | "after_event";
export type Recipient = "patient" | "staff";

interface Channel {
  channel: ChannelId;
  isEnabled: boolean;
  recipient: Recipient;
  priority: number;
  attachments?: Attachment[];
  mediaUrl?: string;
  mediaType?: string;
  variableMappings?: Record<string, string>;
  headerVariableMappings?: Record<string, string>;
  buttonVariableMappings?: Record<string, string>;
}

export interface Notification {
  id: string;
  category: string;
  label: string;
  isProtected: boolean;
  isEnabled: boolean;
  trigger: string;
  timingMode: TimingMode;
  offsetMinutes: number;
  bypassQuietHours: boolean;
  preventDuplicate: boolean;
  respectMarketing: boolean;
  template: string;
  sample: Record<string, string>;
  channels: Channel[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
}

const CATEGORIES: Category[] = [
  {
    id: "payment",
    name: "Payment & Billing",
    color: "#E8C88A",
    icon: CreditCard,
  },
  { id: "appointment", name: "Appointments", color: "#7EB6E0", icon: Calendar },
  {
    id: "package",
    name: "Packages & Memberships",
    color: "#B79CE0",
    icon: Package,
  },
  {
    id: "followup",
    name: "Follow-Up & Treatment",
    color: "#6FCF97",
    icon: Activity,
  },
  {
    id: "engagement",
    name: "Patient Engagement",
    color: "#F0949C",
    icon: Heart,
  },
  { id: "offer", name: "Offers & Referrals", color: "#F0A868", icon: Gift },
  { id: "feedback", name: "Feedback", color: "#7ED9D2", icon: Star },
  { id: "security", name: "Security", color: "#E88787", icon: ShieldCheck },
];

export const CH_META: Record<
  ChannelId,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  app_push: { label: "App Push", icon: Bell },
};
const CHANNEL_COLORS: Record<ChannelId, string> = {
  whatsapp: "#5FD98C",
  sms: "#6FA8E0",
  email: "#C39FEF",
  app_push: "#F0A868",
};

export const catMeta = (id: string): Category => {
  return (
    CATEGORIES.find((c) => c.id === id) || {
      id,
      name: id,
      color: "#888",
      icon: Package,
    }
  );
};

export function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function Toggle({
  on,
  onClick,
  size = "md",
}: {
  on: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? 38 : 44;
  const h = size === "sm" ? 22 : 24;
  const knob = size === "sm" ? 18 : 20;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="relative flex-shrink-0 rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      style={{
        width: w,
        height: h,
        background: on ? "#F59E0B" : "var(--surface-3)",
        border: `1px solid ${on ? "#F59E0B" : "var(--border)"}`,
      }}
    >
      <span
        className="absolute top-0.5 rounded-full transition-all duration-200 shadow-md !bg-white"
        style={{
          width: knob,
          height: knob,
          left: on ? w - knob - 3 : 2,
          backgroundColor: "#ffffff",
        }}
      />
    </button>
  );
}

// function ChannelPill({
//   channel,
//   enabled,
// }: {
//   channel: ChannelId;
//   enabled: boolean;
// }) {
//   const meta = CH_META[channel];
//   const Icon = meta.icon;
//   return (
//     <span
//       title={`${meta.label} — ${enabled ? "on" : "off"}`}
//       className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all"
//       style={{
//         background: enabled ? "var(--surface-3)" : "var(--surface-2)",
//         borderColor: enabled ? "var(--border)" : "var(--border-soft)",
//         color: enabled ? "var(--text-hi)" : "var(--text-lo)",
//         opacity: enabled ? 1 : 0.4,
//       }}
//     >
//       <Icon size={14} />
//     </span>
//   );
// }

function ChannelPill({
  channel,
  enabled,
  size = "md",
}: {
  channel: ChannelId;
  enabled: boolean;
  size?: "sm" | "md";
}) {
  const meta = CH_META[channel];
  const Icon = meta.icon;
  const color = CHANNEL_COLORS[channel];
  const dim = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  return (
    <span
      title={`${meta.label} — ${enabled ? "on" : "off"}`}
      className={`${dim} rounded-lg flex items-center justify-center flex-shrink-0 border transition-all`}
      style={
        enabled
          ? {
              background: `${color}1f`,
              borderColor: `${color}45`,
              color: color,
            }
          : {
              background: "var(--surface-2)",
              borderColor: "var(--border-soft)",
              color: "var(--text-lo)",
              opacity: 0.4,
            }
      }
    >
      <Icon size={12} />
    </span>
  );
}

function Badge({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "default";
}) {
  const colors =
    tone === "danger"
      ? {
          c: "var(--danger)",
          bg: "var(--danger-bg)",
          b: "var(--danger-border)",
        }
      : { c: "var(--text-lo)", bg: "var(--surface-3)", b: "var(--border)" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: colors.c,
        background: colors.bg,
        border: `1px solid ${colors.b}`,
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "default",
  icon: Icon,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? {
          background: "#F59E0B",
          color: "#ffffff",
          border: "1px solid #F59E0B",
        }
      : variant === "danger"
        ? {
            background: "var(--danger)",
            color: "#ffffff",
            border: "1px solid var(--danger)",
          }
        : {
            background: "var(--surface-3)",
            color: "var(--text-hi)",
            border: "1px solid var(--border)",
          };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 hover:opacity-95 active:scale-[0.98] shadow-sm cursor-pointer ${className}`}
      style={styles}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

// function NotifCard({
//   n,
//   onToggle,
//   onEdit,
// }: {
//   n: Notification;
//   onToggle: (id: string) => void;
//   onEdit: (id: string) => void;
// }) {
//   const cat = catMeta(n.category);
//   const CatIcon = cat.icon;
//   return (
//     <div
//       className="group rounded-2xl p-4 sm:p-4.5 flex flex-col gap-4 h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl bg-surface border border-border hover:border-primary/60"
//       onClick={() => onEdit(n.id)}
//       style={{ opacity: n.isEnabled ? 1 : 0.6 }}
//     >
//       <div className="flex items-start gap-3.5">
//         <span
//           className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-2 border border-border shadow-2xs"
//           style={{ color: cat.color }}
//         >
//           <CatIcon size={18} />
//         </span>
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-2 flex-wrap">
//             <span className="text-base font-bold text-text-hi leading-snug">
//               {n.label}
//             </span>
//             {n.isProtected && (
//               <Badge tone="danger">
//                 <Lock size={9} /> Protected
//               </Badge>
//             )}
//           </div>
//           <div className="text-xs font-medium mt-1 text-text-lo">
//             {n.timingMode === "immediate"
//               ? "Immediately"
//               : `${n.offsetMinutes}m ${n.timingMode === "before_event" ? "before" : "after"}`}
//             {" · "}
//             {n.channels.some((c) => c.recipient === "staff")
//               ? "To staff"
//               : "To patient"}
//           </div>
//         </div>
//         <div onClick={(e) => e.stopPropagation()}>
//           <Toggle on={n.isEnabled} onClick={() => onToggle(n.id)} />
//         </div>
//       </div>
//       <div className="flex items-center gap-2 flex-wrap">
//         {n.channels.map((ch) => (
//           <ChannelPill
//             key={ch.channel}
//             channel={ch.channel}
//             enabled={ch.isEnabled}
//           />
//         ))}
//       </div>
//       <div className="mt-auto flex items-center gap-1.5 text-xs font-bold pt-2 text-primary group-hover:gap-2.5 transition-all duration-200">
//         Configure{" "}
//         <ChevronRight
//           size={14}
//           className="transition-transform group-hover:translate-x-1"
//         />
//       </div>
//     </div>
//   );
// }

function NotifCard({
  n,
  onToggle,
  onEdit,
}: {
  n: Notification;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const cat = catMeta(n.category);
  const CatIcon = cat.icon;

  const status = n.isProtected
    ? {
        label: "Protected",
        icon: Lock,
        color: "var(--danger)",
        bg: "var(--danger-bg)",
        border: "var(--danger-border)",
      }
    : n.isEnabled
      ? {
          label: "On",
          icon: CheckCircle2,
          color: "var(--ok)",
          bg: "var(--ok-bg, rgba(16,185,129,0.12))",
          border: "var(--ok-border, rgba(16,185,129,0.26))",
        }
      : {
          label: "Off",
          icon: XCircle,
          color: "var(--text-lo)",
          bg: "var(--surface-3)",
          border: "var(--border)",
        };
  const StatusIcon = status.icon;

  return (
    <div
      className="group relative rounded-2xl border overflow-hidden transition-colors cursor-pointer hover:border-primary/50"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        opacity: n.isEnabled ? 1 : 0.65,
      }}
      onClick={() => onEdit(n.id)}
    >
      {/* Category-colored accent — parent's overflow-hidden + rounded-xl
        clips this into the exact same corner curve as the card, so no
        mismatched radius/seam. */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: cat.color, opacity: 0.85 }}
      />
      <div className="flex items-center gap-3.5 pl-5 pr-3.5 py-3.5">
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border"
          style={{
            background: `${cat.color}17`,
            borderColor: `${cat.color}35`,
            color: cat.color,
          }}
        >
          <CatIcon size={17} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-text-hi truncate">
              {n.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-text-lo">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: cat.color }}
              />
              {cat.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-xs text-text-lo truncate flex-wrap">
            <Clock size={11} className="flex-shrink-0" />
            <span className="truncate">
              {n.timingMode === "immediate"
                ? "Immediately"
                : `${n.offsetMinutes}m ${n.timingMode === "before_event" ? "before" : "after"}`}
            </span>
            <span className="opacity-50">·</span>
            <span className="truncate">
              {n.channels.some((c) => c.recipient === "staff")
                ? "To staff"
                : "To patient"}
            </span>
            {n.channels.length > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  {n.channels.map((ch) => (
                    <ChannelPill
                      key={ch.channel}
                      channel={ch.channel}
                      enabled={ch.isEnabled}
                    />
                  ))}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: status.color,
              background: status.bg,
              border: `1px solid ${status.border}`,
            }}
          >
            <StatusIcon size={11} />
            {status.label}
          </span>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            <Toggle on={n.isEnabled} onClick={() => onToggle(n.id)} size="sm" />
          </div>
        </div>

        <ChevronRight
          size={15}
          className="text-text-lo flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </div>
    </div>
  );
}

export default function NotificationSettingsTab() {
  const {
    settings,
    analytics,
    meta,
    loading,
    saving,
    error,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    page,
    pagination,
    nextPage,
    prevPage,
    goToPage,
    toggleNotification,
    saveNotification,
    setPaused,
    refetch,
  } = useNotificationSetting();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep tab and categoryFilter in sync
  useEffect(() => {
    setCategoryFilter(activeTab as any);
  }, [activeTab, setCategoryFilter]);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const openEdit = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setEditingId(id);
    setDrawerOpen(true);
  };
  const closeEdit = () => {
    setDrawerOpen(false);
    closeTimer.current = setTimeout(() => setEditingId(null), 340);
  };

  // Map API NotificationSetting to internal Notification shape for EditDrawer
  const toNotif = (
    s: ReturnType<typeof useNotificationSetting>["settings"][0],
  ): Notification => ({
    id: s.notificationTypeKey,
    category: s.category,
    label: s.label,
    isProtected: s.isProtected,
    isEnabled: s.isEnabled,
    trigger: s.trigger?.event || "",
    timingMode: s.timing?.mode as TimingMode,
    offsetMinutes: s.timing?.offsetMinutes ?? 0,
    bypassQuietHours: s.bypassQuietHours,
    preventDuplicate: s.preventDuplicateForSameEvent,
    respectMarketing: s.respectMarketingPreference,
    template:
      notifData.find((n) => n.notificationTypeKey === s.notificationTypeKey)
        ?.template || "",
    sample:
      notifData.find((n) => n.notificationTypeKey === s.notificationTypeKey)
        ?.sample || ({} as any),
    channels: s.channels.map((ch) => ({
      channel: ch.channel as ChannelId,
      isEnabled: ch.isEnabled,
      recipient: ch.recipient as Recipient,
      priority: ch.priority,
      templateId: ch.templateId,
      providerId: ch.providerId,
      attachments: ch.attachments || [],
      mediaUrl: ch.mediaUrl || "",
      mediaType: ch.mediaType || "",
      variableMappings: ch.variableMappings,
      headerVariableMappings: ch.headerVariableMappings,
      buttonVariableMappings: ch.buttonVariableMappings,
    })),
  });

  const toggleNotif = async (id: string) => {
    const s = settings.find((x) => x.notificationTypeKey === id);
    if (!s) return;
    if (s.isEnabled && s.isProtected) {
      openEdit(id);
      return;
    }
    const result = await toggleNotification(id, !s.isEnabled);
    if (result.ok) {
      showToast(s.isEnabled ? `${s.label} turned off` : `${s.label} turned on`);
    } else {
      showToast(`Failed: ${result.warning}`);
    }
  };

  const saveEdit = async (draft: Notification) => {
    const result = await saveNotification(draft.id, {
      isEnabled: draft.isEnabled,
      isProtected: draft.isProtected,
      bypassQuietHours: draft.bypassQuietHours,
      preventDuplicateForSameEvent: draft.preventDuplicate,
      respectMarketingPreference: draft.respectMarketing,
      timing: { mode: draft.timingMode, offsetMinutes: draft.offsetMinutes },
      channels: draft.channels,
    } as any);
    closeEdit();
    if (result.ok) {
      showToast(`${draft.label} saved`);
    } else {
      showToast(`Failed: ${result.warning}`);
    }
  };

  const handlePause = async () => {
    const newPaused = !meta.isPaused;
    const result = await setPaused(newPaused);
    if (result.ok) {
      showToast(
        newPaused ? "All notifications paused" : "Notifications resumed",
      );
    }
  };

  const counts: Record<string, number> = {};
  (analytics.byCategory || {}) &&
    Object.entries(analytics.byCategory || {}).forEach(([cat, v]) => {
      counts[cat] = v.total;
    });

  const editingNotif = editingId
    ? (() => {
        const s = settings.find((x) => x.notificationTypeKey === editingId);
        return s ? toNotif(s) : null;
      })()
    : null;

  // Pagination page buttons
  const totalPages = pagination?.totalPages ?? 1;
  const pageRange = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    for (
      let i = Math.max(1, page - delta);
      i <= Math.min(totalPages, page + delta);
      i++
    ) {
      range.push(i);
    }
    return range;
  }, [page, totalPages]);

  return (
    <div className="min-h-full font-body text-text-hi relative overflow-hidden">
      <style>{`
        .font-body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-mono { font-family: 'IBM Plex Mono', 'SF Mono', monospace; }

        :root {
          --bg: #f8fafc;
          --surface: #ffffff;
          --surface-2: #f1f5f9;
          --surface-3: #e2e8f0;
          --surface-4: #cbd5e1;
          --border: #e2e8f0;
          --border-soft: #f1f5f9;
          --text-hi: #0f172a;
          --text-md: #475569;
          --text-lo: #64748b;
          --primary: #C9A86C;
          --primary-ink: #1F1B12;
          --danger: #ef4444;
          --danger-bg: #fef2f2;
          --danger-border: #fca5a5;
          --ok: #10b981;
        }

        .dark {
          --bg: #0f172a;
          --surface: #1e293b;
          --surface-2: #0f172a;
          --surface-3: #334155;
          --surface-4: #475569;
          --border: #334155;
          --border-soft: #1e293b;
          --text-hi: #f8fafc;
          --text-md: #cbd5e1;
          --text-lo: #94a3b8;
          --primary: #E8C88A;
          --primary-ink: #1A130B;
          --danger: #f87171;
          --danger-bg: rgba(239, 68, 68, 0.12);
          --danger-border: rgba(239, 68, 68, 0.25);
          --ok: #34d399;
        }

        .bg-surface { background: var(--surface); }
        .bg-surface-2 { background: var(--surface-2); }
        .bg-surface-3 { background: var(--surface-3); }
        .bg-surface-4 { background: var(--surface-4); }
        .border-border { border-color: var(--border); }
        .border-border-soft { border-color: var(--border-soft); }
        .text-text-hi { color: var(--text-hi); }
        .text-text-md { color: var(--text-md); }
        .text-text-lo { color: var(--text-lo); }
        .text-primary { color: var(--primary); }
        .bg-primary { background: var(--primary); }
        .border-primary { border-color: var(--primary); }
        .text-danger { color: var(--danger); }
        .bg-danger-bg { background: var(--danger-bg); }
        .border-danger-border { border-color: var(--danger-border); }
        .text-ok { color: var(--ok); }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div className="w-full">
        {/* Global pause banner */}
        {meta.isPaused && (
          <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-sm mb-6 bg-danger-bg border border-danger-border text-danger">
            <Pause size={16} /> Patient notifications are paused. Nothing will
            send until you resume.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-sm mb-6 bg-danger-bg border border-danger-border text-danger">
            <ShieldCheck size={16} /> {error}
            <button
              className="ml-auto text-xs font-bold underline cursor-pointer"
              onClick={refetch}
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-primary">
              Zeva · Communications
            </div>
            <h2 className="m-0 font-display text-[clamp(26px,3.2vw,34px)] font-semibold tracking-tight text-text-hi">
              Notification Settings
            </h2>
            <p className="m-0 mt-2 text-sm text-text-lo">
              Control what gets sent, to whom, and when — across every patient
              touchpoint.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            {/* Analytics pills */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-text-md">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {analytics.enabled} ON
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-text-md">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {analytics.disabled} OFF
            </div>
            <div className="relative flex-1 sm:flex-initial min-w-[220px]">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-lo"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications"
                className="text-sm rounded-xl pl-9 pr-3.5 py-2.5 w-full bg-surface-2 border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <Btn
              icon={meta.isPaused ? Play : Pause}
              variant={meta.isPaused ? "primary" : "default"}
              onClick={handlePause}
            >
              {meta.isPaused ? "Resume" : "Pause all"}
            </Btn>
          </div>
        </div>

        {/* Category tabs */}
        <div
          className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap border border-border transition-all duration-200 shadow-2xs ${
              activeTab === "all"
                ? "bg-surface-3 text-text-hi border-primary font-bold shadow-xs"
                : "bg-surface-2 text-text-md hover:bg-surface-3 hover:text-text-hi"
            }`}
          >
            All{" "}
            <span className="font-mono text-text-lo text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-md font-bold">
              {analytics.total}
            </span>
          </button>
          {CATEGORIES.map((c) => {
            const CatIcon = c.icon;
            const active = activeTab === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap border border-border transition-all duration-200 shadow-2xs ${
                  active
                    ? "bg-surface-3 text-text-hi font-bold shadow-xs"
                    : "bg-surface-2 text-text-md hover:bg-surface-3 hover:text-text-hi"
                }`}
                style={active ? { borderColor: c.color } : {}}
              >
                <CatIcon size={14} style={{ color: c.color }} />
                {c.name}
                <span className="font-mono text-text-lo text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-md font-bold">
                  {analytics.byCategory?.[c.id]?.total ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-surface-2 border border-border h-24 animate-pulse"
              />
            ))}
          </div>
        ) : settings.length === 0 ? (
          <div className="text-center py-20 text-sm text-text-lo">
            No notifications match your search.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 mb-8">
              {settings.map((s) => (
                <NotifCard
                  key={s.notificationTypeKey}
                  n={toNotif(s)}
                  onToggle={toggleNotif}
                  onEdit={openEdit}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
                <div className="text-xs text-text-lo">
                  Showing{" "}
                  <span className="font-semibold text-text-md">
                    {(page - 1) * pagination.limit + 1}–
                    {Math.min(page * pagination.limit, pagination.total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-text-md">
                    {pagination.total}
                  </span>{" "}
                  notifications
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevPage}
                    disabled={page <= 1}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-border bg-surface-2 text-text-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3 hover:text-text-hi transition-all"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {pageRange[0] > 1 && (
                    <>
                      <button
                        onClick={() => goToPage(1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-border bg-surface-2 text-xs font-semibold text-text-md hover:bg-surface-3 transition-all"
                      >
                        1
                      </button>
                      {pageRange[0] > 2 && (
                        <span className="w-8 h-8 flex items-center justify-center text-text-lo text-xs">
                          …
                        </span>
                      )}
                    </>
                  )}

                  {pageRange.map((p) => (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border text-xs font-semibold transition-all ${
                        p === page
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-surface-2 text-text-md hover:bg-surface-3"
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  {pageRange[pageRange.length - 1] < totalPages && (
                    <>
                      {pageRange[pageRange.length - 1] < totalPages - 1 && (
                        <span className="w-8 h-8 flex items-center justify-center text-text-lo text-xs">
                          …
                        </span>
                      )}
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-border bg-surface-2 text-xs font-semibold text-text-md hover:bg-surface-3 transition-all"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    onClick={nextPage}
                    disabled={page >= totalPages}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-border bg-surface-2 text-text-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3 hover:text-text-hi transition-all"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="text-xs text-text-lo hidden sm:block">
                  Page{" "}
                  <span className="font-semibold text-text-md">{page}</span> of{" "}
                  <span className="font-semibold text-text-md">
                    {totalPages}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* <EditDrawer
        notif={editingNotif}
        open={drawerOpen}
        onClose={closeEdit}
        onSave={saveEdit}
      /> */}
      <NotificationEditDrawer
        notif={editingNotif}
        open={drawerOpen}
        isSaving={saving}
        onClose={closeEdit}
        onSave={saveEdit}
      />

      {/* Toast */}
      <div
        className={`fixed left-1/2 z-50 px-5 py-3 rounded-2xl text-xs flex items-center gap-2.5 transition-all duration-300 ease-in-out ${
          toast
            ? "opacity-100 translate-x-[-50%] translate-y-0"
            : "opacity-0 translate-x-[-50%] translate-y-4"
        }`}
        style={{
          bottom: 28,
          pointerEvents: "none",
          background: "var(--surface-3)",
          border: "1px solid var(--border)",
          color: "var(--text-hi)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <Check size={14} className="text-ok" />
        {toast}
      </div>
    </div>
  );
}
