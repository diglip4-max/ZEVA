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
 
  TrendingUp,
  Lock,
  LayoutDashboard,
  Stethoscope,
  Building2,
  UserCircle,
  Menu,
  Inbox,
  UserPlus,
  ClipboardList,
  Gift,
  UserCog,
  PenTool,
  BriefcaseBusiness,
  Eye,
  Phone,
  MessageCircle,
  Send,
  FileEdit,
  HelpCircle,
  Bell,
  CalendarCheck,
  CalendarDays,
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  Heart,
  Activity,
  Zap,
  Target,
  Award,
  Shield,
  BookOpen,
  Newspaper,
  Image,
  Video,
  Music,
  Folder,
  File,
  Database,
  Server,
  Cloud,
  Wifi,
  Globe,
  Link as LinkIcon,
  Share2,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Plus,
  Minus,
  Edit,
  Trash2,
  Save,
  XCircle,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  // Additional professional icons
  Home,
  ClipboardCheck,
  UserCheck,
  Wallet,
  Receipt,
  ShoppingCart,
  Tag,
  Percent,
  Archive,
  HardDrive,
  Globe2,
  ChevronDown,

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
  externalIsDesktopHidden?: boolean;
  externalIsMobileOpen?: boolean;
  onExternalToggleDesktop?: () => void;
  onExternalToggleMobile?: () => void;
}

// Professional icon mapping for clinic sidebar - using Lucide React icons
const iconMap: { [key: string]: React.ReactNode } = {
  // Dashboard & Overview
  '📊': <BarChart3 className="w-4 h-4" />,
  '🏠': <LayoutDashboard className="w-4 h-4" />,
  '📈': <TrendingUp className="w-4 h-4" />,
  '📉': <Activity className="w-4 h-4" />,
  '⚡': <Zap className="w-4 h-4" />,
  '🎯': <Target className="w-4 h-4" />,
  'home': <Home className="w-4 h-4" />,
  'dashboard': <LayoutDashboard className="w-4 h-4" />,
  'analytics': <BarChart3 className="w-4 h-4" />,
  'reports': <FileText className="w-4 h-4" />,
  'overview': <Activity className="w-4 h-4" />,
  
  // Users & People
  '👥': <Users className="w-4 h-4" />,
  '👤': <UserCircle className="w-4 h-4" />,
  '👨‍⚕️': <Stethoscope className="w-4 h-4" />,
  '👨‍💼': <UserCog className="w-4 h-4" />,
  '👨‍🔬': <Stethoscope className="w-4 h-4" />,
  'users': <Users className="w-4 h-4" />,
  'patients': <UserCircle className="w-4 h-4" />,
  'doctors': <Stethoscope className="w-4 h-4" />,
  'staff': <UserCog className="w-4 h-4" />,
  'agents': <UserPlus className="w-4 h-4" />,
  'team': <Users className="w-4 h-4" />,
  'profile': <UserCircle className="w-4 h-4" />,
  'user-circle': <UserCircle className="w-4 h-4" />,
  
  // Communication & Messages
  '💬': <MessageSquare className="w-4 h-4" />,
  '📧': <Mail className="w-4 h-4" />,
  '📨': <Inbox className="w-4 h-4" />,
  '💭': <MessageCircle className="w-4 h-4" />,
  '📱': <Phone className="w-4 h-4" />,
  '📤': <Send className="w-4 h-4" />,
  'messages': <MessageSquare className="w-4 h-4" />,
  'chat': <MessageCircle className="w-4 h-4" />,
  'email': <Mail className="w-4 h-4" />,
  'inbox': <Inbox className="w-4 h-4" />,
  'notifications': <Bell className="w-4 h-4" />,
  'calls': <Phone className="w-4 h-4" />,
  
  // Calendar & Appointments
  '📅': <Calendar className="w-4 h-4" />,
  '📆': <CalendarDays className="w-4 h-4" />,
  '📅✅': <CalendarCheck className="w-4 h-4" />,
  '⏰': <Clock className="w-4 h-4" />,
  '🗓️': <CalendarCheck className="w-4 h-4" />,
  'appointments': <Calendar className="w-4 h-4" />,
  'schedule': <CalendarDays className="w-4 h-4" />,
  'calendar': <Calendar className="w-4 h-4" />,
  'time': <Clock className="w-4 h-4" />,
  'booking': <CalendarCheck className="w-4 h-4" />,
  'slots': <Clock className="w-4 h-4" />,
  
  // Additional icon keys for professional icons
  'bar-chart': <BarChart3 className="w-4 h-4" />,
  'dollar-sign': <DollarSign className="w-4 h-4" />,
  
  // Documents & Files
  '📝': <FileText className="w-4 h-4" />,
  '📄': <File className="w-4 h-4" />,
  '📑': <FileEdit className="w-4 h-4" />,
  '📋': <ClipboardList className="w-4 h-4" />,
  '📚': <BookOpen className="w-4 h-4" />,
  '📰': <Newspaper className="w-4 h-4" />,
  '✍️': <PenTool className="w-4 h-4" />,
  'documents': <FileText className="w-4 h-4" />,
  'files': <File className="w-4 h-4" />,
  'records': <ClipboardCheck className="w-4 h-4" />,
  'prescriptions': <FileText className="w-4 h-4" />,
  'notes': <FileEdit className="w-4 h-4" />,
  'forms': <ClipboardList className="w-4 h-4" />,
  'templates': <FileText className="w-4 h-4" />,
  
  // Business & Work
  '💼': <Briefcase className="w-4 h-4" />,
  '💼‍': <BriefcaseBusiness className="w-4 h-4" />,
  '🏢': <Building2 className="w-4 h-4" />,
  '🏥': <Building2 className="w-4 h-4" />,
  '🩺': <Stethoscope className="w-4 h-4" />,
  'clinic': <Building2 className="w-4 h-4" />,
  'facility': <Building2 className="w-4 h-4" />,
  'business': <Briefcase className="w-4 h-4" />,
  'organization': <Building2 className="w-4 h-4" />,
  
  // Medical & Health
  'medical': <Stethoscope className="w-4 h-4" />,
  'health': <Heart className="w-4 h-4" />,
  'treatments': <Stethoscope className="w-4 h-4" />,
  'services': <Activity className="w-4 h-4" />,
  'diagnostics': <Activity className="w-4 h-4" />,
  'tests': <FileText className="w-4 h-4" />,
  '❤️': <Heart className="w-4 h-4" />,
  '💊': <Package className="w-4 h-4" />,
  
  // Reviews & Ratings
  '⭐': <Star className="w-4 h-4" />,
  '👁️': <Eye className="w-4 h-4" />,
  '🏆': <Award className="w-4 h-4" />,
  'reviews': <Star className="w-4 h-4" />,
  'ratings': <Star className="w-4 h-4" />,
  'feedback': <MessageSquare className="w-4 h-4" />,
  'testimonials': <Award className="w-4 h-4" />,
  
  // Offers & Promotions
  '🎁': <Gift className="w-4 h-4" />,
  '🎉': <Package className="w-4 h-4" />,
  '🛍️': <ShoppingBag className="w-4 h-4" />,
  'offers': <Tag className="w-4 h-4" />,
  'promotions': <Gift className="w-4 h-4" />,
  'discounts': <Percent className="w-4 h-4" />,
  'deals': <ShoppingCart className="w-4 h-4" />,
  'packages': <Package className="w-4 h-4" />,
  
  // Payments & Finance
  '💳': <CreditCard className="w-4 h-4" />,
  '💰': <DollarSign className="w-4 h-4" />,
  'payments': <CreditCard className="w-4 h-4" />,
  'billing': <Receipt className="w-4 h-4" />,
  'invoices': <FileText className="w-4 h-4" />,
  'transactions': <DollarSign className="w-4 h-4" />,
  'revenue': <TrendingUp className="w-4 h-4" />,
  'expenses': <TrendingUp className="w-4 h-4" />,
  'wallet': <Wallet className="w-4 h-4" />,
  'finance': <DollarSign className="w-4 h-4" />,
  'accounts': <DollarSign className="w-4 h-4" />,
  
  // Settings & Security
  // '⚙️': <Settings className="w-4 h-4" />,
  '🔒': <Lock className="w-4 h-4" />,
  '🛡️': <Shield className="w-4 h-4" />,
  // 'settings': <Settings className="w-4 h-4" />,
  'security': <Shield className="w-4 h-4" />,
  'permissions': <Lock className="w-4 h-4" />,
  'access': <UserCheck className="w-4 h-4" />,
  // 'configuration': <Settings className="w-4 h-4" />,
  // 'preferences': <Settings className="w-4 h-4" />,
  
  // Notifications & Alerts
  '🔔': <Bell className="w-4 h-4" />,
  '⚠️': <AlertTriangle className="w-4 h-4" />,
  'ℹ️': <Info className="w-4 h-4" />,
  '❓': <HelpCircle className="w-4 h-4" />,
  '✅': <CheckCircle className="w-4 h-4" />,
  '❌': <XCircle className="w-4 h-4" />,
  'alerts': <AlertCircle className="w-4 h-4" />,
  'warnings': <AlertTriangle className="w-4 h-4" />,
  'help': <HelpCircle className="w-4 h-4" />,
  'support': <HelpCircle className="w-4 h-4" />,
  
  // Media & Content
  '🖼️': <Image className="w-4 h-4" />,
  '🎬': <Video className="w-4 h-4" />,
  '🎵': <Music className="w-4 h-4" />,
  'media': <Image className="w-4 h-4" />,
  'gallery': <Image className="w-4 h-4" />,
  'videos': <Video className="w-4 h-4" />,
  'content': <FileText className="w-4 h-4" />,
  
  // Actions & Tools
  '➕': <Plus className="w-4 h-4" />,
  '➖': <Minus className="w-4 h-4" />,
  '✏️': <Edit className="w-4 h-4" />,
  '🗑️': <Trash2 className="w-4 h-4" />,
  '💾': <Save className="w-4 h-4" />,
  '🔍': <Search className="w-4 h-4" />,
  '🔎': <Filter className="w-4 h-4" />,
  '🔄': <RefreshCw className="w-4 h-4" />,
  '⬇️': <Download className="w-4 h-4" />,
  '⬆️': <Upload className="w-4 h-4" />,
  '🔗': <LinkIcon className="w-4 h-4" />,
  '🔀': <Share2 className="w-4 h-4" />,
  '⋯': <MoreHorizontal className="w-4 h-4" />,
  'add': <Plus className="w-4 h-4" />,
  'create': <Plus className="w-4 h-4" />,
  'new': <Plus className="w-4 h-4" />,
  'edit': <Edit className="w-4 h-4" />,
  'delete': <Trash2 className="w-4 h-4" />,
  'remove': <Trash2 className="w-4 h-4" />,
  'save': <Save className="w-4 h-4" />,
  'search': <Search className="w-4 h-4" />,
  'filter': <Filter className="w-4 h-4" />,
  'refresh': <RefreshCw className="w-4 h-4" />,
  'download': <Download className="w-4 h-4" />,
  'upload': <Upload className="w-4 h-4" />,
  'export': <Download className="w-4 h-4" />,
  'import': <Upload className="w-4 h-4" />,
  'share': <Share2 className="w-4 h-4" />,
  'link': <LinkIcon className="w-4 h-4" />,
  'more': <MoreHorizontal className="w-4 h-4" />,
  
  // Folders & Organization
  '📁': <Folder className="w-4 h-4" />,
  '🗄️': <Database className="w-4 h-4" />,
  '🖥️': <Server className="w-4 h-4" />,
  '☁️': <Cloud className="w-4 h-4" />,
  'folders': <Folder className="w-4 h-4" />,
  'archive': <Archive className="w-4 h-4" />,
  'storage': <HardDrive className="w-4 h-4" />,
  'database': <Database className="w-4 h-4" />,
  'server': <Server className="w-4 h-4" />,
  'cloud': <Cloud className="w-4 h-4" />,
  
  // Network & Connectivity
  '🌐': <Globe className="w-4 h-4" />,
  '📶': <Wifi className="w-4 h-4" />,
  'network': <Wifi className="w-4 h-4" />,
  'connectivity': <Wifi className="w-4 h-4" />,
  'internet': <Globe2 className="w-4 h-4" />,
  
  // Leads & Sales
  'leads': <Target className="w-4 h-4" />,
  'sales': <TrendingUp className="w-4 h-4" />,
  'conversions': <Target className="w-4 h-4" />,
  'opportunities': <Zap className="w-4 h-4" />,
  
  // Analytics & Reports
  'statistics': <BarChart3 className="w-4 h-4" />,
  'charts': <BarChart3 className="w-4 h-4" />,
  'insights': <TrendingUp className="w-4 h-4" />,
  'metrics': <Activity className="w-4 h-4" />,
  
  // Default fallback for any unmapped icons
};

const ClinicSidebar: FC<ClinicSidebarProps> = ({ 
  className,
  externalIsDesktopHidden,
  externalIsMobileOpen,
  onExternalToggleDesktop,
  onExternalToggleMobile,
}) => {
  const router = useRouter();
  const [internalIsDesktopHidden, setInternalIsDesktopHidden] = useState(false);
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isDesktopHidden = externalIsDesktopHidden !== undefined ? externalIsDesktopHidden : internalIsDesktopHidden;
  const isMobileOpen = externalIsMobileOpen !== undefined ? externalIsMobileOpen : internalIsMobileOpen;
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
        if (onExternalToggleMobile && externalIsMobileOpen) {
          onExternalToggleMobile(); // Toggle to close
        } else {
          setInternalIsMobileOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen, onExternalToggleMobile, externalIsMobileOpen]);

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

        console.log("ClinicSidebar: Using token:", token ? "Token exists" : "No token found");
        
        let res;
        try {
          res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (error: any) {
          console.error("ClinicSidebar API Error:", error.response?.status, error.response?.data);
          
          // Handle 401, 403, 404, and other errors gracefully
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
    if (onExternalToggleDesktop && externalIsDesktopHidden !== undefined) {
      onExternalToggleDesktop();
    } else {
      setInternalIsDesktopHidden(!isDesktopHidden);
    }
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

      {/* Desktop Toggle Button - Only shows when no external state */}
      {(!onExternalToggleDesktop || externalIsDesktopHidden === undefined) && (
        <button
          onClick={handleToggleDesktop}
          className={clsx(
            "fixed top-4 left-4 z-[60] bg-white text-teal-700 p-2.5 rounded-lg shadow-md transition-all duration-200 border border-gray-200 hover:bg-teal-50 hover:border-gray-300 hidden lg:block",
            {
              "lg:block": isDesktopHidden,
              "lg:hidden": !isDesktopHidden,
            }
          )}
          aria-label="Toggle desktop sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Desktop Toggle Button - Shows when sidebar is hidden */}
      {isDesktopHidden && (
        <button
          onClick={handleToggleDesktop}
          className="fixed top-3 left-3 z-[100] bg-white text-teal-700 p-1.5 rounded-lg shadow-md transition-all duration-200 border border-gray-200 hover:bg-teal-50 hover:border-gray-300 hover:shadow-lg hidden lg:flex items-center justify-center"
          aria-label="Toggle desktop sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:hidden",
          {
            "translate-x-0": isMobileOpen,
            "-translate-x-full": !isMobileOpen,
          },
          className
        )}
        style={{ height: "100vh" }}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Header Section */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 relative">
            <div className="group cursor-pointer">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 group-hover:bg-teal-50 transition-all duration-200 border border-gray-200">
                <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Z</span>
                </div>
                <div>
                  <span className="font-bold text-base text-teal-900 block">
                    ZEVA
                  </span>
                  <span className="text-xs text-gray-950 font-medium">Clinic Panel</span>
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            {(onExternalToggleMobile || !onExternalToggleMobile) && (
              <button
                onClick={() => {
                  if (onExternalToggleMobile && externalIsMobileOpen !== undefined) {
                    onExternalToggleMobile();
                  } else {
                    setInternalIsMobileOpen(false);
                  }
                }}
                className="absolute right-4 top-4 bg-teal-100 text-teal-700 p-1.5 rounded-md hover:bg-teal-200 transition-all duration-200"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Mobile Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 min-h-0">
            <div className="text-teal-700 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
              Navigation
            </div>
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-xs text-teal-500 px-2">Loading menu…</div>
              ) : (
                items.map((item) => {
                const isDropdownOpen = openDropdown === item.label;
                const isActive = selectedItem 
                  ? selectedItem === item.label 
                  : router.pathname === item.path;

                const handleItemClick = () => {
                  setSelectedItem(item.label);
                  if (item.path) {
                    if (onExternalToggleMobile && externalIsMobileOpen) {
                      onExternalToggleMobile();
                    } else {
                      setInternalIsMobileOpen(false);
                    }
                  }
                };

                if (item.children && item.children.length > 0) {
                  const itemIndex = items.findIndex(i => i.label === item.label);
                  return (
                    <div 
                      key={item.label} 
                      className="space-y-1"
                      draggable
                      onDragStart={onDragStartParent(itemIndex)}
                      onDragOver={onDragOver}
                      onDrop={onDropParent(itemIndex)}
                      onDragEnd={onDragEnd}
                    >
                      <button
                        onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                        className={clsx(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-left group cursor-move",
                          {
                            "bg-[#2D9AA5] text-white": isActive,
                            "text-teal-700 hover:bg-teal-50": !isActive,
                          }
                        )}
                      >
                        <div className="flex items-center space-x-3">

                          <div className={clsx(
                            "p-1.5 rounded-md transition-all duration-200 flex-shrink-0",
                            {
                              "bg-white/20 text-white": isActive,
                              "text-gray-800 group-hover:text-gray-800 group-hover:bg-gray-100": !isActive,
                            }
                          )}>
                            {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                          </div>
                          <span className="ui-sans-serif text-sm font-medium text-gray-950">{item.label}</span>
                        </div>
                        <ChevronDown
                          className={clsx(
                            "w-4 h-4 transition-transform duration-200",
                            {
                              "rotate-180": isDropdownOpen,
                              "text-white": isActive,
                              "text-teal-500": !isActive,
                            }
                          )}
                        />
                      </button>
                      {isDropdownOpen && (
                        <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-2">
                          {item.children.map((child, childIdx) => {
                            const isChildActive = router.pathname === child.path;
                            return child.path ? (
                              <Link key={childIdx} href={child.path} onClick={handleItemClick}>
                                <div
                                  draggable
                                  onDragStart={onDragStartChild(itemIndex, childIdx)}
                                  onDragOver={onDragOver}
                                  onDrop={onDropChild(itemIndex, childIdx)}
                                  onDragEnd={onDragEnd}
                                  className={clsx(
                                    "px-3 py-2 rounded-lg transition-all duration-200 text-sm cursor-move flex items-center gap-2",
                                    {
                                      "bg-[#2D9AA5] text-white": isChildActive,
                                      "text-teal-700 hover:bg-teal-50": !isChildActive,
                                    }
                                  )}
                                >

                                  {child.label}
                                </div>
                              </Link>
                            ) : (
                              <div
                                key={childIdx}
                                className="px-3 py-2 text-sm text-teal-500"
                              >
                                {child.label}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const MenuItemContent = (
                  <div
                    draggable
                    onDragStart={onDragStartParent(items.findIndex(i => i.label === item.label))}
                    onDragOver={onDragOver}
                    onDrop={onDropParent(items.findIndex(i => i.label === item.label))}
                    onDragEnd={onDragEnd}
                    onClick={safeClick(handleItemClick)}
                    className={clsx(
                      "w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-move",
                      {
                        "bg-[#2D9AA5] text-white": isActive,
                        "text-teal-700 hover:bg-teal-100": !isActive,
                      }
                    )}
                  >

                    <div className={clsx(
                      "p-1.5 rounded-md transition-all duration-200 flex-shrink-0",
                      {
                        "text-white": isActive,
                        "text-gray-950 group-hover:text-gray-950": !isActive,
                      }
                    )}>
                      {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                    </div>

                    <div className="flex-1 min-w-0 ml-3">
                      <div className={clsx(
                        "ui-sans-serif font-medium text-sm text-gray-800 transition-colors duration-200",
                        {
                          "text-white": isActive,
                          "text-teal-900": !isActive,
                        }
                      )}>
                        {item.label}
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

      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "transition-all duration-300 ease-in-out bg-gray-50 border-r border-gray-200 flex-col min-h-screen w-64 hidden lg:flex",
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
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white group-hover:bg-teal-50 transition-all duration-200 border border-gray-200">
                <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Z</span>
                </div>
                <div>
                  <span className="font-bold text-base text-teal-900 block">
                    ZEVA
                  </span>
                  <span className="text-xs text-gray-950 font-medium">Clinic Panel</span>
                </div>
              </div>
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={handleToggleDesktop}
              className="absolute right-4 top-4 bg-teal-50 text-teal-700 p-1.5 rounded-md hover:bg-teal-200 transition-all duration-200"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 min-h-0">
            <div className="text-teal-700 text-xs font-semibold uppercase tracking-wider mb-3 px-2">
              Navigation
            </div>
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-xs text-teal-500 px-2">Loading menu…</div>
              ) : (
                items.map((item, parentIdx) => {
                const isDropdownOpen = openDropdown === item.label;
                // If an item is manually selected, only that item should be active
                // Otherwise, use router pathname to determine active state
                const isActive = selectedItem 
                  ? selectedItem === item.label 
                  : router.pathname === item.path;

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
                            "bg-teal-600 text-white": isDropdownOpen,
                            "hover:bg-teal-50 text-gray-950": !isDropdownOpen,
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
                              "text-white": isDropdownOpen,
                              "text-gray-950 group-hover:text-gray-950": !isDropdownOpen,
                            }
                          )}>
                            {iconMap[item.icon] || <span className="text-base">{item.icon}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={clsx(
                              "ui-sans-serif font-medium text-sm transition-colors duration-200",
                              {
                                "text-white": isDropdownOpen,
                                "text-gray-950": !isDropdownOpen,
                              }
                            )}>
                              {item.label}
                            </div>
                          </div>
                          <svg
                            className={clsx(
                              "w-4 h-4 transition-transform duration-200 flex-shrink-0",
                              isDropdownOpen && "rotate-90",
                              isDropdownOpen ? "text-white" : "text-teal-700"
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
                                      "bg-teal-600 text-white": childActive,
                                      "hover:bg-teal-50 text-gray-950": !childActive,
                                    }
                                  )}
                                  onClick={safeClick(() => {
                                    setSelectedItem(child.label);
                                  })}
                                >
                                  <div className="flex items-center space-x-2.5">

                                    <div className={clsx(
                                      "p-1 rounded-md transition-all duration-200 flex-shrink-0",
                                      {
                                        "text-white": childActive,
                                        "text-gray-950 group-hover:text-gray-950": !childActive,
                                      }
                                    )}>
                                      {iconMap[child.icon] || <span className="text-sm">{child.icon}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={clsx(
                                        "ui-sans-serif font-medium text-sm transition-colors duration-200",
                                        {
                                          "text-white": childActive,
                                          "text-gray-950": !childActive,
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
                    draggable
                    onDragStart={onDragStartParent(parentIdx)}
                    onDragOver={onDragOver}
                    onDrop={onDropParent(parentIdx)}
                    onDragEnd={onDragEnd}
                    className={clsx(
                      "group relative block rounded-lg transition-all duration-200 cursor-move p-2.5 touch-manipulation",
                      {
                        "bg-teal-600 text-white": isActive,
                        "hover:bg-teal-50 text-gray-950": !isActive,
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
                          "text-white": isActive,
                          "text-gray-950 group-hover:text-gray-950": !isActive,
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
                          "ui-sans-serif font-medium text-sm transition-colors duration-200",
                          {
                            "text-white": isActive,
                            "text-gray-950": !isActive,
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

    </>
  );
};

export default ClinicSidebar;
