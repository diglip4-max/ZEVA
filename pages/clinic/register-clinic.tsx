"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "../../lib/firebase";
import {
  Eye,
  EyeOff,
  Mail,
  Phone,
  Heart,
  Users,
} from "lucide-react";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
} from "firebase/auth";
import axios from "axios";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";

interface SuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({ isOpen, onClose }) => {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRedirect = () => {
    onClose();
    router.push("/");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#00b480' }}>
            <span className="text-2xl text-white">🎉</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Registration Complete!
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            Your clinic profile is under review. We'll notify you once approved.
          </p>
          <button
            onClick={handleRedirect}
            className="text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 hover:opacity-90 text-sm"
            style={{ background: `linear-gradient(to right, #00b480, #008f66)` }}
          >
            Go to Home Page
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, visible, onClose }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible || !message) return null;

  const styles = {
    success: "bg-gradient-to-r from-green-100 to-green-200 shadow-green-200",
    error: "bg-gradient-to-r from-red-100 to-red-200 shadow-red-200",
    info: "bg-gradient-to-r from-blue-100 to-blue-200 shadow-blue-200",
  };
  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  const textColorClasses = {
    success: "text-green-800",
    error: "text-red-800",
    info: "text-blue-800",
  };
  
  const iconColorClasses = {
    success: "text-green-600",
    error: "text-red-600",
    info: "text-blue-600",
  };

  const hoverColorClasses = {
    success: "hover:text-green-900",
    error: "hover:text-red-900",
    info: "hover:text-blue-900",
  };

  return (
    <div
      className={`fixed top-20 right-4 z-[9999] ${styles[type]} ${textColorClasses[type]} px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-[90vw] animate-slide-in backdrop-blur-sm`}
      style={{ 
        animation: 'slideInRight 0.3s ease-out',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)'
      }}
    >
      <span className={`text-2xl font-bold flex-shrink-0 ${iconColorClasses[type]}`}>{icons[type]}</span>
      <span className="flex-1 text-sm font-medium leading-relaxed">{message}</span>
      <button
        onClick={onClose}
        className={`${textColorClasses[type]} opacity-80 ${hoverColorClasses[type]} text-2xl font-bold flex-shrink-0 hover:bg-white/30 rounded-full w-6 h-6 flex items-center justify-center transition-all`}
        aria-label="Close"
      >
        ×
      </button>
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

interface ContactInfo {
  name: string;
  phone: string;
}

interface FormState {
  email: string;
  name: string;
  address: string;
  pricing: string;
  timings: string;
  latitude: number;
  longitude: number;
}

interface Errors {
  name?: string;
  treatments?: string;
  address?: string;
  location?: string;
  clinicPhoto?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  emailVerification?: string;
  password?: string;
}

interface TreatmentType {
  name: string;
  slug: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

const RegisterClinic: React.FC & {
  getLayout?: (page: React.ReactNode) => React.ReactNode;
} = () => {
  // Removed currentStep - now single page form
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState<boolean>(false);
  const [ownerPassword, setOwnerPassword] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: "",
    phone: "",
  });
  const [addressDebounceTimer, setAddressDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [locationDebounceTimer, setLocationDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [locationInput, setLocationInput] = useState<string>("");
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState<boolean>(false);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>({
    email: "",
    name: "",
    address: "",
    pricing: "",
    timings: "",
    latitude: 0,
    longitude: 0,
  });
  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [selectedTreatments, setSelectedTreatments] = useState<
    (TreatmentType | string)[]
  >([]);

  const [otherTreatments, setOtherTreatments] = useState<string[]>([]);
  const [newOther, setNewOther] = useState<string>("");
  const [clinicPhoto, setClinicPhoto] = useState<File | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "success",
  });
  const [showToast, setShowToast] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [slugPreview, setSlugPreview] = useState<{
    slug: string;
    url: string;
    user_message: string;
    collision_resolved: boolean;
  } | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState<boolean>(false);
  const slugCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToastMessage = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setShowToast(true);
  };

  // Check slug availability when name and address change
  const checkSlugAvailability = useCallback(async (name: string, address: string) => {
    if (!name.trim() || !address.trim()) {
      setSlugPreview(null);
      return;
    }

    // Clear previous timer
    if (slugCheckTimerRef.current) {
      clearTimeout(slugCheckTimerRef.current);
    }

    // Debounce slug check
    slugCheckTimerRef.current = setTimeout(async () => {
      setIsCheckingSlug(true);
      try {
        const response = await axios.post('/api/clinics/check-slug', {
          name: name.trim(),
          address: address.trim(),
        });

        if (response.data.success) {
          setSlugPreview({
            slug: response.data.slug,
            url: response.data.url,
            user_message: response.data.user_message,
            collision_resolved: response.data.collision_resolved || false,
          });
        } else {
          setSlugPreview(null);
        }
      } catch (error) {
        console.error('Error checking slug:', error);
        setSlugPreview(null);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 500); // 500ms debounce
  }, []);

  // Removed validateStep - now using single form validation

  // Removed validateForm - now using single form validation in handleSubmit

  const onMapLoad = useCallback(() => {
    const geocoderInstance = new window.google.maps.Geocoder();
    setGeocoder(geocoderInstance);
  }, []);

  const geocodeAddress = useCallback(
    (address: string) => {
      if (!geocoder || !address.trim()) return;
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          setForm((f) => ({
            ...f,
            latitude: location.lat(),
            longitude: location.lng(),
          }));
          showToastMessage("Address located on map automatically!", "success");
          setErrors((prev) => ({ ...prev, location: undefined }));
        } else {
          // Don't show error message - user can click on map to set location
          // Silent failure - let user manually set location on map
        }
      });
    },
    [geocoder]
  );

  const geocodeLocation = useCallback(
    (location: string) => {
      if (!geocoder || !location.trim()) {
        return;
      }
      geocoder.geocode({ address: location }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          setForm((f) => ({
            ...f,
            latitude: loc.lat(),
            longitude: loc.lng(),
          }));
          showToastMessage("Location updated on map!", "success");
          setErrors((prev) => ({ ...prev, location: undefined }));
        } else {
          // Don't show error - user can still click on map to set location
          // Don't show any toast message - let user click on map instead
          // Clear any existing location errors
          setErrors((prev) => ({ ...prev, location: undefined }));
        }
      });
    },
    [geocoder]
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAddress = e.target.value;
    setForm((f) => ({ ...f, address: newAddress }));
    if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
    if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
    const timer = setTimeout(() => {
      if (newAddress.trim().length > 10) geocodeAddress(newAddress);
    }, 1000);
    setAddressDebounceTimer(timer);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocation = e.target.value;
    setLocationInput(newLocation);
    // Clear location error when user types
    if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
    if (locationDebounceTimer) clearTimeout(locationDebounceTimer);
    const timer = setTimeout(() => {
      if (newLocation.trim().length > 5) {
        geocodeLocation(newLocation);
      } else if (newLocation.trim().length === 0) {
        // Clear location if input is empty
        setForm((f) => ({ ...f, latitude: 0, longitude: 0 }));
      }
    }, 800);
    setLocationDebounceTimer(timer);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 10) {
      setContactInfo({ ...contactInfo, phone: value });
      if (value.length === 10 && errors.phone) {
        setErrors((prev) => ({ ...prev, phone: undefined }));
      }
    }
  };

  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const response = await axios.get("/api/clinics/treatments");
        const data = response.data as { success: boolean; treatments: TreatmentType[] };
        if (data.success) {
          setTreatments(data.treatments);
        }
      } catch (err) {
        console.error('Error fetching treatments:', err);
      }
    };
    fetchTreatments();

    if (isSignInWithEmailLink(auth, window.location.href)) {
      const stored = localStorage.getItem("clinicEmail") || "";
      signInWithEmailLink(auth, stored, window.location.href)
        .then(() => {
          setForm((f) => ({ ...f, email: stored || "" }));
          setEmailVerified(true);
          setEmailSent(true);
          showToastMessage("Email verified successfully!", "success");
          setErrors((prev) => ({
            ...prev,
            email: undefined,
            emailVerification: undefined,
          }));
        })
        .catch(() => showToastMessage("Invalid verification link", "error"));
    }
    return () => {
      if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
      if (locationDebounceTimer) clearTimeout(locationDebounceTimer);
    };
  }, []);

  const sendVerificationLink = async () => {
    if (!form.email) {
      showToastMessage("Please enter an email address", "error");
      return;
    }

    // Validate email format
    if (!form.email.includes("@")) {
      setErrors((prev) => ({ ...prev, email: "Enter a valid email" }));
      showToastMessage("Please enter a valid email address", "error");
      return;
    }

    setIsCheckingEmail(true);
    setErrors((prev) => ({ ...prev, email: undefined }));

    try {
      // First check if email already exists in database
      const checkResponse = await axios.post('/api/clinics/check-email', { email: form.email });
      
      // If email exists (status 200), show error message
      if (checkResponse.status === 200) {
        showToastMessage("This email already exist", "error");
        setErrors((prev) => ({ ...prev, email: "This email already exist" }));
        setIsCheckingEmail(false);
        return;
      }
    } catch (error: any) {
      // If email doesn't exist (404), proceed to send verification link
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Email doesn't exist, proceed with sending verification link
        try {
          sendSignInLinkToEmail(auth, form.email, {
            url: window.location.href,
            handleCodeInApp: true,
          });
          localStorage.setItem("clinicEmail", form.email);
          setEmailSent(true);
          showToastMessage("Verification link sent! Check your inbox.", "success");
        } catch (firebaseError) {
          console.error('Firebase error:', firebaseError);
          showToastMessage("Failed to send verification link. Please try again.", "error");
        }
      } else {
        // Other errors
        console.error('Error checking email:', error);
        showToastMessage("Error checking email. Please try again.", "error");
      }
      setIsCheckingEmail(false);
      return;
    }
    
    setIsCheckingEmail(false);
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
    }
    
    // Validate all fields
    const newErrors: Errors = {};
    
    if (!form.email.trim()) newErrors.email = "Email is required";
    if (!emailVerified) newErrors.emailVerification = "Email must be verified";
    if (!ownerPassword.trim()) newErrors.password = "Password is required";
    if (!form.name.trim()) newErrors.name = "Clinic name is required";
    
    // Count total services including custom ones
    const standardServices = selectedTreatments.filter((t) => t !== "other");
    const totalServices = standardServices.length + otherTreatments.length;
    if (totalServices === 0) {
      newErrors.treatments = "Please select at least one service";
    }
    
    if (!form.address.trim()) newErrors.address = "Address is required";
    if (form.latitude === 0 && form.longitude === 0) {
      newErrors.location = "Please set location on map";
    }
    if (!clinicPhoto) newErrors.clinicPhoto = "Clinic photo is required";
    if (!contactInfo.name.trim()) newErrors.contactName = "Your name is required";
    if (!contactInfo.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(contactInfo.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      showToastMessage(newErrors[firstKey as keyof Errors] || "", "error");
      return;
    }

    if (selectedTreatments.includes("other")) {
      const uniqueCustoms = Array.from(
        new Set(
          otherTreatments
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .slice(0, 5)
        )
      );

      for (const custom of uniqueCustoms) {
        try {
          await axios.post("/api/clinics/treatments", {
            treatment_name: custom,
          });
        } catch (err) {
          console.error("Error adding custom treatment:", err);
        }
      }

      if (uniqueCustoms.length > 0) {
        const updatedTreatments = selectedTreatments
          .filter((t) => t !== "other")
          .concat(uniqueCustoms);
        setSelectedTreatments(updatedTreatments);
      }
    }

    try {
      await axios.post("/api/clinics/registerOwner", {
        email: form.email,
        password: ownerPassword,
        name: contactInfo.name,
        phone: contactInfo.phone,
      });
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || "Unknown error occurred while registering owner.";
      showToastMessage(`Owner registration failed: ${errorMessage}`, "error");
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v.toString()));

    const finalTreatments = (() => {
      if (selectedTreatments.includes("other")) {
        const customs = Array.from(
          new Set(
            otherTreatments
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
              .slice(0, 5)
          )
        );
        return customs.length > 0
          ? [...selectedTreatments.filter((t) => t !== "other"), ...customs]
          : selectedTreatments.filter((t) => t !== "other");
      }
      return selectedTreatments;
    })();

    const treatmentObjects = finalTreatments.map((treatment) => {
      if (typeof treatment === "string") {
        return {
          mainTreatment: treatment,
          mainTreatmentSlug: treatment.toLowerCase().replace(/\s+/g, "-"),
        };
      } else {
        return {
          mainTreatment: treatment.name,
          mainTreatmentSlug: treatment.slug,
        };
      }
    });

    data.append("treatments", JSON.stringify(treatmentObjects));
    if (clinicPhoto) data.append("clinicPhoto", clinicPhoto);
    if (licenseDoc) data.append("licenseDocument", licenseDoc);

    try {
      const response = await axios.post("/api/clinics/register", data);
      setShowSuccessPopup(true);
      
      // Show slug preview message if available
      if (response.data.slug_preview) {
        showToastMessage(
          response.data.slug_preview.user_message || "Clinic registered successfully!",
          "success"
        );
      } else {
        showToastMessage("Clinic registered successfully!", "success");
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Clinic registration failed";
      // Don't show "Invalid address" error if location is already set
      if (errorMessage.toLowerCase().includes("invalid address") && form.latitude !== 0 && form.longitude !== 0) {
        showToastMessage("Registration failed. Please check all fields.", "error");
      } else {
        showToastMessage(errorMessage, "error");
      }
    }
  };


  const handleTreatmentSelect = (treatment: TreatmentType | string) => {
    const alreadySelected = selectedTreatments.some((t) => {
      if (typeof t === "string" && typeof treatment === "string") {
        return t === treatment;
      } else if (typeof t === "object" && typeof treatment === "object") {
        return t.slug === treatment.slug;
      }
      return false;
    });

    if (alreadySelected) {
      setSelectedTreatments((prev) =>
        prev.filter((t) => {
          if (typeof t === "string" && typeof treatment === "string") {
            return t !== treatment;
          } else if (typeof t === "object" && typeof treatment === "object") {
            return t.slug !== treatment.slug;
          }
          return true;
        })
      );
      if (typeof treatment === "string" && treatment === "other") {
        setOtherTreatments([]);
      }
    } else {
      setSelectedTreatments((prev) => [...prev, treatment]);
    }

    if (typeof treatment === "string" && treatment === "other") {
      setIsDropdownOpen(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 1024 * 1024) {
        showToastMessage("Please Upload File Less Than 1MB", "error");
        return;
      }
      setClinicPhoto(file);
      if (errors.clinicPhoto)
        setErrors((prev) => ({ ...prev, clinicPhoto: undefined }));
    }
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 1024 * 1024) {
        showToastMessage("Please Upload File Less Than 1MB", "error");
        return;
      }
      setLicenseDoc(file);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const registrationRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={showToast}
        onClose={() => setShowToast(false)}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="grid lg:grid-cols-2 min-h-screen">
          
          {/* Left Side - Registration Form */}
          <div className="flex items-start justify-center p-4 lg:p-6 pt-8 lg:pt-10">
            <div className="w-full max-w-4xl">
              
              {/* Header */}
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#00b480] to-[#008f66] rounded-full mb-3 shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-black mb-1">
                  Clinic Registration
                </h1>
                <p className="text-black/70 text-sm">
                  Join ZEVA's network of healthcare centers
                </p>
              </div>

              {/* Form */}
              <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100" ref={registrationRef}>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Slug Preview */}
                  {slugPreview && form.name.trim() && form.address.trim() && (
                    <div className={`p-3 rounded-lg border-2 ${
                      slugPreview.collision_resolved 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            {slugPreview.collision_resolved ? '🔗 Your Unique Clinic URL:' : '🔗 Your Clinic URL:'}
                          </p>
                          <a
                            href={slugPreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#00b480] hover:underline break-all font-mono"
                          >
                            {slugPreview.url}
                          </a>
                          <p className="text-xs text-gray-600 mt-2">
                            {slugPreview.user_message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isCheckingSlug && form.name.trim() && form.address.trim() && (
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-500">Checking slug availability...</p>
                    </div>
                  )}

                  {/* Email and Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Email * {emailVerified && <span className="text-green-600 text-xs">✓ Verified</span>}
                      </label>
                      <div className="flex gap-1.5">
                        <div className="flex-1 relative">
                          <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            name="email"
                            type="email"
                            placeholder="healthcare@example.com"
                            className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                              errors.email
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                                : emailVerified
                                  ? "border-green-400 focus:border-green-500 focus:ring-green-500/20"
                                  : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                            }`}
                            onChange={(e) => {
                              setForm({ ...form, email: e.target.value });
                              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                              if (emailVerified) {
                                setEmailVerified(false);
                                setEmailSent(false);
                              }
                            }}
                            value={form.email || ""}
                            disabled={emailVerified}
                            required
                          />
                        </div>
                        <button
                          type="button"
                          className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-1 ${
                            emailVerified
                              ? "bg-green-600 text-white"
                              : emailSent
                                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                                : isCheckingEmail
                                  ? "bg-gray-400 text-white cursor-not-allowed"
                                  : "bg-gradient-to-r from-[#00b480] to-[#008f66] text-white hover:from-[#008f66] hover:to-[#007a5a]"
                          }`}
                          onClick={sendVerificationLink}
                          disabled={(emailSent && !emailVerified) || isCheckingEmail}
                        >
                          {emailVerified ? (
                            <>
                              <span>✓</span> Verified
                            </>
                          ) : emailSent ? (
                            "Sent"
                          ) : isCheckingEmail ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Checking...
                            </>
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </div>
                      {errors.email && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create password (min. 8 characters)"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                            errors.password 
                              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" 
                              : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                          }`}
                          value={ownerPassword}
                          onChange={(e) => {
                            setOwnerPassword(e.target.value);
                            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                          }}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.password}</p>
                      )}
                    </div>
                  </div>

                  {/* Center Name and Contact Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Center Name * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <input
                        placeholder="Green Valley Wellness"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                          emailVerified 
                            ? errors.name
                              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                              : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                        }`}
                        value={form.name}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, name: e.target.value }));
                          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                          checkSlugAvailability(e.target.value, form.address);
                        }}
                        disabled={!emailVerified}
                        required
                      />
                      {errors.name && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Your Full Name * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <div className="relative">
                        <Users className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          placeholder="Dr. John Smith"
                          className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                            emailVerified 
                              ? errors.contactName
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                                : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                              : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                          }`}
                          value={contactInfo.name}
                          onChange={(e) => {
                            setContactInfo({ ...contactInfo, name: e.target.value });
                            if (errors.contactName) setErrors((prev) => ({ ...prev, contactName: undefined }));
                          }}
                          disabled={!emailVerified}
                          required
                        />
                      </div>
                      {errors.contactName && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.contactName}</p>
                      )}
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-medium text-black mb-1.5">
                      Phone Number * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="tel"
                        placeholder="1234567890"
                        className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                          emailVerified 
                            ? errors.phone
                              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                              : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                        }`}
                        value={contactInfo.phone}
                        onChange={handlePhoneChange}
                        maxLength={10}
                        disabled={!emailVerified}
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">10-digit mobile number</p>
                    {errors.phone && (
                      <p className="text-red-500 text-xs mt-0.5">{errors.phone}</p>
                    )}
                  </div>

                  {/* Services Offered */}
                  <div className="relative text-black" ref={dropdownRef}>
                    <label className="block text-xs font-medium text-black mb-1.5">
                      Services Offered * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      disabled={!emailVerified}
                      className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between focus:ring-2 transition-all text-sm ${
                        emailVerified 
                          ? errors.treatments
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-gray-50 hover:bg-white"
                            : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20 bg-gray-50 hover:bg-white"
                          : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="flex-1">
                        {selectedTreatments.length === 0 && otherTreatments.length === 0 ? (
                          <span className="text-gray-400 text-sm">Select services...</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {selectedTreatments.filter(t => t !== "other").slice(0, 2).map((treatment, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#00b480]/10 text-[#00b480]"
                              >
                                {typeof treatment === "string" ? treatment : treatment.name}
                              </span>
                            ))}
                            {otherTreatments.length > 0 && (
                              <span className="text-xs text-[#00b480]">+{otherTreatments.length} custom</span>
                            )}
                            {(selectedTreatments.filter(t => t !== "other").length + otherTreatments.length) > 2 && (
                              <span className="text-xs text-gray-500">...</span>
                            )}
                          </div>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isDropdownOpen && emailVerified && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        <div className="p-1">
                          {treatments.map((treatment, index) => (
                            <div
                              key={index}
                              onClick={() => handleTreatmentSelect(treatment)}
                              className={`px-3 py-1.5 cursor-pointer rounded text-xs ${
                                selectedTreatments.some((t) => typeof t === "object" && t.slug === treatment.slug)
                                  ? "bg-[#00b480]/10 text-[#00b480]"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              {treatment.name}
                            </div>
                          ))}
                          <div
                            onClick={() => handleTreatmentSelect("other")}
                            className={`px-3 py-1.5 cursor-pointer rounded border-t text-xs ${
                              selectedTreatments.includes("other") ? "bg-[#00b480]/10 text-[#00b480]" : "hover:bg-gray-50"
                            }`}
                          >
                            Other Services
                          </div>
                        </div>
                      </div>
                    )}
                    {errors.treatments && (
                      <p className="text-red-500 text-xs mt-0.5">{errors.treatments}</p>
                    )}
                  </div>

                  {/* Custom Treatments Input */}
                  {selectedTreatments.includes("other") && emailVerified && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                        Add Custom Services (Max 5)
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Enter service name"
                          className="text-gray-900 flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#00b480] focus:outline-none bg-white text-sm"
                          value={newOther}
                          onChange={(e) => setNewOther(e.target.value)}
                          onKeyPress={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmedService = newOther.trim();
                              if (trimmedService && otherTreatments.length < 5) {
                                if (!otherTreatments.includes(trimmedService)) {
                                  // Check if treatment already exists in database
                                  try {
                                    const treatmentsResponse = await axios.get("/api/doctor/getTreatment");
                                    const allTreatments = treatmentsResponse.data.treatments || [];
                                    const normalizedService = trimmedService.toLowerCase();
                                    const existsInDatabase = allTreatments.some((t: any) =>
                                      t.name?.toLowerCase().trim() === normalizedService
                                    );
                                    
                                    if (existsInDatabase) {
                                      showToastMessage("Treatment already exist", "error");
                                      return;
                                    }
                                    
                                    setOtherTreatments([...otherTreatments, trimmedService]);
                                    setNewOther("");
                                    showToastMessage("Custom service added!", "success");
                                  } catch (error) {
                                    // If check fails, still allow adding locally
                                    setOtherTreatments([...otherTreatments, trimmedService]);
                                    setNewOther("");
                                    showToastMessage("Custom service added!", "success");
                                  }
                                } else {
                                  showToastMessage("Service already added", "info");
                                }
                              } else if (otherTreatments.length >= 5) {
                                showToastMessage("Maximum 5 custom services allowed", "error");
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const trimmedService = newOther.trim();
                            if (trimmedService && otherTreatments.length < 5) {
                              if (!otherTreatments.includes(trimmedService)) {
                                // Check if treatment already exists in database
                                try {
                                  const treatmentsResponse = await axios.get("/api/doctor/getTreatment");
                                  const allTreatments = treatmentsResponse.data.treatments || [];
                                  const normalizedService = trimmedService.toLowerCase();
                                  const existsInDatabase = allTreatments.some((t: any) =>
                                    t.name?.toLowerCase().trim() === normalizedService
                                  );
                                  
                                  if (existsInDatabase) {
                                    showToastMessage("Treatment already exist", "error");
                                    return;
                                  }
                                  
                                  setOtherTreatments([...otherTreatments, trimmedService]);
                                  setNewOther("");
                                  showToastMessage("Custom service added!", "success");
                                } catch (error) {
                                  // If check fails, still allow adding locally
                                  setOtherTreatments([...otherTreatments, trimmedService]);
                                  setNewOther("");
                                  showToastMessage("Custom service added!", "success");
                                }
                              } else {
                                showToastMessage("Service already added", "info");
                              }
                            } else if (otherTreatments.length >= 5) {
                              showToastMessage("Maximum 5 custom services allowed", "error");
                            }
                          }}
                          disabled={otherTreatments.length >= 5}
                          className={`px-3 py-2 rounded-lg font-semibold text-xs whitespace-nowrap ${
                            otherTreatments.length >= 5
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-[#00b480] text-white hover:bg-[#009973]"
                          }`}
                        >
                          Add
                        </button>
                      </div>
                      {otherTreatments.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Added services ({otherTreatments.length}/5):</p>
                          <div className="flex flex-wrap gap-1">
                            {otherTreatments.map((treatment, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-[#00b480] text-white"
                              >
                                {treatment}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOtherTreatments(otherTreatments.filter((_, i) => i !== index));
                                    showToastMessage("Service removed", "info");
                                  }}
                                  className="ml-1.5 hover:bg-[#008f66] rounded-full w-4 h-4 flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-medium text-black mb-1.5">
                      Address * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                    </label>
                    <textarea
                      placeholder="Street, Building, City, State"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none text-sm text-black placeholder-black/50 ${
                        emailVerified 
                          ? errors.address
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                          : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                      }`}
                      value={form.address}
                      onChange={(e) => {
                        handleAddressChange(e);
                        checkSlugAvailability(form.name, e.target.value);
                      }}
                      rows={2}
                      disabled={!emailVerified}
                      required
                    />
                    {errors.address && (
                      <p className="text-red-500 text-xs mt-0.5">{errors.address}</p>
                    )}
                  </div>

                  {/* Price Range and Hours */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Price Range {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <input
                        placeholder="500-2000"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                          emailVerified 
                            ? "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20" 
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                        }`}
                        value={form.pricing}
                        onChange={(e) => setForm((f) => ({ ...f, pricing: e.target.value }))}
                        disabled={!emailVerified}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Hours {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <input
                        placeholder="9 AM - 6 PM"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none ${
                          emailVerified 
                            ? "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20" 
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                        }`}
                        value={form.timings}
                        onChange={(e) => setForm((f) => ({ ...f, timings: e.target.value }))}
                        disabled={!emailVerified}
                      />
                    </div>
                  </div>

                  {/* Location with Map */}
                  <div>
                    <label className="block text-xs font-medium text-black mb-1.5">
                      Location <span className="text-red-500">*</span> {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Type address or location (e.g., Noida Sector 5)"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-all text-sm text-black placeholder-black/50 outline-none mb-1.5 ${
                        emailVerified 
                          ? errors.location
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-300 focus:border-[#00b480] focus:ring-[#00b480]/20"
                          : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                      }`}
                      value={locationInput}
                      onChange={handleLocationChange}
                      disabled={!emailVerified}
                    />
                    {emailVerified && (
                      <p className="text-xs text-gray-500 mb-1.5">Or click map to pin location</p>
                    )}
                    <div className={`h-40 border-2 rounded-lg overflow-hidden transition-all ${
                      errors.location ? "border-red-400" : "border-gray-300"
                    } ${!emailVerified ? "opacity-60 pointer-events-none" : ""}`}>
                      <GoogleMap
                        zoom={form.latitude !== 0 ? 15 : 12}
                        center={{
                          lat: form.latitude !== 0 ? form.latitude : 28.61,
                          lng: form.longitude !== 0 ? form.longitude : 77.2,
                        }}
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        onLoad={onMapLoad}
                        onClick={(e) => {
                          if (e.latLng && emailVerified) {
                            setForm((f) => ({ 
                              ...f, 
                              latitude: e.latLng!.lat(), 
                              longitude: e.latLng!.lng() 
                            }));
                            setErrors((prev) => ({ ...prev, location: undefined }));
                            if (geocoder) {
                              geocoder.geocode({ location: e.latLng }, (results, status) => {
                                if (status === "OK" && results && results[0]) {
                                  setLocationInput(results[0].formatted_address);
                                  showToastMessage("Location set successfully!", "success");
                                }
                              });
                            } else {
                              showToastMessage("Location set successfully!", "success");
                            }
                          }
                        }}
                      >
                        {form.latitude !== 0 && (
                          <Marker position={{ lat: form.latitude, lng: form.longitude }} />
                        )}
                      </GoogleMap>
                    </div>
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-0.5">{errors.location}</p>
                    )}
                    {form.latitude !== 0 && form.longitude !== 0 && (
                      <p className="text-xs text-green-600 mt-0.5">✓ Location set successfully</p>
                    )}
                  </div>

                  {/* File Uploads */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        Photo * {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className={`w-full px-3 py-2 border rounded-lg bg-gray-50 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#00b480] file:text-white text-xs transition-all ${
                          emailVerified 
                            ? errors.clinicPhoto
                              ? "border-red-400 focus:border-red-500"
                              : "border-gray-300 focus:border-[#00b480]"
                            : "border-gray-200 bg-gray-100 opacity-60"
                        }`}
                        onChange={handleFileChange}
                        disabled={!emailVerified}
                        required
                      />
                      {errors.clinicPhoto && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.clinicPhoto}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1.5">
                        License {!emailVerified && <span className="text-gray-500 text-xs">(Verify email first)</span>}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className={`w-full px-3 py-2 border rounded-lg bg-gray-50 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 text-xs transition-all ${
                          emailVerified 
                            ? "border-gray-300 focus:border-[#00b480]"
                            : "border-gray-200 bg-gray-100 opacity-60"
                        }`}
                        onChange={handleLicenseChange}
                        disabled={!emailVerified}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className={`w-full bg-gradient-to-r from-[#00b480] to-[#008f66] text-white py-2 px-6 rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg ${
                      emailVerified 
                        ? "hover:from-[#008f66] hover:to-[#007a5a] transform hover:-translate-y-0.5 hover:shadow-xl" 
                        : "opacity-60 cursor-not-allowed"
                    }`}
                    disabled={!emailVerified}
                  >
                    Complete Registration
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Side - Why Register */}
          <div className="hidden lg:flex items-start justify-center p-4 lg:p-6 pt-8 lg:pt-10">
            <div className="w-full max-w-xl">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 lg:p-8 border border-blue-400 mt-24 lg:mt-28">
                
                {/* Header */}
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-bold mb-2 text-white">Why Register With ZEVA?</h2>
                  <p className="text-blue-50 text-sm">
                    Join thousands of healthcare centers who trust our platform
                  </p>
                </div>

                {/* Benefits Cards */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-white/30 hover:shadow-lg transition-all hover:scale-[1.02]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Comprehensive Dashboard</h3>
                        <p className="text-gray-600 text-xs">
                          Manage your clinic operations with powerful analytics and insights
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-white/30 hover:shadow-lg transition-all hover:scale-[1.02]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Extensive Patient Network</h3>
                        <p className="text-gray-600 text-xs">
                          Connect with thousands of patients seeking quality healthcare services
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-white/30 hover:shadow-lg transition-all hover:scale-[1.02]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Post Job Opportunities</h3>
                        <p className="text-gray-600 text-xs">
                          Hire qualified healthcare professionals directly through the platform
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-md border border-white/30 hover:shadow-lg transition-all hover:scale-[1.02]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Appointment Management</h3>
                        <p className="text-gray-600 text-xs">
                          Streamline scheduling and manage patient appointments efficiently
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="mt-4 p-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-white/30">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Additional Benefits
                  </h4>
                  <ul className="space-y-1.5 text-gray-600 text-xs">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                      24/7 customer support for all clinics
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                      Free marketing tools and promotional materials
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                      Secure patient data management system
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                      Regular platform updates and new features
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SuccessPopup isOpen={showSuccessPopup} onClose={() => setShowSuccessPopup(false)} />
    </>
  );
};

export default RegisterClinic;

RegisterClinic.getLayout = function PageLayout(page: React.ReactNode) {
  return <Layout>{page}</Layout>;
};