import React, { useState, useEffect, ReactElement, useMemo } from "react";
import { toast, Toaster } from "react-hot-toast";
import axios from "axios";
import { Building2, Edit3, X, Plus, ChevronLeft, ChevronRight, Clock, MapPin, DollarSign, Users, Star, Heart, Activity, Check, FileText, Upload, Eye, Download, Trash2, AlertCircle, Palette, CreditCard, Calendar as CalendarIcon, MessageSquare, Plug, Save } from "lucide-react";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import type { NextPageWithLayout } from "../_app";
import Loader from "@/components/Loader";
import { getUserRole } from "@/lib/helper";
import { getAuthHeaders } from "@/lib/helper";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

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
    enabled?: boolean;
    subTreatments: Array<{
      name: string;
      slug: string;
      price?: number;
      enabled?: boolean;
    }>;
  }>;
  photos: (string | File)[];
  documents?: Array<{ name: string; url?: string; file?: File }>;
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

function ClinicManagementDashboard(): ReactElement {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Clinic>>({});
  const [newTreatment, setNewTreatment] = useState("");
  const [newSubTreatment, setNewSubTreatment] = useState("");
  const [newSubTreatmentPrice, setNewSubTreatmentPrice] = useState("");
  const [selectedTreatmentIndex, setSelectedTreatmentIndex] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newDocName, setNewDocName] = useState<string>("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
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
  const [activeTab, setActiveTab] = useState<
    'General Info' | 'Contact' | 'Documents' | 'Listing' | 'Clinic Timing' |
    'Branches' | 'Notifications' | 'Branding' | 'Integrations'
  >('General Info');
  const [contactForm, setContactForm] = useState({ phone: '', whatsapp: '', email: '', website: '' });
  const [listingVisibility, setListingVisibility] = useState({
    showServices: true,
    showPrices: true,
    showStaff: true,
    showReviews: true,
    enableOnlineBooking: true,
    featuredListing: false,
  });
  const [timing, setTiming] = useState([
    { day: 'Monday', open: true, opening: '09:00', closing: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    { day: 'Tuesday', open: false, opening: '', closing: '', breakStart: '', breakEnd: '' },
    { day: 'Wednesday', open: false, opening: '', closing: '', breakStart: '', breakEnd: '' },
    { day: 'Thursday', open: true, opening: '09:00', closing: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    { day: 'Friday', open: false, opening: '', closing: '', breakStart: '', breakEnd: '' },
    { day: 'Saturday', open: true, opening: '12:00', closing: '20:00', breakStart: '', breakEnd: '' },
    { day: 'Sunday', open: false, opening: '', closing: '', breakStart: '', breakEnd: '' },
  ]);
  const [generalInfo, setGeneralInfo] = useState({
    slug: '',
    tagline: '',
    description: ''
  });
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    whatsapp: false,
    appointments: true,
    leads: true,
    invoiceReminders: false,
    marketingUpdates: false,
  });
  const [brandPrimary, setBrandPrimary] = useState<string>("#14B8A6");
  const [brandSecondary, setBrandSecondary] = useState<string>("#5eead4");
  const [invoiceLogoPreview, setInvoiceLogoPreview] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: true, lastSynced: "2 hours ago" },
    payment: { connected: true, lastSynced: "Just now" },
    googleCalendar: { connected: false, lastSynced: null as null | string },
    sms: { connected: false, lastSynced: null as null | string },
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 28.474389, lng: 77.50399 });
  const { isLoaded: mapsLoaded } = useJsApiLoader({ googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "" });
  const btnBase = "inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-semibold transition-all";
  const btnPrimary = `${btnBase} bg-teal-600 text-white hover:bg-teal-700 shadow-sm`;
  const btnSecondary = `${btnBase} bg-white text-gray-800 border border-gray-200 hover:bg-gray-100`;
  const [stateSnapshot, setStateSnapshot] = useState<any | null>(null);
  const [docPreview, setDocPreview] = useState<{ open: boolean; url: string; name: string; isImage: boolean }>({ open: false, url: "", name: "", isImage: false });
  const [docSizes, setDocSizes] = useState<Record<number, string>>({});
  const [branches, setBranches] = useState<Array<{ id: string; name: string; address: string; phone?: string; email?: string; primary?: boolean }>>([]);
  const [branchModal, setBranchModal] = useState<{ open: boolean; mode: 'add' | 'edit'; targetId?: string; name: string; address: string; phone: string; email: string }>({ open: false, mode: 'add', name: '', address: '', phone: '', email: '' });
  const [offers, setOffers] = useState<Array<{ _id?: string; title: string; type: "percentage" | "fixed" | "free Consult"; value: number; currency?: string; startsAt: string; endsAt: string; enabled?: boolean; treatments?: Array<{ name: string }> }>>([]);
  const [offersLoading] = useState(false);

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

  useEffect(() => {
    if (!coverPreview && editForm?.photos && (editForm.photos as any[]).length > 0) {
      const photosArray = editForm.photos as any[];
      const idx = Math.min(Math.max(currentPhotoIndex, 0), Math.max(photosArray.length - 1, 0));
      const viewingPhoto = photosArray[idx] || photosArray[0];
      if (viewingPhoto) {
        const src = getImagePath(viewingPhoto);
        setCoverPreview(src);
      }
    }
  }, [editForm.photos, currentPhotoIndex, coverPreview]);

  useEffect(() => {
    const c = clinics?.[0];
    if (!c) return;
    if (!editingClinicId) {
      setEditingClinicId(c._id);
    }
    setEditForm(prev => {
      const hasAny = Object.keys(prev || {}).length > 0;
      return hasAny ? prev : { ...c };
    });
    setGeneralInfo(prev => ({
      slug: (prev.slug || (c as any).slug || "").trim(),
      tagline: (prev.tagline || (c as any).tagline || "").trim(),
      description: (prev.description || (c as any).description || "").trim(),
    }));
    setContactForm(prev => ({
      phone: (prev.phone || (c as any).phone || "").trim(),
      whatsapp: (prev.whatsapp || (c as any).whatsapp || "").trim(),
      email: (prev.email || (c as any).email || "").trim(),
      website: (prev.website || (c as any).website || "").trim(),
    }));
    if (!stateSnapshot) {
      setStateSnapshot({
        editForm: { ...c },
        generalInfo: { 
          slug: ((c as any).slug || "").trim(), 
          tagline: ((c as any).tagline || "").trim(), 
          description: ((c as any).description || "").trim() 
        },
        contactForm: {
          phone: ((c as any).phone || "").trim(),
          whatsapp: ((c as any).whatsapp || "").trim(),
          email: ((c as any).email || "").trim(),
          website: ((c as any).website || "").trim(),
        },
        listingVisibility,
        timing,
        notificationSettings,
        brandPrimary,
        brandSecondary,
        logoPreview,
        coverPreview,
        integrations,
      });
    }
    setBranches(prev => {
      if (prev.length === 0) {
        return [{
          id: 'primary',
          name: (c as any).name || 'Main Clinic',
          address: (c as any).address || '',
          phone: contactForm.phone || '',
          email: contactForm.email || '',
          primary: true
        }];
      }
      return prev;
    });
  }, [clinics]);

  const locateOnMap = () => {
    if (!mapsLoaded) {
      setMapCenter({ lat: 28.474389, lng: 77.50399 });
      return;
    }
    const addr = (editForm.address || "").trim() || "Pari Chowk, Noida";
    const g = new window.google.maps.Geocoder();
    g.geocode({ address: addr }, (res, status) => {
      if (status === "OK" && res && res[0]) {
        const loc = res[0].geometry.location;
        setMapCenter({ lat: loc.lat(), lng: loc.lng() });
      } else {
        setMapCenter({ lat: 28.474389, lng: 77.50399 });
      }
    });
  };

  const isDirty = useMemo(() => {
    if (!stateSnapshot) return false;
    const current = {
      editForm,
      generalInfo,
      contactForm,
      listingVisibility,
      timing,
      notificationSettings,
      brandPrimary,
      brandSecondary,
      logoPreview,
      coverPreview,
      integrations,
    };
    const saved = {
      editForm: stateSnapshot.editForm,
      generalInfo: stateSnapshot.generalInfo,
      contactForm: stateSnapshot.contactForm,
      listingVisibility: stateSnapshot.listingVisibility,
      timing: stateSnapshot.timing,
      notificationSettings: stateSnapshot.notificationSettings,
      brandPrimary: stateSnapshot.brandPrimary,
      brandSecondary: stateSnapshot.brandSecondary,
      logoPreview: stateSnapshot.logoPreview,
      coverPreview: stateSnapshot.coverPreview,
      integrations: stateSnapshot.integrations,
    };
    try {
      return JSON.stringify(current) !== JSON.stringify(saved);
    } catch {
      return true;
    }
  }, [
    editForm,
    generalInfo,
    contactForm,
    listingVisibility,
    timing,
    notificationSettings,
    brandPrimary,
    brandSecondary,
    logoPreview,
    coverPreview,
    integrations,
    stateSnapshot,
  ]);
  useEffect(() => {
    const fetchSize = async (u: string, idx: number) => {
      try {
        const r = await fetch(u, { method: "HEAD" });
        const len = r.headers.get("content-length");
        if (len) {
          const kb = (parseInt(len, 10) / 1024).toFixed(1) + " KB";
          setDocSizes((p) => ({ ...p, [idx]: kb }));
        }
      } catch {}
    };
    (editForm.documents || []).forEach((d: any, i: number) => {
      const u = String(d?.url || "");
      if (u && !docSizes[i]) {
        fetchSize(u, i);
      }
    });
  }, [editForm.documents]);

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
        enabled: true,
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
            price: typeof sub.price === "number" && sub.price > 0 ? sub.price : undefined,
            enabled: true
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

  // removed unused removePhotoAt to satisfy strict TS rules

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
    setTimeout(() => {
      setStateSnapshot({
        editForm: { ...clinic, photos: sanitizedPhotos as any },
        generalInfo,
        contactForm,
        listingVisibility,
        timing,
        notificationSettings,
        brandPrimary,
        brandSecondary,
        logoPreview,
        coverPreview,
        integrations,
      });
    }, 0);
  };

  // Handle cancel
  const handleCancel = () => {
    console.log('🔴 Cancel clicked - Resetting form');
    if (stateSnapshot) {
      setEditForm(stateSnapshot.editForm || {});
      setGeneralInfo(stateSnapshot.generalInfo || { slug: "", tagline: "", description: "" });
      setContactForm(stateSnapshot.contactForm || { phone: "", whatsapp: "", email: "", website: "" });
      setListingVisibility(stateSnapshot.listingVisibility || listingVisibility);
      setTiming(stateSnapshot.timing || timing);
      setNotificationSettings(stateSnapshot.notificationSettings || notificationSettings);
      setLogoPreview(stateSnapshot.logoPreview || null);
      setCoverPreview(stateSnapshot.coverPreview || null);
      setIntegrations(stateSnapshot.integrations || integrations);
      setBrandPrimary(stateSnapshot.brandPrimary || brandPrimary);
      setBrandSecondary(stateSnapshot.brandSecondary || brandSecondary);
    }
    setSelectedFiles([]);
    setNewDocName("");
    setNewDocFile(null);
    toast.success("Changes cancelled");
  };

  const handleAddDocument = () => {
    if (!newDocName.trim() || !newDocFile) {
      toast.error("Please provide document name and file");
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      documents: [
        ...(prev.documents || []),
        {
          name: newDocName.trim(),
          file: newDocFile,
        } as any,
      ],
    }));
    setNewDocName("");
    setNewDocFile(null);
    toast.success("Document added");
  };

  const handleRemoveExistingDocument = (index: number) => {
    setEditForm((prev) => {
      const docs = [...(prev.documents || [])];
      if (index >= 0 && index < docs.length) {
        docs.splice(index, 1);
      }
      return { ...prev, documents: docs };
    });
  };

  // removed unused handleRenameExistingDocument to satisfy strict TS rules

  // Handle update
  const handleUpdate = async () => {
    console.log('🟢 Save Changes clicked');
    if (!editingClinicId) {
      console.error('❌ No clinic ID found');
      toast.error("No clinic selected for update");
      return;
    }
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
      const existingDocuments =
        (editForm.documents || [])
          .filter((d: any) => d && typeof d.url === "string" && d.url.length > 0)
          .map((d: any) => ({
            name: d.name,
            url: toRelativeUploadPath(String(d.url)),
          }));
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
      const documentFilesToUpload =
        (editForm.documents || [])
          .filter((d: any) => d && d.file instanceof File)
          .map((d: any) => d.file as File);
      const hasFiles = filesToUpload.length > 0;
      const hasDocFiles = documentFilesToUpload.length > 0;
      if (hasFiles || hasDocFiles) {
        const form = new FormData();
        form.append("name", safeName);
        form.append("address", safeAddress);
        const slugToSave = (generalInfo.slug || editForm.slug || "").trim();
        if (slugToSave) form.append("slug", slugToSave);
        form.append("tagline", (generalInfo.tagline || "").trim());
        form.append("description", (generalInfo.description || "").trim());
        form.append("phone", (contactForm.phone || "").trim());
        form.append("whatsapp", (contactForm.whatsapp || "").trim());
        form.append("email", (contactForm.email || "").trim());
        form.append("website", (contactForm.website || "").trim());
        if (editForm.pricing) form.append("pricing", editForm.pricing.trim());
        if (editForm.timings) form.append("timings", editForm.timings.trim());
        if (editForm.servicesName)
          form.append("servicesName", JSON.stringify(editForm.servicesName));
        if (editForm.treatments)
          form.append("treatments", JSON.stringify(editForm.treatments));
        form.append("existingPhotos", JSON.stringify(existingPhotos));
        if (existingDocuments && existingDocuments.length > 0) {
          form.append("existingDocuments", JSON.stringify(existingDocuments));
        }
        filesToUpload.forEach((file) => form.append("photos", file));
        // Append new documents with names
        (editForm.documents || [])
          .filter((d: any) => d && d.file instanceof File)
          .forEach((d: any) => {
            form.append("documents", d.file);
            form.append("documentNames", d.name || d.file?.name || "Document");
          });
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
            if (existingDocuments && existingDocuments.length > 0) {
              retryForm.append("existingDocuments", JSON.stringify(existingDocuments));
            }
            filesToUpload.forEach((file) => retryForm.append("photos", file));
            (editForm.documents || [])
              .filter((d: any) => d && d.file instanceof File)
              .forEach((d: any) => {
                retryForm.append("documents", d.file);
                retryForm.append("documentNames", d.name || d.file?.name || "Document");
              });
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
          ...(generalInfo.slug && { slug: generalInfo.slug.trim() }),
          tagline: (generalInfo.tagline || "").trim(),
          description: (generalInfo.description || "").trim(),
          phone: (contactForm.phone || "").trim(),
          whatsapp: (contactForm.whatsapp || "").trim(),
          email: (contactForm.email || "").trim(),
          website: (contactForm.website || "").trim(),
          ...(editForm.pricing && { pricing: editForm.pricing.trim() }),
          ...(editForm.timings && { timings: editForm.timings.trim() }),
          ...(editForm.servicesName && { servicesName: editForm.servicesName }),
          ...(editForm.treatments && { treatments: editForm.treatments }),
          existingPhotos,
          ...(editForm.documents && {
            documents: (editForm.documents || [])
              .filter((d: any) => typeof d.url === "string" && d.url.length > 0)
              .map((d: any) => ({
                name: d.name,
                url: toRelativeUploadPath(String(d.url)),
              })),
          }),
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
      console.log('✅ Update successful, refreshing data...');
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
        if (clinicObj) {
          setEditForm({ ...clinicObj });
          setStateSnapshot({
            editForm: { ...clinicObj },
            generalInfo,
            contactForm,
            listingVisibility,
            timing,
            notificationSettings,
            brandPrimary,
            brandSecondary,
            logoPreview,
            coverPreview,
            integrations,
          });
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
      enabled: true,
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
      price: price > 0 ? price : undefined,
      enabled: true
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

  const toggleMainTreatment = (index: number, isOn: boolean) => {
    setEditForm(prev => {
      const updated = [...(prev.treatments || [])];
      if (!updated[index]) return prev;
      const current = { ...updated[index] };
      current.enabled = !!isOn;
      if (!isOn && Array.isArray(current.subTreatments)) {
        current.subTreatments = current.subTreatments.map(st => ({ ...st, enabled: false }));
      }
      updated[index] = current;
      return { ...prev, treatments: updated };
    });
  };

  const toggleSubTreatment = (tIndex: number, sIndex: number, isOn: boolean) => {
    setEditForm(prev => {
      const updated = [...(prev.treatments || [])];
      if (!updated[tIndex]) return prev;
      const t = { ...updated[tIndex] };
      if (!Array.isArray(t.subTreatments) || !t.subTreatments[sIndex]) return prev;
      const sub = { ...t.subTreatments[sIndex], enabled: !!isOn };
      t.subTreatments = [...t.subTreatments];
      t.subTreatments[sIndex] = sub;
      updated[tIndex] = t;
      return { ...prev, treatments: updated };
    });
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

  // Main component render
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
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-lg relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 ">
              <div className="space-y-1 ">
                <div className="flex items-center gap-2 ">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manage Health Center</h1>
                  {isDirty ? (
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                      Unsaved Changes
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full border border-green-200">
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Configure your clinic settings and preferences</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:absolute sm:top-4 sm:right-5">
              <button
                onClick={handleCancel}
                className={btnSecondary}
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Tabs - Positioned below header */}
        <div className="px-3 py-4 max-w-7xl">
          <div className="flex items-center gap-2 h-10 rounded-full bg-white/80 border border-gray-200 shadow-sm px-2 overflow-x-auto whitespace-nowrap">
            {(['General Info','Contact','Documents','Listing','Clinic Timing','Branches','Notifications','Branding','Integrations'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-7 px-3 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-transparent text-gray-800 hover:bg-gray-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {isEditing ? (
          <div className="px-3">
              {/* Content below tabs */}

              {/* General Info */}
              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 ${activeTab === 'General Info' ? '' : 'hidden'}`}>
                {/* Left Column - Basic Info (full width on large screens) */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Enter clinic name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username / Slug</label>
                        <input
                          type="text"
                          value={generalInfo.slug || editForm.slug || ""}
                          onChange={(e) => setGeneralInfo(prev => ({ ...prev, slug: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="zeva-health"
                        />
                        <div className="mt-1 text-sm">
                          <span className="text-gray-600">Preview: </span>
                          <span className="text-teal-600">zeva.com/{(generalInfo.slug || editForm.slug || '').trim() || 'slug'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                        <input
                          type="text"
                          value={generalInfo.tagline}
                          onChange={(e) => setGeneralInfo(prev => ({ ...prev, tagline: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Your Health, Our Priority"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={generalInfo.description}
                          onChange={(e) => setGeneralInfo(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Premium healthcare services in Dubai"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Media</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Clinic Logo</div>
                        <label className="relative block overflow-hidden border-2 border-dashed border-teal-200 rounded-xl p-6 sm:p-5 min-h-[220px] sm:min-h-[240px] text-center hover:border-teal-300 hover:bg-teal-50/30 transition flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const url = URL.createObjectURL(f);
                              setLogoPreview(url);
                            }}
                          />
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="absolute inset-0 w-full h-full object-contain" />
                          ) : (
                            <div className="text-gray-600 text-base sm:text-lg flex flex-col items-center justify-center">
                              <Upload className="w-8 h-8 text-teal-500 mb-2" />
                              <span className="font-medium">Click to upload logo</span>
                              <div className="text-xs sm:text-sm text-gray-500 mt-1">PNG, JPG up to 5MB</div>
                            </div>
                          )}
                        </label>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Cover Image</div>
                        <label className="relative block overflow-hidden border-2 border-dashed border-teal-200 rounded-xl p-6 sm:p-5 min-h-[220px] sm:min-h-[240px] text-center hover:border-teal-300 hover:bg-teal-50/30 transition flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const url = URL.createObjectURL(f);
                              setCoverPreview(url);
                            }}
                          />
                          {coverPreview ? (
                            <img src={coverPreview} alt="Cover" className="absolute inset-0 w-full h-full object-contain" />
                          ) : (
                            <div className="text-gray-600 text-base sm:text-lg flex flex-col items-center justify-center">
                              <Upload className="w-8 h-8 text-teal-500 mb-2" />
                              <span className="font-medium">Click to upload cover</span>
                              <div className="text-xs sm:text-sm text-gray-500 mt-1">PNG, JPG up to 5MB</div>
                            </div>
                          )}
                        </label>
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

                  {/* Treatments Section (hidden in General Info UI; functionality unchanged) */}
                  {false && (<div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-700" />
                      Treatments
                    </h3>
                    {selectedTreatmentIndex != null && editForm.treatments && (editForm.treatments as any[])?.[selectedTreatmentIndex as number] && (
                      <div className="mb-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-3 py-1.5 bg-teal-800 text-white rounded-full text-sm font-semibold">
                            {(editForm.treatments as any[])[selectedTreatmentIndex as number].mainTreatment}
                          </span>
                          <span className="text-[11px] text-teal-700">
                            {((editForm.treatments as any[])[selectedTreatmentIndex as number].subTreatments || []).length} selected
                          </span>
                        </div>
                        {(editForm.treatments as any[])[selectedTreatmentIndex as number].subTreatments && (editForm.treatments as any[])[selectedTreatmentIndex as number].subTreatments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {((editForm.treatments as any[])[selectedTreatmentIndex as number].subTreatments || []).map((sub: any, sIdx: number) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-teal-700 rounded-full text-xs border border-gray-200"
                              >
                                {sub.name}
                                {typeof sub.price === "number" && sub.price > 0 && (
                                  <span className="text-teal-800 font-bold">د.إ{sub.price}</span>
                                )}
                                <button
                                  onClick={() => handleRemoveSubTreatment(selectedTreatmentIndex as number, sIdx)}
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
                            <div className="flex items-center justify-between mb-3 gap-3">
                              <div className="flex items-center gap-3">
                                <span className="px-3 py-1.5 bg-teal-800 text-white rounded-full text-sm font-semibold">
                                  {treatment.mainTreatment}
                                </span>
                                <label className="flex items-center gap-1 text-xs text-teal-700">
                                  <input
                                    type="checkbox"
                                    checked={treatment.enabled !== false}
                                    onChange={(e) => toggleMainTreatment(index, e.target.checked)}
                                  />
                                  Show
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRemoveTreatment(index)}
                                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {treatment.subTreatments && treatment.subTreatments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {treatment.subTreatments.map((subTreatment: any, subIndex: number) => (
                                  <div
                                    key={subIndex}
                                    className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-100 text-teal-700 rounded-full text-xs border border-gray-200"
                                  >
                                    <span className="font-medium">{subTreatment.name}</span>
                                    {typeof subTreatment.price === "number" && subTreatment.price > 0 && (
                                      <span className="text-teal-800 font-bold">د.إ{subTreatment.price}</span>
                                    )}
                                    <label className="flex items-center gap-1 ml-1">
                                      <input
                                        type="checkbox"
                                        checked={subTreatment.enabled !== false}
                                        onChange={(e) => toggleSubTreatment(index, subIndex, e.target.checked)}
                                        disabled={treatment.enabled === false}
                                      />
                                      Show
                                    </label>
                                    <button
                                      onClick={() => handleRemoveSubTreatment(index, subIndex)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
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
                  </div>)}
                </div>
              </div>

              {/* Contact */}
              {activeTab === 'Contact' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-teal-900 mb-3">Contact Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" 
                          value={contactForm.phone} 
                          onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                          placeholder="+91 1234569870"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                        <input 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" 
                          value={contactForm.whatsapp} 
                          onChange={(e) => setContactForm({...contactForm, whatsapp: e.target.value})}
                          placeholder="+91 1234567890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input 
                          type="email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" 
                          value={contactForm.email} 
                          onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                          placeholder="clinic@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                        <input 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" 
                          value={contactForm.website} 
                          onChange={(e) => setContactForm({...contactForm, website: e.target.value})}
                          placeholder="https://www.clinic.com"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-teal-900 mb-3">Location</h3>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" 
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                        placeholder="Enter clinic address"
                      />
                      <button
                        type="button"
                        onClick={locateOnMap}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-sm font-medium"
                      >
                        Locate on Map
                      </button>
                    </div>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      {mapsLoaded ? (
                        <GoogleMap
                          mapContainerStyle={{ width: "100%", height: "260px" }}
                          center={mapCenter}
                          zoom={14}
                        >
                          <Marker position={mapCenter} />
                        </GoogleMap>
                      ) : (
                        <div className="p-6 bg-teal-50 text-center text-teal-700">
                          <MapPin className="w-8 h-8 mx-auto mb-2" />
                          <p className="font-medium">Map loading…</p>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents */}
              {activeTab === 'Documents' && (
                <div className="space-y-6">
                  {/* Header with Upload Button */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Business Documents</h2>
                      <p className="text-sm text-gray-500 mt-1">Manage your clinic's official documents and certifications</p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all cursor-pointer shadow-sm">
                      <Upload className="w-4 h-4" />
                      <span className="font-medium">Upload New</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,image/jpeg,image/jpg,image/png"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) {
                            setNewDocFile(f);
                            setNewDocName(f.name.split('.')[0]);
                            toast.success("File selected. Click Add Document to upload.");
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Document Grid */}
                  {(editForm.documents && editForm.documents.length > 0) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {(editForm.documents || []).map((doc: any, idx: number) => {
                        const url = String(doc?.url || "");
                        const hasUrl = url && url.length > 0;
                        const isImage = /\.(jpg|jpeg|png)$/i.test(url);
                        const fileName = doc?.name || `Document ${idx + 1}`;
                        const fileSize = doc?.file ? `${(doc.file.size / 1024).toFixed(1)} KB` : (docSizes[idx] || doc.size || 'N/A');
                        const fileType = isImage ? 'Image' : (url.split('.').pop() || doc.type || 'PDF').toUpperCase();
                        const uploadDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently';
                        const isPending = !hasUrl && doc.file; // New document not yet saved
                        
                        return (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative">
                            {/* Status Badge */}
                            <div className="absolute top-3 right-3">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                  <Check className="w-3 h-3" />
                                  Valid
                                </span>
                              )}
                            </div>

                            {/* Document Icon & Info */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {isImage && hasUrl ? (
                                  <img src={url} alt={fileName} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-6 h-6 text-teal-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">{fileName}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                  <span>{fileType}</span>
                                  <span>•</span>
                                  <span>{fileSize}</span>
                                </div>
                                <div className="mt-1 text-xs text-gray-400">
                                  Uploaded {uploadDate}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                              {hasUrl ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isImage) {
                                        setDocPreview({ open: true, url, name: fileName, isImage: true });
                                      } else {
                                        window.open(url, "_blank", "noopener,noreferrer");
                                      }
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View
                                  </button>
                                  <a
                                    href={url}
                                    download
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </a>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    disabled
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed opacity-60"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveExistingDocument(idx)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* Save Notice */}
                            {isPending && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-orange-600 text-center">
                                  ⚠️ Click "Update Profile" to save this document
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900">No documents yet</h3>
                      <p className="text-sm text-gray-500 mt-1">Upload your first business document to get started</p>
                      {clinics.length > 0 && (
                        <p className="text-xs text-orange-600 mt-2">Note: Click Edit on your clinic to manage documents</p>
                      )}
                    </div>
                  )}

                  {/* Drag & Drop Upload Area */}
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-all"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-teal-500', 'bg-teal-50');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
                      const files = Array.from(e.dataTransfer.files);
                      if (files.length === 0) return;
                      
                      const file = files[0];
                      const allowedTypes = [".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png"];
                      const fileExt = "." + file.name.split('.').pop()?.toLowerCase();
                      
                      if (!allowedTypes.includes(fileExt)) {
                        toast.error("Invalid file type. Supported: PDF, DOC, DOCX, TXT, JPG, PNG");
                        return;
                      }
                      
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("File size exceeds 5MB");
                        return;
                      }
                      
                      setNewDocFile(file);
                      setNewDocName(file.name.split('.')[0]);
                      toast.success(`File "${file.name}" ready to upload`);
                    }}
                  >
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-teal-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload New Document</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Drag and drop your files here, or click to browse
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (Max 5MB)
                      </p>
                      
                      {/* Quick Upload Form */}
                      <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                        <input
                          type="text"
                          placeholder="Document name"
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                        />
                        <label className="flex-1 relative">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".pdf,.doc,.docx,.txt,image/jpeg,image/jpg,image/png"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setNewDocFile(f);
                              if (f && !newDocName) {
                                setNewDocName(f.name.split('.')[0]);
                              }
                            }}
                          />
                          <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 text-center hover:bg-gray-50 transition-all">
                            {newDocFile ? (
                              <span className="text-teal-700 font-medium">✓ {newDocFile.name}</span>
                            ) : (
                              "Choose File"
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddDocument}
                          disabled={!newDocName.trim() || !newDocFile}
                          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Document
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Listing */}
              {activeTab === 'Listing' && (
                <div className="w-full">
                  {/* Main Card */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ">
                    {/* Card Header */}
                    <div className="p-6 border-b border-gray-100">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Marketplace Visibility</h2>
                      <p className="text-sm text-gray-500">Control what information is visible on your public marketplace profile</p>
                      
                      {/* Info Alert Box */}
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h3 className="text-base font-normal text-blue-900">These settings control visibility on Zeva marketplace</h3>
                          <p className="text-sm text-blue-800 font-medium">Changes will be reflected on your public profile within 24 hours</p>
                        </div>
                      </div>
                    </div>

                    {/* Settings List */}
                    <div className="divide-y divide-gray-100">
                      {/* Show Services */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Show Services</h4>
                          <p className="text-sm text-gray-500 mt-1">Display your clinic's services on the marketplace</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.showServices as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, showServices: !prev.showServices }));
                              toast.success(`Services will be ${!listingVisibility.showServices ? 'shown' : 'hidden'} on marketplace`);
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Show Prices */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Show Prices</h4>
                          <p className="text-sm text-gray-500 mt-1">Display treatment prices publicly</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.showPrices as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, showPrices: !prev.showPrices }));
                              toast.success(`Prices will be ${!listingVisibility.showPrices ? 'shown' : 'hidden'}`);
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Show Staff */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Show Staff</h4>
                          <p className="text-sm text-gray-500 mt-1">Display doctor and staff profiles</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.showStaff as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, showStaff: !prev.showStaff }));
                              toast.success(`Staff profiles will be ${!listingVisibility.showStaff ? 'shown' : 'hidden'}`);
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Show Reviews */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Show Reviews</h4>
                          <p className="text-sm text-gray-500 mt-1">Display patient reviews and ratings</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.showReviews as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, showReviews: !prev.showReviews }));
                              toast.success(`Reviews will be ${!listingVisibility.showReviews ? 'shown' : 'hidden'}`);
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Enable Online Booking */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Enable Online Booking</h4>
                          <p className="text-sm text-gray-500 mt-1">Allow patients to book appointments online</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.enableOnlineBooking as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, enableOnlineBooking: !prev.enableOnlineBooking }));
                              toast.success(`Online booking ${!listingVisibility.enableOnlineBooking ? 'enabled' : 'disabled'}`);
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>

                      {/* Featured Listing */}
                      <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors bg-gray-50">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900">Featured Listing</h4>
                          <p className="text-sm text-gray-500 mt-1">Highlight your clinic at the top of search results</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={listingVisibility.featuredListing as boolean} 
                            onChange={() => {
                              setListingVisibility(prev => ({ ...prev, featuredListing: !prev.featuredListing }));
                            }}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Helper Text */}
                  <div className="mt-4 text-center">
                    
                  </div>
                </div>
              )}

              {/* Branches */}
              {activeTab === 'Branches' && (
                <div className="w-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Branch Management</h2>
                      <p className="text-sm text-gray-500 mt-1">Manage your clinic locations and branches</p>
                    </div>
                    <button 
                      onClick={() => setBranchModal({ open: true, mode: 'add', name: '', address: '', phone: '', email: '' })}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-sm font-medium shadow-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Branch
                    </button>
                  </div>

                  {/* Branch Cards */}
                  <div className="space-y-4 mb-6">
                    {/* Main Branch - Primary (from form) */}
                    <div className="bg-white border-2 border-teal-200 rounded-xl p-5 shadow-sm relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">{editForm.name || "Main Clinic"}</h3>
                          <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full">
                            Primary
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setBranchModal({ open: true, mode: 'edit', targetId: 'primary', name: String(editForm.name || ''), address: String(editForm.address || ''), phone: contactForm.phone || '', email: contactForm.email || '' })}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            disabled
                            className="p-2 text-red-400 bg-gray-100 rounded-lg cursor-not-allowed"
                            title="Cannot delete primary branch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-gray-500">Address</p>
                              <p className="text-sm text-gray-900">{editForm.address || "Not set"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Phone</p>
                              <p className="text-sm text-gray-900">{contactForm.phone || "Not set"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Email</p>
                              <p className="text-sm text-gray-900">{contactForm.email || "Not set"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                          
                        </div>
                      </div>
                    </div>
                    {/* Other branches */}
                    {branches.filter(b => !b.primary).map(b => (
                      <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-900">{b.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setBranchModal({ open: true, mode: 'edit', targetId: b.id, name: b.name, address: b.address, phone: b.phone || '', email: b.email || '' })}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setBranches(prev => prev.filter(x => x.id !== b.id))}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete branch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-gray-500">Address</p>
                              <p className="text-sm text-gray-900">{b.address || "Not set"}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">Phone</p>
                            <p className="text-sm text-gray-900">{b.phone || "Not set"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">Email</p>
                            <p className="text-sm text-gray-900">{b.email || "Not set"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Another Branch */}
                  <div className="border-2 mt-9 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Another Branch</h3>
                      <p className="text-sm text-gray-500 mb-4">Expand your clinic network by adding a new location</p>
                      <button 
                        onClick={() => setBranchModal({ open: true, mode: 'add', name: '', address: '', phone: '', email: '' })}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-sm font-medium"
                      >
                        Create New Branch
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinic Timing */}
              {activeTab === 'Clinic Timing' && (
                <div className="w-full">
                  {/* Single Unified Container */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Header Section */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">Clinic Working Hours</h2>
                          <p className="text-sm text-gray-500 mt-1">Set your clinic's availability for each day of the week</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const baseTime = timing[0];
                            // Validate Monday timings before applying
                            if (baseTime.open && (!baseTime.opening || !baseTime.closing)) {
                              toast.error("Monday must have opening and closing times");
                              return;
                            }
                            setTiming(prev => prev.map((t, idx) => 
                              idx === 0 ? t : { 
                                ...t, 
                                open: baseTime.open, 
                                opening: baseTime.opening, 
                                closing: baseTime.closing, 
                                breakStart: baseTime.breakStart, 
                                breakEnd: baseTime.breakEnd 
                              }
                            ));
                            toast.success("Monday schedule applied to all days");
                          }}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-sm font-medium shadow-sm flex items-center gap-2 whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Apply Monday to All
                        </button>
                      </div>
                    </div>

                    {/* Timing Cards - All Days in Same Container */}
                    <div className="divide-y divide-gray-100">
                      {timing.map((t, idx) => (
                        <div key={t.day} className={`p-5 transition-all ${t.open ? 'bg-blue-50/50' : 'bg-white'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={t.open} 
                                  onChange={() => {
                                    setTiming(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], open: !copy[idx].open };
                                      return copy;
                                    });
                                  }}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                              </label>
                              <span className="text-base font-semibold text-gray-900 w-24">{t.day}</span>
                            </div>
                            {!t.open && (
                              <span className="text-sm text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full">Closed</span>
                            )}
                          </div>
                          
                          {t.open && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-14 animate-fadeIn">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                                 
                                  Opening Time
                                </label>
                                <input 
                                  type="time" 
                                  value={t.opening} 
                                  onChange={(e) => {
                                    setTiming(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], opening: e.target.value };
                                      return copy;
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                                 
                                  Closing Time
                                </label>
                                <input 
                                  type="time" 
                                  value={t.closing} 
                                  onChange={(e) => {
                                    setTiming(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], closing: e.target.value };
                                      return copy;
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                                 
                                  Break Start
                                </label>
                                <input 
                                  type="time" 
                                  value={t.breakStart} 
                                  onChange={(e) => {
                                    setTiming(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], breakStart: e.target.value };
                                      return copy;
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white placeholder-gray-400"
                                  placeholder="Optional"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                                 
                                  Break End
                                </label>
                                <input 
                                  type="time" 
                                  value={t.breakEnd} 
                                  onChange={(e) => {
                                    setTiming(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], breakEnd: e.target.value };
                                      return copy;
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white placeholder-gray-400"
                                  placeholder="Optional"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Helper Text */}
                  <div className="mt-4 text-center">
                    
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'Notifications' && (
                <div className="w-full">
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Notification Preferences</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage how you receive notifications and updates</p>
                  </div>

                  {/* Notification Settings Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      
                      {/* Email Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Email Notifications</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Receive important updates via email</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.email}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* WhatsApp Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">WhatsApp Alerts</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Get instant notifications on WhatsApp</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.whatsapp}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, whatsapp: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Appointment Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Appointment Alerts</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Notifications for new bookings and cancellations</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.appointments}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, appointments: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Lead Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Lead Notifications</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Alerts when new leads submit inquiries</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.leads}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, leads: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Marketing Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Invoice Reminders</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Payment reminders and invoice notifications</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.invoiceReminders}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, invoiceReminders: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* SMS Notifications */}
                      <div className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Marketing Updates</h3>
                              <p className="text-sm text-gray-500 mt-0.5">Tips, news, and product updates from Zeva</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={notificationSettings.marketingUpdates}
                              onChange={(e) => setNotificationSettings(prev => ({ ...prev, marketingUpdates: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                          </label>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* Branding */}
              {activeTab === 'Branding' && (
                <div className="space-y-6">
                  {/* Brand Colors */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Palette className="w-5 h-5 text-teal-600" />
                          Brand Colors
                        </h3>
                        <p className="text-sm text-gray-500">Customize your clinic's brand identity</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Primary */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={brandPrimary}
                            onChange={(e) => setBrandPrimary(e.target.value)}
                            className="w-12 h-10 rounded-lg border border-gray-300 p-1 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={brandPrimary}
                            onChange={(e) => setBrandPrimary(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Used for buttons, links, and primary elements</p>
                      </div>
                      {/* Secondary */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={brandSecondary}
                            onChange={(e) => setBrandSecondary(e.target.value)}
                            className="w-12 h-10 rounded-lg border border-gray-300 p-1 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={brandSecondary}
                            onChange={(e) => setBrandSecondary(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Used for accents and highlights</p>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Color Preview</h4>
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div
                              className="h-10 rounded-lg"
                              style={{ backgroundColor: brandPrimary }}
                            />
                            <p className="text-xs text-center text-gray-600 mt-2">Primary</p>
                          </div>
                          <div>
                            <div
                              className="h-10 rounded-lg"
                              style={{ backgroundColor: brandSecondary }}
                            />
                            <p className="text-xs text-center text-gray-600 mt-2">Secondary</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Branding */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Invoice Branding</h3>
                        <p className="text-sm text-gray-500">Logo that appears on invoices and receipts</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Upload area */}
                      <div className="lg:col-span-3">
                        <label className="block">
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-all cursor-pointer">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-600">Click to upload invoice logo</p>
                            <p className="text-xs text-gray-400 mt-1">PNG, JPG • Recommended size: 400x100px</p>
                          </div>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              if (f) {
                                const url = URL.createObjectURL(f);
                                setInvoiceLogoPreview(url);
                                toast.success("Invoice logo selected");
                              }
                            }}
                          />
                        </label>
                      </div>

                      {/* Invoice Preview */}
                      <div className="lg:col-span-3">
                        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Invoice Preview</h4>
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-24 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                                {invoiceLogoPreview ? (
                                  <img src={invoiceLogoPreview} alt="logo" className="max-h-10 object-contain" />
                                ) : (
                                  <span className="text-xs text-gray-500">Logo</span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">INVOICE</p>
                                <p className="text-xs text-gray-400">#INV-2026-001</p>
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Consultation Fee</span>
                                <span className="font-semibold text-gray-900">AED 500.00</span>
                              </div>
                              <div className="flex items-center justify-between py-2">
                                <span className="font-semibold text-gray-900">Total</span>
                                <span className="font-semibold text-gray-900">AED 500.00</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations */}
              {activeTab === 'Integrations' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">Integrations</h3>
                    <p className="text-sm text-gray-500">Connect third‑party services to enhance functionality</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">WhatsApp Business API</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200 mt-1">
                              <Check className="w-3.5 h-3.5" />
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">Send automated appointment reminders and notifications</p>
                      <p className="text-xs text-gray-400 mb-4">Last synced: 2 hours ago</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 h-10 rounded-full bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-100"
                          onClick={() => toast.success('WhatsApp settings opened')}
                        >
                          Configure
                        </button>
                        <button
                          className="h-10 px-4 rounded-full bg-rose-100 text-rose-700 text-sm font-semibold hover:bg-rose-200"
                          onClick={() => {
                            setIntegrations(prev => ({ ...prev, whatsapp: { connected: false, lastSynced: "" } }));
                            toast.success('WhatsApp disconnected');
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Payment Gateway</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200 mt-1">
                              <Check className="w-3.5 h-3.5" />
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">Accept online payments for appointments and services</p>
                      <p className="text-xs text-gray-400 mb-4">Last synced: Just now</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 h-10 rounded-full bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-100"
                          onClick={() => toast.success('Payment settings opened')}
                        >
                          Configure
                        </button>
                        <button
                          className="h-10 px-4 rounded-full bg-rose-100 text-rose-700 text-sm font-semibold hover:bg-rose-200"
                          onClick={() => {
                            setIntegrations(prev => ({ ...prev, payment: { connected: false, lastSynced: "" } }));
                            toast.success('Payment gateway disconnected');
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                            <CalendarIcon className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Google Calendar</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full border border-gray-200 mt-1">
                              <X className="w-3.5 h-3.5" />
                              Not Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-6">Sync appointments with Google Calendar</p>
                      <button
                        className="w-full h-10 rounded-full bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                        onClick={() => {
                          setIntegrations(prev => ({ ...prev, googleCalendar: { connected: true, lastSynced: 'Just now' } }));
                          toast.success('Google Calendar connected');
                        }}
                      >
                        Connect
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">SMS Provider</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full border border-gray-200 mt-1">
                              <X className="w-3.5 h-3.5" />
                              Not Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-6">Send SMS notifications to patients</p>
                      <button
                        className="w-full h-10 rounded-full bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                        onClick={() => {
                          setIntegrations(prev => ({ ...prev, sms: { connected: true, lastSynced: 'Just now' } }));
                          toast.success('SMS provider connected');
                        }}
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                      <Plug className="w-6 h-6 text-teal-600" />
                    </div>
                    <p className="text-lg font-semibold text-gray-900">Need a Custom Integration?</p>
                    <p className="text-sm text-gray-500 mt-1">Contact our support team to discuss custom integration options</p>
                    <button
                      className="mt-4 h-10 px-5 rounded-full bg-white text-gray-800 border border-gray-200 hover:bg-gray-100 text-sm font-semibold"
                      onClick={() => toast.success('Support contacted')}
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              )}

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
                              
                              {/* Offers */}
                              <div>
                                <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                  Offers
                                </h4>
                                <div className="space-y-2">
                                  {offersLoading && (
                                    <div className="text-xs text-teal-600">Loading offers...</div>
                                  )}
                                  {!offersLoading && offers.length === 0 && (
                                    <div className="text-xs text-teal-600">No offers found</div>
                                  )}
                                  {offers.map((offer, idx) => {
                                    const isEnabled = offer.enabled !== false;
                                    return (
                                      <div key={offer._id || idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <div className="text-sm font-semibold text-teal-900">
                                              {offer.title}
                                            </div>
                                            <div className="text-[11px] text-teal-700">
                                              {offer.type === "percentage" ? `${offer.value}%` :
                                               offer.type === "fixed" ? `${offer.currency || "INR"} ${offer.value}` :
                                               "Free Consult"}
                                              {" · "}
                                              {new Date(offer.startsAt).toLocaleDateString()} - {new Date(offer.endsAt).toLocaleDateString()}
                                            </div>
                                          </div>
                                          {permissions.canUpdate && (
                                            <label className="flex items-center gap-1 text-xs text-teal-700">
                                              <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={async (e) => {
                                                  const nextOn = !!e.target.checked;
                                                  setOffers(prev => prev.map(o => o._id === offer._id ? { ...o, enabled: nextOn } : o));
                                                  try {
                                                    const authHeaders = getAuthHeaders();
                                                    if (!authHeaders) return;
                                                    const res = await axios.put(
                                                      `/api/lead-ms/update-offer?id=${offer._id}`,
                                                      { enabled: nextOn },
                                                      { headers: { ...authHeaders, "Content-Type": "application/json" } }
                                                    );
                                                    if (!res?.data?.success) {
                                                      throw new Error(res?.data?.message || "Failed to update offer");
                                                    }
                                                  } catch {
                                                    toast.error("Failed to update offer status");
                                                    setOffers(prev => prev.map(o => o._id === offer._id ? { ...o, enabled: offer.enabled } : o));
                                                  }
                                                }}
                                              />
                                              Toggle
                                            </label>
                                          )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                            isEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                            "bg-yellow-50 text-yellow-700 border-yellow-200"
                                          }`}>
                                            {isEnabled ? "enabled" : "disabled"}
                                          </span>
                                          {Array.isArray(offer.treatments) && offer.treatments.length > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-white text-teal-700 border border-gray-200">
                                              {offer.treatments.slice(0, 2).map(t => t.name).join(", ")}
                                              {offer.treatments.length > 2 ? ` +${offer.treatments.length - 2}` : ""}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Treatments */}
                              {clinic.treatments && clinic.treatments.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                    Treatments
                                  </h4>
                                  <div className={`space-y-2 ${clinic.treatments.length > 4 ? 'max-h-[28rem] sm:max-h-[36rem] overflow-y-auto pr-2 pb-1' : ''}`}>
                                    {clinic.treatments.map((treatment, tIndex) => (
                                      <div key={tIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <span className="px-2 py-1 bg-teal-800 text-white rounded-full text-xs font-semibold">
                                            {treatment.mainTreatment}
                                          </span>
                                          {permissions.canUpdate && (
                                            <label className="flex items-center gap-1 text-xs text-teal-700">
                                              <input
                                                type="checkbox"
                                                checked={treatment.enabled !== false}
                                                onChange={async (e) => {
                                                  const checked = e.target.checked;
                                                  // optimistic update
                                                  setClinics(prev => {
                                                    const next = [...prev];
                                                    const c0 = { ...next[0] };
                                                    const ts = [...(c0.treatments || [])];
                                                    const curr = { ...ts[tIndex] };
                                                    curr.enabled = checked;
                                                    if (!checked && Array.isArray(curr.subTreatments)) {
                                                      curr.subTreatments = curr.subTreatments.map(st => ({ ...st, enabled: false }));
                                                    }
                                                    ts[tIndex] = curr;
                                                    c0.treatments = ts;
                                                    next[0] = c0;
                                                    return next;
                                                  });
                                                  try {
                                                    const authHeaders = getAuthHeaders();
                                                    if (!authHeaders) return;
                                                    const base = clinics[0];
                                                    const payload = {
                                                      name: base.name,
                                                      address: base.address,
                                                      treatments: (clinics[0].treatments || []).map((t, i) =>
                                                        i === tIndex
                                                          ? {
                                                              ...t,
                                                              enabled: checked,
                                                              subTreatments: (t.subTreatments || []).map(st =>
                                                                checked ? st : { ...st, enabled: false }
                                                              ),
                                                            }
                                                          : t
                                                      ),
                                                    };
                                                    const res = await axios.put(`/api/clinics/${base._id}`, payload, {
                                                      headers: { ...authHeaders, "Content-Type": "application/json" },
                                                    });
                                                    if (!res?.data?.success) {
                                                      throw new Error(res?.data?.message || "Failed to update");
                                                    }
                                                  } catch {
                                                    toast.error("Failed to update treatment visibility");
                                                  }
                                                }}
                                              />
                                              Toggle
                                            </label>
                                          )}
                                        </div>
                                        {treatment.subTreatments && treatment.subTreatments.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {treatment.subTreatments.map((subTreatment, sIndex) => (
                                              <div
                                                key={sIndex}
                                                className="inline-flex items-center gap-2 px-2 py-1 bg-white text-teal-700 rounded-full text-xs border border-gray-200"
                                              >
                                                <span>{subTreatment.name}</span>
                                                {typeof subTreatment.price === "number" && subTreatment.price > 0 && (
                                                  <span className="text-teal-800 font-bold">د.إ{subTreatment.price}</span>
                                                )}
                                                {permissions.canUpdate && (
                                                  <label className="flex items-center gap-1">
                                                    <input
                                                      type="checkbox"
                                                      checked={subTreatment.enabled !== false}
                                                      disabled={treatment.enabled === false}
                                                      onChange={async (e) => {
                                                        const checked = e.target.checked;
                                                        // optimistic update
                                                        setClinics(prev => {
                                                          const next = [...prev];
                                                          const c0 = { ...next[0] };
                                                          const ts = [...(c0.treatments || [])];
                                                          const curr = { ...ts[tIndex] };
                                                          const subs = Array.isArray(curr.subTreatments) ? [...curr.subTreatments] : [];
                                                          if (subs[sIndex]) subs[sIndex] = { ...subs[sIndex], enabled: checked };
                                                          curr.subTreatments = subs;
                                                          ts[tIndex] = curr;
                                                          c0.treatments = ts;
                                                          next[0] = c0;
                                                          return next;
                                                        });
                                                        try {
                                                          const authHeaders = getAuthHeaders();
                                                          if (!authHeaders) return;
                                                          const base = clinics[0];
                                                          const updatedTreatments = (clinics[0].treatments || []).map((t, i) => {
                                                            if (i !== tIndex) return t;
                                                            const subs = (t.subTreatments || []).map((st, j) =>
                                                              j === sIndex ? { ...st, enabled: checked } : st
                                                            );
                                                            return { ...t, subTreatments: subs };
                                                          });
                                                          const payload = {
                                                            name: base.name,
                                                            address: base.address,
                                                            treatments: updatedTreatments,
                                                          };
                                                          const res = await axios.put(`/api/clinics/${base._id}`, payload, {
                                                            headers: { ...authHeaders, "Content-Type": "application/json" },
                                                          });
                                                          if (!res?.data?.success) {
                                                            throw new Error(res?.data?.message || "Failed to update");
                                                          }
                                                        } catch {
                                                          toast.error("Failed to update sub-treatment visibility");
                                                        }
                                                      }}
                                                    />
                                                    Toggle
                                                  </label>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                               {clinic.documents && clinic.documents.length > 0 && (
                                 <div>
                                   <h4 className="text-sm font-semibold text-teal-800 mb-2">
                                     Documents
                                   </h4>
                                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {clinic.documents.map((doc: any, dIdx: number) => {
                                      const url = getDocumentUrl(String(doc?.url || ""));
                                      const isImage = /\.(jpg|jpeg|png)$/i.test(url);
                                       return (
                                         <div
                                           key={dIdx}
                                           className="border border-gray-200 rounded-lg overflow-hidden bg-white"
                                         >
                                           <a
                                             href={url}
                                             target="_blank"
                                             rel="noreferrer"
                                             className="block"
                                           >
                                             {isImage ? (
                                               <img
                                                 src={url}
                                                 alt={doc?.name || `Document ${dIdx + 1}`}
                                                 className="w-full h-28 object-cover object-center"
                                                 onError={(e) => {
                                                   const img = e.currentTarget as HTMLImageElement;
                                                   img.onerror = null;
                                                   img.src = PLACEHOLDER_DATA_URI;
                                                 }}
                                               />
                                             ) : (
                                               <div className="w-full h-28 flex items-center justify-center bg-gray-50 text-teal-700">
                                                 <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                   <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                   <path d="M14 2v6h6" />
                                                 </svg>
                                               </div>
                                             )}
                                           </a>
                                           <div className="px-2 py-2">
                                             <div className="text-xs font-medium text-teal-900 truncate">
                                               {doc?.name || `Document ${dIdx + 1}`}
                                             </div>
                                             <a
                                               href={url}
                                               target="_blank"
                                               rel="noreferrer"
                                               className="text-[11px] text-teal-700 underline"
                                             >
                                               View
                                             </a>
                                           </div>
                                         </div>
                                       );
                                     })}
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
        {docPreview.open && docPreview.isImage && (
          <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
              <button
                type="button"
                onClick={() => setDocPreview({ open: false, url: "", name: "", isImage: false })}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/90 border border-gray-200 hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">{docPreview.name}</h4>
              </div>
              <div className="w-full max-h-[80vh] bg-white flex items-center justify-center">
                <img src={docPreview.url} alt={docPreview.name} className="w-full h-[80vh] object-cover" />
              </div>
            </div>
          </div>
        )}
        {branchModal.open && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  {branchModal.mode === 'add' ? 'Add Branch' : 'Edit Branch'}
                </h3>
                <button
                  onClick={() => setBranchModal(prev => ({ ...prev, open: false }))}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={branchModal.name}
                    onChange={e => setBranchModal(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Sector 18 Clinic"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={branchModal.address}
                    onChange={e => setBranchModal(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Complete address"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={branchModal.phone}
                      onChange={e => setBranchModal(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={branchModal.email}
                      onChange={e => setBranchModal(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="branch@example.com"
                    />
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setBranchModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!branchModal.name.trim()) {
                      toast.error("Branch name is required");
                      return;
                    }
                    if (branchModal.mode === 'edit') {
                      if (branchModal.targetId === 'primary') {
                        setEditForm(prev => ({ ...prev, name: branchModal.name, address: branchModal.address }));
                        setContactForm(prev => ({ ...prev, phone: branchModal.phone, email: branchModal.email }));
                      } else if (branchModal.targetId) {
                        setBranches(prev => prev.map(b => b.id === branchModal.targetId ? { ...b, name: branchModal.name, address: branchModal.address, phone: branchModal.phone, email: branchModal.email } : b));
                      }
                    } else {
                      const id = String(Date.now());
                      setBranches(prev => [...prev, { id, name: branchModal.name, address: branchModal.address, phone: branchModal.phone, email: branchModal.email }]);
                    }
                    setBranchModal(prev => ({ ...prev, open: false }));
                    toast.success(branchModal.mode === 'add' ? "Branch added" : "Branch updated");
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
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

const getDocumentUrl = (docPath: string) => {
  if (!docPath) return "";
  let clean = String(docPath).trim().replace(/^['"`]+|['"`]+$/g, "").replace(/\\/g, "/");
  const siteOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:3000");
  const uploadsOrigin = process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || siteOrigin;
  try {
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      const u = new URL(clean);
      if (u.host.includes("localhost:3000")) {
        return `${uploadsOrigin}${u.pathname}`;
      }
      if (process.env.NODE_ENV !== "production" && u.host.includes("zeva360.com")) {
        return `${uploadsOrigin}${u.pathname}`;
      }
      return clean;
    }
  } catch {}
  if (clean.startsWith("/uploads/")) return `${uploadsOrigin}${clean}`;
  if (clean.includes("uploads")) {
    const idx = clean.indexOf("uploads");
    return `${uploadsOrigin}/${clean.substring(idx)}`;
  }
  if (clean.startsWith("/")) return `${uploadsOrigin}${clean}`;
  if (clean.length > 0) return `${uploadsOrigin}/uploads/clinic/${clean}`;
  return "";
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
