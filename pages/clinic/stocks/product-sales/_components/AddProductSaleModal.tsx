import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import {
  Plus,
  Minus,
  Search,
  User,
  X,
  CheckCircle2,
  CreditCard,
  Package,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-hot-toast";
import usePaymentMethod from "@/hooks/usePaymentMethod";

// Types
interface QuantityByUom {
  uom: string;
  quantity: number;
}

interface AllocatedStockItem {
  _id: string;
  item: {
    itemId?: string;
    customStockItemId?: string;
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    uom?: string;
    unitPrice: number;
    totalPrice: number;
    discount?: number;
    discountType?: string;
    discountAmount?: number;
    netPrice: number;
    vatAmount?: number;
    vatType?: string;
    vatPercentage?: number;
    netPlusVat?: number;
    freeQuantity?: number;
    freeQuantityExpiryDate?: string;
    level0: { price: number; uom: string; salePrice: number };
    packagingStructure: {
      level1: { price: number; uom: string; salePrice: number };
      level2: { price: number; uom: string; salePrice: number };
    };
  };
  quantity: number;
  user?: { name: string };
  location?: { name: string };
  status: string;
  expiryDate?: string;
  quantitiesByUom?: QuantityByUom[];
  allocatedBy?: { name: string };
  createdAt: string;
}

interface CartItem {
  itemId: string;
  uom: string;
  quantity: number;
  customPrice?: number;
}

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  mobileNumber?: string;
  email?: string;
  age?: number;
  gender?: string;
}

interface Transaction {
  invoiceId: string;
  patient: string;
  date: string;
  items: {
    name: string;
    qty: number;
    uom: string;
  }[];
  total: string;
  paymentMethod?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Helper functions
const initials = (name: string): string => {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const formatExpiryDate = (dateString?: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface AddProductSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddProductSaleModal: React.FC<AddProductSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [_clinicLoading, setClinicLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    string | null
  >(null);
  const [isPaymentMethodDropdownOpen, setIsPaymentMethodDropdownOpen] =
    useState(false);
  const [paymentMethodSearchTerm, setPaymentMethodSearchTerm] = useState("");
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null);

  // Allocated stock items state
  const [items, setItems] = useState<AllocatedStockItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Payment methods state
  const {
    paymentMethods,
    loading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = usePaymentMethod();

  // Patient search state
  const [patientSearchPhone, setPatientSearchPhone] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>(
    [],
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentSaleData, setCurrentSaleData] = useState<any>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCart([]);
      setSelectedPatient(null);
      setSearch("");
      setSelectedPaymentMethod(null);
      setShowConfirmModal(false);
      setShowReceiptModal(false);
      setTransaction(null);
    }
  }, [isOpen]);

  // Fetch clinic ID
  const fetchClinicId = useCallback(async () => {
    try {
      setClinicLoading(true);
      const token = getTokenByPath();
      const response = await axios.get("/api/clinics/myallClinic", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data?.success && response.data?.clinic?._id) {
        setClinicId(response.data.clinic._id);
      }
    } catch (error) {
      console.error("Error fetching clinic ID:", error);
    } finally {
      setClinicLoading(false);
    }
  }, []);

  // Fetch allocated stock items
  const fetchItems = useCallback(
    async (pageNum: number = 1, searchTerm: string = "") => {
      if (!clinicId) return;

      try {
        setItemsLoading(true);
        const token = getTokenByPath();
        const response = await axios.get(
          "/api/stocks/allocated-stock-items/options",
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              page: pageNum,
              limit: pagination.limit,
              search: searchTerm,
            },
          },
        );

        if (response.data?.success) {
          const itemsData = response.data.records || [];
          const filteredItems = itemsData?.filter((f: AllocatedStockItem) => {
            let findItemWithZero = f.quantitiesByUom?.find(
              (q) => q.quantity === 0,
            );
            return !findItemWithZero;
          });
          setItems(filteredItems);
          setPagination({
            page: response.data.currentPage,
            limit: response.data.limit,
            total: response.data.totalRecords,
            totalPages: response.data.totalPages,
          });
        }
      } catch (error) {
        console.error("Error fetching allocated items:", error);
        toast.error("Failed to load items");
      } finally {
        setItemsLoading(false);
      }
    },
    [clinicId, pagination.limit],
  );

  // Patient search handler with debounce
  useEffect(() => {
    if (patientSearchPhone.length < 2) {
      setPatientSearchResults([]);
      setShowPatientDropdown(false);
      return;
    }

    if (!clinicId) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingPatient(true);
      try {
        const response = await axios.get(
          `/api/appointment-booking/search-patient?search=${encodeURIComponent(patientSearchPhone)}&clinicId=${clinicId}&limit=10`,
        );
        if (response.data?.success && Array.isArray(response.data?.data)) {
          setPatientSearchResults(response.data.data);
          setShowPatientDropdown(true);
        } else {
          setPatientSearchResults([]);
          setShowPatientDropdown(false);
        }
      } catch (error) {
        console.error("Error searching patients:", error);
        setPatientSearchResults([]);
        setShowPatientDropdown(false);
      } finally {
        setIsSearchingPatient(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [patientSearchPhone, clinicId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        patientSearchRef.current &&
        !patientSearchRef.current.contains(event.target as Node)
      ) {
        setShowPatientDropdown(false);
      }
      if (
        paymentMethodDropdownRef.current &&
        !paymentMethodDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPaymentMethodDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initial data fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchClinicId();
    }
  }, [isOpen, fetchClinicId]);

  // Fetch items when clinicId is available
  useEffect(() => {
    if (clinicId && isOpen) {
      fetchItems(1, search);
    }
  }, [clinicId, isOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clinicId && isOpen) {
        fetchItems(1, search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, clinicId, fetchItems, isOpen]);

  // Handle patient selection
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchPhone("");
    setPatientSearchResults([]);
    setShowPatientDropdown(false);
  };

  // Clear patient selection
  const clearPatientSelection = () => {
    setSelectedPatient(null);
    setPatientSearchPhone("");
  };

  // Helper to get cart item
  const getCartItem = (itemId: string, uom: string) => {
    return cart.find((ci) => ci.itemId === itemId && ci.uom === uom);
  };

  // Helper to check if item has any UOM selected
  const hasAnyUomSelected = (itemId: string) => {
    return cart.some((ci) => ci.itemId === itemId);
  };

  // Helper to get selected UOM for item
  const getSelectedUomForItem = (itemId: string) => {
    const cartItem = cart.find((ci) => ci.itemId === itemId);
    return cartItem?.uom || null;
  };

  const getProductPricesPerUnit = (id: string, uom: string) => {
    const allocatedItem = items.find((i) => i._id === id);
    if (!allocatedItem) return { costPrice: 0, salePrice: 0 };
    if (allocatedItem.item.level0?.uom === uom)
      return {
        costPrice: allocatedItem.item.level0.price,
        salePrice:
          allocatedItem.item.level0.salePrice > 0
            ? allocatedItem.item.level0.salePrice
            : allocatedItem.item.level0.price,
      };
    if (allocatedItem.item.packagingStructure?.level1?.uom === uom)
      return {
        costPrice: allocatedItem.item.packagingStructure?.level1?.price || 0,
        salePrice:
          allocatedItem.item.packagingStructure?.level1?.salePrice > 0
            ? allocatedItem.item.packagingStructure?.level1?.salePrice
            : allocatedItem.item.packagingStructure?.level1?.price || 0,
      };
    if (allocatedItem.item.packagingStructure?.level2?.uom === uom)
      return {
        costPrice: allocatedItem.item.packagingStructure?.level2?.price || 0,
        salePrice:
          allocatedItem.item.packagingStructure?.level2?.salePrice > 0
            ? allocatedItem.item.packagingStructure?.level2?.salePrice
            : allocatedItem.item.packagingStructure?.level2?.price || 0,
      };
    return { costPrice: 0, salePrice: 0 };
  };

  // Derived values
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  const cartItems = useMemo(() => {
    return cart
      .map((cartItem) => {
        const item = items.find((i) => i._id === cartItem.itemId);
        const prices = getProductPricesPerUnit(cartItem.itemId, cartItem.uom);
        if (!item) return null;

        const effectivePrice = cartItem.customPrice || prices.salePrice;
        const commission =
          Math.max(0, effectivePrice - prices.salePrice) * cartItem.quantity;

        return { item, cartItem, prices, effectivePrice, commission };
      })
      .filter(Boolean) as {
      item: AllocatedStockItem;
      cartItem: CartItem;
      prices: { costPrice: number; salePrice: number };
      effectivePrice: number;
      commission: number;
    }[];
  }, [cart, items]);

  const subtotal = cartItems.reduce(
    (sum, entry) => sum + entry.effectivePrice * entry.cartItem.quantity,
    0,
  );

  const totalCommission = cartItems.reduce(
    (sum, entry) => sum + entry.commission,
    0,
  );

  const total = subtotal;
  const canCheckout =
    cartCount > 0 && selectedPatient && selectedPaymentMethod && !processing;

  // Handlers
  const updateCart = (itemId: string, uom: string, delta: number) => {
    setCart((prev) => {
      const stockItem = items.find((i) => i._id === itemId);
      if (!stockItem) return prev;

      const uomData = stockItem.quantitiesByUom?.find((q) => q.uom === uom);
      if (!uomData) return prev;

      // Calculate total already in cart for this UOM
      const existingCartItem = getCartItem(itemId, uom);
      const currentQty = existingCartItem?.quantity || 0;
      const nextQty = Math.max(0, currentQty + delta);

      if (nextQty > uomData.quantity) {
        toast.error(`Only ${uomData.quantity} ${uom} available`);
        return prev;
      }

      if (nextQty === 0) {
        return prev.filter((ci) => !(ci.itemId === itemId && ci.uom === uom));
      }

      // Remove any other UOM for this item first
      const filteredPrev = prev.filter(
        (ci) => !(ci.itemId === itemId && ci.uom !== uom),
      );

      // Update or add
      const existingIndex = filteredPrev.findIndex(
        (ci) => ci.itemId === itemId && ci.uom === uom,
      );
      if (existingIndex >= 0) {
        const newCart = [...filteredPrev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: nextQty,
        };
        return newCart;
      } else {
        return [...filteredPrev, { itemId, uom, quantity: nextQty }];
      }
    });
  };

  const updateCustomPrice = (itemId: string, uom: string, price: number) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.itemId === itemId && ci.uom === uom,
      );
      if (existingIndex >= 0) {
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          customPrice: price,
        };
        return newCart;
      }
      return prev;
    });
  };

  const removeFromCart = (itemId: string, uom: string) => {
    setCart((prev) =>
      prev.filter((ci) => !(ci.itemId === itemId && ci.uom === uom)),
    );
  };

  const handleCheckout = async () => {
    if (!canCheckout) return;

    // Prepare sale data for confirmation
    const saleData = {
      patient: selectedPatient,
      paymentMethod: paymentMethods.find(
        (m) => m._id === selectedPaymentMethod,
      ),
      items: cartItems,
      subtotal,
      total,
    };

    setCurrentSaleData(saleData);
    setShowConfirmModal(true);
  };

  const confirmAndPlaceSale = async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    try {
      const token = getTokenByPath();

      // Prepare API request body
      const apiItems = cartItems.map((entry) => ({
        allocatedItemId: entry.item._id,
        name: entry.item.item.name,
        code: entry.item.item.code || "",
        description: entry.item.item.description || "",
        uom: entry.cartItem.uom,
        quantity: entry.cartItem.quantity,
        currency: "AED",
        unitPrice: entry.effectivePrice,
        totalPrice: entry.effectivePrice * entry.cartItem.quantity,
        commission: entry.commission,
      }));

      const response = await axios.post(
        "/api/stocks/product-sales",
        {
          patientId: selectedPatient!._id,
          paymentMethodId: selectedPaymentMethod!,
          items: apiItems,
          status: "completed",
          paymentStatus: "paid",
          totalCommission: totalCommission,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        const sale = response.data.data;

        const transactionItems = cartItems.map((entry) => ({
          name: entry.item.item.name,
          qty: entry.cartItem.quantity,
          uom: entry.cartItem.uom,
        }));

        const newTransaction: Transaction = {
          invoiceId: sale._id,
          patient: `${selectedPatient!.firstName} ${selectedPatient!.lastName}`,
          date: new Date(sale.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          items: transactionItems,
          total: total.toFixed(2),
          paymentMethod: paymentMethods.find(
            (m) => m._id === selectedPaymentMethod,
          )?.name,
        };

        setTransaction(newTransaction);
        setCart([]);
        setSelectedPatient(null);
        setSelectedPaymentMethod(null);
        setShowReceiptModal(true);
        toast.success("Transaction completed successfully!");

        // Refresh the allocated items list
        fetchItems(1, search);

        // Call onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      toast.error("Transaction failed. Please try again.");
      console.error("Checkout error:", error);
    } finally {
      setProcessing(false);
    }
  };

  // Close receipt modal and parent modal
  const closeReceiptAndModal = () => {
    setShowReceiptModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Product Sales & Dispensing
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Select products, adjust quantities, and finalize billing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Main Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(95vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Selection */}
            <div className="lg:col-span-2 space-y-6">
              {/* Search */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by item name or code..."
                      className="w-full pl-10 pr-4 py-3 text-sm text-gray-700 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Product List */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-600" />
                    Products
                  </h2>

                  {itemsLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-800"></div>
                    </div>
                  ) : items.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {items.map((stockItem) => {
                          const hasQuantitiesByUom =
                            stockItem.quantitiesByUom &&
                            stockItem.quantitiesByUom.length > 0;

                          return (
                            <div
                              key={stockItem._id}
                              className="p-4 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-gray-50 transition-all"
                            >
                              {/* Item Info */}
                              <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-xl text-teal-700">
                                  📦
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                                    {stockItem.item.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                                    {stockItem.item.code && (
                                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                                        {stockItem.item.code}
                                      </span>
                                    )}
                                    {stockItem.expiryDate && (
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${(() => {
                                          const expiry = new Date(
                                            stockItem.expiryDate,
                                          );
                                          const now = new Date();
                                          const daysUntilExpiry = Math.ceil(
                                            (expiry.getTime() - now.getTime()) /
                                              (1000 * 60 * 60 * 24),
                                          );
                                          if (daysUntilExpiry <= 30) {
                                            return "bg-red-100 text-red-800";
                                          } else if (daysUntilExpiry <= 60) {
                                            return "bg-amber-100 text-amber-800";
                                          }
                                          return "bg-green-100 text-green-800";
                                        })()}`}
                                      >
                                        📅 Expires:{" "}
                                        {formatExpiryDate(stockItem.expiryDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* UOM & Quantity Controls */}
                              {hasQuantitiesByUom ? (
                                <div className="space-y-3">
                                  {stockItem.quantitiesByUom!.map(
                                    (qtyByUom) => {
                                      const cartItem = getCartItem(
                                        stockItem._id,
                                        qtyByUom.uom,
                                      );
                                      const qty = cartItem?.quantity || 0;
                                      const isInCart = qty > 0;
                                      const itemHasUomSelected =
                                        hasAnyUomSelected(stockItem._id);
                                      const selectedUom = getSelectedUomForItem(
                                        stockItem._id,
                                      );
                                      const isThisUomSelected =
                                        selectedUom === qtyByUom.uom;
                                      const isDisabled =
                                        itemHasUomSelected &&
                                        !isThisUomSelected;
                                      const prices = getProductPricesPerUnit(
                                        stockItem._id,
                                        qtyByUom.uom,
                                      );

                                      return (
                                        <div
                                          key={qtyByUom.uom}
                                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                            isDisabled
                                              ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                              : isInCart
                                                ? "border-teal-500 bg-teal-50"
                                                : "border-gray-200 hover:border-teal-200 hover:bg-teal-50/50"
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-semibold text-gray-900">
                                                {qtyByUom.uom}
                                              </span>
                                              <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${
                                                  qtyByUom.quantity < 20
                                                    ? "bg-amber-100 text-amber-800"
                                                    : "bg-teal-100 text-teal-800"
                                                }`}
                                              >
                                                {qtyByUom.quantity} available
                                              </span>
                                            </div>
                                            <div className="text-sm font-semibold text-teal-600">
                                              AED {prices.salePrice.toFixed(2)}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                            <button
                                              onClick={() =>
                                                updateCart(
                                                  stockItem._id,
                                                  qtyByUom.uom,
                                                  -1,
                                                )
                                              }
                                              disabled={!isInCart || isDisabled}
                                              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                                isInCart && !isDisabled
                                                  ? "text-gray-700 hover:bg-gray-200 hover:text-red-600"
                                                  : "text-gray-300 cursor-not-allowed"
                                              }`}
                                            >
                                              <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-10 text-center text-sm font-medium text-gray-900">
                                              {qty}
                                            </span>
                                            <button
                                              onClick={() =>
                                                updateCart(
                                                  stockItem._id,
                                                  qtyByUom.uom,
                                                  1,
                                                )
                                              }
                                              disabled={
                                                qty >= qtyByUom.quantity ||
                                                isDisabled
                                              }
                                              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                                qty >= qtyByUom.quantity ||
                                                isDisabled
                                                  ? "text-gray-300 cursor-not-allowed"
                                                  : "text-gray-700 hover:bg-gray-200 hover:text-teal-600"
                                              }`}
                                            >
                                              <Plus className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No quantities available by UOM
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-500">
                            Showing{" "}
                            {(pagination.page - 1) * pagination.limit + 1} to{" "}
                            {Math.min(
                              pagination.page * pagination.limit,
                              pagination.total,
                            )}{" "}
                            of {pagination.total} items
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newPage = Math.max(
                                  1,
                                  pagination.page - 1,
                                );
                                setPagination((prev) => ({
                                  ...prev,
                                  page: newPage,
                                }));
                                fetchItems(newPage, search);
                              }}
                              disabled={pagination.page <= 1}
                              className="px-3 py-1 text-sm text-gray-500 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-700">
                              Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                              onClick={() => {
                                const newPage = Math.min(
                                  pagination.totalPages,
                                  pagination.page + 1,
                                );
                                setPagination((prev) => ({
                                  ...prev,
                                  page: newPage,
                                }));
                                fetchItems(newPage, search);
                              }}
                              disabled={
                                pagination.page >= pagination.totalPages
                              }
                              className="px-3 py-1 text-sm text-gray-500 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        No items found
                      </h3>
                      <p className="text-gray-500">
                        Try a different search term
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Cart & Checkout */}
            <div className="lg:col-span-1 space-y-6">
              {/* Patient Selection */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Patient
                    </h3>
                  </div>

                  {selectedPatient ? (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white text-xs font-bold">
                          {initials(
                            `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {selectedPatient.firstName}{" "}
                            {selectedPatient.lastName}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {selectedPatient.phone ||
                              selectedPatient.mobileNumber}
                            {selectedPatient.age &&
                              ` • Age ${selectedPatient.age}`}
                          </div>
                        </div>
                        <button
                          onClick={clearPatientSelection}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" ref={patientSearchRef}>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={patientSearchPhone}
                          onChange={(e) =>
                            setPatientSearchPhone(e.target.value)
                          }
                          placeholder="Search patient by name or phone..."
                          className="w-full flex items-center justify-between px-4 py-3 pl-10 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                        />
                        {isSearchingPatient && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600" />
                          </div>
                        )}
                      </div>

                      {showPatientDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden">
                          {patientSearchResults.length > 0 ? (
                            patientSearchResults.map((patient) => (
                              <button
                                key={patient._id}
                                onClick={() => handlePatientSelect(patient)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-teal-50 transition-all border-t border-gray-100 first:border-t-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-xs font-bold">
                                  {initials(
                                    `${patient.firstName} ${patient.lastName}`,
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {patient.firstName} {patient.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {patient.phone || patient.mobileNumber}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500">
                              No patients found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Payment Method
                    </h3>
                  </div>

                  {paymentMethodsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                    </div>
                  ) : paymentMethodsError ? (
                    <div className="text-center py-8 text-sm text-red-500">
                      Failed to load payment methods
                    </div>
                  ) : (
                    <div
                      className="space-y-3 relative"
                      ref={paymentMethodDropdownRef}
                    >
                      <div
                        onClick={() =>
                          setIsPaymentMethodDropdownOpen(
                            !isPaymentMethodDropdownOpen,
                          )
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center justify-between cursor-pointer hover:border-teal-400 focus:border-teal-400 transition-all"
                      >
                        <span className="truncate">
                          {paymentMethods.find(
                            (m) => m._id === selectedPaymentMethod,
                          )?.name || "Select a payment method"}
                        </span>
                        <ChevronDown
                          className={
                            "w-4 h-4 transition-transform " +
                            (isPaymentMethodDropdownOpen ? "rotate-180" : "")
                          }
                        />
                      </div>

                      {isPaymentMethodDropdownOpen && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col">
                          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search payment methods..."
                                value={paymentMethodSearchTerm}
                                onChange={(e) =>
                                  setPaymentMethodSearchTerm(e.target.value)
                                }
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none transition-all"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto flex-1">
                            {(() => {
                              const filtered = paymentMethods
                                .filter((m) => m.status === "active")
                                .filter((m) =>
                                  m.name
                                    .toLowerCase()
                                    .includes(
                                      paymentMethodSearchTerm.toLowerCase(),
                                    ),
                                );
                              if (filtered.length === 0) {
                                return (
                                  <div className="p-8 text-center text-gray-400 text-sm italic font-medium">
                                    No payment methods found
                                  </div>
                                );
                              }
                              return (
                                <ul className="py-2">
                                  {filtered.map((method) => (
                                    <li
                                      key={method._id}
                                      className={
                                        "px-4 py-3 cursor-pointer transition-all border-b border-gray-100 last:border-b-0 hover:bg-teal-50 " +
                                        (selectedPaymentMethod === method._id
                                          ? "bg-teal-100"
                                          : "")
                                      }
                                      onClick={() => {
                                        setSelectedPaymentMethod(method._id);
                                        setIsPaymentMethodDropdownOpen(false);
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        {selectedPaymentMethod ===
                                        method._id ? (
                                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                        ) : (
                                          <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                        )}
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">
                                            {method.name}
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Cart ({cartCount})
                    </h3>
                  </div>

                  {cartItems.length > 0 ? (
                    <div className="space-y-4">
                      {cartItems.map((entry) => {
                        const prices = getProductPricesPerUnit(
                          entry.item._id,
                          entry.cartItem.uom,
                        );
                        return (
                          <div
                            key={`${entry.item._id}-${entry.cartItem.uom}`}
                            className="p-3 rounded-xl bg-gray-50 border border-gray-200"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">
                                  {entry.item.item.name}
                                </h4>
                                <div className="text-xs text-gray-500">
                                  {entry.cartItem.quantity} x{" "}
                                  {entry.cartItem.uom}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  removeFromCart(
                                    entry.item._id,
                                    entry.cartItem.uom,
                                  )
                                }
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">
                                  Base Price
                                </div>
                                <div className="text-sm font-medium text-gray-700">
                                  AED {prices.salePrice.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">
                                  Custom Price
                                </div>
                                <input
                                  type="number"
                                  value={entry.cartItem.customPrice || ""}
                                  onChange={(e) => {
                                    const price = parseFloat(e.target.value);
                                    if (
                                      isNaN(price) ||
                                      price < prices.salePrice
                                    ) {
                                      return;
                                    }
                                    updateCustomPrice(
                                      entry.item._id,
                                      entry.cartItem.uom,
                                      price,
                                    );
                                  }}
                                  min={prices.salePrice}
                                  step="0.01"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                                />
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <div>
                                <div className="text-xs text-gray-500">
                                  Line Total
                                </div>
                                <div className="text-sm font-bold text-gray-900">
                                  AED{" "}
                                  {(
                                    entry.effectivePrice *
                                    entry.cartItem.quantity
                                  ).toFixed(2)}
                                </div>
                              </div>
                              {entry.commission > 0 && (
                                <div className="text-right">
                                  <div className="text-xs text-amber-600">
                                    Commission
                                  </div>
                                  <div className="text-sm font-bold text-amber-600">
                                    AED {entry.commission.toFixed(2)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            Subtotal
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            AED {subtotal.toFixed(2)}
                          </span>
                        </div>
                        {totalCommission > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-amber-700">
                              Total Commission
                            </span>
                            <span className="text-sm font-bold text-amber-700">
                              AED {totalCommission.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <span className="text-lg font-bold text-gray-900">
                            Total
                          </span>
                          <span className="text-lg font-bold text-teal-700">
                            AED {total.toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={handleCheckout}
                          disabled={!canCheckout}
                          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 ${
                            canCheckout
                              ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:from-teal-700 hover:to-teal-800 shadow-lg hover:shadow-xl"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {processing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              Processing...
                            </>
                          ) : (
                            "Complete Sale"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        Cart is empty
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Add some items to get started
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  Confirm Sale
                </h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Patient</div>
                <div className="font-semibold text-gray-900">
                  {currentSaleData.patient.firstName}{" "}
                  {currentSaleData.patient.lastName}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Payment Method</div>
                <div className="font-semibold text-gray-900">
                  {currentSaleData.paymentMethod?.name}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Items</div>
                <div className="space-y-2">
                  {currentSaleData.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="text-sm">
                        {item.item.item.name} x {item.cartItem.quantity}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        AED{" "}
                        {(item.effectivePrice * item.cartItem.quantity).toFixed(
                          2,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>AED {currentSaleData.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 px-4 text-sm font-semibold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndPlaceSale}
                disabled={processing}
                className="flex-1 py-2 px-4 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl hover:from-teal-700 hover:to-teal-800 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && transaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Receipt</h3>
                <button
                  onClick={closeReceiptAndModal}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-sm text-gray-600">Invoice ID</div>
                <div className="text-lg font-bold text-gray-900">
                  {transaction.invoiceId}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Patient</div>
                <div className="font-semibold text-gray-900">
                  {transaction.patient}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Items</div>
                <div className="space-y-2">
                  {transaction.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="text-sm">
                        {item.name} x {item.qty} {item.uom}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Payment Method</div>
                <div className="font-semibold text-gray-900">
                  {transaction.paymentMethod}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>AED {transaction.total}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={closeReceiptAndModal}
                className="w-full py-2 px-4 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl hover:from-teal-700 hover:to-teal-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProductSaleModal;
