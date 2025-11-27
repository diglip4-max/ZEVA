import Link from "next/link";
import { useRouter } from "next/router";
import { FC, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import axios from "axios";
import {
  BarChart3,
  Users,
  FileText,
  Briefcase,
  MessageSquare,
  Calendar,
  CreditCard,
  Star,
  Mail,
  Settings,
  TrendingUp,
  Lock,
  LayoutDashboard,
  Stethoscope,
  Building2,
  UserCircle,
  ChevronRight,
  X,
  Menu,
} from "lucide-react";

interface NavItemChild {
  label: string;
  path?: string;
  icon: string;
  description?: string;
  badge?: number;
  order?: number;
}

interface NavItem extends NavItemChild {
  moduleKey?: string;
  children?: NavItemChild[];
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

interface ClinicSidebarProps {
  className?: string;
}

// Icon mapping for professional icons
const iconMap: { [key: string]: React.ReactNode } = {
  '📊': <BarChart3 className="w-4 h-4" />,
  '👥': <Users className="w-4 h-4" />,
  '📝': <FileText className="w-4 h-4" />,
  '💼': <Briefcase className="w-4 h-4" />,
  '💬': <MessageSquare className="w-4 h-4" />,
  '📅': <Calendar className="w-4 h-4" />,
  '💳': <CreditCard className="w-4 h-4" />,
  '⭐': <Star className="w-4 h-4" />,
  '📧': <Mail className="w-4 h-4" />,
  '⚙️': <Settings className="w-4 h-4" />,
  '📈': <TrendingUp className="w-4 h-4" />,
  '🔒': <Lock className="w-4 h-4" />,
  '🏥': <Building2 className="w-4 h-4" />,
  '👤': <UserCircle className="w-4 h-4" />,
  '🏠': <LayoutDashboard className="w-4 h-4" />,
  '🩺': <Stethoscope className="w-4 h-4" />,
};

const ClinicSidebar: FC<ClinicSidebarProps> = ({ className }) => {
  const router = useRouter();
  const [isDesktopHidden, setIsDesktopHidden] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [items, setItems] = useState<NavItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dragItemRef = useRef<
    | { type: 'parent'; parentIdx: number }
    | { type: 'child'; parentIdx: number; childIdx: number }
    | null
  >(null);
  const isDraggingRef = useRef<boolean>(false);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileOpen]);

  // Fetch navigation items and permissions
  useEffect(() => {
    const fetchNavigationAndPermissions = async () => {
      try {
        // Use token priority: clinicToken, doctorToken, agentToken, staffToken, userToken, adminToken
        const TOKEN_PRIORITY = [
          "clinicToken",
          "doctorToken",
          "agentToken",
          "staffToken",
          "userToken",
          "adminToken",
        ];
        
        let token: string | null = null;
        if (typeof window !== 'undefined') {
          for (const key of TOKEN_PRIORITY) {
            const value = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (value) {
              token = value;
              break;
            }
          }
        }
        
        if (!token) {
          setItems([]);
          setIsLoading(false);
          return;
        }

        let res;
        try {
          res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (error: any) {
          // Handle 401, 404, and other errors gracefully
          if (error.response?.status === 401) {
            console.log("ClinicSidebar: Unauthorized - token may be invalid or expired");
            setItems([]);
            setIsLoading(false);
            return;
          }
          if (error.response?.status === 404) {
            console.log("ClinicSidebar: API endpoint not found - this may be normal for agent routes");
            setItems([]);
            setIsLoading(false);
            return;
          }
          // Re-throw other errors to be handled by outer catch
          throw error;
        }

        if (res && res.data && res.data.success) {
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
              navItem.children = item.subModules.map((subModule: { name: string; path?: string; icon: string; order: number }): NavItemChild => ({
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

          // Try to load saved order and merge
          try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('clinicSidebarOrder') : null;
            if (saved) {
              const savedOrder = JSON.parse(saved) as NavItem[];
              // Merge saved order with fetched items (preserve custom order if items match)
              const mergedItems = convertedItems.map(item => {
                const savedItem = savedOrder.find(si => si.moduleKey === item.moduleKey || si.label === item.label);
                return savedItem ? { ...item, ...savedItem, path: item.path } : item;
              });
              setItems(mergedItems);
            } else {
              setItems(convertedItems);
            }
          } catch {
            setItems(convertedItems);
          }
        } else {
          console.error("Error fetching navigation items:", res.data.message);
          setItems([]);
        }
      } catch (err: any) {
        // Only log non-401/404 errors to avoid console spam
        if (err.response?.status !== 401 && err.response?.status !== 404) {
          console.error("Error fetching navigation items and permissions:", err);
        }
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationAndPermissions();
  }, []);

  // Persist order on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('clinicSidebarOrder', JSON.stringify(items));
    } catch {}
  }, [items]);

  const handleToggleDesktop = () => {
    setIsDesktopHidden(!isDesktopHidden);
  };

  const handleToggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleCloseMobile = () => {
    setIsMobileOpen(false);
  };

  const handleItemClick = () => {
    setIsMobileOpen(false);
  };

  const handleRegularItemClick = (label: string) => {
    setIsMobileOpen(false);
    setOpenDropdown(null); // Close dropdown when regular items are clicked
    setSelectedItem(label); // Mark this item as selected
  };

  // Avoid click firing after drag
  const safeClick = (handler?: () => void) => (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler?.();
  };

  // Drag handlers
  const onDragStartParent = (parentIdx: number) => (e: React.DragEvent) => {
    isDraggingRef.current = true;
    dragItemRef.current = { type: 'parent', parentIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragStartChild = (parentIdx: number, childIdx: number) => (e: React.DragEvent) => {
    isDraggingRef.current = true;
    dragItemRef.current = { type: 'child', parentIdx, childIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDropParent = (targetParentIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragItemRef.current;
    isDraggingRef.current = false;
    if (!drag || drag.type !== 'parent' || drag.parentIdx === targetParentIdx) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(drag.parentIdx, 1);
      next.splice(targetParentIdx, 0, moved);
      return next;
    });
    dragItemRef.current = null;
  };
  const onDropChild = (targetParentIdx: number, targetChildIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragItemRef.current;
    isDraggingRef.current = false;
    if (!drag || drag.type !== 'child') return;
    if (drag.parentIdx !== targetParentIdx) return;
    if (drag.childIdx === targetChildIdx) return;
    setItems((prev) => {
      const next = [...prev];
      const group = [...(next[targetParentIdx].children || [])];
      const [moved] = group.splice(drag.childIdx, 1);
      group.splice(targetChildIdx, 0, moved);
      next[targetParentIdx] = { ...next[targetParentIdx], children: group };
      return next;
    });
    dragItemRef.current = null;
  };
  const onDragEnd = () => {
    setTimeout(() => { isDraggingRef.current = false; dragItemRef.current = null; }, 0);
  };

  return (
    <>
      {/* Mobile Toggle Button - Only shows when sidebar is closed */}
      <button
        onClick={handleToggleMobile}
        className={clsx(
          "fixed top-4 left-4 z-[60] bg-white text-gray-700 p-2.5 rounded-lg shadow-md transition-all duration-200 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 lg:hidden",
          {
            block: !isMobileOpen,
            hidden: isMobileOpen,
          }
        )}
        aria-label="Open mobile menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Toggle Button */}
      <button
        onClick={handleToggleDesktop}
        className={clsx(
          "fixed top-4 left-4 z-[60] bg-white text-gray-700 p-2.5 rounded-lg shadow-md transition-all duration-200 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hidden lg:block",
          {
            "lg:block": isDesktopHidden,
            "lg:hidden": !isDesktopHidden,
          }
        )}
        aria-label="Toggle desktop sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay - Covers entire screen when sidebar is open */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex-col min-h-screen w-64 hidden lg:flex",
          {
            "lg:flex": !isDesktopHidden,
            "lg:hidden": isDesktopHidden,
          },
          className
        )}
        style={{ height: "100vh" }}
      >
        <div className="flex flex-col h-full">
          {/* Desktop Header Section */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 relative">
            <div className="group cursor-pointer">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-all duration-200 border border-gray-200">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Z</span>
                </div>
                <div>
                  <span className="font-bold text-base text-gray-900 block">
                    ZEVA
                  </span>
                  <span className="text-xs text-gray-700 font-medium">Clinic Panel</span>
                </div>
              </div>
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={handleToggleDesktop}
              className="absolute right-4 top-4 bg-gray-100 text-gray-700 p-1.5 rounded-md hover:bg-gray-200 transition-all duration-200"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 min-h-0">
            <div className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
              Navigation
            </div>
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-xs text-gray-500 px-2">Loading menu…</div>
              ) : (
                items.map((item, parentIdx) => {
                const isDropdownOpen = openDropdown === item.label;
                // If an item is manually selected, only that item should be active
                // Otherwise, use router pathname to determine active state
                const isActive = selectedItem 
                  ? selectedItem === item.label 
                  : router.pathname === item.path;
                const isHovered = hoveredItem === item.path;

                // If item has children => Dropdown
                if (item.children) {
                  return (
                    <div
                      key={item.label}
                      draggable
                      onDragStart={onDragStartParent(parentIdx)}
                      onDragOver={onDragOver}
                      onDrop={onDropParent(parentIdx)}
                      onDragEnd={onDragEnd}
                    >
                      <div
                        className={clsx(
                          "group relative block rounded-lg transition-all duration-200 cursor-pointer p-2.5 touch-manipulation",
                          {
                            "bg-gray-800 text-white": isDropdownOpen,
                            "hover:bg-gray-50 text-gray-700": !isDropdownOpen,
                          }
                        )}
                        onClick={safeClick(() => {
                          setOpenDropdown(isDropdownOpen ? null : item.label);
                          setSelectedItem(item.label);
                        })}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={clsx(
                            "p-1.5 rounded-md transition-all duration-200 flex-shrink-0",
                            {
                              "bg-white/20 text-white": isDropdownOpen,
                              "text-gray-700 group-hover:text-gray-800 group-hover:bg-gray-100": !isDropdownOpen,
                            }
                          )}>
                            {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={clsx(
                              "font-medium text-sm transition-colors duration-200 truncate",
                              {
                                "text-white": isDropdownOpen,
                                "text-gray-900": !isDropdownOpen,
                              }
                            )}>
                              {item.label}
                            </div>
                          </div>
                          <svg
                            className={clsx(
                              "w-4 h-4 transition-transform duration-200 flex-shrink-0",
                              isDropdownOpen && "rotate-90",
                              isDropdownOpen ? "text-white" : "text-gray-700"
                            )}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M6 6L14 10L6 14V6Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Dropdown children */}
                      {isDropdownOpen && (
                        <div className="pl-4 mt-1 space-y-0.5">
                          {item.children.map((child, childIdx) => {
                            // Child items are active if they are selected OR if no item is selected and router matches
                            const childActive = selectedItem 
                              ? selectedItem === child.label 
                              : router.pathname === child.path;

                            return (
                              <Link key={child.path} href={child.path!}>
                                <div
                                  draggable
                                  onDragStart={onDragStartChild(parentIdx, childIdx)}
                                  onDragOver={onDragOver}
                                  onDrop={onDropChild(parentIdx, childIdx)}
                                  onDragEnd={onDragEnd}
                                  className={clsx(
                                    "group relative block rounded-lg transition-all duration-200 cursor-pointer p-2 touch-manipulation",
                                    {
                                      "bg-gray-800 text-white": childActive,
                                      "hover:bg-gray-50 text-gray-700": !childActive,
                                    }
                                  )}
                                  onMouseEnter={() => setHoveredItem(child.path!)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                  onClick={safeClick(() => {
                                    setSelectedItem(child.label);
                                  })}
                                >
                                  <div className="flex items-center space-x-2.5">
                                    <div className={clsx(
                                      "p-1 rounded-md transition-all duration-200 flex-shrink-0",
                                      {
                                        "bg-white/20 text-white": childActive,
                                        "text-gray-700 group-hover:text-gray-800 group-hover:bg-gray-100": !childActive,
                                      }
                                    )}>
                                      {iconMap[child.icon] || <span className="text-sm">{child.icon}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={clsx(
                                        "font-medium text-sm transition-colors duration-200 truncate",
                                        {
                                          "text-white": childActive,
                                          "text-gray-900": !childActive,
                                        }
                                      )}>
                                        {child.label}
                                      </div>
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

                // Regular (non-dropdown) item
                const MenuItemContent = (
                  <div
                    className={clsx(
                      "group relative block rounded-lg transition-all duration-200 cursor-pointer p-2.5 touch-manipulation",
                      {
                        "bg-gray-800 text-white": isActive,
                        "hover:bg-gray-50 text-gray-700": !isActive,
                      }
                    )}
                    onClick={safeClick(() => {
                      setOpenDropdown(null);
                      setSelectedItem(item.label);
                    })}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-white rounded-r-full"></div>
                    )}

                    <div className="flex items-center space-x-3">
                      <div className={clsx(
                        "p-1.5 rounded-md transition-all duration-200 flex-shrink-0",
                        {
                          "bg-white/20 text-white": isActive,
                          "text-gray-700 group-hover:text-gray-800 group-hover:bg-gray-100": !isActive,
                        }
                      )}>
                        {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={clsx(
                          "font-medium text-sm transition-colors duration-200 truncate",
                          {
                            "text-white": isActive,
                            "text-gray-900": !isActive,
                          }
                        )}>
                          {item.label}
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return item.path ? (
                  <Link key={item.path} href={item.path}>
                    {MenuItemContent}
                  </Link>
                ) : (
                  <div key={item.label}>{MenuItemContent}</div>
                );
              })
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Sidebar - Full height overlay */}
      <div
        className={clsx(
          "fixed inset-0 z-50 lg:hidden transition-transform duration-300 ease-in-out",
          {
            "translate-x-0": isMobileOpen,
            "-translate-x-full": !isMobileOpen,
          }
        )}
      >
        <aside className="w-full max-w-xs h-full bg-white shadow-xl border-r border-gray-200 flex flex-col">
          <div className="flex flex-col h-full">
            {/* Mobile Header Section */}
            <div className="p-4 border-b border-gray-200 relative flex-shrink-0">
              <button
                onClick={handleCloseMobile}
                className="absolute right-4 top-4 bg-gray-100 text-gray-700 p-2 rounded-lg hover:bg-gray-200 transition-all duration-200 z-10 touch-manipulation"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="pr-16">
                <div className="group cursor-pointer">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-all duration-200 border border-gray-200">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">Z</span>
                    </div>
                    <div>
                      <span className="font-bold text-base text-gray-900 block">
                        ZEVA
                      </span>
                      <span className="text-xs text-gray-700 font-medium">Clinic Panel</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 min-h-0">
              <div className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
                Navigation
              </div>

              {isLoading ? (
                <div className="text-xs text-gray-500 px-2">Loading menu…</div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => {
                  // If an item is manually selected, only that item should be active
                  // Otherwise, use router pathname to determine active state
                  const isActive = selectedItem 
                    ? selectedItem === item.label 
                    : router.pathname === item.path;

                  const MenuItemContent = (
                    <div
                      className={clsx(
                        'group relative block rounded-lg transition-all duration-200 cursor-pointer p-2.5 touch-manipulation',
                        {
                          'bg-gray-800 text-white': isActive,
                          'hover:bg-gray-50 text-gray-700': !isActive,
                        }
                      )}
                      onClick={handleItemClick}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-white rounded-r-full"></div>
                      )}

                      <div className="flex items-center space-x-3">
                        <div
                          className={clsx(
                            'p-1.5 rounded-md transition-all duration-200 flex-shrink-0',
                            {
                              'bg-white/20 text-white': isActive,
                              'text-gray-700 group-hover:text-gray-800 group-hover:bg-gray-100': !isActive,
                            }
                          )}
                        >
                          {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                          {item.badge && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                              {item.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div
                            className={clsx(
                              'font-medium text-sm transition-colors duration-200 truncate',
                              {
                                'text-white': isActive,
                                'text-gray-900': !isActive,
                              }
                            )}
                          >
                            {item.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  return item.path ? (
                    <Link key={item.label} href={item.path}>
                      {MenuItemContent}
                    </Link>
                  ) : (
                    <div key={item.label}>{MenuItemContent}</div>
                  );
                })}
                </div>
              )}
            </nav>
          </div>
        </aside>
      </div>
    </>
  );
};

export default ClinicSidebar;