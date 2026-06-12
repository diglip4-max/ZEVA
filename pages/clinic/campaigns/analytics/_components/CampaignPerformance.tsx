import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  CheckCircle2,
  XCircle,
  UserMinus,
  AlertTriangle,
  Eye,
  MousePointer2,
  BarChart3,
  ExternalLink,
  Users,
  Mail,
  TrendingUp,
  AlertCircle,
  Database,
} from "lucide-react";
import { getTokenByPath } from "@/lib/helper";

// Helper function
const calculatePercentage = (total: number, partial: number): string => {
  if (!total || total === 0) return "0%";
  const percentage = (partial / total) * 100;
  return `${percentage.toFixed(1)}%`;
};

// Skeleton Loading Component
const SkeletonLoader = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-7xl">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-4 w-40 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 p-8 rounded-2xl space-y-4"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
              <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mx-auto" />
              <div className="h-5 w-12 bg-gray-100 rounded-full animate-pulse mx-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Engagement Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-50 border border-white p-10 rounded-3xl space-y-4"
          >
            <div className="w-14 h-14 bg-gray-200 rounded-2xl mx-auto animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mx-auto" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse mx-auto" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-3xl p-8 space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, j) => (
                <div
                  key={j}
                  className="h-16 bg-gray-50 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CampaignPerformancePage = () => {
  const router = useRouter();
  const token = getTokenByPath();
  const { campaignId } = router.query;

  const [stats, setStats] = useState<any | null>(null);
  const [topLinks, setTopLinks] = useState<any[]>([]);
  const [topContacts, setTopContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Static data for development/demo
  const useStaticData = false; // Set to false to use API

  const staticData = {
    stats: {
      sent: 12500,
      delivered: 11875,
      bounced: 625,
      unsubscribed: 124,
      spam: 18,
      opened: 7125,
      clicked: 3562,
    },
    topLinks: [
      { link: "https://example.com/summer-sale", clicks: 1245 },
      { link: "https://example.com/new-arrivals", clicks: 892 },
      { link: "https://example.com/membership", clicks: 745 },
      { link: "https://example.com/blog/guide", clicks: 534 },
      { link: "https://example.com/contact", clicks: 421 },
    ],
    topContacts: [
      {
        name: "Sarah Johnson",
        email: "sarah.j@example.com",
        openCount: 12,
        clickCount: 8,
      },
      {
        name: "Michael Chen",
        email: "michael.c@example.com",
        openCount: 10,
        clickCount: 7,
      },
      {
        name: "Emily Rodriguez",
        email: "emily.r@example.com",
        openCount: 9,
        clickCount: 6,
      },
      {
        name: "David Kim",
        email: "david.k@example.com",
        openCount: 8,
        clickCount: 5,
      },
      {
        name: "Lisa Thompson",
        email: "lisa.t@example.com",
        openCount: 7,
        clickCount: 5,
      },
    ],
  };

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!campaignId) return;

      setLoading(true);
      setError(null);

      try {
        // Use static data for demo
        if (useStaticData) {
          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 1500));
          setStats(staticData.stats);
          setTopLinks(staticData.topLinks);
          setTopContacts(staticData.topContacts);
        } else {
          // Real API call with axios
          const { data } = await axios.get(
            `/api/campaigns/analytics/performance/${campaignId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (data && data?.success) {
            setStats(data?.data?.stats);
            setTopLinks(data?.data?.topLinks);
            setTopContacts(data?.data?.topContacts);
          }
        }
      } catch (err) {
        console.error("Failed to fetch campaign performance", err);
        setError("Failed to load campaign data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [campaignId, token]);

  if (loading) {
    return <SkeletonLoader />;
  }

  if (error) {
    return (
      <div className="container py-12">
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-red-900 text-xl font-bold mb-2">
            Oops! Something went wrong
          </h3>
          <p className="text-red-600/80 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container py-12">
        <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-amber-900 text-xl font-bold mb-2">
            No Data Found
          </h3>
          <p className="text-amber-600/80">
            We couldn't find any performance data for this campaign yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-2xl">
            <Mail className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Campaign Performance
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Detailed performance breakdown
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Delivered",
            value: stats?.delivered?.toLocaleString(),
            percent: calculatePercentage(stats?.sent, stats?.delivered),
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            icon: <CheckCircle2 className="w-5 h-5" />,
          },
          {
            title: "Bounced",
            value: stats?.bounced?.toLocaleString(),
            percent: calculatePercentage(stats?.sent, stats?.bounced),
            color: "text-rose-600",
            bgColor: "bg-rose-50",
            icon: <XCircle className="w-5 h-5" />,
          },
          {
            title: "Unsubscribed",
            value: stats?.unsubscribed?.toLocaleString(),
            percent: calculatePercentage(stats?.delivered, stats?.unsubscribed),
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            icon: <UserMinus className="w-5 h-5" />,
          },
          {
            title: "Spam Reports",
            value: stats?.spam?.toLocaleString(),
            percent: calculatePercentage(stats?.delivered, stats?.spam),
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            icon: <AlertTriangle className="w-5 h-5" />,
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className={`${item.bgColor} ${item.color} p-3 rounded-xl shadow-inner`}
              >
                {item.icon}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {item.title}
                </h4>
                <h2 className="text-xl font-bold text-gray-900 leading-none">
                  {item.value}
                </h2>
              </div>
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${item.bgColor} ${item.color}`}
              >
                <TrendingUp className="w-2.5 h-2.5" />
                {item.percent}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Total Opens",
            value: stats?.opened?.toLocaleString(),
            percent: calculatePercentage(stats?.delivered, stats?.opened),
            icon: <Eye className="w-5 h-5" />,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
          },
          {
            title: "Total Clicks",
            value: stats?.clicked?.toLocaleString(),
            percent: calculatePercentage(stats?.delivered, stats?.clicked),
            icon: <MousePointer2 className="w-5 h-5" />,
            color: "text-indigo-600",
            bgColor: "bg-indigo-50",
          },
          {
            title: "Engagement Rate",
            value: calculatePercentage(stats?.opened || 0, stats?.clicked || 0),
            percent: null,
            icon: <BarChart3 className="w-5 h-5" />,
            color: "text-violet-600",
            bgColor: "bg-violet-50",
          },
        ].map((item, i) => (
          <div
            key={i}
            className={`relative overflow-hidden ${item.bgColor} border border-white/50 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group`}
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform duration-300">
              {item.icon}
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className={`${item.color} p-3 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm`}
              >
                {item.icon}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  {item.title}
                </h4>
                <h2
                  className={`text-2xl font-extrabold ${item.color} leading-none`}
                >
                  {item.value}
                </h2>
              </div>
              {item.percent && (
                <p className="text-[11px] font-semibold text-gray-400">
                  {item.percent} of delivered
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Clicked Links */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Top Links</h2>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Most clicked content
              </p>
            </div>
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <TrendingUp className="w-3 h-3 text-blue-600" />
            </div>
          </div>
          <div className="p-6 flex-1">
            {topLinks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="p-3 bg-gray-50 rounded-full">
                  <MousePointer2 className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  No clicks tracked yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] border-b border-gray-50 pb-3">
                  <span>Destination URL</span>
                  <span>Clicks</span>
                </div>
                <div className="space-y-1.5">
                  {topLinks?.map((item, i) => (
                    <div
                      key={i}
                      className="group flex justify-between items-center p-3 bg-white border border-gray-50 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-1.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-600 font-medium truncate group-hover:text-blue-600 transition-colors">
                          {item?.link}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 ml-4 tabular-nums">
                        {item?.clicks?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Engaged Contacts */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <h2 className="text-base font-bold text-gray-900">
                  Top Contacts
                </h2>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Most active recipients
              </p>
            </div>
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <TrendingUp className="w-3 h-3 text-purple-600" />
            </div>
          </div>
          <div className="p-6 flex-1">
            {topContacts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="p-3 bg-gray-50 rounded-full">
                  <Users className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  No active contacts yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] border-b border-gray-50 pb-3">
                  <span>Recipient</span>
                  <span>Opens / Clicks</span>
                </div>
                <div className="space-y-1.5">
                  {topContacts?.map((item, i) => (
                    <div
                      key={i}
                      className="group flex justify-between items-center p-3 bg-white border border-gray-50 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 font-bold text-xs group-hover:scale-110 transition-transform">
                          {item?.name?.charAt(0) || "U"}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {item?.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium truncate">
                            {item?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-xl group-hover:bg-purple-50 transition-colors">
                        <span className="text-xs font-bold text-emerald-600">
                          {item?.openCount}
                        </span>
                        <span className="text-[10px] text-gray-300 font-black">
                          /
                        </span>
                        <span className="text-xs font-bold text-blue-600">
                          {item?.clickCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignPerformancePage;
