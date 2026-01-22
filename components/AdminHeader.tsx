import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface AdminHeaderProps {
  sidebarItems?: Array<{
    label: string;
    path?: string;
    icon?: string;
    children?: Array<{ label: string; path?: string }>;
  }>;
  onSearch?: (query: string) => void;
  isDesktopHidden?: boolean;
  isMobileOpen?: boolean;
  onToggleDesktop?: () => void;
  onToggleMobile?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  sidebarItems = [],
  onSearch,
  isDesktopHidden = false,
  isMobileOpen = false,
  onToggleDesktop,
  onToggleMobile,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ label: string; path?: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if modal is open by checking body class
  useEffect(() => {
    const checkModalOpen = () => {
      setIsModalOpen(document.body.classList.contains('modal-open'));
    };

    // Check initially
    checkModalOpen();

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkModalOpen);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const storedUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const email = storedUser.email;

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  // Search functionality
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      if (onSearch) onSearch('');
      return;
    }

    const results: Array<{ label: string; path?: string }> = [];
    
    sidebarItems.forEach((item) => {
      if (item.label.toLowerCase().includes(query.toLowerCase())) {
        if (item.path) {
          results.push({ label: item.label, path: item.path });
        }
      }
      
      if (item.children) {
        item.children.forEach((child) => {
          if (child.label.toLowerCase().includes(query.toLowerCase())) {
            if (child.path) {
              results.push({ label: child.label, path: child.path });
            }
          }
        });
      }
    });

    setSearchResults(results);
    setShowSearchResults(results.length > 0);
    if (onSearch) onSearch(query);
  };

  const handleSearchResultClick = (path?: string) => {
    if (path) {
      router.push(path);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Hide header when modal is open
  if (isModalOpen) {
    return null;
  }

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm z-[49] backdrop-blur-sm bg-white/95">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
        <div className="flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
          {/* Left: Hamburger buttons - Always visible, priority positioning */}
          <div className="flex items-center gap-2 flex-shrink-0 relative z-[51] min-w-[2.5rem]">
            {/* Mobile Hamburger - Always visible on mobile, changes to X when sidebar is open */}
            {onToggleMobile && (
              <button
                onClick={onToggleMobile}
                className="p-2 rounded-lg bg-white hover:bg-gray-100 transition-all duration-200 lg:hidden shadow-sm border border-gray-200 relative z-[51] flex-shrink-0"
                aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isMobileOpen ? (
                  <svg
                    className="w-5 h-5 text-gray-700 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-700 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}

            {/* Desktop Hamburger - Only show when sidebar is hidden */}
            {onToggleDesktop && isDesktopHidden && (
              <button
                onClick={onToggleDesktop}
                className="hidden lg:inline-flex p-2 rounded-lg bg-white hover:bg-gray-100 transition-colors duration-200 shadow-sm border border-gray-200 relative z-[51] flex-shrink-0"
                aria-label="Toggle sidebar"
              >
                <svg
                  className="w-5 h-5 text-gray-700 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>

          {/* Center: Search Bar - Responsive width with adjusted mobile spacing */}
          <div className="relative flex-1 min-w-0 max-w-full sm:max-w-xs md:max-w-sm lg:max-w-md mx-2 sm:mx-3 lg:mx-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                placeholder="Search sidebar options..."
                className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearchResultClick(result.path)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors duration-150 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{result.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: User Profile - Always aligned to right corner */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0 ml-auto">
            {/* Profile Text - Hidden on mobile, shown on larger screens */}
            <div className="hidden md:block text-right min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate max-w-[140px] lg:max-w-[180px]">
                {storedUser?.name || 'Admin User'}
              </div>
              <div className="text-xs text-gray-600 truncate max-w-[140px] lg:max-w-[180px]">
                {email || 'admin@zeva.com'}
              </div>
            </div>

            {/* Avatar - Always visible */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-medium text-xs sm:text-sm">
                {storedUser?.name ? getInitials(storedUser.name) : 'AU'}
              </span>
            </div>

            {/* Logout Button - Icon only on mobile, text on larger screens */}
            <button
              onClick={handleLogout}
              className="p-1.5 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 flex-shrink-0"
              aria-label="Logout"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Logout</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;             
