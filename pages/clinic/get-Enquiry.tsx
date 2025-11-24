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

function ClinicEnquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "7d" | "30d">(
    "all"
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    const fetchEnquiries = async () => {
      try {
        const token = localStorage.getItem("clinicToken");
        if (!token) return;

        const res = await axios.get<EnquiriesResponse>("/api/clinics/getEnquiries", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setEnquiries(res.data.enquiries || []);
        setFilteredEnquiries(res.data.enquiries || []);
      } catch (err) {
        console.error("Error fetching enquiries:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEnquiries();
  }, []);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-black font-medium">Loading enquiries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#2D9AA5] rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  Patient Enquiries
                </h1>
                <p className="text-sm text-gray-500">
                  {enquiries.length} total enquiries
                </p>
              </div>
            </div>

            {/* Right: Count Display */}
            <div className="flex items-center gap-2 bg-[#2D9AA5]/5 px-4 py-2 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {enquiries.length}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 bg-gray-50">
              <div className="w-10 h-10 bg-[#2D9AA5]/10 flex items-center justify-center rounded-full">
                <Inbox className="w-5 h-5 text-[#2D9AA5]" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  Total Enquiries
                </p>
                <p className="text-xl font-semibold text-gray-900">
                  {totalEnquiries}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 bg-gray-50">
              <div className="w-10 h-10 bg-blue-100 flex items-center justify-center rounded-full">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  Today’s Enquiries
                </p>
                <p className="text-xl font-semibold text-gray-900">
                  {todaysEnquiries}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 bg-gray-50">
              <div className="w-10 h-10 bg-yellow-100 flex items-center justify-center rounded-full">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  Unread / Pending
                </p>
                <p className="text-xl font-semibold text-gray-900">
                  {unreadEnquiries}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 bg-gray-50">
              <div className="w-10 h-10 bg-purple-100 flex items-center justify-center rounded-full">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  Last Enquiry
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {lastEnquiryDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Search Bar & Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8 mx-1 sm:mx-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="bg-gray-100 p-2 sm:p-3 rounded-lg flex-shrink-0 self-start sm:self-center">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by name, email, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-black w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Filter by:</span>
              <select
                value={timeFilter}
                onChange={(e) =>
                  setTimeFilter(e.target.value as "all" | "today" | "7d" | "30d")
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] bg-white"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "newest" | "oldest")
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] bg-white"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          {searchTerm && (
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
              <span>Results for:</span>
              <span className="bg-[#2D9AA5]/10 text-[#2D9AA5] px-2 py-1 rounded-full font-medium break-all">
                &quot;{searchTerm}&quot;
              </span>
              <span>({filteredEnquiries.length} found)</span>
            </div>
          )}
        </div>

        {/* Enquiries List */}
        <div className="space-y-3 sm:space-y-4">
          {filteredEnquiries.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center mx-1 sm:mx-0">
              <div className="bg-gray-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? "No results found" : "No enquiries yet"}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 px-2">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "Patient enquiries will appear here when they contact your clinic."}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="bg-[#2D9AA5] text-white px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-[#247a83] transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            filteredEnquiries.map((enquiry) => (
              <div
                key={enquiry._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow mx-1 sm:mx-0"
              >
                {/* Card Header */}
                <div className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <div className="bg-[#2D9AA5]/10 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#2D9AA5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1 break-words">
                          {enquiry.name}
                        </h3>
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <a
                                href={`mailto:${enquiry.email}`}
                                className="text-[#2D9AA5] hover:text-[#247a83] transition-colors text-xs sm:text-sm break-all"
                              >
                                {enquiry.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1 sm:mt-0">
                      <Calendar className="w-3 h-3 flex-shrink-0 mr-1" />
                      <span className="break-words">
                        {new Date(enquiry.createdAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  {/* Message */}
                  <div className="mt-3">
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                      <div className="flex items-start space-x-1 mb-1">
                        <MessageSquare className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                        <span className="font-medium text-gray-900 text-xs sm:text-sm">
                          Message:
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed pl-4 text-xs sm:text-sm break-words">
                        &quot;{enquiry.message}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

ClinicEnquiries.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

// ✅ Apply HOC and assign correct type
const ProtectedDashboard: NextPageWithLayout = withClinicAuth(ClinicEnquiries);

// ✅ Reassign layout (TS-safe now)
ProtectedDashboard.getLayout = ClinicEnquiries.getLayout;

export default ProtectedDashboard;
