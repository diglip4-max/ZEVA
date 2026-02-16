"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { PurchaseRecord } from "@/types/stocks";
import useClinicBranches from "@/hooks/useClinicBranches";
import { getTokenByPath } from "@/lib/helper";
import { PlusCircle, X, ChevronDown, Search } from "lucide-react";

interface EditGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  grnData: PurchaseRecord | null;
  onEditGRN: (grnData: any) => void;
}

const EditGRNModal: React.FC<EditGRNModalProps> = ({
  isOpen,
  onClose,
  grnData,
  onEditGRN,
}) => {
  const { clinicBranches } = useClinicBranches();
  const token = getTokenByPath() || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseRecord[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSearch, setPoSearch] = useState("");
  const poDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    branch: "",
    purchaseOrder: "",
    grnDate: new Date().toISOString().split("T")[0],
    supplierGRN: "",
    supplierGRNDate: new Date().toISOString().split("T")[0],
    notes: "",
    status: "New",
  });

  // Initialize form when grnData changes
  useEffect(() => {
    if (grnData && isOpen) {
      setFormData({
        branch: grnData.branch?._id || grnData.branch || "",
        purchaseOrder: (grnData as any).purchasedOrder?._id || "",
        grnDate:
          (grnData as any).grnDate?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
        supplierGRN: (grnData as any).supplierInvoiceNo || "",
        supplierGRNDate:
          (grnData as any).supplierGrnDate?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
        notes: grnData.notes || "",
        status: (grnData as any).status || "New",
      });
    }
  }, [grnData, isOpen]);

  // Fetch purchase orders when branch changes
  useEffect(() => {
    if (formData.branch) {
      fetchPurchaseOrders();
    } else {
      setPurchaseOrders([]);
    }
  }, [formData.branch]);

  const fetchPurchaseOrders = async () => {
    try {
      setLoadingPOs(true);
      const response = await axios.get("/api/stocks/purchase-records", {
        params: {
          branch: formData.branch,
          type: "Purchase_Order",
          status: "Approved",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setPurchaseOrders(response.data?.data?.records || []);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      setPurchaseOrders([]);
    } finally {
      setLoadingPOs(false);
    }
  };

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        poDropdownRef.current &&
        !poDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPoDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClose = () => {
    setFormData({
      branch: "",
      purchaseOrder: "",
      grnDate: new Date().toISOString().split("T")[0],
      supplierGRN: "",
      supplierGRNDate: new Date().toISOString().split("T")[0],
      notes: "",
      status: "New",
    });
    setPoSearch("");
    setIsPoDropdownOpen(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (
      !formData.branch.trim() ||
      !formData.purchaseOrder.trim() ||
      !formData.supplierGRN.trim()
    ) {
      setError("Branch, Purchase Order, and Supplier GRN are required");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        branch: formData.branch,
        purchasedOrder: formData.purchaseOrder,
        grnDate: formData.grnDate,
        supplierInvoiceNo: formData.supplierGRN,
        supplierGrnDate: formData.supplierGRNDate,
        notes: formData.notes,
        status: formData.status,
      };

      const response = await axios.put(
        `/api/stocks/grns/update-grn/${grnData?._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      onEditGRN(response.data);
      handleClose();
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          "Failed to update GRN. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  console.log({ purchaseOrders, formData });

  if (!isOpen || !grnData) return null;

  const selectedPO = (purchaseOrders || [])?.find(
    (po) => po._id === formData.purchaseOrder,
  );
  const filteredPOs = (purchaseOrders || [])?.filter((po) =>
    po.orderNo?.toLowerCase().includes(poSearch.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Edit GRN
              </h2>
              <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5">
                Update goods receipt note details
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-white hover:bg-white/20 rounded p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Branch */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) =>
                    setFormData({ ...formData, branch: e.target.value })
                  }
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                >
                  <option value="">Select branch</option>
                  {clinicBranches?.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Order */}
              <div className="space-y-2 relative" ref={poDropdownRef}>
                <label className="block text-sm font-bold text-gray-900">
                  Purchase Order <span className="text-red-500">*</span>
                </label>

                <div
                  onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all flex items-center justify-between cursor-pointer bg-white hover:border-gray-400"
                >
                  <span>
                    {formData.purchaseOrder
                      ? selectedPO?.orderNo || "Select PO"
                      : "Select PO"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>

                {isPoDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search POs..."
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                          autoFocus
                        />
                      </div>
                    </div>

                    {loadingPOs && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Loading purchase orders...
                      </div>
                    )}

                    {!loadingPOs && (
                      <>
                        {filteredPOs.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No purchase orders found
                          </div>
                        ) : (
                          <ul className="py-1">
                            {filteredPOs.map((po) => (
                              <li
                                key={po._id}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    purchaseOrder: po._id,
                                  });
                                  setIsPoDropdownOpen(false);
                                  setPoSearch("");
                                }}
                              >
                                <div className="font-medium">{po.orderNo}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* GRN Date */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  GRN Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="grnDate"
                  value={formData.grnDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                />
              </div>

              {/* Supplier GRN */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Supplier GRN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="supplierGRN"
                  placeholder="Enter supplier GRN number"
                  value={formData.supplierGRN}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                />
              </div>

              {/* Supplier GRN Date */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Supplier GRN Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="supplierGRNDate"
                  value={formData.supplierGRNDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 col-span-full">
                <label className="block text-sm font-bold text-gray-900">
                  Notes
                </label>
                <textarea
                  name="notes"
                  placeholder="Enter any additional notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={
              loading ||
              !formData.branch.trim() ||
              !formData.purchaseOrder.trim() ||
              !formData.supplierGRN.trim()
            }
            className="px-4 py-2.5 text-sm font-medium text-white bg-gray-800 border border-transparent rounded-lg hover:bg-gray-900 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Updating...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Update GRN
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditGRNModal;
