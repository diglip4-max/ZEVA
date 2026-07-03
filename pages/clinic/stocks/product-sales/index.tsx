import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import {
  PlusIcon,
  Printer,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Package,
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Calendar,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  Download,
} from "lucide-react";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import AddProductSaleModal from "./_components/AddProductSaleModal";

// Types
interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  mobileNumber?: string;
  email?: string;
  age?: number;
  gender?: string;
}

interface PaymentMethod {
  _id: string;
  name: string;
  status: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface ProductSaleItem {
  allocatedItemId: string;
  name: string;
  code: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  notes: string;
  commission?: number;
}

interface ProductSale {
  _id: string;
  clinicId: string;
  patientId: Patient;
  paymentMethodId: PaymentMethod;
  paymentMethodName: string;
  items: ProductSaleItem[];
  totalPrice: number;
  totalCommission?: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  soldBy?: User;
  invoiceNo?: string;
}

interface Stats {
  totalSales: number;
  totalValue: number;
  totalCommission: number;
  avgValuePerSale: number;
  uniquePatientsCount: number;
  uniquePaymentMethodsCount: number;
  totalItemsSold: number;
}

interface TopProduct {
  name: string;
  code: string;
  totalQuantity: number;
  totalValue: number;
  totalCommission: number;
}

interface TopProductByCommission {
  name: string;
  code: string;
  totalCommission: number;
}

interface TopSeller {
  userId: string;
  name: string;
  email: string;
  totalSales: number;
  totalValue: number;
  totalCommission: number;
}

interface MonthlySale {
  month: string;
  monthName: string;
  year: number;
  totalSales: number;
  totalValue: number;
  totalCommission: number;
}

interface Filters {
  statuses: string[];
  paymentStatuses: string[];
  paymentMethods: string[];
  users: User[];
}

interface Charts {
  topProducts: TopProduct[];
  topProductsByCommission: TopProductByCommission[];
  topSellers: TopSeller[];
  monthlySales: MonthlySale[];
}

interface Pagination {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasMore: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
];

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value =
      window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getUserInfo = (): { role: string | null; id: string | null } => {
  if (typeof window === "undefined") return { role: null, id: null };
  try {
    for (const key of TOKEN_PRIORITY) {
      const token =
        window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (!token) continue;
      const base64Url = token.split(".")[1];
      if (!base64Url) continue;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c?.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const decoded = JSON.parse(jsonPayload);
      return {
        role: decoded.role || decoded.userRole || null,
        id: decoded.userId || decoded.id || null,
      };
    }
  } catch (error) {
    console.error("Error getting user info:", error);
  }
  return { role: null, id: null };
};

const getUserRole = (): string | null => getUserInfo().role;

// Status badge component
const PaymentBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    paid: {
      bg: "bg-green-50",
      text: "text-green-700",
      icon: CheckCircle2,
      label: "Paid",
    },
    pending: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      icon: TrendingUp,
      label: "Pending",
    },
    unpaid: {
      bg: "bg-red-50",
      text: "text-red-700",
      icon: XCircle,
      label: "Unpaid",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className="w-3.5 h-3.5 mr-1" />
      {config.label}
    </span>
  );
};

const ProductSalesPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasMore: false,
    nextPage: null,
    prevPage: null,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    totalValue: 0,
    totalCommission: 0,
    avgValuePerSale: 0,
    uniquePatientsCount: 0,
    uniquePaymentMethodsCount: 0,
    totalItemsSold: 0,
  });
  const [filters, setFilters] = useState<Filters | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [_permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");

  // Add sale modal states
  const [isOpenAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);

  const handleSaleSuccess = () => {
    setIsAddSaleModalOpen(false);
    fetchProductSales();
  };

  const fetchProductSales = useCallback(
    debounce(async (page: number = 1, search: string = "") => {
      try {
        setLoading(true);
        const token = getTokenByPath();
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("limit", "10");
        if (search) params.append("search", encodeURIComponent(search));
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (selectedUserId) params.append("userId", selectedUserId);
        if (selectedStatus) params.append("status", selectedStatus);
        if (selectedPaymentStatus)
          params.append("paymentStatus", selectedPaymentStatus);
        if (selectedPaymentMethodId)
          params.append("paymentMethodId", selectedPaymentMethodId);

        const response = await axios.get(
          `/api/stocks/product-sales?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response.data?.success) {
          setProductSales(response.data?.data?.sales || []);
          setPagination((prev) => ({
            ...prev,
            ...response.data?.data?.pagination,
          }));
          setStats(
            response.data?.data?.statistics || {
              totalSales: 0,
              totalValue: 0,
              totalCommission: 0,
              avgValuePerSale: 0,
              uniquePatientsCount: 0,
              uniquePaymentMethodsCount: 0,
              totalItemsSold: 0,
            },
          );
          setFilters(response.data?.data?.filters || null);
          setCharts(response.data?.data?.charts || null);
        }
      } catch (error) {
        console.error("Error fetching product sales:", error);
      } finally {
        setLoading(false);
      }
    }, 300),
    [
      startDate,
      endDate,
      selectedUserId,
      selectedStatus,
      selectedPaymentStatus,
      selectedPaymentMethodId,
    ],
  );

  useEffect(() => {
    if (_permissionsLoaded) fetchProductSales(1, "");
  }, [_permissionsLoaded, fetchProductSales]);

  useEffect(() => {
    if (_permissionsLoaded) fetchProductSales(1, searchTerm);
  }, [
    searchTerm,
    startDate,
    endDate,
    selectedUserId,
    selectedStatus,
    selectedPaymentStatus,
    selectedPaymentMethodId,
    _permissionsLoaded,
    fetchProductSales,
  ]);

  const handlePageChange = useCallback(
    (page: number) => fetchProductSales(page, searchTerm),
    [fetchProductSales, searchTerm],
  );

  const clinicToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("clinicToken") ||
        window.sessionStorage.getItem("clinicToken")
      : null;
  const doctorToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("doctorToken") ||
        window.sessionStorage.getItem("doctorToken")
      : null;
  const agentToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("agentToken") ||
        window.sessionStorage.getItem("agentToken")
      : null;
  const staffToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("staffToken") ||
        window.sessionStorage.getItem("staffToken")
      : null;
  const userToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("userToken") ||
        window.sessionStorage.getItem("userToken")
      : null;

  useEffect(() => {
    let isMounted = true;
    const userRole = getUserRole();
    const allPerms = {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    };
    const noPerms = {
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    };

    if (userRole === "admin") {
      if (!isMounted) return;
      setPermissions(allPerms);
      setPermissionsLoaded(true);
      return;
    }
    if (userRole === "clinic" || userRole === "doctor") {
      if (isMounted) {
        setPermissions(allPerms);
        setPermissionsLoaded(true);
      }
      return;
    }
    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions(noPerms);
      setPermissionsLoaded(true);
      return;
    }
    if (agentToken || staffToken || userToken) {
      setPermissions(allPerms);
      if (isMounted) setPermissionsLoaded(true);
    } else {
      if (!isMounted) return;
      setPermissions(allPerms);
      setPermissionsLoaded(true);
    }
    return () => {
      isMounted = false;
    };
  }, [clinicToken, doctorToken, agentToken, staffToken, userToken]);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrint = (saleId: string) => {
    window.open(
      `/clinic/stocks/product-sales/print-product-sale/${saleId}`,
      "_blank",
    );
  };

  const displayData = productSales.length > 0 ? productSales : [];

  const handleAddSale = () => router.push("/clinic/stocks/product-sales/new");

  const handleExport = async () => {
    try {
      setExportLoading(true);
      // Build query params
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedPaymentStatus)
        params.set("paymentStatus", selectedPaymentStatus);
      if (selectedPaymentMethodId)
        params.set("paymentMethodId", selectedPaymentMethodId);
      if (selectedUserId) params.set("userId", selectedUserId);

      const token = getTokenByPath();
      const response = await axios.get(
        `/api/stocks/product-sales/export?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob", // Important for downloading files
        },
      );

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `product-sales-export-${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error exporting product sales:", error);
      alert("Failed to export product sales. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedUserId("");
    setSelectedStatus("");
    setSelectedPaymentStatus("");
    setSelectedPaymentMethodId("");
    setSearchTerm("");
  };

  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-400 mb-4">
            You don't have permission to view product sales. Contact your
            administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Product Sales
            </h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              Track transactions, monitor revenue, and manage your clinic's
              product sales
            </p>
          </div>
          <div className="flex items-center gap-3">
            {permissions.canCreate && (
              <button
                onClick={handleAddSale}
                className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg text-sm font-medium hover:from-gray-900 hover:to-gray-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center sm:justify-start"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                New Sale
              </button>
            )}
            <button
              onClick={() => setIsAddSaleModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg text-sm font-medium hover:from-gray-900 hover:to-gray-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center sm:justify-start"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              New Sale Modal
            </button>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all shadow-sm hover:shadow-md flex items-center justify-center sm:justify-start disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Sales",
              value: stats?.totalSales || displayData.length,
              icon: ShoppingCart,
              color: "blue",
            },
            {
              label: "Revenue",
              value: `AED ${(stats?.totalValue || 0).toFixed(0)}`,
              icon: DollarSign,
              color: "green",
            },
            {
              label: "Total Commission",
              value: `AED ${(stats?.totalCommission || 0).toFixed(0)}`,
              icon: TrendingUp,
              color: "purple",
            },
            {
              label: "Avg. Sale",
              value: `AED ${(stats?.avgValuePerSale || 0).toFixed(0)}`,
              icon: TrendingUp,
              color: "indigo",
            },
            {
              label: "Patients",
              value: stats?.uniquePatientsCount || 0,
              icon: Users,
              color: "pink",
            },
            {
              label: "Items Sold",
              value: (stats?.totalItemsSold || 0).toLocaleString(),
              icon: Package,
              color: "amber",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-800 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 bg-${stat.color}-50 rounded-lg`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patient, item, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 text-gray-500 border border-gray-300 rounded-lg text-sm"
                placeholder="Start Date"
              />
              <span className="text-gray-500">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 text-gray-500 border border-gray-300 rounded-lg text-sm"
                placeholder="End Date"
              />
            </div>
            <div className="min-w-[180px]">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-gray-500 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                {filters?.statuses?.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px]">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-gray-500 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Users</option>
                {filters?.users?.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            {(startDate ||
              endDate ||
              selectedUserId ||
              searchTerm ||
              selectedStatus ||
              selectedPaymentStatus ||
              selectedPaymentMethodId) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {charts && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xl shadow-gray-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Top Selling Products
                </h3>
                <p className="text-sm text-gray-500">
                  Best performing items in sales volume
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={charts.topProducts}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#1f2937", fontWeight: 600 }}
                  formatter={(value) => [`${value} units`, "Quantity Sold"]}
                />
                <Bar
                  dataKey="totalQuantity"
                  fill="url(#colorBar)"
                  radius={[8, 8, 0, 0]}
                  barSize={40}
                />
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products by Commission Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xl shadow-gray-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Top Products by Commission
                </h3>
                <p className="text-sm text-gray-500">
                  Items generating the most commission
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                <TrendingUpIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={charts.topProductsByCommission}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#1f2937", fontWeight: 600 }}
                  formatter={(value) => {
                    const numValue = typeof value === "number" ? value : 0;
                    return [`AED ${numValue.toLocaleString()}`, "Commission"];
                  }}
                />
                <Bar
                  dataKey="totalCommission"
                  fill="url(#colorCommissionBar)"
                  radius={[8, 8, 0, 0]}
                  barSize={40}
                />
                <defs>
                  <linearGradient
                    id="colorCommissionBar"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Sellers Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xl shadow-gray-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Top Sellers</h3>
                <p className="text-sm text-gray-500">
                  Revenue generated by each seller
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                <PieChartIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={charts.topSellers}
                  dataKey="totalValue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {charts.topSellers.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#1f2937", fontWeight: 600 }}
                  formatter={(value) => {
                    const numValue = typeof value === "number" ? value : 0;
                    return [`AED ${numValue.toLocaleString()}`, "Revenue"];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Sales & Commission Chart */}
          <div className=" bg-white rounded-2xl border border-gray-100 p-6 shadow-xl shadow-gray-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Monthly Sales & Commission
                </h3>
                <p className="text-sm text-gray-500">
                  Revenue and commission trend over time
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg">
                <TrendingUpIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={charts.monthlySales}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient
                    id="colorCommissionLine"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="monthName"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#1f2937", fontWeight: 600 }}
                  formatter={(value, name) => {
                    const numValue = typeof value === "number" ? value : 0;
                    return [`AED ${numValue.toLocaleString()}`, name];
                  }}
                  labelFormatter={(label) => label}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Line
                  type="monotone"
                  dataKey="totalValue"
                  name="Revenue"
                  stroke="#8b5cf6"
                  strokeWidth={4}
                  dot={{
                    fill: "#8b5cf6",
                    r: 6,
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  activeDot={{ r: 8 }}
                  fill="url(#colorLine)"
                />
                <Line
                  type="monotone"
                  dataKey="totalCommission"
                  name="Commission"
                  stroke="#ec4899"
                  strokeWidth={4}
                  dot={{
                    fill: "#ec4899",
                    r: 6,
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  activeDot={{ r: 8 }}
                  fill="url(#colorCommissionLine)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Data Table Section */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Sales History
              </h2>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Loading sales...</p>
            </div>
          ) : displayData.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No sales yet
              </h3>
              <p className="text-gray-500 mb-6">
                Create your first product sale to get started.
              </p>
              {permissions.canCreate && (
                <button
                  onClick={handleAddSale}
                  className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <PlusIcon className="w-4 h-4 inline mr-2" />
                  New Sale
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sold By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Paid
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayData.map((sale: any) => (
                      <React.Fragment key={sale._id}>
                        <tr
                          className={`hover:bg-gray-50 transition-colors cursor-pointer`}
                          onClick={() => toggleRowExpansion(sale._id)}
                        >
                          {/* Invoice No */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                                {sale?.invoiceNo
                                  ? sale.invoiceNo.slice(-2)
                                  : sale._id.slice(-2).toUpperCase()}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900 font-mono">
                                  {sale?.invoiceNo ||
                                    `#${sale._id.slice(-8).toUpperCase()}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(sale.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(sale.createdAt).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </td>

                          {/* Patient */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {`${sale.patientId?.firstName?.[0] || ""}${sale.patientId?.lastName?.[0] || ""}`.toUpperCase()}
                              </div>
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {sale.patientId?.firstName}{" "}
                                  {sale.patientId?.lastName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {sale.patientId?.phone ||
                                    sale.patientId?.mobileNumber}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Sold By */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {sale.soldBy?.name || "Unknown"}
                            </div>
                          </td>

                          {/* Payment */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 mb-1">
                              <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {sale.paymentMethodName}
                              </span>
                            </div>
                            <PaymentBadge status={sale.paymentStatus} />
                          </td>

                          {/* Items */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                              <Package className="w-3.5 h-3.5" />
                              {sale.items.length} item
                              {sale.items.length !== 1 ? "s" : ""}
                            </span>
                          </td>

                          {/* Total */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">
                              AED {sale.totalPrice.toFixed(2)}
                            </p>
                          </td>
                          {/* Total Paid */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">
                              AED {sale?.totalPaidAmount?.toFixed(2)}
                            </p>
                          </td>

                          {/* Commission */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {sale.totalCommission &&
                            sale.totalCommission > 0 ? (
                              <p className="text-sm font-bold text-purple-600 tabular-nums">
                                AED {sale.totalCommission.toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400">-</p>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrint(sale._id);
                                }}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Print Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion(sale._id);
                                }}
                                className={`p-2 rounded-lg transition-all ${
                                  expandedRows[sale._id]
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}
                                title="View Details"
                              >
                                {expandedRows[sale._id] ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Items */}
                        {expandedRows[sale._id] && (
                          <tr>
                            <td colSpan={9} className="bg-gray-50 px-6 py-4">
                              <div className="pl-4 border-l-2 border-blue-400 ml-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                  Line Items
                                </p>
                                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          Item
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          UOM
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          Qty
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          Unit Price
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          Total
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                          Commission
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {sale.items.map(
                                        (item: any, idx: number) => (
                                          <tr
                                            key={idx}
                                            className="hover:bg-gray-50"
                                          >
                                            <td className="px-4 py-3">
                                              <p className="font-medium text-gray-900">
                                                {item.name}
                                              </p>
                                              {item.code && (
                                                <p className="text-xs text-gray-500 font-mono">
                                                  {item.code}
                                                </p>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                              {item.uom}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-700">
                                              {item.quantity}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600">
                                              AED {item.unitPrice.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                              AED {item.totalPrice.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-purple-600 font-semibold">
                                              {item.commission &&
                                              item.commission > 0
                                                ? `AED ${item.commission.toFixed(2)}`
                                                : "-"}
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t border-gray-200">
                                      <tr>
                                        <td
                                          colSpan={4}
                                          className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
                                        >
                                          Sale Total
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-teal-700">
                                          AED {sale.totalPrice.toFixed(2)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    Showing{" "}
                    <span className="font-medium text-gray-900">
                      {(pagination.currentPage - 1) * pagination.limit + 1}-
                      {Math.min(
                        pagination.currentPage * pagination.limit,
                        pagination.totalResults,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-gray-900">
                      {pagination.totalResults}
                    </span>{" "}
                    results
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handlePageChange(pagination.currentPage - 1)
                      }
                      disabled={pagination.currentPage <= 1}
                      className="px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-500 px-2">
                      {pagination.currentPage} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        handlePageChange(pagination.currentPage + 1)
                      }
                      disabled={!pagination.hasMore}
                      className="px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add sale modal */}
      <AddProductSaleModal
        isOpen={isOpenAddSaleModalOpen}
        onClose={() => setIsAddSaleModalOpen(false)}
        onSuccess={handleSaleSuccess}
      />
    </div>
  );
};

ProductSalesPage.getLayout = function getLayout(page: ReactElement) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedProductSalesPage = withClinicAuth(
  ProductSalesPage,
) as NextPageWithLayout;
ProtectedProductSalesPage.getLayout = ProductSalesPage.getLayout;

export default ProtectedProductSalesPage;
