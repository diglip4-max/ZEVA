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
import AddSupplierModal from "./_components/AddSupplierModal";
import DeleteSupplierModal from "./_components/DeleteSupplierModal";
import EditSupplierModal from "./_components/EditSupplierModal";
import OpeningBalanceModal from "./_components/OpeningBalanceModal";
import SupplierDetailModal from "./_components/SupplierDetailModal";
import { Supplier } from "@/types/stocks";
import debounce from "lodash.debounce";
import { CircleDollarSign, Mail, Phone } from "lucide-react";

const SuppliersPage: NextPageWithLayout = () => {
  const token = getTokenByPath();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] =
    useState(false);
  const [supplierForOpeningBalance, setSupplierForOpeningBalance] =
    useState<Supplier | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [supplierForDetail, setSupplierForDetail] = useState<Supplier | null>(
    null,
  );
  const [pagination, setPagination] = useState({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    hasMore: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    avgCreditDays: 0,
    uniqueBranchesCount: 0,
  });

  // Fetch suppliers with proper error handling
  const fetchSuppliers = useCallback(
    debounce(async (page: number = 1, search: string = "") => {
      try {
        setLoading(true);

        const token = getTokenByPath();
        const response = await axios.get(
          `/api/stocks/suppliers?page=${page}&limit=${pagination.limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data?.success) {
          setSuppliers(response.data?.data?.suppliers || []);
          setPagination((prev) => ({
            ...prev,
            ...response.data.data?.pagination,
          }));
          setStats(
            response.data?.data?.statistics || {
              totalSuppliers: 0,
              avgCreditDays: 0,
              uniqueBranchesCount: 0,
            },
          );
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        // Show empty state on error
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [pagination.limit],
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchSuppliers(1);
  }, []);

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      fetchSuppliers(page, searchTerm);
    },
    [fetchSuppliers, searchTerm],
  );

  useEffect(() => {
    fetchSuppliers(1, searchTerm);
  }, [searchTerm]);

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

  const handleAddSupplier = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!supplierToDelete) return;

    try {
      const token = getTokenByPath();
      setIsDeleting(true);
      const response = await axios.delete(
        `/api/stocks/suppliers/delete-supplier/${supplierToDelete._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        // Refresh the list
        const updatedSuppliers = suppliers.filter(
          (supplier) => supplier._id !== supplierToDelete._id,
        );
        setSuppliers(updatedSuppliers);
        setIsDeleteModalOpen(false);
        setSupplierToDelete(null);
        fetchSuppliers(pagination.currentPage, searchTerm);
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
      alert("Failed to delete supplier");
    } finally {
      setIsDeleting(false);
    }
  }, [supplierToDelete, fetchSuppliers, pagination.currentPage, searchTerm]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSupplierToDelete(null);
  }, []);

  const handleEditClick = useCallback((supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsEditModalOpen(true);
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditModalOpen(false);
    setSupplierToEdit(null);
  }, []);

  const handleOpeningBalanceClick = useCallback((supplier: Supplier) => {
    setSupplierForOpeningBalance(supplier);
    setIsOpeningBalanceModalOpen(true);
  }, []);

  const handleOpeningBalanceCancel = useCallback(() => {
    setIsOpeningBalanceModalOpen(false);
    setSupplierForOpeningBalance(null);
  }, []);

  const handleDetailClick = useCallback((supplier: Supplier) => {
    setSupplierForDetail(supplier);
    setIsDetailModalOpen(true);
  }, []);

  const handleDetailCancel = useCallback(() => {
    setIsDetailModalOpen(false);
    setSupplierForDetail(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Suppliers
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                Manage your supplier network and contact information
              </p>
            </div>
            <button
              className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              onClick={handleAddSupplier}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Supplier
            </button>

            {/* Add Supplier Modal */}
            <AddSupplierModal
              token={token || ""}
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onSuccess={(supplierData: Supplier) => {
                setSuppliers((prev) => [...prev, supplierData]);
                fetchSuppliers(pagination.currentPage, searchTerm);
              }}
            />

            {/* Delete Supplier Modal */}
            <DeleteSupplierModal
              isOpen={isDeleteModalOpen}
              onClose={handleDeleteCancel}
              onConfirm={handleDeleteConfirm}
              supplierName={supplierToDelete?.name}
              loading={isDeleting}
            />

            {/* Edit Supplier Modal */}
            <EditSupplierModal
              token={token || ""}
              isOpen={isEditModalOpen}
              onClose={handleEditCancel}
              supplierData={supplierToEdit}
              onSuccess={(supplierData) => {
                const updatedSuppliers = suppliers.map((supplier) =>
                  supplier._id === supplierData._id ? supplierData : supplier,
                );
                setSuppliers(updatedSuppliers);
              }}
            />

            {/* Opening Balance Modal */}
            <OpeningBalanceModal
              isOpen={isOpeningBalanceModalOpen}
              onClose={handleOpeningBalanceCancel}
              supplierId={supplierForOpeningBalance?._id || ""}
              currentBalance={supplierForOpeningBalance?.openingBalance}
              currentType={
                (supplierForOpeningBalance?.openingBalanceType as
                  | "Debit"
                  | "Credit") || "Credit"
              }
              token={token || ""}
              onSuccess={(updatedSupplier) => {
                const updatedSuppliers = suppliers.map((supplier) =>
                  supplier._id === updatedSupplier._id
                    ? updatedSupplier
                    : supplier,
                );
                setSuppliers(updatedSuppliers);
              }}
            />

            {/* Supplier Detail Modal */}
            <SupplierDetailModal
              isOpen={isDetailModalOpen}
              onClose={handleDetailCancel}
              supplier={supplierForDetail}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Suppliers Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">S</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Suppliers
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.totalSuppliers}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Active supplier partnerships
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
                    Avg. Credit Days
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.avgCreditDays}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Average payment terms across suppliers
              </div>
            </div>
          </div>

          {/* Sub Category Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-xl font-bold">U</span>
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Unq. Branches
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.uniqueBranchesCount}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Number of branches with suppliers
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
                Supplier Network
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
                  placeholder="Search by name, mobile or email..."
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
              <p className="text-gray-600">Loading suppliers...</p>
            </div>
          ) : suppliers.length === 0 ? (
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
                No suppliers found
              </h3>
              <p className="text-gray-500 mb-6">
                Get started by adding your first supplier.
              </p>
              <button
                onClick={handleAddSupplier}
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add First Supplier
              </button>
            </div>
          ) : (
            /* Data Table */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mobile/Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opn.Bal
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
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
                  {suppliers.map((supplier, index: number) => (
                    <tr
                      key={supplier._id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {supplier.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {supplier.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {supplier._id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supplier?.code || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supplier.branch?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          {supplier?.mobile && (
                            <a
                              href={`https://wa.me/${supplier.mobile.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm transition-colors border border-blue-200"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="font-medium">
                                {supplier.mobile}
                              </span>
                            </a>
                          )}

                          {supplier?.email && (
                            <a
                              href={`mailto:${supplier.email}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm transition-colors border border-green-200"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span className="font-medium truncate max-w-[180px]">
                                {supplier.email}
                              </span>
                            </a>
                          )}

                          {!supplier?.mobile && !supplier?.email && (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supplier.openingBalance?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {"0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {"0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {"0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            {
                              Active: "bg-green-100 text-green-800",
                              Inactive: "bg-red-100 text-red-800",
                              Allocated: "bg-yellow-100 text-yellow-800",
                            }[
                              supplier.status as
                                | "Active"
                                | "Inactive"
                                | "Allocated"
                            ] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full mr-2 ${
                              {
                                Active: "bg-green-500",
                                Inactive: "bg-red-500",
                                Allocated: "bg-yellow-500",
                              }[
                                supplier.status as
                                  | "Active"
                                  | "Inactive"
                                  | "Allocated"
                              ] || "bg-gray-500"
                            }`}
                          />
                          {supplier.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(supplier.createdAt).toLocaleDateString(
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
                              // Toggle dropdown menu for this supplier
                              const currentMenuState = document
                                .getElementById(`menu-${supplier._id}`)
                                ?.classList.contains("block");
                              // Close all other menus
                              document
                                .querySelectorAll("[id^=menu-]")
                                .forEach((el) => {
                                  if (el.id !== `menu-${supplier._id}`) {
                                    el.classList.remove("block");
                                    el.classList.add("hidden");
                                  }
                                });
                              // Toggle current menu
                              const menuEl = document.getElementById(
                                `menu-${supplier._id}`,
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
                            id={`menu-${supplier._id}`}
                            className={`hidden absolute ${index >= suppliers?.length - 2 ? "bottom-0 right-0" : "right-0"} z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-gray-200 ring-opacity-5 focus:outline-none`}
                          >
                            <div className="py-1" role="none">
                              <button
                                onClick={() => {
                                  handleEditClick(supplier);
                                  // Close the dropdown after clicking
                                  const menuEl = document.getElementById(
                                    `menu-${supplier._id}`,
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
                                  handleDetailClick(supplier);
                                  // Close the dropdown after clicking
                                  const menuEl = document.getElementById(
                                    `menu-${supplier._id}`,
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
                                  handleOpeningBalanceClick(supplier);
                                  // Close the dropdown after clicking
                                  const menuEl = document.getElementById(
                                    `menu-${supplier._id}`,
                                  );
                                  if (menuEl) {
                                    menuEl.classList.remove("block");
                                    menuEl.classList.add("hidden");
                                  }
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <div className="flex items-center">
                                  <CircleDollarSign className="h-4 w-4 mr-2" />
                                  Opening Balance
                                </div>
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteClick(supplier);
                                  // Close the dropdown after clicking
                                  const menuEl = document.getElementById(
                                    `menu-${supplier._id}`,
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
SuppliersPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedSuppliersPage = withClinicAuth(
  SuppliersPage,
) as NextPageWithLayout;
ProtectedSuppliersPage.getLayout = SuppliersPage.getLayout;

export default ProtectedSuppliersPage;
