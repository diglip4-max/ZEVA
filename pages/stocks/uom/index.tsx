import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import AddUomModal from "./_components/AddUomModal";
import DeleteUomModal from "./_components/DeleteUomModal";
import EditUomModal from "./_components/EditUomModal";
import { UOM } from "@/types/stocks";



interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    uoms: UOM[];
    statistics: {
      total: number;
      mainCategory: number;
      subCategory: number;
    };
    pagination: {
      totalResults: number;
      totalPages: number;
      currentPage: number;
      limit: number;
      hasMore: boolean;
    };
  };
}

const UOMPage: NextPageWithLayout = () => {
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [uomToDelete, setUomToDelete] = useState<UOM | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uomToEdit, setUomToEdit] = useState<UOM | null>(null);
  const [pagination, setPagination] = useState({
    totalResults: 120,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasMore: true,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    mainCategory: 0,
    subCategory: 0,
  });

  // Fetch UOMs with proper error handling
  const fetchUOMs = useCallback(
    async (page: number = 1, search: string = "") => {
      try {
        setLoading(true);

        const token = getTokenByPath();
        const response = await axios.get<ApiResponse>(
          `/api/stocks/uom?page=${page}&limit=${pagination.limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data?.success) {
          setUoms(response.data?.data?.uoms || []);
          setPagination((prev) => ({
            ...prev,
            ...response.data.data.pagination,
          }));
          setStats(
            response.data.data.statistics || {
              total: 0,
              mainCategory: 0,
              subCategory: 0,
            },
          );
        }
      } catch (error) {
        console.error("Error fetching UOMs:", error);
        // Show empty state on error
        setUoms([]);
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchUOMs(1);
  }, []);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      fetchUOMs(page, searchTerm);
    },
    [fetchUOMs, searchTerm],
  );

  useEffect(() => {
    fetchUOMs(1, searchTerm);
  }, [searchTerm]);

  const handleAddUom = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleAddUomSubmit = useCallback(
    async (uomData: { name: string; category: string }) => {
      try {
        const token = getTokenByPath();
        const response = await axios.post<ApiResponse>(
          `/api/stocks/uom`,
          {
            name: uomData.name,
            category: uomData.category,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data?.success) {
          // Refresh the list
          fetchUOMs(pagination.currentPage, searchTerm);
          setIsAddModalOpen(false);
        }
      } catch (error) {
        console.error("Error adding UOM:", error);
        alert("Failed to add UOM");
      }
    },
    [fetchUOMs, pagination.currentPage, searchTerm],
  );

  const handleDeleteClick = useCallback((uom: UOM) => {
    setUomToDelete(uom);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!uomToDelete) return;

    try {
      const token = getTokenByPath();
      const response = await axios.delete(
        `/api/stocks/uom/delete-uom/${uomToDelete._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        // Refresh the list
        fetchUOMs(pagination.currentPage, searchTerm);
        setIsDeleteModalOpen(false);
        setUomToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting UOM:", error);
      alert("Failed to delete UOM");
    }
  }, [uomToDelete, fetchUOMs, pagination.currentPage, searchTerm]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteModalOpen(false);
    setUomToDelete(null);
  }, []);

  const handleEditClick = useCallback((uom: UOM) => {
    setUomToEdit(uom);
    setIsEditModalOpen(true);
  }, []);

  const handleEditSubmit = useCallback(
    async (uomData: { name: string; category: string }) => {
      if (!uomToEdit) return;

      try {
        const token = getTokenByPath();
        const response = await axios.put<ApiResponse>(
          `/api/stocks/uom/update-uom/${uomToEdit._id}`,
          {
            name: uomData.name,
            category: uomData.category,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data.success) {
          // Refresh the list
          fetchUOMs(pagination.currentPage, searchTerm);
          setIsEditModalOpen(false);
          setUomToEdit(null);
        }
      } catch (error) {
        console.error("Error updating UOM:", error);
        alert("Failed to update UOM");
      }
    },
    [uomToEdit, fetchUOMs, pagination.currentPage, searchTerm],
  );

  const handleEditCancel = useCallback(() => {
    setIsEditModalOpen(false);
    setUomToEdit(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Units of Measurement
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                Manage measurement units for your inventory items
              </p>
            </div>
            <button
              className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              onClick={handleAddUom}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add UOM
            </button>

            {/* Add UOM Modal */}
            <AddUomModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onAddUom={handleAddUomSubmit}
            />

            {/* Delete UOM Modal */}
            <DeleteUomModal
              isOpen={isDeleteModalOpen}
              onClose={handleDeleteCancel}
              onConfirm={handleDeleteConfirm}
              uomName={uomToDelete?.name}
            />

            {/* Edit UOM Modal */}
            <EditUomModal
              isOpen={isEditModalOpen}
              onClose={handleEditCancel}
              onEditUom={handleEditSubmit}
              uomData={uomToEdit || undefined}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total UOMs Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">U</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total UOMs
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.total}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Active measurement units
              </div>
            </div>
          </div>

          {/* Main Category Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">M</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Main Category
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.mainCategory}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Primary measurement units
              </div>
            </div>
          </div>

          {/* Sub Category Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">S</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Sub Category
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.subCategory}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Secondary measurement units
              </div>
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
                Measurement Units
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
                  placeholder="Search by name..."
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
              <p className="text-gray-600">Loading measurement units...</p>
            </div>
          ) : uoms.length === 0 ? (
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No units found
              </h3>
              <p className="text-gray-500 mb-6">
                Get started by adding your first unit of measurement.
              </p>
              <button
                onClick={handleAddUom}
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add First UOM
              </button>
            </div>
          ) : (
            /* Data Table */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
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
                  {uoms.map((uom) => (
                    <tr
                      key={uom._id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {uom.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {uom.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {uom._id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            {
                              Main: "bg-blue-100 text-blue-800",
                              Sub: "bg-purple-100 text-purple-800",
                            }[uom.category] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {uom.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            {
                              Active: "bg-green-100 text-green-800",
                              Inactive: "bg-red-100 text-red-800",
                              Allocated: "bg-yellow-100 text-yellow-800",
                            }[uom.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full mr-2 ${
                              {
                                Active: "bg-green-500",
                                Inactive: "bg-red-500",
                                Allocated: "bg-yellow-500",
                              }[uom.status] || "bg-gray-500"
                            }`}
                          />
                          {uom.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(uom.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditClick(uom)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(uom)}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${{
                            true: "bg-blue-600 text-white",
                            false:
                              "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                          }}`}
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
UOMPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedUOMPage = withClinicAuth(UOMPage) as NextPageWithLayout;
ProtectedUOMPage.getLayout = UOMPage.getLayout;

export default ProtectedUOMPage;
