import React, { useState, useEffect, FC } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import axios from "axios";

interface NavItem {
  label: string;
  path?: string;
  icon: string;
  description?: string;
  badge?: string | number;
  order?: number;
  moduleKey?: string;
  children?: NavItem[];
}

interface NavigationItemFromAPI {
  _id: string;
  label: string;
  path?: string;
  icon: string;
  description?: string;
  order: number;
  moduleKey: string;
  subModules?: Array<{
    name: string;
    path?: string;
    icon: string;
    order: number;
  }>;
}

interface DoctorSidebarProps {
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
  handleToggleDesktop: () => void;
  handleToggleMobile: () => void;
  handleCloseMobile: () => void;
  handleItemClick: () => void;
}

const navigationItems: NavItem[] = [
  {
    label: "Dashboard",
    path: "/doctor/doctor-dashboard",
    icon: "🏠",
    description: "Overview & metrics",
  },
  {
    label: "Manage Profile",
    path: "/doctor/manageDoctor",
    icon: "👤",
    description: "Manage Profile",
  },
  {
    label: "All users Review",
    path: "/doctor/getReview",
    icon: "📅",
    description: "See All Users Reviews",
  },
  {
    label: "Blogs",
    icon: "📄",
    description: "Blog Management",
    children: [
      { label: "Write Article", path: "/doctor/BlogForm", icon: "📝" },
      { label: "Published Blogs", path: "/doctor/published-blogs", icon: "📄" },
      { label: "Blog Analytics", path: "/doctor/getAuthorCommentsAndLikes", icon: "📊" },
    ],
  },
  {
    label: "Jobs",
    icon: "💼",
    description: "Job Management",
    children: [
      { label: "Post Job", path: "/doctor/create-job", icon: "📢" },
      { label: "See Jobs", path: "/doctor/my-jobs", icon: "💼" },
      { label: "Job Applicants", path: "/doctor/job-applicants", icon: "👥" },
    ],
  },
  {
    label: "Prescription Requests",
    path: "/doctor/prescription-requests",
    icon: "📋",
    description: "View all prescription requests",
  },
  {
    label: "Create Offers",
    path: "/doctor/create-offer",
    icon: "🤑",
    description: "Manage promotional offers",
  },
  {
    label: "Create Agent",
    path: "/doctor/create-agent",
    icon: "👤",
    description: "Create agent account",
  },
];

const DoctorSidebar: FC<DoctorSidebarProps> = ({
  isDesktopHidden,
  isMobileOpen,
  handleToggleDesktop,
  handleToggleMobile,
  handleCloseMobile,
  handleItemClick,
}) => {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [navigationItems, setNavigationItems] = useState<NavItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch navigation items and permissions
  useEffect(() => {
    const fetchNavigationAndPermissions = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('doctorToken') : null;
        if (!token) {
          setNavigationItems([]);
          setIsLoading(false);
          return;
        }

        const res = await axios.get("/api/doctor/sidebar-permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          // Convert API navigation items to NavItem format
          const convertedItems: NavItem[] = (res.data.navigationItems || []).map((item: NavigationItemFromAPI): NavItem => {
            const navItem: NavItem = {
              label: item.label,
              path: item.path,
              icon: item.icon,
              description: item.description,
              moduleKey: item.moduleKey,
              order: item.order,
            };

            // Convert subModules to children
            if (item.subModules && item.subModules.length > 0) {
              navItem.children = item.subModules.map((subModule: { name: string; path?: string; icon: string; order: number }): NavItem => ({
                label: subModule.name,
                path: subModule.path,
                icon: subModule.icon,
                description: subModule.name,
                order: subModule.order,
              }));
            }

            return navItem;
          });

          // Sort by order
          convertedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
          convertedItems.forEach(item => {
            if (item.children) {
              item.children.sort((a, b) => (a.order || 0) - (b.order || 0));
            }
          });

          setNavigationItems(convertedItems);
        } else {
          console.error("Error fetching navigation items:", res.data.message);
          setNavigationItems([]);
        }
      } catch (err: any) {
        console.error("Error fetching navigation items and permissions:", err);
        setNavigationItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationAndPermissions();

    // Re-fetch on route changes to ensure permissions are always up-to-date
    const handleRouteChange = () => {
      fetchNavigationAndPermissions();
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  // Close mobile sidebar with ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        handleCloseMobile();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen, handleCloseMobile]);

  // Prevent background scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileOpen]);

  // Close dropdown and mobile sidebar on regular item click
  const handleRegularItemClick = () => {
    setOpenDropdown(null);
    handleItemClick();
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={handleToggleMobile}
        className={clsx(
          "fixed top-4 left-4 z-[60] bg-white text-[#2D9AA5] p-3 rounded-lg shadow-lg transition-all duration-300 border border-gray-200 lg:hidden",
          { block: !isMobileOpen, hidden: isMobileOpen }
        )}
        aria-label="Open mobile menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Desktop Toggle Button */}
      <button
        onClick={handleToggleDesktop}
        className={clsx(
          "fixed top-4 left-4 z-[60] bg-white text-[#2D9AA5] p-3 rounded-lg shadow-lg transition-all duration-300 border border-gray-200 hidden lg:block",
          { "lg:block": isDesktopHidden, "lg:hidden": !isDesktopHidden }
        )}
        aria-label="Toggle desktop sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={handleCloseMobile} aria-hidden="true" />}

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "transition-all duration-300 ease-in-out bg-white border-r border-gray-200 shadow-sm flex-col min-h-screen w-72 hidden lg:flex",
          { "lg:flex": !isDesktopHidden, "lg:hidden": isDesktopHidden }
        )}
        style={{ height: "100vh" }}
      >
        <div className="flex flex-col h-full">
          {/* Desktop Header */}
          <div className="p-6 border-b border-gray-100 flex-shrink-0 relative">
            <div className="group flex items-center gap-3 p-4 rounded-xl bg-gray-50 transition-all duration-300 border border-gray-100">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2D9AA5] to-[#1e7d87] rounded-xl flex items-center justify-center shadow-sm">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
              <div>
                <span className="font-bold text-xl text-gray-900 block">ZEVA</span>
                <span className="text-sm text-[#2D9AA5] font-medium">Doctor Portal</span>
              </div>
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={handleToggleDesktop}
              className="absolute right-6 top-6 bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-all duration-300"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 min-h-0">
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4 px-2">
              Doctor Management
            </div>

            {isLoading ? (
              <div className="text-xs text-gray-500 px-2">Loading menu…</div>
            ) : (
              <div className="space-y-1">
                {navigationItems.map((item) => {
                const isDropdownOpen = openDropdown === item.label;
                const isActive = item.path ? router.pathname === item.path : false;
                const hasActiveChild = item.children?.some((child) => router.pathname === child.path);
                const shouldShowAsActive = item.children ? hasActiveChild : isActive;

                // Dropdown
                if (item.children) {
                  return (
                    <div key={item.label}>
                      <div
                        className={clsx(
                          "group relative block rounded-lg transition-all duration-200 cursor-pointer p-3",
                          { "bg-[#2D9AA5] text-white shadow-sm": shouldShowAsActive, "hover:bg-gray-50 text-gray-700 hover:text-gray-900": !shouldShowAsActive }
                        )}
                        onClick={() => setOpenDropdown(isDropdownOpen ? null : item.label)}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={clsx(
                              "text-lg p-2 rounded-lg transition-all duration-200",
                              { "bg-white/20 text-white": shouldShowAsActive, "bg-gray-100 text-gray-600 group-hover:bg-[#2D9AA5]/10 group-hover:text-[#2D9AA5]": !shouldShowAsActive }
                            )}
                          >
                            {item.icon}
                          </div>
                          <div className="flex-1">
                            <div className={clsx("font-medium text-sm", { "text-white": shouldShowAsActive, "text-gray-900": !shouldShowAsActive })}>{item.label}</div>
                            <div className={clsx("text-xs", { "text-white/80": shouldShowAsActive, "text-gray-500": !shouldShowAsActive })}>{item.description}</div>
                          </div>
                        </div>
                      </div>

                      {isDropdownOpen && (
                        <div className="pl-6 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const childActive = router.pathname === child.path;
                            return (
                              <Link key={child.path} href={child.path!}>
                                <div
                                  className={clsx(
                                    "group relative block rounded-lg transition-all duration-200 cursor-pointer",
                                    child.description ? "p-3" : "p-1.5",
                                    { "bg-[#2D9AA5] text-white shadow-sm": childActive, "hover:bg-gray-50 text-gray-700 hover:text-gray-900": !childActive }
                                  )}
                                  onClick={handleItemClick}
                                >
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className={clsx(
                                        "text-base p-1.5 rounded-lg transition-all duration-200 relative flex-shrink-0",
                                        { "bg-white/20 text-white": childActive, "text-gray-500 group-hover:text-[#2D9AA5] group-hover:bg-[#2D9AA5]/10": !childActive }
                                      )}
                                    >
                                      {child.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={clsx("font-medium text-sm transition-colors duration-200 truncate", { "text-white": childActive, "text-gray-900": !childActive })}>
                                        {child.label}
                                      </div>
                                      {child.description && <div className={clsx("text-xs mt-0.5 transition-all duration-200 truncate", { "text-white/80": childActive, "text-gray-500": !childActive })}>{child.description}</div>}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular Item
                return (
                  <Link key={item.label} href={item.path!}>
                    <div
                      className={clsx(
                        "group relative block rounded-lg transition-all duration-200 cursor-pointer p-3",
                        { "bg-[#2D9AA5] text-white shadow-sm": isActive, "hover:bg-gray-50 text-gray-700 hover:text-gray-900": !isActive }
                      )}
                      onClick={handleRegularItemClick}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={clsx("text-lg p-2 rounded-lg transition-all duration-200", { "bg-white/20 text-white": isActive, "bg-gray-100 text-gray-600 group-hover:bg-[#2D9AA5]/10 group-hover:text-[#2D9AA5]": !isActive })}>{item.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className={clsx("font-medium text-sm", { "text-white": isActive, "text-gray-900": !isActive })}>{item.label}</div>
                          {item.description && <div className={clsx("text-xs mt-0.5", { "text-white/80": isActive, "text-gray-500": !isActive })}>{item.description}</div>}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              </div>
            )}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default DoctorSidebar;
