import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, {
  ReactElement,
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
import { useRouter } from "next/router";

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
  subtotal?: string;
  previousPending?: string;
  paidAmount?: string;
  advanceUsed?: string;
  claimAmountUsed?: string;
  totalApplied?: string;
  pendingCleared?: string;
  newAdvanceCreated?: string;
  pendingAmount?: string;
  newAdvanceBalance?: string;
  newPendingBalance?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaymentMethod {
  _id: string;
  name: string;
  status: string;
}

interface Balances {
  advanceBalance: number;
  pendingBalance: number;
  claimAmount: number;
  pendingClaim: number;
  pastAdvanceBalance: number;
  pastAdvance50PercentBalance: number;
  pastAdvance54PercentBalance: number;
  pastAdvance159FlatBalance: number;
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

const NewProductSalesPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { doctorId, patientId } = router.query as {
    doctorId: string;
    patientId: string;
  };
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

  // Derived values first
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  // Step management (0: Patient, 1: Products, 2: Payment, 3: Complete)
  const getCurrentStep = (): number => {
    if (!selectedPatient) return 0;
    if (cartCount === 0) return 1;
    if (!selectedPaymentMethod) return 2;
    return 3;
  };

  const currentStep = getCurrentStep();

  // Balances and advance usage
  const [balances, setBalances] = useState<Balances>({
    advanceBalance: 0,
    pendingBalance: 0,
    claimAmount: 0,
    pendingClaim: 0,
    pastAdvanceBalance: 0,
    pastAdvance50PercentBalance: 0,
    pastAdvance54PercentBalance: 0,
    pastAdvance159FlatBalance: 0,
  });

  const [applyAdvance, setApplyAdvance] = useState(true); // Default to true

  // Payment form data
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [advanceUsed, setAdvanceUsed] = useState<number>(0);
  const [claimAmountUsed, setClaimAmountUsed] = useState<number>(0);
  const [_pendingUsed, setPendingUsed] = useState<number>(0);

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
              user: doctorId,
              page: pageNum,
              limit: pagination.limit,
              search: searchTerm,
            },
          },
        );

        if (response.data?.success) {
          const itemsData = response.data.records || [];
          const filteredItems = itemsData.filter((f: AllocatedStockItem) => {
            const findItemWithZero = f.quantitiesByUom?.find(
              (q) => q.quantity === 0,
            );
            return !findItemWithZero;
          });
          setItems(filteredItems);
          setPagination({
            page: response.data.currentPage || pageNum,
            limit: response.data.limit || pagination.limit,
            total: response.data.totalRecords || 0,
            totalPages: response.data.totalPages || 0,
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

  // Initial data fetch
  useEffect(() => {
    fetchClinicId();
  }, [fetchClinicId]);

  // Fetch patient by ID when patientId is present in query
  useEffect(() => {
    if (patientId && clinicId) {
      const loadPatient = async () => {
        const patient = await fetchPatientById(patientId);
        if (patient) {
          handlePatientSelect(patient);
        }
      };
      loadPatient();
    }
  }, [patientId, clinicId]);

  // Fetch items when clinicId is available
  useEffect(() => {
    if (clinicId) {
      fetchItems(1, search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clinicId) {
        fetchItems(1, search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, clinicId, fetchItems]);

  // Handle patient selection
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchPhone("");
    setPatientSearchResults([]);
    setShowPatientDropdown(false);

    // Fetch patient balances when a patient is selected
    fetchPatientBalances(patient._id);
  };

  // Fetch patient by ID
  const fetchPatientById = async (patientId: string) => {
    try {
      const token = getTokenByPath();
      const response = await axios.get(`/api/clinic/patient-information`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { id: patientId },
      });
      if (response.data?.success && response.data?.patient) {
        return response.data.patient;
      }
    } catch (error) {
      console.error("Error fetching patient by ID:", error);
    }
    return null;
  };

  // Fetch patient balances (advance/pending)
  const fetchPatientBalances = async (patientId: string) => {
    try {
      const token = getTokenByPath();
      const res = await axios.get(`/api/clinic/patient-balance/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && res.data?.balances) {
        setBalances({
          advanceBalance: res.data.balances.advanceBalance || 0,
          pendingBalance: res.data.balances.pendingBalance || 0,
          claimAmount: res.data.balances.claimAmount || 0,
          pendingClaim: res.data.balances.pendingClaim || 0,
          pastAdvanceBalance: res.data.balances.pastAdvanceBalance || 0,
          pastAdvance50PercentBalance:
            res.data.balances.pastAdvance50PercentBalance || 0,
          pastAdvance54PercentBalance:
            res.data.balances.pastAdvance54PercentBalance || 0,
          pastAdvance159FlatBalance:
            res.data.balances.pastAdvance159FlatBalance || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch patient balances", err);
      // Reset balances if fetch fails
      setBalances({
        advanceBalance: 0,
        pendingBalance: 0,
        claimAmount: 0,
        pendingClaim: 0,
        pastAdvanceBalance: 0,
        pastAdvance50PercentBalance: 0,
        pastAdvance54PercentBalance: 0,
        pastAdvance159FlatBalance: 0,
      });
    }
  };

  // Clear patient selection
  const clearPatientSelection = () => {
    setSelectedPatient(null);
    setPatientSearchPhone("");

    // Reset payment state
    setBalances({
      advanceBalance: 0,
      pendingBalance: 0,
      claimAmount: 0,
      pendingClaim: 0,
      pastAdvanceBalance: 0,
      pastAdvance50PercentBalance: 0,
      pastAdvance54PercentBalance: 0,
      pastAdvance159FlatBalance: 0,
    });
    setApplyAdvance(true); // Reset to default
    setPaidAmount(0);
    setAdvanceUsed(0);
    setClaimAmountUsed(0);
    setPendingUsed(0);
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
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [cart, items]);

  const subtotal = cartItems.reduce(
    (sum, entry) => sum + entry.effectivePrice * entry.cartItem.quantity,
    0,
  );

  const totalCommission = cartItems.reduce(
    (sum, entry) => sum + entry.commission,
    0,
  );

  // Previous pending balance is automatically added to total
  const previousPending = balances.pendingBalance || 0;
  const total = subtotal + previousPending;

  // Calculate payment values - user only pays what they're paying now, not including previous pending
  const totalApplied = paidAmount + advanceUsed + claimAmountUsed;
  // New pending amount is (subtotal + previous pending) - (paid + advance + claim)
  const pendingAmount = Math.max(0, total - totalApplied);

  // Calculate detailed breakdown
  const pendingCleared = Math.min(
    Math.max(0, totalApplied - subtotal),
    previousPending,
  );
  const newAdvanceCreated = Math.max(0, totalApplied - total);

  // Advance and claim are still optional but can be used
  useEffect(() => {
    if (selectedPatient && applyAdvance && balances.advanceBalance > 0) {
      // Auto use advance to cover part of the current subtotal if possible
      const availableForAdvance = Math.max(
        0,
        total - paidAmount - claimAmountUsed,
      );
      setAdvanceUsed(Math.min(balances.advanceBalance, availableForAdvance));
    } else {
      setAdvanceUsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPatient,
    applyAdvance,
    balances.advanceBalance,
    total,
    paidAmount,
    claimAmountUsed,
  ]);

  useEffect(() => {
    if (selectedPatient && balances.claimAmount > 0) {
      // Auto use claim to cover part of the current subtotal if possible
      const availableForClaim = Math.max(0, total - paidAmount - advanceUsed);
      setClaimAmountUsed(Math.min(balances.claimAmount, availableForClaim));
    } else {
      setClaimAmountUsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, balances.claimAmount, total, paidAmount, advanceUsed]);

  const canCheckout =
    cartCount > 0 &&
    selectedPatient !== null &&
    selectedPaymentMethod !== null &&
    !processing;

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

    const selectedMethod = paymentMethods.find(
      (m: PaymentMethod) => m._id === selectedPaymentMethod,
    );

    // Prepare sale data for confirmation
    const saleData = {
      patient: selectedPatient,
      paymentMethod: selectedMethod || null,
      items: cartItems,
      subtotal,
      previousPending,
      total,
      paidAmount,
      advanceUsed,
      claimAmountUsed,
      totalApplied,
      pendingCleared,
      newAdvanceCreated,
      pendingAmount,
      newAdvanceBalance:
        balances.advanceBalance - advanceUsed + newAdvanceCreated,
      newPendingBalance: previousPending - pendingCleared + pendingAmount,
    };

    setCurrentSaleData(saleData);
    setShowConfirmModal(true);
  };

  const confirmAndPlaceSale = async () => {
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
          totalCommission: totalCommission,
          totalPrice: total,
          paidAmount,
          advanceUsed,
          claimAmountUsed,
          pendingUsed: previousPending, // Pass the entire previous pending as pendingUsed
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

        const selectedMethod = paymentMethods.find(
          (m: PaymentMethod) => m._id === selectedPaymentMethod,
        );

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
          subtotal: subtotal.toFixed(2),
          previousPending: previousPending.toFixed(2),
          paidAmount: paidAmount.toFixed(2),
          advanceUsed: advanceUsed.toFixed(2),
          claimAmountUsed: claimAmountUsed.toFixed(2),
          totalApplied: totalApplied.toFixed(2),
          pendingCleared: pendingCleared.toFixed(2),
          newAdvanceCreated: newAdvanceCreated.toFixed(2),
          pendingAmount: pendingAmount.toFixed(2),
          newAdvanceBalance: (
            balances.advanceBalance -
            advanceUsed +
            newAdvanceCreated
          ).toFixed(2),
          newPendingBalance: (
            previousPending -
            pendingCleared +
            pendingAmount
          ).toFixed(2),
          paymentMethod: selectedMethod?.name,
        };

        setTransaction(newTransaction);
        setCart([]);
        setSelectedPatient(null);
        setSelectedPaymentMethod(null);
        setPaidAmount(0);
        setAdvanceUsed(0);
        setClaimAmountUsed(0);
        setPendingUsed(0);
        setApplyAdvance(true); // Reset to default
        setShowConfirmModal(false); // Close confirm modal first
        setShowReceiptModal(true);
        toast.success("Transaction completed successfully!");

        // Refresh the allocated items list
        fetchItems(1, search);
      }
    } catch (error) {
      toast.error("Transaction failed. Please try again.");
      console.error("Checkout error:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Product Sales & Dispensing
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Follow these steps to complete the sale
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            {/* Step 1: Patient */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep >= 0
                    ? "bg-teal-600 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {currentStep > 0 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-semibold ${
                    currentStep >= 0 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  Select Patient
                </p>
                <p className="text-xs text-gray-500">
                  {!selectedPatient ? "Required" : "Selected"}
                </p>
              </div>
            </div>

            {/* Connector 1 */}
            <div
              className={`h-1 flex-1 mx-4 rounded-full transition-all ${
                currentStep > 0 ? "bg-teal-600" : "bg-gray-200"
              }`}
            />

            {/* Step 2: Products */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep >= 1
                    ? "bg-teal-600 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-semibold ${
                    currentStep >= 1 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  Choose Products
                </p>
                <p className="text-xs text-gray-500">
                  {cartCount === 0
                    ? "Add items to cart"
                    : `${cartCount} item${cartCount !== 1 ? "s" : ""} in cart`}
                </p>
              </div>
            </div>

            {/* Connector 2 */}
            <div
              className={`h-1 flex-1 mx-4 rounded-full transition-all ${
                currentStep > 1 ? "bg-teal-600" : "bg-gray-200"
              }`}
            />

            {/* Step 3: Payment */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep >= 2
                    ? "bg-teal-600 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : "3"}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-semibold ${
                    currentStep >= 2 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  Payment Method
                </p>
                <p className="text-xs text-gray-500">
                  {!selectedPaymentMethod
                    ? "Select payment method"
                    : "Selected"}
                </p>
              </div>
            </div>

            {/* Connector 3 */}
            <div
              className={`h-1 flex-1 mx-4 rounded-full transition-all ${
                currentStep > 2 ? "bg-teal-600" : "bg-gray-200"
              }`}
            />

            {/* Step 4: Complete */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep >= 3
                    ? "bg-teal-600 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                4
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-semibold ${
                    currentStep >= 3 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  Complete Sale
                </p>
                <p className="text-xs text-gray-500">
                  {currentStep >= 3
                    ? "Ready to complete"
                    : "Complete previous steps"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Step 1 & 2 - Patient & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Patient Selection */}
          <div
            className={`bg-white rounded-xl shadow-lg border transition-all ${
              currentStep === 0
                ? "border-teal-500 ring-2 ring-teal-100"
                : "border-gray-200"
            }`}
          >
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Step 1: Select Patient
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
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedPatient.phone || selectedPatient.mobileNumber}
                        {selectedPatient.age && ` • Age ${selectedPatient.age}`}
                      </div>
                    </div>
                    {!patientId && (
                      <button
                        onClick={clearPatientSelection}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : !patientId ? (
                <div className="relative" ref={patientSearchRef}>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={patientSearchPhone}
                      onChange={(e) => setPatientSearchPhone(e.target.value)}
                      placeholder="Search patient by name or phone..."
                      className="w-full flex items-center justify-between px-4 py-3 pl-10 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    />
                    {isSearchingPatient && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600" />
                      </div>
                    )}
                  </div>

                  {showPatientDropdown && patientSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden">
                      {patientSearchResults.map((patient) => (
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
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Step 2: Product Selection (disabled until patient is selected) */}
          <div
            className={`bg-white rounded-xl shadow-lg border transition-all ${
              currentStep === 1
                ? "border-teal-500 ring-2 ring-teal-100"
                : "border-gray-200"
            } ${!selectedPatient ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                Step 2: Choose Products
              </h2>

              {/* Search */}
              <div className="mb-6">
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
                                        stockItem.expiryDate!,
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
                              {stockItem.quantitiesByUom!.map((qtyByUom) => {
                                const cartItem = getCartItem(
                                  stockItem._id,
                                  qtyByUom.uom,
                                );
                                const qty = cartItem?.quantity || 0;
                                const isInCart = qty > 0;
                                const itemHasUomSelected = hasAnyUomSelected(
                                  stockItem._id,
                                );
                                const selectedUom = getSelectedUomForItem(
                                  stockItem._id,
                                );
                                const isThisUomSelected =
                                  selectedUom === qtyByUom.uom;
                                const isDisabled =
                                  itemHasUomSelected && !isThisUomSelected;
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
                                          qty >= qtyByUom.quantity || isDisabled
                                        }
                                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                                          qty >= qtyByUom.quantity || isDisabled
                                            ? "text-gray-300 cursor-not-allowed"
                                            : "text-gray-700 hover:bg-gray-200 hover:text-teal-600"
                                        }`}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
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
                        Showing {(pagination.page - 1) * pagination.limit + 1}{" "}
                        to{" "}
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.total,
                        )}{" "}
                        of {pagination.total} items
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newPage = Math.max(1, pagination.page - 1);
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
                          disabled={pagination.page >= pagination.totalPages}
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
                  <p className="text-gray-500">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Step 3 & 4 - Payment & Complete Sale */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Cart Items */}
          <div
            className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${
              !selectedPatient ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Cart
                </h3>
              </div>

              {cartItems.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cartItems.map((entry) => (
                    <div
                      key={`${entry.item._id}-${entry.cartItem.uom}`}
                      className="p-3 rounded-lg bg-gray-50 border border-teal-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {entry.item.item.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.cartItem.quantity} {entry.cartItem.uom}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            removeFromCart(entry.item._id, entry.cartItem.uom)
                          }
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {/* Editable Price */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Price:</span>
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-sm text-gray-800">AED</span>
                            <input
                              type="number"
                              step="0.01"
                              min={entry.prices.salePrice}
                              value={entry.effectivePrice}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value);
                                if (
                                  !isNaN(newPrice) &&
                                  newPrice >= entry.prices.salePrice
                                ) {
                                  updateCustomPrice(
                                    entry.item._id,
                                    entry.cartItem.uom,
                                    newPrice,
                                  );
                                }
                              }}
                              className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Commission */}
                        {entry.commission > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-purple-600 font-medium">
                              Commission:
                            </span>
                            <span className="text-xs text-purple-600 font-semibold">
                              AED {entry.commission.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Total for item */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                          <span className="text-xs text-gray-600">Total:</span>
                          <span className="text-sm font-semibold text-teal-600">
                            AED{" "}
                            {(
                              entry.effectivePrice * entry.cartItem.quantity
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">No items in cart</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add items to get started
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Payment Method Selection (disabled until items are in cart) */}
          <div
            className={`bg-white rounded-xl shadow-lg border transition-all ${
              currentStep === 2
                ? "border-teal-500 ring-2 ring-teal-100"
                : "border-gray-200"
            } ${!selectedPatient || cartCount === 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Step 3: Payment Method
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
                        (m: PaymentMethod) => m._id === selectedPaymentMethod,
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
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
                            .filter((m: PaymentMethod) => m.status === "active")
                            .filter((m: PaymentMethod) =>
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
                              {filtered.map((method: PaymentMethod) => (
                                <li
                                  key={method._id}
                                  className={
                                    "px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group " +
                                    (selectedPaymentMethod === method._id
                                      ? "bg-teal-50"
                                      : "")
                                  }
                                  onClick={() => {
                                    setSelectedPaymentMethod(method._id);
                                    setIsPaymentMethodDropdownOpen(false);
                                    setPaymentMethodSearchTerm("");
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span
                                        className={
                                          "text-sm font-bold text-gray-900 group-hover:text-teal-600 transition-colors"
                                        }
                                      >
                                        {method.name}
                                      </span>
                                    </div>
                                    {selectedPaymentMethod === method._id && (
                                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {!selectedPaymentMethod && (
                    <p className="text-xs text-gray-500">
                      Please select a payment method to proceed
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Payment Details & Complete Sale (disabled until payment method is selected) */}
          {selectedPatient && (
            <div
              className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${
                !selectedPaymentMethod ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <div className="p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Step 4: Payment Details
                </h3>

                {/* Amount Breakdown */}
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Products Amount:</span>
                    <span className="font-semibold text-gray-900">
                      AED {subtotal.toFixed(2)}
                    </span>
                  </div>
                  {previousPending > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Previous Pending:</span>
                      <span className="font-semibold text-orange-600">
                        AED {previousPending.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Total Payable:
                    </span>
                    <span className="font-bold text-teal-600">
                      AED {total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Patient Balances */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Advance Balance:</span>
                    <span className="font-medium text-teal-600">
                      AED {balances.advanceBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Pending Balance:</span>
                    <span className="font-medium text-orange-600">
                      AED {balances.pendingBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Claim Amount:</span>
                    <span className="font-medium text-blue-600">
                      AED {balances.claimAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Advance Toggle */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyAdvance}
                      onChange={(e) => setApplyAdvance(e.target.checked)}
                      disabled={balances.advanceBalance <= 0}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">
                      Use Advance Balance (AED {advanceUsed.toFixed(2)})
                    </span>
                  </label>
                </div>

                {/* Auto Applied Balances */}
                <div className="space-y-2 text-xs">
                  {advanceUsed > 0 && (
                    <div className="flex justify-between text-teal-600">
                      <span>Advance Applied:</span>
                      <span className="font-semibold">
                        AED {advanceUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {claimAmountUsed > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Claim Applied:</span>
                      <span className="font-semibold">
                        AED {claimAmountUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Paid Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Amount Paid Now
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">AED</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidAmount}
                      onChange={(e) =>
                        setPaidAmount(parseFloat(e.target.value) || 0)
                      }
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Total Applied (Paid + Advances):
                    </span>
                    <span className="font-semibold text-gray-900">
                      AED {totalApplied.toFixed(2)}
                    </span>
                  </div>
                  {pendingCleared > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600">
                        Previous Pending Cleared:
                      </span>
                      <span className="font-semibold text-orange-600">
                        AED {pendingCleared.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {newAdvanceCreated > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-teal-600">
                        New Advance Created:
                      </span>
                      <span className="font-semibold text-teal-600">
                        AED {newAdvanceCreated.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">New Pending Amount:</span>
                    <span
                      className={`font-semibold ${pendingAmount > 0 ? "text-orange-600" : "text-gray-900"}`}
                    >
                      AED {pendingAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        New Advance Balance:
                      </span>
                      <span className="font-semibold text-teal-600">
                        AED{" "}
                        {(
                          balances.advanceBalance -
                          advanceUsed +
                          newAdvanceCreated
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        New Pending Balance:
                      </span>
                      <span className="font-semibold text-orange-600">
                        AED{" "}
                        {(
                          previousPending -
                          pendingCleared +
                          pendingAmount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Totals & Checkout */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6 space-y-4">
              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Products Amount</span>
                  <span className="font-semibold text-gray-900">
                    AED {subtotal.toFixed(2)}
                  </span>
                </div>
                {previousPending > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Previous Pending</span>
                    <span className="font-semibold text-orange-600">
                      AED {previousPending.toFixed(2)}
                    </span>
                  </div>
                )}
                {totalCommission > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-600">Total Commission</span>
                    <span className="font-semibold text-purple-600">
                      AED {totalCommission.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="pt-3 mt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">
                    Grand Total
                  </span>
                  <span className="text-xl font-bold text-teal-600">
                    AED {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={!canCheckout}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all shadow-lg ${
                  canCheckout
                    ? "bg-gradient-to-r from-teal-600 to-teal-800 hover:from-teal-700 hover:to-teal-900 text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Complete Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && currentSaleData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 text-center border-b border-gray-100 bg-gradient-to-br from-teal-50 to-teal-100">
              <h2 className="text-xl font-bold text-gray-900">Confirm Sale</h2>
              <p className="text-sm text-gray-600 mt-1">
                Please review the sale details before proceeding
              </p>
            </div>

            {/* Confirmation Content */}
            <div className="p-6 max-h-[70vh] overflow-auto">
              {/* Patient Info */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Patient Information
                </h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white text-sm font-bold">
                      {initials(
                        `${currentSaleData.patient.firstName} ${currentSaleData.patient.lastName}`,
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {currentSaleData.patient.firstName}{" "}
                        {currentSaleData.patient.lastName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {currentSaleData.patient.phone ||
                          currentSaleData.patient.mobileNumber}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Items
                </h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="space-y-2">
                    {currentSaleData.items.map((entry: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-sm py-2 border-b border-gray-200 last:border-0"
                      >
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">
                            {entry.item.item.name}
                          </span>
                          <div className="text-xs text-gray-500">
                            {entry.cartItem.quantity} {entry.cartItem.uom} × AED{" "}
                            {entry.prices.salePrice.toFixed(2)}
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900">
                          AED{" "}
                          {(
                            entry.prices.salePrice * entry.cartItem.quantity
                          ).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="mb-6">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Products Amount:</span>
                    <span className="font-semibold text-gray-900">
                      AED {currentSaleData.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {currentSaleData.previousPending > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Previous Pending:</span>
                      <span className="font-semibold text-orange-600">
                        AED {currentSaleData.previousPending.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">
                      Total Payable:
                    </span>
                    <span className="text-xl font-bold text-teal-600">
                      AED {currentSaleData.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                    Payment Breakdown
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Paid Now (Cash/Card):</span>
                    <span className="font-semibold text-gray-900">
                      AED {currentSaleData.paidAmount.toFixed(2)}
                    </span>
                  </div>
                  {currentSaleData.advanceUsed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-teal-600">Advance Used:</span>
                      <span className="font-semibold text-teal-600">
                        AED {currentSaleData.advanceUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {currentSaleData.claimAmountUsed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600">Claim Used:</span>
                      <span className="font-semibold text-blue-600">
                        AED {currentSaleData.claimAmountUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Total Applied:
                    </span>
                    <span className="font-semibold text-gray-900">
                      AED {currentSaleData.totalApplied.toFixed(2)}
                    </span>
                  </div>
                  {currentSaleData.pendingCleared > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Previous Pending Cleared:</span>
                      <span className="font-semibold">
                        AED {currentSaleData.pendingCleared.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {currentSaleData.newAdvanceCreated > 0 && (
                    <div className="flex justify-between text-sm text-teal-600">
                      <span>New Advance Created:</span>
                      <span className="font-semibold">
                        AED {currentSaleData.newAdvanceCreated.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">New Pending Amount:</span>
                    <span
                      className={`font-semibold ${
                        currentSaleData.pendingAmount > 0
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      AED {currentSaleData.pendingAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* New Balances */}
                <div className="mt-4 bg-teal-50 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-teal-900 uppercase tracking-wide mb-2">
                    New Patient Balances
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-teal-700">New Advance Balance:</span>
                    <span className="font-semibold text-teal-700">
                      AED {currentSaleData.newAdvanceBalance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700">
                      New Pending Balance:
                    </span>
                    <span className="font-semibold text-orange-700">
                      AED {currentSaleData.newPendingBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Payment Method
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-semibold text-gray-900">
                    {currentSaleData.paymentMethod?.name}
                  </span>
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="p-6 flex gap-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndPlaceSale}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-800 hover:from-teal-700 hover:to-teal-900 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirm Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && transaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 text-center border-b border-gray-100 flex items-center justify-center gap-5 bg-gradient-to-br from-teal-50 to-teal-100">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Transaction Complete!
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Receipt generated successfully
                </p>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="p-6 max-h-[65vh] overflow-auto">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="space-y-3">
                  {transaction.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1">
                        {item.name}
                      </span>
                      <span className="font-medium text-gray-900 ml-4">
                        {item.qty} {item.uom}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Amount Breakdown
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Products Amount:</span>
                    <span className="font-semibold text-gray-900">
                      AED {transaction.subtotal}
                    </span>
                  </div>
                  {transaction.previousPending &&
                    parseFloat(transaction.previousPending) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Previous Pending:</span>
                        <span className="font-semibold text-orange-600">
                          AED {transaction.previousPending}
                        </span>
                      </div>
                    )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Total Payable:
                    </span>
                    <span className="font-bold text-teal-600">
                      AED {transaction.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Payment Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Paid Now:</span>
                    <span className="font-semibold text-gray-900">
                      AED {transaction.paidAmount}
                    </span>
                  </div>
                  {transaction.advanceUsed &&
                    parseFloat(transaction.advanceUsed) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-teal-600">Advance Used:</span>
                        <span className="font-semibold text-teal-600">
                          AED {transaction.advanceUsed}
                        </span>
                      </div>
                    )}
                  {transaction.claimAmountUsed &&
                    parseFloat(transaction.claimAmountUsed) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Claim Used:</span>
                        <span className="font-semibold text-blue-600">
                          AED {transaction.claimAmountUsed}
                        </span>
                      </div>
                    )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Total Applied:
                    </span>
                    <span className="font-semibold text-gray-900">
                      AED {transaction.totalApplied}
                    </span>
                  </div>
                  {transaction.pendingCleared &&
                    parseFloat(transaction.pendingCleared) > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Previous Pending Cleared:</span>
                        <span className="font-semibold">
                          AED {transaction.pendingCleared}
                        </span>
                      </div>
                    )}
                  {transaction.newAdvanceCreated &&
                    parseFloat(transaction.newAdvanceCreated) > 0 && (
                      <div className="flex justify-between text-sm text-teal-600">
                        <span>New Advance Created:</span>
                        <span className="font-semibold">
                          AED {transaction.newAdvanceCreated}
                        </span>
                      </div>
                    )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">New Pending:</span>
                    <span
                      className={`font-semibold ${
                        transaction.pendingAmount &&
                        parseFloat(transaction.pendingAmount) > 0
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      AED {transaction.pendingAmount}
                    </span>
                  </div>
                </div>
              </div>

              {/* New Balances */}
              <div className="bg-teal-50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-teal-900 uppercase tracking-wide mb-3">
                  Final Patient Balances
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-teal-700">Advance Balance:</span>
                    <span className="font-semibold text-teal-700">
                      AED {transaction.newAdvanceBalance}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700">Pending Balance:</span>
                    <span className="font-semibold text-orange-700">
                      AED {transaction.newPendingBalance}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                {[
                  {
                    label: "Invoice ID",
                    value: transaction.invoiceId,
                    mono: true,
                  },
                  { label: "Patient", value: transaction.patient },
                  { label: "Date", value: transaction.date },
                  ...(transaction.paymentMethod
                    ? [
                        {
                          label: "Payment Method",
                          value: transaction.paymentMethod,
                        },
                      ]
                    : []),
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span
                      className={`font-medium text-gray-900 ${mono ? "font-mono text-xs" : ""}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">
                  Total Paid
                </span>
                <span className="text-lg font-bold text-gray-900">
                  AED {transaction.total}
                </span>
              </div>
            </div>

            <div className="p-6 flex gap-3 border-t border-gray-200 bg-gray-50 ">
              <button
                onClick={() => {
                  window.open(
                    `/clinic/stocks/product-sales/print-product-sale/${transaction.invoiceId}`,
                    "_blank",
                  );
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-all"
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

NewProductSalesPage.getLayout = function getLayout(page: ReactElement) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedNewProductSalesPage = withClinicAuth(
  NewProductSalesPage,
) as NextPageWithLayout;
ProtectedNewProductSalesPage.getLayout = NewProductSalesPage.getLayout;

export default ProtectedNewProductSalesPage;
