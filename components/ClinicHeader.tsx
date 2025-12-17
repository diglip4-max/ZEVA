import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Search, X } from 'lucide-react';

interface NavigationItem {
  _id: string;
  label: string;
  path?: string;
  icon: string;
  description?: string;
  moduleKey: string;
  subModules?: Array<{
    name: string;
    path?: string;
    icon: string;
    order: number;
  }>;
}

interface SearchResult {
  label: string;
  path: string;
}

interface ClinicHeaderProps {
  handleToggleDesktop: () => void;
  handleToggleMobile: () => void;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
}

const ClinicHeader: React.FC<ClinicHeaderProps> = ({
  handleToggleDesktop: _handleToggleDesktop,
  handleToggleMobile: _handleToggleMobile,
  isDesktopHidden: _isDesktopHidden,
  isMobileOpen: _isMobileOpen
}) => {
  const router = useRouter();
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch navigation items for search
  useEffect(() => {
    const fetchNavigationItems = async () => {
      try {
        const token = localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken');
        if (!token) return;

        const res = await axios.get('/api/clinic/sidebar-permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.navigationItems) {
          setNavigationItems(res.data.navigationItems);
        }
      } catch (error) {
        console.error('Error fetching navigation items:', error);
      }
    };

    fetchNavigationItems();
  }, []);

  // Search functionality
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    navigationItems.forEach((item) => {
      // Search in module label
      if (item.label.toLowerCase().includes(lowerQuery)) {
        if (item.path) {
          results.push({
            label: item.label,
            path: item.path,
          });
        }
      }

      // Search in submodules
      if (item.subModules) {
        item.subModules.forEach((subModule) => {
          if (subModule.name.toLowerCase().includes(lowerQuery)) {
            if (subModule.path) {
              results.push({
                label: subModule.name,
                path: subModule.path,
              });
            }
          }
        });
      }
    });

    setSearchResults(results.slice(0, 8)); // Limit to 8 results
  }, [navigationItems]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    performSearch(value);
    setIsSearchOpen(value.length > 0);
  };

  // Handle navigation
  const handleNavigate = (path: string) => {
    if (path) {
      router.push(path);
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  };

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      handleNavigate(searchResults[0].path);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clinicToken');
    sessionStorage.removeItem('clinicEmail');
    sessionStorage.removeItem('clinicName');
    sessionStorage.removeItem('clinicUser');
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('clinicEmailForReset');
    window.location.href = '/clinic/login-clinic';
  };
  
  const clinicUserRaw = localStorage.getItem('clinicUser');
  const clinicUser = clinicUserRaw ? JSON.parse(clinicUserRaw) : null;
  const clinicName: string = useMemo(() => {
    try {
      const token = localStorage.getItem('clinicToken') || '';
      if (!token) return clinicUser?.name || '';
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return clinicUser?.name || '';
      const payload = JSON.parse(atob(payloadBase64));
      return payload?.clinicName || payload?.name || clinicUser?.name || '';
    } catch {
      return clinicUser?.name || '';
    }
  }, [clinicUser]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
  <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
    <div className="px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Empty space for sidebar toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-64 hidden lg:block"></div>
        </div>

        {/* Right: Search + Profile */}
        <div className="flex items-center gap-4 flex-1 justify-end min-w-0">
          {/* Search */}
          <div className="relative w-full max-w-xs sm:max-w-sm lg:max-w-md min-w-[200px] flex-shrink" ref={searchRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-700" />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search sidebar options..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery && setIsSearchOpen(true)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-700 focus:outline-none focus:placeholder-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-xs sm:placeholder:text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSearchOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleNavigate(result.path)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors duration-150 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{result.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 whitespace-nowrap">
            <div className="hidden lg:block text-right">
              <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                {clinicUser?.name || clinicName || 'Clinic User'}
              </div>
              <div className="text-xs text-gray-700 truncate max-w-[150px]">
                {clinicUser?.email || ''}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-sm">
                  {clinicUser ? getInitials(clinicUser.name) : 'A'}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 whitespace-nowrap flex-shrink-0"
                aria-label="Logout"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
);
};

export default ClinicHeader;