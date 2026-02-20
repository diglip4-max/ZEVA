"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { PurchaseRecord, PurchaseRecordItem } from "@/types/stocks";
import useClinicBranches from "@/hooks/useClinicBranches";
import { getTokenByPath } from "@/lib/helper";
import { PlusCircle, X } from "lucide-react";
import useUoms from "@/hooks/useUoms";

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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseRecord[]>([]);

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
  const [items, setItems] = useState<PurchaseRecordItem[]>([]);
  const { uoms } = useUoms({ token, branchId: formData.branch });

  console.log({ grnData, formData });

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
      const inItems = (grnData as any)?.items || [];
      setItems(
        (inItems || []).map((it: any) => ({
          _id: it._id,
          itemId: it.itemId,
          code: it.code,
          name: it.name,
          description: it.description || "",
          expiryDate: it.expiryDate
            ? new Date(it.expiryDate).toISOString().split("T")[0]
            : "",
          quantity: it.quantity || 0,
          uom: it.uom || "",
          unitPrice: it.unitPrice || 0,
          totalPrice: it.totalPrice || (it.quantity || 0) * (it.unitPrice || 0),
          discount: it.discount || 0,
          discountType: it.discountType || "Fixed",
          discountAmount:
            it.discountAmount ||
            (it.discountType === "Percentage"
              ? ((it.quantity || 0) *
                  (it.unitPrice || 0) *
                  (it.discount || 0)) /
                100
              : it.discount || 0),
          netPrice:
            it.netPrice ||
            (it.quantity || 0) * (it.unitPrice || 0) -
              (it.discountAmount ||
                (it.discountType === "Percentage"
                  ? ((it.quantity || 0) *
                      (it.unitPrice || 0) *
                      (it.discount || 0)) /
                    100
                  : it.discount || 0)),
          vatAmount: it.vatAmount || 0,
          vatType: it.vatType || "Exclusive",
          vatPercentage: it.vatPercentage || 0,
          netPlusVat:
            it.netPlusVat ||
            (it.netPrice ||
              (it.quantity || 0) * (it.unitPrice || 0) -
                (it.discountAmount ||
                  (it.discountType === "Percentage"
                    ? ((it.quantity || 0) *
                        (it.unitPrice || 0) *
                        (it.discount || 0)) /
                      100
                    : it.discount || 0))) + (it.vatAmount || 0),
          freeQuantity: it.freeQuantity || 0,
        })),
      );
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
      const response = await axios.get("/api/stocks/purchase-records", {
        params: {
          branch: formData.branch,
          type: "Purchase_Order",
          limit: 1000,
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
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const recalcItem = (item: PurchaseRecordItem): PurchaseRecordItem => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unitPrice) || 0;
    const total = parseFloat((qty * unit).toFixed(2));
    const discVal =
      (item.discountType || "Fixed") === "Percentage"
        ? parseFloat(
            ((qty * unit * (Number(item.discount) || 0)) / 100).toFixed(2),
          )
        : Number(item.discount) || 0;
    const net = parseFloat((total - discVal).toFixed(2));
    const vatPct = Number(item.vatPercentage) || 0;
    const vatAmt =
      (item.vatType || "Exclusive") === "Exclusive"
        ? parseFloat(((net * vatPct) / 100).toFixed(2))
        : Number(item.vatAmount) || 0;
    const netVat = parseFloat((net + (vatAmt || 0)).toFixed(2));
    return {
      ...item,
      totalPrice: total,
      discountAmount: discVal,
      netPrice: net,
      vatAmount: vatAmt,
      netPlusVat: netVat,
    };
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseRecordItem,
    value: any,
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const parsed =
        field === "quantity" ||
        field === "unitPrice" ||
        field === "discount" ||
        field === "vatPercentage" ||
        field === "freeQuantity"
          ? parseFloat(value) || 0
          : value;
      next[index] = recalcItem({ ...next[index], [field]: parsed });
      return next;
    });
  };

  // const removeItem = (index: number) => {
  //   setItems((prev) => prev.filter((_, i) => i !== index));
  // };

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
    setError(null);
    setItems([]);
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
        items: items.map((it) => ({
          itemId: it.itemId,
          code: it.code,
          name: it.name,
          description: it.description,
          expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
          quantity: it.quantity,
          uom: it.uom,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          discount: it.discount,
          discountType: it.discountType,
          discountAmount: it.discountAmount,
          netPrice: it.netPrice,
          vatAmount: it.vatAmount,
          vatType: it.vatType,
          vatPercentage: it.vatPercentage,
          netPlusVat: it.netPlusVat,
          freeQuantity: it.freeQuantity,
        })),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-8xl overflow-hidden flex flex-col max-h-[90vh]">
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
              {/* <div className="space-y-2">
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
              </div> */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Branch
                </label>
                <div className="w-full text-sm text-gray-600">
                  {clinicBranches?.find(
                    (branch) => branch._id === formData.branch,
                  )?.name || "Select branch"}
                </div>
              </div>

              {/* Purchase Order */}
              {/* <div className="space-y-2 relative" ref={poDropdownRef}>
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
              </div> */}

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">
                  Purchase Order
                </label>
                <div className="w-full text-sm text-gray-600">
                  {selectedPO?.orderNo || "-"}
                </div>
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

            <div className="border border-gray-200 text-gray-500 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Exp. Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        U.Price
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        D.Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Disc
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        VAT%
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        R.Qty
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        UOM
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Free Qty
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        NET
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        VAT
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Net+VAT
                      </th>
                      {/* <th className="px-3 py-2 text-right text-xs font-bold text-white uppercase tracking-wider">
                        Edit
                      </th> */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-3 py-2">
                          <div className="font-medium text-sm text-gray-900">
                            {item.code}
                          </div>
                          <div className="text-xs text-gray-600 uppercase">
                            {item.name}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.expiryDate || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "expiryDate",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleItemChange(idx, "unitPrice", e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.discountType || "Fixed"}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "discountType",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value="Fixed">Fixed</option>
                            <option value="Percentage">Percentage</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.discount || 0}
                            onChange={(e) =>
                              handleItemChange(idx, "discount", e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.vatPercentage || 0}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "vatPercentage",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, "quantity", e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.uom || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "uom", e.target.value)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value="">Select UOM</option>
                            {uoms?.map((u: any) => (
                              <option key={u._id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.freeQuantity || 0}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "freeQuantity",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.netPrice?.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.vatAmount?.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">
                          {item.netPlusVat?.toFixed(2)}
                        </td>
                        {/* <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
