import { getTokenByPath } from "@/lib/helper";
import { Attachment } from "@/types/campaigns";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

// ============================================================
// Types
// ============================================================

export type TimingMode = "immediate" | "before_event" | "after_event";
export type ChannelId = "whatsapp" | "sms" | "email" | "app_push";
export type Recipient = "patient" | "staff";

export interface NotificationChannel {
  channel: ChannelId;
  recipient: Recipient;
  isEnabled: boolean;
  priority: number;
  templateId: string;
  providerId: string;
  attachments?: Attachment[];
  mediaUrl?: string;
  mediaType?: string;
  variableMappings?: Record<string, string>;
  headerVariableMappings?: Record<string, string>;
  buttonVariableMappings?: Record<string, string>;
}

export interface NotificationTiming {
  mode: TimingMode;
  offsetMinutes: number;
}

export interface NotificationTrigger {
  event: string;
  conditions: Record<string, unknown>;
}

export interface NotificationSetting {
  _id: string;
  notificationTypeKey: string;
  category: string;
  label: string;
  isEnabled: boolean;
  isProtected: boolean;
  trigger: NotificationTrigger;
  channels: NotificationChannel[];
  timing: NotificationTiming;
  bypassQuietHours: boolean;
  respectMarketingPreference: boolean;
  preventDuplicateForSameEvent: boolean;
}

export interface SettingsMeta {
  isPaused: boolean;
  quietHours: { start: string; end: string };
  marketingRules: { maxPerWeek: number; appliesToCategories: string[] };
}

export interface SettingsAnalytics {
  total: number;
  enabled: number;
  disabled: number;
  protected: number;
  byCategory: Record<string, { total: number; enabled: number }>;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type CategoryFilter =
  | "all"
  | "payment"
  | "appointment"
  | "package"
  | "followup"
  | "engagement"
  | "offer"
  | "feedback"
  | "security";

const DEFAULT_ANALYTICS: SettingsAnalytics = {
  total: 0,
  enabled: 0,
  disabled: 0,
  protected: 0,
  byCategory: {},
};

const DEFAULT_META: SettingsMeta = {
  isPaused: false,
  quietHours: { start: "22:00", end: "08:00" },
  marketingRules: {
    maxPerWeek: 2,
    appliesToCategories: ["engagement", "offer"],
  },
};

// ============================================================
// Hook
// ============================================================

export default function useNotificationSetting() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [analytics, setAnalytics] =
    useState<SettingsAnalytics>(DEFAULT_ANALYTICS);
  const [meta, setMeta] = useState<SettingsMeta>(DEFAULT_META);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [enabledFilter, setEnabledFilter] = useState<
    "all" | "enabled" | "disabled"
  >("all");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (search) params.set("search", search);
    if (enabledFilter === "enabled") params.set("isEnabled", "true");
    if (enabledFilter === "disabled") params.set("isEnabled", "false");
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [categoryFilter, search, enabledFilter, page, limit]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(`/api/settings?${buildQuery()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!data.success)
        throw new Error(data.message || "Failed to load settings");

      setSettings(data.data || []);
      setAnalytics({ ...DEFAULT_ANALYTICS, ...(data.analytics || {}) });
      setMeta({ ...DEFAULT_META, ...(data.meta || {}) });
      setPagination(data.pagination || null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, search, enabledFilter]);

  const nextPage = useCallback(() => {
    if (pagination && page < pagination.totalPages) setPage((p) => p + 1);
  }, [pagination, page]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  // ── Toggle a single notification on/off
  const toggleNotification = useCallback(
    async (notificationTypeKey: string, isEnabled: boolean) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(
          "/api/settings",
          { notificationTypeKey, updates: { isEnabled } },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!data.success) throw new Error(data.message || "Failed to update");

        // Optimistic update
        setSettings((prev) =>
          prev.map((s) =>
            s.notificationTypeKey === notificationTypeKey
              ? { ...s, isEnabled }
              : s,
          ),
        );
        setAnalytics((prev) => ({
          ...prev,
          enabled: isEnabled ? prev.enabled + 1 : prev.enabled - 1,
          disabled: isEnabled ? prev.disabled - 1 : prev.disabled + 1,
        }));
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ── Save full notification update from drawer
  const saveNotification = useCallback(
    async (
      notificationTypeKey: string,
      updates: Partial<NotificationSetting>,
    ) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(
          "/api/settings",
          { notificationTypeKey, updates },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!data.success) throw new Error(data.message || "Failed to save");
        await fetchSettings();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchSettings],
  );

  // ── Toggle global pause
  const setPaused = useCallback(async (isPaused: boolean) => {
    setSaving(true);
    try {
      const token = getTokenByPath();
      const { data } = await axios.patch(
        "/api/settings",
        { isPaused },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!data.success)
        throw new Error(data.message || "Failed to update pause state");
      setMeta((prev) => ({ ...prev, isPaused }));
      return { ok: true as const };
    } catch (err: any) {
      return { ok: false as const, warning: err.message };
    } finally {
      setSaving(false);
    }
  }, []);

  const categories = useMemo<CategoryFilter[]>(
    () => [
      "all",
      "payment",
      "appointment",
      "package",
      "followup",
      "engagement",
      "offer",
      "feedback",
      "security",
    ],
    [],
  );

  return {
    settings,
    analytics,
    meta,
    loading,
    saving,
    error,

    // filters
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    enabledFilter,
    setEnabledFilter,
    categories,

    // pagination
    page,
    limit,
    pagination,
    nextPage,
    prevPage,
    goToPage,

    // actions
    toggleNotification,
    saveNotification,
    setPaused,
    refetch: fetchSettings,
  };
}
