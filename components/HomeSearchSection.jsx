import React, { useState } from "react";
import { useRouter } from "next/router";
import { Search, MapPin } from "lucide-react";

const HomeSearchSection = () => {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("doctor");
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();

    const toSlug = (s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-");

    const treatmentSlug = searchQuery ? toSlug(searchQuery) : "";
    const locationSlug = location ? toSlug(location) : "";

    const query = {};
    if (treatmentSlug) query.treatment = treatmentSlug;
    if (locationSlug) query.location = locationSlug;

    // 🔹 Route based on tab
    if (activeTab === "clinic") {
      router.push({
        pathname: "/clinic/findclinic",
        query,
      });
    } else {
      router.push({
        pathname: "/doctor/search",
        query,
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 mt-10">

      {/* Trust Badge */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white shadow-sm text-sm text-gray-700">
          <span className="text-blue-600 text-lg">✦</span>
          <span>
            Trusted by <strong>2M+</strong> patients across India
          </span>
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-2">
          Book Trusted Clinics, Doctors & Wellness Services Near You
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Appointments, teleconsultation, health records, and more — all in one place.
        </p>
      </div>

      {/* Doctor / Clinic Tabs */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-8">
          {["doctor", "clinic"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative pb-2 text-base font-medium transition-colors
                ${
                  activeTab === tab
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-blue-600"
                }`}
            >
              {tab === "doctor" ? "Doctor" : "Clinic"}
              <span
                className={`absolute left-0 -bottom-0.5 h-[2px] w-full transition-all
                  ${
                    activeTab === tab
                      ? "bg-blue-600"
                      : "bg-transparent group-hover:bg-blue-400"
                  }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="space-y-5">

          {/* Search Input */}
          <div>
            <label className="block text-sm  font-bold text-gray-500 mb-1">
              Search for
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 w-5 h-5" />
              <input
                type="text"
                placeholder={
                  activeTab === "doctor"
                    ? "Doctor, Specialty, or Treatment"
                    : "Clinic name or Treatment"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Location Input */}
          <div>
            <label className="block text-sm  font-bold text-gray-500 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 w-5 h-5" />
              <input
                type="text"
                placeholder="City or Area"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-3 rounded-xl text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            Search <span className="text-xl">→</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default HomeSearchSection;
