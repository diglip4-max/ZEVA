import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Search, X, ChevronRight, BarChart3, Users, FileText, Briefcase, MessageSquare, Calendar, CreditCard, Star, Mail, Settings, TrendingUp, Lock } from 'lucide-react';

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
  type: 'module' | 'submodule';
  label: string;
  path: string;
  icon: string;
  moduleLabel?: string;
}

interface ClinicHeaderProps {
  handleToggleDesktop: () => void;
  handleToggleMobile: () => void;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
}

const ClinicHeader: React.FC<ClinicHeaderProps> = ({
  handleToggleDesktop,
  handleToggleMobile,
  isDesktopHidden,
  isMobileOpen
}) => {
  const router = useRouter();
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Icon mapping (matching clinic-dashboard.tsx)
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
  };

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
            type: 'module',
            label: item.label,
            path: item.path,
            icon: item.icon,
          });
        }
      }

      // Search in submodules
      if (item.subModules) {
        item.subModules.forEach((subModule) => {
          if (subModule.name.toLowerCase().includes(lowerQuery)) {
            if (subModule.path) {
              results.push({
                type: 'submodule',
                label: subModule.name,
                path: subModule.path,
                icon: subModule.icon,
                moduleLabel: item.label,
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

  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const fmt = () => new Date().toLocaleString();
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
  <header className="w-full bg-white border-b border-gray-200 shadow-sm">
    <div className="px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
           
          </div>
        </div>

        {/* Right: Search, Date/Time, Clinic, Support, Profile */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:block relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery && setIsSearchOpen(true)}
                className="w-56 lg:w-72 pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSearchOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-500 px-3 py-2 uppercase">
                    Search Results ({searchResults.length})
                  </div>
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => handleNavigate(result.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors text-left group"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        {iconMap[result.icon] || (
                          <span className="text-base">{result.icon || '📄'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{result.label}</span>
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                            {result.type === 'module' ? 'Module' : 'Feature'}
                          </span>
                        </div>
                        {result.moduleLabel && result.type === 'submodule' && (
                          <p className="text-xs text-gray-500 mt-0.5">{result.moduleLabel}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {isSearchOpen && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4">
                <div className="text-center py-4">
                  <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No modules found</p>
                  <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
                </div>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="hidden sm:flex text-xs text-gray-600 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">
            {now}
          </div>

          {/* Clinic name */}
          {clinicName && (
            <div className="hidden sm:flex items-center text-sm font-medium text-gray-800 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">
              {clinicName}
            </div>
          )}

          {/* Support */}
          <a
            href="#"
            className="hidden sm:inline-flex items-center text-sm text-gray-700 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            Support
          </a>
          
          {/* Profile dropdown */}
          <div className="relative">
            <details className="group">
              <summary className="list-none flex items-center gap-2 cursor-pointer select-none">
                <div className="w-9 h-9 bg-[#2D9AA5] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {clinicUser ? getInitials(clinicUser.name) : 'A'}
                  </span>
                </div>
                <svg className="w-4 h-4 text-gray-600 group-open:rotate-180 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                </svg>
              </summary>
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
                <div className="flex items-center gap-3 p-2 border-b border-gray-100">
                  <div className="w-9 h-9 bg-[#2D9AA5] rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {clinicUser ? getInitials(clinicUser.name) : 'A'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{clinicUser?.name || 'User'}</div>
                    <div className="text-xs text-gray-500 truncate">{clinicUser?.email || ''}</div>
                  </div>
                </div>
                <div className="py-2 text-sm">
                 
                  <a href="/clinic/myallClinic" className="block px-3 py-2 hover:bg-gray-50 rounded">Profile</a>
  
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </header>
);
};

export default ClinicHeader;