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
  Shield,
  ChevronLeft,
  ChevronRight,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#2D9AA5' }}>
            <span className="text-3xl text-white">🎉</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Registration Complete!
          </h3>
          <p className="text-gray-600 mb-4">
            Your Health Center profile is under review. After approval, you will be able to login to your dashboard.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            We'll notify you once your profile has been approved.
          </p>
          <button
            onClick={handleRedirect}
            className="text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 hover:opacity-90"
            style={{ background: `linear-gradient(to right, #2D9AA5, #258A94)` }}
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
  const [currentStep, setCurrentStep] = useState(1);
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

  const validateStep = (step: number): boolean => {
    const newErrors: Errors = {};

    if (step === 1) {
      if (!form.email.trim()) newErrors.email = "Email is required";
      if (!emailVerified) newErrors.emailVerification = "Email must be verified";
      if (!ownerPassword.trim()) newErrors.password = "Password is required";
    } else if (step === 2) {
      if (!form.name.trim()) newErrors.name = "Clinic name is required";

      // Count total services including custom ones
      const standardServices = selectedTreatments.filter((t) => t !== "other");
      const totalServices = standardServices.length + otherTreatments.length;

      if (totalServices === 0) {
        newErrors.treatments = "Please select at least one service";
      }

      if (!form.address.trim()) newErrors.address = "Address is required";
      if (form.latitude === 0 && form.longitude === 0)
        newErrors.location = "Please set location on map";
      if (!clinicPhoto) newErrors.clinicPhoto = "Clinic photo is required";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      showToastMessage(newErrors[firstKey as keyof Errors] || "", "error");
      return false;
    }
    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};
    if (!contactInfo.name.trim())
      newErrors.contactName = "Your name is required";
    if (!contactInfo.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(contactInfo.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      showToastMessage(newErrors[firstKey as keyof Errors] || "", "error");
    }
    return Object.keys(newErrors).length === 0;
  };

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
    
    // Validate step 2 (clinic details) first
    const step2Valid = validateStep(2);
    if (!step2Valid) {
      setCurrentStep(2);
      return;
    }
    
    // Validate step 3 (contact information)
    const isValid = validateForm();
    if (!isValid) return;

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

  const handleNext = (nextStep: number) => {
    if (validateStep(currentStep)) {
      setCurrentStep(nextStep);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white py-2 px-4">
      <div className="max-w-7xl mx-auto w-full h-[calc(100vh-1rem)] flex flex-col gap-1">
        <Toast
          message={toast.message}
          type={toast.type}
          visible={showToast}
          onClose={() => setShowToast(false)}
        />

        {/* Progress Indicator */}
        <div className="p-1.5 lg:p-2 mb-0.5">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${currentStep >= 1 ? 'bg-sky-500 text-white shadow-sky-500/30 shadow-lg' : 'bg-slate-100 text-slate-400'
                }`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 tracking-wide hidden sm:inline">Account</span>
            </div>
            <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-all duration-500 ${currentStep >= 2 ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-slate-200'
              }`}></div>
            <div className="flex items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${currentStep >= 2 ? 'bg-sky-500 text-white shadow-sky-500/30 shadow-lg' : 'bg-slate-100 text-slate-400'
                }`}>
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 tracking-wide hidden sm:inline">Details</span>
            </div>
            <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-all duration-500 ${currentStep >= 3 ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-slate-200'
              }`}></div>
            <div className="flex items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${currentStep >= 3 ? 'bg-sky-500 text-white shadow-sky-500/30 shadow-lg' : 'bg-slate-100 text-slate-400'
                }`}>
                3
              </div>
              <span className="text-[10px] font-semibold text-slate-600 tracking-wide hidden sm:inline">Contact</span>
            </div>
          </div>
        </div>

        {/* Form Container - No Scrolling */}
        <div className="flex-1 overflow-hidden">
          <div
            className="h-full transition-transform duration-500 ease-in-out flex"
            style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
          >
            {/* Step 1: Account Setup */}
            <div className="w-full flex-shrink-0 flex items-center justify-center px-2">
              <div className="w-full max-w-xl">
                <div className="p-3 lg:p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/40">
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base lg:text-lg font-bold text-slate-900">Account Setup</h2>
                      <p className="text-[10px] text-slate-500">Create your credentials</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1.5">
                        <div className="flex-1">
                          <div className="relative">
                            <Mail className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="email"
                              placeholder="healthcare@example.com"
                              className={`text-black w-full pl-8 pr-2 py-1.5 border-2 rounded-lg focus:outline-none transition-all bg-gray-50 focus:bg-white text-xs ${errors.email ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-[#00b480]"
                                }`}
                              value={form.email}
                              onChange={(e) => {
                                setForm({ ...form, email: e.target.value });
                                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                              }}
                              disabled={emailVerified}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all text-xs flex items-center justify-center gap-1 ${emailVerified
                              ? "bg-[#00b480] text-white"
                              : emailSent
                                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                                : isCheckingEmail
                                  ? "bg-gray-400 text-white cursor-not-allowed"
                                  : "bg-gradient-to-r from-[#00b480] to-[#008f66] text-white"
                            }`}
                          onClick={async () => {
                            await sendVerificationLink();
                          }}
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
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Checking...
                            </>
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create password (min. 8 characters)"
                          className={`text-black w-full px-2 py-1.5 border-2 rounded-lg focus:outline-none transition-all bg-gray-50 focus:bg-white text-xs ${errors.password ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-[#00b480]"
                            }`}
                          value={ownerPassword}
                          onChange={(e) => {
                            setOwnerPassword(e.target.value);
                            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                          }}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className={`px-4 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 text-xs ${emailVerified
                          ? "bg-gradient-to-r from-[#00b480] to-[#008f66] text-white"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      onClick={() => handleNext(2)}
                      disabled={!emailVerified}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Healthcare Center Details */}
            <div className="w-full flex-shrink-0 flex items-start justify-center px-2">
              <div className="w-full max-w-5xl h-full flex flex-col">
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="text-center mb-2 pb-1">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-sky-700/80 font-semibold mb-0.5">
                      ZEVA for Providers
                    </p>
                    <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-0.5">
                      Healthcare Center Registration
                    </h2>
                    <p className="text-[11px] text-slate-600 max-w-2xl mx-auto leading-tight">
                      Modern onboarding designed to help your clinic shine from day one. Complete the steps below to join our curated care network.
                    </p>
                  </div>

                  <div className="flex-1 py-1">
                    <div className="grid lg:grid-cols-2 gap-2">
                      {/* Left Column */}
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                            Center Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            placeholder="Green Valley Wellness"
                            className={`text-black w-full px-2 py-1.5 border-2 rounded-lg focus:outline-none bg-gray-50 focus:bg-white text-xs ${errors.name ? "border-red-400" : "border-gray-200 focus:border-[#00b480]"
                              }`}
                            value={form.name}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, name: e.target.value }));
                              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                              // Check slug when name changes
                              checkSlugAvailability(e.target.value, form.address);
                            }}
                          />
                        </div>

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

                        <div className="relative text-black" ref={dropdownRef}>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                            Services Offered <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`text-black w-full px-2 py-1.5 border-2 rounded-lg text-left flex items-center justify-between bg-gray-50 hover:bg-white text-xs ${errors.treatments ? "border-red-400" : "border-gray-200"
                              }`}
                          >
                            <div className="flex-1">
                              {selectedTreatments.length === 0 && otherTreatments.length === 0 ? (
                                <span className="text-gray-400 text-xs">Select services...</span>
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
                          {isDropdownOpen && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              <div className="p-1">
                                {treatments.map((treatment, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleTreatmentSelect(treatment)}
                                    className={`px-3 py-1.5 cursor-pointer rounded text-xs ${selectedTreatments.some((t) => typeof t === "object" && t.slug === treatment.slug)
                                        ? "bg-[#00b480]/10 text-[#00b480]"
                                        : "hover:bg-gray-50"
                                      }`}
                                  >
                                    {treatment.name}
                                  </div>
                                ))}
                                <div
                                  onClick={() => handleTreatmentSelect("other")}
                                  className={`px-3 py-1.5 cursor-pointer rounded border-t text-xs ${selectedTreatments.includes("other") ? "bg-[#00b480]/10 text-[#00b480]" : "hover:bg-gray-50"
                                    }`}
                                >
                                  Other Services
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Custom Treatments Input - Show when "Other" is selected */}
                        {selectedTreatments.includes("other") && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <label className="block text-[11px] font-semibold text-gray-900 mb-1">
                              Add Custom Services (Max 5)
                            </label>
                            <div className="flex gap-1.5 mb-1.5">
                              <input
                                type="text"
                                placeholder="Enter service name"
                                className="text-gray-900 flex-1 px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:border-[#00b480] focus:outline-none bg-white text-xs"
                                value={newOther}
                                onChange={(e) => setNewOther(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (newOther.trim() && otherTreatments.length < 5) {
                                      if (!otherTreatments.includes(newOther.trim())) {
                                        setOtherTreatments([...otherTreatments, newOther.trim()]);
                                        setNewOther("");
                                        showToastMessage("Custom service added!", "success");
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
                                onClick={() => {
                                  if (newOther.trim() && otherTreatments.length < 5) {
                                    if (!otherTreatments.includes(newOther.trim())) {
                                      setOtherTreatments([...otherTreatments, newOther.trim()]);
                                      setNewOther("");
                                      showToastMessage("Custom service added!", "success");
                                    } else {
                                      showToastMessage("Service already added", "info");
                                    }
                                  } else if (otherTreatments.length >= 5) {
                                    showToastMessage("Maximum 5 custom services allowed", "error");
                                  }
                                }}
                                disabled={otherTreatments.length >= 5}
                                className={`px-2 py-1.5 rounded-lg font-semibold text-[10px] whitespace-nowrap ${otherTreatments.length >= 5
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-[#00b480] text-white hover:bg-[#009973]"
                                  }`}
                              >
                                Add
                              </button>
                            </div>

                            {/* Display added custom treatments */}
                            {otherTreatments.length > 0 && (
                              <div className="space-y-0.5">
                                <p className="text-[10px] text-gray-600 mb-0.5">Added services ({otherTreatments.length}/5):</p>
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

                            <p className="text-xs text-gray-500 mt-2">
                              Press Enter or click Add to save each service
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Price Range</label>
                            <input
                              placeholder="500-2000"
                              className="text-black w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:border-[#00b480] focus:outline-none bg-gray-50 text-xs"
                              value={form.pricing}
                              onChange={(e) => setForm((f) => ({ ...f, pricing: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Hours</label>
                            <input
                              placeholder="9 AM - 6 PM"
                              className="text-black w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:border-[#00b480] focus:outline-none bg-gray-50 text-xs"
                              value={form.timings}
                              onChange={(e) => setForm((f) => ({ ...f, timings: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                              Photo <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              className={`text-black w-full px-1.5 py-1 border-2 rounded-lg bg-gray-50 file:mr-1.5 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[10px] file:bg-[#00b480] file:text-white text-[10px] ${errors.clinicPhoto ? "border-red-400" : "border-gray-200"
                                }`}
                              onChange={handleFileChange}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">License</label>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="text-black w-full px-1.5 py-1 border-2 border-gray-200 rounded-lg bg-gray-50 file:mr-1.5 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[10px] file:bg-gray-200 file:text-gray-700 text-[10px]"
                              onChange={handleLicenseChange}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                            Address <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            placeholder="Street, Building, City, State"
                            className={`text-black w-full px-2 py-1.5 border-2 rounded-lg focus:outline-none bg-gray-50 resize-none text-xs ${errors.address ? "border-red-400" : "border-gray-200 focus:border-[#00b480]"
                              }`}
                            value={form.address}
                            onChange={(e) => {
                              handleAddressChange(e);
                              // Check slug when address changes
                              checkSlugAvailability(form.name, e.target.value);
                            }}
                            rows={2}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">
                            Location <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Type address or location (e.g., Noida Sector 5)"
                            className={`text-black w-full px-2 py-1.5 border-2 rounded-lg focus:outline-none bg-gray-50 focus:bg-white text-xs mb-1 ${errors.location ? "border-red-400" : "border-gray-200 focus:border-[#00b480]"
                              }`}
                            value={locationInput}
                            onChange={handleLocationChange}
                          />
                          <p className="text-[10px] text-gray-500 mb-0.5">Or click map to pin location</p>
                          <div className={`h-32 border-2 rounded-lg overflow-hidden ${errors.location ? "border-red-400" : "border-gray-200"}`}>
                            <GoogleMap
                              zoom={form.latitude !== 0 ? 15 : 12}
                              center={{
                                lat: form.latitude !== 0 ? form.latitude : 28.61,
                                lng: form.longitude !== 0 ? form.longitude : 77.2,
                              }}
                              mapContainerStyle={{ width: "100%", height: "100%" }}
                              onLoad={onMapLoad}
                              onClick={(e) => {
                                if (e.latLng) {
                                  setForm((f) => ({ 
                                    ...f, 
                                    latitude: e.latLng!.lat(), 
                                    longitude: e.latLng!.lng() 
                                  }));
                                  // Clear any location errors
                                  setErrors((prev) => ({ ...prev, location: undefined }));
                                  // Reverse geocode to update location input
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
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      className="px-4 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-gradient-to-r from-[#00b480] to-[#008f66] text-white text-xs"
                      onClick={() => handleNext(3)}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Contact Information */}
            <div className="w-full flex-shrink-0 flex items-center justify-center px-2">
              <div className="w-full max-w-xl">
                <div className="p-3 lg:p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#00b480] to-[#008f66] rounded-xl flex items-center justify-center">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base lg:text-lg font-bold text-gray-800">Contact Information</h2>
                      <p className="text-[10px] text-gray-500">How can patients reach you?</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Users className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          placeholder="Dr. John Smith"
                          className={`text-black w-full pl-8 pr-2 py-1.5 border-2 rounded-lg focus:outline-none bg-gray-50 focus:bg-white text-xs ${errors.contactName ? "border-red-400" : "border-gray-200 focus:border-[#00b480]"
                            }`}
                          value={contactInfo.name}
                          onChange={(e) => {
                            setContactInfo({ ...contactInfo, name: e.target.value });
                            if (errors.contactName) setErrors((prev) => ({ ...prev, contactName: undefined }));
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="tel"
                          placeholder="1234567890"
                          className={`text-black w-full pl-8 pr-2 py-1.5 border-2 rounded-lg focus:outline-none bg-gray-50 focus:bg-white text-xs ${errors.phone ? "border-red-400" : "border-gray-200 focus:border-[#00b480]"
                            }`}
                          value={contactInfo.phone}
                          onChange={handlePhoneChange}
                          maxLength={10}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">10-digit mobile number</p>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 bg-gradient-to-br from-[#00b480]/5 to-[#00b480]/10 rounded-lg border border-[#00b480]/20">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-[#00b480]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-0.5 text-xs">Ready to Join?</h4>
                        <p className="text-[10px] text-gray-600 mb-1">
                          Connect with patients and manage your center efficiently.
                        </p>
                        <ul className="text-[10px] text-gray-600 space-y-0">
                          <li>• Reach potential patients</li>
                          <li>• Manage appointments</li>
                          <li>• Post job openings</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                      onClick={() => setCurrentStep(2)}
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                      className="px-4 py-1.5 rounded-lg font-bold transition-all bg-gradient-to-r from-[#00b480] to-[#008f66] text-white flex items-center gap-1.5 text-xs"
                    >
                      <Heart className="w-3 h-3" />
                      Complete Registration
                    </button>
                  </div>

                  <p className="text-[10px] text-center text-gray-500 mt-2">
                    By registering, you agree to our Terms of Service
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SuccessPopup isOpen={showSuccessPopup} onClose={() => setShowSuccessPopup(false)} />

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #00b480;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #008f66;
        }
      `}</style>
    </div>
  );
};

export default RegisterClinic;

RegisterClinic.getLayout = function PageLayout(page: React.ReactNode) {
  return <Layout>{page}</Layout>;
};
