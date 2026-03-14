import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";

const LandingHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

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
      <div className="max-w-7xl mx-auto px-4 lg:px-6 h-20">
        <div className="grid grid-cols-3 items-center h-full">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-[#F0D98C] flex items-center justify-center text-[#0A1F44] font-bold text-sm shadow-sm">
              Z
            </div>
            <span className={`text-base font-bold ${brandTextCls}`}>Zeva</span>
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-7 text-base">
            <Link href="/clinic-management-software-uae#features" className={linkCls}>Features</Link>
            <Link href="/clinic-management-software-uae#pricing" className={linkCls}>Pricing</Link>
            <Link href="/testimonials" className={linkCls}>Testimonials</Link>
            <Link href="/resources" className={linkCls}>Resources</Link>
          </nav>

          <div className="flex items-center gap-3 justify-end">
            <div className="hidden sm:flex items-center gap-2 text-base">
              <Phone className={`w-5 h-5 ${phoneIconCls}`} />
              <a href="tel:+97144567890" className={phoneTextCls} aria-label="Call +971 4 456 7890">+971 4 456 7890</a>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event("zeva:open-demo-popup"))}
              className="inline-flex items-center justify-center bg-yellow-300 hover:bg-yellow-400 text-gray-900 px-4 py-2 rounded-full text-base font-semibold shadow-sm"
              aria-label="Book Demo"
              type="button"
            >
              Book Demo
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
