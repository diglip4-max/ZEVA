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
  EyeIcon,
} from "@heroicons/react/24/outline";
import { CustomStockItem as CustomStockItemType } from "@/types/stocks";
import { Lock, Home, LogOut, Package, DollarSign, Percent } from "lucide-react";
import { useRouter } from "next/router";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import AddCustomStockItemModal from "./_components/AddCustomStockItemModal";
import EditCustomStockItemModal from "./_components/EditCustomStockItemModal";
import DeleteCustomStockItemModal from "./_components/DeleteCustomStockItemModal";
import ViewCustomStockItemModal from "./_components/ViewCustomStockItemModal";

const CustomStockItemsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [customStockItems, setCustomStockItems] = useState<
    CustomStockItemType[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState<CustomStockItemType[]>([]);
  const [pagination, setPagination] = useState({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasMore: false,
  });
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    totalQuantity: 0,
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<
    CustomStockItemType | undefined
  >();
  const [currency, setCurrency] = useState<string>("INR");

  // Permission state (static for now)
  const [permissions, _setPermissions] = useState({
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
  });
  const [permissionsLoaded, _setPermissionsLoaded] = useState(true);

  // Fetch custom stock items
  const fetchCustomStockItems = useCallback(
    async (page: number = 1, search: string = "") => {
      try {
        setLoading(true);
        const token = getTokenByPath();
        const response = await axios.get(
          `/api/stocks/custom-stock-items?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(
            search,
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.data?.success) {
          setCustomStockItems(response.data.data);
          setFilteredItems(response.data.data);
          setPagination((prev) => ({ ...prev, ...response.data.pagination }));
          setStats(
            response.data.stats || {
              totalItems: 0,
              totalValue: 0,
              totalQuantity: 0,
            },
          );
        }
      } catch (error) {
        console.error("Error fetching custom stock items:", error);
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  // Fetch clinic currency preference
  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const token = getTokenByPath();
        if (!token) return;
        const res = await axios.get("/api/clinics/myallClinic", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success && res.data.clinic?.currency) {
          setCurrency("AED");
        }
      } catch (e) {
        console.error("Error fetching clinic currency:", e);
      }
    };
    fetchClinicCurrency();
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchCustomStockItems(1, "");
  }, [fetchCustomStockItems]);

  // Filter items based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredItems(customStockItems);
    } else {
      const filtered = customStockItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.code &&
            item.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.description &&
            item.description.toLowerCase().includes(searchTerm.toLowerCase())),
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, customStockItems]);

  const handleAddSuccess = (newItem: CustomStockItemType) => {
    setCustomStockItems((prev) => [newItem, ...prev]);
    setFilteredItems((prev) => [newItem, ...prev]);
    setStats((prev) => ({
      ...prev,
      totalItems: prev.totalItems + 1,
      totalValue: prev.totalValue + (newItem.netPlusVat || 0),
      totalQuantity: prev.totalQuantity + newItem.quantity,
    }));
  };

  const handleEditSuccess = (updatedItem: CustomStockItemType) => {
    setCustomStockItems((prev) =>
      prev.map((item) => (item._id === updatedItem._id ? updatedItem : item)),
    );
    setFilteredItems((prev) =>
      prev.map((item) => (item._id === updatedItem._id ? updatedItem : item)),
    );
  };

  const handleDeleteConfirm = async () => {
    if (!currentItem?._id) return;

    try {
      setDeleting(true);
      const token = getTokenByPath();
      const response = await axios.delete(
        `/api/stocks/custom-stock-items/delete/${currentItem._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data?.success) {
        setCustomStockItems((prev) =>
          prev.filter((item) => item._id !== currentItem._id),
        );
        setFilteredItems((prev) =>
          prev.filter((item) => item._id !== currentItem._id),
        );
        setIsDeleteModalOpen(false);
        setStats((prev) => ({
          ...prev,
          totalItems: prev.totalItems - 1,
          totalValue: prev.totalValue - (currentItem.netPlusVat || 0),
          totalQuantity: prev.totalQuantity - currentItem.quantity,
        }));
      }
    } catch (error) {
      console.error("Error deleting custom stock item:", error);
    } finally {
      setDeleting(false);
    }
  };

  // Access Denied Component
  const AccessDenied = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 md:p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <Lock className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You don't have permission to view this page. Please contact your
              clinic administrator for access.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push("/clinic/clinic-dashboard")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-all"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  router.push("/");
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-all"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!permissions.canRead && !permissions.canCreate) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="max-w-9xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Custom Stock Items
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                Manage your custom inventory items
              </p>
            </div>
            {permissions.canCreate && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Custom Item
              </button>
            )}
          </div>
        </div>
      </div>

      {permissions.canRead && (
        <>
          {/* Enhanced Stats Cards */}
          <div className="max-w-9xl mx-auto mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Items Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                        <Package className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 flex-1">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Total Items
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {stats.totalItems}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Custom stock items in inventory
                  </div>
                </div>
              </div>

              {/* Total Value Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                        <DollarSign className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 flex-1">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Total Value
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {getCurrencySymbol(currency)}{" "}
                        {stats.totalValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Total value of custom stock
                  </div>
                </div>
              </div>

              {/* Total Quantity Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                        <Percent className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 flex-1">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Total Quantity
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {stats.totalQuantity}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Total units in stock
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Data Table Section */}
          <div className="max-w-9xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Custom Stock Items
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
                      placeholder="Search by name, code or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-600 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  <p className="text-gray-600">Loading custom stock items...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                /* Empty State */
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No custom stock items found
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Get started by adding your first custom stock item.
                  </p>
                  {permissions.canCreate && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                    >
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Add First Item
                    </button>
                  )}
                </div>
              ) : (
                /* Data Table */
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Code
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Net Price
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Value
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
                      {filteredItems.map((item) => (
                        <tr
                          key={item._id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {item.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                    {item.description?.length > 30
                                      ? item.description.slice(0, 30) + "..."
                                      : item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.code || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.quantity} {item.uom}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getCurrencySymbol(currency)}{" "}
                            {item.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getCurrencySymbol(currency)}{" "}
                            {item.netPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {getCurrencySymbol(currency)}{" "}
                            {item.netPlusVat?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                {
                                  New: "bg-blue-100 text-blue-800",
                                  Allocated: "bg-green-100 text-green-800",
                                  Expired: "bg-red-100 text-red-800",
                                }[
                                  item?.status as
                                    | "New"
                                    | "Allocated"
                                    | "Expired"
                                ] || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full mr-2 ${
                                  {
                                    New: "bg-blue-500",
                                    Allocated: "bg-green-500",
                                    Expired: "bg-red-500",
                                  }[
                                    item?.status as
                                      | "New"
                                      | "Allocated"
                                      | "Expired"
                                  ] || "bg-gray-500"
                                }`}
                              />
                              {item?.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setCurrentItem(item);
                                  setIsViewModalOpen(true);
                                }}
                                className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
                                title="View"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </button>
                              {permissions.canUpdate && (
                                <button
                                  onClick={() => {
                                    setCurrentItem(item);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                                  title="Edit"
                                >
                                  <PencilIcon className="h-5 w-5" />
                                </button>
                              )}
                              {permissions.canDelete && (
                                <button
                                  onClick={() => {
                                    setCurrentItem(item);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              )}
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
                    <span className="font-medium">
                      {pagination.totalResults}
                    </span>{" "}
                    results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        fetchCustomStockItems(
                          pagination.currentPage - 1,
                          searchTerm,
                        )
                      }
                      disabled={pagination.currentPage === 1}
                      className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        fetchCustomStockItems(
                          pagination.currentPage + 1,
                          searchTerm,
                        )
                      }
                      disabled={
                        pagination.currentPage === pagination.totalPages
                      }
                      className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Custom Stock Item Modal */}
      <AddCustomStockItemModal
        token={getTokenByPath() || ""}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Custom Stock Item Modal */}
      <EditCustomStockItemModal
        token={getTokenByPath() || ""}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentItem(undefined);
        }}
        onSuccess={handleEditSuccess}
        itemData={currentItem}
      />

      {/* Delete Custom Stock Item Modal */}
      <DeleteCustomStockItemModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCurrentItem(undefined);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.name}
        loading={deleting}
      />

      {/* View Custom Stock Item Modal */}
      <ViewCustomStockItemModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setCurrentItem(undefined);
        }}
        item={currentItem}
        currency={currency}
      />
    </div>
  );
};

// Layout configuration
CustomStockItemsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedCustomStockItemsPage = withClinicAuth(
  CustomStockItemsPage,
) as NextPageWithLayout;
ProtectedCustomStockItemsPage.getLayout = CustomStockItemsPage.getLayout;

export default ProtectedCustomStockItemsPage;
