import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  Calendar,
  Download,
  // Filter,
  TrendingUp,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Mail,
  CheckCircle2,
  Info,
} from "lucide-react";
import CampaignPerformance from "./_components/CampaignPerformance";
import CampaignRecipients from "./_components/CampaignRecipients";
import { getTokenByPath } from "@/lib/helper";

const tabs = [
  {
    label: "Performance",
    value: "performance",
    icon: TrendingUp,
    description: "View campaign metrics and engagement statistics",
  },
  {
    label: "Recipients",
    value: "recipients",
    icon: Users,
    description: "Manage and analyze recipient data",
  },
];

const SkeletonHeader = () => (
  <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-b-3xl shadow-xl animate-pulse">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 w-14 h-14" />
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-20 h-4 bg-white/20 rounded-full" />
              <div className="w-16 h-4 bg-white/20 rounded-full" />
            </div>
            <div className="w-48 h-8 bg-white/20 rounded-lg" />
            <div className="w-32 h-4 bg-white/10 rounded-md" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-32 h-10 bg-white/10 rounded-xl" />
          <div className="w-32 h-10 bg-white/10 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="w-20 h-3 bg-white/20 rounded" />
                <div className="w-24 h-7 bg-white/20 rounded" />
                <div className="w-16 h-3 bg-white/10 rounded" />
              </div>
              <div className="w-11 h-11 bg-white/10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CampaignAnalyticsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const token = getTokenByPath();
  const { campaignId } = router.query;
  const [activeTab, setActiveTab] = useState("performance");
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Toggle for dynamic/static data
  const useStaticData = false;

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  const handleExportCampaignAnalytics = async () => {
    try {
      const token = getTokenByPath();
      if (!token) return;
      setIsExporting(true);
      // Fetch the CSV file from the API
      const response = await axios.get(`/api/campaigns/export/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob", // Important for file download
      });

      // Create a blob from the response
      const blob = new Blob([response.data], { type: "text/csv" });

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Get campaign name for filename
      const fileName = campaign
        ? `${campaign.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_analytics.csv`
        : "campaign_analytics.csv";

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error exporting campaign analytics:", error);

      // Handle error response
      if (error.response) {
        const errorData = await error.response.data.text();
        try {
          const errorJson = JSON.parse(errorData);
          alert(errorJson.message || "Failed to export campaign analytics");
        } catch {
          alert("Failed to export campaign analytics");
        }
      } else {
        alert("Failed to export campaign analytics");
      }
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId || useStaticData) return;
      setLoading(true);
      try {
        const [campaignRes, statsRes] = await Promise.all([
          axios.get(`/api/campaigns/${campaignId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          axios.get(`/api/campaigns/analytics/performance/${campaignId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);
        setCampaign(campaignRes.data.campaign);
        setStats(statsRes.data.data.stats);
      } catch (err) {
        console.error("Failed to fetch analytics data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [campaignId, useStaticData]);

  // Static campaign data for the header (kept as fallback or when useStaticData is true)
  const staticCampaignData = {
    name: "Summer Wellness Promotion",
    id: campaignId || "CMP-2024-001",
    status: "Completed",
    type: "Email",
    stats: [
      {
        label: "Total Sent",
        value: "12,500",
        change: "+2.5%",
        icon: Mail,
        color: "bg-blue-500/20",
      },
      {
        label: "Open Rate",
        value: "47.8%",
        change: "+5.2%",
        icon: Activity,
        color: "bg-green-500/20",
      },
      {
        label: "Click Rate",
        value: "23.4%",
        change: "+3.1%",
        icon: PieChart,
        color: "bg-purple-500/20",
      },
      {
        label: "Delivered",
        value: "11,875",
        change: "95.0%",
        icon: CheckCircle2,
        color: "bg-emerald-500/20",
      },
    ],
  };

  // Map dynamic data to header format
  const campaignData = useStaticData
    ? staticCampaignData
    : {
        name: campaign?.name || staticCampaignData.name,
        id: campaignId || staticCampaignData.id,
        status: campaign?.status || staticCampaignData.status,
        type: campaign?.type || staticCampaignData.type,
        stats: [
          {
            label: "Total Sent",
            value:
              stats?.sent?.toLocaleString() ||
              staticCampaignData.stats[0].value,
            change: stats
              ? `${((stats.sent / campaign.totalMessages) * 100).toFixed(1)}%`
              : "0%",
            icon: Mail,
            color: "bg-blue-500/20",
          },
          {
            label: "Open Rate",
            value: stats
              ? `${((stats.opened / stats.delivered) * 100).toFixed(1)}%`
              : staticCampaignData.stats[1].value,
            change: stats
              ? `${((stats.opened / stats.delivered) * 100).toFixed(1)}%`
              : "0%",
            icon: Activity,
            color: "bg-green-500/20",
          },
          {
            label: "Click Rate",
            value: stats
              ? `${((stats.clicked / stats.delivered) * 100).toFixed(1)}%`
              : staticCampaignData.stats[2].value,
            change: stats
              ? `${((stats.clicked / stats.delivered) * 100).toFixed(1)}%`
              : "0%",
            icon: PieChart,
            color: "bg-purple-500/20",
          },
          {
            label: "Delivered",
            value:
              stats?.delivered?.toLocaleString() ||
              staticCampaignData.stats[3].value,
            change: stats
              ? `${((stats.delivered / stats.sent) * 100).toFixed(1)}%`
              : "0%",
            icon: CheckCircle2,
            color: "bg-emerald-500/20",
          },
        ],
      };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-gray-900/[0.02] -z-10" />

      <div className="relative">
        {/* Header Section with Gradient */}
        {loading ? (
          <SkeletonHeader />
        ) : (
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-b-3xl shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Top Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-blue-500/30 text-white text-[10px] font-bold rounded-full border border-white/20 uppercase tracking-wider">
                        {campaignData.type} Campaign
                      </span>
                      <span className="px-2 py-0.5 bg-green-500/30 text-white text-[10px] font-bold rounded-full border border-white/20 uppercase tracking-wider">
                        {campaignData.status}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      {campaignData.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Info className="w-3.5 h-3.5 text-blue-200" />
                      <p className="text-blue-100 text-xs font-medium">
                        Campaign ID:{" "}
                        <span className="text-white">{campaignData.id}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button className="bg-white/10 backdrop-blur-sm hover:bg-white/20 px-4 py-2 rounded-xl text-white text-xs font-medium transition-all duration-200 flex items-center gap-2 border border-white/20">
                    <Calendar className="w-4 h-4" />
                    Sent on June 10, 2026
                  </button>
                  <button
                    onClick={handleExportCampaignAnalytics}
                    disabled={isExporting}
                    className="bg-white px-4 py-2 rounded-xl text-blue-700 text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? "Exporting..." : "Export Report"}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                {campaignData.stats.map((stat, index) => (
                  <div
                    key={index}
                    className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/20 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wider">
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold text-white mt-1">
                          {stat.value}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="w-3 h-3 text-green-300" />
                          <p className="text-green-300 text-[10px] font-bold">
                            {stat.change}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`${stat.color} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}
                      >
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Modern Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center">
              <div className="flex p-1 bg-gray-50/50">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => handleTabClick(tab.value)}
                    className={`
                      relative px-8 py-3 rounded-xl text-xs font-bold transition-all duration-300
                      flex items-center gap-2.5 group whitespace-nowrap
                      ${
                        activeTab === tab.value
                          ? "text-blue-700 bg-white shadow-sm ring-1 ring-gray-100"
                          : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                      }
                    `}
                  >
                    <tab.icon
                      className={`w-4 h-4 transition-all duration-300 ${
                        activeTab === tab.value
                          ? "text-blue-600 scale-110"
                          : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    />
                    {tab.label}
                    {activeTab === tab.value && (
                      <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Action/Filter Button
              <div className="p-2 flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-200 active:scale-95">
                  <Filter className="w-3.5 h-3.5" />
                  Filter Data
                </button>
              </div> */}
            </div>
          </div>

          {/* Tab Content with Animation */}
          <div className="transition-all duration-300 ease-in-out">
            {activeTab === "performance" ? (
              <div className="animate-fadeIn">
                <CampaignPerformance />
              </div>
            ) : (
              <div className="animate-fadeIn">
                <CampaignRecipients />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

// Layout configuration
CampaignAnalyticsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedCampaignAnalyticsPage = withClinicAuth(
  CampaignAnalyticsPage,
) as NextPageWithLayout;
ProtectedCampaignAnalyticsPage.getLayout = CampaignAnalyticsPage.getLayout;

export default ProtectedCampaignAnalyticsPage;
