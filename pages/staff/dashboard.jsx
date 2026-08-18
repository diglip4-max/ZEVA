import React, { useState, useEffect } from "react";
import AgentLayout from "../../components/AgentLayout"; // ✅ use Agent layout
import withAgentAuth from "../../components/withAgentAuth"; // ✅ use Agent auth
import { AuroraBackground } from "@/components/ui/aurora-bento-grid";
import { Typewriter } from "@/components/ui/typewriter-text";
import axios from "axios";
import { useRouter } from "next/router";
import { Calendar, TrendingUp, Layers, User as UserIcon, ChevronDown } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useCurrency } from "@/context/CurrencyContext";

// Import modular dashboard components
import DashboardHeader from "../../components/staff-dashboard/DashboardHeader";
import RevenueOpportunity from "../../components/staff-dashboard/RevenueOpportunity";
import Priorities from "../../components/staff-dashboard/Priorities";
import ZevaRecommends from "../../components/staff-dashboard/ZevaRecommends";
import AppointmentTimeline from "../../components/staff-dashboard/AppointmentTimeline";
import WaitingRoom from "../../components/staff-dashboard/WaitingRoom";
import HotLeads from "../../components/staff-dashboard/HotLeads";
import RevenueRescue from "../../components/staff-dashboard/RevenueRescue";
import OpenSlots from "../../components/staff-dashboard/OpenSlots";
import FollowUps from "../../components/staff-dashboard/FollowUps";
import WinBack from "../../components/staff-dashboard/WinBack";
import Renewals from "../../components/staff-dashboard/Renewals";
import InboxOpportunities from "../../components/staff-dashboard/InboxOpportunities";
import TodayPerformance from "../../components/staff-dashboard/TodayPerformance";
import FrontDeskStatus from "../../components/staff-dashboard/FrontDeskStatus";
import CommissionsSummary from "../../components/staff-dashboard/CommissionsSummary";
import OperationsModules from "../../components/staff-dashboard/OperationsModules";


const AgentDashboard = () => {
  const { currency } = useCurrency();
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [navigationItems, setNavigationItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Commission states
  const [commissions, setCommissions] = useState([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [chartView, setChartView] = useState("month"); // "month" or "date"
  const [timePeriod, setTimePeriod] = useState("morning"); // "morning" | "afternoon" | "evening"
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [showCalendar, setShowCalendar] = useState(false);

  const variantStyles = {
    red: {
      bg: "bg-red-50 dark:bg-red-500/5",
      border: "border-red-200 dark:border-red-500/30",
      hoverBorder: "hover:border-red-300 dark:hover:border-red-500/50",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-500/5",
      border: "border-orange-200 dark:border-orange-500/30",
      hoverBorder: "hover:border-orange-300 dark:hover:border-orange-500/50",
    },
    yellow: {
      bg: "bg-amber-50 dark:bg-amber-500/5",
      border: "border-amber-200 dark:border-amber-500/30",
      hoverBorder: "hover:border-amber-300 dark:hover:border-amber-500/50",
    },
    green: {
      bg: "bg-emerald-50 dark:bg-emerald-500/5",
      border: "border-emerald-200 dark:border-emerald-500/30",
      hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
    },
  };

  const zevaRecommendation = {
    slot: {
      title: "Fill the 4:30 PM opening before it becomes lost capacity.",
      doctor: "Dr. Mehta",
      department: "Dermatology",
      time: "4:30 PM",
    },
    patients: [
      {
        rank: 1,
        initials: "SA",
        initialsBg: "bg-red-500",
        name: "Sarah Ahmed",
        detail: "Hot lead · 87% booking lik...",
        percent: 87,
        percentColor: "text-indigo-600 dark:text-indigo-400",
        percentBg: "bg-indigo-100 dark:bg-indigo-500/15",
      },
      {
        rank: 2,
        initials: "AK",
        initialsBg: "bg-red-500",
        name: "Ahmed Khan",
        detail: "Requested an earlier appointment",
        percent: null,
      },
      {
        rank: 3,
        initials: "MJ",
        initialsBg: "bg-red-500",
        name: "Maria Joseph",
        detail: "Follow-up due today",
        percent: null,
      },
    ],
    foundCount: 5,
  };

  const appointmentStats = {
    total: 38,
    confirmed: 26,
    pending: 4,
    cancelled: 2,
    waiting: 4,
  };

  const appointmentTimeline = [
    {
      time: "09:30",
      initials: "SA",
      initialsBg: "bg-red-500",
      name: "Sarah Ahmed",
      department: "Dermatology",
      doctor: "Dr. Mehta",
      status: "Confirmed",
      statusStyle: {
        bg: "bg-emerald-100 dark:bg-emerald-500/15",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
      },
      highlight: true,
    },
    {
      time: "10:15",
      initials: "MA",
      initialsBg: "bg-red-500",
      name: "Mohammed Ali",
      department: "Dental",
      doctor: "Dr. Priya",
      status: "Checked in",
      statusStyle: {
        bg: "bg-blue-100 dark:bg-blue-500/15",
        text: "text-blue-700 dark:text-blue-400",
        dot: "bg-blue-500",
      },
    },
    {
      time: "11:00",
      initials: "AK",
      initialsBg: "bg-red-500",
      name: "Aisha Khan",
      department: "Physiotherapy",
      doctor: "Dr. Mehta",
      status: "Pending",
      statusStyle: {
        bg: "bg-amber-100 dark:bg-amber-500/15",
        text: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
      },
    },
    {
      time: "12:30",
      initials: "JM",
      initialsBg: "bg-purple-500",
      name: "John Mathew",
      department: "Dental",
      doctor: "Dr. Priya",
      status: "Confirmed",
      statusStyle: {
        bg: "bg-emerald-100 dark:bg-emerald-500/15",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
      },
    },
    {
      time: "13:45",
      initials: "FM",
      initialsBg: "bg-amber-500",
      name: "Fatima Malik",
      department: "Dermatology",
      doctor: "Dr. Mehta",
      status: "Confirmed",
      statusStyle: {
        bg: "bg-emerald-100 dark:bg-emerald-500/15",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
      },
    },
    {
      time: "14:30",
      initials: "RS",
      initialsBg: "bg-amber-500",
      name: "Ravi Sharma",
      department: "Dermatology",
      doctor: "Dr. Priya",
      status: "Pending",
      statusStyle: {
        bg: "bg-amber-100 dark:bg-amber-500/15",
        text: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
      },
    },
  ];

  const waitingRoomPatients = [
    {
      id: 1,
      initials: "SA",
      initialsBg: "bg-red-500",
      name: "Sarah Ahmed",
      doctor: "Dr. Mehta",
      waitTime: "8 min",
      highlight: false,
      showClockIcon: false,
      timeColor: "text-gray-600 dark:text-gray-300",
    },
    {
      id: 2,
      initials: "HA",
      initialsBg: "bg-indigo-600",
      name: "Hassan Ali",
      doctor: "Dr. Priya",
      waitTime: "14 min",
      highlight: true,
      showClockIcon: true,
      timeColor: "text-amber-600 dark:text-amber-400",
    },
    {
      id: 3,
      initials: "AK",
      initialsBg: "bg-red-500",
      name: "Aisha Khan",
      doctor: "Dr. Mehta",
      waitTime: "4 min",
      highlight: false,
      showClockIcon: false,
      timeColor: "text-gray-600 dark:text-gray-300",
    },
  ];

  const hotLeads = [
    {
      id: 1,
      initials: "SA",
      initialsBg: "bg-red-500",
      name: "Sarah Ahmed",
      waitTime: "4 min wait",
      waitTimeBg: "bg-amber-50 dark:bg-amber-500/10",
      waitTimeColor: "text-amber-700 dark:text-amber-400",
      details: "Dermatology · Asked about pricing",
      progressPercent: 87,
      progressBarColor: "bg-indigo-600",
      progressTextColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      id: 2,
      initials: "AK",
      initialsBg: "bg-red-500",
      name: "Ahmed Khan",
      waitTime: "18 min wait",
      waitTimeBg: "bg-amber-50 dark:bg-amber-500/10",
      waitTimeColor: "text-amber-700 dark:text-amber-400",
      details: "Dental · Asked for availability",
      progressPercent: 78,
      progressBarColor: "bg-sky-500",
      progressTextColor: "text-sky-600 dark:text-sky-400",
    },
    {
      id: 3,
      initials: "PR",
      initialsBg: "bg-purple-500",
      name: "Priya Raj",
      waitTime: null,
      details: "Physiotherapy · Returning patient",
      progressPercent: 72,
      progressBarColor: "bg-purple-500",
      progressTextColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  const revenueRescueStats = [
    {
      id: 1,
      title: "4 abandoned enquiries",
      amount: "AED 3,200",
      amountColor: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-500/10",
    },
    {
      id: 2,
      title: "3 cancelled appointments",
      amount: "AED 1,800",
      amountColor: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      id: 3,
      title: "5 package renewals",
      amount: "AED 3,500",
      amountColor: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-500/10",
    },
    {
      id: 4,
      title: "8 overdue follow-ups",
      amount: "AED 2,600",
      amountColor: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-500/10",
    },
  ];

  const openSlotsDoctors = [
    {
      id: 1,
      initials: "DM",
      initialsBg: "bg-purple-500",
      name: "Dr. Mehta",
      department: "Dermatology",
      slots: [
        { time: "2:30 PM", patients: "5 suitable patients" },
        { time: "4:30 PM", patients: "5 suitable patients" },
      ],
    },
    {
      id: 2,
      initials: "DP",
      initialsBg: "bg-purple-500",
      name: "Dr. Priya",
      department: "Dental",
      slots: [
        { time: "5:00 PM", patients: "3 suitable patients" },
      ],
    },
  ];

  const followUpsCategories = [
    {
      id: 1,
      icon: "fire",
      label: "High intent",
      count: 3,
    },
    {
      id: 2,
      icon: "package",
      label: "Package renewal",
      count: 2,
    },
    {
      id: 3,
      icon: "revisit",
      label: "Revisit due",
      count: 2,
    },
    {
      id: 4,
      icon: "callback",
      label: "Callback requested",
      count: 1,
    },
  ];

  const winBackStats = [
    { count: 18, label: "High", color: "text-red-500 dark:text-red-400" },
    { count: 42, label: "Medium", color: "text-amber-500 dark:text-amber-400" },
    { count: 68, label: "Low", color: "text-gray-400 dark:text-gray-500" },
    { count: 128, label: "Dormant", color: "text-gray-700 dark:text-gray-300" },
  ];

  const winBackPatients = [
    {
      id: 1,
      initials: "SA",
      initialsBg: "bg-red-500",
      name: "Sarah Ahmed",
      detail: "Last visit 84 days ago · typical 35d interval",
      action: "Invite for follow-up",
      actionColor: "text-purple-600 dark:text-purple-400",
    },
    {
      id: 2,
      initials: "KN",
      initialsBg: "bg-emerald-500",
      name: "Khalid Nasser",
      detail: "Last visit 62 days ago · typical 28d interval",
      action: "Offer package renewal",
      actionColor: "text-purple-600 dark:text-purple-400",
    },
    {
      id: 3,
      initials: "RA",
      initialsBg: "bg-amber-500",
      name: "Reem Al Farsi",
      detail: "Last visit 55 days ago · typical 21d interval",
      action: "Confirm revisit",
      actionColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  const renewalsData = [
    {
      id: 1,
      initials: "HA",
      initialsBg: "bg-indigo-500",
      name: "Hassan Ali",
      package: "Physiotherapy Package",
      detail: "2 sessions left · AED 900 value",
      expireBadge: "Expires in 6d",
      expireBg: "bg-amber-50 dark:bg-amber-500/10",
      expireColor: "text-amber-700 dark:text-amber-400",
    },
    {
      id: 2,
      initials: "FM",
      initialsBg: "bg-amber-500",
      name: "Fatima Malik",
      package: "Dermatology Bundle",
      detail: "1 sessions left · AED 1,400 value",
      expireBadge: "Expires in 3d",
      expireBg: "bg-red-50 dark:bg-red-500/10",
      expireColor: "text-red-700 dark:text-red-400",
    },
  ];

  const inboxOpportunities = [
    {
      id: 1,
      initials: "SA",
      initialsBg: "bg-red-500",
      name: "Sarah Ahmed",
      department: "Laser Treatment",
      likelyPercent: 87,
      patientMessage: "How much is the laser treatment?",
      ourResponse: "AED 650 for a full session.",
      suggestion: "Offer available appointment times.",
    },
    {
      id: 2,
      initials: "AK",
      initialsBg: "bg-red-500",
      name: "Ahmed Khan",
      department: "Dental",
      likelyPercent: 78,
      patientMessage: "Is Dr. Priya available tomorrow morning?",
      ourResponse: null,
      suggestion: "Send available slots for tomorrow 9 AM–1 PM.",
    },
  ];

  const todayPerformance = [
    {
      id: 1,
      titleLines: ["BOOKINGS"],
      value: "31 / 40",
      subText: null,
      progressPercent: 77.5,
      progressColor: "bg-indigo-600",
    },
    {
      id: 2,
      titleLines: ["REVENUE", "BOOKED"],
      value: "AED 18,420",
      subText: "target AED 24,000",
      progressPercent: 76.75,
      progressColor: "bg-emerald-500",
    },
    {
      id: 3,
      titleLines: ["LEAD →", "BOOKING"],
      value: "29%",
      subText: "+4% vs yesterday",
      progressPercent: 29,
      progressColor: "bg-purple-500",
    },
    {
      id: 4,
      titleLines: ["AVG", "RESPONSE"],
      value: "4m 12s",
      subText: "target < 5 min",
      progressPercent: 84,
      progressColor: "bg-amber-500",
    },
    {
      id: 5,
      titleLines: ["RECOVERED"],
      value: "3",
      subText: "bookings rescued",
      progressPercent: 30,
      progressColor: "bg-sky-500",
    },
    {
      id: 6,
      titleLines: ["REVENUE", "RESCUED"],
      value: "AED 3,200",
      subText: "from 3 opportunities",
      progressPercent: 32,
      progressColor: "bg-red-500",
    },
  ];

  const frontDeskStatus = [
    { id: 1, label: "Appointments", dotColor: "bg-emerald-500", value: "On track", valueColor: "text-emerald-600 dark:text-emerald-400" },
    { id: 2, label: "Patient waiting", dotColor: "bg-amber-500", value: "2 delayed", valueColor: "text-amber-600 dark:text-amber-400" },
    { id: 3, label: "Lead response", dotColor: "bg-blue-500", value: "4 min average", valueColor: "text-blue-600 dark:text-blue-400" },
    { id: 4, label: "Follow-ups", dotColor: "bg-amber-500", value: "3 remaining", valueColor: "text-amber-600 dark:text-amber-400" },
    { id: 5, label: "Tomorrow confirm", dotColor: "bg-amber-500", value: "6 pending", valueColor: "text-amber-600 dark:text-amber-400" },
    { id: 6, label: "Patient records", dotColor: "bg-emerald-500", value: "Complete", valueColor: "text-emerald-600 dark:text-emerald-400" },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Decode JWT token to get user info
    const getToken = () => {
      if (typeof window !== "undefined") {
        return (
          localStorage.getItem("agentToken") ||
          localStorage.getItem("userToken")
        );
      }
      return null;
    };

    const decodeToken = (token) => {
      try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return {
          name: payload.name || "",
          email: payload.email || "",
        };
      } catch (error) {
        console.error("Error decoding token:", error);
        return null;
      }
    };

    const token = getToken();
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUserInfo(decoded);
      }
    }
  }, []);

  // Fetch navigation items from the same API as sidebar (single source of truth)
  useEffect(() => {
    const fetchNavigationAndPermissions = async () => {
      try {
        setIsLoading(true);
        const agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") ||
            sessionStorage.getItem("agentToken")
            : null;
        const userToken =
          typeof window !== "undefined"
            ? localStorage.getItem("userToken") ||
            sessionStorage.getItem("userToken")
            : null;
        const token = agentToken || userToken;

        if (!token) {
          setNavigationItems([]);
          setIsLoading(false);
          return;
        }

        const res = await axios.get("/api/agent/sidebar-permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const filteredItems = (res.data.navigationItems || [])
            .filter((item) => {
              const isDashboard =
                item.path === "/agent/dashboard" ||
                item.path === "/agent/agent-dashboard" ||
                item.moduleKey?.toLowerCase().includes("dashboard");
              return !isDashboard && item.path;
            })
            .map((item) => ({
              label: item.label,
              path: item.path,
              icon: item.icon,
              description: item.description || item.label,
              moduleKey: item.moduleKey,
              order: item.order || 999,
              subModules: item.subModules || [],
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          setNavigationItems(filteredItems);
        } else {
          console.error("Error fetching navigation items:", res.data.message);
          setNavigationItems([]);
        }
      } catch (err) {
        console.error("Error fetching navigation items and permissions:", err);
        setNavigationItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationAndPermissions();

    const handleRouteChange = () => {
      fetchNavigationAndPermissions();
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  // Fetch Commissions
  useEffect(() => {
    const loadCommissions = async () => {
      try {
        const agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") ||
            sessionStorage.getItem("agentToken")
            : null;
        const userToken =
          typeof window !== "undefined"
            ? localStorage.getItem("userToken") ||
            sessionStorage.getItem("userToken")
            : null;
        const token = agentToken || userToken;

        if (!token) return;

        const res = await axios.get("/api/agent/commissions/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data && res.data.success) {
          setCommissions(res.data.items || []);
          setTotalCommission(res.data.totalCommission || 0);
        }
      } catch (err) {
        console.error("Error fetching commissions:", err);
      }
    };

    loadCommissions();
  }, []);

  // Format month-wise (Jan-Dec) data
  const getMonthlyData = () => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = monthNames.map((name) => ({ name, amount: 0 }));

    commissions.forEach((item) => {
      const dateVal = item.invoicedDate || item.createdAt;
      if (dateVal) {
        const date = new Date(dateVal);
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyMap[monthIndex].amount += Number(item.commissionAmount || 0);
        }
      }
    });

    return monthlyMap.map((d) => ({
      ...d,
      amount: Number(d.amount.toFixed(2)),
    }));
  };

  // Format date-wise data (Milestone Date wise)
  const getDateWiseData = () => {
    const dateMap = {};

    commissions.forEach((item) => {
      const dateVal = item.invoicedDate || item.createdAt;
      if (dateVal) {
        const formattedDate = new Date(dateVal).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        dateMap[formattedDate] = (dateMap[formattedDate] || 0) + Number(item.commissionAmount || 0);
      }
    });

    return Object.keys(dateMap)
      .map((dateStr) => ({
        name: dateStr,
        amount: Number(dateMap[dateStr].toFixed(2)),
        rawDate: new Date(dateStr),
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  };

  // Calculate current month commissions
  const getThisMonthCommission = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return commissions
      .filter((item) => {
        const dateVal = item.invoicedDate || item.createdAt;
        if (!dateVal) return false;
        const date = new Date(dateVal);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);
  };

  const renderIcon = (iconString) => {
    if (!iconString) return null;
    if (typeof iconString === "string" && iconString.length <= 2) {
      return <span className="text-2xl">{iconString}</span>;
    }
    return <span className="text-xl">{iconString}</span>;
  };

  const monthlyData = getMonthlyData();
  const dateWiseData = getDateWiseData();
  const thisMonthCommission = getThisMonthCommission();

  return (
    <div className="min-h-screen text-gray-900 dark:text-white relative overflow-hidden">
      <AuroraBackground />

      <div className="relative z-10 p-2 md:p-3">
        <div className="max-w-7xl mt-1 mx-auto">
          {/* Header Section */}
          <DashboardHeader
            userInfo={userInfo}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            showCalendar={showCalendar}
            setShowCalendar={setShowCalendar}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
          />

          {/* Today's Revenue Opportunity Card */}
          <RevenueOpportunity selectedDate={selectedDate} />

          {/* Your Priorities Section */}
          <Priorities
            selectedDate={selectedDate}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
          />

          {/* ZEVA Recommends + Appointment Timeline Section */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            <ZevaRecommends zevaRecommendation={zevaRecommendation} />
            <AppointmentTimeline
              appointmentStats={appointmentStats}
              appointmentTimeline={appointmentTimeline}
            />
          </div>

          {/* Waiting Room + Hot Leads Section */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            <WaitingRoom waitingRoomPatients={waitingRoomPatients} />
            <HotLeads hotLeads={hotLeads} />
          </div>

          {/* Revenue Rescue + Open Slots Section */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <RevenueRescue revenueRescueStats={revenueRescueStats} />
            <OpenSlots openSlotsDoctors={openSlotsDoctors} />
          </div>

          {/* Follow-ups + Win Back + Renewals Section */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            <FollowUps followUpsCategories={followUpsCategories} />
            <WinBack winBackStats={winBackStats} winBackPatients={winBackPatients} />
            <Renewals renewalsData={renewalsData} />
          </div>

          {/* Inbox Opportunities + Today's Performance + Front Desk Status Section */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            <InboxOpportunities inboxOpportunities={inboxOpportunities} />
            <TodayPerformance todayPerformance={todayPerformance} />
            <FrontDeskStatus frontDeskStatus={frontDeskStatus} />
          </div>

          {/* Commissions Overview Section */}
          <CommissionsSummary
            currency={currency}
            chartView={chartView}
            setChartView={setChartView}
            totalCommission={totalCommission}
            thisMonthCommission={thisMonthCommission}
            commissions={commissions}
            monthlyData={monthlyData}
            dateWiseData={dateWiseData}
            mounted={mounted}
          />

          {/* Permission-based Dashboard Cards */}
          <OperationsModules
            isLoading={isLoading}
            navigationItems={navigationItems}
            router={router}
          />
        </div>
      </div>
    </div>
  );
};

// ✅ Attach Agent layout
AgentDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

// ✅ Apply Agent Auth HOC
const ProtectedAgentDashboard = withAgentAuth(AgentDashboard);

// ✅ Reassign layout for the protected version
ProtectedAgentDashboard.getLayout = AgentDashboard.getLayout;

export default ProtectedAgentDashboard;
