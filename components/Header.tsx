import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";

const Header = () => {
  const { isAuthenticated } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center h-16 relative">

            {/* LEFT LOGO (same as old) */}
            <div className="absolute left-6 flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  Z
                </div>
                <span className="text-sm font-bold text-gray-800">
                  Zeva
                </span>
              </Link>
            </div>

            {/* CENTER NAV */}
            <nav className="hidden md:flex items-center gap-8 text-sm text-gray-700">
              <Link href="/clinic/findclinic" className="hover:text-blue-600">
                Find Clinics
              </Link>
                <Link href="/doctor/search" className="hover:text-blue-600">
                Find Doctors
              </Link>
              {/* <Link href="/doctor/search" className="hover:text-blue-600">
                Book Appointment
              </Link> */}
               <Link href="/about" className="hover:text-blue-600">
                About
              </Link> 
              <Link href="/job-listings" className="hover:text-blue-600">
                Jobs
              </Link>
              <Link href="/blogs/viewBlogs" className="hover:text-blue-600">
                Blogs
              </Link>
              <Link href="/calculator/allcalc" className="hover:text-blue-600">
                Calculator
              </Link>
               <Link href="/contact" className="hover:text-blue-600">
                Contact
              </Link>
               <Link href="/bussiness" className="hover:text-blue-600">
              Bussiness for Zeva
              </Link>
            </nav>

            {/* RIGHT ACTIONS */}
            {!isAuthenticated && (
              <div className="absolute right-6 flex items-center gap-5">
                <button
                  onClick={() => openAuthModal("register")}
                  className="text-blue-600 text-sm font-medium text-decoration: underline "
                >
                  Login
                </button>

                <button
                  onClick={() => openAuthModal("login")}
                  className="bg-yellow-300 hover:bg-yellow-500 text-gray-900 px-5 py-2 rounded-full text-sm font-medium shadow-md"
                >
                  Sign Up
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* AUTH MODAL (same as old behaviour) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
};

export default Header;
