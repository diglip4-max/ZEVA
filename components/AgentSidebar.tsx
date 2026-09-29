"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import React, { FC, useEffect, useState } from "react";
import clsx from "clsx";
import axios from "axios";
import {
  BarChart3, Users, FileText, Briefcase, MessageSquare, Calendar, CreditCard,
  Star, Mail, TrendingUp, Lock, LayoutDashboard, Stethoscope, Building2,
  UserCircle, Menu, Inbox, UserPlus, ClipboardList, Gift, UserCog, PenTool,
  Eye, Phone, MessageCircle, Send, FileEdit, HelpCircle,
  Bell, CalendarCheck, CalendarDays, Clock, DollarSign, Package, ShoppingBag,
  Heart, Activity, Zap, Target, Award, Shield, BookOpen, Newspaper, Image,
  Video, Music, Folder, File, Database, Server, Cloud, Wifi, Globe,
  Link as LinkIcon, Share2, Download, Upload, RefreshCw, Search, Filter,
  MoreHorizontal, Plus, Minus, Edit, Trash2, Save, XCircle, Info,
  CheckCircle, AlertTriangle, Megaphone, Home, ClipboardCheck,
  Wallet, Tag, ChevronDown,
  Receipt as Billing,
} from "lucide-react";
import useZevaConnect from "@/hooks/useZevaConnect";

interface NavItemChild {
  label: string;
  path?: string;
  icon: string;
  description?: string;
  badge?: number;
  permissionKey?: string;
  order?: number;
  onClick?: () => void;
  permissions?: Record<string, boolean> | null;
}

interface NavItem extends NavItemChild {
  children?: NavItemChild[];
  moduleKey?: string;
  headerPath?: string;
  permissions?: Record<string, boolean> | null;
}

interface NavigationItemFromAPI {
  _id: string;
  label: string;
  path?: string;
  icon: string;
  description?: string;
  order: number;
  moduleKey: string;
  permissions?: Record<string, boolean> | null;
  subModules?: Array<{
    name: string;
    path?: string;
    icon: string;
    order: number;
    permissions?: Record<string, boolean> | null;
  }>;
}

interface AgentSidebarProps {
  className?: string;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
  handleToggleDesktop: () => void;
  handleCloseMobile: () => void;
  handleItemClick: () => void;
}

// Professional icon mapping - using Lucide React icons (same as ClinicSidebar)
const iconMap: { [key: string]: React.ReactNode } = {
  "📊": <BarChart3 className="w-4 h-4 text-[#6B7280]" />,
  "🏠": <LayoutDashboard className="w-4 h-4 text-[#6B7280]" />,
  "📈": <TrendingUp className="w-4 h-4 text-[#6B7280]" />,
  "📉": <Activity className="w-4 h-4 text-[#6B7280]" />,
  "⚡": <Zap className="w-4 h-4 text-[#6B7280]" />,
  "🎯": <Target className="w-4 h-4 text-[#6B7280]" />,
  home: <Home className="w-4 h-4 text-[#6B7280]" />,
  dashboard: <LayoutDashboard className="w-4 h-4 text-[#6B7280]" />,
  analytics: <BarChart3 className="w-4 h-4 text-[#6B7280]" />,
  reports: <BarChart3 className="w-4 h-4 text-[#6B7280]" />,
  overview: <Activity className="w-4 h-4 text-[#6B7280]" />,
  "👥": <Users className="w-4 h-4 text-[#6B7280]" />,
  "👤": <UserCircle className="w-4 h-4 text-[#6B7280]" />,
  "👨‍⚕️": <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  "👨‍💼": <UserCog className="w-4 h-4 text-[#6B7280]" />,
  "👨‍🔬": <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  users: <Users className="w-4 h-4 text-[#6B7280]" />,
  patients: <UserCircle className="w-4 h-4 text-[#6B7280]" />,
  doctors: <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  staff: <UserCog className="w-4 h-4 text-[#6B7280]" />,
  agents: <UserPlus className="w-4 h-4 text-[#6B7280]" />,
  team: <Users className="w-4 h-4 text-[#6B7280]" />,
  profile: <UserCircle className="w-4 h-4 text-[#6B7280]" />,
  "💬": <MessageSquare className="w-4 h-4 text-[#6B7280]" />,
  "📧": <Mail className="w-4 h-4 text-[#6B7280]" />,
  "📨": <Inbox className="w-4 h-4 text-[#6B7280]" />,
  "💭": <MessageCircle className="w-4 h-4 text-[#6B7280]" />,
  "📱": <Phone className="w-4 h-4 text-[#6B7280]" />,
  "📤": <Send className="w-4 h-4 text-[#6B7280]" />,
  messages: <MessageSquare className="w-4 h-4 text-[#6B7280]" />,
  chat: <MessageCircle className="w-4 h-4 text-[#6B7280]" />,
  email: <Mail className="w-4 h-4 text-[#6B7280]" />,
  inbox: <Inbox className="w-4 h-4 text-[#6B7280]" />,
  notifications: <Bell className="w-4 h-4 text-[#6B7280]" />,
  calls: <Phone className="w-4 h-4 text-[#6B7280]" />,
  "📅": <Calendar className="w-4 h-4 text-[#6B7280]" />,
  "📆": <CalendarDays className="w-4 h-4 text-[#6B7280]" />,
  "📅✅": <CalendarCheck className="w-4 h-4 text-[#6B7280]" />,
  "⏰": <Clock className="w-4 h-4 text-[#6B7280]" />,
  "🗓️": <CalendarCheck className="w-4 h-4 text-[#6B7280]" />,
  appointments: <Calendar className="w-4 h-4 text-[#6B7280]" />,
  schedule: <CalendarDays className="w-4 h-4 text-[#6B7280]" />,
  calendar: <Calendar className="w-4 h-4 text-[#6B7280]" />,
  time: <Clock className="w-4 h-4 text-[#6B7280]" />,
  booking: <CalendarCheck className="w-4 h-4 text-[#6B7280]" />,
  slots: <Clock className="w-4 h-4 text-[#6B7280]" />,
  "bar-chart": <BarChart3 className="w-4 h-4 text-[#6B7280]" />,
  "dollar-sign": <DollarSign className="w-4 h-4 text-[#6B7280]" />,
  "📝": <FileText className="w-4 h-4 text-[#6B7280]" />,
  "📄": <File className="w-4 h-4 text-[#6B7280]" />,
  "📑": <FileEdit className="w-4 h-4 text-[#6B7280]" />,
  "📋": <ClipboardList className="w-4 h-4 text-[#6B7280]" />,
  "📚": <BookOpen className="w-4 h-4 text-[#6B7280]" />,
  "📰": <Newspaper className="w-4 h-4 text-[#6B7280]" />,
  "✍️": <PenTool className="w-4 h-4 text-[#6B7280]" />,
  documents: <FileText className="w-4 h-4 text-[#6B7280]" />,
  files: <File className="w-4 h-4 text-[#6B7280]" />,
  records: <ClipboardCheck className="w-4 h-4 text-[#6B7280]" />,
  prescriptions: <FileText className="w-4 h-4 text-[#6B7280]" />,
  notes: <FileEdit className="w-4 h-4 text-[#6B7280]" />,
  forms: <ClipboardList className="w-4 h-4 text-[#6B7280]" />,
  "💼": <Briefcase className="w-4 h-4 text-[#6B7280]" />,
  "🏢": <Building2 className="w-4 h-4 text-[#6B7280]" />,
  "🏥": <Building2 className="w-4 h-4 text-[#6B7280]" />,
  "🩺": <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  clinic: <Building2 className="w-4 h-4 text-[#6B7280]" />,
  business: <Briefcase className="w-4 h-4 text-[#6B7280]" />,
  medical: <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  health: <Heart className="w-4 h-4 text-[#6B7280]" />,
  treatments: <Stethoscope className="w-4 h-4 text-[#6B7280]" />,
  "❤️": <Heart className="w-4 h-4 text-[#6B7280]" />,
  "💊": <Package className="w-4 h-4 text-[#6B7280]" />,
  "⭐": <Star className="w-4 h-4 text-[#6B7280]" />,
  "👁️": <Eye className="w-4 h-4 text-[#6B7280]" />,
  "🏆": <Award className="w-4 h-4 text-[#6B7280]" />,
  reviews: <Star className="w-4 h-4 text-[#6B7280]" />,
  feedback: <MessageSquare className="w-4 h-4 text-[#6B7280]" />,
  "🎁": <Gift className="w-4 h-4 text-[#6B7280]" />,
  "🎉": <Package className="w-4 h-4 text-[#6B7280]" />,
  "🛍️": <ShoppingBag className="w-4 h-4 text-[#6B7280]" />,
  offers: <Tag className="w-4 h-4 text-[#6B7280]" />,
  packages: <Package className="w-4 h-4 text-[#6B7280]" />,
  package: <Package className="w-4 h-4 text-[#6B7280]" />,
  "💳": <CreditCard className="w-4 h-4 text-[#6B7280]" />,
  "💰": <DollarSign className="w-4 h-4 text-[#6B7280]" />,
  payments: <CreditCard className="w-4 h-4 text-[#6B7280]" />,
  billing: <Billing className="w-4 h-4 text-[#6B7280]" />,
  invoices: <FileText className="w-4 h-4 text-[#6B7280]" />,
  revenue: <TrendingUp className="w-4 h-4 text-[#6B7280]" />,
  wallet: <Wallet className="w-4 h-4 text-[#6B7280]" />,
  "🔒": <Lock className="w-4 h-4 text-[#6B7280]" />,
  "🛡️": <Shield className="w-4 h-4 text-[#6B7280]" />,
  security: <Shield className="w-4 h-4 text-[#6B7280]" />,
  permissions: <Lock className="w-4 h-4 text-[#6B7280]" />,
  "🔔": <Bell className="w-4 h-4 text-[#6B7280]" />,
  "⚠️": <AlertTriangle className="w-4 h-4 text-[#6B7280]" />,
  ℹ️: <Info className="w-4 h-4 text-[#6B7280]" />,
  "❓": <HelpCircle className="w-4 h-4 text-[#6B7280]" />,
  "✅": <CheckCircle className="w-4 h-4 text-[#6B7280]" />,
  "❌": <XCircle className="w-4 h-4 text-[#6B7280]" />,
  "🖼️": <Image className="w-4 h-4 text-[#6B7280]" />,
  "🎬": <Video className="w-4 h-4 text-[#6B7280]" />,
  "🎵": <Music className="w-4 h-4 text-[#6B7280]" />,
  "➕": <Plus className="w-4 h-4 text-[#6B7280]" />,
  "➖": <Minus className="w-4 h-4 text-[#6B7280]" />,
  "✏️": <Edit className="w-4 h-4 text-[#6B7280]" />,
  "🗑️": <Trash2 className="w-4 h-4 text-[#6B7280]" />,
  "💾": <Save className="w-4 h-4 text-[#6B7280]" />,
  "🔍": <Search className="w-4 h-4 text-[#6B7280]" />,
  "🔎": <Filter className="w-4 h-4 text-[#6B7280]" />,
  "🔄": <RefreshCw className="w-4 h-4 text-[#6B7280]" />,
  "⬇️": <Download className="w-4 h-4 text-[#6B7280]" />,
  "⬆️": <Upload className="w-4 h-4 text-[#6B7280]" />,
  "🔗": <LinkIcon className="w-4 h-4 text-[#6B7280]" />,
  "🔀": <Share2 className="w-4 h-4 text-[#6B7280]" />,
  "⋯": <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />,
  "📁": <Folder className="w-4 h-4 text-[#6B7280]" />,
  "🗄️": <Database className="w-4 h-4 text-[#6B7280]" />,
  "🖥️": <Server className="w-4 h-4 text-[#6B7280]" />,
  "☁️": <Cloud className="w-4 h-4 text-[#6B7280]" />,
  "🌐": <Globe className="w-4 h-4 text-[#6B7280]" />,
  "📶": <Wifi className="w-4 h-4 text-[#6B7280]" />,
  leads: <Target className="w-4 h-4 text-[#6B7280]" />,
  sales: <TrendingUp className="w-4 h-4 text-[#6B7280]" />,
  campaigns: <Megaphone className="w-4 h-4 text-[#6B7280]" />,
  marketing: <Target className="w-4 h-4 text-[#6B7280]" />,
  "connect-icon": <MessageSquare className="w-4 h-4 text-[#6B7280]" />,
  "chat-icon": <MessageCircle className="w-4 h-4 text-[#6B7280]" />,
};

const renderIcon = (key: string, isActive: boolean = false) => {
  let node = iconMap[key];
  if (!node) {
    if (key.includes("📊") || key.includes("dashboard") || key.includes("analytics"))
      node = <BarChart3 className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("👥") || key.includes("users") || key.includes("staff"))
      node = <Users className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📝") || key.includes("file") || key.includes("text"))
      node = <FileText className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("💼") || key.includes("business"))
      node = <Briefcase className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("💬") || key.includes("message"))
      node = <MessageSquare className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📅") || key.includes("calendar") || key.includes("appointment"))
      node = <Calendar className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("💳") || key.includes("credit") || key.includes("payment"))
      node = <CreditCard className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("⭐") || key.includes("star") || key.includes("review"))
      node = <Star className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📧") || key.includes("mail"))
      node = <Mail className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📈") || key.includes("trending"))
      node = <TrendingUp className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🔒") || key.includes("lock") || key.includes("security"))
      node = <Lock className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🏠") || key.includes("home"))
      node = <LayoutDashboard className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🩺") || key.includes("stethoscope") || key.includes("doctor") || key.includes("medical"))
      node = <Stethoscope className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🏢") || key.includes("building") || key.includes("clinic"))
      node = <Building2 className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("👤") || key.includes("user") || key.includes("patient"))
      node = <UserCircle className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📨") || key.includes("inbox"))
      node = <Inbox className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🎁") || key.includes("gift") || key.includes("offer"))
      node = <Gift className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📋") || key.includes("clipboard") || key.includes("list"))
      node = <ClipboardList className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("💰") || key.includes("dollar") || key.includes("finance"))
      node = <DollarSign className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📦") || key.includes("package") || key.includes("box"))
      node = <Package className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🔔") || key.includes("bell") || key.includes("notification"))
      node = <Bell className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🎯") || key.includes("target") || key.includes("marketing") || key.includes("lead"))
      node = <Target className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📢") || key.includes("megaphone") || key.includes("campaign"))
      node = <Megaphone className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🌐") || key.includes("globe"))
      node = <Globe className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🔗") || key.includes("link") || key.includes("connect"))
      node = <LinkIcon className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("📊") || key.includes("chart") || key.includes("report"))
      node = <BarChart3 className="w-4 h-4 text-[#6B7280]" />;
    else if (key.includes("🗄️") || key.includes("database") || key.includes("stock"))
      node = <Database className="w-4 h-4 text-[#6B7280]" />;
    else
      node = <FileText className="w-4 h-4 text-[#6B7280]" />;
  }
  if (React.isValidElement(node)) {
    return React.cloneElement(node as React.ReactElement<any>, {
      className: `w-4 h-4 ${isActive ? "text-white" : "text-[#6B7280]"}`,
    });
  }
  return node;
};

const AgentSidebar: FC<AgentSidebarProps> = ({
  className,
  isDesktopHidden,
  isMobileOpen,
  handleToggleDesktop,
  handleCloseMobile,
  handleItemClick,
}) => {
  const router = useRouter();
  const { handleZevaConnect } = useZevaConnect();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [items, setItems] = useState<NavItem[]>([]);
  const [_permissions, setPermissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Map labels to module keys (same as ClinicSidebar)
  const labelToModuleKey: Record<string, string> = {
    "Manage Health Center": "clinic_health_center",
    "Create Offers": "clinic_create_offers",
    "User Package": "Clinic_user_package",
    "Service Setup": "Clinic_services_setup",
    "Setup & Operation": "clinic_addRoom",
    "Consent Form": "Clinic_consent_Form",
    "Job Posting": "clinic_job_posting",
    Commission: "clinic_commission",
    Claims: "claims",
    "Pass By Doctor": "pass_by_doctor",
    "Release Requested": "release_requested",
    "Doctor's Claim": "doctor_claim",
    "Create Claim": "create_claim",
    "Clinic Management": "clinic_management",
    "Assigned Leads": "assignedLead",
    Referral: "clinic_referal",
    Referal: "clinic_referal",
    "Track-Members": "clinic_Track",
    "Track Members": "clinic_Track",
    "Create Agent": "clinic_create_agent",
    "Create Lead": "clinic_create_lead",
    Inbox: "clinic_inbox",
    "Email Inbox": "clinic_email_inbox",
    "KAKA Customization": "clinic_kaka_customization",
    Templates: "clinic_templates",
    Providers: "clinic_providers",
    Reviews: "clinic_review",
    Enquiry: "clinic_enquiry",
    Campaigns: "Clinic_Campaigns",
    Automation: "Clinic_Automation",
    "Write Blog": "clinic_write_blog",
    Locations: "clinic_stock_locations",
    "Stock Locations": "clinic_stock_locations",
    Suppliers: "clinic_stock_suppliers",
    UOM: "clinic_stock_uom",
    "Purchase Requests": "clinic_stock_purchase_requests",
    "Purchase Orders": "clinic_stock_purchase_orders",
    GRN: "clinic_stock_grn",
    "Good Receive Note": "clinic_stock_grn",
    "Purchase Invoices": "clinic_stock_purchase_invoices",
    "Purchase Returns": "clinic_stock_purchase_return",
    "Stock Quantity Adjustment": "clinic_stock_qty_adjustment",
    "Stock Qty Adjustment": "clinic_stock_qty_adjustment",
    "Material Consumptions": "clinic_stock_material_consumptions",
    "Material Activity Consumption": "clinic_stock_material_consumptions",
    "Direct Stock Transfer": "clinic_stock_direct_transfer",
    "Stock Transfer Request": "clinic_stock_transfer_requests",
    "Transfer Stock On Request": "clinic_stock_transfer_on_request",
    "Allocated Stock Items": "clinic_stock_allocated_stock_items",
    "Custom Stock Items": "custom_stock_items",
    "Sale Products": "custom_product_sales",
    "Policy & Compliance": "clinic_compliance",
    Authentication: "clinic_authentication",
    "Book Appointments": "clinic_Appointment",
    "Scheduled Appointments": "clinic_ScheduledAppointment",
    "Patient Registration": "clinic_patient_registration",
    "Patient Information": "patient_information",
    "Add Expense": "add_expense",
    "Petty Cash": "clinic_pettycash",
    Reports: "clinic_report",
    "KAKA Analytics": "clinic_kaka_analytics",
    "Workflow Guide": "workflow_guide",
    Membership: "membership",
    Invoices: "clinic_invoices",
    "Zeva Connect": "clinic_zeva_connect",
    "Team Chat": "clinic_team_chat",
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        handleCloseMobile();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen, handleCloseMobile]);

  // Fetch navigation items and permissions — build static grouped modules (same as ClinicSidebar)
  useEffect(() => {
    const fetchNavigationAndPermissions = async () => {
      try {
        const agentToken =
          typeof window !== "undefined"
            ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")
            : null;
        const userToken =
          typeof window !== "undefined"
            ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken")
            : null;
        const token = agentToken || userToken;

        if (!token) {
          setItems([]);
          setIsLoading(false);
          return;
        }

        const res = await axios.get("/api/agent/sidebar-permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const localPermissions = res.data.permissions && Array.isArray(res.data.permissions) ? res.data.permissions : [];
          setPermissions(localPermissions);

          // Permission check helpers (same logic as ClinicSidebar)
          const localIsActionTrue = (action: any): boolean =>
            action === true || action === "true" || String(action).toLowerCase() === "true";

          // Check ONLY parent module's subModules (bypasses top-level module check)
          const localHasSubModulePermission = (parentModuleKey: string, label: string): boolean => {
            if (!localPermissions || localPermissions.length === 0) return true;
            const parentPerm = localPermissions.find((p: any) => p.module === parentModuleKey);
            if (!parentPerm?.subModules || !Array.isArray(parentPerm.subModules)) return false;
            const subModule = parentPerm.subModules.find((sm: any) => {
              const smName = sm.name?.trim().toLowerCase() || "";
              const lbl = label.trim().toLowerCase();
              return smName === lbl || smName.includes(lbl) || lbl.includes(smName) ||
                // Special cases (same as ClinicSidebar)
                (lbl === "grn" && smName === "good receive note") ||
                (lbl === "locations" && smName === "stock locations") ||
                (lbl === "templates" && smName === "template") ||
                (lbl === "reviews" && smName === "review") ||
                (lbl === "inbox" && smName === "inbox") ||
                (lbl === "pass by doctor" && smName === "pass by doctor") ||
                (lbl === "release requested" && smName === "release requested") ||
                (lbl === "sale products" && smName === "sale products");
            });
            if (subModule?.actions) {
              return localIsActionTrue(subModule.actions.all) || localIsActionTrue(subModule.actions.create) ||
                localIsActionTrue(subModule.actions.read) || localIsActionTrue(subModule.actions.update) ||
                localIsActionTrue(subModule.actions.delete) || localIsActionTrue(subModule.actions.print) ||
                localIsActionTrue(subModule.actions.export) || localIsActionTrue(subModule.actions.approve);
            }
            return false;
          };

          const localHasModulePermission = (moduleKey: string, label?: string): boolean => {
            if (!localPermissions || localPermissions.length === 0) return true;
            let keysToCheck = [moduleKey];
            if (moduleKey.includes("referral")) keysToCheck.push(moduleKey.replace("referral", "referal"));
            if (moduleKey.includes("referal")) keysToCheck.push(moduleKey.replace("referal", "referral"));
            const moduleCandidates = Array.from(
              new Set(keysToCheck.flatMap((key) => [
                key,
                key?.replace(/^(admin|clinic|doctor)_/, ""),
                key ? `admin_${key.replace(/^(admin|clinic|doctor)_/, "")}` : null,
                key ? `clinic_${key.replace(/^(admin|clinic|doctor)_/, "")}` : null,
                key ? `doctor_${key.replace(/^(admin|clinic|doctor)_/, "")}` : null,
              ]).filter(Boolean))
            );
            const modulePerm = localPermissions.find((p: any) => {
              const permModule = p.module || "";
              return moduleCandidates.some((candidate) =>
                permModule === candidate ||
                permModule.replace(/^(admin|clinic|doctor)_/, "") === (candidate as string).replace(/^(admin|clinic|doctor)_/, "")
              );
            });
            if (modulePerm) {
              const actions = modulePerm.actions || {};
              return localIsActionTrue(actions.all) || localIsActionTrue(actions.create) || localIsActionTrue(actions.read) ||
                localIsActionTrue(actions.update) || localIsActionTrue(actions.delete) || localIsActionTrue(actions.print) ||
                localIsActionTrue(actions.export) || localIsActionTrue(actions.approve);
            }
            if (label) {
              for (const parentModuleKey of ["clinic_stock", "clinic_marketing", "claims"]) {
                const parentPerm = localPermissions.find((p: any) => p.module === parentModuleKey);
                if (parentPerm?.subModules && Array.isArray(parentPerm.subModules)) {
                  const subModule = parentPerm.subModules.find((sm: any) => {
                    const smName = sm.name?.trim().toLowerCase() || "";
                    const lbl = label.trim().toLowerCase();
                    return smName === lbl || smName.includes(lbl) || lbl.includes(smName) ||
                      // Special cases (same as ClinicSidebar)
                      (lbl === "grn" && smName === "good receive note") ||
                      (lbl === "locations" && smName === "stock locations") ||
                      (lbl === "templates" && smName === "template") ||
                      (lbl === "reviews" && smName === "review") ||
                      (lbl === "inbox" && smName === "inbox") ||
                      (lbl === "pass by doctor" && smName === "pass by doctor") ||
                      (lbl === "release requested" && smName === "release requested") ||
                      (lbl === "sale products" && smName === "sale products");
                  });
                  if (subModule?.actions) {
                    return localIsActionTrue(subModule.actions.all) || localIsActionTrue(subModule.actions.create) ||
                      localIsActionTrue(subModule.actions.read) || localIsActionTrue(subModule.actions.update) ||
                      localIsActionTrue(subModule.actions.delete) || localIsActionTrue(subModule.actions.print) ||
                      localIsActionTrue(subModule.actions.export) || localIsActionTrue(subModule.actions.approve);
                  }
                }
              }
            }
            return false;
          };

          const localShouldShowItem = (item: NavItemChild | NavItem): boolean => {
            let moduleKey: string | undefined;
            if ("moduleKey" in item && (item as NavItem).moduleKey) moduleKey = (item as NavItem).moduleKey;
            else if (item.label in labelToModuleKey) moduleKey = labelToModuleKey[item.label];
            if (!moduleKey) return true;
            const lbl = item.label.toLowerCase();
            const isStockSubmodule = [
              "clinic_stock_uom", "clinic_stock_locations", "clinic_stock_suppliers",
              "clinic_stock_purchase_requests", "clinic_stock_purchase_orders", "clinic_stock_grn",
              "clinic_stock_purchase_invoices", "clinic_stock_qty_adjustment",
              "clinic_stock_material_consumptions", "clinic_stock_direct_transfer",
              "clinic_stock_transfer_requests", "clinic_stock_transfer_on_request",
              "clinic_stock_allocated_stock_items", "clinic_stock_purchase_return", "custom_product_sales",
            ].includes(moduleKey) || lbl.includes("uom") || lbl.includes("location") ||
              lbl.includes("supplier") || lbl.includes("purchase") || lbl.includes("grn") ||
              lbl.includes("invoice") || lbl.includes("return") || lbl.includes("stock") ||
              lbl.includes("transfer") || lbl.includes("material") || lbl.includes("allocated");
            if (isStockSubmodule || lbl.includes("stock")) {
              // Check submodule permission within parent module only
              const subModuleHasPerm = localHasSubModulePermission("clinic_stock", item.label);
              if (subModuleHasPerm) return true;
              // Only check parent if submodule doesn't have explicit permissions
              return localHasModulePermission("clinic_stock");
            }
            const marketingMods = ["clinic_inbox", "clinic_templates", "clinic_providers", "clinic_review", "clinic_enquiry", "clinic_kaka_customization"];
            if (marketingMods.includes(moduleKey) || lbl.includes("inbox") || lbl.includes("template") || lbl.includes("provider") || lbl.includes("review") || lbl.includes("enquiry")) {
              // Check submodule permission within parent module only (not separate top-level modules)
              const subModuleHasPerm = localHasSubModulePermission("clinic_marketing", item.label);
              if (subModuleHasPerm) return true;
              // Only check parent if submodule doesn't have explicit permissions
              return localHasModulePermission("clinic_marketing");
            }
            const claimsSubs = ["pass_by_doctor", "release_requested", "doctor_claim", "create_claim", "clinic_management"];
            if (claimsSubs.includes(moduleKey || "")) {
              // Check submodule permission within parent module only
              const subModuleHasPerm = localHasSubModulePermission("claims", item.label);
              if (subModuleHasPerm) return true;
              // Only check parent if submodule doesn't have explicit permissions
              return localHasModulePermission("claims");
            }
            return localHasModulePermission(moduleKey);
          };

          // Convert API items
          const convertedItems: NavItem[] = (res.data.navigationItems || [])
            .map((item: NavigationItemFromAPI): NavItem => {
              const navItem: NavItem = {
                label: item.label, path: item.path, icon: item.icon,
                description: item.description, moduleKey: item.moduleKey, order: item.order,
              };
              if (item.subModules && item.subModules.length > 0) {
                navItem.children = item.subModules.map((subModule: {
                  name: string; path?: string; icon: string; order: number;
                  permissions?: Record<string, boolean> | null;
                }): NavItemChild => ({
                  label: subModule.name, path: subModule.path, icon: subModule.icon,
                  description: subModule.name, order: subModule.order,
                  permissions: subModule.permissions || null,
                  ...(item.moduleKey === "clinic_zeva_connect" && {
                    onClick: subModule?.name === "Team Chat" ? handleZevaConnect : undefined,
                  }),
                }));
              }
              if (item.permissions) navItem.permissions = item.permissions;
              return navItem;
            })
            .filter((item: NavItem) => localShouldShowItem(item));

          convertedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
          convertedItems.forEach((item) => {
            if (item.children) item.children.sort((a, b) => (a.order || 0) - (b.order || 0));
          });

          // Build lookup maps for static grouping
          const toKey = (s: string) => (s || "").trim().toLowerCase();
          const byLabel: Record<string, NavItem> = {};
          const childByLabel: Record<string, NavItemChild> = {};
          convertedItems.forEach((i) => {
            if (i.label) byLabel[toKey(i.label)] = i;
            (i.children || []).forEach((c) => { if (c.label) childByLabel[toKey(c.label)] = c; });
          });

          const pickTop = (label: string): NavItemChild | null => {
            const found = byLabel[toKey(label)];
            if (found) {
              const toCheck = { ...found, label };
              return localShouldShowItem(toCheck) ? { label: found.label, path: found.path, icon: found.icon } : null;
            }
            return null;
          };
          const pickChild = (label: string): NavItemChild | null => {
            const found = childByLabel[toKey(label)];
            if (found) {
              const toCheck = { ...found, label };
              return localShouldShowItem(toCheck) ? { label: found.label, path: found.path, icon: found.icon } : null;
            }
            return null;
          };
          const nonNull = (...items: Array<NavItemChild | null>) => {
            const unique: NavItemChild[] = [];
            const seen = new Set<string>();
            for (const item of items) {
              if (item && !seen.has(item.label)) { unique.push(item); seen.add(item.label); }
            }
            return unique;
          };
          const createItem = (label: string, path: string, icon: string): NavItemChild | null => {
            const item = { label, path, icon };
            return localShouldShowItem(item) ? item : null;
          };

          // Static grouped modules (same structure as ClinicSidebar)
          const dashboardTop = pickTop("Dashboard");
          const groupedModules: NavItem[] = [
            ...(dashboardTop ? ([{ label: (dashboardTop.label || "Dashboard").toUpperCase(), path: dashboardTop.path || "/staff/dashboard", icon: dashboardTop.icon, order: 0 }] as NavItem[]) : []),
            {
              label: "Business Management", icon: "business", order: 100,
              children: nonNull(
                pickTop("Manage Health Center"),
                createItem("Create Offers", "/staff/clinic-create-offer", ""),
                createItem("User Package", "/staff/clinic-userpackages", "package"),
                createItem("Service Setup", "/staff/clinic-services_setup", "services"),
                createItem("Setup & Operation", "/staff/clinic-add-room", "clinic"),
                pickChild("Membership"),
              ),
            },
            {
              label: "HR Management", icon: "users", order: 110,
              children: nonNull(
                createItem("Consent Form", "/staff/clinic-consent", ""),
                createItem("Job Posting", "/staff/clinic-job-posting", "📝"),
                createItem("Commission", "/staff/clinic-commission", "💰"),
                pickTop("Assigned Leads"),
                pickTop("Referral"), pickTop("Referal"),
                pickTop("Track-Members"),
                createItem("Referral", "/staff/clinic-referal", "leads"),
                createItem("Track Members", "/staff/clinic-Track-Members", "users"),
                pickChild("Membership"),
                pickTop("Create Agent"),
              ),
            },
            {
              label: "Marketing", icon: "🎯", order: 120,
              children: nonNull(
                createItem("Create Lead", "/staff/clinic-create-lead", "➕"),
                createItem("Inbox", "/staff/clinic-inbox", "📨"),
                createItem("Email Inbox", "/staff/clinic-email-inbox", "📨"),
                createItem("Templates", "/staff/clinic-all-templates", "📝"),
                createItem("Providers", "/staff/clinic-providers", "👥"),
                createItem("Reviews", "/staff/clinic-getAllReview", "⭐"),
                createItem("Enquiry", "/staff/clinic-get-Enquiry", "❓"),
                createItem("Campaigns", "/staff/clinic-campaigns", "campaigns"),
                createItem("KAKA Customization", "/staff/clinic-kaka-customization", "settings"),
              ),
            },
            {
              label: "Claim Management", icon: "🏥", headerPath: "/staff/clinic-claim-management", order: 125,
              children: nonNull(
                pickTop("Create Claim"), pickChild("Create Claim"),
                createItem("Create Claim", "/staff/clinic-create-claim", "➕"),
                pickTop("Pass By Doctor"), pickChild("Pass By Doctor"),
                createItem("Pass By Doctor", "/staff/clinic-pass-claims", "✅"),
                pickTop("Release Requested"), pickChild("Release Requested"),
                createItem("Release Requested", "/staff/clinic-release-requested-claims", "🚀"),
                pickTop("Doctor's Claim"), pickChild("Doctor's Claim"),
                createItem("Doctor's Claim", "/staff/clinic-all-claims", "‍⚕️"),
              ),
            },
            {
              label: "Automation", icon: "⚡", order: 126,
              children: nonNull(createItem("Automation", "/staff/clinic-automation", "⚡")),
            },
            {
              label: "Content & SEO", icon: "documents", order: 130,
              children: nonNull(pickTop("Write Blog")),
            },
            {
              label: "Stock Management", icon: "archive", order: 135,
              children: nonNull(
                createItem("Locations", "/staff/clinic-stocks-locations", "storage"),
                createItem("Suppliers", "/staff/clinic-stocks-suppliers", "archive"),
                createItem("UOM", "/staff/clinic-stocks-uom", "database"),
                createItem("Purchase Requests", "/staff/clinic-stocks-purchase-requests", "reports"),
                createItem("Purchase Orders", "/staff/clinic-stocks-purchase-orders", "deals"),
                createItem("GRN", "/staff/clinic-stocks-grn", "billing"),
                createItem("Purchase Invoices", "/staff/clinic-stocks-purchase-invoices", "billing"),
                createItem("Purchase Returns", "/staff/clinic-stocks-purchase-returns", "billing"),
                createItem("Stock Quantity Adjustment", "/staff/clinic-stocks-stock-qty-adjustment", "statistics"),
                createItem("Stock Qty Adjustment", "/staff/clinic-stocks-stock-qty-adjustment", "statistics"),
                createItem("Direct Stock Transfer", "/staff/clinic-stocks-stock-transfer-direct-stock-transfer", "arrow-right"),
                createItem("Stock Transfer Request", "/staff/clinic-stocks-stock-transfer-stock-transfer-requests", "share"),
                createItem("Transfer Stock On Request", "/staff/clinic-stocks-stock-transfer-transfer-stock", "refresh-cw"),
                createItem("Material Activity Consumption", "/staff/clinic-stocks-material-consumptions", "⚡"),
                createItem("Material Consumptions", "/staff/clinic-stocks-material-consumptions", "⚡"),
                createItem("Allocated Stock Items", "/staff/clinic-stocks-allocated-stock-items", "package"),
                createItem("Custom Stock Items", "/staff/clinic-stocks-custom-stock-items", "package"),
                createItem("Sale Products", "/staff/clinic-stocks-product-sales", "🛒"),
              ),
            },
            {
              label: "Policy & Compliance", icon: "🛡️", order: 136,
              children: nonNull(createItem("Policy & Compliance", "/staff/clinic-policy_compliance", "🛡️")),
            },
            {
              label: "Security & Privacy", icon: "security", order: 170,
              children: nonNull(createItem("Authentication", "/staff/clinic-authentication", "")),
            },
            {
              label: "Patients & Appointments", icon: "appointments", order: 160,
              children: nonNull(
                createItem("Book Appointments", "/staff/clinic-appointment", "booking"),
                createItem("Scheduled Appointments", "/staff/clinic-all-appointment", "calendar"),
                createItem("Invoices", "/staff/clinic-invoices", "📋"),
                createItem("Patient Registration", "/staff/clinic-patient-registration", "👤"),
                pickChild("Patient Information"),
              ),
            },
            {
              label: "Reports & Analytics", icon: "reports", order: 180,
              children: nonNull(
                pickChild("Add Expense"), pickTop("Add Expense"),
                pickTop("Petty Cash"), pickChild("Petty Cash"),
                createItem("Petty Cash", "/staff/clinic-pettycash", "dollar-sign"),
                createItem("Reports", "/staff/clinic-report", "reports"),
                createItem("KAKA Analytics", "/staff/clinic-kaka-analytics", "analytics"),
              ),
            },
            {
              label: "Zeva Connect", icon: "connect-icon", order: 181,
              children: nonNull(createItem("Team Chat", "", "chat-icon")),
            },
            {
              label: "Workflow Guide", path: "/staff/clinic-workflow-guide", icon: "workflowGuide", order: 190,
            },
          ].filter((group) => {
            if (group.path) return localShouldShowItem(group);
            if (group.headerPath) return true;
            return group.children && group.children.length > 0;
          });

          // Dedup: remove API items already covered by static groups
          const usedLabels = new Set<string>([
            ...groupedModules.flatMap((g) => (g.children || []).map((c) => toKey(c.label))),
            ...groupedModules.filter((g) => g.path).map((g) => toKey(g.label)),
          ]);
          const usedPaths = new Set<string>([
            ...groupedModules.flatMap((g) => (g.children || []).map((c) => c.path || "").filter(Boolean)),
            ...groupedModules.filter((g) => g.path).map((g) => g.path || "").filter(Boolean),
          ]);
          const usedGroupLabels = new Set<string>(groupedModules.map((g) => toKey(g.label)));
          const filteredOriginals = convertedItems.filter((i) => {
            const labelUsed = usedLabels.has(toKey(i.label));
            const pathUsed = i.path ? usedPaths.has(i.path) : false;
            const groupLabelDuplicate = usedGroupLabels.has(toKey(i.label));
            const isStockGeneric = toKey(i.label) === "stock";
            const isPolicyCompliance = toKey(i.label) === "policy & compliance";
            const isLegacyClaimsGroup =
              (toKey(i.label) === "claims" || toKey(i.label) === "clinic management") &&
              !!(i.children && i.children.length > 0);
            // Extra parent labels from API already covered by static groups
            const extraParentLabels = [
              "appointment", "appointments", "patients & appointments",
              "services & setup", "service & setup",
              "referals", "referrals",
              "report", "reports & analytics",
              "pettycash", "petty cash",
              "content & seo", "write blog",
              "hr management", "business management",
              "security & privacy", "policy & compliance",
              "stock management", "automation",
              "marketing", "zeva connect",
              "claim management",
            ];
            const isExtraParent = extraParentLabels.includes(toKey(i.label));
            return !(labelUsed || pathUsed || groupLabelDuplicate || isStockGeneric || isPolicyCompliance || isLegacyClaimsGroup || isExtraParent);
          });

          const finalItems = [...groupedModules, ...filteredOriginals];
          const rank = (it: NavItem) => {
            if (it.path && toKey(it.label) === "dashboard") return -1000;
            return typeof it.order === "number" ? it.order : 9999;
          };
          const sortedItems = [...finalItems].sort((a, b) => rank(a) - rank(b));
          setItems(sortedItems);
        } else {
          console.error("Error fetching navigation items:", res.data.message);
          setItems([]);
        }
      } catch (err: any) {
        console.error("Error fetching navigation items and permissions:", err);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationAndPermissions();
    const handleRouteChange = () => { fetchNavigationAndPermissions(); };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => { router.events.off("routeChangeComplete", handleRouteChange); };
  }, [router]);

  return (
    <>
      {/* Desktop Toggle Button */}
      <button
        onClick={handleToggleDesktop}
        className={clsx(
          "fixed top-4 left-4 z-[60] bg-white text-[#374151] p-2.5 rounded-lg shadow-md transition-all duration-200 border border-gray-200 hover:bg-teal-50 hover:border-gray-300 hidden lg:block",
          {
            "lg:block": isDesktopHidden,
            "lg:hidden": !isDesktopHidden,
          },
        )}
        aria-label="Toggle desktop sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

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
          "transition-all duration-300 ease-in-out bg-bg-sidebar border-r border-border-default flex-col min-h-screen w-72 hidden lg:flex flex-shrink-0",
          {
            "lg:flex": !isDesktopHidden,
            "lg:hidden": isDesktopHidden,
          },
          className,
        )}
        style={{ height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 30 }}
      >
        <div className="flex flex-col h-full">
          {/* Desktop Header */}
          <div className="p-4 border-b border-border-default flex-shrink-0 relative">
            <div className="group cursor-pointer">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-sidebar transition-all duration-200 border border-border-default">
                <div className="w-10 h-10 bg-[#2D9AA5] rounded-lg flex items-center justify-center">
                  <span className="text-white font-medium inter-font text-lg">Z</span>
                </div>
                <div>
                  <span className="font-medium text-base text-text-primary block inter-font">ZEVA</span>
                  <span className="text-xs text-text-secondary font-medium inter-font">Team Workspace</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleDesktop}
              className="absolute right-4 top-4 text-text-secondary p-1.5 transition-all duration-200"
              aria-label="Close sidebar"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 min-h-0">
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-xs text-[#374151] px-2 inter-font">Loading menu…</div>
              ) : (
                items.map((item) => {
                  const isDropdownOpen = openDropdown === item.label;
                  const isActive = (item.path || item.headerPath)
                    ? router.pathname === (item.path || item.headerPath)
                    : false;

                  if (item.children && item.children.length > 0) {
                    return (
                      <div key={item.label}>
                        <button
                          onClick={() => {
                            setOpenDropdown(isDropdownOpen ? null : item.label);
                          }}
                          className={clsx(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-left group cursor-move mt-3 mb-1",
                            {
                              "bg-[#2D9AA5] text-white": isDropdownOpen,
                              "text-text-secondary hover:bg-bg-hover": !isDropdownOpen,
                            },
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {renderIcon(item.icon, isDropdownOpen)}
                            {item.headerPath ? (
                              <Link
                                href={item.headerPath}
                                onClick={(e) => e.stopPropagation()}
                                className={clsx(
                                  "inter-font text-xs font-medium uppercase tracking-wider hover:underline",
                                  { "text-white": isDropdownOpen },
                                )}
                              >
                                {item.label}
                              </Link>
                            ) : (
                              <span
                                className={clsx(
                                  "inter-font text-xs font-medium uppercase tracking-wider",
                                  { "text-white": isDropdownOpen },
                                )}
                              >
                                {item.label}
                              </span>
                            )}
                          </span>
                          <ChevronDown
                            className={clsx(
                              "w-4 h-4 transition-transform duration-200",
                              {
                                "rotate-180": isDropdownOpen,
                                "text-white": isDropdownOpen,
                                "text-[#374151]": !isDropdownOpen,
                              },
                            )}
                          />
                        </button>
                        {isDropdownOpen && (
                          <div className="mt-1 ml-9 space-y-0.5">
                            {item.children.map((child) => {
                              const childActive = child.path
                                ? router.pathname === child.path
                                : false;
                              if (child.onClick) {
                                return (
                                  <div key={child.path} onClick={child.onClick}>
                                    <div
                                      className={clsx(
                                        "px-3 py-2 rounded-lg transition-all duration-200 text-sm cursor-move flex items-start gap-2.5 inter-font min-w-0",
                                        {
                                          "bg-[#2D9AA5] text-white": childActive,
                                          "text-[#374151] hover:bg-gray-100": !childActive,
                                        },
                                      )}
                                    >
                                      <span className={clsx("flex-shrink-0 mt-0.5", childActive ? "text-white" : "text-[#6B7280]")}>
                                        {renderIcon(child.icon, childActive)}
                                      </span>
                                      <span className={clsx("inter-font font-medium text-sm leading-tight", { "text-white": childActive })}>
                                        {child.label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <Link key={child.path} href={child.path!}>
                                  <div
                                    className={clsx(
                                      "px-3 py-2 rounded-lg transition-all duration-200 text-sm cursor-move flex items-start gap-2.5 inter-font min-w-0",
                                      {
                                        "bg-[#2D9AA5] text-white": childActive,
                                        "text-text-secondary hover:bg-bg-hover": !childActive,
                                      },
                                    )}
                                  >
                                    <span className={clsx("flex-shrink-0 mt-0.5", childActive ? "text-white" : "text-text-muted group-hover:text-text-primary")}>
                                      {renderIcon(child.icon, childActive)}
                                    </span>
                                    <span className={clsx("inter-font font-medium text-sm leading-tight", { "text-white": childActive })}>
                                      {child.label}
                                    </span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.path) {
                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          className={clsx(
                            "group relative block rounded-lg transition-all duration-200 cursor-pointer p-2.5 touch-manipulation",
                            {
                              "bg-[#2D9AA5] text-white": isActive,
                              "hover:bg-bg-hover text-text-secondary": !isActive,
                            },
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <div className={clsx("p-1.5 rounded-md transition-all duration-200 flex-shrink-0", {
                              "text-white": isActive,
                              "text-text-muted group-hover:text-text-primary": !isActive,
                            })}>
                              {renderIcon(item.icon, isActive)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={clsx("inter-font font-medium text-sm transition-colors duration-200", {
                                "text-white": isActive,
                                "text-text-secondary": !isActive,
                              })}>
                                {item.label}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <div key={item.label} className="px-3 py-2 font-semibold text-text-secondary flex items-center gap-2">
                      {renderIcon(item.icon, false)}
                      <span className="text-sm">{item.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={clsx(
          "fixed inset-0 z-50 lg:hidden transition-transform duration-300 ease-in-out pointer-events-none",
          {
            "translate-x-0": isMobileOpen,
            "-translate-x-full": !isMobileOpen,
          },
        )}
      >
        <aside className="w-full max-w-xs h-full bg-bg-sidebar shadow-xl border-r border-border-default flex flex-col pointer-events-auto" style={{ height: "100vh" }}>
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="p-4 border-b border-border-default flex-shrink-0 relative">
              <button
                onClick={handleCloseMobile}
                className="absolute right-4 top-4 text-[#374151] p-1.5 transition-all duration-200 z-10"
                aria-label="Close sidebar"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="pr-16">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-sidebar transition-all duration-200 border border-border-default">
                  <div className="w-10 h-10 bg-[#2D9AA5] rounded-lg flex items-center justify-center">
                    <span className="text-white font-medium inter-font text-lg">Z</span>
                  </div>
                  <div>
                    <span className="font-medium text-base text-text-primary block inter-font">ZEVA</span>
                    <span className="text-xs text-text-secondary font-medium inter-font">Staff Panel</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 min-h-0">
              <div className="space-y-1">
                {isLoading ? (
                  <div className="text-xs text-[#374151] px-2 inter-font">Loading menu…</div>
                ) : (
                  items.map((item) => {
                    const isActive = (item.path || item.headerPath) ? router.pathname === (item.path || item.headerPath) : false;
                    const isDropdownOpen = openDropdown === item.label;

                    if (item.children && item.children.length > 0) {
                      return (
                        <div key={item.label}>
                          <button
                            onClick={() => {
                              setOpenDropdown(isDropdownOpen ? null : item.label);
                            }}
                            className={clsx(
                              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-left group cursor-move mt-3 mb-1",
                              {
                                "bg-[#2D9AA5] text-white": isDropdownOpen,
                                "text-[#374151] hover:bg-gray-100": !isDropdownOpen,
                              },
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={clsx("p-1.5 rounded-md transition-all duration-200 flex-shrink-0", {
                                "bg-[#2D9AA5] text-white": isDropdownOpen,
                                "text-[#6B7280] group-hover:text-[#374151]": !isDropdownOpen,
                              })}>
                                {renderIcon(item.icon, isDropdownOpen)}
                              </div>
                              <span className="inter-font text-sm font-medium text-[#374151]">
                                {item.headerPath ? (
                                  <Link
                                    href={item.headerPath}
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:underline"
                                  >
                                    {item.label}
                                  </Link>
                                ) : (
                                  item.label
                                )}
                              </span>
                            </div>
                            <ChevronDown
                              className={clsx("w-4 h-4 transition-transform duration-200", {
                                "rotate-180": isDropdownOpen,
                                "text-white": isDropdownOpen,
                                "text-[#374151]": !isDropdownOpen,
                              })}
                            />
                          </button>

                          {isDropdownOpen && (
                            <div className="ml-9 space-y-0.5">
                              {item.children.map((child) => {
                                const childActive = child.path ? router.pathname === child.path : false;
                                return (
                                  <Link key={child.path} href={child.path!}>
                                    <div
                                      className={clsx(
                                        "px-3 py-2 rounded-lg transition-all duration-200 text-sm cursor-move flex items-start gap-2.5 inter-font min-w-0",
                                        {
                                          "bg-[#2D9AA5] text-white": childActive,
                                          "text-[#374151] hover:bg-gray-100": !childActive,
                                        },
                                      )}
                                      onClick={() => {
                                        handleItemClick();
                                        // @ts-ignore
                                        if (child?.onClick) {
                                          // @ts-ignore
                                          child.onClick();
                                        }
                                      }}
                                    >
                                      <span className={clsx("flex-shrink-0 mt-0.5", childActive ? "text-white" : "text-[#6B7280]")}>
                                        {renderIcon(child.icon, childActive)}
                                      </span>
                                      <span className={clsx("inter-font font-medium text-sm leading-tight", { "text-white": childActive })}>
                                        {child.label}
                                      </span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (item.path) {
                      return (
                        <Link key={item.path} href={item.path}>
                          <div
                            className={clsx(
                              "group relative block rounded-lg transition-all duration-200 cursor-pointer p-2.5 touch-manipulation",
                              {
                                "bg-[#2D9AA5] text-white": isActive,
                                "hover:bg-bg-hover text-text-secondary": !isActive,
                              },
                            )}
                            onClick={() => {
                              handleItemClick();
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <div className={clsx("p-1.5 rounded-md transition-all duration-200 flex-shrink-0", {
                                "text-white": isActive,
                                "text-text-muted group-hover:text-text-primary": !isActive,
                              })}>
                                {renderIcon(item.icon, isActive)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={clsx("inter-font font-medium text-sm transition-colors duration-200", {
                                  "text-white": isActive,
                                  "text-text-secondary": !isActive,
                                })}>
                                  {item.label}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    }

                    return (
                      <div key={item.label} className="px-3 py-2 font-semibold text-text-secondary flex items-center gap-2 touch-manipulation">
                        {renderIcon(item.icon, false)}
                        <span>{item.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </nav>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(45, 154, 165, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(45, 154, 165, 0.5);
        }
        .custom-scrollbar {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </>
  );
};

export default AgentSidebar;
