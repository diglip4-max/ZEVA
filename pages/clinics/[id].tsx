"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  Star,
  MessageCircle,
  Navigation,
  MapPin,
  Clock,
  Award,
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext"; // ✅ make sure this path is correct
import CalculatorGames from "../../components/CalculatorGames";
import Image from 'next/image';

interface Clinic {
  _id: string;
  name: string;
  address: string;
  photos?: string[];
  servicesName?: string[];
  treatments?: Array<{
    mainTreatment: string;
    mainTreatmentSlug?: string;
    subTreatments?: Array<{
      name: string;
      slug?: string;
      price?: number; // Added price to subTreatment interface
    }>;
  }>;
  pricing?: string;
  timings?: string;
  location?: { coordinates: [number, number] };
}

export default function ClinicDetail() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const { isAuthenticated } = useAuth(); // ✅ Auth context

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rating states
  const [clinicReviews, setClinicReviews] = useState<
    Record<string, { averageRating: number; totalReviews: number }>
  >({});
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchClinic = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`/api/clinics/${id}`);
        setClinic(res.data?.clinic || res.data?.data || res.data);
      } catch {
        setError("Failed to load clinic");
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [id]);

  useEffect(() => {
    if (!clinic?._id) return;
    const fetchReviews = async () => {
      try {
        const res = await axios.get(`/api/clinics/reviews/${clinic._id}`);
        if (res.data.success) {
          setClinicReviews((prev) => ({
            ...prev,
            [clinic._id]: res.data.data,
          }));
        }
      } catch {
        setClinicReviews((prev) => ({
          ...prev,
          [clinic._id]: {
            averageRating: 0,
            totalReviews: 0,
            reviews: [],
          },
        }));
      } finally {
        setReviewsLoaded(true);
      }
    };
    fetchReviews();
  }, [clinic?._id]);

  // ✅ Handlers moved inside so they can use router + isAuthenticated
  const handleEnquiryClick = (clinic: Clinic) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const params = new URLSearchParams({
      clinicId: clinic._id,
      clinicName: clinic.name,
      clinicAddress: clinic.address,
    });
    router.push(`/clinic/enquiry-form?${params.toString()}`);
  };

  const handleReviewClick = (clinic: Clinic) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const params = new URLSearchParams({
      clinicId: clinic._id,
      clinicName: clinic.name,
    });
    router.push(`/clinic/review-form?${params.toString()}`);
  };

  const renderStars = (rating = 4.0) => {
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#2D9AA5", borderTopColor: "transparent" }}
          ></div>
          <p className="text-lg font-medium" style={{ color: "#2D9AA5" }}>
            Loading Clinic
          </p>
        </div>
      </div>
    );
  if (error || !clinic)
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error || "Not found"}
      </div>
    );

  const hasRating = clinicReviews[clinic._id]?.totalReviews > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Profile Header Section */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-[#2D9AA5]/5 to-[#2D9AA5]/10 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Clinic Image - Left Corner */}
              {clinic.photos?.[0] && (
                <div className="w-full max-w-sm lg:max-w-xs flex-shrink-0">
                  <div className="relative w-full h-48 sm:h-56 lg:h-60 rounded-2xl overflow-hidden shadow-lg border-4 border-white bg-white">
                    <Image
                      src={clinic.photos[0]}
                      alt={clinic.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 80vw, 320px"
                      priority
                    />
                  </div>
                </div>
              )}

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  {clinic.name}
                </h1>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#2D9AA5]" />
                  <p className="text-gray-600 text-sm sm:text-base">
                    {clinic.address}
                  </p>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-3 mb-6">
                  {hasRating ? (
                    <>
                      <div className="flex items-center gap-1 bg-[#2D9AA5]/10 rounded-full px-4 py-2">
                        <div className="flex">
                          {renderStars(clinicReviews[clinic._id].averageRating)}
                        </div>
                        <span className="text-sm font-semibold ml-1 text-[#2D9AA5]">
                          {clinicReviews[clinic._id].averageRating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        ({clinicReviews[clinic._id].totalReviews} reviews)
                      </span>
                    </>
                  ) : reviewsLoaded ? (
                    <span className="text-sm text-gray-500 bg-gray-100 rounded-full px-4 py-2">
                      No reviews yet
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Sticky Bar */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-100 p-4 sm:p-6">
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <button
                onClick={() => handleEnquiryClick(clinic)}
                className="px-6 py-3 bg-gradient-to-r from-[#2D9AA5] to-[#2D9AA5]/90 text-white rounded-xl hover:from-[#2D9AA5]/90 hover:to-[#2D9AA5] transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Send Enquiry
              </button>

              <button
                onClick={() => handleReviewClick(clinic)}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                <span className="hidden sm:inline">Review</span>
              </button>

              {clinic.location?.coordinates?.length === 2 && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.location.coordinates[1]},${clinic.location.coordinates[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  <span className="hidden sm:inline">Directions</span>
                </a>
              )}
            </div>
          </div>

          {/* Profile Information Grid */}
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {clinic.timings && (
                <div className="bg-gradient-to-br from-[#2D9AA5]/10 to-[#2D9AA5]/5 p-4 rounded-xl border border-[#2D9AA5]/20 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#2D9AA5]/20 rounded-lg">
                      <Clock className="w-5 h-5 text-[#2D9AA5]" />
                    </div>
                    <h3 className="font-bold text-gray-800">Operating Hours</h3>
                  </div>
                  <p className="text-gray-700 font-medium">{clinic.timings}</p>
                </div>
              )}

              {clinic.pricing && (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-xl border border-emerald-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-200 rounded-lg">
                      <span className="text-emerald-700 font-bold text-sm">
                        AED
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800">
                      Consultation Fee
                    </h3>
                  </div>
                  <p className="text-gray-700 font-medium text-lg">
                    AED {clinic.pricing}
                  </p>
                </div>
              )}

              {/* Additional Info Card */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <Award className="w-5 h-5 text-purple-700" />
                  </div>
                  <h3 className="font-bold text-gray-800">Quick Stats</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Professional Healthcare</p>
                  <p>Licensed & Certified</p>
                </div>
              </div>
            </div>

            {/* Services Section */}
            {clinic.servicesName && clinic.servicesName.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#2D9AA5]/20 rounded-lg">
                    <Users className="w-6 h-6 text-[#2D9AA5]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Our Services
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clinic.servicesName.map((service, idx) => (
                    <div
                      key={idx}
                      className="group bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-[#2D9AA5]/30 hover:shadow-md transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-[#2D9AA5] rounded-full group-hover:scale-110 transition-transform duration-300"></div>
                        <span className="font-medium text-gray-700 group-hover:text-[#2D9AA5] transition-colors duration-300">
                          {service}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Treatments Section - Updated to show sub-treatments */}
            {clinic.treatments && clinic.treatments.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#2D9AA5]/20 rounded-lg">
                    <Calendar className="w-6 h-6 text-[#2D9AA5]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Specialized Treatments
                  </h3>
                </div>
                <div className="space-y-6">
                  {clinic.treatments.map((treatment, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-[#2D9AA5]/30 transition-all duration-300"
                    >
                      {/* Main Treatment */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 bg-[#2D9AA5] rounded-full flex-shrink-0"></div>
                        <h4 className="text-lg font-bold text-gray-800">
                          {treatment.mainTreatment}
                        </h4>
                      </div>

                      {/* Sub Treatments */}
                      {treatment.subTreatments &&
                        treatment.subTreatments.length > 0 && (
                          <div className="ml-6 space-y-3">
                            <p className="text-sm font-medium text-gray-600 mb-3">
                              Available Sub-treatments:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {treatment.subTreatments.map(
                                (subTreatment, subIdx) => (
                                  <div
                                    key={subIdx}
                                    className="group flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#2D9AA5]/40 hover:bg-[#2D9AA5]/5 transition-all duration-200"
                                  >
                                    <ChevronRight className="w-4 h-4 text-[#2D9AA5]/60 group-hover:text-[#2D9AA5] transition-colors duration-200" />
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-[#2D9AA5] transition-colors duration-200">
                                      {subTreatment.name}
                                      {subTreatment.price !== undefined &&
                                        subTreatment.price > 0 && (
                                          <>
                                            {" "}
                                            -{" "}
                                            <span className="text-[#2D9AA5] font-semibold">
                                              د.إ{subTreatment.price}
                                            </span>
                                          </>
                                        )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {/* If no sub-treatments, show description */}
                      {(!treatment.subTreatments ||
                        treatment.subTreatments.length === 0) && (
                        <div className="ml-6">
                          <p className="text-sm text-gray-600">
                            Professional treatment with experienced specialists
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-8"></div>
      <CalculatorGames />
    </div>
  );
}
