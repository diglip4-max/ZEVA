"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import React from "react";
import AuthModal from "../components/AuthModal";
import Index1 from "../components/Index1";
import Blog from "../components/blog";
import MainPage from "../components/MainPage";

interface Clinic {
  _id: string;
  name: string;
  address: string;
  location?: {
    coordinates: [number, number];
  };
  verified?: boolean;
  photos?: string[];
  isDubaiPrioritized?: boolean;
  distance?: number | null;
  treatments?: Array<{
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
    }>;
  }>;
  servicesName?: string[];
  pricing?: string;
  timings?: string;
  phone?: string;
}

interface ReviewData {
  averageRating: number;
  totalReviews: number;
  reviews: unknown[];
}

export default function Home(): React.ReactElement {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode] = useState<"login" | "register">("login");
  const [pendingAction, setPendingAction] = useState<{
    type: "enquiry" | "review";
    clinic: Clinic;
  } | null>(null);

  const router = useRouter();

  const handleAuthSuccess = () => {
    setShowAuthModal(false);

    if (pendingAction) {
      if (pendingAction.type === "enquiry") {
        const params = new URLSearchParams({
          clinicId: pendingAction.clinic._id,
          clinicName: pendingAction.clinic.name,
          clinicAddress: pendingAction.clinic.address,
        });
        router.push(`/clinic/enquiry-form?${params.toString()}`);
      } else if (pendingAction.type === "review") {
        const params = new URLSearchParams({
          clinicId: pendingAction.clinic._id,
          clinicName: pendingAction.clinic.name,
        });
        router.push(`/clinic/review-form?${params.toString()}`);
      }
      setPendingAction(null);
    }
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    setPendingAction(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />
      <div className="flex items-center justify-center">
        <MainPage />
      </div>
      <Index1 />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Blog />
      </div>
    </div>
  );
}