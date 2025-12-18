"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import React from "react";
import Head from "next/head";
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
      <Head>
        {/* Meta Title (55–60 characters) */}
        <title>Zeva | All-in-One Healthcare Platform to Find Doctors & Clinics</title>
        
        {/* Meta Description (150–160 characters) */}
        <meta
          name="description"
          content="Zeva is a smart healthcare platform that helps you find trusted doctors and clinics, book appointments, plan treatments, and manage your health, career, and lifestyle easily."
        />
        
        {/* Meta Keywords */}
        <meta
          name="keywords"
          content="healthcare platform, doctors online, find doctors, find clinics, book doctor appointment, medical clinics, healthcare services, online medical booking, trusted doctors, verified clinics, digital healthcare, telemedicine platform, wellness platform, health management app, treatment planning, medical consultation, appointment scheduling, doctor directory, healthcare marketplace, health services online, clinics in Dubai, doctors in Dubai, healthcare platform Dubai, medical clinics Dubai, telemedicine Dubai, health services UAE, digital healthcare Dubai, book doctor Dubai, trusted clinics Dubai"
        />
        
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content="Zeva | All-in-One Healthcare Platform to Find Doctors & Clinics" />
        <meta
          property="og:description"
          content="Zeva is a smart healthcare platform that helps you find trusted doctors and clinics, book appointments, plan treatments, and manage your health, career, and lifestyle easily."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://zeva360.com/" />
        <meta property="og:image" content="https://zeva360.com/meta/zeva-og-image.png" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Zeva | All-in-One Healthcare Platform to Find Doctors & Clinics" />
        <meta name="twitter:description" content="Zeva is a smart healthcare platform that helps you find trusted doctors and clinics, book appointments, plan treatments, and manage your health, career, and lifestyle easily." />
        
        {/* Robots */}
        <meta name="robots" content="index, follow" />
        
        {/* Sitemap Link */}
        <link rel="sitemap" type="application/xml" title="Sitemap" href="https://zeva360.com/sitemap.xml" />
      </Head>
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