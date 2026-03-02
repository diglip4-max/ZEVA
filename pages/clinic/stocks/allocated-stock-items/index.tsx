import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useEffect, useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CalendarIcon,
  UserIcon,
  BeakerIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathRoundedSquareIcon,
} from "@heroicons/react/24/outline";
import AddAllocationModal from "./_components/AddAllocationModal";
import ViewAllocationModal from "./_components/ViewAllocationModal";
import EditAllocationModal from "./_components/EditAllocationModal";
import DeleteAllocationModal from "./_components/DeleteAllocationModal";
import axios from "axios";
import { getAuthHeaders } from "@/lib/helper";

type AllocStatus =
  | "Allocated"
  | "In_Use"
  | "Used"
  | "Partially_Used"
  | "Returned"
  | "Expired"
  | "Cancelled";

type AllocatedItem = {
  _id: string;
  item?: any;
  quantity: number;
  user?: { name: string; role?: string };
  location?: any;
  referenceId?: string;
  allocatedAt: string;
  expiryDate?: string;
  status: AllocStatus;
  batchNumber?: string;
  allocatedBy?: { name: string; role?: string };
  quantitiesByUom?: { uom: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    Allocated: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: ClockIcon,
      label: "Allocated",
    },
    In_Use: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      icon: ArrowPathRoundedSquareIcon,
      label: "In Use",
    },
    Used: {
      bg: "bg-green-50",
      text: "text-green-700",
      icon: CheckCircleIcon,
      label: "Used",
    },
    Partially_Used: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      icon: ArrowPathIcon,
      label: "Partially Used",
    },
    Returned: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      icon: ArrowPathRoundedSquareIcon,
      label: "Returned",
    },
    Expired: {
      bg: "bg-red-50",
      text: "text-red-700",
      icon: ExclamationTriangleIcon,
      label: "Expired",
    },
    Cancelled: {
      bg: "bg-gray-100",
      text: "text-gray-500",
      icon: XCircleIcon,
      label: "Cancelled",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.Allocated;
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

// Format date helper
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const AllocatedStockItemsPage: NextPageWithLayout = () => {
  const [isOpenAddModal, setIsOpenAddModal] = useState<boolean>(false);
  const [isOpenViewModal, setIsOpenViewModal] = useState<boolean>(false);
  const [isOpenEditModal, setIsOpenEditModal] = useState<boolean>(false);
  const [isOpenDeleteModal, setIsOpenDeleteModal] = useState<boolean>(false);
  const [selectedAllocatedItem, setSelectedAllocatedItem] = useState<
    AllocatedItem | undefined
  >(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AllocStatus>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<AllocatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const headers = useMemo(() => getAuthHeaders() || {}, []);

  const fetchAllocated = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
        sort: "-allocatedAt",
      });

      const { data } = await axios.get(
        `/api/stocks/allocated-stock-items?${params.toString()}`,
        { headers },
      );

      if (data && data?.success) {
        const list: AllocatedItem[] = data?.records || [];
        setItems(list);
        setTotalResults(data?.totalRecords || list.length || 0);
        setTotalPages(data?.totalPages || 1);
        setPage(data?.currentPage || pageNum);
      }
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message
          ? (err as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "Failed to fetch allocated items";
      setError(message);
      setItems([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocated(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTerm, limit]);

  const statuses = [
    "All",
    "Allocated",
    "Issued",
    "Used",
    "Partially_Used",
    "Returned",
    "Expired",
    "Cancelled",
    "Deleted",
  ];

  const analytics = useMemo(() => {
    const total = totalResults;
    const inUse = items.filter((i) => i.status === "In_Use").length;
    const usedToday = items.filter((i) => {
      const d = new Date(i.allocatedAt);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        i.status === "Used"
      );
    }).length;
    const expiringSoon = items.filter((i) => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      const now = new Date();
      const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;
    return { total, inUse, usedToday, expiringSoon };
  }, [items, totalResults]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Allocated Stock Items
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Manage and track stock allocated to users and procedures
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {/* <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center sm:justify-start">
                <FunnelIcon className="w-4 h-4 mr-2" />
                Export
              </button> */}
              <button
                onClick={() => setIsOpenAddModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center sm:justify-start"
              >
                <BeakerIcon className="w-4 h-4 mr-2" />
                New Allocation
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            {[
              {
                label: "Total Allocated",
                value: String(analytics.total),
                icon: BeakerIcon,
                color: "blue",
              },
              {
                label: "In Use Now",
                value: String(analytics.inUse),
                icon: ClockIcon,
                color: "yellow",
              },
              {
                label: "Used Today",
                value: String(analytics.usedToday),
                icon: CheckCircleIcon,
                color: "green",
              },
              {
                label: "Expiring Soon",
                value: String(analytics.expiringSoon),
                icon: ExclamationTriangleIcon,
                color: "red",
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

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item name, code, user, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 text-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 text-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All Status" : status.replace("_", " ")}
                  </option>
                ))}
              </select>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <ArrowPathIcon className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Loading allocated items...
            </h3>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Failed to load allocated items
            </h3>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <BeakerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No allocated items found
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your search or filter to find what you are looking
              for.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items?.map((item) => (
              <div
                key={item._id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-md">
                        {(item?.item?.name || "?").charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {item?.item?.name || "-"}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Code: {item?.item?.code || "-"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={item?.status} />
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex items-center text-sm">
                      <UserIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        {item.user?.name || "-"}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({item.user?.role || "-"})
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <svg
                        className="w-4 h-4 text-gray-400 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-gray-600">
                        {item?.location?.location || "-"}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <BeakerIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        Qty:{" "}
                        {item?.quantitiesByUom
                          ?.map((uom) => `${uom.quantity} ${uom.uom}`)
                          .join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <UserIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        Allocated By: {item?.allocatedBy?.name || "-"}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CalendarIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        Allocated At: {formatDate(item?.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <ClockIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        Expires:{" "}
                        {item?.expiryDate ? formatDate(item?.expiryDate) : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons with Icons */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Button */}
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenViewModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all group-hover:scale-105"
                        title="View Details"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenEditModal(true);
                        }}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all group-hover:scale-105"
                        title="Edit Allocation"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenDeleteModal(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all group-hover:scale-105"
                        title="Delete Allocation"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocated By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocated At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                          {(item.item?.name || "?").charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.item?.name || "-"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.item?.code || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.user?.name || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.user?.role || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item?.location?.location || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item?.quantity || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={item?.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item?.allocatedBy?.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item?.createdAt ? formatDate(item?.createdAt) : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-3">
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenViewModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenEditModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAllocatedItem(item);
                          setIsOpenDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} / {totalPages} • {totalResults} Total
          </div>
          <div className="flex gap-2 items-center text-gray-500">
            <button
              type="button"
              className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => fetchAllocated(page - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => fetchAllocated(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AddAllocationModal
        isOpen={isOpenAddModal}
        onClose={() => setIsOpenAddModal(false)}
        onSuccess={() => {
          fetchAllocated(page);
        }}
      />
      <ViewAllocationModal
        isOpen={isOpenViewModal}
        allocationId={selectedAllocatedItem?._id}
        onClose={() => {
          setIsOpenViewModal(false);
          setSelectedAllocatedItem(undefined);
        }}
      />
      <EditAllocationModal
        isOpen={isOpenEditModal}
        allocationId={selectedAllocatedItem?._id}
        onClose={() => {
          setIsOpenEditModal(false);
          setSelectedAllocatedItem(undefined);
        }}
        onSuccess={() => {
          fetchAllocated(page);
        }}
      />
      <DeleteAllocationModal
        isOpen={isOpenDeleteModal}
        selectedAllocatedItem={selectedAllocatedItem}
        onClose={() => {
          setIsOpenDeleteModal(false);
          setSelectedAllocatedItem(undefined);
        }}
        onSuccess={() => {
          fetchAllocated(page);
        }}
      />
    </div>
  );
};

// Layout configuration
AllocatedStockItemsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedAllocatedStockItemsPage = withClinicAuth(
  AllocatedStockItemsPage,
) as NextPageWithLayout;
ProtectedAllocatedStockItemsPage.getLayout = AllocatedStockItemsPage.getLayout;

export default ProtectedAllocatedStockItemsPage;
