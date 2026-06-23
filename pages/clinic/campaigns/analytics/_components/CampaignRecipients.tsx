import {
  Mail,
  User,
  Link as LinkIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import debounce from "lodash.debounce";

export type StatusType =
  | "Sent"
  | "Delivered"
  | "Opened"
  | "Clicked"
  | "Bounced"
  | "Unsubscribed"
  | "Failed"
  | "Not sent"
  | "Spam reports";

const statusList: StatusType[] = [
  "Sent",
  "Delivered",
  "Opened",
  "Clicked",
  "Bounced",
  "Unsubscribed",
  "Failed",
  "Not sent",
  "Spam reports",
];

// Helper function
const capitalize = (str: string): string => {
  if (!str) return "N/A";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Custom Loading Skeleton for Sidebar
const SidebarSkeleton = () => {
  return (
    <div className="space-y-3 p-2">
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          className="flex justify-between items-center px-4 py-3 rounded-xl bg-gray-50/50"
        >
          <div className="h-4 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-8 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );
};

// Custom Loading Skeleton for Main Content
const ContentSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50">
        <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse" />
      </div>
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 bg-white border border-gray-50 rounded-xl"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-3 w-64 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Component
const CampaignRecipientsPage = () => {
  const router = useRouter();
  const token = getTokenByPath();
  const { campaignId } = router.query;

  const [selectedStatus, setSelectedStatus] = useState<StatusType>("Sent");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Debounce search query
  const debounceSearch = useCallback(
    debounce((query: string) => {
      setDebouncedSearchQuery(query);
    }, 300), // 300ms delay
    [],
  );

  // Update debounced search when search query changes
  useEffect(() => {
    debounceSearch(searchQuery);
    return () => debounceSearch.cancel();
  }, [searchQuery, debounceSearch]);

  // Reset page when debounced search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  // Static data for development/demo
  const useStaticData = false;

  const staticStatusCounts = {
    Sent: 12500,
    Delivered: 11875,
    Opened: 7125,
    Clicked: 3562,
    Bounced: 625,
    Unsubscribed: 124,
    Failed: 89,
    "Not sent": 425,
    "Spam reports": 18,
  };

  const staticLeadsByStatus: Record<string, any[]> = {
    Sent: [
      {
        lead: { name: "John Doe", email: "john@example.com" },
        message: { status: "sent" },
      },
      {
        lead: { name: "Jane Smith", email: "jane@example.com" },
        message: { status: "sent" },
      },
      {
        lead: { name: "Robert Wilson", email: "robert.w@example.com" },
        message: { status: "sent" },
      },
    ],
    Clicked: [
      {
        lead: { name: "Sarah Johnson", email: "sarah@example.com" },
        link: "https://example.com/summer-sale",
        message: { status: "clicked" },
      },
      {
        lead: { name: "Michael Chen", email: "michael@example.com" },
        link: "https://example.com/new-arrivals",
        message: { status: "clicked" },
      },
    ],
    Delivered: [
      {
        lead: { name: "Emily Rodriguez", email: "emily@example.com" },
        message: { status: "delivered" },
      },
    ],
  };

  // Fetch all counts first
  const fetchCounts = useCallback(async () => {
    if (!campaignId) return;
    setLoadingCounts(true);
    try {
      if (useStaticData) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setStatusCounts(staticStatusCounts);
      } else {
        const { data } = await axios.get(
          `/api/campaigns/analytics/recipients/${campaignId}/counts`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        setStatusCounts(data?.data || {});
      }
    } catch (error) {
      console.error("Failed to fetch counts", error);
    } finally {
      setLoadingCounts(false);
    }
  }, [campaignId]);

  // Fetch current contacts by status
  const fetchRecipients = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      let status =
        selectedStatus === "Not sent"
          ? "notSent"
          : selectedStatus === "Spam reports"
            ? "complained"
            : selectedStatus.toLowerCase();

      if (useStaticData) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        let staticData = staticLeadsByStatus[selectedStatus] || [];
        // Apply search filter for static data
        if (debouncedSearchQuery) {
          const query = debouncedSearchQuery.toLowerCase();
          staticData = staticData.filter((item) => {
            const name = item?.lead?.name?.toLowerCase() || "";
            const email = item?.lead?.email?.toLowerCase() || "";
            return name.includes(query) || email.includes(query);
          });
        }
        const start = (page - 1) * parseInt(limit);
        const end = start + parseInt(limit);
        const paginatedData = staticData.slice(start, end);
        setContacts(paginatedData);
        setTotal(staticData.length);
      } else {
        const { data } = await axios.get(
          `/api/campaigns/analytics/recipients/${campaignId}/${status}`,
          {
            params: {
              page,
              limit,
              search: debouncedSearchQuery || undefined,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        setContacts(data.data || []);
        setTotal(data.pagination?.totalResults || 0);
      }
    } catch (error) {
      console.error("Failed to fetch recipients", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, selectedStatus, page, limit, debouncedSearchQuery]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!loadingCounts) fetchRecipients();
  }, [fetchRecipients, loadingCounts]);

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    setPage((p) => p + 1);
  };

  const getStatusIcon = (status: StatusType, size = "w-4 h-4") => {
    switch (status) {
      case "Sent":
        return <Mail className={`${size} text-blue-500`} />;
      case "Delivered":
        return <CheckCircle2 className={`${size} text-emerald-500`} />;
      case "Opened":
        return <User className={`${size} text-purple-500`} />;
      case "Clicked":
        return <LinkIcon className={`${size} text-indigo-500`} />;
      case "Bounced":
        return <AlertCircle className={`${size} text-rose-500`} />;
      case "Failed":
        return <XCircle className={`${size} text-rose-500`} />;
      case "Unsubscribed":
        return <User className={`${size} text-amber-500`} />;
      case "Spam reports":
        return <AlertCircle className={`${size} text-purple-500`} />;
      default:
        return <Clock className={`${size} text-gray-500`} />;
    }
  };

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case "Sent":
        return "bg-blue-50 text-blue-700 ring-blue-600/10";
      case "Delivered":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
      case "Opened":
        return "bg-purple-50 text-purple-700 ring-purple-600/10";
      case "Clicked":
        return "bg-indigo-50 text-indigo-700 ring-indigo-600/10";
      case "Bounced":
        return "bg-rose-50 text-rose-700 ring-rose-600/10";
      case "Failed":
        return "bg-rose-50 text-rose-700 ring-rose-600/10";
      case "Unsubscribed":
        return "bg-amber-50 text-amber-700 ring-amber-600/10";
      case "Not sent":
        return "bg-gray-50 text-gray-700 ring-gray-600/10";
      case "Spam reports":
        return "bg-purple-50 text-purple-700 ring-purple-600/10";
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/10";
    }
  };

  if (loadingCounts) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="col-span-1">
            <SidebarSkeleton />
          </div>
          <div className="col-span-4">
            <ContentSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-2xl">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Campaign Recipients
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Track and manage recipient engagement
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar - Status Filter */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <h3 className="font-bold text-gray-900 text-sm">Filters</h3>
            </div>
            <div className="p-2 space-y-1">
              {statusList.map((status) => (
                <div
                  key={status}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group ${
                    selectedStatus === status
                      ? "bg-indigo-50 shadow-sm"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSelectedStatus(status);
                    setPage(1);
                  }}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status, "w-4 h-4")}
                    <span
                      className={`text-sm font-semibold ${
                        selectedStatus === status
                          ? "text-indigo-900"
                          : "text-gray-600 group-hover:text-gray-900"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      selectedStatus === status
                        ? "bg-white text-indigo-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {statusCounts[status]?.toLocaleString() ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl bg-white shadow-sm ring-1 ring-gray-100`}
                  >
                    {getStatusIcon(selectedStatus, "w-5 h-5")}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedStatus} Leads
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {total.toLocaleString()} found in this category
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all w-full sm:w-64"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              {loading ? (
                <div className="p-8 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse flex items-center justify-between p-4 bg-gray-50/50 rounded-xl"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                        <div className="h-3 w-48 bg-gray-200 rounded" />
                      </div>
                      <div className="h-8 w-24 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-20 px-8">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <User className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">
                    No recipients found
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-[240px] mx-auto">
                    Try adjusting your filters or search terms to find what
                    you're looking for.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left bg-gray-50/30">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                          Recipient Information
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                          Status & Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {contacts.map((item, index) => (
                        <tr
                          key={index}
                          className="group hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-700 font-bold text-sm group-hover:scale-110 transition-transform">
                                {item?.lead?.name?.charAt(0) || "U"}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                  {item?.lead?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-gray-400 font-medium truncate">
                                  {item?.lead?.email || "No email"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {selectedStatus === "Clicked" && item?.link ? (
                              <div className="flex flex-col gap-1.5 max-w-[200px] sm:max-w-xs">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ring-1 ring-inset ${getStatusColor("Clicked")}`}
                                >
                                  Clicked
                                </span>
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors group/link"
                                >
                                  <span className="truncate">{item.link}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ring-1 ring-inset ${getStatusColor(selectedStatus)}`}
                                >
                                  {capitalize(
                                    item?.message?.status || selectedStatus,
                                  )}
                                </span>
                                {/* <span className="text-[10px] text-gray-400 font-medium">
                                  Just now
                                </span> */}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!loading && contacts.length > 0 && (
              <div className="px-6 py-5 border-t border-gray-50 bg-gray-50/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">
                      Rows per page:
                    </span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(e.target.value);
                        setPage(1);
                      }}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm font-bold text-gray-700"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-xs font-bold text-gray-400 tabular-nums">
                      {parseInt(limit) * (page - 1) + 1} -{" "}
                      {Math.min(
                        parseInt(limit) * (page - 1) + contacts.length,
                        total,
                      )}{" "}
                      of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handlePrevPage}
                        disabled={page <= 1}
                        className="p-2 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95 group"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600 group-hover:-translate-x-0.5 transition-transform" />
                      </button>
                      <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
                        {page}
                      </div>
                      <button
                        onClick={handleNextPage}
                        disabled={contacts.length < parseInt(limit)}
                        className="p-2 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95 group"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignRecipientsPage;
