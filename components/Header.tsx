import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";

const Header = () => {
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5">
          <div className="flex items-center justify-center h-14 relative">

            {/* LEFT LOGO (same as old) */}
            <div className="absolute left-3 sm:left-6 flex items-center">
              <Link href="/" className="flex items-center gap-1 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                  Z
                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-800">
                  Zeva
                </span>
              </Link>
            </div>

            {/* CENTER NAV - Hidden on mobile, shown in hamburger menu */}
            <nav className="hidden md:flex md:items-center gap-4 lg:gap-8 text-sm text-gray-700">
              <Link href="/clinic/findclinic" className="hover:text-blue-600 px-2 py-1">
                Find Clinics
              </Link>
              <Link href="/doctor/search" className="hover:text-blue-600 px-2 py-1">
                Find Doctors
              </Link>
              <Link href="/about" className="hover:text-blue-600 px-2 py-1">
                About
              </Link>
              <Link href="/job-listings" className="hover:text-blue-600 px-2 py-1">
                Jobs
              </Link>
              <Link href="/blogs/viewBlogs" className="hover:text-blue-600 px-2 py-1">
                Blogs
              </Link>
              <Link href="/calculator/allcalc" className="hover:text-blue-600 px-2 py-1">
                Calculator
              </Link>
              <Link href="/contact" className="hover:text-blue-600 px-2 py-1">
                Contact
              </Link>
              <Link href="/bussiness" className="hover:text-blue-600 px-2 py-1">
                Business with Zeva
              </Link>
              <Link href="/clinic/workflow-guide" className="hover:text-blue-600 px-2 py-1">
                Workflow Guide
              </Link>
            </nav>

            {/* MOBILE LOGIN/SIGNUP AND HAMBURGER MENU */}
            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              
              {/* Login button */}
              <button
                onClick={() => openAuthModal("register")}
                className="md:hidden text-blue-600 text-xs font-medium underline"
                aria-label="Login"
              >
                Login
              </button>
              
              {/* Signup button */}
              <button
                onClick={() => openAuthModal("login")}
                className="md:hidden bg-yellow-300 hover:bg-yellow-500 text-gray-900 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                aria-label="Sign up"
              >
                Sign Up
              </button>
              
              {/* Hamburger menu button */}
              <button
                onClick={toggleMenu}
                id="mobile-menu-toggle"
                className="md:hidden p-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors duration-200 z-60"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* MOBILE MENU BACKDROP - Covers entire screen when menu is open */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* MOBILE MENU - Enhanced UI with Close Button */}
{isMenuOpen && (
  <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-2xl md:hidden z-50">
    
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <span className="text-lg font-semibold text-gray-800">
        
      </span>
      <button
        onClick={() => setIsMenuOpen(false)}
        aria-label="Close menu"
        className="text-gray-600 hover:text-gray-900 text-xl leading-none"
      >
        ✕
      </button>
    </div>

    {/* Navigation */}
    <nav className="flex flex-col py-3 px-4 space-y-1">
      {[
        { href: "/clinic/findclinic", icon: "🏥", label: "Find Clinics" },
        { href: "/doctor/search", icon: "👨‍⚕️", label: "Find Doctors" },
        { href: "/about", icon: "ℹ️", label: "About" },
        { href: "/job-listings", icon: "💼", label: "Jobs" },
        { href: "/blogs/viewBlogs", icon: "📰", label: "Blogs" },
        { href: "/calculator/allcalc", icon: "🧮", label: "Calculator" },
        { href: "/contact", icon: "📞", label: "Contact" },
        { href: "/bussiness", icon: "🏢", label: "Business with Zeva" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="hover:bg-gray-100 py-3 px-4 rounded-lg transition-colors duration-200 text-base font-medium text-gray-800"
          onClick={() => {
            setIsMenuOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <div className="flex items-center">
            <span>{item.icon}</span>
            <span className="ml-3">{item.label}</span>
          </div>
        </Link>
      ))}
    </nav>
  </div>
)}


        {/* DESKTOP AUTH BUTTONS - With clear spacing between buttons */}
        {!isAuthenticated && (
          <div className="absolute top-4 right-4 flex items-center space-x-4 hidden md:block">
            <button
              onClick={() => openAuthModal("register")}
              className="text-blue-600 text-sm font-medium underline"
            >
              Login
            </button>

            <button
              onClick={() => openAuthModal("login")}
              className="bg-yellow-300 hover:bg-yellow-500 text-gray-900 px-4 py-1.5 rounded-full text-sm font-medium shadow-md"
            >
              Sign Up
            </button>
          </div>
        )}
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