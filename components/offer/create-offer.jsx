// pages/lead/offers.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  PlusCircle,
  Edit,
  Trash2,
  Package,
  TrendingUp,
  Calendar,
  Download,
  Eye,
  Gift,
  X,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import CreateOfferModal from "../../components/CreateOfferModal";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import { getCurrencySymbol } from "@/lib/currencyHelper";

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  // First try role-aware resolution: inspect the JWT payload of each token and
  // pick the one whose role matches the token storage key. This prevents using
  // a stale clinicToken when the current user is logged in as agent/doctorStaff.
  try {
    for (const key of TOKEN_PRIORITY) {
      const raw =
        window.localStorage.getItem(key) ||
        window.sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const base64Url = raw.split(".")[1];
        if (!base64Url) continue;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const decoded = JSON.parse(jsonPayload);
        const role = decoded.role;
        if (!role) continue;
        const roleMatchesKey =
          (key === "agentToken" && (role === "agent" || role === "staff" || role === "doctorStaff")) ||
          (key === "staffToken" && (role === "staff" || role === "doctorStaff" || role === "agent")) ||
          (key === "clinicToken" && role === "clinic") ||
          (key === "doctorToken" && (role === "doctor" || role === "doctorStaff")) ||
          (key === "adminToken" && role === "admin") ||
          key === "userToken";
        if (roleMatchesKey) return raw;
      } catch {
        // ignore decode errors for this token
      }
    }
  } catch {
    // fall through to naive priority
  }
  // Fallback: simple priority order (kept for tokens without decodable payloads)
  for (const key of TOKEN_PRIORITY) {
    const value =
      localStorage.getItem(key) ||
      sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const getUserRole = () => {
  if (typeof window === 'undefined') return null;
  // Role-aware resolution: decode each token and only accept a token whose
  // decoded role matches the storage key. This prevents returning "clinic"
  // for an agent user who happens to have a stale clinicToken in storage.
  try {
    for (const key of TOKEN_PRIORITY) {
      const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (!token) continue;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role || null;
        if (!role) continue;
        const roleMatchesKey =
          (key === "agentToken" && (role === "agent" || role === "staff" || role === "doctorStaff")) ||
          (key === "staffToken" && (role === "staff" || role === "doctorStaff" || role === "agent")) ||
          (key === "clinicToken" && role === "clinic") ||
          (key === "doctorToken" && (role === "doctor" || role === "doctorStaff")) ||
          (key === "adminToken" && role === "admin") ||
          key === "userToken";
        if (roleMatchesKey) return role;
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // ignore and fall through
  }
  // Fallback: first decodable token
  try {
    for (const key of TOKEN_PRIORITY) {
      const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.role || null;
        } catch (e) {
          continue;
        }
      }
    }
  } catch (error) {
    // ignore
  }
  return null;
};

const MODULE_KEY = "clinic_create_offers";

function OffersPage({ dateFilter = 'Today', setActiveTab, pageLevelPermissions }) {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [currency, setCurrency] = useState('INR');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [editingOfferData, setEditingOfferData] = useState(null);
  const [viewingOffer, setViewingOffer] = useState(null);
  const [doctorNamesMap, setDoctorNamesMap] = useState({});
  const [departmentNamesMap, setDepartmentNamesMap] = useState({});
  const [serviceNamesMap, setServiceNamesMap] = useState({});
  const [userNamesMap, setUserNamesMap] = useState({});
  const [clinicNamesMap, setClinicNamesMap] = useState({});
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [token, setToken] = useState("");
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    offerId: null,
    offerTitle: "",
  });
  const [offerAnalytics, setOfferAnalytics] = useState({
    instantDiscount: { count: 0, totalDiscount: 0, totalRevenue: 0, list: [] },
    bundle: { count: 0, totalFreeSessions: 0, totalRedeemed: 0 },
    cashback: { count: 0, totalCashbackEarned: 0, totalWalletUsed: 0 },
    freeSessionRedemption: { count: 0, totalRedeemed: 0 },
    totalOfferBillings: 0,
    offersUsedList: [],
    totalRevenue: 0,
    revenueBillingList: [],
    mostUsedOffers: [],
    underperformingOffers: [],
    topPatientsList: [],
    allOffersStats: {},
  });
  const [showMostUsedModal, setShowMostUsedModal] = useState(false);
  const [showUnderperformingModal, setShowUnderperformingModal] = useState(false);
  const [showTopPatientsModal, setShowTopPatientsModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showOffersUsedModal, setShowOffersUsedModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const storedToken = getStoredToken();
      setToken(storedToken || "");
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  // Use page-level permissions if provided, otherwise fetch self
  useEffect(() => {
    if (pageLevelPermissions) {
      setPermissions({
        canRead: Boolean(pageLevelPermissions.canRead),
        canCreate: Boolean(pageLevelPermissions.canCreate),
        canUpdate: Boolean(pageLevelPermissions.canUpdate),
        canDelete: Boolean(pageLevelPermissions.canDelete),
      });
      setPermissionsLoaded(true);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          setPermissions({
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canRead: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        const userRole = getUserRole();

        if (userRole === "admin") {
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
          });
          setPermissionsLoaded(true);
          return;
        }

        if (userRole === "clinic" || userRole === "doctor") {
          try {
            const res = await axios.get("/api/clinic/sidebar-permissions", {
              headers: authHeaders,
            });

            if (res.data.success) {
              if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
                setPermissions({
                  canCreate: true,
                  canRead: true,
                  canUpdate: true,
                  canDelete: true,
                });
              } else {
                const modulePermission = res.data.permissions.find((p) => {
                  if (!p?.module) return false;
                  if (p.module === MODULE_KEY) return true;
                  if (p.module === "clinic_create_offers") return true;
                  if (p.module === "create_offers") return true;
                  if (p.module === "clinic_create_offer") return true;
                  if (p.module === "create_offer") return true;
                  if (p.module === "Clinic_create_offers") return true;
                  return false;
                });

                if (modulePermission) {
                  const actions = modulePermission.actions || {};
                  const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
                  const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
                  const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
                  const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
                  const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

                  setPermissions({
                    canCreate: moduleAll || moduleCreate,
                    canRead: moduleAll || moduleRead,
                    canUpdate: moduleAll || moduleUpdate,
                    canDelete: moduleAll || moduleDelete,
                  });
                } else {
                  setPermissions({
                    canCreate: false,
                    canRead: true,
                    canUpdate: false,
                    canDelete: false,
                  });
                }
              }
            } else {
              setPermissions({
                canCreate: true,
                canRead: true,
                canUpdate: true,
                canDelete: true,
              });
            }
          } catch (err) {
            const status = err.response?.status;
            if (status !== 401 && status !== 403) {
              console.debug("Clinic sidebar permissions fetch issue:", err.message || String(err));
            }
            setPermissions({
              canCreate: true,
              canRead: true,
              canUpdate: true,
              canDelete: true,
            });
          }
          setPermissionsLoaded(true);
          return;
        }

        if (["agent", "staff", "doctorStaff"].includes(userRole || "")) {
          try {
            const token = getStoredToken();
            let res = await axios.get("/api/agent/get-module-permissions", {
              params: { moduleKey: MODULE_KEY },
              headers: { Authorization: `Bearer ${token}` },
            });
            let data = res.data;

            if (!data?.permissions && data?.error?.includes("not found")) {
              res = await axios.get("/api/agent/get-module-permissions", {
                params: { moduleKey: "create_offers" },
                headers: { Authorization: `Bearer ${token}` },
              });
              data = res.data;
            }

            if (!data?.permissions && data?.error?.includes("not found in agent permissions")) {
              setPermissions({
                canRead: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
              });
              setPermissionsLoaded(true);
              return;
            }

            const actions = data?.permissions?.actions || data?.data?.moduleActions || {};
            const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";

            const canAll = isTrue(actions.all);
            setPermissions({
              canRead: canAll || isTrue(actions.read),
              canCreate: canAll || isTrue(actions.create),
              canUpdate: canAll || isTrue(actions.update),
              canDelete: canAll || isTrue(actions.delete),
            });
          } catch (err) {
            const status = err.response?.status;
            if (status !== 401 && status !== 403) {
              console.debug("Agent module permissions fetch issue:", err.message || String(err));
            }
            setPermissions({
              canCreate: true,
              canRead: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } else {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
        }
        setPermissionsLoaded(true);
      } catch (err) {
        const status = err.response?.status;
        if (status !== 401 && status !== 403) {
          console.debug("Permissions fetch error:", err.message || String(err));
        }
        setPermissions({
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        });
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, [pageLevelPermissions]);

  const userRole = getUserRole();

  // Helper to resolve name from ID or Object
  const resolveName = (item, map, fallback = "—") => {
    if (!item) return fallback;
    if (typeof item === 'object') {
      return item.name || item.title || map[item._id] || map[item.id] || fallback;
    }
    // If it's an ID string, only show it if we have a name for it, otherwise show fallback
    return map[item] || fallback;
  };

  // Admin role bypasses all permission checks
  const finalCanRead = userRole === 'admin' ? true : permissions.canRead;
  const finalCanCreate = userRole === 'admin' ? true : permissions.canCreate;
  const finalCanUpdate = userRole === 'admin' ? true : permissions.canUpdate;
  const finalCanDelete = userRole === 'admin' ? true : permissions.canDelete;

  // Fetch all offers
  const fetchOffers = async () => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    // Wait for permissions to load
    if (!permissionsLoaded) return;

    // ✅ Strict check: If user doesn't have read permission, don't make API call
    if (finalCanRead !== true) {
      setOffers([]);
      // Clear cache if no read permission
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("offersCache");
        } catch { }
      }
      return;
    }

    // Serve instantly from cache if available
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("offersCache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setOffers(parsed);
        }
      } catch { }
    }

    try {
      const res = await fetch("/api/lead-ms/get-create-offer", {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      const data = await res.json();

      // ✅ Handle 403 permission denied explicitly
      if (res.status === 403 || (data.message && data.message.toLowerCase().includes("permission"))) {
        setOffers([]);
        // Clear cache on permission denial
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem("offersCache");
          } catch { }
        }
        return;
      }

      if (data.success) {
        const next = data.offers || [];
        setOffers(next);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("offersCache", JSON.stringify(next));
          } catch { }
        }
      } else {
        // If permission denied, clear offers
        if (data.message && data.message.includes("permission")) {
          setOffers([]);
        }
      }
    } catch (err) {
      console.error("Error fetching offers:", err);
      // keep whatever is shown (cached) to avoid flash
    }
  };

  // Fetch offer analytics from billing data
  const fetchOfferAnalytics = async () => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    try {
      const res = await fetch("/api/clinic/offer-analytics", {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const apiData = data.data;
        // Transform API response to match expected format
        const billingRecords = (apiData.offerBilling?.billingRecords || []).map((r) => {
          const discountAmount = r.discountAmount ?? r.offerDiscountAmount ?? 0;
          const originalAmount = r.originalAmount || 0;
          const discountPercent = r.discountPercent
            ?? (originalAmount > 0 ? (discountAmount / originalAmount) * 100 : 0);
          return {
            ...r,
            discountAmount,
            discountPercent: Number(discountPercent) || 0,
          };
        });

        const typeStatsMap = {};
        billingRecords.forEach((r) => {
          const offerType = r.offerType || (r.isCashbackApplied ? "cashback" : "");
          if (!offerType) return;
          if (!typeStatsMap[offerType]) {
            typeStatsMap[offerType] = { offerType, count: 0, offerNames: new Set() };
          }
          typeStatsMap[offerType].count += 1;
          if (r.offerName) typeStatsMap[offerType].offerNames.add(r.offerName);
        });
        const typeStats = Object.values(typeStatsMap).map((item) => ({
          offerType: item.offerType,
          count: item.count,
          offerNames: Array.from(item.offerNames),
        }));
        const maxTypeCount = typeStats.reduce((max, item) => Math.max(max, item.count), 0);
        const mostUsedOffers = maxTypeCount > 0
          ? typeStats.filter((item) => item.count === maxTypeCount)
          : [];

        const underperformingOffers = (apiData.offersRequiringAttention || []).map((o) => ({
          ...o,
          title: o.title || o.offerName || "Offer",
          offerType: o.offerType || "",
          usedCount: o.usedCount ?? o.saleCount ?? 0,
        }));

        const transformedData = {
          instantDiscount: {
            count: apiData.offerBilling?.instantDiscount?.count || 0,
            totalDiscount: apiData.offerBilling?.instantDiscount?.totalDiscount || 0,
            totalRevenue: apiData.offerBilling?.instantDiscount?.totalRevenue || 0,
            list: billingRecords.filter(r => r.offerType === 'instant_discount'),
          },
          bundle: {
            count: apiData.offerBilling?.bundle?.count || 0,
            totalFreeSessions: apiData.offerBilling?.bundle?.totalFreeSessions || 0,
            totalRedeemed: apiData.offerBilling?.bundle?.totalRedeemed || 0,
          },
          cashback: {
            count: apiData.offerBilling?.cashback?.count || 0,
            totalCashbackEarned: apiData.offerBilling?.cashback?.totalCashback || 0,
            totalWalletUsed: apiData.offerBilling?.cashback?.totalWalletUsed || 0,
          },
          freeSessionRedemption: { count: 0, totalRedeemed: 0 },
          totalOfferBillings: apiData.offerBilling?.totalOfferCount || 0,
          offersUsedList: billingRecords,
          totalRevenue: apiData.offerBilling?.totalOfferRevenue || 0,
          revenueBillingList: billingRecords,
          mostUsedOffers,
          underperformingOffers,
          topPatientsList: [],
          allOffersStats: apiData.allOffersStats || {},
        };
        setOfferAnalytics(transformedData);
      }
    } catch (err) {
      console.error("Error fetching offer analytics:", err);
    }
  };

  useEffect(() => {
    // Fetch offers after permissions are loaded
    if (permissionsLoaded) {
      fetchOffers();
      fetchOfferAnalytics();
    }
  }, [permissionsLoaded, finalCanRead]);

  // Fetch master data names when viewing an offer
  useEffect(() => {
    const fetchMasterData = async () => {
      if (!viewingOffer) return;

      const authHeaders = getAuthHeaders();
      if (!authHeaders) return;

      try {
        // Fetch in parallel
        const [doctorsRes, deptsRes, servicesRes, clinicsRes, agentsRes] = await Promise.all([
          axios.get('/api/lead-ms/get-agents?role=doctorStaff', { headers: authHeaders }),
          axios.get('/api/clinic/departments?module', { headers: authHeaders }),
          axios.get('/api/clinic/services', { headers: authHeaders }),
          axios.get('/api/clinics/myallClinic', { headers: authHeaders }),
          axios.get('/api/lead-ms/get-agents', { headers: authHeaders })
        ]);

        if (doctorsRes.data.success) {
          const doctors = doctorsRes.data.agents || doctorsRes.data.data || [];
          const map = {};
          doctors.forEach(d => map[d._id] = d.name || d.title || 'Unknown Doctor');
          setDoctorNamesMap(map);
        }

        if (deptsRes.data.success) {
          const depts = deptsRes.data.departments || deptsRes.data.data || [];
          const map = {};
          depts.forEach(d => map[d._id] = d.name || d.title || 'Unknown Department');
          setDepartmentNamesMap(map);
        }

        if (servicesRes.data.success) {
          const services = servicesRes.data.services || servicesRes.data.data || [];
          const map = {};
          services.forEach(s => map[s._id] = s.name || s.mainTreatment || 'Unknown Service');
          setServiceNamesMap(map);
        }

        if (clinicsRes.data.success) {
          const clinic = clinicsRes.data.clinic || clinicsRes.data.data;
          if (clinic) {
            setClinicNamesMap({ [clinic._id]: clinic.name });
          }
        }

        if (agentsRes.data.success) {
          const agents = agentsRes.data.agents || agentsRes.data.data || [];
          const map = {};
          agents.forEach(a => map[a._id] = a.name || a.title || 'Unknown User');
          setUserNamesMap(map);
        }
      } catch (err) {
        console.error('Error fetching master data:', err);
      }
    };

    fetchMasterData();
  }, [viewingOffer]);

  // Fetch clinic currency preference
  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;
        const res = await axios.get('/api/clinics/myallClinic', { headers: authHeaders });
        if (res.data.success && res.data.clinic?.currency) {
          setCurrency(res.data.clinic.currency);
        }
      } catch (e) {
        console.error('Error fetching clinic currency:', e);
      }
    };
    fetchClinicCurrency();
  }, []);

  const openEditModal = async (offerId) => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      toast.error("Not authorized!");
      return;
    }
    // ✅ Strict check: Must have update permission
    if (finalCanUpdate !== true) {
      toast.error("You do not have permission to update offers");
      return;
    }
    setEditingOfferId(offerId);
    setModalOpen(true);

    try {
      const res = await fetch(`/api/lead-ms/update-offer?id=${offerId}`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = await res.json();

      // ✅ Handle 403 permission denied explicitly
      if (res.status === 403 || (data.message && data.message.toLowerCase().includes("permission"))) {
        toast.error(data.message || "You do not have permission to update offers");
        setModalOpen(false);
        return;
      }

      if (data.success) {
        setEditingOfferData(data.offer);
      } else {
        toast.error(data.message || "Failed to fetch offer");
        setModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Unable to load offer details");
      setModalOpen(false);
    }
  };

  const handleOfferSaved = (offer, isUpdate) => {
    if (isUpdate) {
      setOffers((prev) => prev.map((o) => (o._id === offer._id ? offer : o)));
    } else {
      setOffers((prev) => [offer, ...prev]);
    }
  };

  const requestDeleteOffer = (offer) => {
    // ✅ Strict check: Must have delete permission
    if (finalCanDelete !== true) {
      toast.error("You do not have permission to delete offers");
      return;
    }
    setConfirmModal({
      isOpen: true,
      offerId: offer._id,
      offerTitle: offer.title || "this offer",
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.offerId) return;
    const storedToken = getStoredToken();
    if (!storedToken) {
      toast.error("Not authorized!");
      return;
    }

    // ✅ Double-check permission before making API call
    if (finalCanDelete !== true) {
      toast.error("You do not have permission to delete offers");
      setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
      return;
    }

    try {
      const res = await fetch(`/api/lead-ms/delete-create-offer?id=${confirmModal.offerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = await res.json();

      // ✅ Handle 403 permission denied explicitly
      if (res.status === 403 || (data.message && data.message.toLowerCase().includes("permission"))) {
        toast.error(data.message || "You do not have permission to delete offers");
        setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
        return;
      }

      if (data.success) {
        setOffers((prev) => prev.filter((o) => o._id !== confirmModal.offerId));
        toast.success("Offer deleted successfully");
      } else {
        toast.error(data.message || "Failed to delete offer");
      }
    } catch (err) {
      console.error("Error deleting offer:", err);
      toast.error("Server error while deleting offer");
    } finally {
      setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
    }
  };

  // Export offers to CSV
  const exportOffersToCSV = () => {
    // Check if user has read permission
    if (finalCanRead !== true) {
      toast.error("You do not have permission to export offers");
      return;
    }

    if (offers.length === 0) {
      toast.error("No offers to export");
      return;
    }

    // Define CSV headers
    const headers = [
      "Title",
      "Description",
      "Type",
      "Value",
      "Code",
      "Slug",
      "Start Date",
      "End Date",
      "Status",
      "Created At",
      "Updated At"
    ];

    // Prepare CSV content
    const csvContent = [
      headers.join(","),
      ...offers.map(offer => [
        `"${(offer.title || '').replace(/"/g, '""')}"`,
        `"${(offer.description || '').replace(/"/g, '""')}"`,
        `"${offer.type || ''}"`,
        `"${offer.value || ''}"`,
        `"${offer.code || ''}"`,
        `"${offer.slug || ''}"`,
        `"${offer.startsAt ? new Date(offer.startsAt).toLocaleDateString() : ''}"`,
        `"${offer.endsAt ? new Date(offer.endsAt).toLocaleDateString() : ''}"`,
        `"${offer.status || ''}"`,
        `"${offer.createdAt ? new Date(offer.createdAt).toLocaleString() : ''}"`,
        `"${offer.updatedAt ? new Date(offer.updatedAt).toLocaleString() : ''}"`
      ].join(","))
    ].join("\n");

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `offers_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${offers.length} offers exported successfully!`);
  };

  // Calculate enhanced stats
  const activeOffers = offers.filter((o) => o.status === "active").length;
  const inactiveOffers = offers.filter((o) => o.status !== "active").length;
  const totalValue = offers.reduce((sum, o) => {
    if (o.type === "fixed") return sum + (o.value || 0);
    return sum;
  }, 0);
  const percentageOffers = offers.filter((o) => o.type === "percentage").length;
  const fixedOffers = offers.filter((o) => o.type === "fixed").length;
  const averageDiscount = offers.length > 0
    ? offers.reduce((sum, o) => sum + (o.value || 0), 0) / offers.length
    : 0;

  // Calculate expiring soon (next 7 days)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = offers.filter((o) => {
    if (!o.endsAt || o.status !== "active") return false;
    const endDate = new Date(o.endsAt);
    return endDate >= now && endDate <= sevenDaysFromNow;
  }).length;

  // All active offers that haven't expired yet, sorted by expiry (soonest first)
  const expiringOffersList = offers
    .filter((o) => {
      if (!o.endsAt || o.status !== "active") return false;
      const endDate = new Date(o.endsAt);
      return endDate >= now;
    })
    .sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt))
    .map((o) => {
      const endDate = new Date(o.endsAt);
      const diffMs = endDate - now;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      let timeLabel;
      if (diffHours < 1) timeLabel = 'Less than 1 hour';
      else if (diffHours < 24) timeLabel = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      else if (diffDays < 30) timeLabel = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      else {
        const diffMonths = Math.floor(diffDays / 30);
        timeLabel = `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
      }
      // Urgency color
      let urgency;
      if (diffDays === 0) urgency = { bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-100 text-red-700', label: 'Expires today' };
      else if (diffDays <= 3) urgency = { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: timeLabel };
      else if (diffDays <= 7) urgency = { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', label: timeLabel };
      else if (diffDays <= 30) urgency = { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: timeLabel };
      else urgency = { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', label: timeLabel };
      return { ...o, timeLabel, urgency };
    });

  // All inactive offers
  const inactiveOffersList = offers.filter((o) => o.status !== "active");

  // All active offers
  const activeOffersList = offers.filter((o) => o.status === "active");

  const modalToken = token || getStoredToken() || "";

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            fontSize: "12px",
            padding: "8px 12px",
            borderRadius: "8px",
          },
        }}
      />
      <div className="min-h-screen bg-[#FDFCFB] dark:bg-gray-900 p-3 sm:p-4">
        <div className="max-w-9xl mx-auto space-y-3">
          {!permissionsLoaded ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs sm:text-sm text-teal-700 dark:text-teal-300 font-medium">Loading permissions...</p>
            </div>
          ) : !finalCanRead && !finalCanCreate ? (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8 text-center max-w-md">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-teal-900 mb-2">Access Denied</h2>
                <p className="text-sm text-teal-700 mb-4">
                  You do not have permission to view or create clinic offers.
                </p>
                <p className="text-xs text-teal-600">
                  Please contact your administrator to request access to the Offers module.
                </p>
              </div>
            </div>
          ) : !finalCanRead && finalCanCreate ? (
            <div className="min-h-screen bg-[#FDFCFB] dark:bg-gray-900 p-3 sm:p-4">
              <div className="max-w-9xl mx-auto space-y-3">
                {/* Compact Header Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-teal-900 dark:text-white mb-0.5">Offers Management</h1>
                      <p className="text-[10px] sm:text-xs text-teal-600 dark:text-white">Create promotional offers for your clinic</p>
                    </div>
                    <div className="flex gap-2">
                      {finalCanCreate === true && (
                        <button
                          onClick={() => {
                            if (setActiveTab) {
                              setActiveTab('Create Offer');
                            } else {
                              setEditingOfferId(null);
                              setEditingOfferData(null);
                              setModalOpen(true);
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs font-medium"
                        >
                          <PlusCircle className="h-3 w-3" />
                          <span>Create New Offer</span>
                        </button>
                      )}
                      <button
                        onClick={exportOffersToCSV}
                        className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs font-medium"
                      >
                        <Download className="h-3 w-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Message when read is false but create is true */}
                <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6 text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Package className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-teal-900 mb-2">
                    Limited Access
                  </h3>
                  <p className="text-sm text-teal-700 mb-3">
                    You can create new offers, but you don't have permission to view existing offers.
                  </p>
                  <p className="text-xs text-teal-600">
                    Use the "Create New Offer" button above to add a new offer.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Compact Header Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E9E3D8] dark:border-gray-700 p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-950 dark:text-gray-100 mb-0.5">Offers Management</h1>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Create and manage promotional offers for your clinic</p>
                  </div>
                  <div className="flex gap-2">
                    {finalCanCreate === true && (
                      <button
                        onClick={() => {
                          if (setActiveTab) {
                            setActiveTab('Create Offer');
                          } else {
                            setEditingOfferId(null);
                            setEditingOfferData(null);
                            setModalOpen(true);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 bg-[#171717] dark:bg-indigo-600 hover:bg-[#303030] dark:hover:bg-indigo-700 text-white px-3 py-2 rounded-lg shadow-sm transition-all duration-200 text-xs sm:text-sm font-medium"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Create New Offer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Stats Cards - Row 1: Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-gray-800 dark:border-indigo-500 p-2.5 sm:p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-teal-800 dark:bg-teal-700 rounded-lg flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase">Total</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-teal-900 dark:text-gray-100">{offers.length}</p>
                </div>

                <div
                  onClick={() => activeOffersList.length > 0 && setShowActiveModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-green-600 p-2.5 sm:p-3 ${activeOffersList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-green-200 dark:ring-green-900/60 hover:ring-green-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase">Active</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{activeOffers}</p>
                  <p className="text-[9px] text-green-400 font-medium mt-0.5">
                    {activeOffersList.length > 0 ? 'Click to view all \u2192' : ''}
                  </p>
                </div>

                <div
                  onClick={() => inactiveOffersList.length > 0 && setShowInactiveModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-gray-500 p-2.5 sm:p-3 ${inactiveOffersList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-teal-500 rounded-lg flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase">Inactive</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-gray-200">{inactiveOffers}</p>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                    {inactiveOffersList.length > 0 ? 'Click to view all \u2192' : ''}
                  </p>
                </div>

                <div
                  onClick={() => expiringOffersList.length > 0 && setShowExpiringModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-amber-600 p-2.5 sm:p-3 ${expiringOffersList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-amber-200 dark:ring-amber-900/60 hover:ring-amber-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-amber-600 rounded-lg flex items-center justify-center">
                      <Calendar className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase">Expiring</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">{expiringOffersList.length}</p>
                  <p className="text-[9px] text-amber-500 dark:text-amber-400 font-medium mt-0.5">
                    {expiringOffersList.length > 0 ? `${expiringSoon} in 7 days \u00b7 Click to view all \u2192` : 'next 7 days'}
                  </p>
                </div>

                <div
                  onClick={() => offerAnalytics.instantDiscount.list.length > 0 && setShowDiscountModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-blue-600 p-2.5 sm:p-3 ${offerAnalytics.instantDiscount.list.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-blue-200 dark:ring-blue-900/60 hover:ring-blue-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Total Discount Applied</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400">{getCurrencySymbol(currency)}{offerAnalytics.instantDiscount.totalDiscount.toFixed(2)}</p>
                  <p className="text-[9px] text-blue-500 dark:text-blue-400 font-medium mt-0.5">
                    {offerAnalytics.instantDiscount.list.length > 0 ? 'Click to view details \u2192' : `${offerAnalytics.instantDiscount.count} invoice${offerAnalytics.instantDiscount.count !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Enhanced Stats Cards - Row 2: Analytics */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <div
                  onClick={() => offerAnalytics.offersUsedList.length > 0 && setShowOffersUsedModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-orange-500 p-2.5 sm:p-3 ${offerAnalytics.offersUsedList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-orange-200 dark:ring-orange-900/60 hover:ring-orange-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase">Total Offers Used</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">{offerAnalytics.totalOfferBillings}</p>
                  <p className="text-[9px] text-orange-400 dark:text-orange-400 font-medium mt-0.5">
                    {offerAnalytics.offersUsedList.length > 0 ? 'Click to view details \u2192' : 'instant + cashback + bundle'}
                  </p>
                </div>

                <div
                  onClick={() => offerAnalytics.revenueBillingList.length > 0 && setShowRevenueModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-green-600 p-2.5 sm:p-3 ${offerAnalytics.revenueBillingList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-green-200 dark:ring-green-900/60 hover:ring-green-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">Total Revenue</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-green-700 dark:text-green-400">{getCurrencySymbol(currency)}{offerAnalytics.totalRevenue.toFixed(2)}</p>
                  <p className="text-[9px] text-green-500 dark:text-green-400 font-medium mt-0.5">from offer-applied billings</p>
                  {offerAnalytics.revenueBillingList.length > 0 && (
                    <p className="text-[8px] text-green-400 mt-1 font-medium">Click to view billings \u2192</p>
                  )}
                </div>

                <div
                  onClick={() => offerAnalytics.mostUsedOffers.length > 0 && setShowMostUsedModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-purple-500 p-2.5 sm:p-3 ${offerAnalytics.mostUsedOffers.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-purple-200 dark:ring-purple-900/60 hover:ring-purple-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Gift className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Most Used Offer</p>
                  </div>
                  {offerAnalytics.mostUsedOffers.length > 0 ? (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-400">{offerAnalytics.mostUsedOffers.length}</p>
                      <p className="text-[9px] text-purple-400 font-medium mt-0.5">
                        {offerAnalytics.mostUsedOffers.map((o) => {
                          const label = o.offerType === 'instant_discount' ? 'Instant' : o.offerType === 'cashback' ? 'Cashback' : 'Bundle';
                          return `${label} (${o.count ?? o.saleCount ?? 0})`;
                        }).join(', ')}
                      </p>
                      <p className="text-[8px] text-purple-400 mt-1 font-medium">Click to view offers \u2192</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-gray-400">0</p>
                      <p className="text-[9px] text-gray-400 font-medium mt-0.5">No offers used yet</p>
                    </>
                  )}
                </div>

                <div
                  onClick={() => offerAnalytics.underperformingOffers.length > 0 && setShowUnderperformingModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-red-500 p-2.5 sm:p-3 ${offerAnalytics.underperformingOffers.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-red-200 dark:ring-red-900/60 hover:ring-red-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">Underperforming Offer</p>
                  </div>
                  {offerAnalytics.underperformingOffers.length > 0 ? (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-400">{offerAnalytics.underperformingOffers.length}</p>
                      <p className="text-[9px] text-red-400 font-medium mt-0.5">
                        {offerAnalytics.underperformingOffers.slice(0, 3).map((o) => o.title).join(', ')}
                        {offerAnalytics.underperformingOffers.length > 3 ? ` +${offerAnalytics.underperformingOffers.length - 3} more` : ''}
                      </p>
                      <p className="text-[8px] text-red-400 mt-1 font-medium">Click to view details \u2192</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-gray-400">0</p>
                      <p className="text-[9px] text-gray-400 font-medium mt-0.5">No offers created yet</p>
                    </>
                  )}
                </div>

                {/* Top Patients Card */}
                <div
                  onClick={() => offerAnalytics.topPatientsList.length > 0 && setShowTopPatientsModal(true)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-purple-500 p-2.5 sm:p-3 ${offerAnalytics.topPatientsList.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 ring-1 ring-purple-200 dark:ring-purple-900/60 hover:ring-purple-300' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Crown className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Top Patients</p>
                  </div>
                  {offerAnalytics.topPatientsList.length > 0 ? (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-400">{offerAnalytics.topPatientsList.length}</p>
                      <p className="text-[9px] text-purple-400 font-medium mt-0.5">
                        top patient{offerAnalytics.topPatientsList.length !== 1 ? 's' : ''}: {offerAnalytics.topPatientsList[0].patientName}
                      </p>
                      <p className="text-[8px] text-purple-400 mt-1 font-medium">Click to view top 5 \u2192</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg sm:text-xl font-bold text-gray-400">0</p>
                      <p className="text-[9px] text-gray-400 font-medium mt-0.5">No data yet</p>
                    </>
                  )}
                </div>
              </div>

              {/* Compact Offers Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E9E3D8] dark:border-gray-700 overflow-hidden shadow-[0_2px_8px_rgba(30,24,16,0.04)]">
                <div className="px-3 py-2.5 border-b border-[#E9E3D8] dark:border-gray-700 bg-[#FDFCFB] dark:bg-gray-800/90">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    <h2 className="text-sm sm:text-base font-bold text-gray-950 dark:text-gray-100">All Offers</h2>
                    <span className="ml-auto text-[10px] text-gray-600 dark:text-gray-300 bg-[#F5F2EC] dark:bg-gray-700 px-2 py-0.5 rounded-md">
                      {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3">
                  {offers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-10 h-10 bg-teal-100 dark:bg-teal-900/50 rounded-lg mb-2">
                        <Package className="h-5 w-5 text-teal-800 dark:text-teal-200" />
                      </div>
                      <h3 className="text-sm font-bold text-teal-900 dark:text-teal-100 mb-1">No offers yet</h3>
                      {finalCanRead === true ? (
                        <p className="text-teal-600 dark:text-teal-300 text-xs mb-3">Get started by creating your first promotional offer</p>
                      ) : (
                        <p className="text-teal-600 dark:text-teal-300 text-xs mb-3">You don't have permission to view offers, but you can create new ones</p>
                      )}
                      {finalCanCreate === true && (
                        <button
                          onClick={() => {
                            if (setActiveTab) {
                              setActiveTab('Create Offer');
                            } else {
                              setEditingOfferId(null);
                              setEditingOfferData(null);
                              setModalOpen(true);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors font-medium"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>Create Your First Offer</span>
                        </button>
                      )}
                      {finalCanCreate !== true && (
                        <p className="text-red-500 dark:text-red-400 text-xs">You do not have permission to create offers</p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#FDFCFB] dark:bg-gray-800/80">
                          <tr className="border-b border-[#E9E3D8] dark:border-gray-700">
                            <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Offer Details
                            </th>
                            <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Value
                            </th>
                            <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Validity
                            </th>
                            <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Revenue
                            </th>
                            <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Patients
                            </th>
                            <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEE9E1] dark:divide-gray-700">
                          {offers.map((offer) => {
                            const isExpiringSoon = offer.endsAt && offer.status === "active" &&
                              new Date(offer.endsAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
                              new Date(offer.endsAt) >= new Date();

                            return (
                              <tr key={offer._id} className="hover:bg-[#FAF8F4] dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${offer.offerType === "instant_discount" ? "bg-green-600" :
                                      offer.offerType === "bundle" ? "bg-amber-500" : "bg-blue-600"
                                      }`}>
                                      <Package className="h-3 w-3 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-950 dark:text-gray-100 text-xs truncate">{offer.title}</p>
                                      <p className="text-[10px] text-gray-400 dark:text-gray-500">ID: {offer._id.slice(-6)}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium capitalize ${offer.offerType === "instant_discount" ? "bg-[#F1F5F2] dark:bg-emerald-950/50 text-[#5C7D69] dark:text-emerald-300" :
                                    offer.offerType === "bundle" ? "bg-[#FBF4E8] dark:bg-amber-950/50 text-[#A87732] dark:text-amber-300" : "bg-[#EEF4F8] dark:bg-sky-950/50 text-[#527892] dark:text-sky-300"
                                    }`}>
                                    {offer.offerType?.replace("_", " ") || "—"}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className="text-xs sm:text-sm font-bold text-teal-900 dark:text-gray-100">
                                    {offer.offerType === "instant_discount" ? (
                                      offer.discountMode === "percentage" ? `${offer.discountValue}% OFF` : `${getCurrencySymbol(currency)}${offer.discountValue} OFF`
                                    ) : offer.offerType === "bundle" ? (
                                      `Buy ${offer.buyQty} Get ${offer.freeQty}`
                                    ) : (
                                      `${getCurrencySymbol(currency)}${offer.cashbackAmount} Cashback`
                                    )}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                    <Calendar className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span className="text-[10px] sm:text-xs">
                                      {offer.endsAt
                                        ? new Date(offer.endsAt).toLocaleDateString("en-US", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        })
                                        : "No expiry"}
                                    </span>
                                    {isExpiringSoon && (
                                      <span className="ml-1 px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[9px] font-semibold rounded">
                                        Soon
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                    {offerAnalytics.allOffersStats?.[offer._id]
                                      ? `${getCurrencySymbol(currency)}${(offerAnalytics.allOffersStats[offer._id].totalPaid ?? 0).toFixed(2)}`
                                      : '—'}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {offerAnalytics.allOffersStats?.[offer._id]?.patientCount || '—'}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${offer.status === "active"
                                      ? "bg-[#EFF7F1] dark:bg-emerald-950/50 text-[#48805C] dark:text-emerald-300 border border-[#CFE2D4] dark:border-emerald-800"
                                      : "bg-[#F5F2EC] dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-[#E9E3D8] dark:border-gray-600"
                                      }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full mr-1 ${offer.status === "active" ? "bg-[#65A878] dark:bg-emerald-400" : "bg-gray-400"
                                        }`}
                                    ></span>
                                    {offer.status}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-end gap-1">
                                    {finalCanRead === true && (
                                      <button
                                        onClick={() => setViewingOffer(offer)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
                                        title="View offer"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                    )}
                                    {finalCanUpdate === true && (
                                      <button
                                        onClick={() => openEditModal(offer._id)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
                                        title="Edit offer"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </button>
                                    )}
                                    {finalCanDelete === true && (
                                      <button
                                        onClick={() => requestDeleteOffer(offer)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/80 transition-colors"
                                        title="Delete offer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                    {!finalCanUpdate && !finalCanDelete && (
                                      <span className="text-[10px] text-teal-400">—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal */}
        <CreateOfferModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingOfferId(null);
            setEditingOfferData(null);
          }}
          onCreated={(offer) => handleOfferSaved(offer, !!editingOfferId)}
          token={modalToken}
          offer={editingOfferData}
          mode={editingOfferId ? "update" : "create"}
        />
        {/* View Offer Modal */}
        {viewingOffer && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setViewingOffer(null);
              }
            }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-teal-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-teal-200">
                    <Eye className="w-4 h-4 text-teal-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-700 dark:text-teal-100">Offer Details</p>
                    <p className="text-[10px] text-teal-700 truncate max-w-[320px]">{viewingOffer.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingOffer(null)}
                  className="text-teal-700 hover:bg-teal-200 rounded-lg p-1.5 transition-colors"
                  aria-label="Close details dialog"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6 text-xs sm:text-sm text-gray-700">
                {/* META INFORMATION - Top Full Width */}
                <div className="mb-6 bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                  <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                    <h3 className="text-sm font-bold text-teal-700 dark:text-teal-100">Meta Information</h3>
                  </div>
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-100 mb-1.5">Clinic</p>
                        <p className="text-xs text-gray-900 bg-teal-50 px-2 py-2 rounded-lg border border-teal-100 truncate">
                          {resolveName(viewingOffer?.clinicId, clinicNamesMap)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-100 mb-1.5">Created By</p>
                        <p className="text-xs text-gray-900 bg-teal-50 px-2 py-2 rounded-lg border border-teal-100 truncate">
                          {resolveName(viewingOffer?.createdBy, userNamesMap)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Updated By</p>
                        <p className="text-xs text-gray-900 bg-teal-50 px-2 py-2 rounded-lg border border-teal-100 truncate">
                          {resolveName(viewingOffer?.updatedBy, userNamesMap)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Created At</p>
                        <p className="text-xs text-gray-900 bg-teal-50 px-2 py-2 rounded-lg border border-teal-100">
                          {viewingOffer?.createdAt ? new Date(viewingOffer.createdAt).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Updated At</p>
                        <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">
                          {viewingOffer?.updatedAt ? new Date(viewingOffer.updatedAt).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TWO-COLUMN GRID FOR ALL SECTIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* LEFT COLUMN */}
                  <div className="space-y-6">
                    {/* BASIC SETTINGS */}
                    <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                      <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-100">Basic Settings</h3>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Title</p>
                          <p className="text-sm font-semibold text-gray-900 bg-teal-50 px-3 py-1 rounded-lg border border-teal-100">{viewingOffer.title || "—"}</p>
                        </div>
                        {/* <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Description</p>
                        {viewingOffer.description && viewingOffer.description.trim().length > 0 ? (
                          <p className="text-sm text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100 break-words">{viewingOffer.description}</p>
                        ) : (
                          <div className="border border-teal-200 rounded-lg px-3 py-2 min-h-[40px] bg-gray-50"></div>
                        )}
                      </div> */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Offer Type</p>
                            <span className="inline-flex items-center px-6 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 capitalize font-medium">
                              {viewingOffer.offerType?.replace("_", " ") || viewingOffer.type || "—"}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Status</p>
                            <span className="inline-flex items-center px-6 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 capitalize font-medium">
                              {viewingOffer.status || "—"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {/* <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Code</p>
                          <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">{viewingOffer.code || "—"}</p>
                        </div> */}
                          {/* <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Slug</p>
                          <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100 break-words">{viewingOffer.slug || "—"}</p>
                        </div> */}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Starts At</p>
                            <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">
                              {viewingOffer.startsAt ? new Date(viewingOffer.startsAt).toLocaleString() : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Ends At</p>
                            <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">
                              {viewingOffer.endsAt ? new Date(viewingOffer.endsAt).toLocaleString() : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">

                          {/* </div> */}
                        </div>
                      </div>
                    </div>

                    {/* OFFER DETAILS */}
                    <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                      <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-100">Offer Details</h3>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        {viewingOffer.offerType === "instant_discount" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Discount Mode</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 capitalize font-medium">
                                {viewingOffer.discountMode || "—"}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Discount Value</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {viewingOffer.discountMode === "percentage" ? `${viewingOffer.discountValue}%` : `${getCurrencySymbol(currency)}${viewingOffer.discountValue}`}
                              </span>
                            </div>
                          </div>
                        )}
                        {viewingOffer.offerType === "bundle" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Buy Quantity</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {viewingOffer.buyQty ?? "—"}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Free Quantity</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {viewingOffer.freeQty ?? "—"}
                              </span>
                            </div>
                          </div>
                        )}
                        {viewingOffer.offerType === "cashback" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Cashback Amount</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {getCurrencySymbol(currency)}{viewingOffer.cashbackAmount ?? "—"}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-1.5">Cashback Expiry (Days)</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 rounded-lg text-xs border border-teal-200 dark:border-teal-800 font-medium">
                                {viewingOffer.cashbackExpiryDays ?? "—"}
                              </span>
                            </div>
                          </div>
                        )}
                        {(!viewingOffer.offerType || (!["instant_discount", "bundle", "cashback"].includes(viewingOffer.offerType))) && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Type</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 capitalize font-medium">
                                {viewingOffer.type || "—"}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Value</p>
                              <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {typeof viewingOffer.value === "number" ? viewingOffer.value : "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-6">
                    {/* STACKING & CONTROL */}
                    <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                      <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-100">Stacking & Control</h3>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Auto Apply Best Offer</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${viewingOffer.autoApplyBestOffer !== false
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                              }`}>
                              {viewingOffer.autoApplyBestOffer !== false ? "ENABLED" : "DISABLED"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Allow Stacking</p>
                            <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                              {viewingOffer.allowCombiningWithOtherOffers ? "Yes" : "No"}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Receptionist Discount</p>
                            <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                              {viewingOffer.allowReceptionistDiscount ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Max Benefit Cap (%)</p>
                            <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                              {viewingOffer.maxBenefitCap ?? "—"}%
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Min Bill Amount</p>
                            <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                              {viewingOffer.minimumBillAmount ? `${getCurrencySymbol(currency)}${viewingOffer.minimumBillAmount}` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* APPLICABILITY CONTROL */}
                    <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                      <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-100">Applicability Control</h3>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Apply On</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 capitalize font-medium">
                            {viewingOffer.applyOnAllServices ? "All Services" :
                              viewingOffer.departmentIds?.length > 0 ? "Selected Departments" :
                                viewingOffer.doctorIds?.length > 0 ? "Selected Doctors" :
                                  viewingOffer.serviceIds?.length > 0 ? "Selected Services" : "—"}
                          </span>
                        </div>
                        {viewingOffer.serviceIds?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Selected Services</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(viewingOffer.serviceIds) && viewingOffer.serviceIds.map((s, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                  {resolveName(s, serviceNamesMap)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {viewingOffer.departmentIds?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Selected Departments</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(viewingOffer.departmentIds) && viewingOffer.departmentIds.map((d, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                  {resolveName(d, departmentNamesMap)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {viewingOffer.doctorIds?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Selected Doctors</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(viewingOffer.doctorIds) && viewingOffer.doctorIds.map((doc, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                  {resolveName(doc, doctorNamesMap)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SMART TOGGLES - COMMENTED OUT */}
                    {/* <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                      <h3 className="text-sm font-bold text-teal-900">Smart Toggles</h3>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Auto Apply Best Offer</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.autoApplyBestOffer !== false ? "Yes" : "No"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Allow Manual Override</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.allowManualOverride ? "Yes" : "No"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Require Approval</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.requireApprovalForOverride !== false ? "Yes" : "No"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Block if Margin Low (%)</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.blockIfProfitMarginBelowX !== false ? `${viewingOffer.blockIfProfitMarginBelowX}%` : "No"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div> */}

                    {/* USAGE LIMITS */}
                    {/* <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                      <h3 className="text-sm font-bold text-teal-900">Usage Limits</h3>
                    </div>
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Max Uses</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.maxUses ?? "Unlimited"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Uses Count</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.usesCount ?? 0}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Per User Limit</p>
                          <span className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                            {viewingOffer.perUserLimit ?? 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div> */}

                    {/* TREATMENTS & SUBTREATMENTS */}
                    {/* <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-5 py-3 border-b border-teal-200">
                      <h3 className="text-sm font-bold text-teal-900">Treatments</h3>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">Treatments</p>
                        {Array.isArray(viewingOffer.treatments) && viewingOffer.treatments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {viewingOffer.treatments.map((t, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {typeof t === "string" ? t : t?.name || t?._id || "—"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-teal-700 mb-1.5">SubTreatments</p>
                        {Array.isArray(viewingOffer.subTreatments) && viewingOffer.subTreatments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {viewingOffer.subTreatments.map((st, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-2 bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200 font-medium">
                                {st?.name || st?.slug || "—"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">—</p>
                        )}
                      </div>
                    </div>
                  </div> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Compact Delete Confirmation Modal */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
              toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-red-50 dark:bg-red-950/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/60 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-teal-900 dark:text-gray-100">Delete Offer</p>
                  <p className="text-[10px] text-teal-700 dark:text-gray-300 truncate max-w-[200px]">"{confirmModal.offerTitle}"</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-red-500 text-teal-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close confirmation dialog"
              >
                ×
              </button>
            </div>
            <div className="p-4 text-xs sm:text-sm text-teal-700 dark:text-gray-300 space-y-1.5">
              <p>Are you sure you want to delete this offer? This action cannot be undone.</p>
              <p className="text-[10px] text-teal-600 dark:text-gray-400">All references to this offer will be removed.</p>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => {
                  setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium text-teal-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Most Used Offer Modal ── */}
      {showMostUsedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMostUsedModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Most Used Offer</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {offerAnalytics.mostUsedOffers.length > 1
                        ? `${offerAnalytics.mostUsedOffers.length} types tied at ${offerAnalytics.mostUsedOffers[0].count} uses`
                        : `${offerAnalytics.mostUsedOffers[0]?.count || 0} times used`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowMostUsedModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
              {offerAnalytics.mostUsedOffers.map((item, idx) => {
                const typeLabel = item.offerType === 'instant_discount' ? 'Instant Discount' : item.offerType === 'cashback' ? 'Cashback' : 'Bundle';
                const typeColor = item.offerType === 'instant_discount'
                  ? { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' }
                  : item.offerType === 'cashback'
                  ? { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' }
                  : { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' };
                const offerNames = item.offerNames || (item.offerName ? [item.offerName] : []);
                const useCount = item.count ?? item.saleCount ?? 0;

                return (
                  <div key={idx} className={`rounded-xl border ${typeColor.border} ${typeColor.bg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${typeColor.badge}`}>
                          {typeLabel}
                        </span>
                      </div>
                      <span className={`text-sm font-extrabold ${typeColor.text}`}>
                        {useCount} {useCount === 1 ? 'use' : 'uses'}
                      </span>
                    </div>
                    {offerNames.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Offer Names</p>
                        <div className="flex flex-wrap gap-1.5">
                          {offerNames.map((name, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">No offer names recorded</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <button
                onClick={() => setShowMostUsedModal(false)}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Underperforming Offer Modal ── */}
      {showUnderperformingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowUnderperformingModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Underperforming Offers</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      Offers used 0 or 1 time — {offerAnalytics.underperformingOffers.length} underperforming
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowUnderperformingModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {offerAnalytics.underperformingOffers.map((item, idx) => {
                const typeLabel = item.offerType === 'instant_discount' ? 'Instant Discount' : item.offerType === 'cashback' ? 'Cashback' : 'Bundle';
                const typeColor = item.offerType === 'instant_discount'
                  ? { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' }
                  : item.offerType === 'cashback'
                  ? { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', badge: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' }
                  : { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', badge: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' };

                return (
                  <div key={idx} className={`rounded-xl border ${typeColor.border} ${typeColor.bg} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${typeColor.badge}`}>
                          {typeLabel}
                        </span>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-lg font-extrabold text-red-600 dark:text-red-400">{item.usedCount}</p>
                        <p className="text-[9px] text-red-400 dark:text-red-300 font-medium">{item.usedCount === 1 ? 'use' : 'uses'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <button
                onClick={() => setShowUnderperformingModal(false)}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Total Revenue Modal ── */}
      {showRevenueModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRevenueModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Total Revenue</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {getCurrencySymbol(currency)}{offerAnalytics.totalRevenue.toFixed(2)} from {offerAnalytics.revenueBillingList.length} billing{offerAnalytics.revenueBillingList.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowRevenueModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Offer Applied</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {offerAnalytics.revenueBillingList.map((billing, idx) => {
                    const offerTypeLabel = billing.offerType === 'instant_discount' ? 'Instant' : billing.offerType === 'cashback' ? 'Cashback' : billing.offerType === 'bundle' ? 'Bundle' : '';
                    const offerTypeColor = billing.offerType === 'instant_discount'
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                      : billing.offerType === 'cashback'
                      ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300'
                      : 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300';

                    return (
                      <tr key={idx} className="hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{billing.patientName}</p>
                          <p className="text-[9px] text-gray-400 dark:text-gray-400">{billing.invoicedDate ? new Date(billing.invoicedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-700 dark:text-gray-300">{billing.invoiceNumber}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {billing.offerName && (
                              <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">{billing.offerName}</p>
                            )}
                            {offerTypeLabel && (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider w-fit ${offerTypeColor}`}>
                                {offerTypeLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs font-extrabold text-green-700 dark:text-green-400">{getCurrencySymbol(currency)}{(billing.amount || 0).toFixed(2)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{offerAnalytics.revenueBillingList.length} billing{offerAnalytics.revenueBillingList.length !== 1 ? 's' : ''}</p>
              <button
                onClick={() => setShowRevenueModal(false)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Total Offers Used Modal ── */}
      {showOffersUsedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOffersUsedModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Total Offers Used</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {offerAnalytics.totalOfferBillings} billing{offerAnalytics.totalOfferBillings !== 1 ? 's' : ''} with offers applied
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowOffersUsedModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {offerAnalytics.offersUsedList.map((billing, idx) => {
                const typeLabel = billing.offerType === 'instant_discount' ? 'Instant Discount' : billing.offerType === 'cashback' ? 'Cashback' : billing.offerType === 'bundle' ? 'Bundle' : 'Offer';
                const typeColor = billing.offerType === 'instant_discount'
                  ? { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' }
                  : billing.offerType === 'cashback'
                  ? { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' }
                  : billing.offerType === 'bundle'
                  ? { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' }
                  : { bg: 'bg-gray-50 dark:bg-gray-700/40', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };

                return (
                  <div key={idx} className={`rounded-xl border ${typeColor.border} ${typeColor.bg} p-3 flex items-center justify-between hover:shadow-sm transition-shadow`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${typeColor.badge} flex items-center justify-center flex-shrink-0`}>
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{billing.patientName}</p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-400">{billing.invoicedDate ? new Date(billing.invoicedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">{billing.offerName || '—'}</p>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${typeColor.badge}`}>
                          {typeLabel}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[9px] font-bold text-gray-600 dark:text-gray-300">{billing.invoiceNumber}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{offerAnalytics.offersUsedList.length} billing{offerAnalytics.offersUsedList.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowOffersUsedModal(false)} className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Total Discount Applied Modal ── */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDiscountModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Total Discount Applied</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {getCurrencySymbol(currency)}{offerAnalytics.instantDiscount.totalDiscount.toFixed(2)} total discount &middot; {offerAnalytics.instantDiscount.count} invoice{offerAnalytics.instantDiscount.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowDiscountModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content - Table */}
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Offer</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Disc %</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Disc Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(offerAnalytics.instantDiscount.list || []).map((billing, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{billing.patientName}</p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-400">{billing.invoicedDate ? new Date(billing.invoicedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-700 dark:text-gray-300">{billing.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">{billing.offerName}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">{Number(billing.discountPercent || 0).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-extrabold text-red-600 dark:text-red-400">-{getCurrencySymbol(currency)}{Number(billing.discountAmount ?? billing.offerDiscountAmount ?? 0).toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{offerAnalytics.instantDiscount.list.length} invoice{offerAnalytics.instantDiscount.list.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowDiscountModal(false)} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Expiring Offers Modal ── */}
      {showExpiringModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowExpiringModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Expiring Offers</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {expiringOffersList.length} active offer{expiringOffersList.length !== 1 ? 's' : ''} not yet expired
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowExpiringModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {expiringOffersList.map((offer) => (
                <div key={offer._id} className={`rounded-xl border ${offer.urgency.border} ${offer.urgency.bg} p-3 flex items-center justify-between hover:shadow-sm transition-shadow`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${offer.urgency.badge} flex items-center justify-center flex-shrink-0`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{offer.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          offer.offerType === 'instant_discount' ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' :
                          offer.offerType === 'cashback' ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' :
                          'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300'
                        }`}>
                          {offer.offerType === 'instant_discount' ? 'Instant' : offer.offerType === 'cashback' ? 'Cashback' : 'Bundle'}
                        </span>
                        <p className="text-[9px] text-gray-400 dark:text-gray-400">
                          Ends: {new Date(offer.endsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${offer.urgency.badge}`}>
                      {offer.urgency.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{expiringOffersList.length} offer{expiringOffersList.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowExpiringModal(false)} className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inactive Offers Modal ── */}
      {showInactiveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInactiveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-600 to-slate-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Inactive Offers</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {inactiveOffersList.length} inactive offer{inactiveOffersList.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowInactiveModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-2">
              {inactiveOffersList.map((offer) => (
                <div key={offer._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{offer.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          offer.offerType === 'instant_discount' ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' :
                          offer.offerType === 'cashback' ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' :
                          'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300'
                        }`}>
                          {offer.offerType === 'instant_discount' ? 'Instant' : offer.offerType === 'cashback' ? 'Cashback' : 'Bundle'}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[8px] font-bold text-gray-600 dark:text-gray-300 uppercase">
                          {offer.status || 'inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {offer.endsAt && (
                    <p className="text-[9px] text-gray-400 dark:text-gray-400 flex-shrink-0">
                      Ended: {new Date(offer.endsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{inactiveOffersList.length} offer{inactiveOffersList.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowInactiveModal(false)} className="px-4 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Offers Modal ── */}
      {showActiveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowActiveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Active Offers</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      {activeOffersList.length} active offer{activeOffersList.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowActiveModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-2">
              {activeOffersList.map((offer) => (
                <div key={offer._id} className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/60 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{offer.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          offer.offerType === 'instant_discount' ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' :
                          offer.offerType === 'cashback' ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300' :
                          'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300'
                        }`}>
                          {offer.offerType === 'instant_discount' ? 'Instant' : offer.offerType === 'cashback' ? 'Cashback' : 'Bundle'}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-green-200 dark:bg-green-900/60 text-green-700 dark:text-green-300 text-[8px] font-bold uppercase">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  {offer.endsAt && (
                    <p className="text-[9px] text-gray-400 dark:text-gray-400 flex-shrink-0">
                      Ends: {new Date(offer.endsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{activeOffersList.length} offer{activeOffersList.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowActiveModal(false)} className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Patients Modal ── */}
      {showTopPatientsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTopPatientsModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Top Patients</h3>
                    <p className="text-[10px] text-white/70 font-medium">
                      Top 5 patients by offer usage frequency
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowTopPatientsModal(false)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {offerAnalytics.topPatientsList.map((patient, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={patient.patientId} className={`rounded-xl border p-3 ${idx === 0 ? 'border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30' : idx === 1 ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40' : idx === 2 ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/20'} hover:shadow-sm transition-shadow`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{medals[idx] || `#${idx + 1}`}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{patient.patientName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-bold">
                          {patient.count} {patient.count === 1 ? 'use' : 'uses'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(patient.offerNames || []).map((name, i) => (
                        <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-[9px] font-medium text-gray-600 dark:text-gray-300">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{offerAnalytics.topPatientsList.length} patient{offerAnalytics.topPatientsList.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowTopPatientsModal(false)} className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Wrap in layout
OffersPage.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

// Export unwrapped base component for reuse (agent portal)
export const CreateOfferPageBase = OffersPage;

// Protect page and preserve layout
const ProtectedOffersPage = withClinicAuth(OffersPage);
ProtectedOffersPage.getLayout = OffersPage.getLayout;

export default ProtectedOffersPage
