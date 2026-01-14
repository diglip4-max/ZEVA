"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "../../lib/firebase";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  Upload,
  MapPin,
  User,
  Phone,
  Building2,
  FileText,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  Award,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Check,
  Eye,
  EyeOff,
  Heart,
  Shield,
} from "lucide-react";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
} from "firebase/auth";
import axios from "axios";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useRouter } from "next/router";

interface TreatmentType {
  name: string;
  slug: string;
}

interface ContactInfo {
  name: string;
  phone: string;
}

const RegisterClinic: React.FC = () => {
  const router = useRouter();
  
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    email: "",
    name: "",
    address: "",
    pricing: "",
    timings: "",
    latitude: 0,
    longitude: 0,
  });
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: "",
    phone: "",
  });
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" as "success" | "error" | "info" });
  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [selectedTreatments, setSelectedTreatments] = useState<(TreatmentType | string)[]>([]);
  const [otherTreatments, setOtherTreatments] = useState<string[]>([]);
  const [newOther, setNewOther] = useState("");
  const [clinicPhoto, setClinicPhoto] = useState<File | null>(null);
  const [clinicPhotoName, setClinicPhotoName] = useState("");
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const [licenseDocName, setLicenseDocName] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 5000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Fetch treatments
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

    // Handle email verification link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem("clinicEmail") || "";
      if (!storedEmail) {
        showToast("Email not found for verification. Open link on same device.", "error");
        return;
      }
      signInWithEmailLink(auth, storedEmail, window.location.href)
        .then(() => {
          setForm((prev) => ({ ...prev, email: storedEmail }));
          setEmailVerified(true);
          setEmailSent(true);
          showToast("Email verified successfully!", "success");
          setTimeout(() => {
            if (nameInputRef.current) {
              nameInputRef.current.focus();
            }
          }, 0);
        })
        .catch(() => {
          showToast("Invalid or expired verification link", "error");
        });
    }

    // Handle click outside dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sendVerificationLink = async () => {
    if (!form.email || !form.email.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    setIsLoading(true);

    try {
      const checkResponse = await axios.post("/api/clinics/check-email", {
        email: form.email,
      });

      if (checkResponse.status === 200) {
        showToast("This email already exists", "error");
        setIsLoading(false);
        return;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        try {
          await sendSignInLinkToEmail(auth, form.email, {
            url: window.location.href,
            handleCodeInApp: true,
          });
          window.localStorage.setItem("clinicEmail", form.email);
          setEmailSent(true);
          showToast("Verification link sent! Check your inbox.", "success");
        } catch {
          showToast("Failed to send verification link. Please try again.", "error");
        } finally {
          setIsLoading(false);
        }
        return;
      } else {
        showToast("Error checking email. Please try again.", "error");
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setContactInfo((prev) => ({ ...prev, phone: value }));
  };

  const handleContactNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactInfo((prev) => ({ ...prev, name: e.target.value }));
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
        }
      });
    },
    [geocoder]
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAddress = e.target.value;
    setForm((f) => ({ ...f, address: newAddress }));
    if (newAddress.trim().length > 10) {
      setTimeout(() => geocodeAddress(newAddress), 1000);
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocation = e.target.value;
    setLocationInput(newLocation);
    if (newLocation.trim().length > 5 && geocoder) {
      setTimeout(() => {
        geocoder.geocode({ address: newLocation }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            setForm((f) => ({
              ...f,
              latitude: loc.lat(),
              longitude: loc.lng(),
            }));
          }
        });
      }, 800);
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
        showToast("Please upload file less than 1MB", "error");
        return;
      }
      if (e.target.name === "clinicPhoto") {
        setClinicPhoto(file);
        setClinicPhotoName(file.name);
      } else if (e.target.name === "licenseDoc") {
        setLicenseDoc(file);
        setLicenseDocName(file.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!emailVerified) {
      showToast("Please verify your email first", "error");
      return;
    }

    if (contactInfo.phone.length !== 10) {
      showToast("Please enter a valid 10-digit phone number", "error");
      return;
    }

    if (!form.name || selectedTreatments.length === 0 || !form.address || !clinicPhoto || !contactInfo.name) {
      showToast("Please complete all required fields", "error");
      return;
    }

    setIsLoading(true);

    try {
      // Register owner first
      await axios.post("/api/clinics/registerOwner", {
        email: form.email,
        password: ownerPassword,
        name: contactInfo.name,
        phone: contactInfo.phone,
      });

      // Handle custom treatments
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

      // Prepare final treatments
      const finalTreatments = selectedTreatments.filter((t) => t !== "other");
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

      // Create form data for clinic registration
      const data = new FormData();
      data.append("email", form.email);
      data.append("name", form.name);
      data.append("address", form.address);
      data.append("pricing", form.pricing || "");
      data.append("timings", form.timings || "");
      data.append("latitude", String(form.latitude || 0));
      data.append("longitude", String(form.longitude || 0));
      data.append("treatments", JSON.stringify(treatmentObjects));
      
      if (clinicPhoto) {
        data.append("clinicPhoto", clinicPhoto);
      }
      if (licenseDoc) {
        data.append("licenseDocument", licenseDoc);
      }

      const response = await axios.post("/api/clinics/register", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200) {
        setShowSuccessModal(true);
        showToast("Clinic registered successfully!", "success");
        // Reset form after successful submission
        setTimeout(() => {
          setForm({
            email: "",
            name: "",
            address: "",
            pricing: "",
            timings: "",
            latitude: 0,
            longitude: 0,
          });
          setContactInfo({ name: "", phone: "" });
          setOwnerPassword("");
          setSelectedTreatments([]);
          setOtherTreatments([]);
          setClinicPhoto(null);
          setClinicPhotoName("");
          setLicenseDoc(null);
          setLicenseDocName("");
          setEmailVerified(false);
          setEmailSent(false);
          setCurrentStep(1);
        }, 2000);
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (axios.isAxiosError(error) && error.response) {
        const errorMessage = error.response.data?.message || "Registration failed. Please try again.";
        showToast(errorMessage, "error");
      } else {
        showToast("Registration failed. Please try again.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = () => {
    if (currentStep === 1) {
      return emailVerified && form.email && ownerPassword.length >= 8;
    }
    if (currentStep === 2) {
      return form.name && selectedTreatments.length > 0 && form.address && clinicPhoto && (form.latitude !== 0 || form.longitude !== 0);
    }
    if (currentStep === 3) {
      return contactInfo.name && contactInfo.phone.length === 10;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      showToast("Please complete all required fields", "error");
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:right-6 z-[9999] animate-slide-in-right">
          <div className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl backdrop-blur-sm border ${
            toast.type === 'success' ? 'bg-green-500/90 border-green-400' :
            toast.type === 'error' ? 'bg-red-500/90 border-red-400' :
            'bg-blue-500/90 border-blue-400'
          } text-white w-full sm:min-w-[320px] sm:w-auto`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
            <span className="font-medium text-sm sm:text-base flex-1">{toast.message}</span>
            <button onClick={() => setToast({ show: false, message: "", type: "info" })} className="ml-auto flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-scale-in">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Registration Complete!</h2>
              <p className="text-gray-600 mb-2 text-sm sm:text-base">Your Clinic profile is under review.</p>
              <p className="text-gray-500 text-xs sm:text-sm mb-6 sm:mb-8">We'll notify you once your profile has been approved.</p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/");
                }}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-2.5 sm:py-3 rounded-xl font-semibold hover:shadow-lg transition-all text-sm sm:text-base"
              >
                Go to Home Page
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent mb-2 sm:mb-3 lg:mb-4 px-2">
            Clinic Registration Portal
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm max-w-2xl mx-auto px-2">
            Create your healthcare center profile and connect with thousands of patients seeking trusted medical care
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
          {/* Left: Registration Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 lg:p-8 border border-gray-100">
              {/* Progress Steps */}
              <div className="mb-6 sm:mb-8 lg:mb-10">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex-1">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-bold transition-all text-xs sm:text-sm ${
                          currentStep >= step 
                            ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {currentStep > step ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : step}
                        </div>
                        {step < 3 && (
                          <div className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 transition-all ${
                            currentStep > step ? 'bg-gradient-to-r from-teal-600 to-blue-600' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs sm:text-sm px-1">
                  <span className={currentStep >= 1 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Account Setup</span>
                  <span className={currentStep >= 2 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Clinic Details</span>
                  <span className={currentStep >= 3 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Contact Info</span>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Step 1: Account Setup */}
                {currentStep === 1 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Account Setup
                    </h2>

                    {/* Email Verification */}
                    <div className="bg-gradient-to-br from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100">
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Email Address *
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          disabled={emailVerified}
                          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm sm:text-base"
                          placeholder="clinic@example.com"
                          required
                        />
                        {!emailVerified ? (
                          <button
                            type="button"
                            onClick={sendVerificationLink}
                            disabled={isLoading || emailSent}
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg sm:rounded-xl font-semibold hover:from-teal-700 hover:to-blue-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            <span className="hidden sm:inline">{isLoading ? "Sending..." : emailSent ? "Link Sent" : "Send Link"}</span>
                            <span className="sm:hidden">{isLoading ? "..." : emailSent ? "Sent" : "Send"}</span>
                          </button>
                        ) : (
                          <div className="px-4 sm:px-6 py-2 sm:py-3 bg-green-100 text-green-700 rounded-lg sm:rounded-xl font-semibold flex items-center justify-center gap-2 text-sm sm:text-base">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            Verified
                          </div>
                        )}
                      </div>
                      {emailSent && !emailVerified && (
                        <p className="text-xs sm:text-sm text-blue-600 mt-2">✓ Verification link sent! Check your inbox and click the verify button above.</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                          placeholder="Create password (min. 8 characters)"
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Clinic Details */}
                {currentStep === 2 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Clinic Details
                    </h2>

                    {/* Clinic Name */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Clinic Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        ref={nameInputRef}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="Green Valley Wellness Center"
                        required
                      />
                    </div>

                    {/* Services Offered */}
                    <div className="relative" ref={dropdownRef}>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        Services Offered *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl text-left flex items-center justify-between bg-white hover:bg-gray-50 text-sm sm:text-base"
                      >
                        <div className="flex-1 flex flex-wrap gap-2">
                          {selectedTreatments.filter(t => t !== "other").length === 0 && otherTreatments.length === 0 ? (
                            <span className="text-gray-400">Select services...</span>
                          ) : (
                            <>
                              {selectedTreatments.filter(t => t !== "other").slice(0, 3).map((treatment, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-lg text-sm bg-teal-100 text-teal-700"
                                >
                                  {typeof treatment === "string" ? treatment : treatment.name}
                                </span>
                              ))}
                              {otherTreatments.length > 0 && (
                                <span className="text-sm text-teal-600">+{otherTreatments.length} custom</span>
                              )}
                              {(selectedTreatments.filter(t => t !== "other").length + otherTreatments.length) > 3 && (
                                <span className="text-sm text-gray-500">...</span>
                              )}
                            </>
                          )}
                        </div>
                        <ArrowRight className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isDropdownOpen && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                          <div className="p-2">
                            {treatments.map((treatment, index) => (
                              <div
                                key={index}
                                onClick={() => handleTreatmentSelect(treatment)}
                                className={`px-4 py-2 cursor-pointer rounded-lg text-sm ${
                                  selectedTreatments.some((t) => typeof t === "object" && t.slug === treatment.slug)
                                    ? "bg-teal-100 text-teal-700"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                {treatment.name}
                              </div>
                            ))}
                            <div
                              onClick={() => handleTreatmentSelect("other")}
                              className={`px-4 py-2 cursor-pointer rounded-lg border-t text-sm ${
                                selectedTreatments.includes("other") ? "bg-teal-100 text-teal-700" : "hover:bg-gray-50"
                              }`}
                            >
                              Other Services
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Treatments Input */}
                    {selectedTreatments.includes("other") && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                        <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                          Add Custom Services (Max 5)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Enter service name"
                            className="flex-1 px-3 sm:px-4 py-2 border border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none bg-white text-sm sm:text-base"
                            value={newOther}
                            onChange={(e) => setNewOther(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newOther.trim() && otherTreatments.length < 5) {
                                  if (!otherTreatments.includes(newOther.trim())) {
                                    setOtherTreatments([...otherTreatments, newOther.trim()]);
                                    setNewOther("");
                                    showToast("Custom service added!", "success");
                                  } else {
                                    showToast("Service already added", "info");
                                  }
                                } else if (otherTreatments.length >= 5) {
                                  showToast("Maximum 5 custom services allowed", "error");
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
                                  showToast("Custom service added!", "success");
                                } else {
                                  showToast("Service already added", "info");
                                }
                              } else if (otherTreatments.length >= 5) {
                                showToast("Maximum 5 custom services allowed", "error");
                              }
                            }}
                            disabled={otherTreatments.length >= 5}
                            className={`px-4 py-2 rounded-lg font-semibold ${
                              otherTreatments.length >= 5
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-teal-600 text-white hover:bg-teal-700"
                            }`}
                          >
                            Add
                          </button>
                        </div>
                        {otherTreatments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {otherTreatments.map((treatment, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-3 py-1 rounded-lg text-sm bg-teal-600 text-white"
                              >
                                {treatment}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOtherTreatments(otherTreatments.filter((_, i) => i !== index));
                                  }}
                                  className="ml-2 hover:bg-teal-700 rounded-full w-5 h-5 flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price Range and Timings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                          Price Range
                        </label>
                        <input
                          type="text"
                          name="pricing"
                          value={form.pricing}
                          onChange={handleChange}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                          placeholder="500-2000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                          Operating Hours
                        </label>
                        <input
                          type="text"
                          name="timings"
                          value={form.timings}
                          onChange={handleChange}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                          placeholder="9 AM - 6 PM"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Clinic Address *
                      </label>
                      <textarea
                        name="address"
                        value={form.address}
                        onChange={handleAddressChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base resize-none"
                        placeholder="123 Medical Center, City, State"
                        rows={3}
                        required
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Location (Optional)
                      </label>
                      <input
                        type="text"
                        value={locationInput}
                        onChange={handleLocationChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 text-sm sm:text-base"
                        placeholder="Search for your location..."
                      />
                      <div className="h-48 sm:h-64 border border-gray-300 rounded-lg sm:rounded-xl overflow-hidden">
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
                                longitude: e.latLng!.lng(),
                              }));
                              if (geocoder) {
                                geocoder.geocode({ location: e.latLng }, (results, status) => {
                                  if (status === "OK" && results && results[0]) {
                                    setLocationInput(results[0].formatted_address);
                                  }
                                });
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

                    {/* Clinic Photo */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Upload Clinic Photo *
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          name="clinicPhoto"
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                          id="clinic-photo-upload"
                          required
                        />
                        <label
                          htmlFor="clinic-photo-upload"
                          className="flex items-center justify-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-4 sm:py-6 border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                          {clinicPhotoName ? (
                            <>
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                              <span className="text-green-700 font-medium text-xs sm:text-sm truncate">{clinicPhotoName}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600 text-xs sm:text-sm text-center">Click to upload clinic photo</span>
                            </>
                          )}
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Max file size: 1MB</p>
                    </div>

                    {/* License Document */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        License Document (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          name="licenseDoc"
                          onChange={handleFileChange}
                          accept=".pdf,image/*"
                          className="hidden"
                          id="license-doc-upload"
                        />
                        <label
                          htmlFor="license-doc-upload"
                          className="flex items-center justify-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-4 sm:py-6 border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                          {licenseDocName ? (
                            <>
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                              <span className="text-green-700 font-medium text-xs sm:text-sm truncate">{licenseDocName}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600 text-xs sm:text-sm text-center">Click to upload license document (PDF, Image)</span>
                            </>
                          )}
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Max file size: 1MB</p>
                    </div>
                  </div>
                )}

                {/* Step 3: Contact Information */}
                {currentStep === 3 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Contact Information
                    </h2>

                    {/* Contact Name */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        value={contactInfo.name}
                        onChange={handleContactNameChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="Dr. John Smith"
                        required
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={contactInfo.phone}
                        onChange={handlePhoneChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="1234567890"
                        maxLength={10}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">{contactInfo.phone.length}/10 digits</p>
                    </div>

                    {/* Benefits Card */}
                    <div className="bg-gradient-to-br from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="bg-white p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-sm flex-shrink-0">
                          <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 mb-2 text-sm sm:text-base">Ready to Join?</h3>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                            Connect with patients and manage your center efficiently.
                          </p>
                          <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-teal-600 flex-shrink-0" />
                              Reach potential patients
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-teal-600 flex-shrink-0" />
                              Manage appointments
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-teal-600 flex-shrink-0" />
                              Post job openings
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg sm:rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Previous
                    </button>
                  )}
                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg sm:rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      Next Step
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg sm:rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Submitting...</span>
                          <span className="sm:hidden">Submitting</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Complete Registration</span>
                          <span className="sm:hidden">Complete</span>
                          <CheckCircle className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right: Benefits */}
          <div className="space-y-4 sm:space-y-6 mt-6 lg:mt-0">
            <div className="bg-gradient-to-br from-teal-600 to-blue-600 rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 lg:p-8 text-white">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Why Join ZEVA?</h2>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm flex-shrink-0">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm sm:text-base">Personal Dashboard</h3>
                    <p className="text-xs sm:text-sm text-blue-100">Comprehensive analytics and practice management tools</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm flex-shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm sm:text-base">Patient Network</h3>
                    <p className="text-xs sm:text-sm text-blue-100">Connect with thousands of verified patients</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm flex-shrink-0">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm sm:text-base">Smart Scheduling</h3>
                    <p className="text-xs sm:text-sm text-blue-100">AI-powered appointment management system</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm flex-shrink-0">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm sm:text-base">Build Authority</h3>
                    <p className="text-xs sm:text-sm text-blue-100">Showcase your services and expertise</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-base sm:text-lg">Additional Benefits</h3>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  24/7 customer support
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  Free marketing tools
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  Secure patient data management
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  Regular platform updates
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default RegisterClinic;
