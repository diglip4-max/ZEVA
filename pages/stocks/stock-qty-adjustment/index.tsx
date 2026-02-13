import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Filter, Printer, Package } from "lucide-react";
import AddAdjustmentModal from "./_components/AddAdjustmentModal";
import EditAdjustmentModal from "./_components/EditAdjustmentModal";
import DeleteAdjustmentModal from "./_components/DeleteAdjustmentModal";
import FilterModal from "./_components/FilterModal";
import AdjustmentDetailModal from "./_components/AdjustmentDetailModal";
import debounce from "lodash.debounce";

const StockQtyAdjustmentPage: NextPageWithLayout = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalItems: 0,
    uniqueBranchesCount: 0,
    totalValue: 0,
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);
  const [recordToDetail, setRecordToDetail] = useState<any | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterData, setFilterData] = useState({
    branch: "",
    fromDate: "",
    toDate: "",
    status: "",
  });

  const fetchRecords = useCallback(
    debounce(async (page = 1, search = "", filters: any = {}) => {
      try {
        setLoading(true);
        const token = getTokenByPath();
        const params = new URLSearchParams();
        params.append("page", String(page));
        params.append("limit", String(pagination.limit || 10));

        if (search) params.append("search", encodeURIComponent(search));
        if (filters.branch) params.append("branch", filters.branch);
        if (filters.status) params.append("status", filters.status);
        if (filters.fromDate) params.append("startDate", filters.fromDate);
        if (filters.toDate) params.append("endDate", filters.toDate);

        const res = await axios.get(
          `/api/stocks/stock-qty-adjustment?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.data?.success) {
          const data = res.data.data || [];
          setRecords(data);
          const pg = res.data.pagination || res.data.data?.pagination || {};
          setPagination((prev) => ({
            ...prev,
            totalResults: pg.total || res.data.pagination?.total || data.length,
            totalPages: pg.totalPages || res.data.pagination?.totalPages || 1,
            currentPage: page,
          }));

          const totalItems =
            data.reduce(
              (sum: number, r: any) => sum + (r.items?.length || 0),
              0,
            ) || 0;

          const totalValue = data.reduce(
            (sum: number, r: any) =>
              sum +
              (r.items?.reduce(
                (itemSum: number, item: any) =>
                  itemSum + (item.totalPrice || 0),
                0,
              ) || 0),
            0,
          );

          setStats({
            totalRecords: pg.total || data.length,
            totalItems,
            uniqueBranchesCount: (res.data.filters?.branches || []).length || 0,
            totalValue,
          });
        } else {
          setRecords([]);
        }
      } catch (err) {
        console.error("Error fetching adjustments:", err);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [pagination.limit],
  );

  useEffect(() => {
    fetchRecords(1, "", filterData);
  }, []);

  useEffect(() => {
    fetchRecords(1, searchTerm, filterData);
  }, [searchTerm, filterData, fetchRecords]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menus = document.querySelectorAll("[id^=menu-]");
      menus.forEach((menu) => {
        if (
          menu instanceof HTMLElement &&
          !menu.contains(event.target as Node)
        ) {
          menu.classList.remove("block");
          menu.classList.add("hidden");
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const displayData = records;

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= pagination.totalPages) {
        fetchRecords(newPage, searchTerm, filterData);
      }
    },
    [fetchRecords, searchTerm, filterData, pagination.totalPages],
  );

  const handleAdd = () => {
    setIsAddOpen(true);
  };

  const handleEdit = (record: any) => {
    setRecordToEdit(record);
    setIsEditOpen(true);
  };

  const handleDelete = (record: any) => {
    setRecordToDelete(record);
    setIsDeleteOpen(true);
  };

  const handleDetail = (record: any) => {
    setRecordToDetail(record);
    setIsDetailOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete?._id) return;
    try {
      setIsDeleting(true);
      const token = getTokenByPath();
      const res = await axios.delete(
        `/api/stocks/stock-qty-adjustment/delete/${recordToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.success) {
        setIsDeleteOpen(false);
        setRecordToDelete(null);
        fetchRecords(pagination.currentPage, searchTerm, filterData);
      }
    } catch (err) {
      console.error("Error deleting adjustment:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleRowExpansion = (recordId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "Deleted":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-500";
      case "Completed":
        return "bg-green-500";
      case "Cancelled":
        return "bg-red-500";
      case "Deleted":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Stock Quantity Adjustments
            </h1>
            <p className="text-indigo-100 mt-2">
              Track and manage stock quantity adjustments
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFilterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors border border-white/30"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              New Adjustment
            </button>

            {/* Add Adjustment Modal */}
            <AddAdjustmentModal
              isOpen={isAddOpen}
              onClose={() => setIsAddOpen(false)}
              onSuccess={() =>
                fetchRecords(pagination.currentPage, searchTerm, filterData)
              }
            />

            {/* Edit Adjustment Modal */}
            <EditAdjustmentModal
              isOpen={isEditOpen}
              onClose={() => {
                setIsEditOpen(false);
                setRecordToEdit(null);
              }}
              record={recordToEdit}
              onSuccess={() =>
                fetchRecords(pagination.currentPage, searchTerm, filterData)
              }
            />

            {/* Delete Adjustment Modal */}
            <DeleteAdjustmentModal
              isOpen={isDeleteOpen}
              onClose={() => {
                setIsDeleteOpen(false);
                setRecordToDelete(null);
              }}
              onConfirm={handleDeleteConfirm}
              adjustmentNo={
                recordToDelete?.adjustmentNo ||
                `ADJ-${recordToDelete?._id?.slice(-6)}`
              }
              loading={isDeleting}
            />

            {/* Adjustment Detail Modal */}
            <AdjustmentDetailModal
              isOpen={isDetailOpen}
              onClose={() => {
                setIsDetailOpen(false);
                setRecordToDetail(null);
              }}
              record={recordToDetail}
            />
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(filters) => {
          setFilterData(filters);
          fetchRecords(1, searchTerm, filters);
        }}
        filterData={filterData}
        setFilterData={setFilterData}
        title="Filter Stock Adjustments"
      />

      {/* Enhanced Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8 px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Adjustments Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-white text-xl font-bold">SQA</span>
              </div>
              <div className="ml-5">
                <div className="text-sm font-medium text-gray-500 uppercase">
                  Total Adjustments
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.totalRecords || displayData.length}
                </div>
              </div>
            </div>
          </div>

          {/* Total Items Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5">
                <div className="text-sm font-medium text-gray-500 uppercase">
                  Total Items
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.totalItems?.toLocaleString() || "0"}
                </div>
              </div>
            </div>
          </div>

          {/* Branches Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"
                  />
                </svg>
              </div>
              <div className="ml-5">
                <div className="text-sm font-medium text-gray-500 uppercase">
                  Branches
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.uniqueBranchesCount || "0"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Data Table Section */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Stock Quantity Adjustments
            </h2>
            <div className="relative w-full md:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by adjustment number, post a/c or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-gray-500 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20"
              />
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
              <p className="text-gray-600">Loading stock adjustments...</p>
            </div>
          ) : displayData.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No adjustments found
              </h3>
              <p className="text-gray-500 mb-6">
                Get started by creating your first stock quantity adjustment.
              </p>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2.5 rounded-xl"
              >
                <PlusIcon className="h-5 w-5" /> Create Adjustment
              </button>
            </div>
          ) : (
            /* Data Table */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adjustment No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Post A/c
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayData.map((record: any, index: number) => (
                    <React.Fragment key={record._id}>
                      <tr className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {(
                                  record.adjustmentNo ||
                                  `SQA-${record._id.slice(-6)}`
                                )
                                  .toString()
                                  .slice(-2)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {record.adjustmentNo ||
                                  `SQA-${record._id.slice(-6)}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {record._id?.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(
                            record.date || record.createdAt,
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.branch?.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.postAc || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                            {record.items?.length || 0} items
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          AED{" "}
                          {record.items
                            ?.reduce(
                              (sum: number, item: any) =>
                                sum + (item.totalPrice || 0),
                              0,
                            )
                            .toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                              record.status || "New",
                            )}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full mr-2 ${getStatusDotColor(
                                record.status || "New",
                              )}`}
                            />
                            {record.status || "New"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                const currentMenuState = document
                                  .getElementById(`menu-${record._id}`)
                                  ?.classList.contains("block");
                                document
                                  .querySelectorAll("[id^=menu-]")
                                  .forEach((el) => {
                                    if (el.id !== `menu-${record._id}`) {
                                      el.classList.remove("block");
                                      el.classList.add("hidden");
                                    }
                                  });
                                const menuEl = document.getElementById(
                                  `menu-${record._id}`,
                                );
                                if (menuEl) {
                                  if (currentMenuState) {
                                    menuEl.classList.remove("block");
                                    menuEl.classList.add("hidden");
                                  } else {
                                    menuEl.classList.remove("hidden");
                                    menuEl.classList.add("block");
                                  }
                                }
                              }}
                              className="text-gray-500 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
                              title="More options"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>
                            <div
                              id={`menu-${record._id}`}
                              className={`hidden absolute ${
                                index >= displayData?.length - 2
                                  ? "bottom-0 right-0"
                                  : "right-0"
                              } z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-gray-200 ring-opacity-5 focus:outline-none`}
                            >
                              <div className="py-1" role="none">
                                <button
                                  onClick={() => {
                                    handleEdit(record);
                                    const menuEl = document.getElementById(
                                      `menu-${record._id}`,
                                    );
                                    if (menuEl) {
                                      menuEl.classList.remove("block");
                                      menuEl.classList.add("hidden");
                                    }
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <div className="flex items-center">
                                    <PencilIcon className="h-4 w-4 mr-2" />
                                    Edit
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    // Open print page in new tab
                                    const printUrl = `/stocks/adjustments/print/${record._id}`;
                                    window.open(
                                      printUrl,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                    const menuEl = document.getElementById(
                                      `menu-${record._id}`,
                                    );
                                    if (menuEl) {
                                      menuEl.classList.remove("block");
                                      menuEl.classList.add("hidden");
                                    }
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <div className="flex items-center">
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    handleDetail(record);
                                    const menuEl = document.getElementById(
                                      `menu-${record._id}`,
                                    );
                                    if (menuEl) {
                                      menuEl.classList.remove("block");
                                      menuEl.classList.add("hidden");
                                    }
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <div className="flex items-center">
                                    <svg
                                      className="h-4 w-4 mr-2"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    Details
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    toggleRowExpansion(record._id);
                                    const menuEl = document.getElementById(
                                      `menu-${record._id}`,
                                    );
                                    if (menuEl) {
                                      menuEl.classList.remove("block");
                                      menuEl.classList.add("hidden");
                                    }
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <div className="flex items-center">
                                    <svg
                                      className="h-4 w-4 mr-2"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                    {expandedRows[record._id]
                                      ? "Hide Items"
                                      : "Show Items"}
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(record);
                                    const menuEl = document.getElementById(
                                      `menu-${record._id}`,
                                    );
                                    if (menuEl) {
                                      menuEl.classList.remove("block");
                                      menuEl.classList.add("hidden");
                                    }
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                >
                                  <div className="flex items-center">
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row for items */}
                      {expandedRows[record._id] && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200"
                          >
                            <div className="ml-8 mr-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900 flex items-center">
                                  <svg
                                    className="w-5 h-5 text-indigo-600 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                  </svg>
                                  Items in Adjustment #
                                  {record.adjustmentNo ||
                                    `SQA-${record._id.slice(-6)}`}
                                </h4>
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                  <div className="flex items-center">
                                    <svg
                                      className="w-4 h-4 mr-1 text-gray-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                      />
                                    </svg>
                                    <span>
                                      {record.items?.length || 0} items
                                    </span>
                                  </div>
                                  <div className="flex items-center">
                                    <svg
                                      className="w-4 h-4 mr-1 text-gray-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span>
                                      AED{" "}
                                      {record.items
                                        ?.reduce(
                                          (sum: number, item: any) =>
                                            sum + (item.totalPrice || 0),
                                          0,
                                        )
                                        .toFixed(2)}{" "}
                                      total
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Item
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Code
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Qty
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          UOM
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Expiry
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Cost Price
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {record.items?.map(
                                        (item: any, itemIndex: number) => (
                                          <tr
                                            key={itemIndex}
                                            className="hover:bg-indigo-50 transition-colors duration-150"
                                          >
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                                                  <span className="text-white text-xs font-bold">
                                                    {item.name?.charAt(0) ||
                                                      "?"}
                                                  </span>
                                                </div>
                                                <div className="ml-3">
                                                  <div className="text-sm font-medium text-gray-900">
                                                    {item.name || "N/A"}
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    {item.description ||
                                                      "No description"}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                              {item.code || "-"}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                {item.quantity || 0}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                              {item.uom || "N/A"}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                              {item.expiryDate
                                                ? new Date(
                                                    item.expiryDate,
                                                  ).toLocaleDateString()
                                                : "-"}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                              AED{" "}
                                              {(item.costPrice || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-bold">
                                              AED{" "}
                                              {(item.totalPrice || 0).toFixed(
                                                2,
                                              )}
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="px-4 py-3 text-sm font-medium text-gray-700 text-right"
                                        >
                                          Adjustment Total:
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                          AED{" "}
                                          {record.items
                                            ?.reduce(
                                              (sum: number, item: any) =>
                                                sum + (item.totalPrice || 0),
                                              0,
                                            )
                                            .toFixed(2)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
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
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">
                Showing{" "}
                <span className="font-medium">
                  {(pagination.currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(
                    pagination.currentPage * pagination.limit,
                    pagination.totalResults,
                  )}
                </span>{" "}
                of{" "}
                <span className="font-medium">{pagination.totalResults}</span>{" "}
                results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex space-x-1">
                  {[...Array(Math.min(5, pagination.totalPages))].map(
                    (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${
                            pageNum === pagination.currentPage
                              ? "bg-indigo-600 text-white"
                              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

StockQtyAdjustmentPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedStockQtyAdjustmentPage = withClinicAuth(
  StockQtyAdjustmentPage,
) as NextPageWithLayout;
ProtectedStockQtyAdjustmentPage.getLayout = StockQtyAdjustmentPage.getLayout;

export default ProtectedStockQtyAdjustmentPage;
