import React, { useState, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import axios from "axios";
import { Building2, Edit3, X, Plus, Camera, ChevronLeft, ChevronRight, Clock, MapPin, DollarSign, Users, Star, Heart, Activity, Eye, Check } from "lucide-react";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import type { NextPageWithLayout } from "../_app";
import Loader from "@/components/Loader";
import { getUserRole } from "@/lib/helper";
import { getAuthHeaders } from "@/lib/helper";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

// Types
interface Clinic {
  _id: string;
  name: string;
  address: string;
  pricing: string;
  timings: string;
  servicesName: string[];
  treatments: Array<{
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
      price?: number;
    }>;
  }>;
  photos: (string | File)[];
  createdAt: string;
  slug: string;
  averageRating?: number;
  totalReviews?: number;
  totalEnquiries?: number;
}

interface Treatment {
  _id: string;
  name: string;
  subcategories: Array<{
    name: string;
    price?: number;
  }>;
}

// Summary Card Component
// interface SummaryCardProps {
//   title: string;
//   value: string | number;
//   icon: React.ReactNode;
//   color: "teal" | "yellow" | "rose" | "green";
// }

// const SummaryCard = ({ title, value, icon, color }: SummaryCardProps) => {
//   const colorClasses = {
//     teal: "bg-gray-50 border-gray-200 text-teal-800",
//     yellow: "bg-gray-50 border-gray-200 text-teal-800",
//     rose: "bg-gray-50 border-gray-200 text-teal-800",
//     green: "bg-gray-50 border-gray-200 text-teal-800",
//   };

//   const [_bgColor, borderColor, textColor] = colorClasses[color].split(' ');

//   return (
//     <div className={`bg-white rounded-lg p-2.5 sm:p-3 border ${borderColor} shadow-sm`}>
//       <div className={`flex items-center gap-1.5 mb-1.5 ${textColor}`}>
//         {icon}
//         <span className="text-[10px] sm:text-xs font-semibold text-teal-700 truncate">{title}</span>
//       </div>
//       <p className="text-base sm:text-lg font-bold text-teal-900">{value}</p>
//     </div>
//   );
// };

function ClinicManagementDashboard() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Clinic>>({});
  const [newTreatment, setNewTreatment] = useState("");
  const [newSubTreatment, setNewSubTreatment] = useState("");
  const [newSubTreatmentPrice, setNewSubTreatmentPrice] = useState("");
  const [selectedTreatmentIndex, setSelectedTreatmentIndex] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [updating, setUpdating] = useState(false);
  const [availableTreatments, setAvailableTreatments] = useState<Treatment[]>([]);
  const [selectedAvailableTreatmentId, setSelectedAvailableTreatmentId] = useState<string>("");
  const [customSubTreatmentPrices, setCustomSubTreatmentPrices] = useState<Record<string, number>>({});
  const [showSubTreatmentDropdown, setShowSubTreatmentDropdown] = useState<number | null>(null);
  const [permissions] = useState({
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });
  const [permissionsLoaded] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [reviewsData, setReviewsData] = useState<any>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [customAdded, setCustomAdded] = useState(false);

  // Fetch clinics
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          toast.error("You are not authenticated");
          setLoading(false);
          return;
        }

        const response = await axios.get("/api/clinics/myallClinic", {
          headers: authHeaders,
        });

        if (response.data.success) {
          const sanitizePhotos = (arr: any[]) =>
            Array.isArray(arr)
              ? arr
                  .map((p: any) =>
                    typeof p === "string" ? p.trim().replace(/^['\"`]+|['\"`]+$/g, "") : p
                  )
                  .filter((p: any) => typeof p === "string" && p.length > 0)
              : [];
          const clinicObj = response.data.clinic
            ? {
                ...response.data.clinic,
                photos: sanitizePhotos(response.data.clinic.photos || []),
              }
            : null;
          setClinics(clinicObj ? [clinicObj] : []);
          if (clinicObj && Array.isArray(clinicObj.photos) && clinicObj.photos.length > 0) {
            setCurrentPhotoIndex(clinicObj.photos.length - 1);
          }
        } else {
          toast.error(response.data.message || "Failed to fetch clinics");
        }
      } catch (error: any) {
        console.error("Error fetching clinics:", error);
        toast.error("Failed to fetch clinics");
      } finally {
        setLoading(false);
      }
    };

    fetchClinics();
  }, []);

  // Fetch available treatments for dropdown add
  useEffect(() => {
    const fetchAvailableTreatments = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;
        const res = await axios.get("/api/doctor/getTreatment", { headers: authHeaders });
        if (Array.isArray(res.data?.treatments)) {
          setAvailableTreatments(res.data.treatments);
        }
      } catch (err) {
        console.error("Error fetching available treatments:", err);
      }
    };
    fetchAvailableTreatments();
  }, []);

  const addTreatmentFromAvailable = (t: Treatment) => {
    if (!t?.name) return;
    setEditForm(prev => {
      const existingIndex = (prev.treatments || []).findIndex(
        (mt: any) => mt.mainTreatment?.toLowerCase() === t.name.toLowerCase()
      );
      if (existingIndex !== -1) {
        setSelectedTreatmentIndex(existingIndex);
        return prev;
      }
      const newTreatmentObj = {
        mainTreatment: t.name,
        mainTreatmentSlug: t.name.toLowerCase().replace(/\s+/g, '-'),
        subTreatments: []
      };
      const updated = {
        ...prev,
        treatments: [newTreatmentObj, ...(prev.treatments || [])]
      };
      setSelectedTreatmentIndex(0);
      return updated;
    });
  };

  const addSubTreatmentFromAvailable = (sub: { name: string; price?: number }, targetIndex: number | null) => {
    if (!sub?.name || targetIndex === null) return;
    setEditForm(prev => {
      const updatedTreatments = [...(prev.treatments || [])];
      if (!updatedTreatments[targetIndex]) return prev;
      const exists = (updatedTreatments[targetIndex].subTreatments || []).some(
        (st: any) => st.name?.toLowerCase() === sub.name.toLowerCase()
      );
      if (exists) return prev;
      updatedTreatments[targetIndex] = {
        ...updatedTreatments[targetIndex],
        subTreatments: [
          ...(updatedTreatments[targetIndex].subTreatments || []),
          {
            name: sub.name,
            slug: sub.name.toLowerCase().replace(/\s+/g, '-'),
            price: typeof sub.price === "number" && sub.price > 0 ? sub.price : undefined
          }
        ]
      };
      return { ...prev, treatments: updatedTreatments };
    });
  };

  // Fetch dashboard stats
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          console.error("Not authenticated to fetch stats");
          return;
        }

        setStatsLoading(true);
        const response = await axios.get("/api/clinics/dashboardStats", {
          headers: authHeaders,
        });

        if (response.data.success) {
          setDashboardStats(response.data.stats);
        } else {
          console.error("Failed to fetch dashboard stats:", response.data.message);
        }
      } catch (error: any) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Fetch reviews data
  useEffect(() => {
    const fetchReviews = async () => {
      if (clinics.length === 0) return;
      
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          console.error("Not authenticated to fetch reviews");
          return;
        }

        setReviewsLoading(true);
        // Use the first clinic's ID to fetch reviews
        const clinicId = clinics[0]?._id;
        if (!clinicId) return;

        const response = await axios.get(`/api/clinics/reviews/${clinicId}`, {
          headers: authHeaders,
        });

        if (response.data.success) {
          setReviewsData(response.data.data);
        } else {
          console.error("Failed to fetch reviews:", response.data.message);
        }
      } catch (error: any) {
        console.error("Error fetching reviews:", error);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [clinics]);

  // Handle input changes
  const handleInputChange = (field: string, value: string | string[] | File[] | (string | File)[]) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const removePhotoAt = (index: number) => {
    setEditForm((prev) => {
      const arr = [...(prev.photos || [])];
      if (index < 0 || index >= arr.length) return prev;
      const target = arr[index];
      const updated = arr.filter((_, i) => i !== index);
      setSelectedFiles((sf) => {
        if (target instanceof File) {
          return sf.filter((f) => f !== target);
        }
        return sf;
      });
      setCurrentPhotoIndex((cp) => {
        const nextLen = updated.length;
        if (nextLen === 0) return 0;
        return Math.min(cp, nextLen - 1);
      });
      return { ...prev, photos: updated };
    });
  };

  // Handle edit click
  const handleEdit = (clinic: Clinic) => {
    console.log("✏️ Editing clinic:", clinic);
    console.log("📸 Clinic photos:", clinic.photos);
    setIsEditing(true);
    setEditingClinicId(clinic._id);
    const sanitizedPhotos =
      Array.isArray(clinic.photos)
        ? clinic.photos
            .map((p: any) =>
              typeof p === "string" ? p.trim().replace(/^['"`]+|['"`]+$/g, "").replace(/\\/g, "/") : p
            )
            .filter((p: any) => {
              if (p instanceof File) return true;
              if (typeof p === "string") return p.length > 0;
              return false;
            })
        : [];
    setEditForm({ ...clinic, photos: sanitizedPhotos as any });
    setCurrentPhotoIndex(sanitizedPhotos.length > 0 ? sanitizedPhotos.length - 1 : 0);
    console.log("📝 Edit form initialized with:", { ...clinic });
    console.log("📝 Edit form photos:", clinic.photos);
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setEditingClinicId(null);
    setEditForm({});
  };

  // Handle update
  const handleUpdate = async () => {
    if (!editingClinicId) return;
    setUpdating(true);
    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders) {
        toast.error("You are not authenticated");
        return;
      }
      const toRelativeUploadPath = (s: string) => {
        let out = s.trim().replace(/^['"`]+|['"`]+$/g, "");
        try {
          if (out.startsWith("http://") || out.startsWith("https://")) {
            const u = new URL(out);
            return u.pathname || out;
          }
        } catch {}
        if (out.includes("uploads")) {
          const idx = out.indexOf("uploads");
          return `/${out.substring(idx).replace(/\\/g, "/")}`;
        }
        if (out.startsWith("/")) return out;
        return `/uploads/clinic/${out}`;
      };
      const existingPhotos = (editForm.photos || [])
        .filter((p: any) => typeof p === "string" && String(p).trim().length > 0)
        .map((p: any) => toRelativeUploadPath(String(p)));
      const baseClinic = clinics[0] || ({} as any);
      const safeName = (editForm.name ?? baseClinic.name ?? "").trim();
      const safeAddress = (editForm.address ?? baseClinic.address ?? "").trim();
      const filesFromEdit = (editForm.photos || []).filter((p: any) => p instanceof File) as File[];
      const filesToUploadMap = new Map<string, File>();
      [...(selectedFiles || []), ...filesFromEdit].forEach((f) => {
        const key = `${f.name}-${f.size}-${f.type}`;
        if (!filesToUploadMap.has(key)) filesToUploadMap.set(key, f);
      });
      const filesToUpload = Array.from(filesToUploadMap.values());
      const hasFiles = filesToUpload.length > 0;
      if (hasFiles) {
        const form = new FormData();
        form.append("name", safeName);
        form.append("address", safeAddress);
        if (editForm.pricing) form.append("pricing", editForm.pricing.trim());
        if (editForm.timings) form.append("timings", editForm.timings.trim());
        if (editForm.servicesName)
          form.append("servicesName", JSON.stringify(editForm.servicesName));
        if (editForm.treatments)
          form.append("treatments", JSON.stringify(editForm.treatments));
        form.append("existingPhotos", JSON.stringify(existingPhotos));
        filesToUpload.forEach((file) => form.append("photos", file));
        try {
          const response = await axios.put(
            `/api/clinics/${editingClinicId}`,
            form,
            { headers: { ...authHeaders } }
          );
          if (!response.data.success) {
            toast.error(response.data.message || "Failed to update clinic");
            return;
          }
        } catch (err: any) {
          const missing = err?.response?.data?.missingFields as string[] | undefined;
          if (err?.response?.status === 400 && missing && (missing.includes("name") || missing.includes("address"))) {
            const retryForm = new FormData();
            retryForm.append("name", safeName || baseClinic.name || "");
            retryForm.append("address", safeAddress || baseClinic.address || "");
            if (editForm.pricing) retryForm.append("pricing", editForm.pricing.trim());
            if (editForm.timings) retryForm.append("timings", editForm.timings.trim());
            if (editForm.servicesName)
              retryForm.append("servicesName", JSON.stringify(editForm.servicesName));
            if (editForm.treatments)
              retryForm.append("treatments", JSON.stringify(editForm.treatments));
            retryForm.append("existingPhotos", JSON.stringify(existingPhotos));
            filesToUpload.forEach((file) => retryForm.append("photos", file));
            const response2 = await axios.put(
              `/api/clinics/${editingClinicId}`,
              retryForm,
              { headers: { ...authHeaders } }
            );
            if (!response2.data.success) {
              toast.error(response2.data.message || "Failed to update clinic");
              return;
            }
          } else {
            const msg = err?.response?.data?.message || "Update failed";
            if (msg === "File upload failed") {
              toast.error("File upload failed: only JPG/PNG up to 5MB are allowed.");
            } else {
              toast.error(msg);
            }
            return;
          }
        }
      } else {
        const cleanUpdateData = {
          name: safeName,
          address: safeAddress,
          ...(editForm.pricing && { pricing: editForm.pricing.trim() }),
          ...(editForm.timings && { timings: editForm.timings.trim() }),
          ...(editForm.servicesName && { servicesName: editForm.servicesName }),
          ...(editForm.treatments && { treatments: editForm.treatments }),
          existingPhotos,
        };
        try {
          const response = await axios.put(
            `/api/clinics/${editingClinicId}`,
            cleanUpdateData,
            {
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
            }
          );
          if (!response.data.success) {
            toast.error(response.data.message || "Failed to update clinic");
            return;
          }
        } catch (err: any) {
          const missing = err?.response?.data?.missingFields as string[] | undefined;
          if (err?.response?.status === 400 && missing && (missing.includes("name") || missing.includes("address"))) {
            const fallbackData = {
              ...cleanUpdateData,
              name: safeName || baseClinic.name || "",
              address: safeAddress || baseClinic.address || "",
            };
            const response2 = await axios.put(
              `/api/clinics/${editingClinicId}`,
              fallbackData,
              {
                headers: {
                  ...authHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
            if (!response2.data.success) {
              toast.error(response2.data.message || "Failed to update clinic");
              return;
            }
          } else {
            const msg = err?.response?.data?.message || "Update failed";
            toast.error(msg);
            return;
          }
        }
      }
      toast.success("Clinic updated successfully");
      setIsEditing(false);
      setEditingClinicId(null);
      setEditForm({});
      setSelectedFiles([]);
      const refreshResponse = await axios.get("/api/clinics/myallClinic", {
        headers: authHeaders,
      });
      if (refreshResponse.data.success) {
        const sanitizePhotos = (arr: any[]) =>
          Array.isArray(arr)
            ? arr
                .map((p: any) =>
                  typeof p === "string" ? p.trim().replace(/^['\"`]+|['\"`]+$/g, "") : p
                )
                .filter((p: any) => typeof p === "string" && p.length > 0)
            : [];
        const clinicObj = refreshResponse.data.clinic
          ? {
              ...refreshResponse.data.clinic,
              photos: sanitizePhotos(refreshResponse.data.clinic.photos || []),
            }
          : null;
        setClinics(clinicObj ? [clinicObj] : []);
        if (clinicObj && Array.isArray(clinicObj.photos) && clinicObj.photos.length > 0) {
          setCurrentPhotoIndex(clinicObj.photos.length - 1);
        }
      }
    } catch (error: any) {
      console.error("❌ Update error:", error);
      console.error("❌ Error response:", error.response?.data);
      const msg = error.response?.data?.message || "Failed to update clinic";
      if (msg === "File upload failed") {
        toast.error("File upload failed: only JPG/PNG up to 5MB are allowed.");
      } else {
        toast.error(msg);
      }
    } finally {
      setUpdating(false);
    }
  };

 

  const handleAddTreatment = () => {
    if (!newTreatment.trim()) return;
    const newTreatmentObj = {
      mainTreatment: newTreatment.trim(),
      mainTreatmentSlug: newTreatment.trim().toLowerCase().replace(/\s+/g, '-'),
      subTreatments: []
    };
    setEditForm(prev => ({
      ...prev,
      treatments: [newTreatmentObj, ...(prev.treatments || [])]
    }));
    setSelectedTreatmentIndex(0);
    setNewTreatment("");
  };

  const handleRemoveTreatment = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      treatments: (prev.treatments || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddSubTreatment = () => {
    if (!newSubTreatment.trim() || selectedTreatmentIndex === null) return;
    const price = newSubTreatmentPrice ? parseFloat(newSubTreatmentPrice) : 0;
    const newSubTreatmentObj = {
      name: newSubTreatment.trim(),
      slug: newSubTreatment.trim().toLowerCase().replace(/\s+/g, '-'),
      price: price > 0 ? price : undefined
    };
    setEditForm(prev => {
      const updatedTreatments = [...(prev.treatments || [])];
      if (updatedTreatments[selectedTreatmentIndex]) {
        updatedTreatments[selectedTreatmentIndex] = {
          ...updatedTreatments[selectedTreatmentIndex],
          subTreatments: [
            ...(updatedTreatments[selectedTreatmentIndex].subTreatments || []),
            newSubTreatmentObj
          ]
        };
      }
      return {
        ...prev,
        treatments: updatedTreatments
      };
    });
    setNewSubTreatment("");
    setNewSubTreatmentPrice("");
    setCustomAdded(true);
    setTimeout(() => setCustomAdded(false), 2000);
    // Keep the selection active so the user can add more or see the list
    // setSelectedTreatmentIndex(null);
  };

  const handleRemoveSubTreatment = (treatmentIndex: number, subIndex: number) => {
    setEditForm(prev => {
      const updatedTreatments = [...(prev.treatments || [])];
      if (updatedTreatments[treatmentIndex]) {
        updatedTreatments[treatmentIndex] = {
          ...updatedTreatments[treatmentIndex],
          subTreatments: (updatedTreatments[treatmentIndex].subTreatments || [])
            .filter((_, i) => i !== subIndex)
        };
      }
      return {
        ...prev,
        treatments: updatedTreatments
      };
    });
  };

  if (loading) return <Loader />;

  // Show access denied if read permission is false
  if (permissionsLoaded && !permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-teal-900 mb-2">Access Denied</h2>
          <p className="text-sm text-teal-700 mb-4">
            You do not have permission to view clinic information.
          </p>
          <p className="text-xs text-teal-600">
            Please contact your administrator to request access to the Manage Health Center module.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          },
        }}
      />
      <div className="p-3 sm:p-4 lg:p-5 space-y-3 lg:space-y-4">
        {/* Header - Enhanced */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
             
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Health Center Management
                </h1>
                <p className="text-teal-600 text-sm">
                  Manage your clinic profile and services
                </p>
              </div>
            </div>
            {clinics.length > 0 && !isEditing && permissions.canUpdate && (
              <button
                onClick={() => handleEdit(clinics[0])}
                className="self-end sm:self-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-5">
              {/* Header - Enhanced */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-teal-900">
                      Edit Clinic Profile
                    </h2>
                    <p className="text-teal-600 text-sm">
                      Update your clinic information and services
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="self-end sm:self-auto p-2 text-teal-500 hover:text-teal-700 hover:bg-teal-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Layout - 3 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column - Basic Info */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-teal-700" />
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-teal-700 mb-2">
                          Clinic Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                          placeholder="Enter clinic name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-teal-700 mb-2">
                          Address
                        </label>
                        <textarea
                          value={editForm.address || ""}
                          onChange={(e) => handleInputChange("address", e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                          placeholder="Enter clinic address"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-teal-700 mb-2">
                            Pricing
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg
                                className="w-4 h-4 text-teal-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <text
                                  x="2"
                                  y="16"
                                  fontSize="20"
                                  fontWeight="bold"
                                  fill="currentColor"
                                >
                                  د.إ
                                </text>
                              </svg>
                            </div>
                            <input
                              type="text"
                              value={editForm.pricing || ""}
                              onChange={(e) => handleInputChange("pricing", e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                              placeholder="د.إ500 - د.إ2000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-teal-700 mb-2">
                            Timings
                          </label>
                          <input
                            type="text"
                            value={editForm.timings || ""}
                            onChange={(e) => handleInputChange("timings", e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                            placeholder="9:00 AM - 8:00 PM"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services Section */}
                  {/* <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-teal-700" />
                      Services
                    </h3>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newService}
                          onChange={(e) => setNewService(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-gray-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                          placeholder="Add service"
                          onKeyPress={(e) => e.key === "Enter" && handleAddService()}
                        />
                        <button
                          onClick={handleAddService}
                          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm hover:shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editForm.servicesName?.map((service, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-100 text-teal-800 rounded-full text-sm border border-teal-200"
                          >
                            {service}
                            <button
                              onClick={() => handleRemoveService(index)}
                              className="text-teal-600 hover:text-teal-800"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div> */}

                  {/* Treatments Section */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-700" />
                      Treatments
                    </h3>
                    {selectedTreatmentIndex !== null && editForm.treatments?.[selectedTreatmentIndex] && (
                      <div className="mb-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-3 py-1.5 bg-teal-800 text-white rounded-full text-sm font-semibold">
                            {editForm.treatments[selectedTreatmentIndex].mainTreatment}
                          </span>
                          <span className="text-[11px] text-teal-700">
                            {(editForm.treatments[selectedTreatmentIndex].subTreatments || []).length} selected
                          </span>
                        </div>
                        {editForm.treatments[selectedTreatmentIndex].subTreatments && editForm.treatments[selectedTreatmentIndex].subTreatments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {editForm.treatments[selectedTreatmentIndex].subTreatments.map((sub: any, sIdx: number) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-teal-700 rounded-full text-xs border border-gray-200"
                              >
                                {sub.name}
                                {typeof sub.price === "number" && sub.price > 0 && (
                                  <span className="text-teal-800 font-bold">د.إ{sub.price}</span>
                                )}
                                <button
                                  onClick={() => handleRemoveSubTreatment(selectedTreatmentIndex, sIdx)}
                                  className="text-red-500 hover:text-red-700 ml-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Custom Sub-treatment Form */}
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="text-xs font-medium text-teal-700 mb-2">
                            Add Custom Sub-treatment
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={newSubTreatment}
                              onChange={(e) => setNewSubTreatment(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white text-sm"
                              placeholder="Sub-treatment name"
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  handleAddSubTreatment();
                                }
                              }}
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={newSubTreatmentPrice}
                                onChange={(e) => setNewSubTreatmentPrice(e.target.value)}
                                className="flex-1 sm:w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white text-sm"
                                placeholder="Price"
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    handleAddSubTreatment();
                                  }
                                }}
                              />
                              <button
                                onClick={handleAddSubTreatment}
                                className={`px-3 py-2 text-white rounded-lg transition-colors text-sm flex-shrink-0 flex items-center gap-1 ${
                                  customAdded ? "bg-teal-600" : "bg-teal-600 hover:bg-teal-700"
                                }`}
                                disabled={!newSubTreatment.trim() || customAdded}
                              >
                                {customAdded ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Saved
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    Add
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Add from available treatments */}
                    <div className="space-y-2 mb-3">
                      <label className="text-xs font-medium text-teal-700">Add from list</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={selectedAvailableTreatmentId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedAvailableTreatmentId(id);
                            const t = availableTreatments.find(at => String(at._id) === id);
                            if (t) addTreatmentFromAvailable(t);
                          }}
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-teal-900"
                        >
                          <option value="">Select treatment</option>
                          {availableTreatments.map((t) => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const t = availableTreatments.find(at => String(at._id) === selectedAvailableTreatmentId);
                            if (t) addTreatmentFromAvailable(t);
                          }}
                          className="px-3 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm w-full sm:w-auto"
                        >
                          Add
                        </button>
                      </div>
                      {selectedAvailableTreatmentId && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-teal-700 mb-1">Sub-treatments</div>
                          <div className="max-h-56 sm:max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white pb-1">
                            {(availableTreatments.find(at => String(at._id) === selectedAvailableTreatmentId)?.subcategories || []).map((sc, i) => {
                              const isAdded = selectedTreatmentIndex !== null && 
                                editForm.treatments?.[selectedTreatmentIndex]?.subTreatments?.some(
                                  (st: any) => st.name === sc.name
                                );
                              
                              // Generate a unique key for this sub-treatment
                              const subTreatmentKey = `${selectedAvailableTreatmentId}-${sc.name}`;
                              
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                                  <div className="flex-1 flex items-center gap-2">
                                    <div className="text-xs text-teal-800 flex-1">
                                      {sc.name} {typeof sc.price === "number" && sc.price > 0 ? <span className="font-semibold text-teal-900">د.إ{sc.price}</span> : null}
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="Price"
                                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      defaultValue={typeof sc.price === "number" && sc.price > 0 ? sc.price : ""}
                                      disabled={!!isAdded}
                                      onChange={(e) => {
                                        const value = e.target.value ? parseFloat(e.target.value) : 0;
                                        setCustomSubTreatmentPrices(prev => ({
                                          ...prev,
                                          [subTreatmentKey]: value
                                        }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !isAdded) {
                                          e.preventDefault();
                                          const value = e.currentTarget.value ? parseFloat(e.currentTarget.value) : 0;
                                          const subTreatmentWithPrice = {
                                            ...sc,
                                            price: value > 0 ? value : undefined
                                          };
                                          addSubTreatmentFromAvailable(subTreatmentWithPrice, selectedTreatmentIndex);
                                        }
                                      }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      const customPrice = customSubTreatmentPrices[subTreatmentKey];
                                      const subTreatmentWithPrice = {
                                        ...sc,
                                        price: customPrice && customPrice > 0 ? customPrice : (typeof sc.price === "number" && sc.price > 0 ? sc.price : undefined)
                                      };
                                      addSubTreatmentFromAvailable(subTreatmentWithPrice, selectedTreatmentIndex);
                                    }}
                                    disabled={!!isAdded}
                                    className={`px-2 py-1 text-white text-[11px] rounded transition-colors ${
                                      isAdded 
                                        ? "bg-teal-600 cursor-default" 
                                        : "bg-gray-900 hover:bg-gray-800"
                                    }`}
                                  >
                                    {isAdded ? "Saved" : "Add"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTreatment}
                          onChange={(e) => setNewTreatment(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white transition-all"
                          placeholder="Add treatment"
                          onKeyPress={(e) => e.key === "Enter" && handleAddTreatment()}
                        />
                        <button
                          onClick={handleAddTreatment}
                          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm hover:shadow-md"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {editForm.treatments?.map((treatment: any, index: number) => (
                          <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="px-3 py-1.5 bg-teal-800 text-white rounded-full text-sm font-semibold">
                                {treatment.mainTreatment}
                              </span>
                              <button
                                onClick={() => handleRemoveTreatment(index)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {treatment.subTreatments && treatment.subTreatments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {treatment.subTreatments.map((subTreatment: any, subIndex: number) => (
                                  <span
                                    key={subIndex}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-teal-700 rounded-full text-xs border border-gray-200"
                                  >
                                    {subTreatment.name}
                                    {typeof subTreatment.price === "number" &&
                                      subTreatment.price > 0 && (
                                        <span className="text-teal-800 font-bold">
                                          د.إ{subTreatment.price}
                                        </span>
                                      )}
                                    <button
                                      onClick={() => handleRemoveSubTreatment(index, subIndex)}
                                      className="text-red-500 hover:text-red-700 ml-1"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Add Sub-Treatment Form */}
                            <div className="border-t border-gray-200 pt-3 mt-3">
                              <div className="text-xs font-medium text-teal-700 mb-2">
                                Add Sub-Treatment
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                {/* Dropdown to select from existing sub-treatments */}
                                <div className="relative flex-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowSubTreatmentDropdown(showSubTreatmentDropdown === index ? null : index)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left text-sm text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  >
                                    Select from existing...
                                  </button>
                                  
                                  {showSubTreatmentDropdown === index && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {(() => {
                                        // Find the main treatment in availableTreatments to get its subcategories
                                        const mainTreatmentName = treatment.mainTreatment;
                                        const mainTreatment = availableTreatments.find(t => t.name === mainTreatmentName);
                                        
                                        if (!mainTreatment || !mainTreatment.subcategories || mainTreatment.subcategories.length === 0) {
                                          return (
                                            <div className="px-3 py-2 text-xs text-gray-500">
                                              No sub-treatments available
                                            </div>
                                          );
                                        }
                                        
                                        return mainTreatment.subcategories.map((sc, scIndex) => {
                                          const isAdded = treatment.subTreatments?.some(
                                            (st: any) => st.name.toLowerCase() === sc.name.toLowerCase()
                                          );
                                          
                                          const subTreatmentKey = `${mainTreatment._id}-${sc.name}`;
                                          
                                          return (
                                            <div 
                                              key={scIndex} 
                                              className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                            >
                                              <div className="flex-1 flex items-center gap-2">
                                                <div className="text-sm text-teal-800 flex-1">
                                                  {sc.name} {typeof sc.price === "number" && sc.price > 0 ? <span className="font-semibold text-teal-900">د.إ{sc.price}</span> : null}
                                                </div>
                                                <input
                                                  type="number"
                                                  placeholder="Price"
                                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                  defaultValue={
                                                    isAdded 
                                                      ? treatment.subTreatments?.find((st: any) => st.name.toLowerCase() === sc.name.toLowerCase())?.price || ""
                                                      : (typeof sc.price === "number" && sc.price > 0 ? sc.price : "")
                                                  }
                                                  disabled={!!isAdded}
                                                  onChange={(e) => {
                                                    const value = e.target.value ? parseFloat(e.target.value) : 0;
                                                    setCustomSubTreatmentPrices(prev => ({
                                                      ...prev,
                                                      [subTreatmentKey]: value
                                                    }));
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !isAdded) {
                                                      e.preventDefault();
                                                      const value = e.currentTarget.value ? parseFloat(e.currentTarget.value) : 0;
                                                      const subTreatmentWithPrice = {
                                                        ...sc,
                                                        price: value > 0 ? value : undefined
                                                      };
                                                      addSubTreatmentFromAvailable(subTreatmentWithPrice, index);
                                                    }
                                                  }}
                                                />
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const customPrice = customSubTreatmentPrices[subTreatmentKey];
                                                  const subTreatmentWithPrice = {
                                                    ...sc,
                                                    price: customPrice && customPrice > 0 ? customPrice : (typeof sc.price === "number" && sc.price > 0 ? sc.price : undefined)
                                                  };
                                                  addSubTreatmentFromAvailable(subTreatmentWithPrice, index);
                                                }}
                                                disabled={!!isAdded}
                                                className={`px-2 py-1 text-white text-[11px] rounded transition-colors ${
                                                  isAdded 
                                                    ? "bg-teal-600 cursor-default" 
                                                    : "bg-gray-900 hover:bg-gray-800"
                                                }`}
                                              >
                                                {isAdded ? "Added" : "Add"}
                                              </button>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Or add custom sub-treatment */}
                                <div className="flex gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={selectedTreatmentIndex === index ? newSubTreatment : ""}
                                    onChange={(e) => {
                                      setSelectedTreatmentIndex(index);
                                      setNewSubTreatment(e.target.value);
                                    }}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white text-sm"
                                    placeholder="Or add custom..."
                                    onKeyPress={(e) => {
                                      if (e.key === "Enter") {
                                        setSelectedTreatmentIndex(index);
                                        handleAddSubTreatment();
                                      }
                                    }}
                                  />
                                  <input
                                    type="number"
                                    value={selectedTreatmentIndex === index ? newSubTreatmentPrice : ""}
                                    onChange={(e) => {
                                      setSelectedTreatmentIndex(index);
                                      setNewSubTreatmentPrice(e.target.value);
                                    }}
                                    className="flex-1 sm:w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-teal-400 text-teal-700 bg-white text-sm"
                                    placeholder="Price"
                                    onKeyPress={(e) => {
                                      if (e.key === "Enter") {
                                        setSelectedTreatmentIndex(index);
                                        handleAddSubTreatment();
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      setSelectedTreatmentIndex(index);
                                      handleAddSubTreatment();
                                    }}
                                    className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm flex-shrink-0"
                                    disabled={selectedTreatmentIndex !== index || !newSubTreatment.trim()}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Photos */}
                <div className="space-y-5">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-teal-700" />
                      Clinic Photos
                    </h3>
                    {/* Photo Upload - Multiple Images */}
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-teal-700">
                        <Camera className="w-4 h-4" />
                        Health Center Photos (Multiple)
                      </label>
                      <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 sm:p-8 text-center hover:border-[#2D9AA5]/50 hover:bg-[#2D9AA5]/5 transition-all">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          multiple
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const rawFiles = Array.from(e.target.files);
                              const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);
                              const maxSize = 5 * 1024 * 1024;
                              const validFiles: File[] = [];
                              const invalids: string[] = [];
                              rawFiles.forEach((f) => {
                                if (!allowedTypes.has((f.type || "").toLowerCase())) {
                                  invalids.push(`${f.name}: unsupported type ${f.type || "unknown"}`);
                                  return;
                                }
                                if (f.size > maxSize) {
                                  invalids.push(`${f.name}: exceeds 5MB`);
                                  return;
                                }
                                validFiles.push(f);
                              });
                              if (invalids.length > 0) {
                                toast.error(`Invalid files:\n${invalids.join("\n")}`);
                              }
                              if (validFiles.length === 0) return;
                              const filesArray = validFiles;
                              setSelectedFiles(filesArray);
                              const baseLen = (editForm.photos || []).length;
                              handleInputChange("photos", [
                                ...(editForm.photos || []),
                                ...filesArray,
                              ]);
                              setCurrentPhotoIndex(baseLen + filesArray.length - 1);
                              toast.success(`${filesArray.length} photo(s) selected`);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-3">
                          <Camera className="w-8 h-8 text-teal-400 mx-auto" />
                          <div>
                            <p className="font-medium text-teal-700">
                              Click to upload clinic photos
                            </p>
                            <p className="text-xs text-teal-500 mt-1">
                              JPG, PNG up to 5MB each
                            </p>
                          </div>
                        </div>
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-teal-700">Selected Files:</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {selectedFiles.map((file, index) => {
                              const url = URL.createObjectURL(file);
                              return (
                                <div key={index} className="relative group border-2 rounded-lg overflow-hidden">
                                  <img
                                    src={url}
                                    alt={file.name}
                                    className="w-full h-24 object-cover"
                                    onLoad={() => URL.revokeObjectURL(url)}
                                    onError={(e) => {
                                      const img = e.currentTarget as HTMLImageElement;
                                      img.onerror = null;
                                      img.src = PLACEHOLDER_DATA_URI;
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-[11px] text-white px-2 py-1 rounded">{file.name}</span>
                                  </div>
                                  <button
                                    type="button"
                                  onClick={() => {
                                      const photosArr = editForm.photos || [];
                                      const photoIndex = photosArr.findIndex((p: any) => p === file);
                                      if (photoIndex !== -1) {
                                        removePhotoAt(photoIndex);
                                      } else {
                                        const fileIndices = photosArr
                                          .map((p: any, i: number) => (p instanceof File ? i : -1))
                                          .filter((i: number) => i !== -1);
                                        const mappedIndex = fileIndices[index] ?? -1;
                                        if (mappedIndex !== -1) removePhotoAt(mappedIndex);
                                      }
                                  }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove file"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Current Photos Preview */}
                      {editForm.photos && editForm.photos.length > 0 && (
                        <div className="space-y-4">
                          <p className="text-sm font-medium text-teal-700">
                            Current Photos:
                          </p>
                          
                          {/* Main Display Photo with Navigation */}
                          <div className="mb-4">
                            <p className="text-xs text-teal-600 mb-2">Display Photo:</p>
                            <div className="relative group inline-block">
                              {(() => {
                                const photosArray = editForm.photos || [];
                                const safeIndex = Math.min(
                                  Math.max(currentPhotoIndex, 0),
                                  photosArray.length - 1
                                );
                                const viewingPhoto = photosArray.length > 0 
                                  ? photosArray[safeIndex] 
                                  : null;

                                if (!viewingPhoto) {
                                  return (
                                    <div className="relative w-full max-w-md h-64 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                                      <Camera className="w-8 h-8 text-teal-400" />
                                    </div>
                                  );
                                }

                                return (
                                  <div className="relative w-full max-w-md h-64 rounded-lg overflow-hidden border-2 border-teal-500 bg-white">
                                    <img
                                      src={getImagePath(viewingPhoto)}
                                      alt={`Clinic photo ${safeIndex + 1}`}
                                      className="w-full h-full object-contain object-center"
                                      onError={(e) => {
                                        const img = e.currentTarget as HTMLImageElement;
                                        img.onerror = null;
                                        img.src = PLACEHOLDER_DATA_URI;
                                      }}
                                    />
                                    <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-2 py-1 rounded-full">
                                      {safeIndex + 1}/{photosArray.length}
                                    </div>
                                    {photosArray.length > 1 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCurrentPhotoIndex((prev) =>
                                              Math.max(prev - 1, 0)
                                            );
                                          }}
                                          className="absolute top-1/2 -translate-y-1/2 left-2 bg-teal-800 text-white rounded-full p-2 hover:bg-teal-900 transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10 disabled:opacity-50"
                                          title="Previous photo"
                                          disabled={safeIndex <= 0}
                                        >
                                          <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCurrentPhotoIndex((prev) =>
                                              Math.min(
                                                prev + 1,
                                                photosArray.length - 1
                                              )
                                            );
                                          }}
                                          className="absolute top-1/2 -translate-y-1/2 right-2 bg-teal-800 text-white rounded-full p-2 hover:bg-teal-900 transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10 disabled:opacity-50"
                                          title="Next photo"
                                          disabled={safeIndex >= photosArray.length - 1}
                                        >
                                          <ChevronRight className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removePhotoAt(safeIndex);
                                        toast.success("Photo removed");
                                      }}
                                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10"
                                      title="Remove photo"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* All Photos Grid - Larger Thumbnails */}
                          <div>
                            <p className="text-xs text-teal-600 mb-2">All Photos ({editForm.photos?.length || 0}):</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                              {(editForm.photos || []).map((photo, index) => (
                                <div 
                                  key={index} 
                                  className={`relative group border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                                    index === currentPhotoIndex 
                                      ? 'border-teal-500 ring-2 ring-teal-200 scale-105' 
                                      : 'border-gray-200 hover:border-teal-300'
                                  }`}
                                  onClick={() => setCurrentPhotoIndex(index)}
                                >
                                  <img
                                    src={getImagePath(photo)}
                                    alt={`Clinic photo ${index + 1}`}
                                    className="w-16 h-16 object-cover object-center"
                                    onError={(e) => {
                                      const img = e.currentTarget as HTMLImageElement;
                                      img.onerror = null;
                                      img.src = PLACEHOLDER_DATA_URI;
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-white" />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePhotoAt(index);
                                      toast.success("Photo removed");
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove photo"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  {index === currentPhotoIndex && (
                                    <Eye className="absolute bottom-1 left-1 w-4 h-4 text-white" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error messages are shown via toast popup only */}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Enhanced */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-gray-200">
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="order-2 sm:order-1 px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors shadow-sm hover:shadow-md text-sm"
                >
                  {updating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Update Profile"
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="order-1 sm:order-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Show permission denied message if no read permission (only for agent/doctorStaff, not clinic/doctor) */}
            {(() => {
              const userRole = getUserRole();
              // Clinic and doctor roles always have access - don't show access denied
              if (userRole === "clinic" || userRole === "doctor") {
                return null;
              }
              // For other roles, check permissions
              if (!permissions.canRead) {
                return (
                  <div className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200 shadow-sm">
                    <div className="text-center max-w-md mx-auto">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-bold text-teal-900 mb-2">
                        Access Denied
                      </h3>
                      <p className="text-sm text-teal-700 mb-3">
                        You do not have permission to view clinic information.
                      </p>
                      <p className="text-xs text-teal-600">
                        Please contact your administrator to request access to the Health Center Management module.
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {(() => {
              const userRole = getUserRole();
              // If clinic/doctor role, always show content (they have full access)
              if (userRole === "clinic" || userRole === "doctor") {
                // Show clinics or empty state
                if (clinics.length === 0) {
                  return (
                    <div className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200 shadow-sm">
                      <div className="text-center max-w-md mx-auto">
                        <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Building2 className="w-6 h-6 text-teal-800" />
                        </div>
                        <h3 className="text-lg font-bold text-teal-900 mb-2">
                          No Health Center Found
                        </h3>
                        <p className="text-sm text-teal-700 mb-4">
                          You haven't created a health center profile yet.
                        </p>
                        <p className="text-xs text-teal-600">
                          Please contact your administrator to set up your health center profile.
                        </p>
                      </div>
                    </div>
                  );
                }

                // Show clinic cards with enhanced design
                return (
                  <div className="space-y-4 sm:space-y-5">
                    {clinics.map((clinic) => (
                      <div
                        key={clinic._id}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                      >
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-col md:flex-row md:items-start gap-4 lg:gap-6">
                            {/* Left Column - Basic Info */}
                            <div className="md:w-2/3 space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Building2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
                                    <h3 className="text-lg sm:text-xl font-bold text-teal-900">
                                      {clinic.name}
                                    </h3>
                                  </div>
                                  <div className="space-y-2 text-sm text-teal-700">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                                      <span className="break-words">{clinic.address}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                      <span>{clinic.pricing}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                      <span>{clinic.timings}</span>
                                    </div>
                                  </div>
                                </div>
                                {permissions.canUpdate && (
                                  <button
                                    onClick={() => handleEdit(clinic)}
                                    className="p-2 text-teal-600 hover:text-teal-800 hover:bg-teal-100 rounded-lg transition-all flex-shrink-0"
                                    title="Edit clinic"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {/* Services */}
                              {clinic.servicesName && clinic.servicesName.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                    Services
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {clinic.servicesName.map((service, index) => (
                                      <span
                                        key={index}
                                        className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-full text-xs border border-teal-200"
                                      >
                                        {service}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Treatments */}
                              {clinic.treatments && clinic.treatments.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                    Treatments
                                  </h4>
                                  <div className={`space-y-2 ${clinic.treatments.length > 4 ? 'max-h-[28rem] sm:max-h-[36rem] overflow-y-auto pr-2 pb-1' : ''}`}>
                                    {clinic.treatments.map((treatment, index) => (
                                      <div
                                        key={index}
                                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="px-2 py-1 bg-teal-800 text-white rounded-full text-xs font-semibold">
                                            {treatment.mainTreatment}
                                          </span>
                                        </div>
                                        {treatment.subTreatments &&
                                          treatment.subTreatments.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                              {treatment.subTreatments.map(
                                                (subTreatment, subIndex) => (
                                                  <span
                                                    key={subIndex}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white text-teal-700 rounded-full text-xs border border-gray-200"
                                                  >
                                                    {subTreatment.name}
                                                    {typeof subTreatment.price ===
                                                      "number" &&
                                                      subTreatment.price > 0 && (
                                                        <span className="text-teal-800 font-bold">
                                                          د.إ{subTreatment.price}
                                                        </span>
                                                      )}
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column - Photos and Stats */}
                            <div className="md:w-1/3 space-y-4">
                              {/* Photos */}
                              <div>
                                <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                  Photos
                                </h4>
                                <div className="relative group">
                                  {(() => {
                                    const photosArray = clinic.photos || [];
                                    const safeIndex = Math.min(
                                      Math.max(currentPhotoIndex, 0),
                                      Math.max(photosArray.length - 1, 0)
                                    );
                                    const viewingPhoto =
                                      photosArray.length > 0
                                        ? photosArray[safeIndex]
                                        : null;
                                    return (
                                      <>
                                        <div className="relative w-full max-w-md h-48 sm:h-64 rounded-lg overflow-hidden border-2 border-teal-500 bg-white">
                                          <img
                                            src={
                                              viewingPhoto
                                                ? getImagePath(viewingPhoto)
                                                : PLACEHOLDER_DATA_URI
                                            }
                                            alt={`${clinic.name} photo`}
                                              className="w-full h-full object-cover object-center"
                                            onError={(e) => {
                                              const img =
                                                e.currentTarget as HTMLImageElement;
                                              img.onerror = null;
                                              img.src = PLACEHOLDER_DATA_URI;
                                            }}
                                          />
                                          {photosArray.length > 1 && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCurrentPhotoIndex((prev) =>
                                                    Math.max(prev - 1, 0)
                                                  );
                                                }}
                                                className="absolute top-1/2 -translate-y-1/2 left-1 bg-teal-800 text-white rounded-full p-1 hover:bg-teal-900 transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10 disabled:opacity-50"
                                                title="Previous photo"
                                                disabled={safeIndex <= 0}
                                              >
                                                <ChevronLeft className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCurrentPhotoIndex((prev) =>
                                                    Math.min(
                                                      prev + 1,
                                                      photosArray.length - 1
                                                    )
                                                  );
                                                }}
                                                className="absolute top-1/2 -translate-y-1/2 right-1 bg-teal-800 text-white rounded-full p-1 hover:bg-teal-900 transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10 disabled:opacity-50"
                                                title="Next photo"
                                                disabled={
                                                  safeIndex >=
                                                  photosArray.length - 1
                                                }
                                              >
                                                <ChevronRight className="w-3 h-3" />
                                              </button>
                                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                {safeIndex + 1}/{photosArray.length}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                        
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-teal-800 mb-3">
                                  Performance Metrics
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-teal-700">Total Appointments</span>
                                    <span className="font-semibold text-teal-900">
                                      {dashboardStats 
                                        ? dashboardStats.totalAppointments 
                                        : statsLoading 
                                          ? "Loading..." 
                                          : "N/A"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-teal-700">Total Reviews</span>
                                    <span className="font-semibold text-teal-900">
                                      {dashboardStats 
                                        ? dashboardStats.totalReviews 
                                        : statsLoading 
                                          ? "Loading..." 
                                          : "N/A"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-teal-700">Total Enquiries</span>
                                    <span className="font-semibold text-teal-900">
                                      {dashboardStats 
                                        ? dashboardStats.totalEnquiries 
                                        : statsLoading 
                                          ? "Loading..." 
                                          : "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Treatments Section */}
                              {/* Reviews Section */}
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-teal-800 mb-3 flex items-center gap-2">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  Patient Reviews
                                </h4>
                                
                                {reviewsLoading ? (
                                  <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
                                    <p className="text-xs text-teal-600 mt-2">Loading reviews...</p>
                                  </div>
                                ) : reviewsData ? (
                                  <div className="space-y-3">
                                    {/* Average Rating */}
                                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-teal-700">Average Rating</span>
                                        <div className="flex items-center gap-1">
                                          <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }, (_, i) => (
                                              <Star
                                                key={i}
                                                className={`w-3 h-3 ${
                                                  i < Math.round(reviewsData.averageRating || 0)
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "text-gray-300"
                                                }`}
                                              />
                                            ))}
                                          </div>
                                          <span className="text-sm font-bold text-teal-900">
                                            {reviewsData.averageRating?.toFixed(1) || "0.0"}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-xs text-teal-600">
                                        Based on {reviewsData.totalReviews || 0} review{reviewsData.totalReviews !== 1 ? 's' : ''}
                                      </p>
                                    </div>

                                    {/* Recent Reviews Preview */}
                                    {reviewsData.reviews && reviewsData.reviews.length > 0 && (
                                      <div>
                                        <p className="text-xs text-teal-700 mb-2">Recent Reviews:</p>
                                        <div className="space-y-2 max-h-40 sm:max-h-60 overflow-y-auto">
                                          {reviewsData.reviews.slice(0, 3).map((review: any, index: number) => (
                                            <div 
                                              key={review._id || index} 
                                              className="bg-white rounded-lg p-3 border border-gray-200"
                                            >
                                              <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center">
                                                    <span className="text-xs font-medium text-teal-800">
                                                      {review.userId?.name?.charAt(0)?.toUpperCase() || "A"}
                                                    </span>
                                                  </div>
                                                  <span className="text-xs font-medium text-teal-800">
                                                    {review.userId?.name || "Anonymous"}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <div className="flex gap-0.5">
                                                    {Array.from({ length: 5 }, (_, i) => (
                                                      <Star
                                                        key={i}
                                                        className={`w-2.5 h-2.5 ${
                                                          i < review.rating
                                                            ? "fill-amber-400 text-amber-400"
                                                            : "text-gray-300"
                                                        }`}
                                                      />
                                                    ))}
                                                  </div>
                                                  <span className="text-xs font-bold text-amber-600">
                                                    {review.rating}
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              {review.comment && (
                                                <p className="text-xs text-teal-700 line-clamp-2">
                                                  "{review.comment}"
                                                </p>
                                              )}
                                              
                                              <p className="text-[10px] text-teal-500 mt-2">
                                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric'
                                                })}
                                              </p>
                                            </div>
                                          ))}
                                        </div>

                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <Star className="w-8 h-8 text-teal-300 mx-auto mb-2" />
                                    <p className="text-xs text-teal-600">No reviews yet</p>
                                    <p className="text-[10px] text-teal-500 mt-1">Encourage patients to leave feedback</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer - Compact */}
                        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-teal-600">
                            <span className="font-medium">
                              {clinic.slug ? `/${clinic.slug}` : "No slug"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Analytics Section - Compact */}
                    {clinics.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
                        <h3 className="text-lg font-bold text-teal-900 mb-4">
                          Health Center Analytics
                        </h3>
                        
                        {/* Stats Grid - Compact */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <Users className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Reviews</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalReviews : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <Star className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Enquiries</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalEnquiries : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <Heart className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Appointments</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalAppointments : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <Activity className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Patients</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalPatients : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                        </div>

                        {/* Additional Stats Grid - Second Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <div className="w-5 h-5 text-teal-600 mx-auto mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
                                <path fillRule="evenodd" d="M2.237 8.522a.75.75 0 0 1 .604-.172l18.75-5.25a.75.75 0 0 1 .57 1.227l-9.75 5.25a.75.75 0 0 1-.712 0L2.8 8.35a.75.75 0 0 1-.563-.172.75.75 0 0 1 0-.306Zm.713 2.406 9.75 5.25a.75.75 0 0 1 .712 0l9.75-5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0L2.95 12.248a.75.75 0 0 1 0-1.32Z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Offers</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalOffers : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <div className="w-5 h-5 text-teal-600 mx-auto mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H14.25V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Packages</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalPackages : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <div className="w-5 h-5 text-teal-600 mx-auto mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                              </svg>
                            </div>
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Leads</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalLeads : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                            <div className="w-5 h-5 text-teal-600 mx-auto mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 0 1.06 1.06l7.693 7.693a3.75 3.75 0 1 0 5.303-5.303l-10.94-10.94a2.25 2.25 0 0 0-3.182 0Zm-2.828 2.829a.75.75 0 0 0-1.06 1.06l.707.707a.75.75 0 0 0 1.06-1.06l-.707-.707Zm-5.656 5.656a.75.75 0 0 0-1.06 1.06l.707.707a.75.75 0 0 0 1.06-1.06l-.707-.707Z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-xs sm:text-sm text-teal-700 mb-1">Total Treatments</p>
                            <p className="text-base sm:text-lg font-bold text-teal-900">
                              {dashboardStats ? dashboardStats.totalTreatments : statsLoading ? "Loading..." : "N/A"}
                            </p>
                          </div>
                        </div>

                        {/* Chart - Compact */}
                        {dashboardStats && (
                          <div>
                            <h4 className="text-sm font-semibold text-teal-800 mb-3">
                              Engagement Overview
                            </h4>
                            <div className="h-48 sm:h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={[
                                    { name: 'Reviews', value: dashboardStats.totalReviews },
                                    { name: 'Enquiries', value: dashboardStats.totalEnquiries },
                                    { name: 'Appointments', value: dashboardStats.totalAppointments },
                                    { name: 'Patients', value: dashboardStats.totalPatients },
                                    { name: 'Leads', value: dashboardStats.totalLeads },
                                    { name: 'Treatments', value: dashboardStats.totalTreatments },
                                  ]}
                                  margin={{ top: 10, right: 10, left: 0, bottom: 24 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                  <XAxis 
                                    dataKey="name" 
                                    fontSize={10}
                                    tick={{ fill: '#0d9488' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                  />
                                  <YAxis 
                                    fontSize={10}
                                    tick={{ fill: '#0d9488' }}
                                    width={30}
                                  />
                                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#14b8a6" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              // For other roles, show empty state or access denied
              return (
                <div className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200 shadow-sm">
                  <div className="text-center max-w-md mx-auto">
                    <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Building2 className="w-6 h-6 text-teal-800" />
                    </div>
                    <h3 className="text-lg font-bold text-teal-900 mb-2">
                      No Access
                    </h3>
                    <p className="text-sm text-teal-700 mb-3">
                      You don't have permission to view health center information.
                    </p>
                    <p className="text-xs text-teal-600">
                      Please contact your administrator to request access to the Health Center Management module.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
const getImagePath = (photoPath: string | File) => {
  console.log("🖼️ Processing photo path:", photoPath, typeof photoPath);
  
  if (!photoPath) {
    console.log("❌ Empty photo path");
    return PLACEHOLDER_DATA_URI;
  }
  
  if (photoPath instanceof File) {
    // If it's a File object, create a temporary URL for preview
    const url = URL.createObjectURL(photoPath);
    console.log("📎 File object URL created:", url);
    return url;
  }
  
  if (typeof photoPath === 'string') {
    let cleanPath = photoPath.trim().replace(/^['"`]+|['"`]+$/g, '').replace(/\\/g, '/');
    const siteOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_ORIGIN || 'http://localhost:3000');
    const defaultUploadsOrigin =
      process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || siteOrigin;
    const uploadsOrigin =
      process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || defaultUploadsOrigin;
    
    if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
      console.log("🌐 Full URL detected:", cleanPath);
      // Map production host to uploads origin in dev
      if (process.env.NODE_ENV !== 'production' && cleanPath.includes('zeva360.com')) {
        // Extract the path part after the domain
        try {
          const url = new URL(cleanPath);
          const localPath = url.pathname;
          const localUrl = `${uploadsOrigin}${localPath}`;
          console.log("🔄 Converting production URL to local:", localUrl);
          return localUrl;
        } catch (e) {
          console.log("❌ Failed to parse URL, using original:", cleanPath);
          return cleanPath;
        }
      }
      // Map localhost:3000 uploads to uploadsOrigin
      if (cleanPath.includes('localhost:3000')) {
        try {
          const url = new URL(cleanPath);
          const mapped = `${uploadsOrigin}${url.pathname}`;
          console.log("🔄 Mapping localhost:3000 to uploads origin:", mapped);
          return mapped;
        } catch {
          // fallback
          return cleanPath.replace('http://localhost:3000', uploadsOrigin);
        }
      }
      
      return cleanPath;
    }
    
    if (cleanPath.startsWith("/uploads/")) {
      const fullPath = `${uploadsOrigin}${cleanPath}`;
      console.log("📂 Uploads path converted:", fullPath);
      return fullPath;
    }
    if (cleanPath.includes("uploads")) {
      const normalized = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
      const fullPath = `${uploadsOrigin}${normalized}`;
      console.log("📂 Generic uploads path converted:", fullPath);
      return fullPath;
    }
    
    if (!cleanPath.includes("/") && cleanPath.length > 0) {
      const fullPath = `${uploadsOrigin}/uploads/clinic/${cleanPath}`;
      console.log("📄 Filename converted:", fullPath);
      return fullPath;
    }
    
    if (cleanPath.startsWith("/")) {
      const fullPath = `${uploadsOrigin}${cleanPath}`;
      console.log("🔗 Relative path converted:", fullPath);
      return fullPath;
    }
    
    console.log("❓ Unknown path format:", cleanPath);
    return PLACEHOLDER_DATA_URI;
  }
  
  console.log("❌ Invalid photo path type:", typeof photoPath);
  return PLACEHOLDER_DATA_URI;
};

const PLACEHOLDER_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='12' fill='%239ca3af' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E";
 

ClinicManagementDashboard.getLayout = function PageLayout(
  page: React.ReactNode
) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

// ✅ Apply HOC and assign correct type
const ProtectedDashboard: NextPageWithLayout = withClinicAuth(
  ClinicManagementDashboard
);

// ✅ Reassign layout (TS-safe now)
ProtectedDashboard.getLayout = ClinicManagementDashboard.getLayout;

export default ProtectedDashboard;
