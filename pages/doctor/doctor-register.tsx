import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { auth } from "../../lib/firebase";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
} from "firebase/auth";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  Upload,
  MapPin,
  User,
  Phone,
  GraduationCap,
  Briefcase,
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
} from "lucide-react";

const DoctorRegister = () => {
  const router = useRouter();
  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    specialization: "",
    degree: "",
    experience: "",
    address: "",
    resume: null,
    latitude: 0,
    longitude: 0,
  });
  const [resumeFileName, setResumeFileName] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [specializationType, setSpecializationType] = useState("dropdown");
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const nameInputRef = useRef<HTMLInputElement>(null);

  const treatments = [
    "General Physician",
    "Cardiologist", 
    "Dermatologist",
    "Pediatrician",
    "Orthopedic",
    "Neurologist",
    "Psychiatrist",
    "Gynecologist",
    "Dentist",
    "ENT Specialist"
  ];

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 5000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem("doctorEmail") || "";
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
  }, []);

  const sendVerificationLink = async () => {
    if (!form.email || !form.email.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    setIsLoading(true);

    try {
      const checkResponse = await axios.post("/api/doctor/check-email", {
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
          window.localStorage.setItem("doctorEmail", form.email);
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
    const target = e.target as HTMLInputElement;
    const files = target.files;
    
    if (files && files.length > 0) {
      setForm((prev) => ({ ...prev, [name]: files[0] }));
      if (name === "resume") {
        setResumeFileName(files[0].name);
      }
    } else {
      if (name === "phone") {
        const onlyNums = value.replace(/[^0-9]/g, "").slice(0, 10);
        setForm((prev) => ({ ...prev, [name]: onlyNums }));
      } else {
        setForm((prev) => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!emailVerified) {
      showToast("Please verify your email first", "error");
      return;
    }

    if (form.phone.length !== 10) {
      showToast("Please enter a valid 10-digit phone number", "error");
      return;
    }

    if (!form.name || !form.specialization || !form.degree || !form.experience || !form.address || !form.resume) {
      showToast("Please complete all required fields", "error");
      return;
    }

    setIsLoading(true);

    try {
      const data = new FormData();
      
      // Append all form fields
      data.append("name", form.name);
      data.append("phone", form.phone);
      data.append("email", form.email);
      data.append("specialization", form.specialization);
      data.append("degree", form.degree);
      data.append("experience", form.experience);
      data.append("address", form.address);
      data.append("latitude", String(form.latitude || 0));
      data.append("longitude", String(form.longitude || 0));
      
      // Append resume file if exists
      if (form.resume) {
        const resumeFile = form.resume as any;
        if (resumeFile && typeof resumeFile === 'object' && 'name' in resumeFile) {
          data.append("resume", resumeFile);
        }
      }

      const response = await axios.post("/api/doctor/register", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 201) {
        setShowSuccessModal(true);
        showToast("Registration submitted successfully!", "success");
        // Reset form after successful submission
        setTimeout(() => {
          setForm({
            name: "",
            phone: "",
            email: "",
            specialization: "",
            degree: "",
            experience: "",
            address: "",
            resume: null,
            latitude: 0,
            longitude: 0,
          });
          setResumeFileName("");
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
      return emailVerified && form.email && form.phone.length === 10 && form.name;
    }
    if (currentStep === 2) {
      return form.specialization && form.degree && form.experience;
    }
    if (currentStep === 3) {
      return form.address && resumeFileName;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    } else {
      showToast("Please complete all required fields", "error");
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
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
              <p className="text-gray-600 mb-2 text-sm sm:text-base">Your Doctor profile is under review.</p>
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
            Doctor Registration Portal
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm max-w-2xl mx-auto px-2">
            Create your professional profile and connect with thousands of patients seeking trusted healthcare
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
                  <span className={currentStep >= 1 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Contact Info</span>
                  <span className={currentStep >= 2 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Professional Details</span>
                  <span className={currentStep >= 3 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Documents</span>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Step 1: Contact Information */}
                {currentStep === 1 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Contact Information
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
                          placeholder="doctor@example.com"
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

                    {/* Name */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        disabled={!emailVerified}
                        ref={nameInputRef}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm sm:text-base"
                        placeholder="Dr. John Doe"
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
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        disabled={!emailVerified}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-sm sm:text-base"
                        placeholder="1234567890"
                        maxLength={10}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">{form.phone.length}/10 digits</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Professional Details */}
                {currentStep === 2 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Professional Details
                    </h2>

                    {/* Specialization */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        Specialization *
                      </label>
                      <select
                        name="specialization"
                        value={specializationType === "other" ? "other" : form.specialization}
                        onChange={(e) => {
                          if (e.target.value === "other") {
                            setSpecializationType("other");
                            setForm(prev => ({ ...prev, specialization: "" }));
                          } else {
                            setSpecializationType("dropdown");
                            setForm(prev => ({ ...prev, specialization: e.target.value }));
                          }
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        required
                      >
                        <option value="">Select Specialization</option>
                        {treatments.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                      {specializationType === "other" && (
                        <input
                          type="text"
                          value={customSpecialization}
                          onChange={(e) => {
                            setCustomSpecialization(e.target.value);
                            setForm(prev => ({ ...prev, specialization: e.target.value }));
                          }}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-3 text-sm sm:text-base"
                          placeholder="Enter your specialization"
                          required
                        />
                      )}
                    </div>

                    {/* Degree */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Degree *
                      </label>
                      <input
                        type="text"
                        name="degree"
                        value={form.degree}
                        onChange={handleChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="MBBS, MD, etc."
                        required
                      />
                    </div>

                    {/* Experience */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Experience (Years) *
                      </label>
                      <input
                        type="number"
                        name="experience"
                        value={form.experience}
                        onChange={handleChange}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="5"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Documents & Location */}
                {currentStep === 3 && (
                  <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      Documents & Location
                    </h2>

                    {/* Address */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Clinic Address *
                      </label>
                      <textarea
                        name="address"
                        value={form.address}
                        onChange={handleChange}
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
                        onChange={(e) => setLocationInput(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base mb-2"
                        placeholder="Search for your location..."
                      />
                      <div className="mt-2 sm:mt-4 bg-gray-100 rounded-lg sm:rounded-xl h-48 sm:h-64 flex items-center justify-center text-gray-500 text-xs sm:text-sm">
                        <MapPin className="w-6 h-6 sm:w-8 sm:h-8 mr-2" />
                        Map integration placeholder
                      </div>
                    </div>

                    {/* Resume Upload */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        Upload Resume *
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          name="resume"
                          onChange={handleChange}
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          id="resume-upload"
                          required
                        />
                        <label
                          htmlFor="resume-upload"
                          className="flex items-center justify-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-4 sm:py-6 border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                          {resumeFileName ? (
                            <>
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                              <span className="text-green-700 font-medium text-xs sm:text-sm truncate">{resumeFileName}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600 text-xs sm:text-sm text-center">Click to upload resume (PDF, DOC, DOCX)</span>
                            </>
                          )}
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Max file size: 1MB</p>
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
                    <p className="text-xs sm:text-sm text-blue-100">Write blogs and share medical expertise</p>
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

export default DoctorRegister;
