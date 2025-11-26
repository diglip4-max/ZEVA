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
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import CreateOfferModal from "../../components/CreateOfferModal";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";

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

function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [editingOfferData, setEditingOfferData] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: undefined,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [token, setToken] = useState("");
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    offerId: null,
    offerTitle: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const storedToken = getStoredToken();
      setToken(storedToken || "");
      setHasAgentToken(Boolean(localStorage.getItem("agentToken")));
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath =
      router?.pathname?.startsWith("/agent/") ||
      window.location.pathname?.startsWith("/agent/");
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [router.pathname, hasAgentToken]);

  const {
    permissions: agentPermissions,
    loading: agentPermissionsLoading,
  } = useAgentPermissions(isAgentRoute ? "create_offers" : null);

  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    setPermissions({
      canCreate: agentPermissions.canAll || agentPermissions.canCreate,
      canUpdate: agentPermissions.canAll || agentPermissions.canUpdate,
      canDelete: agentPermissions.canAll || agentPermissions.canDelete,
      canRead: agentPermissions.canAll || agentPermissions.canRead,
    });
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;
    const headers = getAuthHeaders();
    if (!headers) {
      setPermissions({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canRead: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    const fetchClinicPermissions = async () => {
      try {
        setPermissionsLoaded(false);
        const { data } = await axios.get("/api/clinic/permissions", {
          headers,
        });
        if (!isMounted) return;
        if (data.success && data.data) {
          const modulePermission = data.data.permissions?.find((p) => {
            if (!p?.module) return false;
            const normalized = p.module.startsWith("clinic_")
              ? p.module.slice(7)
              : p.module.startsWith("admin_")
              ? p.module.slice(6)
              : p.module;
            return normalized === "create_offers";
          });
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            const moduleAll = actions.all === true;
            setPermissions({
              canCreate: moduleAll || actions.create === true,
              canUpdate: moduleAll || actions.update === true,
              canDelete: moduleAll || actions.delete === true,
              canRead: moduleAll || actions.read === true,
            });
          } else {
            setPermissions({
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              canRead: false,
            });
          }
        } else {
          setPermissions({
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canRead: false,
          });
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        if (isMounted) {
          setPermissions({
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canRead: false,
          });
        }
      } finally {
        if (isMounted) {
          setPermissionsLoaded(true);
        }
      }
    };

    fetchClinicPermissions();

    return () => {
      isMounted = false;
    };
  }, [isAgentRoute, token]);

  // Fetch all offers
  const fetchOffers = async () => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;
  
    // Wait for permissions to load
    if (!permissionsLoaded) return;
    
    // Check if user has read permission
    if (permissions.canRead === false) {
      setOffers([]);
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
      } catch {}
    }

    try {
      const res = await fetch("/api/lead-ms/get-create-offer", {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (data.success) {
        const next = data.offers || [];
        setOffers(next);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("offersCache", JSON.stringify(next));
          } catch {}
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

  useEffect(() => {
    // Fetch offers after permissions are loaded
    if (permissionsLoaded) {
      fetchOffers();
    }
  }, [permissionsLoaded, permissions.canRead]);

  const openEditModal = async (offerId) => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      toast.error("Not authorized!");
      return;
    }
    if (!permissions.canUpdate) {
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
    if (!permissions.canDelete) {
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

    try {
      const res = await fetch(`/api/lead-ms/delete-create-offer?id=${confirmModal.offerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = await res.json();
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

  // Calculate stats
  const activeOffers = offers.filter((o) => o.status === "active").length;
  const totalValue = offers.reduce((sum, o) => {
    if (o.type === "fixed") return sum + (o.value || 0);
    return sum;
  }, 0);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-white p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {!permissionsLoaded ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-700 font-medium">Loading permissions...</p>
          </div>
        ) : permissions.canRead === false ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full">
              <Package className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
            <p className="text-sm text-gray-700">
              You do not have permission to view or manage offers. Please contact your administrator if you
              believe this is an error.
            </p>
          </div>
        ) : (
          <>
            {/* Header Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 mb-0.5">Offers Management</h1>
                  <p className="text-gray-700 text-xs">Create and manage promotional offers for your clinic</p>
                </div>
                {permissions.canCreate && (
                  <button
                    onClick={() => {
                      setEditingOfferId(null);
                      setEditingOfferData(null);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-md shadow hover:shadow-md transition-all duration-200 text-xs font-medium"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Create New Offer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-700 mb-0.5">Total Offers</p>
                    <p className="text-xl font-bold text-gray-900">{offers.length}</p>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-md">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-700 mb-0.5">Active Offers</p>
                    <p className="text-xl font-bold text-green-600">{activeOffers}</p>
                  </div>
                  <div className="bg-green-100 p-2 rounded-md">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-700 mb-0.5">Total Discount Value</p>
                    <p className="text-xl font-bold text-teal-600">AED {totalValue.toLocaleString()}</p>
                  </div>
                  <div className="bg-teal-100 p-2 rounded-md">
                    <span className="text-[10px] font-bold text-teal-600 tracking-wide">AED</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Offers Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-teal-600" />
                  <h2 className="text-base font-semibold text-gray-900">All Offers</h2>
                </div>
              </div>

              <div className="p-3">
                {offers.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-2.5">
                      <Package className="h-6 w-6 text-gray-500" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No offers yet</h3>
                    <p className="text-gray-700 text-xs mb-4">Get started by creating your first promotional offer</p>
                    {permissions.canCreate && (
                      <button
                        onClick={() => {
                          setEditingOfferId(null);
                          setEditingOfferData(null);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded text-xs transition-colors"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Create Your First Offer</span>
                      </button>
                    )}
                    {!permissions.canCreate && (
                      <p className="text-red-500 text-xs">You do not have permission to create offers</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Offer Details
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Validity
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {offers.map((offer) => (
                          <tr key={offer._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-teal-600 rounded flex items-center justify-center flex-shrink-0">
                                  <Package className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-xs">{offer.title}</p>
                                  <p className="text-[11px] text-gray-700">ID: {offer._id.slice(-8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 capitalize">
                                {offer.type}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-sm font-bold text-teal-600">
                                {offer.type === "percentage" ? `${offer.value}%` : `AED ${offer.value}`}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1 text-gray-700">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span className="text-[11px]">
                                  {offer.endsAt
                                    ? new Date(offer.endsAt).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "No expiry"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  offer.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                    offer.status === "active" ? "bg-green-500" : "bg-gray-500"
                                  }`}
                                ></span>
                                {offer.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {permissions.canUpdate && (
                                  <button
                                    onClick={() => openEditModal(offer._id)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="Edit offer"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                )}
                                {permissions.canDelete && (
                                  <button
                                    onClick={() => requestDeleteOffer(offer)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                    title="Delete offer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                                {!permissions.canUpdate && !permissions.canDelete && (
                                  <span className="text-xs text-gray-400">No actions available</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
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
    </div>
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
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
            className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-red-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Delete Offer</p>
                  <p className="text-xs text-gray-700">"{confirmModal.offerTitle}"</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="p-1.5 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Close confirmation dialog"
              >
                ×
              </button>
            </div>
            <div className="p-5 text-sm text-gray-700 space-y-2">
              <p>Are you sure you want to delete this offer? This action cannot be undone.</p>
              <p className="text-xs text-gray-700">All references to this offer will be removed.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => {
                  setConfirmModal({ isOpen: false, offerId: null, offerTitle: "" });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
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

// Protect page and preserve layout
const ProtectedOffersPage = withClinicAuth(OffersPage);
ProtectedOffersPage.getLayout = OffersPage.getLayout;

export default ProtectedOffersPage
