// hooks/useNotificationLogs.ts
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { MessageType, Provider } from "@/types/conversations";
import { Template } from "@/types/templates";

export type ChannelId = "whatsapp" | "sms" | "email" | "app_push";
export type NotificationStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "opened"
  | "clicked"
  | "failed";

export interface TriggeredBy {
  type: "system" | "user";
  userId?: string;
  userName?: string;
}

export interface NotificationLog {
  _id: string;
  clinicId: string;
  patientId?: {
    firstName: string;
    lastName: string;
    gender: string;
    email: string;
    mobileNumber: string;
  };
  notificationTypeKey: string;
  category: string;
  label: string;
  trigger: {
    event: string;
    conditions?: Record<string, any>;
  };
  sourceId?: string;
  channel: ChannelId;
  recipient: "patient" | "staff";
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  error?: string;
  triggeredBy: TriggeredBy;
  messageId?: MessageType;
  templateId?: Template;
  providerId?: Provider;
  createdAt: Date;
  updatedAt: Date;
}

interface Analytics {
  total: number;
  enabled: number;
  disabled: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
  read: number;
  sent: number;
  pending: number;
  byCategory: Record<
    string,
    { total: number; delivered: number; failed: number; opened: number }
  >;
  byChannel: Record<
    string,
    { total: number; delivered: number; failed: number }
  >;
  byStatus: Record<string, number>;
  today: number;
  yesterday: number;
  trend: number;
}

interface UseNotificationLogsReturn {
  logs: NotificationLog[];
  analytics: Analytics;
  categories: string[];
  loading: boolean;
  error: string | null;
  statusFilter: NotificationStatus | "all";
  setStatusFilter: (filter: NotificationStatus | "all") => void;
  channelFilter: ChannelId | "all";
  setChannelFilter: (filter: ChannelId | "all") => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  search: string;
  setSearch: (search: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  page: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  refetch: () => void;
}

export default function useNotificationLogs(): UseNotificationLogsReturn {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    total: 0,
    enabled: 0,
    disabled: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
    read: 0,
    sent: 0,
    pending: 0,
    byCategory: {},
    byChannel: {},
    byStatus: {},
    today: 0,
    yesterday: 0,
    trend: 0,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<NotificationStatus | "all">(
    "all",
  );
  const [channelFilter, setChannelFilter] = useState<ChannelId | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (channelFilter !== "all") params.append("channel", channelFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (search) params.append("search", search);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", String(page));
      params.append("limit", "20");

      const { data } = await axios.get(
        `/api/notifications/logs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (data.success) {
        setLogs(data.data);
        setAnalytics(data.analytics);
        setCategories(data.categories || []);
        setPagination(data.pagination);
      } else {
        setError(data.message || "Failed to fetch notification logs");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    channelFilter,
    categoryFilter,
    search,
    startDate,
    endDate,
    page,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const nextPage = useCallback(() => {
    if (pagination && page < pagination.totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, pagination]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  const goToPage = useCallback(
    (targetPage: number) => {
      if (
        targetPage >= 1 &&
        pagination &&
        targetPage <= pagination.totalPages
      ) {
        setPage(targetPage);
      }
    },
    [pagination],
  );

  return {
    logs,
    analytics,
    categories,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    pagination,
    nextPage,
    prevPage,
    goToPage,
    refetch: fetchLogs,
  };
}
