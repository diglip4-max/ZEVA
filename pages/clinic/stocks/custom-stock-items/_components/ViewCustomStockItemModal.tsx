import React from "react";
import { X, Eye, Package, DollarSign, Percent, TrendingUp } from "lucide-react";
import { CustomStockItem as CustomStockItemType } from "../../../../../types/stocks";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface ViewCustomStockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: CustomStockItemType;
  currency?: string;
}

const ViewCustomStockItemModal: React.FC<ViewCustomStockItemModalProps> = ({
  isOpen,
  onClose,
  item,
  currency = "INR",
}) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                View Custom Stock Item
              </h2>
              <p className="text-gray-300 text-xs sm:text-sm mt-1">
                {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm uppercase tracking-wide">
                <Package className="w-4 h-4" />
                <span>Basic Information</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Name
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {item.name}
                  </span>
                </div>

                {item.code && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500 font-medium">
                      Code
                    </span>
                    <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                      {item.code}
                    </span>
                  </div>
                )}

                {item.description && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500 font-medium">
                      Description
                    </span>
                    <span className="text-sm text-gray-900 text-right max-w-[60%] break-words">
                      {item.description}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Status
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      {
                        New: "bg-blue-100 text-blue-800",
                        Allocated: "bg-green-100 text-green-800",
                        Expired: "bg-red-100 text-red-800",
                      }[item?.status as "New" | "Allocated" | "Expired"] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                        {
                          New: "bg-blue-500",
                          Allocated: "bg-green-500",
                          Expired: "bg-red-500",
                        }[item?.status as "New" | "Allocated" | "Expired"] ||
                        "bg-gray-500"
                      }`}
                    />
                    {item?.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Quantity
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {item.quantity} {item.uom}
                  </span>
                </div>

                {item.expiryDate && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500 font-medium">
                      Expiry Date
                    </span>
                    <span className="text-sm text-gray-900 text-right max-w-[60%] break-words">
                      {new Date(item.expiryDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm uppercase tracking-wide">
                <DollarSign className="w-4 h-4" />
                <span>Pricing</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Unit Price
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {getCurrencySymbol(currency)} {item.unitPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Total Price
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {getCurrencySymbol(currency)} {item.totalPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Discount ({item.discountType})
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {item.discountType === "Percentage"
                      ? `${item.discount || 0.0}%`
                      : `${getCurrencySymbol(currency)} ${item.discount?.toFixed(2)}`}
                    <span className="text-gray-500 text-xs ml-1">
                      ({getCurrencySymbol(currency)}{" "}
                      {item.discountAmount?.toFixed(2) || "0.00"})
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    Net Price
                  </span>
                  <span className="text-sm font-semibold text-blue-600 text-right max-w-[60%] break-words">
                    {getCurrencySymbol(currency)} {item.netPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500 font-medium">
                    VAT ({item.vatType})
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                    {item.vatPercentage}%{" "}
                    <span className="text-gray-500 text-xs ml-1">
                      ({getCurrencySymbol(currency)}{" "}
                      {item.vatAmount?.toFixed(2) || "0.00"})
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-start pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-700 font-bold">
                    Net + VAT
                  </span>
                  <span className="text-lg font-bold text-green-600 text-right max-w-[60%] break-words">
                    {getCurrencySymbol(currency)}{" "}
                    {item.netPlusVat?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Free Quantity */}
          {item?.freeQuantity && item?.freeQuantity > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm uppercase tracking-wide">
                <Percent className="w-4 h-4" />
                <span>Free Quantity</span>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-yellow-700 font-medium">
                    Free Quantity
                  </span>
                  <span className="text-sm font-semibold text-yellow-900 text-right max-w-[60%] break-words">
                    {item.freeQuantity} {item.uom}
                  </span>
                </div>
                {item.freeQuantityExpiryDate && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-yellow-700 font-medium">
                      Expiry Date
                    </span>
                    <span className="text-sm text-yellow-900 text-right max-w-[60%] break-words">
                      {new Date(item.freeQuantityExpiryDate).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Packaging Structure */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm uppercase tracking-wide">
              <TrendingUp className="w-4 h-4" />
              <span>Packaging Structure</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level 0 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    0
                  </div>
                  <span className="font-semibold text-blue-900">
                    Level 0 (Base)
                  </span>
                </div>
                {item.level0?.uom && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">UOM</span>
                      <span className="font-semibold text-blue-900">
                        {item.level0.uom}
                      </span>
                    </div>
                    {item.level0.price !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Base Price</span>
                        <span className="font-semibold text-blue-900">
                          {getCurrencySymbol(currency)}{" "}
                          {item.level0.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(item.level0 as any)?.salePrice !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Sale Price</span>
                        <span className="font-semibold text-green-600">
                          {getCurrencySymbol(currency)}{" "}
                          {(item.level0 as any)?.salePrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Level 1 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
                    1
                  </div>
                  <span className="font-semibold text-green-900">Level 1</span>
                </div>
                {item.packagingStructure?.level1?.uom && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Quantity</span>
                      <span className="font-semibold text-green-900">
                        {item.packagingStructure.level1.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">UOM</span>
                      <span className="font-semibold text-green-900">
                        {item.packagingStructure.level1.uom}
                      </span>
                    </div>
                    {item.packagingStructure.level1.price !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-green-700">Base Price</span>
                        <span className="font-semibold text-green-900">
                          {getCurrencySymbol(currency)}{" "}
                          {item.packagingStructure.level1.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(item.packagingStructure.level1 as any)?.salePrice !==
                      undefined && (
                      <div className="flex justify-between">
                        <span className="text-green-700">Sale Price</span>
                        <span className="font-semibold text-green-600">
                          {getCurrencySymbol(currency)}{" "}
                          {(
                            item.packagingStructure.level1 as any
                          )?.salePrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Level 2 */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    2
                  </div>
                  <span className="font-semibold text-purple-900">Level 2</span>
                </div>
                {item.packagingStructure?.level2?.uom && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Quantity</span>
                      <span className="font-semibold text-purple-900">
                        {item.packagingStructure.level2.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">UOM</span>
                      <span className="font-semibold text-purple-900">
                        {item.packagingStructure.level2.uom}
                      </span>
                    </div>
                    {item.packagingStructure.level2.price !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-purple-700">Base Price</span>
                        <span className="font-semibold text-purple-900">
                          {getCurrencySymbol(currency)}{" "}
                          {item.packagingStructure.level2.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(item.packagingStructure.level2 as any)?.salePrice !==
                      undefined && (
                      <div className="flex justify-between">
                        <span className="text-purple-700">Sale Price</span>
                        <span className="font-semibold text-green-600">
                          {getCurrencySymbol(currency)}{" "}
                          {(
                            item.packagingStructure.level2 as any
                          )?.salePrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500 font-medium">
                  Created At
                </span>
                <span className="text-sm text-gray-900 text-right max-w-[60%] break-words">
                  {new Date(item.createdAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-500 font-medium">
                  Updated At
                </span>
                <span className="text-sm text-gray-900 text-right max-w-[60%] break-words">
                  {new Date(item.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewCustomStockItemModal;
