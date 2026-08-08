import React, { useState, useEffect } from "react";
import AgentLayout from "../../components/AgentLayout"; // ✅ use Agent layout
import withAgentAuth from "../../components/withAgentAuth"; // ✅ use Agent auth
import { AuroraBackground } from "@/components/ui/aurora-bento-grid";
import { Typewriter } from "@/components/ui/typewriter-text";
import axios from "axios";
import { useRouter } from "next/router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { Calendar, TrendingUp, Layers, User as UserIcon } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useCurrency } from "@/context/CurrencyContext";

const AgentDashboard = () => {
  const { currency } = useCurrency();
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [navigationItems, setNavigationItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Commission states
  const [commissions, setCommissions] = useState([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [chartView, setChartView] = useState("month"); // "month" or "date"

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Decode JWT token to get user info
    const getToken = () => {
      if (typeof window !== "undefined") {
        return (
          localStorage.getItem("agentToken") ||
          localStorage.getItem("userToken")
        );
      }
      return null;
    };

    const decodeToken = (token) => {
      try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return {
          name: payload.name || "",
          email: payload.email || "",
        };
      } catch (error) {
        console.error("Error decoding token:", error);
        return null;
      }
    };

    const token = getToken();
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUserInfo(decoded);
      }
    }
  }, []);

  // Fetch navigation items from the same API as sidebar (single source of truth)
  useEffect(() => {
    const fetchNavigationAndPermissions = async () => {
      try {
        setIsLoading(true);
        const agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") ||
            sessionStorage.getItem("agentToken")
            : null;
        const userToken =
          typeof window !== "undefined"
            ? localStorage.getItem("userToken") ||
            sessionStorage.getItem("userToken")
            : null;
        const token = agentToken || userToken;

        if (!token) {
          setNavigationItems([]);
          setIsLoading(false);
          return;
        }

        const res = await axios.get("/api/agent/sidebar-permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const filteredItems = (res.data.navigationItems || [])
            .filter((item) => {
              const isDashboard =
                item.path === "/agent/dashboard" ||
                item.path === "/agent/agent-dashboard" ||
                item.moduleKey?.toLowerCase().includes("dashboard");
              return !isDashboard && item.path;
            })
            .map((item) => ({
              label: item.label,
              path: item.path,
              icon: item.icon,
              description: item.description || item.label,
              moduleKey: item.moduleKey,
              order: item.order || 999,
              subModules: item.subModules || [],
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          setNavigationItems(filteredItems);
        } else {
          console.error("Error fetching navigation items:", res.data.message);
          setNavigationItems([]);
        }
      } catch (err) {
        console.error("Error fetching navigation items and permissions:", err);
        setNavigationItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationAndPermissions();

    const handleRouteChange = () => {
      fetchNavigationAndPermissions();
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  // Fetch Commissions
  useEffect(() => {
    const loadCommissions = async () => {
      try {
        const agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") ||
            sessionStorage.getItem("agentToken")
            : null;
        const userToken =
          typeof window !== "undefined"
            ? localStorage.getItem("userToken") ||
            sessionStorage.getItem("userToken")
            : null;
        const token = agentToken || userToken;

        if (!token) return;

        const res = await axios.get("/api/agent/commissions/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data && res.data.success) {
          setCommissions(res.data.items || []);
          setTotalCommission(res.data.totalCommission || 0);
        }
      } catch (err) {
        console.error("Error fetching commissions:", err);
      }
    };

    loadCommissions();
  }, []);

  // Format month-wise (Jan-Dec) data
  const getMonthlyData = () => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = monthNames.map((name) => ({ name, amount: 0 }));

    commissions.forEach((item) => {
      const dateVal = item.invoicedDate || item.createdAt;
      if (dateVal) {
        const date = new Date(dateVal);
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyMap[monthIndex].amount += Number(item.commissionAmount || 0);
        }
      }
    });

    return monthlyMap.map((d) => ({
      ...d,
      amount: Number(d.amount.toFixed(2)),
    }));
  };

  // Format date-wise data (Milestone Date wise)
  const getDateWiseData = () => {
    const dateMap = {};

    commissions.forEach((item) => {
      const dateVal = item.invoicedDate || item.createdAt;
      if (dateVal) {
        const formattedDate = new Date(dateVal).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        dateMap[formattedDate] = (dateMap[formattedDate] || 0) + Number(item.commissionAmount || 0);
      }
    });

    return Object.keys(dateMap)
      .map((dateStr) => ({
        name: dateStr,
        amount: Number(dateMap[dateStr].toFixed(2)),
        rawDate: new Date(dateStr),
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  };

  // Calculate current month commissions
  const getThisMonthCommission = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return commissions
      .filter((item) => {
        const dateVal = item.invoicedDate || item.createdAt;
        if (!dateVal) return false;
        const date = new Date(dateVal);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);
  };

  const renderIcon = (iconString) => {
    if (!iconString) return null;
    if (typeof iconString === "string" && iconString.length <= 2) {
      return <span className="text-2xl">{iconString}</span>;
    }
    return <span className="text-xl">{iconString}</span>;
  };

  const monthlyData = getMonthlyData();
  const dateWiseData = getDateWiseData();
  const thisMonthCommission = getThisMonthCommission();

  return (
    <div className="min-h-screen text-gray-900 dark:text-white relative overflow-hidden">
      <AuroraBackground />

      <div className="relative z-10 p-2 md:p-3">
        <div className="max-w-7xl mt-1 mx-auto">
          {/* User Info Section at the top */}
          <div className="mb-4 pb-3 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex-1">
              <h1
                className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight"
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                Hi, {userInfo.name || "Agent!"}
              </h1>
              <div
                className="mt-1 text-sm md:text-base font-medium text-gray-600 dark:text-gray-300 leading-relaxed tracking-normal"
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: "0.01em",
                }}
              >
                <Typewriter
                  text={[
                    "Welcome to your agent dashboard.",
                    "Manage your leads efficiently.",
                    "Track your performance.",
                    "Stay organized and productive.",
                  ]}
                  speed={100}
                  loop={true}
                  className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Commissions Overview Section */}
          <div className="mb-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center font-bold text-teal-600 dark:text-teal-400 text-lg">{getCurrencySymbol(currency)}</span>
                Commissions Summary
              </h2>
              <div className="flex bg-gray-100 dark:bg-white/10 p-0.5 rounded-lg border border-gray-200 dark:border-white/15">
                <button
                  onClick={() => setChartView("month")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartView === "month"
                    ? "bg-teal-600 text-white shadow"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  Month-wise
                </button>
                <button
                  onClick={() => setChartView("date")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartView === "date"
                    ? "bg-teal-600 text-white shadow"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  Date-wise
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
                <div className="p-2.5 bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 font-bold text-lg w-11 h-11 flex items-center justify-center">
                  {getCurrencySymbol(currency)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Commissions</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {getCurrencySymbol(currency)} {Number(totalCommission || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
                <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">This Month</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {getCurrencySymbol(currency)} {Number(thisMonthCommission || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
                <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Milestones Reached</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {commissions.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Recharts Graph */}
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 mb-5 shadow-inner">
              {mounted ? (
                <ResponsiveContainer width="100%" height={260}>
                  {chartView === "month" ? (
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.15)" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(17, 24, 39, 0.95)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value) => [`${getCurrencySymbol(currency)} ${value}`, "Commission"]}
                      />
                      <Bar dataKey="amount" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={dateWiseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D9AA5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2D9AA5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.15)" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(17, 24, 39, 0.95)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value) => [`${getCurrencySymbol(currency)} ${value}`, "Commission"]}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#2D9AA5" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                  Loading Analytics Graph...
                </div>
              )}
            </div>

            {/* Individual Commissions Cards */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                Recent Commission Milestones
              </h3>
              {commissions.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                  No commissions approved yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {commissions.map((item) => (
                    <div
                      key={item.commissionId}
                      className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 flex flex-col justify-between hover:border-teal-500/30 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            {item.patientName || "—"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Invoice: <span className="font-mono text-gray-700 dark:text-gray-300">{item.invoiceNumber || "—"}</span>
                          </div>
                        </div>
                        <div className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-xs font-bold">
                          {getCurrencySymbol(currency)} {Number(item.commissionAmount || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 gap-2">
                        <div>
                          Paid: <span className="font-semibold text-gray-800 dark:text-gray-200">{getCurrencySymbol(currency)} {Number(item.paidAmount || 0).toFixed(2)}</span> ({item.commissionPercent}%)
                        </div>
                        {item.doctorName && (
                          <div>
                            Doctor: <span className="text-gray-800 dark:text-gray-300 font-medium">{item.doctorName}</span>
                          </div>
                        )}
                        {item.invoicedDate && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">
                            {new Date(item.invoicedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Permission-based Dashboard Cards */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3 mt-6">
            <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Modules & Operations
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-600 dark:text-gray-400">
                Loading dashboard...
              </div>
            </div>
          ) : navigationItems.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-600 dark:text-gray-400 text-center">
                <p className="text-lg font-semibold mb-2">
                  No modules available
                </p>
                <p className="text-sm">
                  You don't have permissions to view any dashboard modules yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 mt-2">
              {navigationItems.map((item, index) => (
                <div
                  key={item.moduleKey || index}
                  onClick={() => item.path && router.push(item.path)}
                  className={`
                    group relative rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-400 
                    hover:shadow-lg transition-all duration-200 cursor-pointer
                    border border-transparent hover:border-white/20
                    flex flex-col justify-between
                    p-2.5 md:p-3 min-h-[120px] md:min-h-[130px]
                    ${item.path
                      ? "hover:scale-[1.02]"
                      : "opacity-60 cursor-not-allowed"
                    }
                  `}
                >
                  {/* Icon */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="p-1.5 bg-white/10 rounded-md backdrop-blur-sm">
                      {renderIcon(item.icon)}
                    </div>
                    {item.subModules && item.subModules.length > 0 && (
                      <span className="text-xs text-white/70 bg-white/10 px-1.5 py-0.5 rounded">
                        {item.subModules.length}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-end">
                    <h3 className="text-base md:text-lg font-bold text-white leading-tight mb-0.5">
                      {item.label}
                    </h3>
                    <p className="text-xs md:text-sm text-white/70 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Hover indicator */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-4 h-4 text-white/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ✅ Attach Agent layout
AgentDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

// ✅ Apply Agent Auth HOC
const ProtectedAgentDashboard = withAgentAuth(AgentDashboard);

// ✅ Reassign layout for the protected version
ProtectedAgentDashboard.getLayout = AgentDashboard.getLayout;

export default ProtectedAgentDashboard;
