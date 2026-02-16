import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { PurchaseRecord } from "@/types/stocks";
import debounce from "lodash.debounce";
import AddPurchaseRequestModal from "./_components/AddPurchaseRequestModal";
import DeletePurchaseRequestModal from "./_components/DeletePurchaseRequestModal";
import EditPurchaseRequestModal from "./_components/EditPurchaseRequestModal";
import PurchaseRequestDetailModal from "./_components/PurchaseRequestDetailModal";
import FilterModal from "./_components/FilterModal";
import { Printer } from "lucide-react";

const PurchaseRequestsPage: NextPageWithLayout = () => {
  const token = getTokenByPath();
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [purchaseRequestToDelete, setPurchaseRequestToDelete] =
    useState<PurchaseRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [purchaseRequestToEdit, setPurchaseRequestToEdit] =
    useState<PurchaseRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [purchaseRequestForDetail, setPurchaseRequestForDetail] =
    useState<PurchaseRecord | null>(null);
  const [pagination, setPagination] = useState({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasMore: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalValue: 0,
    avgValuePerRecord: 0,
    uniqueSuppliersCount: 0,
    uniqueBranchesCount: 0,
    totalItems: 0,
  });

  // Advanced Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterData, setFilterData] = useState({
    branch: "",
    supplier: "",
    orderNo: "",
    fromDate: "",
    toDate: "",
    status: "",
  });

  // Fetch purchase requests with proper error handling
  const fetchPurchaseRequests = useCallback(
    debounce(
      async (page: number = 1, search: string = "", filters: any = {}) => {
        try {
          setLoading(true);

          const token = getTokenByPath();
          // Build query parameters
          const params = new URLSearchParams();
          params.append("page", page.toString());
          params.append("limit", pagination.limit.toString());
          params.append("type", "Purchase_Request");

          if (search) {
            params.append("search", encodeURIComponent(search));
          }

          // Add filter parameters
          if (filters.branch) params.append("branch", filters.branch);
          if (filters.supplier) params.append("supplier", filters.supplier);
          if (filters.orderNo) params.append("orderNo", filters.orderNo);
          if (filters.fromDate) params.append("fromDate", filters.fromDate);
          if (filters.toDate) params.append("toDate", filters.toDate);
          if (filters.status) params.append("status", filters.status);

          const response = await axios.get(
            `/api/stocks/purchase-records?${params.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (response.data?.success) {
            setPurchaseRequests(response.data?.data?.records || []);
            setPagination((prev) => ({
              ...prev,
              ...response.data.data?.pagination,
            }));
            setStats(
              response.data?.data?.statistics || {
                totalRecords: 0,
                totalValue: 0,
                avgValuePerRecord: 0,
                uniqueSuppliersCount: 0,
                uniqueBranchesCount: 0,
                totalItems: 0,
              },
            );
          }
        } catch (error) {
          console.error("Error fetching purchase requests:", error);
          // Show empty state on error
          setPurchaseRequests([]);
        } finally {
          setLoading(false);
        }
      },
      300,
    ),
    [pagination.limit],
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchPurchaseRequests(1, "", filterData);
  }, []);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      fetchPurchaseRequests(page, searchTerm, filterData);
    },
    [fetchPurchaseRequests, searchTerm, filterData],
  );

  useEffect(() => {
    fetchPurchaseRequests(1, searchTerm, filterData);
  }, [searchTerm, filterData]);

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

  // Toggle row expansion for showing items
  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Use sample data if API is not working
  const displayData = purchaseRequests.length > 0 ? purchaseRequests : [];

  const handleAddPurchaseRequest = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((purchaseRequest: PurchaseRecord) => {
    setPurchaseRequestToDelete(purchaseRequest);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!purchaseRequestToDelete) return;

    try {
      const token = getTokenByPath();
      setIsDeleting(true);
      const response = await axios.delete(
        `/api/stocks/purchase-records/delete-purchase-record/${purchaseRequestToDelete._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        // Refresh the list
        const updatedPurchaseRequests = purchaseRequests.filter(
          (pr) => pr._id !== purchaseRequestToDelete._id,
        );
        setPurchaseRequests(updatedPurchaseRequests);
        setIsDeleteModalOpen(false);
        setPurchaseRequestToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting purchase request:", error);
      alert("Failed to delete purchase request");
    } finally {
      setIsDeleting(false);
    }
  }, [
    purchaseRequestToDelete,
    fetchPurchaseRequests,
    pagination.currentPage,
    searchTerm,
    filterData,
  ]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteModalOpen(false);
    setPurchaseRequestToDelete(null);
  }, []);

  const handleEditClick = useCallback((purchaseRequest: PurchaseRecord) => {
    setPurchaseRequestToEdit(purchaseRequest);
    setIsEditModalOpen(true);
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditModalOpen(false);
    setPurchaseRequestToEdit(null);
  }, []);

  const handleDetailClick = useCallback((purchaseRequest: PurchaseRecord) => {
    setPurchaseRequestForDetail(purchaseRequest);
    setIsDetailModalOpen(true);
  }, []);

  const handleDetailCancel = useCallback(() => {
    setIsDetailModalOpen(false);
    setPurchaseRequestForDetail(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Purchase Requests
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                Manage your purchase requests and procurement workflow
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                onClick={() => setIsFilterOpen(true)}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Advanced Filter
              </button>
              <button
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                onClick={handleAddPurchaseRequest}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Purchase Request
              </button>
            </div>

            {/* Add Purchase Request Modal */}
            <AddPurchaseRequestModal
              token={token || ""}
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onSuccess={(purchaseRequestData: PurchaseRecord) => {
                setPurchaseRequests((prev) => [...prev, purchaseRequestData]);
                fetchPurchaseRequests(
                  pagination.currentPage,
                  searchTerm,
                  filterData,
                );
              }}
            />

            {/* Delete Purchase Request Modal */}
            <DeletePurchaseRequestModal
              isOpen={isDeleteModalOpen}
              onClose={handleDeleteCancel}
              onConfirm={handleDeleteConfirm}
              purchaseRequestName={purchaseRequestToDelete?.orderNo}
              loading={isDeleting}
            />

            {/* Edit Purchase Request Modal */}
            <EditPurchaseRequestModal
              token={token || ""}
              isOpen={isEditModalOpen}
              onClose={handleEditCancel}
              purchaseRequestData={purchaseRequestToEdit}
              onSuccess={(purchaseRequestData) => {
                const updatedPurchaseRequests = purchaseRequests.map((pr) =>
                  pr._id === purchaseRequestData._id ? purchaseRequestData : pr,
                );
                setPurchaseRequests(updatedPurchaseRequests);
                fetchPurchaseRequests(
                  pagination.currentPage,
                  searchTerm,
                  filterData,
                );
              }}
            />

            {/* Purchase Request Detail Modal */}
            <PurchaseRequestDetailModal
              isOpen={isDetailModalOpen}
              onClose={handleDetailCancel}
              purchaseRequest={purchaseRequestForDetail}
            />

            {/* Filter Modal */}
            <FilterModal
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              onApply={(filters) => {
                fetchPurchaseRequests(1, searchTerm, filters);
              }}
              filterData={filterData}
              setFilterData={setFilterData}
              title="Advanced Filter - Purchase Requests"
            />
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Purchase Requests Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">PR</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Requests
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.totalRecords || displayData.length}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Active purchase requests
              </div>
            </div>
          </div>

          {/* Suppliers Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Suppliers
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.uniqueSuppliersCount || "0"}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">Unique suppliers</div>
            </div>
          </div>

          {/* Branches Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
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
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Branches
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.uniqueBranchesCount || "0"}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">Active branches</div>
            </div>
          </div>

          {/* Total Items Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
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
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Items
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.totalItems?.toLocaleString() || "0"}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">Items requested</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Data Table Section */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Purchase Requests
              </h2>
              <div className="relative">
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
                  placeholder="Search by order number, supplier or items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-gray-500 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <p className="text-gray-600">Loading purchase requests...</p>
            </div>
          ) : displayData.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No purchase requests found
              </h3>
              <p className="text-gray-500 mb-6">
                Get started by adding your first purchase request.
              </p>
              <button
                onClick={handleAddPurchaseRequest}
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add First Request
              </button>
            </div>
          ) : (
            /* Data Table */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items Count
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayData.map((request, index: number) => (
                    <React.Fragment key={request._id}>
                      <tr className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {request.orderNo.charAt(
                                  request.orderNo.length - 2,
                                )}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {request.orderNo}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {request._id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.supplier?.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.branch?.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.items.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          AED{" "}
                          {request.items
                            .reduce((sum, item) => sum + item.totalPrice, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              {
                                New: "bg-blue-100 text-blue-800",
                                Approved: "bg-green-100 text-green-800",
                                Partly_Delivered:
                                  "bg-yellow-100 text-yellow-800",
                                Delivered: "bg-teal-100 text-teal-800",
                                Partly_Invoiced:
                                  "bg-orange-100 text-orange-800",
                                Invoiced: "bg-emerald-100 text-emerald-800",
                                Rejected: "bg-red-100 text-red-800",
                                Cancelled: "bg-gray-100 text-gray-800",
                                Deleted: "bg-gray-100 text-gray-800",
                                Converted_To_PO:
                                  "bg-purple-100 text-purple-800",
                              }[
                                request.status as
                                  | "New"
                                  | "Approved"
                                  | "Partly_Delivered"
                                  | "Delivered"
                                  | "Partly_Invoiced"
                                  | "Invoiced"
                                  | "Rejected"
                                  | "Cancelled"
                                  | "Deleted"
                                  | "Converted_To_PO"
                              ] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full mr-2 ${
                                {
                                  New: "bg-blue-500",
                                  Approved: "bg-green-500",
                                  Partly_Delivered: "bg-yellow-500",
                                  Delivered: "bg-teal-500",
                                  Partly_Invoiced: "bg-orange-500",
                                  Invoiced: "bg-emerald-500",
                                  Rejected: "bg-red-500",
                                  Cancelled: "bg-gray-500",
                                  Deleted: "bg-gray-500",
                                  Converted_To_PO: "bg-purple-500",
                                }[
                                  request.status as
                                    | "New"
                                    | "Approved"
                                    | "Partly_Delivered"
                                    | "Delivered"
                                    | "Partly_Invoiced"
                                    | "Invoiced"
                                    | "Rejected"
                                    | "Cancelled"
                                    | "Deleted"
                                    | "Converted_To_PO"
                                ] || "bg-gray-500"
                              }`}
                            />
                            {request.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => {
                                // Toggle dropdown menu for this request
                                const currentMenuState = document
                                  .getElementById(`menu-${request._id}`)
                                  ?.classList.contains("block");
                                // Close all other menus
                                document
                                  .querySelectorAll("[id^=menu-]")
                                  .forEach((el) => {
                                    if (el.id !== `menu-${request._id}`) {
                                      el.classList.remove("block");
                                      el.classList.add("hidden");
                                    }
                                  });
                                // Toggle current menu
                                const menuEl = document.getElementById(
                                  `menu-${request._id}`,
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
                              id={`menu-${request._id}`}
                              className={`hidden absolute ${
                                index >= displayData?.length - 2
                                  ? "bottom-0 right-0"
                                  : "right-0"
                              } z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-gray-200 ring-opacity-5 focus:outline-none`}
                            >
                              <div className="py-1" role="none">
                                <button
                                  onClick={() => {
                                    handleEditClick(request);
                                    // Close the dropdown after clicking
                                    const menuEl = document.getElementById(
                                      `menu-${request._id}`,
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
                                    const printUrl = `/clinic/stocks/purchase-requests/print-purchase-request?purId=${request?._id}`;
                                    window.open(
                                      printUrl,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                    // Close the dropdown after clicking
                                    const menuEl = document.getElementById(
                                      `menu-${request?._id}`,
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
                                    handleDetailClick(request);
                                    // Close the dropdown after clicking
                                    const menuEl = document.getElementById(
                                      `menu-${request._id}`,
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
                                    Detail
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    toggleRowExpansion(request._id);
                                    // Close the dropdown after clicking
                                    const menuEl = document.getElementById(
                                      `menu-${request._id}`,
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
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                    {expandedRows[request._id]
                                      ? "Hide Items"
                                      : "Show Items"}
                                  </div>
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteClick(request);
                                    // Close the dropdown after clicking
                                    const menuEl = document.getElementById(
                                      `menu-${request._id}`,
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
                      {expandedRows[request._id] && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200"
                          >
                            <div className="ml-8 mr-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900 flex items-center">
                                  <svg
                                    className="w-5 h-5 text-blue-600 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                    />
                                  </svg>
                                  Items in Request #{request.orderNo}
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
                                    <span>{request.items.length} items</span>
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
                                      {request.items
                                        .reduce(
                                          (sum, item) => sum + item.totalPrice,
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
                                          <div className="flex items-center">
                                            <svg
                                              className="w-4 h-4 mr-2 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                              />
                                            </svg>
                                            Item Name
                                          </div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          <div className="flex items-center">
                                            <svg
                                              className="w-4 h-4 mr-2 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                              />
                                            </svg>
                                            Description
                                          </div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          <div className="flex items-center">
                                            <svg
                                              className="w-4 h-4 mr-2 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                              />
                                            </svg>
                                            Quantity
                                          </div>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                          <div className="flex items-center">
                                            <svg
                                              className="w-4 h-4 mr-2 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                                              />
                                            </svg>
                                            UOM
                                          </div>
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {request.items.map((item, itemIndex) => (
                                        <tr
                                          key={itemIndex}
                                          className="hover:bg-blue-50 transition-colors duration-150"
                                        >
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">
                                                  {item.name.charAt(0)}
                                                </span>
                                              </div>
                                              <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">
                                                  {item.name}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="text-sm text-gray-600 max-w-xs truncate">
                                              {item.description || (
                                                <span className="text-gray-400 italic">
                                                  No description
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {item.quantity}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                              {item.uom || "N/A"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
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
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            pageNum === pagination.currentPage
                              ? "bg-blue-600 text-white"
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
                  className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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

// Layout configuration
PurchaseRequestsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedPurchaseRequestsPage = withClinicAuth(
  PurchaseRequestsPage,
) as NextPageWithLayout;
ProtectedPurchaseRequestsPage.getLayout = PurchaseRequestsPage.getLayout;

export default ProtectedPurchaseRequestsPage;
