import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { ChangeEvent, FormEvent } from "react";
import React from "react";
import type { KeyboardEvent } from "react";
import Layout from "@/components/Layout";

export default function DoctorRegister() {
  const searchRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<HTMLDivElement>(null);

  interface TreatmentResponse {
    treatments: { name: string }[];
  }

  // State variables
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    email: string;
    specialization: string;
    degree: string;
    experience: string;
    address: string;
    resume: File | null;
  }>({
    name: "",
    phone: "",
    email: "",
    specialization: "",
    degree: "",
    experience: "",
    address: "",
    resume: null,
  });

  const [resumeFileName, setResumeFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [specializationType, setSpecializationType] = useState<"dropdown" | "other">("dropdown");
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [treatments, setTreatments] = useState<string[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: "",
    type: 'info'
  });

  // Fetch treatments from backend API
  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const res = await axios.get<TreatmentResponse>("/api/doctor/getTreatment");
        if (res.data && Array.isArray(res.data.treatments)) {
          setTreatments(res.data.treatments.map((t) => t.name));
        }
      } catch {
        setTreatments([]);
      }
    };
    fetchTreatments();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        // Removed unused state variable 'suggestions'
        // setSuggestions([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: 'info' });
    }, 5000);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (files && files.length > 0) {
      setForm((prev) => ({ ...prev, [name]: files[0] }));
      if (name === "resume") {
        setResumeFileName(files[0].name);
      }
    } else {
      // Limit phone to 10 digits
      if (name === "phone") {
        const onlyNums = value.replace(/[^0-9]/g, "").slice(0, 10);
        setForm((prev) => ({ ...prev, [name]: onlyNums }));
      } else {
        setForm((prev) => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Phone validation: must be exactly 10 digits
    if (!form.phone || form.phone.length !== 10) {
      showToast("Please enter a valid 10-digit phone number.", 'error');
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      // Only append if value is not null or undefined
      if (value !== null && value !== undefined) {
        data.append(key, value as string | Blob);
      }
    });
    try {
      await axios.post("/api/doctor/register", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showToast("Registration successful! Welcome to our network.", 'success');
      // Reset the form fields
      setForm({
        name: "",
        phone: "",
        email: "",
        specialization: "",
        degree: "",
        experience: "",
        address: "",
        resume: null,
      });
      setResumeFileName("");
      setTimeout(() => {
        window.location.href = '/';
      }, 6000);
    } catch (err: unknown) {
      let message = "Registration failed";

      interface AxiosErrorWithMessage {
        response?: {
          data?: {
            message?: string;
          };
        };
      }

      const axiosError = err as AxiosErrorWithMessage;

      if (typeof axiosError.response?.data?.message === "string") {
        message = axiosError.response.data.message;
      }

      showToast(message, 'error');
    }
  };

  const handlePhoneKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePhoneInput = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
  };

  const handleExperienceKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleExperienceInput = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
  };

return (
  <>
    {/* Toast Notifications */}
    {toast.show && (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <div className={`bg-white rounded-lg p-4 shadow-lg border-l-4 flex items-center gap-3 ${
          toast.type === 'success' ? 'border-emerald-500 animate-[slideIn_0.3s_ease-out]' :
          toast.type === 'error' ? 'border-red-500 animate-[slideIn_0.3s_ease-out]' : 
          'border-blue-500 animate-[slideIn_0.3s_ease-out]'
        }`}>
          <div className="flex-shrink-0">
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6m0-6l6 6" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-black">{toast.message}</p>
            {toast.type === 'success' && (
              <p className="text-xs text-emerald-600 mt-1">
                Redirecting to home page...
              </p>
            )}
          </div>
          <button
            className="text-black hover:text-gray-600 transition-colors p-1 rounded"
            onClick={() => setToast({ show: false, message: "", type: 'info' })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )}

    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="grid lg:grid-cols-2 min-h-screen">
        
        {/* Left Side - Registration Form */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-xl">
            
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#2D9AA5] to-cyan-600 rounded-full mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black mb-2">
                Doctor Registration
              </h1>
              <p className="text-black/70">
                Join ZEVA's network of healthcare professionals
              </p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100" ref={registrationRef}>
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Full Name *</label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Dr. John Smith"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                    onChange={handleChange}
                    value={form.name || ""}
                    required
                  />
                </div>

                {/* Email and Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Email *</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="doctor@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                      onChange={handleChange}
                      value={form.email || ""}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Phone *</label>
                    <input
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                      onChange={handleChange}
                      onKeyPress={handlePhoneKeyPress}
                      onInput={handlePhoneInput}
                      value={form.phone || ""}
                      required
                    />
                  </div>
                </div>

                {/* Specialization */}
                <div className="relative">
                  <label className="block text-sm font-medium text-black mb-2">Specialization *</label>
                  <select
                    id="specialization"
                    name="specialization"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all appearance-none bg-white text-black outline-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUgN0wxMCAxMkwxNSA3IiBzdHJva2U9IiM2QjcyODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=')] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
                    value={
                      specializationType === "dropdown"
                        ? form.specialization
                        : "other"
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setSpecializationType("dropdown");
                        setForm((prev) => ({
                          ...prev,
                          specialization: "",
                        }));
                        setCustomSpecialization("");
                      } else if (value === "other") {
                        setSpecializationType("other");
                        setForm((prev) => ({
                          ...prev,
                          specialization: "",
                        }));
                      } else {
                        setSpecializationType("dropdown");
                        setForm((prev) => ({
                          ...prev,
                          specialization: value,
                        }));
                      }
                    }}
                    required
                  >
                    <option value="" disabled hidden>
                      Select Specialization
                    </option>
                    {treatments.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

                {/* Custom Specialization */}
                {specializationType === "other" && (
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Enter Specialization *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                      placeholder="e.g., Sports Medicine"
                      value={customSpecialization}
                      onChange={(e) => {
                        setCustomSpecialization(e.target.value);
                        setForm((prev) => ({
                          ...prev,
                          specialization: e.target.value,
                        }));
                      }}
                      required
                    />
                  </div>
                )}

                {/* Experience and Degree */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Experience (Years) *</label>
                    <input
                      name="experience"
                      type="text"
                      placeholder="5"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                      onChange={handleChange}
                      onKeyPress={handleExperienceKeyPress}
                      onInput={handleExperienceInput}
                      value={form.experience || ""}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Degree *</label>
                    <input
                      name="degree"
                      type="text"
                      placeholder="MBBS, MD, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all text-black placeholder-black/50 outline-none"
                      onChange={handleChange}
                      value={form.degree || ""}
                      required
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Clinic Address *</label>
                  <textarea
                    name="address"
                    placeholder="Enter your complete practice address"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5]/20 transition-all resize-none text-black placeholder-black/50 outline-none"
                    onChange={handleChange}
                    value={form.address || ""}
                    required
                  ></textarea>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Upload Resume *</label>
                  <div className="relative">
                    <input
                      type="file"
                      name="resume"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const maxSize = 1024 * 1024;
                          if (file.size > maxSize) {
                            setFileError("File is too large");
                            e.target.value = "";
                            return;
                          }
                          setFileError("");
                          setResumeFileName(file.name);
                          handleChange(e);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      required
                    />
                    <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 bg-gray-50 text-black/60 cursor-pointer hover:bg-[#2D9AA5]/5 hover:border-[#2D9AA5] transition-all rounded-lg text-center">
                      {resumeFileName ? `📄 ${resumeFileName}` : "Upload Resume (PDF, DOC, DOCX)"}
                    </div>
                  </div>
                  <div className={`text-xs mt-1 ${fileError ? "text-red-500" : "text-black/50"}`}>
                    {fileError || "Max file size: 1MB"}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#2D9AA5] to-cyan-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-[#238892] hover:to-cyan-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Complete Registration
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Side - Why Register */}
        <div className="hidden lg:flex bg-gray-50 p-10 items-center">
          <div className="w-full max-w-xl mx-auto">
            
            {/* Header */}
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold mb-3 text-gray-900">Why Register With ZEVA?</h2>
              <p className="text-gray-600 text-lg">
                Join thousands of practitioners who trust our platform
              </p>
            </div>

            {/* Benefits Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1">Personal Dashboard</h3>
                    <p className="text-gray-600 text-sm">
                      Get comprehensive analytics and insights to manage your practice effectively
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1">Extensive Patient Network</h3>
                    <p className="text-gray-600 text-sm">
                      Connect with thousands of patients seeking trusted healthcare
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1">Post Job Opportunities</h3>
                    <p className="text-gray-600 text-sm">
                      Hire qualified staff directly through the platform
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1">Write & Share Blogs</h3>
                    <p className="text-gray-600 text-sm">
                      Share your expertise to establish authority and attract patients
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Features */}
            <div className="mt-6 p-5 bg-white rounded-xl shadow-sm border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Additional Benefits
              </h4>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                  24/7 customer support for all practitioners
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                  Free marketing tools and promotional materials
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                  Secure patient data management system
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                  Regular platform updates and new features
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>

    <style jsx>{`
      @keyframes slideIn {
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
  </>
);
}

DoctorRegister.getLayout = function PageLayout(page: React.ReactNode) {
  return <Layout>{page}</Layout>;
};
