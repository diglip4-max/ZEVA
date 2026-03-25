import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Menu, X } from "lucide-react";

const LandingHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerCls = scrolled
    ? "bg-white/95 backdrop-blur border-b border-gray-100"
    : "bg-gradient-to-br from-[#0A1F44] via-[#0D2951] to-[#0A1F44] text-white shadow-[0_4px_20px_rgba(10,31,68,0.35)]";
  const linkCls = scrolled
    ? "text-gray-700 hover:text-blue-700"
    : "text-white/90 hover:text-white";
  const brandTextCls = scrolled ? "text-gray-800" : "text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F0D98C]";
  const phoneTextCls = scrolled ? "text-gray-700" : "text-white";
  const phoneIconCls = scrolled ? "text-blue-700" : "text-white";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${headerCls}`}>
      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-20 relative">
        {/* Mobile Menu Toggle - Positioned Absolutely */}
        <div className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1.5 rounded-lg ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}
            aria-label="Toggle menu"
            type="button"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 items-center h-full gap-4 pr-12 md:pr-0">
          {/* Logo */}
          <Link href="/clinic-management-software-uae" className="flex items-center gap-2 min-w-0 flex-1 md:flex-none">
            <div className="w-9 h-9 rounded-md bg-[#F0D98C] flex-shrink-0 flex items-center justify-center text-[#0A1F44] font-bold text-sm shadow-sm">
              Z
            </div>
            <span className={`text-base font-bold truncate max-w-full ${brandTextCls}`}>
              Zeva Clinic Management System
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center justify-center gap-7 text-base">
            <Link href="/clinic-management-software-uae#features" className={linkCls}>Features</Link>
            <Link href="/clinic-management-software-uae#pricing" className={linkCls}>Pricing</Link>
            {/* <Link href="/testimonials" className={linkCls}>Testimonials</Link>
            <Link href="/resources" className={linkCls}>Resources</Link> */}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3 justify-end">
            <div className="flex items-center gap-2 text-base whitespace-nowrap">
              <Phone className={`w-5 h-5 ${phoneIconCls}`} />
              <a href="tel:+971502983757" className={phoneTextCls} aria-label="Call +971 50 298 3757">+971 50 298 3757</a>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event("zeva:open-demo-popup"))}
              className="inline-flex items-center justify-center bg-yellow-300 hover:bg-yellow-400 text-gray-900 px-4 py-2 rounded-full text-base font-semibold shadow-sm whitespace-nowrap"
              aria-label="Book Demo"
              type="button"
            >
              Book Demo
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown - Separate from Header */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-t ${scrolled ? 'bg-white border-gray-200' : 'bg-[#0A1F44] border-white/10'}`}>
          <nav className="px-4 py-4 space-y-3">
            <Link 
              href="/clinic-management-software-uae#features" 
              className={`block py-2 text-base ${linkCls}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="/clinic-management-software-uae#pricing" 
              className={`block py-2 text-base ${linkCls}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <div className={`pt-3 border-t ${scrolled ? 'border-gray-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2">
                <Phone className={`w-5 h-5 ${phoneIconCls}`} />
                <a href="tel:+971502983757" className={`text-base ${phoneTextCls}`} aria-label="Call +971 50 298 3757">
                  +971 50 298 3757
                </a>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default LandingHeader;
