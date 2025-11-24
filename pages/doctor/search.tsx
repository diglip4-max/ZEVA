"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import axios from "axios";
import {
  MapPin,
  Search,
  Star,
  Phone,
  Navigation,
  Shield,
  X,
  BadgeIndianRupee,
  Clock,
} from "lucide-react";
import AuthModal from "../../components/AuthModal";
import dayjs from "dayjs";
import Image from "next/image";
import { Stethoscope } from "lucide-react";

interface Doctor {
  _id: string;
  user: { name: string; phone?: string; email?: string; _id?: string };
  degree: string;
  address: string;
  photos: string[];
  verified: boolean;
  distance?: number;
  consultationFee?: number;
  timeSlots: Array<{
    date: string;
    availableSlots: number;
    sessions: {
      morning: string[];
      evening: string[];
    };
  }>;
  treatments?: Array<{
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
    }>;
  }>;
  treatment?: string | string[]; // Keep for backward compatibility
  experience: number;
  clinicContact: string;
  location: {
    coordinates: [number, number];
  };
}

interface Suggestion {
  type: string;
  value: string;
}

interface ReviewData {
  averageRating: number;
  totalReviews: number;
  reviews: Array<{
    comment: string;
    userId: { name: string };
  }>;
}

export default function FindDoctor() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [manualPlace, setManualPlace] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [starFilter, setStarFilter] = useState(0);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedDoctor] = useState<Doctor | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode] = useState<"login" | "register">(
    "login"
  );
  const [pendingAction, setPendingAction] = useState<{
    type: string;
    doctor: Doctor;
  } | null>(null);
  const [doctorReviews, setDoctorReviews] = useState<{
    [key: string]: ReviewData;
  }>({});
  const [reviewsLoading, setReviewsLoading] = useState<{
    [key: string]: boolean;
  }>({});

  // Add ref for results section
  const resultsRef = useRef<HTMLDivElement>(null);

  // Add missing state variables
  const [priceRange, setPriceRange] = useState([0, 5000]);
  // const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');

  // Add the clearAllFilters function
  const clearFilters = () => {
    setPriceRange([0, 5000]);
    setSelectedTimes([]);
    setStarFilter(0);
    setSortBy('relevance');
  };

  const getSortedDoctors = (doctors: Doctor[]) => {
    const sorted = [...doctors];

    switch (sortBy) {
      case 'price-low-high':
        return sorted.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
      case 'price-high-low':
        return sorted.sort((a, b) => (b.consultationFee || 0) - (a.consultationFee || 0));
      case 'rating-high-low':
        return sorted.sort((a, b) => {
          const ratingA = doctorReviews[a._id]?.averageRating || 0;
          const ratingB = doctorReviews[b._id]?.averageRating || 0;
          return ratingB - ratingA;
        });
      case 'experience-high-low':
        return sorted.sort((a, b) => (b.experience || 0) - (a.experience || 0));
      default:
        return sorted;
    }
  };

  const router = useRouter();
  // const { isAuthenticated, user } = useAuth();

  // Add state for dynamic available times
  const [dynamicAvailableTimes, setDynamicAvailableTimes] = useState<string[]>([]);
  // Function to extract available times from doctor time slots
  const extractAvailableTimes = (doctors: Doctor[]) => {
    const timeSet = new Set<string>();

    doctors.forEach(doctor => {
      if (doctor.timeSlots) {
        doctor.timeSlots.forEach(slot => {
          // Add morning slots
          if (slot.sessions.morning && slot.sessions.morning.length > 0) {
            slot.sessions.morning.forEach(time => {
              timeSet.add(time);
            });
          }
          // Add evening slots
          if (slot.sessions.evening && slot.sessions.evening.length > 0) {
            slot.sessions.evening.forEach(time => {
              timeSet.add(time);
            });
          }
        });
      }
    });

    // Convert to array and sort
    const times = Array.from(timeSet).sort();

    // Add special availability options
    const specialOptions = [
      'Available Today',
      'Available Tomorrow',
      'Weekend Available'
    ];

    return [...times, ...specialOptions];
  };

  // Update dynamic times when doctors change
  useEffect(() => {
    if (doctors.length > 0) {
      const times = extractAvailableTimes(doctors);
      setDynamicAvailableTimes(times);
    }
  }, [doctors]);

  // Add scroll to results functionality
  useEffect(() => {
    if (doctors.length > 0 && !loading && resultsRef.current) {
      // Add a small delay to ensure the results are rendered
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }, [doctors, loading]);

  // Fallback to static times if no dynamic times available
  const availableTimes = dynamicAvailableTimes.length > 0 ? dynamicAvailableTimes : [
    'Early Morning (4 AM - 6 AM)',
    'Morning (6 AM - 12 PM)',
    'Late Morning (10 AM - 12 PM)',
    'Afternoon (12 PM - 6 PM)',
    'Late Afternoon (3 PM - 6 PM)',
    'Evening (6 PM - 10 PM)',
    'Late Night (10 PM - 12 AM)',
    'Night (12 AM - 4 AM)',
    'Available Today',
    'Available Tomorrow',
    'Weekend Available'
  ];

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Use a per-page session token for doctor search
      const sessionToken = sessionStorage.getItem(
        "ayurvedaDoctorSearchSession"
      );
      if (!sessionToken) {
        // This is a new session for doctor search (all tabs were closed)
        localStorage.removeItem("ayurvedaDoctorSearchState");
        // Generate and store a new session token
        const newSessionToken =
          Math.random().toString(36).substr(2, 9) + Date.now();
        sessionStorage.setItem("ayurvedaDoctorSearchSession", newSessionToken);
      }
      // Only THEN load persisted state
      try {
        const persistedState = localStorage.getItem(
          "ayurvedaDoctorSearchState"
        );
        if (persistedState) {
          const state = JSON.parse(persistedState);
          // Check if state is not older than 24 hours
          const now = Date.now();
          const stateAge = now - (state.timestamp || 0);
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

          if (stateAge < maxAge && state.doctors && state.doctors.length > 0) {
            setDoctors(state.doctors);
            setCoords(state.coords);
            setSelectedService(state.selectedService || "");
            setManualPlace(state.manualPlace || "");
            setQuery(state.query || "");
            setStarFilter(state.starFilter || 0);
            setViewMode(state.viewMode || "list");

            // Fetch reviews for all persisted doctors
            state.doctors.forEach((doctor: Doctor) => {
              if (doctor._id) {
                fetchDoctorReviews(doctor._id);
              }
            });
          } else {
            // Clear expired state
            clearPersistedState();
          }
        }
      } catch {
        // console.error("Error loading persisted state:", error);
        clearPersistedState();
      }
    }
  }, []);

  // Save search state to localStorage whenever it changes
  useEffect(() => {
    if (doctors.length > 0 && coords) {
      const stateToPersist = {
        doctors,
        coords,
        selectedService,
        manualPlace,
        query,
        starFilter,
        viewMode,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "ayurvedaDoctorSearchState",
        JSON.stringify(stateToPersist)
      );
    }
  }, [
    doctors,
    coords,
    selectedService,
    manualPlace,
    query,
    starFilter,
    viewMode,
  ]);

  // Clear persisted state when user performs a new search
  const clearPersistedState = () => {
    localStorage.removeItem("ayurvedaDoctorSearchState");
  };

  // Add clear search function
  const clearSearch = () => {
    setDoctors([]);
    setCoords(null);
    setSelectedService("");
    setManualPlace("");
    setQuery("");
    setStarFilter(0);
    setSuggestions([]);
    clearPersistedState();
  };

  const clearLocation = () => {
    setManualPlace("");
  };

  // Function to fetch reviews for a single doctor
  const fetchDoctorReviews = async (doctorId: string) => {
    setReviewsLoading((prev) => ({ ...prev, [doctorId]: true }));
    try {
      const res = await axios.get(`/api/doctor/reviews/${doctorId}`);
      if (res.data.success) {
        setDoctorReviews((prev) => ({
          ...prev,
          [doctorId]: res.data.data,
        }));
      }
    } catch {
      setDoctorReviews((prev) => ({
        ...prev,
        [doctorId]: {
          averageRating: 0,
          totalReviews: 0,
          reviews: [],
        },
      }));
    } finally {
      setReviewsLoading((prev) => ({ ...prev, [doctorId]: false }));
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (pendingAction) {
      if (pendingAction.type === "enquiry") {
        const params = new URLSearchParams({
          doctorId: pendingAction.doctor._id,
          doctorName: pendingAction.doctor.user.name,
          specialization: pendingAction.doctor.degree,
        });
        router.push(`/doctor/enquiry-form?${params.toString()}`);
      } else if (pendingAction.type === "review") {
        const params = new URLSearchParams({
          doctorId: pendingAction.doctor._id,
          doctorName: pendingAction.doctor.user.name,
        });
        router.push(`/doctor/review-form?${params.toString()}`);
      }
      setPendingAction(null);
    }
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    setPendingAction(null);
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance}km`;
  };

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) return setSuggestions([]);

    try {
      const response = await axios.get(`/api/doctor/search?q=${q}`);
      const treatmentSuggestions = response.data.treatments.map(
        (t: string) => ({
          type: "treatment",
          value: t,
        })
      );
      setSuggestions(treatmentSuggestions);
    } catch {
      // console.error("Error fetching suggestions:", err);
    }
  };

  // Update fetchDoctors to accept a service parameter
  type FetchDoctorsType = (
    lat: number,
    lng: number,
    service?: string
  ) => Promise<void>;

  const fetchDoctors: FetchDoctorsType = async (lat, lng, service) => {
    setLoading(true);
    try {
      const res = await axios.get("/api/doctor/nearby", {
        params: { lat, lng, service: service ?? selectedService },
      });

      const doctorsWithDistance = res.data.doctors.map((doctor: Doctor) => {
        if (doctor.location?.coordinates?.length === 2) {
          const doctorLng = doctor.location.coordinates[0];
          const doctorLat = doctor.location.coordinates[1];
          const distance = calculateDistance(lat, lng, doctorLat, doctorLng);
          return { ...doctor, distance };
        }
        return { ...doctor, distance: null };
      });

      doctorsWithDistance.sort((a: Doctor, b: Doctor) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return (a.distance || 0) - (b.distance || 0);
      });

      setDoctors(doctorsWithDistance);

      // Fetch reviews for all doctors
      doctorsWithDistance.forEach((doctor: Doctor) => {
        if (doctor._id) {
          fetchDoctorReviews(doctor._id);
        }
      });
    } catch {
      // console.error("Error fetching doctors:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <Star
          key="half"
          className="w-4 h-4 fill-yellow-400/50 text-yellow-400"
        />
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }

    return stars;
  };

  // Update locateMe to pass selectedService
  const locateMe = () => {
    setLoading(true);
    clearPersistedState(); // Clear old state when starting new search
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        fetchDoctors(latitude, longitude, selectedService);
      },
      () => {
        alert("Geolocation permission denied");
        setLoading(false);
      }
    );
  };

  // Update searchByPlace to pass selectedService
  const searchByPlace = async () => {
    if (!manualPlace.trim()) return;

    setLoading(true);
    clearPersistedState(); // Clear old state when starting new search
    try {
      const res = await axios.get("/api/doctor/geocode", {
        params: { place: manualPlace },
      });
      setCoords({ lat: res.data.lat, lng: res.data.lng });
      fetchDoctors(res.data.lat, res.data.lng, selectedService);
    } catch {
      // console.error("Error in manual place search:", err);
      setLoading(false);
    }
  };


  // Update handleSearch to pass query as service
  const handleSearch = async () => {
    if (query.trim() && coords) {
      clearPersistedState(); // Clear old state when starting new search
      setSelectedService(query);
      fetchDoctors(coords.lat, coords.lng, query);
    } else if (manualPlace.trim()) {
      searchByPlace();
    }
  };

  const filteredDoctors = getSortedDoctors(
    doctors.filter(doctor => {
      // Existing filters...
      const matchesService = !selectedService ||
        (doctor.degree && doctor.degree.toLowerCase().includes(selectedService.toLowerCase()));

      const matchesStars = starFilter === 0 ||
        (doctorReviews[doctor._id]?.averageRating >= starFilter);

      // New filters
      const matchesPrice = !doctor.consultationFee ||
        (doctor.consultationFee >= priceRange[0] && doctor.consultationFee <= priceRange[1]);

      // Add timing filter logic based on your timeSlots structure
      const matchesTiming = selectedTimes.length === 0 || selectedTimes.some(selectedTime => {
        // Handle special availability options
        if (selectedTime === 'Available Today') {
          const today = dayjs().startOf('day');
          return doctor.timeSlots?.some(slot => {
            const slotDate = dayjs(capitalizeMonth(slot.date) + ' ' + dayjs().year(), 'DD MMMM YYYY');
            return slotDate.isSame(today, 'day') && slot.availableSlots > 0;
          });
        }

        if (selectedTime === 'Available Tomorrow') {
          const tomorrow = dayjs().add(1, 'day').startOf('day');
          return doctor.timeSlots?.some(slot => {
            const slotDate = dayjs(capitalizeMonth(slot.date) + ' ' + dayjs().year(), 'DD MMMM YYYY');
            return slotDate.isSame(tomorrow, 'day') && slot.availableSlots > 0;
          });
        }

        if (selectedTime === 'Weekend Available') {
          return doctor.timeSlots?.some(slot => {
            const slotDate = dayjs(capitalizeMonth(slot.date) + ' ' + dayjs().year(), 'DD MMMM YYYY');
            const dayOfWeek = slotDate.day(); // 0 = Sunday, 6 = Saturday
            return (dayOfWeek === 0 || dayOfWeek === 6) && slot.availableSlots > 0;
          });
        }

        // Handle specific time slots
        return doctor.timeSlots?.some(slot => {
          const morningSlots = slot.sessions.morning || [];
          const eveningSlots = slot.sessions.evening || [];
          return (morningSlots.includes(selectedTime) || eveningSlots.includes(selectedTime)) && slot.availableSlots > 0;
        });
      });

      return matchesService && matchesStars && matchesPrice && matchesTiming;
    })
  );
  // Fix modal scroll lock and ReferenceError
  useEffect(() => {
    if (showCalendarModal || showAuthModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showCalendarModal, showAuthModal]);

  useEffect(() => {
    if (suggestions.length === 0) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(target) &&
        suggestionsDropdownRef.current &&
        !suggestionsDropdownRef.current.contains(target) &&
        // Don't close if clicking on search results
        !(target as Element).closest('[data-search-results]')
      ) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [suggestions]);

  // Helper function to label slot dates as Today, Tomorrow, or the actual date
  function capitalizeMonth(dateStr: string) {
    return dateStr.replace(/\b([a-z])/g, (match, p1, offset) => {
      if (offset > 0 && dateStr[offset - 1] === " ") {
        return p1.toUpperCase();
      }
      return match;
    });
  }

  // Helper to filter out past slots
  function isTodayOrFuture(slotDateStr: string) {
    const slotDate = dayjs(
      capitalizeMonth(slotDateStr) + " " + dayjs().year(),
      "DD MMMM YYYY"
    );
    const today = dayjs().startOf("day");
    return (
      slotDate.isValid() &&
      (slotDate.isSame(today, "day") || slotDate.isAfter(today, "day"))
    );
  }

  // Helper function to sort time slots by date
  const sortTimeSlotsByDate = (
    timeSlots: {
      date: string;
      availableSlots: number;
      sessions: { morning: string[]; evening: string[] };
    }[]
  ) => {
    if (!timeSlots || !Array.isArray(timeSlots)) return [];

    return [...timeSlots].sort((a, b) => {
      const dateA = dayjs(
        capitalizeMonth(a.date) + " " + dayjs().year(),
        "DD MMMM YYYY"
      );
      const dateB = dayjs(
        capitalizeMonth(b.date) + " " + dayjs().year(),
        "DD MMMM YYYY"
      );

      // Handle invalid dates by putting them at the end
      if (!dateA.isValid() && !dateB.isValid()) return 0;
      if (!dateA.isValid()) return 1;
      if (!dateB.isValid()) return -1;

      return dateA.valueOf() - dateB.valueOf();
    });
  };

  // CalendarModal component defined inside to access helper functions
  const CalendarModal = ({
    doctor,
    onClose,
  }: {
    doctor: Doctor;
    onClose: () => void;
  }) => {
    const futureSlots = sortTimeSlotsByDate(
      doctor.timeSlots?.filter((ts) => isTodayOrFuture(ts.date)) || []
    );
    const today = dayjs().startOf("day");
    const hasTodaySlot = futureSlots.some((ts) => {
      const slotDate = dayjs(
        capitalizeMonth(ts.date) + " " + dayjs().year(),
        "DD MMMM YYYY"
      );
      return slotDate.isSame(today, "day") && ts.availableSlots > 0;
    });

    return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ overflow: "hidden" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Available Appointments
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-105"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              {doctor.user.name}
            </h3>
            <p className="text-blue-600 font-medium">{doctor.degree}</p>
          </div>

            {futureSlots.length > 0 ? (
                <div className="space-y-4">
                  {futureSlots.map((timeSlot, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-2xl p-5 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-800 text-lg">
                          {(() => {
                            const slotDate = dayjs(
                              capitalizeMonth(timeSlot.date) +
                              " " +
                              dayjs().year(),
                              "DD MMMM YYYY"
                            );
                            const today = dayjs().startOf("day");
                            const tomorrow = today.add(1, "day");
                            if (slotDate.isSame(today, "day")) return "Today";
                            if (slotDate.isSame(tomorrow, "day"))
                              return "Tomorrow";
                            return slotDate.isValid()
                              ? slotDate.format("DD MMMM")
                              : timeSlot.date;
                          })()}
                        </h4>
                        <span className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:scale-105 font-medium shadow-sm"
                        >
                          {timeSlot.availableSlots} slots available
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {timeSlot.sessions.morning?.length > 0 && (
                          <div>
                            <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              Morning
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {timeSlot.sessions.morning.map(
                                (slot: string, slotIndex: number) => (
                                  <button
                                    key={slotIndex}
                                    className="px-4 py-2 bg-blue-50 text-blue-800 rounded-full text-sm border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:scale-105 font-medium shadow-sm"
                                  >
                                    {slot}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {timeSlot.sessions.evening?.length > 0 && (
                          <div>
                            <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              Evening
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {timeSlot.sessions.evening.map(
                                (slot: string, slotIndex: number) => (
                                  <button
                                    key={slotIndex}
                                    className="px-4 py-2 bg-orange-50 text-orange-800 rounded-full text-sm border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:scale-105 font-medium shadow-sm"
                                  >
                                    {slot}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {hasTodaySlot && (
                    <div className="text-center py-4">
                      <span className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold text-lg border border-green-200">
                        Available Today
                      </span>
                    </div>
                  )}
                </div>
            ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg">
                    No time slots available
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Please check back later
                  </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
  };

  return (
    <div>
      <Head>
        <title>ZEVA Doctor Search - Find Trusted Ayurveda Doctors &amp; Medical Specialists</title>
        <meta name="description" content="Discover verified Ayurveda doctors and medical specialists with transparent consultation fees, patient reviews, and appointment availability. Search by location, specialty, or doctor name to find the best healthcare providers near you." />
        <meta name="keywords" content="Ayurveda doctors, medical specialists, doctor search, healthcare professionals, Ayurveda physicians, doctor directory, medical practitioners, ZEVA healthcare, find doctors" />
        <meta property="og:title" content="ZEVA Doctor Search - Find Trusted Ayurveda Doctors" />
        <meta property="og:description" content="Your trusted platform for finding authentic Ayurveda doctors. Search verified medical professionals with transparent fees and patient reviews." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ZEVA Doctor Search" />
        <meta name="twitter:description" content="Find trusted Ayurveda doctors and medical specialists with transparent consultation fees and verified reviews." />
        <link rel="canonical" href="https://zevahealthcare.com/doctor/search" />
      </Head>
      <div className="min-h-screen bg-[#f8fafc]">
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {showCalendarModal && selectedDoctor && (
        <CalendarModal
          doctor={selectedDoctor}
          onClose={() => setShowCalendarModal(false)}
        />
      )}

      {/* Professional Header Section */}
      <div className="w-full bg-gradient-to-br from-white via-[#f8fafc] to-[#f0f7ff] border-b border-[#e2e8f0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Professional Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mr-3 bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] shadow-lg">
                <Stethoscope className="w-6 h-6 text-white" />
                </div>
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1e293b] tracking-tight">
                  ZEVA Doctor Directory
                </h1>
                <p className="text-xs sm:text-sm text-[#64748b] mt-0.5">
                  Trusted Ayurveda Doctors & Medical Specialists
                </p>
              </div>
            </div>
            <p className="text-sm sm:text-base text-[#475569] max-w-2xl mx-auto mt-3">
              Discover verified Ayurveda doctors with transparent consultation fees, authentic treatments, and patient reviews
              </p>
            </div>


          {/* Professional Search Interface */}
          <div className="w-full max-w-6xl mx-auto">
            <div className="rounded-2xl p-4 sm:p-5 shadow-lg border border-[#e2e8f0] bg-white backdrop-blur-sm mb-6">
                {/* Desktop Layout */}
              <div className="hidden md:flex gap-3 items-center">
                {/* Search Input */}
                <div className="relative flex-1 max-w-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Search className="h-5 w-5 text-[#0284c7]" />
                    </div>
                    <input
                      type="text"
                    placeholder="Search doctors, specialties, or treatments..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        fetchSuggestions(e.target.value);
                      }}
                      onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full pl-11 pr-4 py-3 text-[#1e293b] rounded-xl focus:ring-2 focus:ring-[#0284c7] focus:border-[#0284c7] transition-all placeholder:text-[#94a3b8] text-sm border-2 border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                      ref={searchInputRef}
                    />
                    {/* Desktop Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                      <div
                      className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-lg max-h-80 overflow-auto"
                        ref={suggestionsDropdownRef}
                      >
                        <div className="p-2">
                          {suggestions.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-center px-4 py-4 hover:bg-[#2D9AA5]/10 cursor-pointer transition-all duration-200 border-b border-gray-100/50 last:border-b-0 rounded-xl mx-1 group"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                clearPersistedState();
                                setSelectedService(s.value);
                                setQuery(s.value);
                                setSuggestions([]);
                                searchInputRef.current?.blur();
                                if (coords) {
                                  fetchDoctors(coords.lat, coords.lng, s.value);
                                } else if (manualPlace.trim()) {
                                  searchByPlace();
                                }
                              }}
                            >
                              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2D9AA5]/20 to-[#2D9AA5]/30 flex items-center justify-center mr-4">
                                <span className="text-lg">
                                  {s.type === "clinic"
                                    ? "🏥"
                                    : s.type === "treatment"
                                      ? "💊"
                                      : "👨‍⚕️"}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 group-hover:text-[#2D9AA5] transition-colors text-sm xl:text-base truncate">
                                  {s.value}
                                </p>
                                <p className="text-xs xl:text-sm text-gray-500 capitalize font-medium">
                                  {s.type}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                {/* Separator */}
                <div className="h-10 w-px bg-gradient-to-b from-transparent via-[#cbd5e1] to-transparent"></div>

                {/* Location Input */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <MapPin className="h-5 w-5 text-[#0284c7]" />
                    </div>
                    <input
                    placeholder="Enter city, area, or landmark..."
                      value={manualPlace}
                      onChange={(e) => setManualPlace(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && searchByPlace()}
                    className="w-full pl-11 pr-4 py-3 text-[#1e293b] rounded-xl focus:ring-2 focus:ring-[#0284c7] focus:border-[#0284c7] transition-all placeholder:text-[#94a3b8] text-sm border-2 border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                  />
                  </div>

                {/* Near Me Button */}
                  <button
                    onClick={locateMe}
                    disabled={loading}
                  className="flex items-center px-4 py-3 bg-[#f8fafc] text-[#475569] rounded-xl hover:bg-[#f1f5f9] transition-all text-sm font-medium border-2 border-[#e2e8f0] hover:border-[#cbd5e1] disabled:opacity-50 shadow-sm"
                  title="Use Current Location"
                  >
                  <Navigation className="w-4 h-4 mr-1.5" />
                  <span className="hidden lg:inline">Near Me</span>
                  </button>

                {/* Search Button */}
                  <button
                    onClick={handleSearch}
                  className="px-6 py-3 text-white rounded-xl font-semibold bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] transition-all text-sm shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    Search
                  </button>
                </div>

                {/* Mobile Layout */}
              <div className="md:hidden space-y-3">
                {/* Search Input with Near Me */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <Search className="h-5 w-5 text-[#0284c7]" />
                      </div>
                      <input
                        type="text"
                      placeholder="Search doctors or specialties..."
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          fetchSuggestions(e.target.value);
                        }}
                        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                      className="w-full pl-11 pr-3 py-3 text-[#1e293b] rounded-xl focus:ring-2 focus:ring-[#0284c7] focus:border-[#0284c7] transition-all placeholder:text-[#94a3b8] text-sm border-2 border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                        ref={searchInputRef}
                      />
                      {/* Mobile Suggestions Dropdown */}
                      {suggestions.length > 0 && (
                        <div
                        className="absolute top-full left-0 right-0 z-[9999] mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-lg max-h-60 overflow-auto"
                          ref={suggestionsDropdownRef}
                        >
                          <div className="p-1 sm:p-2">
                            {suggestions.map((s, i) => (
                              <div
                                key={i}
                              className="flex items-center px-3 py-3 hover:bg-[#f0f7ff] cursor-pointer transition-all border-b border-[#f1f5f9] last:border-b-0 rounded-lg mx-1"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                  clearPersistedState();
                                  setSelectedService(s.value);
                                  setQuery(s.value);
                                  setSuggestions([]);
                                searchInputRef.current?.blur();
                                if (coords) {
                                    fetchDoctors(coords.lat, coords.lng, s.value);
                                } else if (manualPlace.trim()) {
                                  searchByPlace();
                                }
                              }}
                            >
                                <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[#1e293b] text-sm truncate">
                                    {s.value}
                                  </p>
                                <p className="text-xs text-[#64748b] capitalize">
                                    {s.type}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  {/* Near Me Button for Mobile */}
                    <button
                      type="button"
                      onClick={locateMe}
                      disabled={loading}
                    className="flex items-center justify-center px-3 py-3 bg-[#f8fafc] text-[#475569] rounded-xl hover:bg-[#f1f5f9] transition-all flex-shrink-0 border-2 border-[#e2e8f0] hover:border-[#cbd5e1] disabled:opacity-50 shadow-sm"
                    title="Use Current Location"
                    >
                    <Navigation className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Location Input */}
                  <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <MapPin className="h-5 w-5 text-[#0284c7]" />
                    </div>
                    <input
                    placeholder="Enter city, area, or landmark..."
                      value={manualPlace}
                      onChange={(e) => setManualPlace(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && searchByPlace()}
                    className="w-full pl-11 pr-3 py-3 text-[#1e293b] rounded-xl focus:ring-2 focus:ring-[#0284c7] focus:border-[#0284c7] transition-all placeholder:text-[#94a3b8] text-sm border-2 border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                  />
                  </div>

                  {/* Mobile Search Button */}
                    <button
                      onClick={handleSearch}
                  className="w-full px-6 py-3 text-white rounded-xl font-semibold bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] shadow-md hover:shadow-lg transition-all text-sm"
                    >
                  Search Doctors
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>

      {/* Results Section - Always rendered to prevent collapsing */}
      <div className="w-full bg-gradient-to-b from-[#f8fafc] to-white" data-search-results style={{ minHeight: '400px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 pb-6" ref={resultsRef}>
          {doctors.length > 0 ? (
            <div className="flex flex-col lg:flex-row gap-4">
            {/* Filters Sidebar */}
            <div className="lg:w-1/4">
                <div className="bg-white rounded-xl shadow-md border-2 border-[#e2e8f0] p-4 sticky top-4">
                {/* Price Range Filter */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-[#1e293b] mb-3 flex items-center">
                      <BadgeIndianRupee className="w-4 h-4 mr-1.5 text-[#0284c7]" />
                      Price Range
                    </h3>
                  <div className="px-2">
                    {/* Price Display */}
                    <div className="flex justify-between items-center mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Min Price</p>
                        <p className="text-lg font-bold text-blue-500">₹ {priceRange[0].toLocaleString()}</p>
                      </div>
                      <div className="w-px h-8 bg-gray-300"></div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Max Price</p>
                        <p className="text-lg font-bold text-blue-500">₹ {priceRange[1].toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Separate Range Sliders */}
                    <div className="space-y-4">
                      {/* Min Price Slider */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Minimum Price: ₹{priceRange[0].toLocaleString()}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="10000"
                          value={priceRange[0]}
                          onChange={(e) => {
                            const newMin = parseInt(e.target.value);
                            if (newMin < priceRange[1]) {
                              setPriceRange([newMin, priceRange[1]]);
                            }
                          }}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                          style={{
                            background: `linear-gradient(to right, #2D9AA5 0%, #2D9AA5 ${(priceRange[0] / 10000) * 100}%, #e5e7eb ${(priceRange[0] / 10000) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>

                      {/* Max Price Slider */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum Price: ₹{priceRange[1].toLocaleString()}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="10000"
                          value={priceRange[1]}
                          onChange={(e) => {
                            const newMax = parseInt(e.target.value);
                            if (newMax > priceRange[0]) {
                              setPriceRange([priceRange[0], newMax]);
                            }
                          }}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                          style={{
                            background: `linear-gradient(to right, #2D9AA5 0%, #2D9AA5 ${(priceRange[1] / 10000) * 100}%, #e5e7eb ${(priceRange[1] / 10000) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>
                    </div>

                    {/* Price Labels */}
                    <div className="flex justify-between text-xs text-gray-500 mt-3">
                      <span>₹0</span>
                      <span>₹10,000</span>
                    </div>
                  </div>
                </div>

                {/* Sort By Filter */}
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-[#1e293b] mb-3 flex items-center">
                      <Clock className="w-4 h-4 mr-1.5 text-[#0284c7]" />
                      Sort By
                    </h3>
                  <div className="space-y-2">
                    {[
                      { value: 'relevance', label: 'Relevance' },
                      { value: 'price-low-high', label: 'Price: Low to High' },
                      { value: 'price-high-low', label: 'Price: High to Low' },
                        { value: 'rating-high-low', label: 'Highest Rated' },
                        { value: 'experience-high-low', label: 'Most Experienced' }
                    ].map((option) => (
                        <label key={option.value} className="flex items-center cursor-pointer hover:bg-[#f8fafc] p-1.5 rounded transition-colors">
                        <input
                          type="radio"
                          name="sortBy"
                          value={option.value}
                          checked={sortBy === option.value}
                          onChange={(e) => setSortBy(e.target.value)}
                            className="w-4 h-4 text-[#0284c7] bg-white border-[#cbd5e1] focus:ring-[#0284c7] focus:ring-2"
                          />
                          <span className="ml-2 text-xs text-[#475569] font-medium">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Star Rating Filter */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-[#1e293b] mb-3 flex items-center">
                      <Star className="w-4 h-4 mr-1.5 text-[#0284c7]" />
                      Minimum Rating
                    </h3>
                  <div className="space-y-2">
                      {[5, 4, 3].map((rating) => (
                        <label key={rating} className="flex items-center cursor-pointer hover:bg-[#f8fafc] p-1.5 rounded transition-colors">
                        <input
                          type="radio"
                          name="rating"
                          value={rating}
                          checked={starFilter === rating}
                          onChange={(e) => setStarFilter(parseInt(e.target.value))}
                            className="w-4 h-4 text-[#0284c7] bg-white border-[#cbd5e1] focus:ring-[#0284c7] focus:ring-2"
                        />
                        <div className="ml-2 flex items-center">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                  className={`w-3.5 h-3.5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-[#cbd5e1]'}`}
                              />
                            ))}
                          </div>
                            <span className="ml-2 text-xs text-[#475569] font-medium">& above</span>
                        </div>
                      </label>
                    ))}
                      <label className="flex items-center cursor-pointer hover:bg-[#f8fafc] p-1.5 rounded transition-colors">
                      <input
                        type="radio"
                        name="rating"
                        value={0}
                        checked={starFilter === 0}
                        onChange={(e) => setStarFilter(parseInt(e.target.value))}
                          className="w-4 h-4 text-[#0284c7] bg-white border-[#cbd5e1] focus:ring-[#0284c7] focus:ring-2"
                      />
                        <span className="ml-2 text-xs text-[#475569] font-medium">All Ratings</span>
                    </label>
                  </div>
                </div>

                {/* Clear Filters Button */}
                  <div className="pt-3 border-t border-[#e2e8f0]">
                  <button
                    onClick={clearFilters}
                      className="w-full px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c] transition-all text-xs font-semibold shadow-sm hover:shadow"
                  >
                      Clear All Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Doctors List */}
            <div className="lg:w-3/4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1e293b] mb-1">
                      {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Doctor' : 'Doctors'} Found
                  </h2>
                  {selectedService && (
                      <p className="text-sm text-[#64748b] flex items-center">
                        <span className="w-1.5 h-1.5 bg-[#0284c7] rounded-full mr-1.5"></span>
                        Showing results for &quot;<span className="font-medium text-[#0284c7]">{selectedService}</span>&quot;
                    </p>
                  )}
                </div>

                  {doctors.length > 0 && (
                    <button
                      onClick={clearSearch}
                      className="px-4 py-2 rounded-lg border-2 border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all text-sm font-medium flex items-center shadow-sm"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      Clear Search
                    </button>
                  )}
              </div>

              {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#e2e8f0] border-t-[#0284c7]"></div>
                    <span className="ml-3 text-[#475569] text-xs">Searching...</span>
                </div>
              ) : filteredDoctors.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 sm:p-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 rounded-full bg-[#f0f7ff] flex items-center justify-center mx-auto mb-3">
                        <Search className="w-8 h-8 text-[#0284c7]" />
                  </div>
                      <h3 className="text-lg sm:text-xl font-bold text-[#1e293b] mb-2">
                        No Doctors Found
                  </h3>
                      <p className="text-sm text-[#64748b] mb-1">
                        Try adjusting your search criteria or filters
                      </p>
                    </div>
                    
                    {/* Professional ZEVA Doctors Information Section */}
                    <div className="bg-gradient-to-br from-[#f0f7ff] via-[#e0f2fe] to-[#bae6fd] rounded-xl p-6 sm:p-8 border border-[#cbd5e1] shadow-sm">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] flex items-center justify-center mr-3 shadow-md">
                          <Stethoscope className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#1e293b]">
                            ZEVA Healthcare Trust
                          </h2>
                          <p className="text-xs sm:text-sm text-[#64748b] mt-0.5">
                            Your Trusted Ayurveda Doctor Platform
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-white/50">
                          <div className="flex items-start mb-2">
                            <Shield className="w-5 h-5 text-[#0284c7] mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-bold text-[#1e293b] mb-1">Verified Doctors</h3>
                              <p className="text-xs text-[#475569] leading-relaxed">
                                All listed doctors are verified and authenticated Ayurveda practitioners with proper certifications and medical credentials
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-white/50">
                          <div className="flex items-start mb-2">
                            <Star className="w-5 h-5 text-[#0284c7] mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-bold text-[#1e293b] mb-1">Patient Reviews</h3>
                              <p className="text-xs text-[#475569] leading-relaxed">
                                Real patient reviews and ratings help you make informed decisions about your healthcare provider
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-white/50">
                          <div className="flex items-start mb-2">
                            <BadgeIndianRupee className="w-5 h-5 text-[#0284c7] mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-bold text-[#1e293b] mb-1">Transparent Fees</h3>
                              <p className="text-xs text-[#475569] leading-relaxed">
                                Clear consultation fees displayed upfront - no hidden charges or surprise costs
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-white/50">
                          <div className="flex items-start mb-2">
                            <Clock className="w-5 h-5 text-[#0284c7] mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-bold text-[#1e293b] mb-1">Appointment Availability</h3>
                              <p className="text-xs text-[#475569] leading-relaxed">
                                View real-time appointment slots and availability to book consultations easily
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-5 border border-white/50">
                        <h3 className="text-base font-bold text-[#1e293b] mb-3 text-center">Why Choose ZEVA Doctors?</h3>
                        <div className="grid sm:grid-cols-2 gap-3 text-xs text-[#475569]">
                          <div className="flex items-start">
                            <span className="text-[#0284c7] font-bold mr-2 text-base">•</span>
                            <span>Authentic Ayurveda treatments from certified and experienced medical practitioners</span>
                          </div>
                          <div className="flex items-start">
                            <span className="text-[#0284c7] font-bold mr-2 text-base">•</span>
                            <span>Comprehensive doctor profiles with qualifications, experience, and specializations</span>
                          </div>
                          <div className="flex items-start">
                            <span className="text-[#0284c7] font-bold mr-2 text-base">•</span>
                            <span>Advanced search filters for consultation fees, ratings, experience, and availability</span>
                          </div>
                          <div className="flex items-start">
                            <span className="text-[#0284c7] font-bold mr-2 text-base">•</span>
                            <span>Secure enquiry and appointment booking system ensuring patient privacy</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-5 pt-5 border-t border-[#cbd5e1]">
                        <p className="text-sm text-[#475569] text-center leading-relaxed">
                          <strong className="text-[#1e293b]">Search Tip:</strong> Try searching by location (city, area), specialty (Panchakarma, Abhyanga), or doctor name to discover the best Ayurveda healthcare professionals in your area.
                        </p>
                      </div>
                    </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDoctors.map((doctor, index) => {
                    const hasRating = doctorReviews[doctor._id]?.totalReviews > 0;
                    const reviewsLoaded = doctorReviews[doctor._id] !== undefined;
                    const isLoadingReviews = reviewsLoading[doctor._id];

                    return (
                      <div
                        key={index}
                        className="bg-white rounded-xl shadow-md border-2 border-[#e2e8f0] overflow-hidden hover:shadow-lg hover:border-[#0284c7] transition-all duration-300 group"
                      >
                        {/* Doctor Image */}
                        <div className="relative h-24 w-full bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] overflow-hidden">
                          {doctor.photos?.[0] ? (
                            <Image
                              src={doctor.photos[0]}
                              alt={doctor.user?.name || "Doctor Image"}
                              fill
                              className="object-contain object-center group-hover:scale-105 transition-transform duration-300 bg-white"
                            />

                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                  <svg
                                    className="w-8 h-8 text-blue-600"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                  </svg>
                                </div>
                                <span className="text-sm text-blue-600 font-medium">
                                  {doctor.user?.name?.split(" ")[0]}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Overlay badges */}
                          <div className="absolute top-1.5 right-1.5">
                            {doctor.verified && (
                              <div className="bg-[#059669] text-white px-1 py-0.5 rounded text-xs font-medium flex items-center">
                                <Shield className="w-2 h-2 mr-0.5" />
                                ✓
                              </div>
                            )}
                          </div>

                          {doctor.distance && (
                            <div className="absolute bottom-1.5 left-1.5 bg-[#0284c7] text-white px-1 py-0.5 rounded text-xs font-medium flex items-center">
                              <Navigation className="w-2 h-2 mr-0.5" />
                              {formatDistance(doctor.distance)}
                            </div>
                          )}
                        </div>

                        {/* Doctor Info */}
                        <div className="p-3">
                        {/* Rating */}
                          <div className="flex items-center gap-1.5 mb-2">
                          {isLoadingReviews ? (
                              <span className="text-xs text-[#64748b]">Loading...</span>
                          ) : hasRating ? (
                            <>
                              <div className="flex">
                                {renderStars(doctorReviews[doctor._id].averageRating)}
                              </div>
                                <span className="text-xs font-semibold text-[#1e293b]">
                                {doctorReviews[doctor._id].averageRating.toFixed(1)}
                              </span>
                                <span className="text-xs text-[#64748b]">
                                  ({doctorReviews[doctor._id].totalReviews} reviews)
                              </span>
                            </>
                          ) : reviewsLoaded ? (
                              <span className="text-xs text-[#64748b]">No reviews yet</span>
                          ) : null}
                        </div>

                          {/* Doctor basic info */}
                          <h3 className="text-sm font-bold text-[#1e293b] leading-tight mb-1.5 line-clamp-1 group-hover:text-[#0284c7] transition-colors">
                              {doctor.user?.name}
                            </h3>
                          <p className="text-[#0284c7] font-medium text-xs mb-1">
                              {doctor.degree}
                            </p>
                          <p className="text-[#64748b] text-xs line-clamp-2 mb-2 leading-relaxed">
                              {doctor.address}
                            </p>

                          {/* Experience and Fee */}
                          <div className="flex justify-between items-center mb-2 pt-2 border-t border-[#f1f5f9]">
                            <div>
                              <p className="text-xs text-[#64748b] mb-0.5">Experience</p>
                              <p className="text-xs font-semibold text-[#1e293b]">
                                {doctor.experience} years
                              </p>
                            </div>
                            {typeof doctor.consultationFee === "number" && doctor.consultationFee > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-[#64748b] mb-0.5">Consultation</p>
                                <p className="text-sm font-bold text-[#0284c7]">
                                  AED {doctor.consultationFee}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Availability */}
                          <div className="mb-3">
                            {(() => {
                              const today = dayjs().startOf("day");
                              const todaySlot = doctor.timeSlots && doctor.timeSlots.find((ts) => {
                                const slotDate = dayjs(
                                  capitalizeMonth(ts.date) + " " + dayjs().year(),
                                  "DD MMMM YYYY"
                                );
                                return slotDate.isSame(today, "day");
                              });

                              if (!doctor.timeSlots || doctor.timeSlots.length === 0) {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-md font-medium text-xs">
                                    ✗ No appointments
                                  </span>
                                );
                              } else if (todaySlot && todaySlot.availableSlots > 0) {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-md font-medium text-xs">
                                    ✓ Available today
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-md font-medium text-xs">
                                    ✗ No appointment today
                                  </span>
                                );
                              }
                            })()}
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {doctor.location?.coordinates?.length === 2 && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${doctor.location.coordinates[1]},${doctor.location.coordinates[0]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center px-2.5 py-1.5 bg-[#0284c7] text-white rounded-lg hover:bg-[#0369a1] transition-all text-xs shadow-sm hover:shadow"
                                title="Get Directions"
                              >
                                <Navigation className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden sm:inline">Directions</span>
                              </a>
                            )}

                            {/* View Full Details */}
                            <a
                              href={`/doctor/${doctor._id}`}
                              className="flex-1 flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white rounded-lg transition-all text-xs font-medium shadow-sm hover:shadow"
                            >
                              View Details
                            </a>
                          </div>

                          {/* Contact */}
                          {doctor.clinicContact && (
                            <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
                              <a
                                href={`tel:${doctor.clinicContact}`}
                                className="flex items-center justify-center text-xs text-[#64748b] hover:text-[#059669] transition-colors font-medium"
                              >
                                <Phone className="w-3 h-3 mr-1 text-[#059669]" />
                                {doctor.clinicContact}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (doctors.length === 0 && !loading && (selectedService || query.trim())) ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#f0f7ff] flex items-center justify-center mx-auto mb-3">
                  <Search className="w-8 h-8 text-[#0284c7]" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#1e293b] mb-2">
                  No Doctors Found
                </h3>
                <p className="text-sm text-[#64748b] mb-1">
                  Try adjusting your search criteria or filters
                </p>
              </div>
              
              {/* Professional ZEVA Doctors Information Section */}
              <div className="bg-gradient-to-br from-[#f0f7ff] via-[#e0f2fe] to-[#bae6fd] rounded-xl p-6 sm:p-8 border border-[#cbd5e1] shadow-sm">
              <div className="flex flex-col sm:flex-row items-center sm:items-start mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] flex items-center justify-center mr-0 sm:mr-4 mb-4 sm:mb-0 shadow-lg">
                  <Stethoscope className="w-8 h-8 text-white" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#1e293b] mb-2">
                    ZEVA Healthcare Trust
                  </h2>
                  <p className="text-sm sm:text-base text-[#64748b]">
                    Your trusted platform for authentic Ayurveda healthcare. We connect patients with verified doctors, ensuring quality care and transparent services.
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                  <Shield className="w-6 h-6 text-[#0284c7] mb-2" />
                  <h3 className="text-sm font-bold text-[#1e293b] mb-1">Verified Doctors</h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    All doctors are verified with proper certifications and credentials
                  </p>
                </div>
                
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                  <Star className="w-6 h-6 text-[#0284c7] mb-2" />
                  <h3 className="text-sm font-bold text-[#1e293b] mb-1">Patient Reviews</h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    Real reviews and ratings from verified patients
                  </p>
                </div>
                
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                  <BadgeIndianRupee className="w-6 h-6 text-[#0284c7] mb-2" />
                  <h3 className="text-sm font-bold text-[#1e293b] mb-1">Transparent Fees</h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    Clear consultation fees with no hidden charges
                  </p>
                </div>
                
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                  <Clock className="w-6 h-6 text-[#0284c7] mb-2" />
                  <h3 className="text-sm font-bold text-[#1e293b] mb-1">Easy Booking</h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    View availability and book appointments easily
                  </p>
                </div>
              </div>
              
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-5 border border-white/50">
                <h3 className="text-lg font-bold text-[#1e293b] mb-4 text-center">Why Trust ZEVA Doctors?</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-[#475569]">
                  <div className="flex items-start">
                    <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                    <span>Authentic Ayurveda treatments from certified and experienced medical practitioners</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                    <span>Comprehensive doctor profiles with qualifications, experience, and specializations</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                    <span>Advanced search filters for consultation fees, ratings, and availability</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                    <span>Secure enquiry and appointment booking system ensuring patient privacy and safety</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-[#cbd5e1]">
                <p className="text-sm text-[#475569] text-center leading-relaxed max-w-3xl mx-auto">
                  <strong className="text-[#1e293b]">Get Started:</strong> Enter your location or use the "Near Me" feature to find verified Ayurveda doctors. You can search by specialty (Panchakarma, Abhyanga), doctor name, or browse by location to discover the best healthcare professionals near you.
                </p>
              </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={locateMe}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1e293b] to-[#0f172a] text-white text-sm font-semibold hover:from-[#0f172a] hover:to-[#1e293b] transition-all shadow-md hover:shadow-lg flex items-center"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Use Near Me
                </button>
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="px-6 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] text-sm font-semibold hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all"
                >
                  Start Searching
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8 sm:p-12">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#f0f7ff] to-[#e0f2fe] flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Stethoscope className="w-10 h-10 text-[#0284c7]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#1e293b] mb-3">
                  Welcome to ZEVA Doctor Directory
                </h2>
                <p className="text-base text-[#475569] max-w-2xl mx-auto mb-6">
                  Discover trusted Ayurveda doctors and medical specialists in your area. Search by location, specialty, or doctor name to find the best healthcare providers.
                </p>
              </div>
              
              {/* Professional ZEVA Information Section */}
              <div className="bg-gradient-to-br from-[#f0f7ff] via-[#e0f2fe] to-[#bae6fd] rounded-xl p-6 sm:p-8 border border-[#cbd5e1] shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] flex items-center justify-center mr-0 sm:mr-4 mb-4 sm:mb-0 shadow-lg">
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#1e293b] mb-2">
                      ZEVA Healthcare Trust
                    </h2>
                    <p className="text-sm sm:text-base text-[#64748b]">
                      Your trusted platform for authentic Ayurveda healthcare. We connect patients with verified doctors, ensuring quality care and transparent services.
                    </p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                    <Shield className="w-6 h-6 text-[#0284c7] mb-2" />
                    <h3 className="text-sm font-bold text-[#1e293b] mb-1">Verified Doctors</h3>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      All doctors are verified with proper certifications and credentials
                    </p>
                  </div>
                  
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                    <Star className="w-6 h-6 text-[#0284c7] mb-2" />
                    <h3 className="text-sm font-bold text-[#1e293b] mb-1">Patient Reviews</h3>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Real reviews and ratings from verified patients
                    </p>
                  </div>
                  
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                    <BadgeIndianRupee className="w-6 h-6 text-[#0284c7] mb-2" />
                    <h3 className="text-sm font-bold text-[#1e293b] mb-1">Transparent Fees</h3>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Clear consultation fees with no hidden charges
                    </p>
                  </div>
                  
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
                    <Clock className="w-6 h-6 text-[#0284c7] mb-2" />
                    <h3 className="text-sm font-bold text-[#1e293b] mb-1">Easy Booking</h3>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      View availability and book appointments easily
                    </p>
                  </div>
                </div>
                
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-5 border border-white/50">
                  <h3 className="text-lg font-bold text-[#1e293b] mb-4 text-center">Why Trust ZEVA Doctors?</h3>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-[#475569]">
                    <div className="flex items-start">
                      <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                      <span>Authentic Ayurveda treatments from certified and experienced medical practitioners</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                      <span>Comprehensive doctor profiles with qualifications, experience, and specializations</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                      <span>Advanced search filters for consultation fees, ratings, and availability</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-[#0284c7] font-bold mr-2 text-lg">✓</span>
                      <span>Secure enquiry and appointment booking system ensuring patient privacy and safety</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-[#cbd5e1]">
                  <p className="text-sm text-[#475569] text-center leading-relaxed max-w-3xl mx-auto">
                    <strong className="text-[#1e293b]">Get Started:</strong> Enter your location or use the "Near Me" feature to find verified Ayurveda doctors. You can search by specialty (Panchakarma, Abhyanga), doctor name, or browse by location to discover the best healthcare professionals near you.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={locateMe}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1e293b] to-[#0f172a] text-white text-sm font-semibold hover:from-[#0f172a] hover:to-[#1e293b] transition-all shadow-md hover:shadow-lg flex items-center"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Use Near Me
                </button>
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="px-6 py-3 rounded-xl border-2 border-[#e2e8f0] text-[#475569] text-sm font-semibold hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all"
                >
                  Start Searching
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
