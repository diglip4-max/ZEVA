import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import React, { ReactElement, useCallback, useEffect, useState } from "react";
import { NextPageWithLayout } from "../../_app";
import {
  Search,
  Plus,
  Mail,
  MessageSquare,
  X,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Grid,
  List,
  RefreshCcw,
  Play,
  Pause,
  Calendar,
  Users,
  BarChart3,
  Send,
  CheckCircle,
  PauseCircle,
  XCircle,
} from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";
// import DeleteCampaignModal from "./_components/DeleteCampaignModal";
import { useRouter } from "next/router";

// Define Campaign interface based on the Mongoose schema
interface Campaign {
  _id: string;
  clinicId: string;
  userId?: string;
  name: string;
  description?: string;
  type: "whatsapp" | "sms" | "email";
  status:
    | "draft"
    | "scheduled"
    | "processing"
    | "paused"
    | "completed"
    | "failed";
  scheduleType: "now" | "later";
  template?: string;
  subject?: string;
  preheader?: string;
  editorType:
    | "html-editor"
    | "block-editor"
    | "rich-text-editor"
    | "text-editor";
  content?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "file" | "";
  source: string;
  attachments?: Array<{
    fileName: string;
    fileSize: string;
    mimeType: string;
    mediaUrl: string;
    mediaType: string;
  }>;
  sender?: string;
  recipients: string[];
  segmentId?: string;

  // Tracking metrics
  totalMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
  openedMessages: number;
  clickedMessages: number;
  unsubscribedMessages: number;
  bouncedMessages: number;
  complainedMessages: number;

  createdAt: string;
  updatedAt: string;

  // Progress tracking
  totalBatches?: number;
  processedBatches?: number;
  lastProcessedBatches?: number;

  errorCode?: string;
  errorMessage?: string;
}

const sampleCampaigns = [
  {
    _id: "campaign_1",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Annual Health Checkup Reminder",
    description:
      "Remind patients about their annual health checkups scheduled for Q1 2024",
    type: "whatsapp",
    status: "completed",
    scheduleType: "later",
    template: "template_health_check",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "Hello {{patient_name}}, this is a reminder about your annual health checkup scheduled for {{appointment_date}}. Please confirm your availability.",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [],
    sender: "provider_789",
    recipients: ["lead_1", "lead_2", "lead_3", "lead_4", "lead_5"],
    segmentId: "segment_annual_checkup",
    totalBatches: 3,
    processedBatches: 3,
    lastProcessedBatches: 3,
    totalMessages: 1500,
    sentMessages: 1480,
    deliveredMessages: 1450,
    readMessages: 1300,
    failedMessages: 20,
    openedMessages: 1300,
    clickedMessages: 450,
    unsubscribedMessages: 5,
    bouncedMessages: 15,
    complainedMessages: 2,
    createdAt: "2024-01-10T09:30:00Z",
    updatedAt: "2024-01-12T15:45:00Z",
  },
  {
    _id: "campaign_2",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "New COVID Vaccine Availability",
    description: "Notify patients about new COVID-19 vaccine batches available",
    type: "sms",
    status: "processing",
    scheduleType: "now",
    template: "template_vaccine_alert",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "New COVID-19 vaccine batches now available. Book your slot: {{booking_link}}",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [],
    sender: "provider_789",
    recipients: ["lead_6", "lead_7", "lead_8", "lead_9", "lead_10"],
    segmentId: "segment_vaccine",
    totalBatches: 5,
    processedBatches: 2,
    lastProcessedBatches: 2,
    totalMessages: 2000,
    sentMessages: 800,
    deliveredMessages: 750,
    readMessages: 600,
    failedMessages: 50,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 10,
    bouncedMessages: 40,
    complainedMessages: 0,
    createdAt: "2024-01-15T14:00:00Z",
    updatedAt: "2024-01-15T14:30:00Z",
  },
  {
    _id: "campaign_3",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Diabetes Management Newsletter",
    description:
      "Monthly newsletter for diabetes patients with health tips and updates",
    type: "email",
    status: "scheduled",
    scheduleType: "later",
    template: "template_newsletter",
    subject: "Your January Diabetes Health Tips",
    preheader: "Start 2024 with better diabetes management",
    editorType: "html-editor",
    content:
      "<h1>Welcome to Your January Health Update</h1><p>Dear {{patient_name}},</p><p>Here are this month's tips for managing your diabetes...</p>",
    mediaUrl: "https://example.com/images/diabetes-tips.jpg",
    mediaType: "image",
    source: "Zeva",
    attachments: [
      {
        fileName: "diabetes_guide.pdf",
        fileSize: "2.5 MB",
        mimeType: "application/pdf",
        mediaUrl: "https://example.com/docs/diabetes_guide.pdf",
        mediaType: "document",
      },
    ],
    sender: "provider_789",
    recipients: ["lead_11", "lead_12", "lead_13", "lead_14", "lead_15"],
    segmentId: "segment_diabetes",
    totalBatches: 2,
    processedBatches: 0,
    lastProcessedBatches: 0,
    totalMessages: 800,
    sentMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 0,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 0,
    bouncedMessages: 0,
    complainedMessages: 0,
    createdAt: "2024-01-18T11:00:00Z",
    updatedAt: "2024-01-18T11:00:00Z",
    awsEmailTemplateName: "diabetes-newsletter-jan24",
  },
  {
    _id: "campaign_4",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Flu Season Vaccination Campaign",
    description: "Urgent campaign for flu vaccination appointments",
    type: "whatsapp",
    status: "paused",
    scheduleType: "now",
    template: "template_flu_vaccine",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "Flu season alert! Book your flu shot appointment now: {{booking_link}}",
    mediaUrl: "https://example.com/videos/flu-awareness.mp4",
    mediaType: "video",
    source: "Zeva",
    attachments: [],
    sender: "provider_789",
    recipients: ["lead_16", "lead_17", "lead_18", "lead_19", "lead_20"],
    segmentId: "segment_all_patients",
    totalBatches: 4,
    processedBatches: 1,
    lastProcessedBatches: 1,
    totalMessages: 3000,
    sentMessages: 750,
    deliveredMessages: 700,
    readMessages: 600,
    failedMessages: 50,
    openedMessages: 600,
    clickedMessages: 200,
    unsubscribedMessages: 8,
    bouncedMessages: 42,
    complainedMessages: 1,
    createdAt: "2024-01-20T10:00:00Z",
    updatedAt: "2024-01-20T11:30:00Z",
    bodyParameters: [
      { type: "text", text: "John" },
      { type: "text", text: "2024-01-25" },
    ],
  },
  {
    _id: "campaign_5",
    clinicId: "clinic_123",
    userId: "user_457",
    name: "Post-Surgery Follow-up",
    description: "Follow-up messages for patients who had surgery last week",
    type: "sms",
    status: "draft",
    scheduleType: "later",
    template: "template_followup",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "Hi {{patient_name}}, how are you recovering? Please reply with 1-5 (1=Poor, 5=Excellent)",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [],
    sender: "provider_790",
    recipients: ["lead_21", "lead_22", "lead_23"],
    segmentId: "segment_post_surgery",
    totalBatches: 0,
    processedBatches: 0,
    lastProcessedBatches: 0,
    totalMessages: 50,
    sentMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 0,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 0,
    bouncedMessages: 0,
    complainedMessages: 0,
    createdAt: "2024-01-22T09:15:00Z",
    updatedAt: "2024-01-22T09:15:00Z",
  },
  {
    _id: "campaign_6",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Medical Bill Payment Reminder",
    description: "Remind patients about pending medical bill payments",
    type: "email",
    status: "failed",
    scheduleType: "now",
    template: "template_payment_reminder",
    subject: "Payment Reminder for Medical Services",
    preheader: "Your payment is pending",
    editorType: "block-editor",
    content:
      "<div>Dear {{patient_name}},<br>This is a reminder about your pending payment of {{amount}}.<br>Please pay here: {{payment_link}}</div>",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [
      {
        fileName: "invoice_123.pdf",
        fileSize: "1.2 MB",
        mimeType: "application/pdf",
        mediaUrl: "https://example.com/invoices/invoice_123.pdf",
        mediaType: "document",
      },
    ],
    sender: "provider_789",
    recipients: ["lead_24", "lead_25", "lead_26", "lead_27", "lead_28"],
    segmentId: "segment_pending_payments",
    totalBatches: 1,
    processedBatches: 0,
    lastProcessedBatches: 0,
    totalMessages: 120,
    sentMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 120,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 0,
    bouncedMessages: 120,
    complainedMessages: 0,
    createdAt: "2024-01-21T16:00:00Z",
    updatedAt: "2024-01-21T16:10:00Z",
    errorCode: "SMTP_ERROR",
    errorMessage: "SMTP server connection failed",
  },
  {
    _id: "campaign_7",
    clinicId: "clinic_123",
    userId: "user_458",
    name: "New Clinic Services Announcement",
    description: "Announce new telemedicine services available at the clinic",
    type: "whatsapp",
    status: "completed",
    scheduleType: "later",
    template: "template_service_announcement",
    subject: "",
    preheader: "",
    editorType: "rich-text-editor",
    content:
      "🎉 *New Service Alert!* 🎉\n\nWe're excited to announce our new *Telemedicine Services*! \n\nNow consult with doctors from the comfort of your home. \n\nBook your first virtual consultation: {{booking_link}}",
    mediaUrl: "https://example.com/images/telemedicine-banner.jpg",
    mediaType: "image",
    source: "Zeva",
    attachments: [],
    sender: "provider_791",
    recipients: [
      "lead_29",
      "lead_30",
      "lead_31",
      "lead_32",
      "lead_33",
      "lead_34",
      "lead_35",
    ],
    segmentId: "segment_all_active",
    totalBatches: 3,
    processedBatches: 3,
    lastProcessedBatches: 3,
    totalMessages: 2500,
    sentMessages: 2480,
    deliveredMessages: 2450,
    readMessages: 2200,
    failedMessages: 20,
    openedMessages: 2200,
    clickedMessages: 850,
    unsubscribedMessages: 12,
    bouncedMessages: 8,
    complainedMessages: 3,
    createdAt: "2024-01-05T08:00:00Z",
    updatedAt: "2024-01-07T12:00:00Z",
    headerParameters: [{ type: "image", text: "telemedicine-banner.jpg" }],
  },
  {
    _id: "campaign_8",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Prescription Refill Reminder",
    description: "Automated reminder for prescription refills due this week",
    type: "sms",
    status: "processing",
    scheduleType: "now",
    template: "template_prescription_refill",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "Reminder: Your prescription for {{medication_name}} needs refill. Reply YES to confirm.",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [],
    sender: "provider_789",
    recipients: ["lead_36", "lead_37", "lead_38", "lead_39", "lead_40"],
    segmentId: "segment_prescription_refill",
    totalBatches: 2,
    processedBatches: 1,
    lastProcessedBatches: 1,
    totalMessages: 450,
    sentMessages: 225,
    deliveredMessages: 210,
    readMessages: 180,
    failedMessages: 15,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 5,
    bouncedMessages: 10,
    complainedMessages: 0,
    createdAt: "2024-01-23T09:00:00Z",
    updatedAt: "2024-01-23T09:20:00Z",
  },
  {
    _id: "campaign_9",
    clinicId: "clinic_123",
    userId: "user_459",
    name: "Mental Health Webinar Invitation",
    description: "Invite patients to join mental health awareness webinar",
    type: "email",
    status: "scheduled",
    scheduleType: "later",
    template: "template_webinar_invite",
    subject: "Join Our Mental Health Awareness Webinar",
    preheader: "Learn coping strategies and mindfulness techniques",
    editorType: "html-editor",
    content:
      "<h1>You're Invited!</h1><p>Join our exclusive webinar on mental health awareness...</p>",
    mediaUrl: "https://example.com/images/webinar-poster.jpg",
    mediaType: "image",
    source: "Zeva",
    attachments: [
      {
        fileName: "webinar_agenda.pdf",
        fileSize: "1.8 MB",
        mimeType: "application/pdf",
        mediaUrl: "https://example.com/docs/webinar_agenda.pdf",
        mediaType: "document",
      },
    ],
    sender: "provider_792",
    recipients: ["lead_41", "lead_42", "lead_43", "lead_44", "lead_45"],
    segmentId: "segment_mental_health",
    totalBatches: 1,
    processedBatches: 0,
    lastProcessedBatches: 0,
    totalMessages: 300,
    sentMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 0,
    openedMessages: 0,
    clickedMessages: 0,
    unsubscribedMessages: 0,
    bouncedMessages: 0,
    complainedMessages: 0,
    createdAt: "2024-01-19T14:00:00Z",
    updatedAt: "2024-01-19T14:00:00Z",
  },
  {
    _id: "campaign_10",
    clinicId: "clinic_123",
    userId: "user_456",
    name: "Emergency Clinic Closure Alert",
    description: "Urgent notification about temporary clinic closure",
    type: "whatsapp",
    status: "completed",
    scheduleType: "now",
    template: "template_emergency_alert",
    subject: "",
    preheader: "",
    editorType: "text-editor",
    content:
      "🚨 *URGENT ALERT* 🚨\n\nClinic will be closed on {{closure_date}} due to {{reason}}. Emergency contact: {{emergency_phone}}",
    mediaUrl: "",
    mediaType: "",
    source: "Zeva",
    attachments: [],
    sender: "provider_789",
    recipients: ["lead_46", "lead_47", "lead_48", "lead_49", "lead_50"],
    segmentId: "segment_all_patients",
    totalBatches: 1,
    processedBatches: 1,
    lastProcessedBatches: 1,
    totalMessages: 1200,
    sentMessages: 1180,
    deliveredMessages: 1150,
    readMessages: 1100,
    failedMessages: 20,
    openedMessages: 1100,
    clickedMessages: 50,
    unsubscribedMessages: 3,
    bouncedMessages: 17,
    complainedMessages: 1,
    createdAt: "2024-01-17T08:00:00Z",
    updatedAt: "2024-01-17T08:30:00Z",
  },
];

const CampaignsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(
    sampleCampaigns as any,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [_permissions, _setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCampaigns, setTotalCampaigns] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [_showDeleteCampaignModal, setShowDeleteCampaignModal] =
    useState<boolean>(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  /* const [_deleteCampaignLoading, setDeleteCampaignLoading] =
    useState<boolean>(false); */

  // Preview modal state
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Campaign actions modal
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [actionType, setActionType] = useState<
    "pause" | "resume" | "cancel" | ""
  >("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const campaignsPerPage = 10;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get("/api/campaigns", {
        params: {
          page: currentPage,
          limit: campaignsPerPage,
          search: searchQuery,
          status: filterStatus === "all" ? undefined : filterStatus,
          type: filterType === "all" ? undefined : filterType,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.data?.success) {
        setCampaigns(res?.data?.campaigns || []);
        setTotalPages(res?.data?.pagination?.totalPages || 1);
        setTotalCampaigns(res?.data?.pagination?.totalResults || 0);
      }
    } catch (error) {
      console.log("Error fetching campaigns: ", error);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    filterStatus,
    filterType,
    searchQuery,
    token,
    campaignsPerPage,
  ]);

  const refreshCampaigns = async () => {
    if (!token) return;
    try {
      setIsRefreshing(true);
      await fetchCampaigns();
    } catch (error) {
      console.log("Error refreshing campaigns: ", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get campaign type icon
  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <FaWhatsapp className="h-5 w-5 text-green-600" />;
      case "email":
        return <Mail className="h-5 w-5 text-red-500" />;
      case "sms":
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      default:
        return <Send className="h-5 w-5" />;
    }
  };

  // Get campaign type badge
  const getCampaignTypeBadge = (type: string) => {
    const config: Record<string, { color: string; bg: string }> = {
      whatsapp: {
        color: "text-green-700",
        bg: "bg-green-50 border-green-100",
      },
      email: {
        color: "text-red-700",
        bg: "bg-red-50 border-red-100",
      },
      sms: {
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-100",
      },
    };

    const { color, bg } = config[type] || {
      color: "text-gray-700",
      bg: "bg-gray-50",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${bg} ${color}`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { color: string; bg: string; icon: React.ReactNode; label: string }
    > = {
      draft: {
        color: "text-gray-700",
        bg: "bg-gray-50 border-gray-100",
        icon: <FileText className="h-3 w-3" />,
        label: "Draft",
      },
      scheduled: {
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-100",
        icon: <Calendar className="h-3 w-3" />,
        label: "Scheduled",
      },
      processing: {
        color: "text-purple-700",
        bg: "bg-purple-50 border-purple-100",
        icon: <RefreshCcw className="h-3 w-3" />,
        label: "Processing",
      },
      paused: {
        color: "text-yellow-700",
        bg: "bg-yellow-50 border-yellow-100",
        icon: <PauseCircle className="h-3 w-3" />,
        label: "Paused",
      },
      completed: {
        color: "text-green-700",
        bg: "bg-green-50 border-green-100",
        icon: <CheckCircle className="h-3 w-3" />,
        label: "Completed",
      },
      failed: {
        color: "text-red-700",
        bg: "bg-red-50 border-red-100",
        icon: <XCircle className="h-3 w-3" />,
        label: "Failed",
      },
    };

    const { color, bg, icon, label } = config[status] || {
      color: "text-gray-700",
      bg: "bg-gray-50",
      icon: <FileText className="h-3 w-3" />,
      label: status,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${bg} ${color}`}
      >
        {icon}
        {label}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Calculate campaign progress percentage
  const calculateProgress = (campaign: Campaign) => {
    if (campaign.totalMessages === 0) return 0;
    if (campaign.status === "completed") return 100;

    const sent = campaign.sentMessages;
    const total = campaign.totalMessages;
    return Math.round((sent / total) * 100);
  };

  // Handle campaign actions
  const handleCampaignAction = async (action: string, campaignId: string) => {
    if (!token) return;

    if (action === "edit") {
      router.push(`/clinic/campaigns/${campaignId}/edit`);
      return;
    }

    if (action === "preview") {
      const camp = campaigns.find((c) => c._id === campaignId) || null;
      if (camp) {
        setPreviewCampaign(camp);
        setShowPreviewModal(true);
      }
      return;
    }

    if (action === "duplicate") {
      // Handle duplicate campaign
      try {
        const res = await axios.post(
          `/api/campaigns/${campaignId}/duplicate`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data.success) {
          fetchCampaigns();
        }
      } catch (error) {
        console.log("Error duplicating campaign: ", error);
      }
      return;
    }
  };

  const handleActionConfirm = async () => {
    if (!selectedCampaign || !token) return;

    try {
      setActionLoading(true);
      let endpoint = "";
      let method: "post" | "put" = "post";

      switch (actionType) {
        case "pause":
          endpoint = `/api/campaigns/${selectedCampaign._id}/pause`;
          break;
        case "resume":
          endpoint = `/api/campaigns/${selectedCampaign._id}/resume`;
          break;
        case "cancel":
          endpoint = `/api/campaigns/${selectedCampaign._id}/cancel`;
          break;
      }

      const res = await axios[method](
        endpoint,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.data.success) {
        fetchCampaigns();
        setShowActionModal(false);
        setActionType("");
      }
    } catch (error) {
      console.log("Error performing campaign action: ", error);
    } finally {
      setActionLoading(false);
    }
  };

  /* const _handleDeleteCampaign = async (campaignId: string | undefined) => {
    if (!token || !campaignId) return;
    try {
      setDeleteCampaignLoading(true);
      const res = await axios.delete(`/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.data?.success) {
        const filteredCampaigns = campaigns.filter((c) => c._id !== campaignId);
        setCampaigns(filteredCampaigns);
        setShowDeleteCampaignModal(false);
      }
    } catch (error) {
      console.log("Error deleting campaign: ", error);
    } finally {
      setDeleteCampaignLoading(false);
    }
  }; */

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Campaigns
            </h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
              Manage your communication campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshCampaigns}
              disabled={isRefreshing}
              className={`inline-flex items-center justify-center cursor-pointer gap-1.5 ${
                !isRefreshing ? "bg-white" : "bg-gray-200"
              } border border-gray-200 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium`}
            >
              <RefreshCcw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {!isRefreshing ? "Refresh" : "Refreshing..."}
            </button>
            <Link href="/clinic/campaigns/new">
              <button className="inline-flex items-center justify-center cursor-pointer gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium">
                <Plus className="h-5 w-5" />
                Create Campaign
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Campaigns</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {
                  campaigns.filter((c) =>
                    ["scheduled", "processing"].includes(c.status),
                  ).length
                }
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatNumber(
                  campaigns.reduce((sum, c) => sum + c.totalMessages, 0),
                )}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Send className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Open Rate</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {campaigns.length > 0
                  ? `${Math.round(campaigns.reduce((sum, c) => sum + (c.openedMessages / c.totalMessages) * 100, 0) / campaigns.length)}%`
                  : "0%"}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Eye className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Recipients</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatNumber(
                  campaigns.reduce((sum, c) => sum + c.recipients.length, 0),
                )}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search campaigns by name, description..."
              className="w-full pl-10 pr-4 py-2.5 text-gray-500 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 text-gray-600 bg-gray-50 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${
                viewMode === "grid" ? "bg-white shadow" : "hover:bg-gray-100"
              }`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${
                viewMode === "list" ? "bg-white shadow" : "hover:bg-gray-100"
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel
            </label>
            <select
              className="bg-white border border-gray-300 text-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="bg-white border border-gray-300 text-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => {
            const progress = calculateProgress(campaign);
            return (
              <div
                key={campaign._id}
                className="flex flex-col justify-between bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Campaign Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 text-gray-500 border border-gray-200 rounded-lg">
                          {getCampaignTypeIcon(campaign.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 truncate max-w-[180px]">
                            {campaign.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {campaign.recipients.length} recipients
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(campaign.status)}
                      </div>
                    </div>

                    {/* Type and Schedule */}
                    <div className="flex items-center gap-2 mt-2">
                      {getCampaignTypeBadge(campaign.type)}
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded">
                        {campaign.scheduleType === "now"
                          ? "Send Now"
                          : "Scheduled"}
                      </span>
                    </div>
                  </div>

                  {/* Campaign Content Preview */}
                  <div className="p-4">
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {campaign.description || "No description"}
                    </p>

                    {/* Progress Bar */}
                    {campaign.status === "processing" && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {campaign.sentMessages} of {campaign.totalMessages}{" "}
                          sent
                        </div>
                      </div>
                    )}

                    {/* Metrics */}
                    {campaign.status === "completed" &&
                      campaign.type === "email" && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">
                              Open Rate
                            </div>
                            <div className="text-sm font-semibold text-gray-800">
                              {campaign.totalMessages > 0
                                ? `${Math.round((campaign.openedMessages / campaign.totalMessages) * 100)}%`
                                : "0%"}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">
                              Click Rate
                            </div>
                            <div className="text-sm font-semibold text-gray-800">
                              {campaign.totalMessages > 0
                                ? `${Math.round((campaign.clickedMessages / campaign.totalMessages) * 100)}%`
                                : "0%"}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Campaign Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      {campaign.scheduleType === "later" &&
                      campaign.status === "scheduled"
                        ? `Scheduled ${formatDate(campaign.createdAt)}`
                        : `Created ${formatDate(campaign.createdAt)}`}
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status === "draft" && (
                        <button
                          onClick={() =>
                            handleCampaignAction("edit", campaign._id)
                          }
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          handleCampaignAction("preview", campaign._id)
                        }
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {["processing", "paused"].includes(campaign.status) && (
                        <button
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setActionType(
                              campaign.status === "processing"
                                ? "pause"
                                : "resume",
                            );
                            setShowActionModal(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                          title={
                            campaign.status === "processing"
                              ? "Pause"
                              : "Resume"
                          }
                        >
                          {campaign.status === "processing" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {["draft", "scheduled", "paused"].includes(
                        campaign.status,
                      ) && (
                        <button
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setShowDeleteCampaignModal(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const progress = calculateProgress(campaign);
                return (
                  <tr key={campaign._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                          {getCampaignTypeIcon(campaign.type)}
                        </div>
                        <div>
                          <div className="text-base font-medium text-gray-800">
                            {campaign.name}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 line-clamp-1 max-w-md">
                            {campaign.description || "No description"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getCampaignTypeBadge(campaign.type)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">
                        {formatNumber(campaign.recipients.length)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {campaign.status === "processing" ? (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{progress}%</span>
                            <span>
                              {campaign.sentMessages}/{campaign.totalMessages}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-green-600 h-1.5 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {campaign.status === "completed"
                            ? "Completed"
                            : campaign.status === "failed"
                              ? "Failed"
                              : "Pending"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(campaign.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCampaignAction("preview", campaign._id)
                          }
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {campaign.status === "draft" && (
                          <button
                            onClick={() =>
                              handleCampaignAction("edit", campaign._id)
                            }
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {["draft", "scheduled", "paused"].includes(
                          campaign.status,
                        ) && (
                          <button
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowDeleteCampaignModal(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {campaigns.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Send className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            No campaigns found
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchQuery || filterType !== "all" || filterStatus !== "all"
              ? "Try adjusting your search or filters to find what you're looking for."
              : "Get started by creating your first communication campaign."}
          </p>
          <Link href="/clinic/campaigns/new">
            <button className="inline-flex items-center justify-center cursor-pointer gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium">
              <Plus className="h-5 w-5" />
              Create Campaign
            </button>
          </Link>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Pagination */}
      {campaigns.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {(currentPage - 1) * campaignsPerPage + 1}-
            {currentPage * campaignsPerPage} of {totalCampaigns} campaign
            {totalCampaigns === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPreviewModal(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-4xl">
            <div className="bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div
                className={`px-6 py-4 flex justify-between items-center border-b ${
                  previewCampaign.type === "whatsapp"
                    ? "bg-green-50 border-green-100"
                    : previewCampaign.type === "email"
                      ? "bg-red-50 border-red-100"
                      : previewCampaign.type === "sms"
                        ? "bg-blue-50 border-blue-100"
                        : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    {getCampaignTypeIcon(previewCampaign.type)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {previewCampaign.name}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Campaign Preview • {previewCampaign.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-2 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Campaign Details */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    {previewCampaign.description && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Description
                        </h4>
                        <p className="text-gray-600 whitespace-pre-wrap">
                          {previewCampaign.description}
                        </p>
                      </div>
                    )}

                    {/* Content Preview */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Content
                      </h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        {previewCampaign.type === "email" &&
                          previewCampaign.subject && (
                            <div className="mb-2">
                              <span className="font-medium text-gray-700">
                                Subject:
                              </span>{" "}
                              {previewCampaign.subject}
                            </div>
                          )}
                        <div className="text-gray-800 whitespace-pre-wrap">
                          {previewCampaign.content || "No content available"}
                        </div>
                      </div>
                    </div>

                    {/* Media */}
                    {previewCampaign.mediaUrl && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Media
                        </h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {previewCampaign.mediaType === "image" ? (
                            <img
                              src={previewCampaign.mediaUrl}
                              alt="Campaign media"
                              className="w-full h-48 object-cover"
                            />
                          ) : previewCampaign.mediaType === "video" ? (
                            <video
                              src={previewCampaign.mediaUrl}
                              controls
                              className="w-full h-48 object-cover"
                            />
                          ) : (
                            <div className="p-4 bg-gray-50">
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-gray-400" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    Document
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Media attached to campaign
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Stats & Info */}
                  <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-bold text-gray-800 mb-3">
                        Campaign Details
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Status
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(previewCampaign.status)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Channel
                          </div>
                          <div>
                            {getCampaignTypeBadge(previewCampaign.type)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Schedule
                          </div>
                          <div className="text-sm text-gray-700">
                            {previewCampaign.scheduleType === "now"
                              ? "Send Immediately"
                              : "Scheduled"}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Recipients
                          </div>
                          <div className="text-sm text-gray-700">
                            {formatNumber(previewCampaign.recipients.length)}{" "}
                            contacts
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Created
                          </div>
                          <div className="text-sm text-gray-700">
                            {formatDate(previewCampaign.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    {previewCampaign.status !== "draft" && (
                      <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-lg p-4">
                        <h4 className="font-bold text-gray-800 mb-3">
                          Performance
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Sent</div>
                              <div className="text-lg font-bold text-gray-800">
                                {formatNumber(previewCampaign.sentMessages)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500">
                                Delivered
                              </div>
                              <div className="text-lg font-bold text-gray-800">
                                {formatNumber(
                                  previewCampaign.deliveredMessages,
                                )}
                              </div>
                            </div>
                          </div>

                          {previewCampaign.type === "email" && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-center">
                                  <div className="text-xs text-gray-500">
                                    Opened
                                  </div>
                                  <div className="text-lg font-bold text-gray-800">
                                    {formatNumber(
                                      previewCampaign.openedMessages,
                                    )}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-500">
                                    Clicked
                                  </div>
                                  <div className="text-lg font-bold text-gray-800">
                                    {formatNumber(
                                      previewCampaign.clickedMessages,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="pt-3 border-t border-blue-100">
                            <div className="text-xs text-gray-500">
                              Completion Rate
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{
                                    width: `${calculateProgress(previewCampaign)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {calculateProgress(previewCampaign)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {showActionModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowActionModal(false);
              setActionType("");
            }}
          />
          <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    actionType === "pause"
                      ? "bg-yellow-50 text-yellow-600"
                      : actionType === "resume"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                  }`}
                >
                  {actionType === "pause" ? (
                    <Pause className="h-6 w-6" />
                  ) : actionType === "resume" ? (
                    <Play className="h-6 w-6" />
                  ) : (
                    <X className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {actionType === "pause"
                      ? "Pause Campaign"
                      : actionType === "resume"
                        ? "Resume Campaign"
                        : "Cancel Campaign"}
                  </h3>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                {actionType === "pause"
                  ? `Are you sure you want to pause "${selectedCampaign.name}"? The campaign will stop sending messages.`
                  : actionType === "resume"
                    ? `Are you sure you want to resume "${selectedCampaign.name}"? The campaign will continue sending messages.`
                    : `Are you sure you want to cancel "${selectedCampaign.name}"? This action cannot be undone.`}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setActionType("");
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActionConfirm}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                    actionType === "pause"
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : actionType === "resume"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading
                    ? "Processing..."
                    : actionType === "pause"
                      ? "Pause Campaign"
                      : actionType === "resume"
                        ? "Resume Campaign"
                        : "Cancel Campaign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Modal */}
      {/* <DeleteCampaignModal
        isOpen={showDeleteCampaignModal}
        onClose={() => setShowDeleteCampaignModal(false)}
        onConfirm={() => handleDeleteCampaign(selectedCampaign?._id)}
        loading={deleteCampaignLoading}
      /> */}
    </div>
  );
};

// Layout configuration
CampaignsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedCampaignsPage = withClinicAuth(
  CampaignsPage,
) as NextPageWithLayout;
ProtectedCampaignsPage.getLayout = CampaignsPage.getLayout;

export default ProtectedCampaignsPage;
