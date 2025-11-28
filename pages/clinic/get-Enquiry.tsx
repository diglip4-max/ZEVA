"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  Search,
  User,
  Calendar,
  Mail,
  MessageSquare,
  X,
  Inbox,
  CalendarDays,
  Bell,
  Filter,
} from "lucide-react";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import withClinicAuth from "../../components/withClinicAuth";

interface Enquiry {
  _id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
}

interface EnquiriesResponse {
  enquiries: Enquiry[];
}

function ClinicEnquiries({ contextOverride = null }: { contextOverride?: "clinic" | "agent" }) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "7d" | "30d">(
    "all"
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [routeContext, setRouteContext] = useState<"clinic" | "agent">(
    contextOverride || "clinic"
  );

  useEffect(() => {
    if (contextOverride) {
      setRouteContext(contextOverride);
      return;
    }
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname || "";
    if (currentPath.startsWith("/agent/")) {
      setRouteContext("agent");
    } else {
      setRouteContext("clinic");
    }
  }, [contextOverride]);

  useEffect(() => {
    const fetchEnquiries = async () => {
      try {
        if (typeof window === "undefined") return;
        const agentToken =
          localStorage.getItem("agentToken") ||
          sessionStorage.getItem("agentToken") ||
          localStorage.getItem("userToken") ||
          sessionStorage.getItem("userToken");

        const clinicToken =
          localStorage.getItem("clinicToken") ||
          sessionStorage.getItem("clinicToken");

        const token = routeContext === "agent" ? agentToken : clinicToken;
        if (!token) {
          setEnquiries([]);
          setFilteredEnquiries([]);
          setLoading(false);
          return;
        }

        const res = await axios.get<EnquiriesResponse>(
          routeContext === "agent"
            ? "/api/clinics/getEnquiries?scope=clinic"
            : "/api/clinics/getEnquiries",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setEnquiries(res.data.enquiries || []);
        setFilteredEnquiries(res.data.enquiries || []);
      } catch (err) {
        console.error("Error fetching enquiries:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEnquiries();
  }, [routeContext]);

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isWithinLastDays = (dateString: string, days: number) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff =
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= days;
  };

  useEffect(() => {
    let filtered = [...enquiries];

    if (timeFilter === "today") {
      filtered = filtered.filter((enquiry) => isToday(enquiry.createdAt));
    } else if (timeFilter === "7d") {
      filtered = filtered.filter((enquiry) =>
        isWithinLastDays(enquiry.createdAt, 7)
      );
    } else if (timeFilter === "30d") {
      filtered = filtered.filter((enquiry) =>
        isWithinLastDays(enquiry.createdAt, 30)
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (enquiry) =>
          enquiry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          enquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          enquiry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          enquiry.phone.includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    setFilteredEnquiries(filtered);
  }, [enquiries, searchTerm, timeFilter, sortOrder]);

  const totalEnquiries = enquiries.length;
  const todaysEnquiries = enquiries.filter((enquiry) =>
    isToday(enquiry.createdAt)
  ).length;
  const unreadEnquiries = enquiries.length;
  const lastEnquiryDate =
    enquiries.length > 0
      ? new Date(
          Math.max(
            ...enquiries.map((enquiry) =>
              new Date(enquiry.createdAt).getTime()
            )
          )
        ).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No enquiries yet";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-gray-800 mx-auto mb-3"></div>
          <p className="text-gray-700 font-medium text-sm">Loading enquiries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Compact Unique Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between mb-4">
            {/* Left: Brand */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center shadow-sm">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                  Patient Enquiries
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  {enquiries.length} total enquiries
                </p>
              </div>
            </div>

            {/* Right: Count Badge */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {enquiries.length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-600 font-medium">Total</div>
            </div>
          </div>
          
          {/* Compact Stats Grid - Unique Card Style with Gray Theme */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gray-50 border-l-4 border-gray-800 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Inbox className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[10px] uppercase text-gray-600 tracking-wide font-semibold">
                  Total
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {totalEnquiries}
              </p>
            </div>
            <div className="bg-gray-50 border-l-4 border-gray-700 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[10px] uppercase text-gray-600 tracking-wide font-semibold">
                  Today
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {todaysEnquiries}
              </p>
            </div>
            <div className="bg-gray-50 border-l-4 border-gray-600 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-600 rounded-lg flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[10px] uppercase text-gray-600 tracking-wide font-semibold">
                  Pending
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {unreadEnquiries}
              </p>
            </div>
            <div className="bg-gray-50 border-l-4 border-gray-500 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[10px] uppercase text-gray-600 tracking-wide font-semibold">
                  Last
                </p>
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                {lastEnquiryDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Compact Search Bar & Controls - Unique Style */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-gray-900 w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 outline-none transition-all bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={timeFilter}
                onChange={(e) =>
                  setTimeFilter(e.target.value as "all" | "today" | "7d" | "30d")
                }
                className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 bg-white"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "newest" | "oldest")
                }
                className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 bg-white"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {searchTerm && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 pt-2 border-t border-gray-100">
              <span className="font-medium">Results for:</span>
              <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md font-medium break-all">
                &quot;{searchTerm}&quot;
              </span>
              <span className="text-gray-500">({filteredEnquiries.length} found)</span>
            </div>
          )}
        </div>

        {/* Enquiries List - Unique Card Design */}
        <div className="space-y-3 sm:space-y-4">
          {filteredEnquiries.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-10 text-center">
              <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-gray-800" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {searchTerm ? "No results found" : "No enquiries yet"}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "Patient enquiries will appear here when they contact your clinic."}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="bg-gray-800 text-white px-4 py-2 text-xs sm:text-sm rounded-lg hover:bg-gray-900 transition-colors font-medium"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            filteredEnquiries.map((enquiry, index) => {
              const isTodayEnquiry = isToday(enquiry.createdAt);
              const isRecent = isWithinLastDays(enquiry.createdAt, 7);
              
              return (
                <div
                  key={enquiry._id}
                  className="bg-white rounded-lg shadow-sm border-l-4 border-gray-800 hover:shadow-lg hover:border-gray-900 transition-all duration-200 group"
                >
                  {/* Unique Card Design */}
                  <div className="p-4 sm:p-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Avatar with gray theme */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                          isTodayEnquiry 
                            ? 'bg-gray-800' 
                            : isRecent 
                            ? 'bg-gray-700'
                            : 'bg-gray-600'
                        }`}>
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                              {enquiry.name}
                            </h3>
                            {isTodayEnquiry && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-semibold rounded-md border border-gray-200">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={`mailto:${enquiry.email}`}
                              className="flex items-center gap-1 text-gray-800 hover:text-gray-900 transition-colors text-[10px] sm:text-xs break-all font-medium"
                            >
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{enquiry.email}</span>
                            </a>
                            {enquiry.phone && (
                              <span className="text-gray-400 text-[10px]">•</span>
                            )}
                            {enquiry.phone && (
                              <span className="text-gray-600 text-[10px] sm:text-xs">
                                {enquiry.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Date Badge */}
                      <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md flex-shrink-0">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-[10px] sm:text-xs text-gray-600 whitespace-nowrap">
                          {new Date(enquiry.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Message Box - Gray Theme */}
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="flex items-start gap-2 mb-2">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-800 flex-shrink-0 mt-0.5" />
                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                          Message:
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed pl-5 text-xs sm:text-sm break-words italic">
                        &quot;{enquiry.message}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

ClinicEnquiries.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const ClinicEnquiriesBase = ClinicEnquiries;

// ✅ Apply HOC and assign correct type
const ProtectedDashboard: NextPageWithLayout = withClinicAuth(ClinicEnquiries);

// ✅ Reassign layout (TS-safe now)
ProtectedDashboard.getLayout = ClinicEnquiries.getLayout;

export default ProtectedDashboard;
