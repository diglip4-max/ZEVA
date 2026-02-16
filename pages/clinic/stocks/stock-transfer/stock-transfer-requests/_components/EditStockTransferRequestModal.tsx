"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import useClinicBranches from "@/hooks/useClinicBranches";
import { getTokenByPath } from "@/lib/helper";
import { Pencil, X, Plus, Trash2 } from "lucide-react";
import useUoms from "@/hooks/useUoms";
import useStockItems from "@/hooks/useStockItems";
import useAgents from "@/hooks/useAgents";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  onSuccess: (data: any) => void;
}

interface StockTransferItem {
  itemId?: string;
  code?: string;
  name: string;
  description: string;
  quantity: number;
  uom: string;
  product?: string;
  requestedQuantity?: number;
  approvedQuantity?: number;
}

const EditStockTransferRequestModal: React.FC<Props> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const { clinicBranches } = useClinicBranches();
  const { agents } = useAgents({ role: "agent" })?.state || {};
  const { agents: doctors } = useAgents({ role: "doctorStaff" })?.state || {};
  const { stockItems } = useStockItems();
  const token = getTokenByPath() || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestingEmployees = [...(agents || []), ...(doctors || [])];

  // Form state
  const [formData, setFormData] = useState({
    transferType: "Internal",
    requestingBranch: "",
    fromBranch: "",
    requestingEmployee: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    status: "New",
  });

  // Items state
  const [items, setItems] = useState<StockTransferItem[]>([]);

  // Current item being added
  const [currentItem, setCurrentItem] = useState<StockTransferItem>({
    code: "",
    itemId: "",
    name: "",
    description: "",
    quantity: 1,
    uom: "",
    requestedQuantity: 1,
  });

  const { uoms, loading: uomsLoading } = useUoms({
    token,
    branchId: formData.requestingBranch || formData.fromBranch || "",
  });

  useEffect(() => {
    if (record && isOpen) {
      setFormData({
        transferType: record.transferType || "Internal",
        requestingBranch:
          record.requestingBranch?._id || record.requestingBranch || "",
        fromBranch: record.fromBranch?._id || record.fromBranch || "",
        requestingEmployee:
          record.requestingEmployee?._id || record.requestingEmployee || "",
        date: record.date
          ? new Date(record.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        notes: record.notes || "",
        status: record.status || "New",
      });

      // Set items from record
      if (record.items && Array.isArray(record.items)) {
        setItems(
          record.items.map((item: any) => ({
            name: item.name || "",
            description: item.description || "",
            quantity: item.quantity || 0,
            uom: item.uom || "",
            product: item.product || "",
            requestedQuantity: item.requestedQuantity || item.quantity || 0,
            approvedQuantity: item.approvedQuantity || 0,
          })),
        );
      } else {
        setItems([]);
      }

      // Reset current item
      setCurrentItem({
        code: "",
        itemId: "",
        name: "",
        description: "",
        quantity: 1,
        uom: "",
        requestedQuantity: 1,
      });
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleFormChange = (
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

  const handleCurrentItemChange = (
    field: keyof StockTransferItem,
    value: any,
  ) => {
    if (field === "itemId") {
      const item = stockItems.find((i) => i._id === value);
      const selectedUOM = uoms.find((u) => u?.name === item?.level0?.uom);
      if (item) {
        setCurrentItem((prev) => ({
          ...prev,
          code: item.code,
          name: item.name,
          uom: selectedUOM ? selectedUOM.name : "",
        }));
      }
    }
    setCurrentItem((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "quantity" ? { requestedQuantity: value } : {}),
    }));
  };

  const addCurrentItem = () => {
    if (!currentItem.name.trim()) {
      setError("Please select an item");
      return;
    }

    if (!currentItem.quantity || currentItem.quantity <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    if (!currentItem.uom?.trim()) {
      setError("Please select a UOM");
      return;
    }

    setItems([...items, { ...currentItem }]);
    // Reset current item
    setCurrentItem({
      name: "",
      description: "",
      quantity: 1,
      uom: "",
      requestedQuantity: 1,
    });
    setError(null);
  };

  const removeItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    setItems(updatedItems);
  };

  const resetItems = () => {
    setItems([]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (
      (formData?.transferType === "External" && !formData.requestingBranch) ||
      !formData.fromBranch ||
      !formData.date
    ) {
      setError("Requesting branch, from branch, and date are required");
      return;
    }

    if (items.length === 0) {
      setError("At least one item is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.put(
        `/api/stocks/stock-transfer-requests/update/${record._id}`,
        {
          ...formData,
          items: items,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data?.success) {
        onSuccess(res.data.data);
        handleClose();
      } else {
        setError(
          res.data?.message || "Failed to update stock transfer request",
        );
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to update stock transfer request",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setCurrentItem({
      name: "",
      description: "",
      quantity: 1,
      uom: "",
      requestedQuantity: 1,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Edit Stock Transfer Request
              </h2>
              <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5">
                {record?.stockTransferRequestNo}
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
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Transfer Type
                </label>
                <select
                  name="transferType"
                  value={formData.transferType}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  <option value="New">New</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Deleted">Deleted</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                />
              </div>

              {formData?.transferType === "External" && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Requesting Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="requestingBranch"
                    value={formData.requestingBranch}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                  >
                    <option value="">Select Requesting Branch</option>
                    {clinicBranches?.map((branch: any) => (
                      <option key={branch?._id} value={branch?._id}>
                        {branch?.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  From Branch <span className="text-red-500">*</span>
                </label>
                <select
                  name="fromBranch"
                  value={formData.fromBranch}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={loading}
                  required
                >
                  <option value="">Select From Branch</option>
                  {clinicBranches?.map((branch: any) => (
                    <option key={branch?._id} value={branch?._id}>
                      {branch?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Requesting Employee <span className="text-red-500">*</span>
                </label>
                <select
                  name="requestingEmployee"
                  value={formData.requestingEmployee}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select Employee</option>
                  {requestingEmployees?.map((e: any) => (
                    <option key={e?._id} value={e?._id}>
                      {e?.name} ( {e?.email || e?.phone} )
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-900">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                placeholder="Enter any additional notes"
                rows={3}
                className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={loading}
              />
            </div>

            {/* Items Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Transfer Items <span className="text-red-500">*</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Edit items for this transfer request
                  </p>
                </div>
              </div>

              {/* Item Form */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Item Name */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-xs font-bold text-gray-900">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={currentItem.itemId || ""}
                      onChange={(e) =>
                        handleCurrentItemChange("itemId", e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all h-10"
                      disabled={loading}
                      required
                    >
                      <option value="">Select a Item</option>
                      {stockItems.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-xs font-bold text-gray-900">
                      Item Description
                    </label>
                    <input
                      type="text"
                      value={currentItem.description || ""}
                      onChange={(e) =>
                        handleCurrentItemChange("description", e.target.value)
                      }
                      placeholder="Description"
                      className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all h-10"
                      disabled={loading}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-gray-900">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        handleCurrentItemChange(
                          "quantity",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all h-10"
                      placeholder="Qty"
                      disabled={loading}
                      required
                    />
                  </div>

                  {/* UOM */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-gray-900">
                      UOM <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={currentItem.uom || ""}
                      onChange={(e) =>
                        handleCurrentItemChange("uom", e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all h-10"
                      disabled={loading}
                      required
                    >
                      <option value="">Select UOM</option>
                      {uomsLoading ? (
                        <option value="">Loading UOMs...</option>
                      ) : uoms.length > 0 ? (
                        uoms.map((uom: any) => (
                          <option key={uom._id} value={uom.name}>
                            {uom.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No UOMs available</option>
                      )}
                    </select>
                  </div>

                  {/* Add Item Button */}
                  <div className="sm:col-span-12 flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={resetItems}
                      disabled={loading || items.length === 0}
                      className="inline-flex items-center px-3 py-2.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset Items
                    </button>
                    <button
                      type="button"
                      onClick={addCurrentItem}
                      disabled={
                        loading ||
                        !currentItem.name?.trim() ||
                        !currentItem.quantity ||
                        !currentItem.uom?.trim()
                      }
                      className="px-3 py-2.5 border border-transparent text-xs font-medium rounded-lg text-white bg-gray-800 hover:bg-gray-900 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          SI No
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          UOM
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-8 text-sm text-center text-gray-500"
                          >
                            No Items Added
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 font-medium">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.description || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.uom}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-2 text-sm font-bold text-gray-900 text-right"
                          >
                            Total Items:
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-gray-900">
                            {items.reduce(
                              (sum, item) => sum + (item.quantity || 0),
                              0,
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-gray-900">
                            {items.length}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={
              loading ||
              (formData?.transferType === "External" &&
                !formData.requestingBranch) ||
              !formData.fromBranch ||
              items.length === 0
            }
            className="px-4 py-2.5 text-sm font-medium text-white bg-gray-800 border border-transparent rounded-lg hover:bg-gray-900 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 flex items-center gap-2"
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
                Updating...
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                Update Transfer Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditStockTransferRequestModal;
