import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";
import { Menu, X } from 'lucide-react';

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
      <header className="bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-50 w-full" data-auth={isAuthenticated ? "1" : "0"}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 md:py-3">
          <div className="flex items-center justify-between h-14 sm:h-16 relative">

            {/* LEFT LOGO */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-0.5 sm:gap-1">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-r from-teal-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                  Z
                </div>
                <span className="text-xs font-bold text-gray-800">
                  Zeva
                </span>
              </Link>
            </div>

            {/* CENTER NAV - Visible only on large desktop */}
            <nav className="hidden xl:flex xl:items-center gap-2 xl:gap-4 text-xs sm:text-sm text-gray-700">
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

            {/* RIGHT SIDE - AUTH BUTTONS AND HAMBURGER MENU */}
            <div className="flex items-center gap-2">
              
              {/* AUTH BUTTONS - Visible on all screens */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal("register")}
                  className="text-blue-600 text-xs sm:text-sm font-medium underline py-1 px-2"
                >
                  Login
                </button>
                <button
                  onClick={() => openAuthModal("login")}
                  className="bg-yellow-300 hover:bg-yellow-500 text-gray-900 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                >
                  Sign Up
                </button>
              </div>

              {/* HAMBURGER MENU BUTTON - Visible on mobile, tablet, and laptop (under 1280px) */}
              <button
                onClick={toggleMenu}
                className="xl:hidden p-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>

          </div>
        </div>

        {/* MENU BACKDROP - Covers entire screen when menu is open */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* MOBILE/TABLET MENU - Enhanced UI with Close Button */}
{isMenuOpen && (
  <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-2xl z-50">
    
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
      <span className="text-base font-semibold text-gray-800">
        Menu
      </span>
      <button
        onClick={() => setIsMenuOpen(false)}
        aria-label="Close menu"
        className="text-gray-600 hover:text-gray-900 text-lg leading-none"
      >
        ✕
      </button>
    </div>

    {/* Navigation */}
    <nav className="flex flex-col py-3 px-4 space-y-1 max-h-[70vh] overflow-y-auto">
      {(() => {
        const menuItems = [
        { href: "/clinic/findclinic", icon: "🏥", label: "Find Clinics" },
        { href: "/doctor/search", icon: "👨‍⚕️", label: "Find Doctors" },
        { href: "/about", icon: "ℹ️", label: "About" },
        { href: "/job-listings", icon: "💼", label: "Jobs" },
        { href: "/blogs/viewBlogs", icon: "📰", label: "Blogs" },
        { href: "/calculator/allcalc", icon: "🧮", label: "Calculator" },
        { href: "/contact", icon: "📞", label: "Contact" },
        { href: "/bussiness", icon: "🏢", label: "Business with Zeva" },
        { href: "/clinic/workflow-guide", icon: "❓", label: "Workflow Guide" }
      ];
      
      return menuItems.map((item: { href?: string; onClick?: () => void; icon: string; label: string }) => {
        if (item.href) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-gray-100 py-2.5 px-3 rounded-lg transition-colors duration-200 text-sm font-medium text-gray-800"
              onClick={() => {
                setIsMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <div className="flex items-center">
                <span className="text-base">{item.icon}</span>
                <span className="ml-2 text-sm">{item.label}</span>
              </div>
            </Link>
          );
        } else if (item.onClick) {
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full text-left hover:bg-gray-100 py-2.5 px-3 rounded-lg transition-colors duration-200 text-sm font-medium text-gray-800"
            >
              <div className="flex items-center">
                <span className="text-base">{item.icon}</span>
                <span className="ml-2 text-sm">{item.label}</span>
              </div>
            </button>
          );
        }
        return null;
      });
    })()}
    </nav>
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
