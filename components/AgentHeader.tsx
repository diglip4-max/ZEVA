import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import axios from "axios";
import NotificationBell from "./NotificationBell";
import ReceptionistChat from "./ReceptionistChat";
import { Bot, Sparkles, Search, X } from "lucide-react";
import useZevaConnect from "@/hooks/useZevaConnect";
import { useClinicTheme } from "../context/ClinicThemeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { normalizeImagePath } from "@/lib/utils";



interface ClinicHeaderProps {
  handleToggleMobile: () => void;
  isMobileOpen: boolean;
}

const ClinicHeader: React.FC<ClinicHeaderProps> = ({
  handleToggleMobile,
  isMobileOpen,
}) => {
  const { theme, toggleTheme } = useClinicTheme();
  const { currency } = useCurrency();
  const [tokenUser, setTokenUser] = useState<{
    name?: string;
    email?: string;
    photo?: string;
  } | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [receptionistOpen, setReceptionistOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [commissionCount, setCommissionCount] = useState<number>(0);
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [commissionItems, setCommissionItems] = useState<
    Array<{
      commissionId: string;
      patientName: string;
      patientMobile: string;
      invoiceNumber: string;
      invoicedDate: string | null;
      paidAmount: number;
      commissionPercent: number;
      commissionAmount: number;
      finalCommissionAmount?: number;
      doctorName: string;
    }>
  >([]);
  const walletBtnRef = useRef<HTMLButtonElement | null>(null);
  const receptionistBtnRef = useRef<HTMLButtonElement | null>(null);
  const profileBtnRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });
  const [profileDropdownPos, setProfileDropdownPos] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const [searchDropdownPos, setSearchDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const router = useRouter();
  const { handleZevaConnect } = useZevaConnect();

  // Navigation items for search (mirrors AgentSidebar)
  interface SearchNavItem {
    label: string;
    path?: string;
    icon: string;
    description?: string;
    parentLabel?: string;
    parentIcon?: string;
    onClick?: () => void;
  }
  const [navItems, setNavItems] = useState<SearchNavItem[]>([]);

  // Fetch navigation items from sidebar-permissions API (same as AgentSidebar)
  useEffect(() => {
    const fetchNavItems = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken") ||
              localStorage.getItem("userToken") || sessionStorage.getItem("userToken")
            : null;
        if (!token) return;

        const res = await axios.get("/api/agent/sidebar-permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const items: SearchNavItem[] = [];

          // Add Dashboard as first item
          items.push({ label: "Dashboard", path: "/staff/dashboard", icon: "📊", description: "Staff Dashboard" });

          const hasAnyPerm = (perms: Record<string, boolean> | null | undefined): boolean => {
            if (!perms) return false;
            return Object.values(perms).some((v) => v === true);
          };

          (res.data.navigationItems || []).forEach((mod: any) => {
            const modPerms = mod.permissions;
            const subs: any[] = mod.subModules || [];

            // Filter sub-modules by permission
            const visibleSubs = subs.filter((s: any) => hasAnyPerm(s.permissions));

            // If module has children, add each child as a searchable item
            if (visibleSubs.length > 0) {
              visibleSubs.forEach((sub: any) => {
                items.push({
                  label: sub.name,
                  path: sub.path,
                  icon: sub.icon,
                  description: sub.name,
                  parentLabel: mod.label,
                  parentIcon: mod.icon,
                  ...(sub.name === "Team Chat" ? { onClick: handleZevaConnect } : {}),
                });
              });
            } else if (mod.path && hasAnyPerm(modPerms)) {
              // Single module (no children) — add directly
              items.push({
                label: mod.label,
                path: mod.path,
                icon: mod.icon,
                description: mod.description || mod.label,
              });
            }
          });

          setNavItems(items);
        }
      } catch {
        // Silent fail
      }
    };

    fetchNavItems();
  }, []);

  // Filtered search results based on query
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return navItems
      .filter((item) => {
        const inLabel = item.label.toLowerCase().includes(q);
        const inDesc = item.description?.toLowerCase().includes(q) || false;
        const inParent = item.parentLabel?.toLowerCase().includes(q) || false;
        return inLabel || inDesc || inParent;
      })
      .slice(0, 10); // limit to 10 results
  }, [searchQuery, navItems]);


 

  const computeSearchDropdownPos = () => {
    if (typeof window === "undefined") return;
    const el = searchContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSearchDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!searchFocused) return;
    computeSearchDropdownPos();
    const handler = () => computeSearchDropdownPos();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [searchFocused]);

  const handleSearchNavigate = (item: SearchNavItem) => {
    setSearchQuery("");
    setSearchFocused(false);
    searchInputRef.current?.blur();
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      router.push(item.path);
    }
  };

  const handleLogout = async () => {
    try {
      const token =
        localStorage.getItem("agentToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("agentToken") ||
        sessionStorage.getItem("userToken");
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => { });
      }
    } finally {
      localStorage.removeItem("agentToken");
      localStorage.removeItem("userToken");
      localStorage.removeItem("agentUser");
      window.location.href = "/staff";
    }
  };

  const getUserInfo = useCallback(() => {
    if (typeof window !== "undefined") {
      // First try to get from agentUser
      const agentUserRaw =
        localStorage.getItem("agentUser") ||
        sessionStorage.getItem("agentUser");
      if (agentUserRaw) {
        try {
          const user = JSON.parse(agentUserRaw);
          setTokenUser({ name: user.name, email: user.email, photo: user.photo });
          return;
        } catch (error) {
          console.error("Error parsing agentUser:", error);
        }
      }

      // Check doctorUser fallback
      const doctorUserRaw =
        localStorage.getItem("doctorUser") ||
        sessionStorage.getItem("doctorUser");
      if (doctorUserRaw) {
        try {
          const user = JSON.parse(doctorUserRaw);
          setTokenUser({ name: user.name, email: user.email, photo: user.photo });
          return;
        } catch (error) {
          console.error("Error parsing doctorUser:", error);
        }
      }

      // Fallback: decode token if user object is not available
      const token =
        localStorage.getItem("agentToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("agentToken") ||
        sessionStorage.getItem("userToken");
      if (token) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            setTokenUser({ name: payload.name, email: payload.email, photo: payload.photo });
          }
        } catch (error) {
          console.error("Error decoding token in header:", error);
        }
      }
    }
  }, []);

  useEffect(() => {
    getUserInfo();
    const handleStorageChange = () => getUserInfo();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userProfileUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userProfileUpdated", handleStorageChange);
    };
  }, [getUserInfo]);

  const getAuthHeaders = useCallback(() => {
    if (typeof window === "undefined") return null;
    const token =
      localStorage.getItem("agentToken") || localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, []);

  const loadCommissions = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await axios.get("/api/agent/commissions/mine", { headers });
      if (res.data && res.data.success) {
        setCommissionCount(res.data.count || 0);
        setTotalCommission(res.data.totalCommission || 0);
        setCommissionItems(res.data.items || []);
      }
    } catch (err) {
      // Silent fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  const [clinicName, setClinicName] = useState<string>("");

  const loadClinicInfo = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinics/myallClinic", { headers });
      if (res.data && res.data.success && res.data.clinic?.name) {
        setClinicName(res.data.clinic.name);
      }
    } catch (err) {
      // Silent fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadCommissions();
    loadClinicInfo();
  }, [loadCommissions, loadClinicInfo]);

  const computeDropdownPos = () => {
    if (typeof window === "undefined") return;
    const btn = walletBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + 8;
    const right = Math.max(8, window.innerWidth - rect.right);
    setDropdownPos({ top, right });
  };

  const toggleWallet = () => {
    setWalletOpen((prev) => {
      const next = !prev;
      if (!prev) computeDropdownPos();
      return next;
    });
  };

  useEffect(() => {
    if (!walletOpen) return;
    const handler = () => computeDropdownPos();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [walletOpen]);

  const computeProfileDropdownPos = () => {
    if (typeof window === "undefined") return;
    const btn = profileBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + 8;
    const right = Math.max(8, window.innerWidth - rect.right);
    setProfileDropdownPos({ top, right });
  };

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen((prev) => {
      const next = !prev;
      if (!prev) computeProfileDropdownPos();
      return next;
    });
  };

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handler = () => computeProfileDropdownPos();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [profileDropdownOpen]);

  //   const getInitials = (name: string) => {
  //     return name
  //       .split(' ')
  //       .map(word => word.charAt(0).toUpperCase())
  //       .join('')
  //       .slice(0, 2);
  //   };

  return (
    <header className="w-full bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 shadow-sm flex-shrink-0">
      <div className="px-2 sm:px-4 py-1.5 sm:py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Mobile Hamburger + Brand */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger - Only visible on mobile, positioned on left */}
            <button
              onClick={handleToggleMobile}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200 flex-shrink-0 lg:hidden"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#2D9AA5] to-[#1e7d87] rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                  <div className="w-4 h-4 sm:w-6 sm:h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-[#2D9AA5] rounded-full border-2 border-white dark:border-zinc-900"></div>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent truncate">
                  {clinicName || "ZEVA"}
                </h1>
                <p className="text-[10px] sm:text-xs text-[#2D9AA5] dark:text-teal-100 font-medium -mt-0.5 truncate">
                  Healthcare Excellence
                </p>
              </div>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8" ref={searchContainerRef}>
            <div className="relative w-full">
              <div className={`flex items-center rounded-xl border transition-all duration-300 ${searchFocused ? 'border-[#2D9AA5] ring-2 ring-[#2D9AA5]/20 bg-white shadow-md' : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600'}`}>
                <div className="pl-3 pr-1 flex items-center">
                  <Search className={`w-4 h-4 transition-colors duration-300 ${searchFocused ? 'text-[#2D9AA5]' : 'text-gray-400 dark:text-zinc-500'}`} />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search modules..."
                  className="w-full py-2 pr-3 pl-1 text-sm bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                    className="pr-3 pl-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search dropdown rendered via portal to escape stacking contexts */}
              {searchFocused && typeof window !== "undefined" && createPortal(
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-[9998]"
                    onClick={() => { setSearchFocused(false); setSearchQuery(""); }}
                  />

                  {/* Results dropdown */}
                  {searchResults.length > 0 && (
                    <div
                      className="fixed bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-[9999] max-h-80 overflow-y-auto"
                      style={{
                        top: searchDropdownPos.top,
                        left: searchDropdownPos.left,
                        width: searchDropdownPos.width,
                      }}
                    >
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                        </p>
                      </div>
                      {searchResults.map((item, idx) => (
                        <button
                          key={`${item.path || item.label}-${idx}`}
                          onMouseDown={(e) => { e.preventDefault(); handleSearchNavigate(item); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left border-b border-gray-50 dark:border-zinc-800/50 last:border-b-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-base flex-shrink-0">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.label}</span>
                              {item.parentLabel && (
                                <span className="text-[10px] text-[#2D9AA5] dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                  {item.parentLabel}
                                </span>
                              )}
                            </div>
                            {item.description && item.description !== item.label && (
                              <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">{item.description}</p>
                            )}
                          </div>
                          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results message */}
                  {searchQuery.trim().length > 0 && searchResults.length === 0 && navItems.length > 0 && (
                    <div
                      className="fixed bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl p-4 z-[9999] text-center"
                      style={{
                        top: searchDropdownPos.top,
                        left: searchDropdownPos.left,
                        width: searchDropdownPos.width,
                      }}
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <Search className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No modules found</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Try a different search term</p>
                    </div>
                  )}
                </>,
                document.body,
              )}
            </div>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Wallet */}
            <div className="relative">
              <button
                ref={receptionistBtnRef}
                onClick={() => setReceptionistOpen(true)}
                className="group relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center overflow-visible rounded-xl bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#6366F1] text-white shadow-[0_4px_16px_rgba(79,70,229,0.35)] ring-1 ring-white/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_6px_20px_rgba(79,70,229,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 flex-shrink-0"
                aria-label="Open Receptionist Assistant"
                title="Receptionist Assistant"
              >
                <span className="pointer-events-none absolute inset-[1px] rounded-[11px] bg-gradient-to-b from-white/25 to-transparent" />
                <Bot
                  className="relative z-10 h-[16px] w-[16px] sm:h-[19px] sm:w-[19px] text-white transition-transform duration-300 group-hover:scale-110"
                  strokeWidth={2}
                />
                <span className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-[#D9A441] ring-2 ring-white shadow-sm">
                  <Sparkles
                    className="h-2.5 w-2.5 text-white"
                    strokeWidth={2.5}
                  />
                </span>
              </button>
            </div>
            <div className="relative">
              <button
                ref={walletBtnRef}
                onClick={toggleWallet}
                className="relative p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex-shrink-0"
                aria-label="Commission Wallet"
                title="Your commissions"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7a4 4 0 014-4h10a2 2 0 012 2v2h-7a4 4 0 00-4 4v0a4 4 0 004 4h7v2a2 2 0 01-2 2H7a4 4 0 01-4-4V7z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 11h4v4h-4a2 2 0 01-2-2v0a2 2 0 012-2z"
                  />
                </svg>
                {commissionCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                    {commissionCount}
                  </span>
                )}
              </button>
              {walletOpen &&
                typeof window !== "undefined" &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setWalletOpen(false)}
                    />
                    <div
                      className="fixed z-[9999] w-[22rem] sm:w-[24rem] bg-white border border-gray-200 rounded-lg shadow-2xl"
                      style={{
                        top: dropdownPos.top,
                        right: dropdownPos.right,
                        maxWidth: "92vw",
                      }}
                    >
                      <div className="px-3 py-2 border-b">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-gray-900">
                            Your Commissions
                          </div>
                          <div className="text-xs text-teal-700 font-semibold">
                            Total {getCurrencySymbol(currency)} {Number(totalCommission || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-auto">
                        {commissionItems.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-600">
                            No commissions yet
                          </div>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {commissionItems.map((it) => (
                              <li key={it.commissionId} className="px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-900">
                                    {it.patientName || "—"}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {it.invoiceNumber || "—"}
                                  </div>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between">
                                  <div className="text-[10px] text-gray-700">
                                    Paid {getCurrencySymbol(currency)}{" "}
                                    {Number(it.paidAmount || 0).toFixed(2)} •{" "}
                                    {Number(it.commissionPercent || 0)}%
                                  </div>
                                  <div className="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded">
                                    Commission {getCurrencySymbol(currency)}{" "}
                                    {Number(
                                      (it.finalCommissionAmount ??
                                        it.commissionAmount) ||
                                      0,
                                    ).toFixed(2)}
                                  </div>
                                </div>
                                <div className="mt-0.5 text-[10px] text-gray-500">
                                  {it.doctorName
                                    ? `Doctor: ${it.doctorName}`
                                    : ""}
                                </div>
                                <div className="mt-0.5 text-[10px] text-gray-500">
                                  {it.invoicedDate
                                    ? new Date(
                                      it.invoicedDate,
                                    ).toLocaleDateString()
                                    : ""}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
            </div>

            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:text-[#2D9AA5] hover:bg-[#2D9AA5]/10 dark:hover:bg-[#2D9AA5]/10 transition-colors duration-200 focus:outline-none flex-shrink-0 flex items-center gap-1.5"
              aria-label={`Toggle theme (current: ${theme})`}
              title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
            >
              {theme === "dark" ||
                (theme === "system" &&
                  typeof window !== "undefined" &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
                <>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="4" strokeWidth={2} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m8.66-12.34l-.71.71M5.05 18.95l-.71.71M21 12h-1M4 12H3m15.66 6.34l-.71-.71M5.05 5.05l-.71-.71"
                    />
                  </svg>
                  <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Dark Mode</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
                    />
                  </svg>
                  <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Light Mode</span>
                </>
              )}
            </button>
            <div className="relative"></div>
            <div className="hidden sm:block">
              <NotificationBell />
            </div>
            <div className="hidden md:block text-right">
              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">
                {tokenUser?.name || ""}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">
                {tokenUser?.email || ""}
              </div>
            </div>

            <div className="relative flex items-center">
              <button
                ref={profileBtnRef}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-[#2D9AA5] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#2D9AA5] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2D9AA5]"
                onClick={toggleProfileDropdown}
                aria-label="User menu"
              >
                {tokenUser?.photo ? (
                  <img
                    src={normalizeImagePath(tokenUser.photo)}
                    alt={tokenUser?.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium text-xs sm:text-base">
                    {tokenUser?.name?.charAt(0)?.toUpperCase() || "D"}
                  </span>
                )}
              </button>

              {profileDropdownOpen && typeof window !== "undefined" && createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[9998] cursor-default"
                    onClick={() => setProfileDropdownOpen(false)}
                  />

                  <div
                    className="fixed bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl z-[9999] py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 w-52"
                    style={{
                      top: profileDropdownPos.top,
                      right: profileDropdownPos.right,
                    }}
                  >
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-700">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {tokenUser?.name || "User"}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        {tokenUser?.email || ""}
                      </p>
                    </div>

                    {tokenUser?.photo && (
                      <button
                        onClick={() => {
                          setPreviewImage(normalizeImagePath(tokenUser.photo!));
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        View Profile Picture
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-left"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Logout
                    </button>
                  </div>
                </>,
                document.body,
              )}
            </div>
          </div>
        </div>
      </div>
      {typeof window !== "undefined" &&
        createPortal(
          <ReceptionistChat
            isOpen={receptionistOpen}
            onClose={() => setReceptionistOpen(false)}
            anchorRef={receptionistBtnRef}
          />,
          document.body,
        )}
      {previewImage && typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh] bg-zinc-900 rounded-xl p-2 border border-white/10 shadow-2xl flex flex-col items-center">
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 text-white hover:text-red-400 bg-black/40 hover:bg-black/60 p-2 rounded-full transition-colors font-bold text-sm flex items-center justify-center gap-1.5"
              >
                Close ✕
              </button>
              <img
                src={previewImage}
                alt="Profile Preview"
                className="max-w-[35vw] max-h-[35vh] object-contain rounded-lg"
              />
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

export default ClinicHeader;