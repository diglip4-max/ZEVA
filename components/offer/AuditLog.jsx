import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, RefreshCw } from 'lucide-react';

const avatarColors = [
  'bg-amber-100 text-amber-800 border-amber-200/80',
  'bg-emerald-100 text-emerald-800 border-emerald-200/80',
  'bg-sky-100 text-sky-800 border-sky-200/80',
  'bg-purple-100 text-purple-800 border-purple-200/80',
  'bg-rose-100 text-rose-800 border-rose-200/80',
  'bg-indigo-100 text-indigo-800 border-indigo-200/80',
];

function formatAuditTimestamp(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  return `${day} ${month} ${year} — ${hours}:${minutes} ${ampm}`;
}

export default function AuditLog({ dateFilter = 'Today' }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || '') : '';
      const clinicId = typeof window !== 'undefined' ? (localStorage.getItem('clinicId') || sessionStorage.getItem('clinicId') || '') : '';

      const queryParams = new URLSearchParams();
      if (clinicId) queryParams.append('clinicId', clinicId);

      const res = await fetch(`/api/clinic/offer-audit-log?${queryParams.toString()}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      // console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const formattedTime = formatAuditTimestamp(log.createdAt || log.timestamp).toLowerCase();
    
    return (
      (log.actionTitle && log.actionTitle.toLowerCase().includes(q)) ||
      (log.performedBy && log.performedBy.toLowerCase().includes(q)) ||
      (log.offerTitle && log.offerTitle.toLowerCase().includes(q)) ||
      (log.mainText && log.mainText.toLowerCase().includes(q)) ||
      (log.reason && log.reason.toLowerCase().includes(q)) ||
      (log.initials && log.initials.toLowerCase().includes(q)) ||
      formattedTime.includes(q)
    );
  });

  return (
    <div className="bg-[#FAF9F6] min-h-screen p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Audit Log</h2>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              Who, what, when, why — before and after every change.
            </p>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff or action..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200/90 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold bg-gray-100 rounded-full w-4 h-4 flex items-center justify-center leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Audit Log Feed Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-6 space-y-5">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-xs font-medium">Loading audit history...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-sm font-medium">No audit logs found.</p>
              <p className="text-xs text-gray-400 mt-1">Try refining your search query or perform offer actions.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((item, index) => {
                const colorClass = avatarColors[index % avatarColors.length];
                const formattedTime = formatAuditTimestamp(item.createdAt || item.timestamp);

                return (
                  <div key={item.id || index} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4 group">
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Avatar Circle */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${colorClass}`}>
                        {item.initials || 'AU'}
                      </div>

                      {/* Log details */}
                      <div className="min-w-0">
                        {/* Action Title */}
                        <h4 className="text-sm font-bold text-gray-900 leading-snug">
                          {item.actionTitle}
                        </h4>

                        {/* User & Offer Line */}
                        <p className="text-xs text-gray-600 mt-0.5 font-medium truncate">
                          <span>{item.performedBy}</span>
                          <span className="text-gray-400 mx-1.5">→</span>
                          <span className="font-bold text-amber-700">{item.offerTitle}</span>
                        </p>

                        {/* Reason / Subtext */}
                        {item.reason && (
                          <p className="text-xs text-gray-400 mt-1 font-normal leading-relaxed">
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs font-medium text-gray-400 shrink-0 pt-0.5">
                      {formattedTime}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
