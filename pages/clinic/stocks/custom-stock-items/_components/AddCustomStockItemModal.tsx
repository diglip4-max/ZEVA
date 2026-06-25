import React, { useState, useEffect } from "react";
import { PlusCircle, X } from "lucide-react";
import axios from "axios";
import { CustomStockItem as CustomStockItemType } from "../../../../../types/stocks";
import useUoms from "@/hooks/useUoms";

interface AddCustomStockItemModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: CustomStockItemType) => void;
}

interface FormDataValues {
  name: string;
  code?: string;
  description?: string;
  expiryDate?: string;
  quantity: number;
  uom?: string;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  discountType: "Fixed" | "Percentage";
  discountAmount: number;
  netPrice: number;
  vatAmount: number;
  vatType: "Exclusive" | "Inclusive";
  vatPercentage: number;
  netPlusVat: number;
  freeQuantity: number;
  freeQuantityExpiryDate?: string;
  level0: {
    price?: number;
    uom?: string;
  };
  packagingStructure: {
    level1: {
      quantity: number;
      price?: number;
      uom?: string;
    };
    level2: {
      quantity: number;
      price?: number;
      uom?: string;
    };
  };
}

const AddCustomStockItemModal: React.FC<AddCustomStockItemModalProps> = ({
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { uoms, loading: _uomsLoading } = useUoms({ token });
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormDataValues>({
    name: "",
    code: "",
    description: "",
    quantity: 1,
    uom: "",
    unitPrice: 0,
    totalPrice: 0,
    discount: 0,
    discountType: "Fixed",
    discountAmount: 0,
    netPrice: 0,
    vatAmount: 0,
    vatType: "Exclusive",
    vatPercentage: 0,
    netPlusVat: 0,
    freeQuantity: 0,
    level0: {
      price: 0,
      uom: "",
    },
    packagingStructure: {
      level1: {
        quantity: 1,
        price: 0,
        uom: "",
      },
      level2: {
        quantity: 1,
        price: 0,
        uom: "",
      },
    },
  });

  // Calculate totals (Total Price, Discount, VAT)
  const calculateTotals = () => {
    const calculatedTotal = formData.unitPrice * formData.quantity;

    let discountAmount;
    if (formData.discountType === "Percentage") {
      discountAmount = (formData.discount / 100) * calculatedTotal;
    } else {
      discountAmount = formData.discount;
    }

    const netPrice = calculatedTotal - discountAmount;

    let vatAmount;
    if (formData.vatType === "Inclusive") {
      const amountWithoutVat = netPrice / (1 + formData.vatPercentage / 100);
      vatAmount = netPrice - amountWithoutVat;
    } else {
      vatAmount = (formData.vatPercentage / 100) * netPrice;
    }

    const netPlusVat = netPrice + vatAmount;

    setFormData((prev) => ({
      ...prev,
      totalPrice: calculatedTotal,
      discountAmount,
      netPrice,
      vatAmount,
      netPlusVat,
    }));
  };

  // Calculate packaging prices
  const calculatePackagingPrices = () => {
    setFormData((prev) => ({
      ...prev,
      packagingStructure: {
        level1: {
          ...prev.packagingStructure.level1,
          price: prev.level0.price
            ? prev.level0.price / prev.packagingStructure.level1.quantity
            : 0,
        },
        level2: {
          ...prev.packagingStructure.level2,
          price: prev.packagingStructure.level1.price
            ? prev.packagingStructure.level1.price /
              prev.packagingStructure.level2.quantity
            : 0,
        },
      },
    }));
  };

  // Handle input change
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      if (parent === "level0") {
        setFormData((prev) => ({
          ...prev,
          level0: {
            ...prev.level0,
            [child]: type === "number" ? parseFloat(value) || 0 : value,
          },
        }));
      } else if (parent.startsWith("packagingStructure")) {
        const [, level, field] = name.split(".");
        setFormData((prev) => ({
          ...prev,
          packagingStructure: {
            ...prev.packagingStructure,
            [level]: {
              ...prev.packagingStructure[
                level as keyof typeof prev.packagingStructure
              ],
              [field]: type === "number" ? parseFloat(value) || 0 : value,
            },
          },
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "number" ? parseFloat(value) || 0 : value,
        ...(name === "uom" ? { level0: { ...prev.level0, uom: value } } : {}),
        ...(name === "unitPrice"
          ? {
              level0: {
                ...prev.level0,
                price:
                  prev.quantity > 0
                    ? (parseFloat(value) || 0) / prev.quantity
                    : 0,
              },
            }
          : {}),
        ...(name === "quantity"
          ? {
              level0: {
                ...prev.level0,
                price:
                  (parseFloat(value) || 0) > 0
                    ? prev.unitPrice / (parseFloat(value) || 0)
                    : 0,
              },
            }
          : {}),
      }));
    }

    // Recalculate when relevant fields change
    if (
      [
        "unitPrice",
        "quantity",
        "discount",
        "discountType",
        "vatPercentage",
        "vatType",
      ].includes(name)
    ) {
      setTimeout(calculateTotals, 0);
    }

    if (
      [
        "level0.price",
        "packagingStructure.level1.quantity",
        "packagingStructure.level2.quantity",
      ].includes(name)
    ) {
      setTimeout(calculatePackagingPrices, 0);
    }
  };

  // Effect to calculate packaging prices when level0 or level1 changes
  useEffect(() => {
    if (isOpen) {
      calculateTotals();
      calculatePackagingPrices();
    }
  }, [
    formData,
    formData.level0.price,
    formData.packagingStructure.level1.quantity,
    formData.packagingStructure.level2.quantity,
  ]);

  // Handle level1 multiplier/quantity change
  const handleLevel1QuantityChange = (quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      packagingStructure: {
        ...prev.packagingStructure,
        level1: {
          ...prev.packagingStructure.level1,
          quantity,
          price: prev.level0.price ? prev.level0.price / quantity : 0,
        },
      },
    }));
  };

  // Handle level2 multiplier/quantity change
  const handleLevel2QuantityChange = (quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      packagingStructure: {
        ...prev.packagingStructure,
        level2: {
          ...prev.packagingStructure.level2,
          quantity,
          price: prev.packagingStructure.level1.price
            ? prev.packagingStructure.level1.price / quantity
            : 0,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setLoading(true);
      const { data } = await axios.post(
        "/api/stocks/custom-stock-items/add-custom-stock-item",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (data && data?.success) {
        onSuccess(data?.data);
        onClose();
        resetForm();
      }
    } catch (error: any) {
      console.error("Error adding custom stock item:", error?.message || "");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      quantity: 1,
      uom: "",
      unitPrice: 0,
      totalPrice: 0,
      discount: 0,
      discountType: "Fixed",
      discountAmount: 0,
      netPrice: 0,
      vatAmount: 0,
      vatType: "Exclusive",
      vatPercentage: 0,
      netPlusVat: 0,
      freeQuantity: 0,
      level0: {
        price: 0,
        uom: "",
      },
      packagingStructure: {
        level1: {
          quantity: 1,
          price: 0,
          uom: "",
        },
        level2: {
          quantity: 1,
          price: 0,
          uom: "",
        },
      },
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

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
                Add Custom Stock Item
              </h2>
              <p className="text-gray-300 text-[10px] sm:text-xs mt-0.5">
                Add a new custom stock item
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter item name"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Code
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="Enter item code"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter description"
                    rows={2}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    min={today}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="Enter quantity"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Unit of Measure (UOM)
                  </label>
                  <select
                    name="uom"
                    value={formData.uom}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <option value="">Select UOM</option>
                    {uoms.map((uom: any) => (
                      <option key={uom._id} value={uom.name}>
                        {uom.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Pricing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={formData.unitPrice}
                    onChange={handleInputChange}
                    placeholder="Enter unit price"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    required
                    min={0}
                    step={0.01}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Total Price
                  </label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={formData.totalPrice}
                    readOnly
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Discount Type
                  </label>
                  <select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <option value="Fixed">Fixed</option>
                    <option value="Percentage">Percentage</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Discount
                  </label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    placeholder={
                      formData.discountType === "Percentage"
                        ? "Enter percentage"
                        : "Enter amount"
                    }
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    min={0}
                    step={0.01}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    name="discountAmount"
                    value={formData.discountAmount}
                    readOnly
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Net Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="netPrice"
                    value={formData.netPrice}
                    readOnly
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    VAT Type
                  </label>
                  <select
                    name="vatType"
                    value={formData.vatType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    <option value="Exclusive">Exclusive</option>
                    <option value="Inclusive">Inclusive</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    VAT Percentage
                  </label>
                  <input
                    type="number"
                    name="vatPercentage"
                    value={formData.vatPercentage}
                    onChange={handleInputChange}
                    placeholder="Enter VAT percentage"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    min={0}
                    step={0.01}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    VAT Amount
                  </label>
                  <input
                    type="number"
                    name="vatAmount"
                    value={formData.vatAmount}
                    readOnly
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Net + VAT
                  </label>
                  <input
                    type="number"
                    name="netPlusVat"
                    value={formData.netPlusVat}
                    readOnly
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Free Quantity */}
            {/* <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Free Quantity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Free Quantity
                  </label>
                  <input
                    type="number"
                    name="freeQuantity"
                    value={formData.freeQuantity}
                    onChange={handleInputChange}
                    placeholder="Enter free quantity"
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Free Quantity Expiry Date
                  </label>
                  <input
                    type="date"
                    name="freeQuantityExpiryDate"
                    value={formData.freeQuantityExpiryDate}
                    onChange={handleInputChange}
                    min={today}
                    className="w-full px-4 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </div>
              </div>
            </div> */}

            {/* Packaging */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Packaging Structure
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Level 0 */}
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">
                    Level 0 (Base)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-3 border-gray-200 bg-gray-50">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        Price
                      </label>
                      <input
                        type="number"
                        name="level0.price"
                        value={formData.level0.price}
                        onChange={handleInputChange}
                        placeholder="Enter base price"
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={true}
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        UOM
                      </label>
                      <select
                        name="level0.uom"
                        value={formData.level0.uom}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={true}
                      >
                        <option value="">Select UOM</option>
                        {uoms.map((uom: any) => (
                          <option key={uom._id} value={uom.name}>
                            {uom.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Level 1 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">
                    Level 1
                  </h4>
                  <div className="grid grid-cols-1 gap-3 border rounded-lg p-3 border-gray-200 bg-gray-50">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        Quantity
                      </label>
                      <input
                        type="number"
                        name="packagingStructure.level1.quantity"
                        value={formData.packagingStructure.level1.quantity}
                        onChange={(e) =>
                          handleLevel1QuantityChange(
                            parseFloat(e.target.value) || 1,
                          )
                        }
                        placeholder="e.g., 10"
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={loading}
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        Price
                      </label>
                      <input
                        type="number"
                        name="packagingStructure.level1.price"
                        value={formData.packagingStructure.level1.price}
                        readOnly
                        placeholder="Enter level 1 price"
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        UOM
                      </label>
                      <select
                        name="packagingStructure.level1.uom"
                        value={formData.packagingStructure.level1.uom}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={loading}
                      >
                        <option value="">Select UOM</option>
                        {uoms.map((uom: any) => (
                          <option key={uom._id} value={uom.name}>
                            {uom.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Level 2 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">
                    Level 2
                  </h4>
                  <div className="grid grid-cols-1 gap-3 border rounded-lg p-3 border-gray-200 bg-gray-50">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        Quantity
                      </label>
                      <input
                        type="number"
                        name="packagingStructure.level2.quantity"
                        value={formData.packagingStructure.level2.quantity}
                        onChange={(e) =>
                          handleLevel2QuantityChange(
                            parseFloat(e.target.value) || 1,
                          )
                        }
                        placeholder="e.g., 10"
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={loading}
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        Price
                      </label>
                      <input
                        type="number"
                        name="packagingStructure.level2.price"
                        value={formData.packagingStructure.level2.price}
                        readOnly
                        placeholder="Enter level 2 price"
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-gray-100"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-900">
                        UOM
                      </label>
                      <select
                        name="packagingStructure.level2.uom"
                        value={formData.packagingStructure.level2.uom}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={loading}
                      >
                        <option value="">Select UOM</option>
                        {uoms.map((uom: any) => (
                          <option key={uom._id} value={uom.name}>
                            {uom.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-gray-800/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={loading || !formData.name.trim()}
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
                Adding...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Add Item
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomStockItemModal;
