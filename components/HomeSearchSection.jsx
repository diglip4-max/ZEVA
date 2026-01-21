import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Search, MapPin, HeartPulse } from "lucide-react";

const HomeSearchSection = () => {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("doctor");
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchTreatments = async () => {
      if (!searchQuery || searchQuery.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      try {
        const res = await fetch(`/api/doctor/search?q=${searchQuery}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.treatments);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error("Error fetching treatments:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchTreatments();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();

    const toSlug = (s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-");

    const query = {};
    if (searchQuery) query.treatment = toSlug(searchQuery);
    if (location) query.location = toSlug(location);

    if (activeTab === "clinic") {
      router.push({ pathname: "/clinic/findclinic", query });
    } else {
      router.push({ pathname: "/doctor/search", query });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 mt-8">

      {/* Trust Badge */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white shadow-sm text-sm text-gray-700">
          <span className="text-yellow-400 text-lg">✦</span>
          <span>
            Trusted by <strong>2M+</strong> patients across India
          </span>
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <p className="text-[15px] font-medium mt-7 text-blue-700 mb-2">
          Book Trusted Clinics, Doctors & Wellness Services Near You
        </p>
        <h1 className="text-gray-600 text-[20px] sm:text-[22px] font-normal leading-relaxed mt-2">
          Appointments, teleconsultation, health records, and more — all in one place.
        </h1>
      </div>

      {/* Doctor / Clinic Tabs */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-8">
          {["doctor", "clinic"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 text-base font-medium transition-colors ${
                activeTab === tab
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-blue-600"
              }`}
            >
              {tab === "doctor" ? "Doctor" : "Clinic"}
              <span
                className={`absolute left-0 -bottom-0.5 h-[2px] w-full ${
                  activeTab === tab ? "bg-blue-600" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-14">
        <form onSubmit={handleSearch} className="space-y-8">

          {/* Search Input */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-bold text-gray-500 mb-1">
              Search for
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 w-5 h-5" />
              <input
                type="text"
                placeholder={
                  activeTab === "doctor"
                    ? "Treatment Name"
                    : "Treatment Name"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.length > 0 && searchResults.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                className="w-full pl-12 pr-4 py-6 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-80 overflow-y-auto custom-scrollbar">
                {searchResults.map((treatment, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      // If suggestion is in format "Sub (Main)", keep sub-treatment in input
                      const match = treatment.match(/^(.+?)\s*\((.+?)\)$/);
                      if (match) {
                        setSearchQuery(match[1].trim());
                      } else {
                        setSearchQuery(treatment);
                      }
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                      <HeartPulse className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{treatment}</div>
                      <div className="text-xs text-gray-500">Treatment</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location Input */}
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 w-5 h-5" />
              <input
                type="text"
                placeholder="City or Area"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-12 pr-4 py-6 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-4 rounded-xl text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            Search <span className="text-xl">→</span>
          </button>
        </form>
      </div>

      {/* Bottom CTA + Features */}
      <div className="mt-10 flex flex-col items-center gap-6">

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-700">
          {["Instant Booking", "Verified Doctors", "Secure Payments", "Digital Reports"].map(
            (item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-teal-600 text-lg">✔</span>
                <span>{item}</span>
              </div>
            )
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 mt-2">
          <button
            onClick={() => router.push("/")}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-5 py-3 rounded-xl text-lg font-medium shadow-lg flex items-center gap-3"
          >
            Book Appointment Now <span className="text-xl">→</span>
          </button>

          <button
            onClick={() => router.push("/clinic/findclinic")}
            className="border-2 border-blue-700 text-blue-700 px-5 py-3 rounded-2xl text-lg font-medium hover:bg-blue-50 transition"
          >
            Explore Clinics
          </button>
        </div>
      </div>

    </div>
  );
};

export default HomeSearchSection;
