"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  X,
  Search,
  Plus,
  Loader2,
  Calendar,
  Building2,
  AlertCircle,
  Check,
} from "lucide-react";
import { APPOINTMENT_STATUS_OPTIONS } from "../data/appointmentStatusOptions";
import { ModalPortal } from "../lib/modalPortal";

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctorId: string;
  doctorName: string;
  slotTime: string;
  slotDisplayTime: string;
  defaultDate: string;
  defaultRoomId?: string;
  bookedFrom?: "doctor" | "room"; // Track which column the appointment is being booked from
  fromTime?: string; // For drag selection - start time
  toTime?: string; // For drag selection - end time
  customTimeSlots?: { startTime: string; endTime: string }; // Custom time slot selection
  rooms: Array<{ _id: string; name: string }>;
  doctorStaff: Array<{ _id: string; name: string; email?: string }>;
  getAuthHeaders: () => Record<string, string>;
  preSelectedPatient?: Patient | null; // Pre-selected patient from drag operation
}

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  countryCode?: string;
  mobileNumber: string;
  email: string;
  emrNumber: string;
  gender: string;
}

interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

interface AddPatientForm {
  emrNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  referredBy: string;
  patientType: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+1", name: "Canada", flag: "🇨🇦" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+7", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "+20", name: "Egypt", flag: "🇪🇬" },
  { code: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "+30", name: "Greece", flag: "🇬🇷" },
  { code: "+31", name: "Netherlands", flag: "🇳🇱" },
  { code: "+32", name: "Belgium", flag: "🇧🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+40", name: "Romania", flag: "🇷🇴" },
  { code: "+41", name: "Switzerland", flag: "🇨🇭" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+45", name: "Denmark", flag: "🇩🇰" },
  { code: "+46", name: "Sweden", flag: "🇸🇪" },
  { code: "+47", name: "Norway", flag: "🇳🇴" },
  { code: "+48", name: "Poland", flag: "🇵🇱" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+52", name: "Mexico", flag: "🇲🇽" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+62", name: "Indonesia", flag: "🇮🇩" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+64", name: "New Zealand", flag: "🇳🇿" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+66", name: "Thailand", flag: "🇹🇭" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+82", name: "South Korea", flag: "🇰🇷" },
  { code: "+84", name: "Vietnam", flag: "🇻🇳" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+90", name: "Turkey", flag: "🇹🇷" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+93", name: "Afghanistan", flag: "🇦🇫" },
  { code: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+95", name: "Myanmar", flag: "🇲🇲" },
  { code: "+98", name: "Iran", flag: "🇮🇷" },
  { code: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "+972", name: "Israel", flag: "🇮🇱" },
  { code: "+973", name: "Bahrain", flag: "🇧🇭" },
  { code: "+974", name: "Qatar", flag: "🇶🇦" },
  { code: "+975", name: "Bhutan", flag: "🇧🇹" },
  { code: "+976", name: "Mongolia", flag: "🇲🇳" },
  { code: "+977", name: "Nepal", flag: "🇳🇵" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+994", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "+996", name: "Kyrgyzstan", flag: "🇰🇬" },
];

// Country + Phone input with searchable dropdown
interface CountryPhoneInputProps {
  countryCode: string;
  phone: string;
  onCountryChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
}

const CountryPhoneInput = ({ countryCode, phone, onCountryChange, onPhoneChange }: CountryPhoneInputProps) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const options = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.replace("+", "").includes(q)
    );
  }, [query]);
  const selected = React.useMemo(() => COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES.find((c) => c.code === "+91"), [countryCode]);
  
  // Extract local number (without country code) for display
  const localNumber = React.useMemo(() => {
    if (!phone) return '';
    if (phone.startsWith(countryCode)) {
      return phone.slice(countryCode.length);
    }
    // If it doesn't start with country code, return as is
    return phone.replace(/^\+\d+/, '');
  }, [phone, countryCode]);
  
  return (
    <div className="relative w-full">
      <div className={`flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-teal-600`}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1 bg-gray-50 hover:bg-gray-100 focus:outline-none"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-lg leading-none">{selected?.flag || "🏳️"}</span>
          <span className="text-[10px] text-gray-800">{selected?.code || "+91"}</span>
          <svg className="w-3 h-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z"/></svg>
        </button>
        <input
  type="tel"
  value={localNumber}
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    onPhoneChange(value);
  }}
  maxLength={10}
  inputMode="numeric"
  pattern="[0-9]{10}"
  className="flex-1 px-2 py-1 text-[7px] focus:outline-none"
  placeholder="Enter 10-digit number"
/>
      </div>
      {open && (
        <div className="absolute z-[10000] mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-600"
              autoFocus
            />
          </div>
          <ul role="listbox">
            {options.map((c, idx) => (
              <li
                key={`${c.code}-${c.name}-${idx}`}
                role="option"
                onClick={() => {
                  onCountryChange(c.code);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 ${c.code === selected?.code ? 'bg-teal-50' : ''}`}
              >
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="text-[11px] text-gray-800 flex-1">{c.name}</span>
                <span className="text-[11px] text-gray-600">{c.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface DoctorDepartment {
  _id: string;
  name: string;
}

interface Referral {
  _id: string;
  firstName: string;
  lastName: string;
}

export default function AppointmentBookingModal({
  isOpen,
  onClose,
  onSuccess,
  doctorId,
  slotTime,
  slotDisplayTime: _slotDisplayTime,
  defaultDate,
  defaultRoomId,
  bookedFrom, // No default - use the prop value directly
  customTimeSlots,
  fromTime: propFromTime,
  toTime: propToTime,
  rooms,
  doctorStaff,
  getAuthHeaders,
  preSelectedPatient,
}: AppointmentBookingModalProps) {
  // Debug: Log when component receives props
  console.log("AppointmentBookingModal - Received props:", {
    bookedFrom,
    doctorId,
    defaultRoomId,
    isOpen,
    preSelectedPatient: preSelectedPatient ? preSelectedPatient.fullName : null,
  });

  const [roomId, setRoomId] = useState<string>("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  // Use useRef to capture bookedFrom when modal opens - this ensures it doesn't change
  const bookedFromRef = React.useRef<"doctor" | "room">("doctor");

  // Initialize bookedFrom from prop - this will be updated in useEffect when modal opens
  const [currentBookedFrom, setCurrentBookedFrom] = useState<"doctor" | "room">(
    () => {
      // Use the prop value if available, otherwise default based on whether roomId or doctorId is set
      console.log(
        "Initializing currentBookedFrom - bookedFrom prop:",
        bookedFrom
      );
      if (bookedFrom === "room" || bookedFrom === "doctor") {
        bookedFromRef.current = bookedFrom;
        return bookedFrom;
      }
      if (defaultRoomId && !doctorId) {
        bookedFromRef.current = "room";
        return "room";
      }
      bookedFromRef.current = "doctor";
      return "doctor";
    }
  );
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [addPatientForm, setAddPatientForm] = useState<AddPatientForm>({
    emrNumber: "",
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    countryCode: "+91",
    mobileNumber: "",
    referredBy: "",
    patientType: "New",
  });
  const [followType, setFollowType] = useState<string>("first time");
  const [startDate, setStartDate] = useState<string>(
    defaultDate || new Date().toISOString().split("T")[0]
  );

  const SLOT_INTERVAL_MINUTES = 15;

  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const calculateEndTime = (time: string) => {
    if (!time) return "";
    const [hour, min] = time.split(":").map(Number);
    const totalMinutes = hour * 60 + min + SLOT_INTERVAL_MINUTES;
    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;
    return `${String(newHour).padStart(2, "0")}:${String(newMin).padStart(
      2,
      "0"
    )}`;
  };

  const [fromTime, setFromTime] = useState<string>(slotTime || "09:00");
  const [toTime, setToTime] = useState<string>(
    slotTime ? calculateEndTime(slotTime) : calculateEndTime("09:00")
  );
  const [referral, setReferral] = useState<string>("No");
  const [emergency, setEmergency] = useState<string>("no");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addingPatient, setAddingPatient] = useState(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [doctorDepartments, setDoctorDepartments] = useState<
    DoctorDepartment[]
  >([]);
  const [doctorDeptLoading, setDoctorDeptLoading] = useState(false);
  const [doctorDeptError, setDoctorDeptError] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [services, setServices] = useState<Array<{ _id: string; name: string }>>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [servicesSearch, setServicesSearch] = useState("");
  // Inline "Add Referral" popup state
  const [showAddReferral, setShowAddReferral] = useState(false);
  const [referralForm, setReferralForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    referralPercent: 0,
    addExpense: false,
  });
  const [referralErrors, setReferralErrors] = useState<Record<string, string>>({});
  const [savingReferral, setSavingReferral] = useState(false);
  const servicesSearchRef = React.useRef<HTMLInputElement>(null);
 
  // Filter services based on search
  const filteredServices = React.useMemo(() => {
    if (!servicesSearch.trim()) return services;
    const query = servicesSearch.toLowerCase();
    return services.filter(svc =>
      svc.name.toLowerCase().includes(query)
    );
  }, [services, servicesSearch]);
 
  // Auto-focus search input when dropdown opens
  React.useEffect(() => {
    if (isServicesOpen && servicesSearchRef.current) {
      setTimeout(() => {
        servicesSearchRef.current?.focus();
      }, 100);
    }
  }, [isServicesOpen]);

  // Whenever the selected slot changes (or modal reopens), sync the times
  useEffect(() => {
    if (isOpen) {
      // Use drag-selected times if available, otherwise use slotTime
      if (propFromTime && propToTime) {
        setFromTime(propFromTime);
        setToTime(propToTime);
      } else {
        setFromTime(slotTime || "09:00");
        setToTime(calculateEndTime(slotTime || "09:00"));
        setReferral("No");
      }
      setStartDate(defaultDate || new Date().toISOString().split("T")[0]);
      // Set doctor from click (pre-selected), but allow user to change via dropdown
      setSelectedDoctorId(doctorId || "");
      setRoomId("");
      setStatus("");

      console.log("Modal opened - doctor pre-selected:", doctorId || "(none - dropdown will show placeholder)");
      // Always update bookedFrom from prop when modal opens - this ensures it's correct
      // CRITICAL: Use the prop value directly if it's explicitly "room" or "doctor"
      let newBookedFrom: "doctor" | "room";
      if (bookedFrom === "room") {
        newBookedFrom = "room";
      } else if (bookedFrom === "doctor") {
        newBookedFrom = "doctor";
      } else {
        // Fallback: infer from context
        newBookedFrom = defaultRoomId && !doctorId ? "room" : "doctor";
      }
      // Update both state and ref to ensure we have the correct value
      bookedFromRef.current = newBookedFrom;
      console.log("=== MODAL OPENED - UPDATING bookedFrom ===");
      console.log("Prop bookedFrom:", bookedFrom);
      console.log("Calculated newBookedFrom:", newBookedFrom);
      console.log("Updated bookedFromRef.current to:", bookedFromRef.current);
      console.log("defaultRoomId:", defaultRoomId, "doctorId:", doctorId);
      console.log("==========================================");
      setCurrentBookedFrom(newBookedFrom);

      // Set pre-selected patient if provided, otherwise reset fields
      if (preSelectedPatient) {
        console.log("Setting pre-selected patient:", preSelectedPatient);
        console.log("Patient fields:", Object.keys(preSelectedPatient));
        setSelectedPatient(preSelectedPatient);
        setPatientSearch(preSelectedPatient.fullName);
        setSearchResults([]); // Clear search results when pre-selecting
        setShowAddPatient(false);
        console.log("Pre-selected patient set:", preSelectedPatient);
      } else {
        console.log("No pre-selected patient provided");
        // Reset patient search fields when modal opens without pre-selection
        setPatientSearch("");
        setSearchResults([]);
        setSelectedPatient(null);
        setShowAddPatient(false);
      }
    } else {
      // Also reset when modal closes
      setPatientSearch("");
      setSearchResults([]);
      setSelectedPatient(null);
      setShowAddPatient(false);
    }
  }, [
    slotTime,
    isOpen,
    defaultDate,
    doctorId,
    defaultRoomId,
    bookedFrom,
    propFromTime,
    propToTime,
    preSelectedPatient,
  ]);

  // Search patients - trigger on single character
  useEffect(() => {
    if (patientSearch?.trim()?.length >= 1) {
      // Show loading immediately when user types
      setSearching(true);
      const searchTimeout = setTimeout(() => {
        searchPatients();
      }, 200); // Reduced delay for faster response
      return () => clearTimeout(searchTimeout);
    } else {
      setSearchResults([]);
      setSearching(false);
    }
  }, [patientSearch]);

  const searchPatients = async () => {
    try {
      setSearching(true);
      const res = await axios.get(
        `/api/clinic/search-patients?search=${encodeURIComponent(
          patientSearch
        )}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (res.data.success) {
        setSearchResults(res.data.patients || []);
      }
    } catch (err: any) {
      console.error("Error searching patients:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleFromTimeChange = (value: string) => {
    // Check if time is in the past
    if (startDate === getCurrentDate()) {
      const currentTimeMinutes = timeStringToMinutes(getCurrentTime());
      const selectedTimeMinutes = timeStringToMinutes(value);
      if (selectedTimeMinutes < currentTimeMinutes) {
        toast.error("Cannot select a time in the past");
        return;
      }
    }

    // Check against custom time slots if available
    if (customTimeSlots?.endTime) {
      const selectedMinutes = timeStringToMinutes(value);
      const endMinutes = timeStringToMinutes(customTimeSlots.endTime);
      if (selectedMinutes >= endMinutes) {
        toast.error(`Booking is not allowed after ${formatTime(customTimeSlots.endTime)}. Slots are available only until ${formatTime(customTimeSlots.endTime)}.`);
        return;
      }
    }
    setFromTime(value);
    setToTime(calculateEndTime(value));
    setFieldErrors((prev) => ({ ...prev, fromTime: "", toTime: "" }));
  };

  const handleToTimeChange = (value: string) => {
    // Check if time is in the past
    if (startDate === getCurrentDate()) {
      const currentTimeMinutes = timeStringToMinutes(getCurrentTime());
      const selectedTimeMinutes = timeStringToMinutes(value);
      if (selectedTimeMinutes < currentTimeMinutes) {
        toast.error("Cannot select a time in the past");
        return;
      }
    }

    // Check against custom time slots if available
    if (customTimeSlots?.endTime) {
      const selectedMinutes = timeStringToMinutes(value);
      const endMinutes = timeStringToMinutes(customTimeSlots.endTime);
      if (selectedMinutes > endMinutes) {
        toast.error(`Booking is not allowed after ${formatTime(customTimeSlots.endTime)}. Slots are available only until ${formatTime(customTimeSlots.endTime)}.`);
        return;
      }
    }
    setToTime(value);
    setFieldErrors((prev) => ({ ...prev, toTime: "" }));
  };

  const timeStringToMinutes = (time: string): number => {
    if (!time) return 0;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const formatTime = (time: string): string => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hours = h % 12 || 12;
    return `${hours}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const handleAddPatient = async () => {
    if (!addPatientForm.firstName || !addPatientForm.mobileNumber) {
      setError("Please fill all required fields: First Name and Mobile Number");
      return;
    }
    // Extract local number without country code to check length
    let localNum = addPatientForm.mobileNumber;
    if (localNum.startsWith(addPatientForm.countryCode)) {
      localNum = localNum.slice(addPatientForm.countryCode.length);
    } else {
      localNum = localNum.replace(/^\+\d+/, '');
    }
    if (localNum.length !== 10) {
      setError("Mobile Number must be exactly 10 digits");
      return;
    }

    try {
      setAddingPatient(true);
      setError("");
      const res = await axios.post("/api/clinic/add-patient", addPatientForm, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setSelectedPatient(res.data.patient);
        setShowAddPatient(false);
        setPatientSearch(res.data.patient.fullName);
        setAddPatientForm({
          emrNumber: "",
          firstName: "",
          lastName: "",
          gender: "",
          email: "",
          countryCode: "+91",
          mobileNumber: "",
          referredBy: "",
          patientType: "New",
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add patient");
    } finally {
      setAddingPatient(false);
    }
  };

  const fetchDoctorDepartments = async (targetDoctorId: string) => {
    if (!targetDoctorId) {
      setDoctorDepartments([]);
      return;
    }
    try {
      setDoctorDeptLoading(true);
      setDoctorDeptError("");
      const res = await axios.get(
        `/api/clinic/doctor-departments?doctorStaffId=${targetDoctorId}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (res.data.success) {
        setDoctorDepartments(res.data.departments || []);
      } else {
        setDoctorDeptError(res.data.message || "Failed to load departments");
        setDoctorDepartments([]);
      }
    } catch (err: any) {
      console.error("Error loading doctor departments", err);
      setDoctorDeptError(
        err.response?.data?.message || "Failed to load departments"
      );
      setDoctorDepartments([]);
    } finally {
      setDoctorDeptLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const res = await axios.get("/api/clinic/referrals", {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setReferrals(res.data.referrals || []);
      }
    } catch (err) {
      console.error("Error fetching referrals:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReferrals();
    }
  }, [isOpen]);

  // Inline Add Referral popup helpers
  const resetReferralForm = () => {
    setReferralForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      referralPercent: 0,
      addExpense: false,
    });
    setReferralErrors({});
  };

  const closeAddReferral = () => {
    setShowAddReferral(false);
    resetReferralForm();
  };

  const handleReferralFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setReferralForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (referralErrors[name]) {
      setReferralErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateReferralForm = () => {
    const errs: Record<string, string> = {};
    if (!String(referralForm.firstName).trim()) {
      errs.firstName = "First name is required";
    }
    if (!String(referralForm.phone).trim()) {
      errs.phone = "Phone is required";
    }
    const pct = Number(referralForm.referralPercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      errs.referralPercent = "Referral % must be between 0 and 100";
    }
    setReferralErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveReferral = async () => {
    if (!validateReferralForm()) {
      toast.error("Please fix the highlighted errors");
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      toast.error("Authentication required");
      return;
    }
    setSavingReferral(true);
    try {
      const res = await axios.post(
        "/api/clinic/referrals",
        {
          firstName: referralForm.firstName,
          lastName: referralForm.lastName,
          phone: referralForm.phone,
          email: referralForm.email,
          referralPercent: Number(referralForm.referralPercent),
          addExpense: referralForm.addExpense,
        },
        { headers },
      );
      if (res.data.success) {
        toast.success("Referral created");
        // Refetch the referral list to include the new referral
        await fetchReferrals();
        // Auto-select the newly created referral in the add-patient form
        const created = res.data.referral;
        const fullName = `${created?.firstName || referralForm.firstName} ${
          created?.lastName || referralForm.lastName
        }`.trim();
        setAddPatientForm((prev) => ({ ...prev, referredBy: fullName }));
        closeAddReferral();
      } else {
        toast.error(res.data?.message || "Failed to create referral");
      }
    } catch (err: any) {
      console.error("Error creating referral:", err);
      toast.error(err?.response?.data?.message || "Failed to create referral");
    } finally {
      setSavingReferral(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedDoctorId) {
      fetchDoctorDepartments(selectedDoctorId);
    }
  }, [isOpen, selectedDoctorId]);

  // Load clinic services for optional treatment selection
  useEffect(() => {
    const loadServices = async () => {
      try {
        setServicesLoading(true);
        const res = await axios.get("/api/clinic/services", {
          headers: getAuthHeaders(),
        });
        if (res.data.success) {
          const list = Array.isArray(res.data.services)
            ? res.data.services
            : [];
          setServices(list.map((s: any) => ({ _id: s._id, name: s.name })));
        } else {
          setServices([]);
        }
      } catch (e) {
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    };
    if (isOpen) {
      loadServices();
    }
  }, [isOpen, getAuthHeaders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError("");
    setFieldErrors({});

    // Validate that appointment date/time is not in the past
    const now = new Date();
    const [year, month, day] = startDate.split('-').map(Number);
    const [fromHour, fromMinute] = fromTime.split(':').map(Number);
    const appointmentDateTime = new Date(year, month - 1, day, fromHour, fromMinute);
    
    if (appointmentDateTime < now) {
      setError("Cannot book an appointment in the past. Please select a future date and time.");
      toast.error("Cannot book an appointment in the past");
      return;
    }

    // Client-side validation
    const clientErrors: Record<string, string> = {};
    if (!selectedPatient) {
      clientErrors.patientId = "Please select a patient";
    }
   
    // REQUIRE both room AND doctor as per user request
    if (!roomId) {
      clientErrors.roomId = "Room is not filled";
      toast.error("Please select the room, it is mandatory", { id: "room-mandatory-toast" });
    }
    if (!selectedDoctorId) {
      clientErrors.doctorId = "Doctor is not filled";
      toast.error("Please select a doctor, it is mandatory", { id: "doctor-mandatory-toast" });
    }
    if (!status) {
      clientErrors.status = "Status is not filled";
      toast.error("Please select a status, it is mandatory", { id: "status-mandatory-toast" });
    }
   
    if (!followType) {
      clientErrors.followType = "Please select a follow type";
    }
    if (!startDate) {
      clientErrors.startDate = "Please select a start date";
    }
    if (!fromTime) {
      clientErrors.fromTime = "Please select a from time";
    }
    if (!toTime) {
      clientErrors.toTime = "Please select a to time";
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError("Mandatory sections are not filled: Room, Doctor, and Status are required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setFieldErrors({});

      // Determine the final bookedFrom value - prioritize in this order: ref > prop > state > context
      // The ref ensures we have the value that was set when the modal opened, even if prop changes
      let finalBookedFrom: "doctor" | "room";

      // Debug: Log all values first
      console.log("=== APPOINTMENT BOOKING DEBUG ===");
      console.log("Ref bookedFromRef.current:", bookedFromRef.current);
      console.log("Prop bookedFrom:", bookedFrom, "Type:", typeof bookedFrom);
      console.log("Prop bookedFrom === 'room':", bookedFrom === "room");
      console.log("Prop bookedFrom === 'doctor':", bookedFrom === "doctor");
      console.log("State currentBookedFrom:", currentBookedFrom);
      console.log("defaultRoomId:", defaultRoomId);
      console.log("doctorId prop:", doctorId);
      console.log("selectedDoctorId state:", selectedDoctorId);

      // CRITICAL: Check ref first (captured when modal opened)
      if (bookedFromRef.current === "room") {
        finalBookedFrom = "room";
        console.log("✓ Using 'room' from ref (captured when modal opened)");
      } else if (bookedFromRef.current === "doctor") {
        finalBookedFrom = "doctor";
        console.log("✓ Using 'doctor' from ref (captured when modal opened)");
      }
      // Then check prop
      else if (bookedFrom === "room") {
        finalBookedFrom = "room";
        console.log("✓ Using 'room' from prop");
      } else if (bookedFrom === "doctor") {
        finalBookedFrom = "doctor";
        console.log("✓ Using 'doctor' from prop");
      }
      // Fallback to state if prop is not explicitly set
      else if (currentBookedFrom === "room" || currentBookedFrom === "doctor") {
        finalBookedFrom = currentBookedFrom;
        console.log("⚠ Using state value:", currentBookedFrom);
      }
      // Last resort: infer from context
      else {
        finalBookedFrom = defaultRoomId && !doctorId ? "room" : "doctor";
        console.log("⚠ Inferring from context:", finalBookedFrom);
      }

      console.log("Final bookedFrom being sent:", finalBookedFrom);
      console.log("=================================");

      // CRITICAL: Double-check the value before sending
      const valueToSend = finalBookedFrom;
      console.log("🚀 SENDING TO API - bookedFrom:", valueToSend);
      console.log("🚀 Request payload bookedFrom field will be:", valueToSend);

      const res = await axios.post(
        "/api/clinic/appointments",
        {
          patientId: selectedPatient?._id,
          doctorId: selectedDoctorId,
          roomId,
          status,
          followType,
          startDate,
          fromTime,
          toTime,
          referral,
          emergency,
          notes,
          serviceId: selectedServiceIds.length > 0 ? selectedServiceIds[0] : undefined,
          serviceIds: selectedServiceIds,
          bookedFrom: valueToSend, // Use the determined value - ensure it's "room" or "doctor"
          customTimeSlots: customTimeSlots
            ? {
                startTime: customTimeSlots.startTime,
                endTime: customTimeSlots.endTime,
              }
            : undefined,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        onSuccess();
        handleClose();
        // Reset form
        resetForm();
      } else {
        setError(res.data.message || "Failed to book appointment");
      }
    } catch (err: any) {
      const status = err.response?.status;
      const errorData = err.response?.data;
     
      // Handle 403 authentication error
      if (status === 403) {
        toast.error("Session expired. Please login again.", {
          duration: 4000,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            fontSize: '13px',
            fontWeight: '500',
          },
        });
        setError("Authentication failed. Please login again.");
        return;
      }
     
      if (errorData?.errors) {
        // Field-level errors from API
        setFieldErrors(errorData.errors);
        setError(errorData.message || "Please fix the errors below");
      } else if (errorData?.missingFields) {
        // Convert missing fields to field errors
        const missingFieldErrors: Record<string, string> = {};
        errorData.missingFields.forEach((field: string) => {
          const fieldLabel =
            errorData.missingFieldLabels?.[
              errorData.missingFields.indexOf(field)
            ] || field;
          missingFieldErrors[field] = `${fieldLabel} is required`;
        });
        setFieldErrors(missingFieldErrors);
        setError(errorData.message || "Please fill all required fields");
      } else {
        setError(errorData?.message || "Failed to book appointment");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRoomId("");
    setSelectedDoctorId("");
    setStatus("");
    setPatientSearch("");
    setSearchResults([]);
    setSelectedPatient(null);
    setShowAddPatient(false);
    setFollowType("first time");
    setStartDate(defaultDate || new Date().toISOString().split("T")[0]);
    setFromTime(slotTime || "09:00");
    setToTime(calculateEndTime(slotTime || "09:00"));
    setReferral("No");
    setEmergency("no");
    setNotes("");
    setSelectedServiceIds([]);
    setError("");
    setFieldErrors({});
    setServicesSearch("");
    setIsServicesOpen(false);
    setAddPatientForm({
      emrNumber: "",
      firstName: "",
      lastName: "",
      gender: "",
      email: "",
      countryCode: "+91",
      mobileNumber: "",
      referredBy: "",
      patientType: "New",
    });
  };

  // Wrap onClose to reset form when modal closes
  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;
  const selectedDoctor = doctorStaff.find(
    (doc) => doc._id === selectedDoctorId
  );
  const departmentNames =
    doctorDepartments.length > 0
      ? doctorDepartments.map((dept) => dept.name).filter(Boolean)
      : [];

  // Check if all required fields are filled
  // Note: BOTH doctorId AND roomId are required as per user request
  const isFormValid = Boolean(
    selectedPatient &&
      roomId &&
      selectedDoctorId &&
      status &&
      followType &&
      startDate &&
      fromTime &&
      toTime &&
      !loading
  );

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="bg-white dark:bg-gray-50 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-in slide-in-from-bottom-4 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600 px-4 py-3 flex items-center justify-between z-10 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-700 dark:bg-gray-600 rounded-lg">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 id="modal-title" className="text-base font-bold text-white">
                  Book Appointment
                </h2>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Schedule a new appointment
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-800 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-white hover:scale-110 active:scale-95"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form
            id="appointment-form"
            onSubmit={handleSubmit}
            noValidate
            className="p-4 space-y-4 overflow-y-auto flex-1 pb-4"
          >
            {error && (
              <div
                className="bg-red-50 dark:bg-red-100 border-l-4 border-red-500 dark:border-red-600 rounded-lg p-4 flex items-start gap-3 text-red-700 dark:text-red-900 shadow-md animate-in slide-in-from-top-2 fade-in"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />
                <p className="text-xs font-medium">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-800 mb-1">
                    Selected Doctor:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-900">
                      {selectedDoctor?.name || "Select a doctor"}
                    </span>
                    {selectedDoctor && (
                      <span className="ml-2 text-[10px] text-green-600 dark:text-green-700 font-medium">
                        ✓ Verified
                      </span>
                    )}
                  </p>
                  {selectedDoctor?.email && (
                    <p className="text-[10px] text-gray-600 dark:text-gray-700 truncate mt-0.5">
                      {selectedDoctor.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-700 dark:text-gray-800">
                <p className="font-medium text-gray-900 dark:text-gray-900 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-700" />
                  Departments
                </p>
                {doctorDeptLoading ? (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-700">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[10px]">Loading...</span>
                  </div>
                ) : doctorDeptError ? (
                  <p className="text-red-600 dark:text-red-700 text-[10px]">
                    {doctorDeptError}
                  </p>
                ) : departmentNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {departmentNames.map((name, idx) => (
                      <span
                        key={`${name}-${idx}`}
                        className="text-[9px] font-medium text-gray-700 dark:text-gray-800"
                      >
                        {name}
                        {idx < departmentNames.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-600 text-[10px] italic">
                    No departments assigned
                  </p>
                )}
              </div>
            </div>

            {/* Room, Doctor, Status - 3 fields in one row */}
            <div className="grid grid-cols-3 gap-4 pb-16 relative z-10">
              {/* Room Field */}
              <div>
                <label
                  htmlFor="room-select"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5"
                >
                  Room <span className="text-red-500">*</span>
                </label>
                <select
                  id="room-select"
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    if (fieldErrors.roomId) {
                      setFieldErrors({ ...fieldErrors, roomId: "" });
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.roomId
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                  style={{ zIndex: 1001, position: "relative" }}
                  aria-invalid={!!fieldErrors.roomId}
                  aria-describedby={
                    fieldErrors.roomId ? "room-error" : undefined
                  }
                >
                  <option value="">Select a room</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.roomId && (
                  <p
                    id="room-error"
                    className="mt-1 text-[10px] text-red-600 dark:text-red-700"
                    role="alert"
                  >
                    {fieldErrors.roomId}
                  </p>
                )}
              </div>

              {/* Doctor Field */}
              <div>
                <label
                  htmlFor="doctor-select"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5"
                >
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  id="doctor-select"
                  value={selectedDoctorId}
                  onChange={(e) => {
                    setSelectedDoctorId(e.target.value);
                    if (fieldErrors.doctorId) {
                      setFieldErrors({ ...fieldErrors, doctorId: "" });
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.doctorId
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                  style={{ zIndex: 1000, position: "relative" }}
                  aria-invalid={!!fieldErrors.doctorId}
                  aria-describedby={
                    fieldErrors.doctorId ? "doctor-error" : undefined
                  }
                >
                  <option value="">Select a doctor</option>
                  {doctorStaff.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.doctorId && (
                  <p
                    id="doctor-error"
                    className="mt-1 text-[10px] text-red-600 dark:text-red-700"
                    role="alert"
                  >
                    {fieldErrors.doctorId}
                  </p>
                )}
              </div>

              {/* Status Field */}
              <div>
                <label
                  htmlFor="status-select"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5"
                >
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="status-select"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    if (fieldErrors.status) {
                      setFieldErrors({ ...fieldErrors, status: "" });
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.status
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                  style={{ zIndex: 999, position: "relative" }}
                  aria-invalid={!!fieldErrors.status}
                  aria-describedby={
                    fieldErrors.status ? "status-error" : undefined
                  }
                >
                  <option value="">Select a status</option>
                  {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.status && (
                  <p
                    id="status-error"
                    className="mt-1 text-[10px] text-red-600 dark:text-red-700"
                    role="alert"
                  >
                    {fieldErrors.status}
                  </p>
                )}
              </div>
            </div>

            {/* Treatment Selection (Optional) */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                Treatments 
              </label>
              <div
                className={`w-full border border-gray-300 dark:border-gray-300 rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 cursor-pointer flex justify-between items-center transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                  isServicesOpen ? "ring-2 ring-gray-500 dark:ring-gray-600 border-gray-500 dark:border-gray-600" : ""
                }`}
                onClick={() => {
                  if (!isServicesOpen) {
                    setServicesSearch(""); // Clear search when opening
                  }
                  setIsServicesOpen(!isServicesOpen);
                }}
              >
                <div className="flex flex-wrap gap-1">
                  {selectedServiceIds.length > 0 ? (
                    selectedServiceIds.map((id) => {
                      const svc = services.find((s) => s._id === id);
                      return (
                        <span
                          key={id}
                          className="bg-gray-100 dark:bg-gray-200 text-gray-800 dark:text-gray-900 px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          {svc?.name || "Unknown"}
                          <X
                            className="w-2.5 h-2.5 cursor-pointer hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedServiceIds(selectedServiceIds.filter((sid) => sid !== id));
                            }}
                          />
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">
                      Select treatments 
                    </span>
                  )}
                </div>
                {/* <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isServicesOpen ? "rotate-180" : ""}`} /> */}
              </div>

              {isServicesOpen && (
                <div className="absolute z-[1002] mt-1 w-full bg-white dark:bg-gray-50 border border-gray-200 dark:border-gray-300 rounded-lg shadow-xl max-h-60 overflow-hidden animate-in fade-in slide-in-from-top-1 flex flex-col">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-300 flex-shrink-0">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        ref={servicesSearchRef}
                        value={servicesSearch}
                        onChange={(e) => setServicesSearch(e.target.value)}
                        placeholder="Search treatments..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-400 rounded-md focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 placeholder-gray-400"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                 
                  {/* Services List */}
                  <div className="overflow-y-auto flex-1 max-h-[200px]">
                    {servicesLoading ? (
                      <div className="p-3 text-center text-xs text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading treatments...
                      </div>
                    ) : filteredServices.length > 0 ? (
                      <div className="py-1">
                        {filteredServices.map((svc) => {
                          const isSelected = selectedServiceIds.includes(svc._id);
                          return (
                            <div
                              key={svc._id}
                              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-200 ${
                                isSelected ? "bg-gray-50 dark:bg-gray-100 text-gray-900 font-medium" : "text-gray-700 dark:text-gray-800"
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedServiceIds(selectedServiceIds.filter((id) => id !== svc._id));
                                } else {
                                  setSelectedServiceIds([...selectedServiceIds, svc._id]);
                                }
                              }}
                            >
                              <span>{svc.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-green-600" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-500 italic">
                        {servicesSearch ? 'No treatments match your search' : 'No treatments found'}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isServicesOpen && (
                <div
                  className="fixed inset-0 z-[1001]"
                  onClick={() => {
                    setIsServicesOpen(false);
                    setServicesSearch(""); // Clear search when closing
                  }}
                />
              )}
            </div>

            {/* Search Patient */}
            <div>
              <label
                htmlFor="patient-search"
                className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5"
              >
                Search Patient <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-600" />
                <input
                  id="patient-search"
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    if (fieldErrors.patientId) {
                      setFieldErrors({ ...fieldErrors, patientId: "" });
                    }
                  }}
                  placeholder="Type to search patients (name, mobile, email, EMR)..."
                  className={`w-full border rounded-lg pl-10 pr-10 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 placeholder-gray-400 dark:placeholder-gray-600 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.patientId
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                  aria-invalid={!!fieldErrors.patientId}
                  aria-describedby={
                    fieldErrors.patientId ? "patient-error" : undefined
                  }
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-600 animate-spin" />
                )}
              </div>
              {fieldErrors.patientId && (
                <p
                  id="patient-error"
                  className="mt-1 text-[10px] text-red-600 dark:text-red-700"
                  role="alert"
                >
                  {fieldErrors.patientId}
                </p>
              )}

              {/* Search Results - Compact & Attractive */}
              {searchResults.length > 0 && (
                <div className="mt-1.5 border border-purple-200 dark:border-purple-300 rounded-lg max-h-40 overflow-y-auto bg-gradient-to-b from-white to-purple-50/30 dark:from-gray-50 dark:to-purple-50/20 shadow-md animate-in slide-in-from-top-2 fade-in">
                  {searchResults
                    .filter(
                      (patient) =>
                        !selectedPatient || patient._id !== selectedPatient._id
                    )
                    .map((patient, idx) => (
                      <div
                        key={patient._id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch(patient.fullName);
                          setSearchResults([]);
                        }}
                        className="p-1.5 hover:bg-purple-100/50 dark:hover:bg-purple-200/30 cursor-pointer border-b border-purple-100 dark:border-purple-200 last:border-b-0 transition-all duration-150 hover:shadow-sm active:scale-[0.98]"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 shadow-sm">
                            {patient.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[9px] text-gray-900 dark:text-gray-900 truncate leading-tight">
                              {patient.fullName}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="text-[8px] text-gray-600 dark:text-gray-700 font-medium">
                                {patient.mobileNumber}
                              </span>
                              {patient.email && (
                                <>
                                  <span className="text-[7px] text-gray-400">
                                    •
                                  </span>
                                  <span className="text-[8px] text-gray-600 dark:text-gray-700 truncate max-w-[120px]">
                                    {patient.email}
                                  </span>
                                </>
                              )}
                              {patient.emrNumber && (
                                <>
                                  <span className="text-[7px] text-gray-400">
                                    •
                                  </span>
                                  <span className="text-[8px] text-purple-600 dark:text-purple-700 font-semibold">
                                    EMR: {patient.emrNumber}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Selected Patient - Compact & Attractive */}
              {selectedPatient && (
                <div className="mt-1 p-1.5 bg-gradient-to-r from-purple-600 to-purple-500 dark:from-purple-700 dark:to-purple-600 rounded-md shadow-sm border border-purple-400 dark:border-purple-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-white/20 dark:bg-white/10 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                      {selectedPatient.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-white truncate leading-tight">
                        {selectedPatient.fullName}
                      </p>
                      <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                        <span className="text-[7px] text-white/90 font-medium">
                          {selectedPatient.mobileNumber}
                        </span>
                        {selectedPatient.email && (
                          <>
                            <span className="text-[6px] text-white/70">•</span>
                            <span className="text-[7px] text-white/90 truncate max-w-[90px]">
                              {selectedPatient.email}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPatient(null);
                        setPatientSearch("");
                      }}
                      className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                      title="Clear selection"
                    >
                      <X className="w-2 h-2 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Add Patient Button */}
              <button
                type="button"
                onClick={async () => {
                  setShowAddPatient(!showAddPatient);
                  // Auto-generate EMR number when showing the form
                  if (!showAddPatient) {
                    try {
                      const res = await axios.get(
                        "/api/clinic/next-emr-number",
                        {
                          headers: getAuthHeaders(),
                        }
                      );
                      if (res.data.success && res.data.emrNumber) {
                        setAddPatientForm((prev) => ({
                          ...prev,
                          emrNumber: res.data.emrNumber,
                        }));
                      }
                    } catch (err: any) {
                      console.error("Error fetching next EMR number:", err);
                      // Continue without auto-generated EMR - user can enter manually
                    }
                  }
                }}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add New Patient
              </button>
            </div>

            {/* Add Patient Form */}
            {showAddPatient && (
              <div className="border-2 border-gray-200 dark:border-gray-300 rounded-lg p-2.5 space-y-2 bg-gray-50 dark:bg-gray-100 shadow-md animate-in slide-in-from-top-2 fade-in">
                <h3 className="text-[10px] font-medium text-gray-900 dark:text-gray-900">
                  Add New Patient
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      EMR Number
                    </label>
                    <input
                      type="text"
                      value={addPatientForm.emrNumber}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          emrNumber: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addPatientForm.firstName}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          firstName: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={addPatientForm.lastName}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          lastName: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Gender
                    </label>
                    <select
                      value={addPatientForm.gender}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          gender: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={addPatientForm.email}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          email: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <CountryPhoneInput
                      countryCode={addPatientForm.countryCode}
                      phone={addPatientForm.mobileNumber}
                      onCountryChange={(newCode) => {
                        setAddPatientForm((prev) => {
                          let localNum = prev.mobileNumber;
                          if (localNum.startsWith(prev.countryCode)) {
                            localNum = localNum.slice(prev.countryCode.length);
                          } else {
                            localNum = localNum.replace(/^\+\d+/, '');
                          }
                          const newMobile = newCode + localNum;
                          return { ...prev, countryCode: newCode, mobileNumber: newMobile };
                        });
                      }}
                      onPhoneChange={(val) => {
                        const sanitized = val.replace(/[^\d]/g, "").slice(0, 15);
                        const fullNumber = addPatientForm.countryCode + sanitized;
                        setAddPatientForm((prev) => ({ ...prev, mobileNumber: fullNumber }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Referred By
                    </label>
                    <select
                      value={addPatientForm.referredBy}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          referredBy: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    >
                      <option value="">Select referral</option>
                      {referrals.map((ref) => (
                        <option
                          key={ref._id}
                          value={`${ref.firstName} ${ref.lastName}`.trim()}
                        >
                          {[ref.firstName, ref.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddReferral(true)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-600 dark:hover:text-teal-700 underline underline-offset-2 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Referral
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                      Patient Type
                    </label>
                    <select
                      value={addPatientForm.patientType}
                      onChange={(e) =>
                        setAddPatientForm({
                          ...addPatientForm,
                          patientType: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                    >
                      <option value="New">New</option>
                      <option value="Old">Old</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={handleAddPatient}
                    disabled={addingPatient}
                    className="bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                  >
                    {addingPatient && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {addingPatient ? "Adding..." : "Add Patient"}
                  </button>
                </div>
              </div>
            )}

            {/* Follow Type and Emergency - 2 fields in one row */}
            <div className="grid grid-cols-2 gap-4 pb-16 relative z-10">
              {/* Follow Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                  Follow Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={followType}
                  onChange={(e) => {
                    setFollowType(e.target.value);
                    if (fieldErrors.followType) {
                      setFieldErrors({ ...fieldErrors, followType: "" });
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.followType
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                  style={{ zIndex: 1001, position: "relative" }}
                >
                  <option value="first time">First Time</option>
                  <option value="follow up">Follow Up</option>
                  <option value="repeat">Repeat</option>
                </select>
                {fieldErrors.followType && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                    {fieldErrors.followType}
                  </p>
                )}
              </div>

              {/* Emergency */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                  Emergency
                </label>
                <select
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                  style={{ zIndex: 999, position: "relative" }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Date and Time Fields - 3 fields in one row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  min={getCurrentDate()}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (fieldErrors.startDate) {
                      setFieldErrors({ ...fieldErrors, startDate: "" });
                    }
                  }}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.startDate
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                />
                {fieldErrors.startDate && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                    {fieldErrors.startDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                  From Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  min={startDate === getCurrentDate() ? getCurrentTime() : undefined}
                  value={fromTime}
                  onChange={(e) => handleFromTimeChange(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.fromTime
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                />
                {fieldErrors.fromTime && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                    {fieldErrors.fromTime}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5">
                  To Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  min={startDate === getCurrentDate() ? getCurrentTime() : undefined}
                  value={toTime}
                  onChange={(e) => handleToTimeChange(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    fieldErrors.toTime
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-300"
                      : ""
                  }`}
                />
                {fieldErrors.toTime && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                    {fieldErrors.toTime}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-800 mb-1.5 flex items-center gap-2">
                <span>Notes</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-600 font-normal">
                  (Optional)
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm resize-none"
                placeholder="Add any additional notes or special instructions..."
              />
            </div>
          </form>

          {/* Actions - Fixed at bottom outside form */}
          <div className="sticky bottom-0 left-0 right-0 z-30 pt-3 pb-3 px-4 border-t border-gray-200 dark:border-gray-300 bg-white dark:bg-gray-50 shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.2)]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-400 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-900 bg-white dark:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="appointment-form"
                disabled={!isFormValid}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 shadow-md ${
                  !isFormValid
                    ? "bg-gray-400 dark:bg-gray-500 text-gray-200 dark:text-gray-300 cursor-not-allowed opacity-60 hover:scale-100 active:scale-100 shadow-none"
                    : "bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-800 text-white hover:scale-105 active:scale-95 hover:shadow-lg focus:ring-gray-500 cursor-pointer"
                }`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline "Add Referral" popup (same as Create Referral on /clinic/referal) */}
      {showAddReferral && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAddReferral();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-referral-title"
        >
          <div
            className="bg-white dark:bg-gray-50 rounded-2xl shadow-2xl max-w-[500px] w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-in slide-in-from-bottom-4 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600 px-4 py-3 flex items-center justify-between z-10 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-700 dark:bg-gray-600 rounded-lg">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2
                    id="add-referral-title"
                    className="text-base font-bold text-white"
                  >
                    Create Referral
                  </h2>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    Add a new referral contact
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAddReferral}
                className="p-1.5 hover:bg-gray-800 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-white hover:scale-110 active:scale-95"
                aria-label="Close add referral modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={referralForm.firstName}
                  onChange={handleReferralFieldChange}
                  className={`w-full border rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    referralErrors.firstName
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 dark:border-gray-300"
                  }`}
                  placeholder="Enter first name"
                />
                {referralErrors.firstName && (
                  <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-700">
                    {referralErrors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={referralForm.lastName}
                  onChange={handleReferralFieldChange}
                  className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={referralForm.phone}
                  onChange={handleReferralFieldChange}
                  className={`w-full border rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    referralErrors.phone
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 dark:border-gray-300"
                  }`}
                  placeholder="Enter phone number"
                />
                {referralErrors.phone && (
                  <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-700">
                    {referralErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={referralForm.email}
                  onChange={handleReferralFieldChange}
                  className="w-full border border-gray-300 dark:border-gray-300 rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm"
                  placeholder="Enter email (optional)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Referral %
                </label>
                <input
                  type="number"
                  name="referralPercent"
                  value={referralForm.referralPercent}
                  onChange={handleReferralFieldChange}
                  min={0}
                  max={100}
                  className={`w-full border rounded-lg px-2 py-1.5 text-[10px] bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm ${
                    referralErrors.referralPercent
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300 dark:border-gray-300"
                  }`}
                  placeholder="0"
                />
                {referralErrors.referralPercent && (
                  <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-700">
                    {referralErrors.referralPercent}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="addExpenseInline"
                  type="checkbox"
                  name="addExpense"
                  checked={!!referralForm.addExpense}
                  onChange={handleReferralFieldChange}
                  className="h-3 w-3 border-gray-300 rounded"
                />
                <label
                  htmlFor="addExpenseInline"
                  className="text-[10px] text-gray-700 dark:text-gray-800"
                >
                  Add an expense
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 z-30 pt-3 pb-3 px-4 border-t border-gray-200 dark:border-gray-300 bg-white dark:bg-gray-50 shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.2)]">
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeAddReferral}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-400 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-900 bg-white dark:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReferral}
                  disabled={savingReferral}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 shadow-md ${
                    savingReferral
                      ? "bg-gray-400 dark:bg-gray-500 text-gray-200 dark:text-gray-300 cursor-not-allowed opacity-60"
                      : "bg-teal-600 hover:bg-teal-700 text-white hover:scale-105 active:scale-95 hover:shadow-lg focus:ring-teal-500"
                  }`}
                >
                  {savingReferral && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {savingReferral ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalPortal>
  );
}
