import React, { useState, useEffect, useRef } from "react";
import { PlusCircle, X, Search, ChevronDown } from "lucide-react";
import useClinicBranches from "@/hooks/useClinicBranches";
import useSuppliers from "@/hooks/useSuppliers";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";

interface AddPurchaseInvoiceModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

const AddPurchaseInvoiceModal: React.FC<AddPurchaseInvoiceModalProps> = ({
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { clinicBranches } = useClinicBranches();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    branch: "",
    supplier: "",
    supplierInvoiceNo: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    status: "New",
  });

  const [grns, setGrns] = useState<any[]>([]);
  const [selectedGrns, setSelectedGrns] = useState<string[]>([]);
  const [grnLoading, setGrnLoading] = useState(false);
  const [showEntries, setShowEntries] = useState("100");

  const { suppliers, loading: suppliersLoading } = useSuppliers({
    search: supplierSearch,
    branchId: formData.branch,
  });

  // Fetch GRNs when branch changes
  useEffect(() => {
    const fetchGrns = async () => {
      try {
        if (!formData.branch) {
          setGrns([]);
          return;
        }
        setGrnLoading(true);
        const t = getTokenByPath();
        const params = new URLSearchParams();
        params.append("page", "1");
        params.append("limit", showEntries);
        params.append("branch", formData.branch);
        const res = await axios.get(`/api/stocks/grns?${params.toString()}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.data?.success) {
          setGrns(res.data?.data?.records || []);
        } else {
          setGrns([]);
        }
      } catch {
        setGrns([]);
      } finally {
        setGrnLoading(false);
      }
    };

    if (formData.branch) {
      fetchGrns();
    }
  }, [formData.branch, showEntries]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSupplierDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleSelectGrn = (grnId: string) => {
    setSelectedGrns((prev) => {
      if (prev.includes(grnId)) {
        return prev.filter((id) => id !== grnId);
      } else {
        return [...prev, grnId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedGrns.length === grns.length) {
      setSelectedGrns([]);
    } else {
      setSelectedGrns(grns.map((g) => g._id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.branch.trim() ||
      !formData.supplier.trim() ||
      selectedGrns.length === 0
    ) {
      setError("Please select branch, supplier and at least one GRN");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        branch: formData.branch,
        supplier: formData.supplier,
        grn: selectedGrns[0],
        grns: selectedGrns,
        supplierInvoiceNo: formData.supplierInvoiceNo,
        date: formData.date,
        notes: formData.notes,
        status: formData.status,
      };

      const response = await fetch(`/api/stocks/purchase-invoices/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(result.data);
        handleClose();
      } else {
        setError(result.message || "Failed to add purchase invoice");
      }
    } catch (err) {
      console.error("Error adding purchase invoice:", err);
      setError("An error occurred while adding the purchase invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      branch: "",
      supplier: "",
      supplierInvoiceNo: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      status: "New",
    });
    setSelectedGrns([]);
    setSupplierSearch("");
    setIsSupplierDropdownOpen(false);
    setGrns([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Add Purchase Invoice
              </h2>
              <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5">
                Required fields are marked with *
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
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Fields - 2 Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-5">
                {/* Branch */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.branch}
                    onChange={(e) =>
                      setFormData({ ...formData, branch: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                  >
                    <option value="">Select branch</option>
                    {clinicBranches?.map((item) => (
                      <option key={item?._id} value={item?._id}>
                        {item?.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier - Searchable Select */}
                <div className="space-y-1.5 relative" ref={supplierDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-800">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div
                      className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all flex items-center justify-between cursor-pointer bg-white"
                      onClick={() =>
                        !loading &&
                        setIsSupplierDropdownOpen(!isSupplierDropdownOpen)
                      }
                    >
                      <span
                        className={
                          formData.supplier ? "text-gray-900" : "text-gray-400"
                        }
                      >
                        {suppliers?.find(
                          (supplier) => supplier._id === formData.supplier,
                        )?.name || "Select a supplier"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform ${
                          isSupplierDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>

                    {isSupplierDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search suppliers..."
                              value={supplierSearch}
                              onChange={(e) =>
                                setSupplierSearch(e.target.value)
                              }
                              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                              autoFocus
                            />
                          </div>
                        </div>

                        {suppliersLoading && (
                          <div className="p-4 text-center text-gray-500">
                            <div className="inline-flex items-center">
                              <svg
                                className="animate-spin h-4 w-4 mr-2 text-gray-500"
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
                              Loading suppliers...
                            </div>
                          </div>
                        )}

                        {!suppliersLoading && (
                          <>
                            {suppliers.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                {supplierSearch
                                  ? "No suppliers found"
                                  : "No suppliers available"}
                              </div>
                            ) : (
                              <ul className="py-1">
                                {suppliers.map((supplier) => (
                                  <li
                                    key={supplier._id}
                                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        supplier: supplier._id,
                                      });
                                      setIsSupplierDropdownOpen(false);
                                      setSupplierSearch("");
                                    }}
                                  >
                                    <div className="font-medium">
                                      {supplier.name}
                                    </div>
                                    {supplier.mobile && (
                                      <div className="text-xs text-gray-500">
                                        {supplier.mobile}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Supplier Invoice */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">
                    Supplier Invoice <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="supplierInvoiceNo"
                    value={formData.supplierInvoiceNo}
                    onChange={handleInputChange}
                    placeholder="Enter supplier invoice number"
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Enter Notes"
                    rows={4}
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* GRN Selection Table */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-800">
                  Select GRNs <span className="text-red-500">*</span>
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Show</span>
                  <select
                    value={showEntries}
                    onChange={(e) => setShowEntries(e.target.value)}
                    className="px-2 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                    disabled={!formData.branch || grnLoading}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <span className="text-sm text-gray-600">entries</span>
                </div>
              </div>

              {!formData.branch ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  Please select a branch to view GRNs
                </div>
              ) : grnLoading ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="inline-flex items-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-gray-500"
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
                    Loading GRNs...
                  </div>
                </div>
              ) : grns.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  No GRNs found for this branch
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={
                                selectedGrns.length === grns.length &&
                                grns.length > 0
                              }
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 text-gray-800 focus:ring-gray-800/20"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            GRN No
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Order No
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Disc
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Net
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            VAT
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {grns.map((grn) => (
                          <tr
                            key={grn._id}
                            className={`hover:bg-gray-50 cursor-pointer ${
                              selectedGrns.includes(grn._id)
                                ? "bg-blue-50/50"
                                : ""
                            }`}
                            onClick={() => toggleSelectGrn(grn._id)}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedGrns.includes(grn._id)}
                                onChange={() => toggleSelectGrn(grn._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-gray-300 text-gray-800 focus:ring-gray-800/20"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {grn.grnNo || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.date
                                ? new Date(grn.date).toLocaleDateString("en-GB")
                                : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.purchaseOrder?.poNo || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.total?.toFixed(2) || "0.00"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.discount?.toFixed(2) || "0.00"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.net?.toFixed(2) || "0.00"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grn.vat?.toFixed(2) || "0.00"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  grn.status === "Completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {grn.status || "New"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Showing 1 to {grns.length} of {grns.length} entries
                      {selectedGrns.length > 0 && (
                        <span className="ml-2 font-medium text-gray-900">
                          ({selectedGrns.length} selected)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={
              loading ||
              !formData.branch.trim() ||
              !formData.supplier.trim() ||
              !formData.supplierInvoiceNo.trim() ||
              !formData.date.trim() ||
              selectedGrns.length === 0
            }
            className="px-5 py-2.5 text-sm font-medium text-white bg-gray-800 border border-transparent rounded-lg hover:bg-gray-900 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Adding...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPurchaseInvoiceModal;
