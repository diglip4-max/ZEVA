import React, { useState, useEffect } from 'react';

interface AdminHeaderProps {
  handleToggleDesktop?: () => void;
  handleToggleMobile?: () => void;
  isDesktopHidden?: boolean;
  isMobileOpen?: boolean;
  sidebarItems?: Array<{
    label: string;
    path?: string;
    icon?: string;
    children?: Array<{ label: string; path?: string }>;
  }>;
  onSearch?: (query: string) => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  handleToggleDesktop,
  handleToggleMobile,
  isDesktopHidden = false,
  isMobileOpen = false,
  sidebarItems = [],
  onSearch,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ label: string; path?: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format date and time
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const toggleDesktop = () => {
    if (handleToggleDesktop) handleToggleDesktop();
  };

  const toggleMobile = () => {
    if (handleToggleMobile) handleToggleMobile();
  };

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
      window.location.href = path;
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
      <div className="px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Left: Hamburger + Search Bar */}
          <div className="flex items-center flex-1 min-w-0">
            {/* Mobile Hamburger - Only show when sidebar is closed */}
            {handleToggleMobile && !isMobileOpen && (
              <div className="flex-shrink-0 mr-3 sm:mr-4">
                <button
                  onClick={toggleMobile}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 lg:hidden"
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
              </div>
            )}

            {/* Desktop Hamburger - Only show when sidebar is hidden */}
            {handleToggleDesktop && isDesktopHidden && (
              <div className="hidden lg:block flex-shrink-0 mr-3 sm:mr-4">
                <button
                  onClick={toggleDesktop}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
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
              </div>
            )}

            {/* Search Bar - Always on left */}
            <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-700"
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
                  className="block w-full min-w-0 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-700 focus:outline-none focus:placeholder-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-xs sm:placeholder:text-sm"
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
          </div>

          {/* Center: Date and Time */}
          <div className="hidden lg:flex flex-col items-end text-right flex-shrink-0 ml-2">
            <div className="text-sm font-medium text-gray-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs text-gray-700">
              {formatDate(currentTime)}
            </div>
          </div>

          {/* Right: User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-gray-900">
                {storedUser?.name || 'Admin'}
              </div>
              <div className="text-xs text-gray-700 truncate max-w-[120px]">
                {email || ''}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {storedUser?.name ? getInitials(storedUser.name) : 'A'}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-200"
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
    </header>
  );
};

export default AdminHeader;
