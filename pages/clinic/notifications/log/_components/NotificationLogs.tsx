import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  ChevronDown,
  MessageCircle,
  Mail,
  Bell,
  MessageSquare,
  Package,
  Calendar,
  Activity,
  Heart,
  Gift,
  Star,
  ShieldCheck,
  CreditCard,
  User,
  Phone,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  FileText,
  Send,
  Check,
  AlertCircle,
  Zap,
  UserCheck,
  Timer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Reply,
  Link2,
  ArrowLeft,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import useNotificationLogs, {
  NotificationLog,
  ChannelId,
  NotificationStatus,
} from "../_hooks/useNotificationLogs";
import { FaWhatsapp } from "react-icons/fa";
import { useRouter } from "next/router";

// ============================================================
// CHANNEL & CATEGORY META
// ============================================================

interface ChannelMeta {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
}

const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "#25D366",
    bg: "rgba(37, 211, 102, 0.12)",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    color: "#6FA8E0",
    bg: "rgba(111, 168, 224, 0.12)",
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "#C39FEF",
    bg: "rgba(195, 159, 239, 0.12)",
  },
  app_push: {
    label: "App Push",
    icon: Bell,
    color: "#F0A868",
    bg: "rgba(240, 168, 104, 0.12)",
  },
};

interface CategoryMeta {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  payment: {
    label: "Payment & Billing",
    icon: CreditCard,
    color: "#E8C88A",
    bg: "rgba(232, 200, 138, 0.12)",
    border: "rgba(232, 200, 138, 0.25)",
  },
  appointment: {
    label: "Appointments",
    icon: Calendar,
    color: "#7EB6E0",
    bg: "rgba(126, 182, 224, 0.12)",
    border: "rgba(126, 182, 224, 0.25)",
  },
  package: {
    label: "Packages & Memberships",
    icon: Package,
    color: "#B79CE0",
    bg: "rgba(183, 156, 224, 0.12)",
    border: "rgba(183, 156, 224, 0.25)",
  },
  followup: {
    label: "Follow-Up & Treatment",
    icon: Activity,
    color: "#6FCF97",
    bg: "rgba(111, 207, 151, 0.12)",
    border: "rgba(111, 207, 151, 0.25)",
  },
  engagement: {
    label: "Patient Engagement",
    icon: Heart,
    color: "#F0949C",
    bg: "rgba(240, 148, 156, 0.12)",
    border: "rgba(240, 148, 156, 0.25)",
  },
  offer: {
    label: "Offers & Referrals",
    icon: Gift,
    color: "#F0A868",
    bg: "rgba(240, 168, 104, 0.12)",
    border: "rgba(240, 168, 104, 0.25)",
  },
  feedback: {
    label: "Feedback",
    icon: Star,
    color: "#7ED9D2",
    bg: "rgba(126, 217, 210, 0.12)",
    border: "rgba(126, 217, 210, 0.25)",
  },
  security: {
    label: "Security",
    icon: ShieldCheck,
    color: "#E88787",
    bg: "rgba(232, 135, 135, 0.12)",
    border: "rgba(232, 135, 135, 0.25)",
  },
};

// ============================================================
// STATUS CONFIG
// ============================================================

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
  dotColor: string;
}

const statusConfig: Record<NotificationStatus, StatusConfig> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "#94A3B8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.2)",
    dotColor: "#94A3B8",
  },
  queued: {
    label: "Queued",
    icon: Timer,
    color: "#94A3B8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.2)",
    dotColor: "#94A3B8",
  },
  sent: {
    label: "Sent",
    icon: Send,
    color: "#3B82F6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.25)",
    dotColor: "#3B82F6",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.25)",
    dotColor: "#10B981",
  },
  read: {
    label: "Read",
    icon: Check,
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.25)",
    dotColor: "#10B981",
  },
  opened: {
    label: "Opened",
    icon: Eye,
    color: "#8B5CF6",
    bg: "rgba(139, 92, 246, 0.12)",
    border: "rgba(139, 92, 246, 0.25)",
    dotColor: "#8B5CF6",
  },
  clicked: {
    label: "Clicked",
    icon: ExternalLink,
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.25)",
    dotColor: "#F59E0B",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.25)",
    dotColor: "#EF4444",
  },
};

// ============================================================
// ICON WRAPPER
// ============================================================

const IconWithColor: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  size?: number;
  color?: string;
  className?: string;
}> = ({ icon: Icon, size = 16, color, className = "" }) => {
  return (
    <span style={{ color }} className={`inline-flex ${className}`}>
      <Icon size={size} />
    </span>
  );
};

// ============================================================
// TEMPLATE RENDERERS
// ============================================================

function WhatsAppTemplatePreview({ log }: { log: NotificationLog }) {
  // Get template - this should be the populated object
  const template = log.templateId as any;
  const provider = log.providerId as any;

  if (!template || typeof template === "string") {
    return (
      <div className="text-center py-8 text-[#94A3B8] dark:text-[#64748B]">
        <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No template content available</p>
        <p className="text-xs mt-1">Template ID: {String(template)}</p>
      </div>
    );
  }

  // Extract template data - use the template object directly
  const buttons = template.buttons || template.templateButtons || [];
  const headerType = template.headerType || "";
  const headerText = template.headerText || "";
  const headerFileUrl = template.headerFileUrl || "";
  const content = template.content || "";
  const footer = template.footer || "";
  const isHeader = template.isHeader !== false;
  const isFooter = template.isFooter || false;
  const isButton = template.isButton || false;
  const templateName = template.name || "Template";
  const language = template.language || "";
  const category = template.category || "";

  // Get provider info
  const providerName = provider?.label || provider?.name || "WhatsApp";

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative rounded-[2rem] border-[8px] border-[#E8E3D8] dark:border-[#2a2f3e] bg-[#e5ddd5] dark:bg-[#1a1f2e] shadow-xl overflow-hidden flex flex-col min-h-[480px] max-h-[640px]">
        {/* Status bar - now part of normal flow */}
        <div className="h-6 bg-black flex items-center justify-between px-4 flex-shrink-0">
          <span className="text-[9px] text-white font-semibold">9:41</span>
          <div className="w-1.5 h-1.5 rounded-full bg-black ring-1 ring-white/20" />
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-[1px] border border-white/80" />
          </div>
        </div>

        {/* Main content wrapper - no longer absolute, just flex-1 */}
        <div className="flex-1 bg-[#e5ddd5] dark:bg-[#1a1f2e] flex flex-col min-h-0">
          {/* Header */}
          <div className="px-3.5 py-3 flex items-center gap-2.5 text-white bg-[#075e54] dark:bg-[#0d4a44] flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <FaWhatsapp size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{providerName}</p>
              <p className="text-[9px] opacity-75">online</p>
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-0">
            <div className="bg-white dark:bg-[#2a2f3e] rounded-xl rounded-tl-none p-3 shadow-sm max-w-[92%]">
              {/* Template name badge */}
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-[#F1ECE0] dark:border-[#2a2f3e]">
                <span className="text-[9px] font-medium text-[#94A3B8] dark:text-[#64748B]">
                  {templateName}
                </span>
                {language && (
                  <span className="text-[8px] text-[#94A3B8] dark:text-[#64748B] bg-[#F1F5F9] dark:bg-[#2a2f3e] px-1.5 py-0.5 rounded">
                    {language}
                  </span>
                )}
                {category && (
                  <span className="text-[8px] text-[#94A3B8] dark:text-[#64748B] bg-[#F1F5F9] dark:bg-[#2a2f3e] px-1.5 py-0.5 rounded">
                    {category}
                  </span>
                )}
              </div>

              {/* Header Media */}
              {isHeader &&
                headerType &&
                headerType !== "text" &&
                headerFileUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden bg-[#F1F5F9] dark:bg-[#1a1f2e]">
                    {headerType === "image" ? (
                      <img
                        src={headerFileUrl}
                        alt="Header"
                        className="w-full h-36 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : headerType === "video" ? (
                      <video
                        src={headerFileUrl}
                        className="w-full h-36 object-cover bg-black"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <a
                        href={headerFileUrl || ""}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 flex items-center gap-2 hover:bg-[#F1F5F9] dark:hover:bg-[#1a1f2e] transition-colors"
                      >
                        <FileText
                          size={14}
                          className="text-[#C9A86C] flex-shrink-0"
                        />
                        <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] truncate">
                          {headerType} attachment
                        </span>
                      </a>
                    )}
                  </div>
                )}

              {/* Header Text */}
              {isHeader && headerType === "text" && headerText && (
                <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-1.5 leading-snug">
                  {headerText}
                </p>
              )}

              {/* Body Content */}
              {content ? (
                <p className="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {content}
                </p>
              ) : (
                <p className="text-[12px] text-gray-400 dark:text-gray-500 italic">
                  No content in template
                </p>
              )}

              {/* Footer */}
              {isFooter && footer && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                  {footer}
                </p>
              )}

              <span className="block text-right text-[9px] text-gray-400 dark:text-gray-500 mt-1.5">
                10:30 AM
              </span>
            </div>

            {/* Buttons */}
            {isButton && buttons.length > 0 && (
              <div className="max-w-[92%] space-y-1.5">
                {buttons.map((btn: any, i: number) => {
                  const label =
                    btn.text ||
                    btn.label ||
                    btn.reply?.title ||
                    `Button ${i + 1}`;
                  const isUrl =
                    btn.type === "URL" || btn.type === "CALL_TO_ACTION";
                  const isPhone = btn.type === "PHONE_NUMBER";
                  const isReply = btn.type === "QUICK_REPLY" || !btn.type;

                  return (
                    <div
                      key={i}
                      className="bg-white dark:bg-[#2a2f3e] rounded-xl py-2.5 shadow-sm text-center text-[11px] font-semibold text-[#25D366] flex items-center justify-center gap-2 border border-[#E8E3D8] dark:border-[#2a2f3e] cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#1a1f2e] transition-colors"
                    >
                      {isUrl && <Link2 size={13} />}
                      {isPhone && <Phone size={13} />}
                      {isReply && <Reply size={13} className="rotate-180" />}
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="bg-white dark:bg-[#1a1f2e] px-3 py-2.5 flex items-center gap-2 flex-shrink-0 border-t border-[#E8E3D8] dark:border-[#2a2f3e]">
            <div className="flex-1 h-8 text-xs text-[#808080] dark:text-[#94A3B8] flex items-center px-3 bg-[#f5f5f5] dark:bg-[#2a2f3e] rounded-full">
              Type your message...
            </div>
            <div className="w-8 h-8 rounded-full bg-[#075e54] dark:bg-[#0d4a44] flex items-center justify-center flex-shrink-0">
              <Reply size={13} className="text-white rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmsTemplatePreview({ log }: { log: NotificationLog }) {
  const template = log.templateId as any;
  const provider = log.providerId as any;
  const content = template?.content || "Your SMS message will appear here...";

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="rounded-2xl border border-[#E8E3D8] dark:border-[#2a2f3e] bg-white dark:bg-[#1a1f2e] shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#C9A86C] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} />
            <span className="text-xs font-bold">Messages</span>
          </div>
          <span className="text-[10px] opacity-80 truncate max-w-[120px]">
            {provider?.label || "Recipient"}
          </span>
        </div>

        {/* Thread area */}
        <div className="flex-1 bg-[#F1F5F9] dark:bg-[#0d1117] p-3.5 flex flex-col justify-end min-h-[200px]">
          <div className="max-w-[85%] ml-auto">
            <div className="bg-[#C9A86C] rounded-2xl rounded-br-sm px-3.5 py-2.5 shadow-sm">
              <p className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
            </div>
            <p className="text-[9px] text-[#94A3B8] dark:text-[#64748B] text-right mt-1.5 mr-1">
              Delivered • 12:00 PM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailTemplatePreview({ log }: { log: NotificationLog }) {
  const template = log.templateId as any;
  const provider = log.providerId as any;

  if (!template) {
    return (
      <div className="text-center py-8 text-[#94A3B8] dark:text-[#64748B]">
        <Mail size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No email content available</p>
      </div>
    );
  }

  const subject = template.subject || "Email subject";
  const preheader = template.preheader || "";
  const content = template.content || "";

  return (
    <div className="w-full max-w-[500px] mx-auto border border-[#E8E3D8] dark:border-[#2a2f3e] rounded-xl overflow-hidden bg-white dark:bg-[#1a1f2e] shadow-sm">
      {/* Inbox preview row */}
      <div className="flex items-start gap-3 p-3 border-b border-[#F1ECE0] dark:border-[#2a2f3e] bg-[#FBF9F4] dark:bg-[#0d1613]">
        <div className="w-9 h-9 rounded-full bg-[#C9A86C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
          {provider?.label?.[0]?.toUpperCase() || "M"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-center mb-0.5 gap-2">
            <span className="text-xs font-bold text-[#1A1A2E] dark:text-[#E8E8F0] truncate">
              {provider?.label || "Sender Name"}
            </span>
            <span className="text-[9px] text-[#94A3B8] dark:text-[#64748B] flex-shrink-0">
              10:30 AM
            </span>
          </div>
          <p className="text-xs font-bold text-[#1A1A2E] dark:text-[#E8E8F0] truncate">
            {subject}
          </p>
          {preheader && (
            <p className="text-[10px] text-[#94A3B8] dark:text-[#64748B] truncate">
              {preheader}
            </p>
          )}
        </div>
      </div>

      {/* Email body */}
      <div className="p-4 max-h-[300px] overflow-y-auto">
        {content ? (
          <div
            className="text-[13px] text-[#1A1A2E] dark:text-[#E8E8F0] leading-relaxed prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="text-center py-8 text-[#94A3B8] dark:text-[#64748B]">
            <p className="text-sm">Empty email content</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 pb-2 px-4 border-t border-[#F1ECE0] dark:border-[#2a2f3e] text-center bg-[#FBF9F4] dark:bg-[#0d1613]">
        <p className="text-[9px] text-[#94A3B8] dark:text-[#64748B] leading-relaxed">
          Sent by {provider?.label || "Your Clinic"}
          <br />
          {provider?.email || "contact@zeva.app"}
        </p>
        <div className="flex justify-center gap-4 mt-1">
          <span className="text-[9px] text-[#C9A86C] cursor-pointer hover:underline">
            Unsubscribe
          </span>
          <span className="text-[9px] text-[#C9A86C] cursor-pointer hover:underline">
            Privacy Policy
          </span>
        </div>
      </div>
    </div>
  );
}

function AppPushTemplatePreview({ log }: { log: NotificationLog }) {
  const template = log.templateId as any;
  const content = template?.content || "Your push notification content...";

  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="rounded-2xl border border-[#E8E3D8] dark:border-[#2a2f3e] bg-white dark:bg-[#1a1f2e] shadow-xl overflow-hidden">
        {/* Phone mockup */}
        <div className="relative">
          {/* Status bar */}
          <div className="bg-[#1A1A2E] dark:bg-[#0d1117] px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] text-white font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-[1px] border border-white/80" />
            </div>
          </div>

          {/* App header */}
          <div className="bg-[#C9A86C] px-4 py-3 flex items-center gap-2">
            <Bell size={16} className="text-white" />
            <span className="text-sm font-bold text-white">Zeva</span>
            <span className="ml-auto text-[10px] text-white/80">2 min ago</span>
          </div>

          {/* Notification */}
          <div className="p-4 space-y-3">
            <div className="bg-[#F8F5EF] dark:bg-[#2a2f3e] rounded-xl p-3.5 border-l-4 border-[#C9A86C] shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#C9A86C]/20 flex items-center justify-center flex-shrink-0">
                  <Bell size={14} className="text-[#C9A86C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1A1A2E] dark:text-[#E8E8F0]">
                    {log.label || "Notification"}
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-0.5 leading-relaxed">
                    {content}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-[#C9A86C] text-white text-xs font-semibold hover:bg-[#B89A5E] transition-colors">
                View
              </button>
              <button className="flex-1 py-2 rounded-lg bg-[#F1F5F9] dark:bg-[#2a2f3e] text-[#475569] dark:text-[#CBD5E1] text-xs font-semibold hover:bg-[#E8E3D8] dark:hover:bg-[#3a3f4e] transition-colors">
                Dismiss
              </button>
            </div>
          </div>

          {/* Home indicator */}
          <div className="py-2 flex justify-center border-t border-[#F1ECE0] dark:border-[#2a2f3e]">
            <div className="w-20 h-1 rounded-full bg-[#E8E3D8] dark:bg-[#2a2f3e]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ log }: { log: NotificationLog }) {
  console.log("TemplatePreview - log:", log);
  console.log("TemplatePreview - templateId:", log.templateId);
  console.log("TemplatePreview - channel:", log.channel);

  // Check if template exists and is populated
  const hasTemplate =
    log.templateId && typeof log.templateId === "object" && log.templateId._id;

  if (!hasTemplate) {
    return (
      <div className="text-center py-8 text-[#94A3B8] dark:text-[#64748B]">
        <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No template content available</p>
        <p className="text-xs mt-1 text-[#94A3B8] dark:text-[#64748B]">
          Template ID:{" "}
          {typeof log.templateId === "string"
            ? log.templateId
            : "Not populated"}
        </p>
      </div>
    );
  }

  switch (log.channel) {
    case "whatsapp":
      return <WhatsAppTemplatePreview log={log} />;
    case "sms":
      return <SmsTemplatePreview log={log} />;
    case "email":
      return <EmailTemplatePreview log={log} />;
    case "app_push":
      return <AppPushTemplatePreview log={log} />;
    default:
      return (
        <div className="text-center py-8 text-[#94A3B8] dark:text-[#64748B]">
          <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Preview not available for this channel</p>
        </div>
      );
  }
}

// ============================================================
// METRICS CARDS
// ============================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: "up" | "down" | "neutral";
  color?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  icon: Icon,
  trend = "neutral",
  color = "text-primary",
  loading = false,
}) => {
  const isPositive = trend === "up";
  const isNeutral = trend === "neutral";
  return (
    <div className="group rounded-2xl p-5 bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center bg-[#F8F5EF] dark:bg-[#2a2f3e] group-hover:scale-105 transition-transform duration-300 ${color}`}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Icon size={18} />
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
              {label}
            </p>
            {loading ? (
              <div className="h-8 w-20 bg-[#F1F5F9] dark:bg-[#2a2f3e] rounded-lg animate-pulse mt-0.5" />
            ) : (
              <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E8E8F0] font-display tracking-tight mt-0.5">
                {value}
              </p>
            )}
          </div>
        </div>
        {change && !loading && (
          <div
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isNeutral
                ? "text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#2a2f3e]"
                : isPositive
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                  : "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30"
            }`}
          >
            {!isNeutral &&
              (isPositive ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              ))}
            {change}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// EXPANDED DETAIL VIEW
// ============================================================

function ExpandedDetails({ log }: { log: NotificationLog }) {
  const channelMeta = CHANNEL_META[log.channel];
  const ChannelIcon = channelMeta.icon;
  const catMeta = CATEGORY_META[log.category] || {
    label: log.category,
    icon: Package,
    color: "#888",
    bg: "rgba(136, 136, 136, 0.12)",
    border: "rgba(136, 136, 136, 0.2)",
  };
  const CatIcon = catMeta.icon;
  const status = statusConfig[log.status];

  const patientName =
    typeof log.patientId === "object" && log.patientId !== null
      ? `${log.patientId.firstName || ""} ${log.patientId.lastName || ""}`.trim() ||
        log.patientId.email ||
        log.patientId.mobileNumber ||
        "Unknown"
      : "Unknown";

  const timelineItems = [
    ...(log.sentAt
      ? [{ label: "Sent", date: log.sentAt, icon: Send, color: "#3B82F6" }]
      : []),
    ...(log.deliveredAt
      ? [
          {
            label: "Delivered",
            date: log.deliveredAt,
            icon: CheckCircle2,
            color: "#10B981",
          },
        ]
      : []),
    ...(log.readAt
      ? [{ label: "Read", date: log.readAt, icon: Check, color: "#10B981" }]
      : []),
    ...(log.openedAt
      ? [{ label: "Opened", date: log.openedAt, icon: Eye, color: "#8B5CF6" }]
      : []),
    ...(log.clickedAt
      ? [
          {
            label: "Clicked",
            date: log.clickedAt,
            icon: ExternalLink,
            color: "#F59E0B",
          },
        ]
      : []),
  ];

  return (
    <div className="pt-3 pb-5 pl-4">
      <div className="ml-10 mr-4 rounded-2xl bg-white dark:bg-[#141927] border border-[#E8E3D8] dark:border-[#2a2f3e] shadow-sm overflow-hidden">
        <div className="relative px-6 pt-5 pb-4 border-b border-[#F1ECE0] dark:border-[#2a2f3e]/60">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: catMeta.color }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: catMeta.bg, color: catMeta.color }}
              >
                <CatIcon size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1A1A2E] dark:text-[#E8E8F0]">
                    {log.label}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: catMeta.bg,
                      color: catMeta.color,
                      border: `1px solid ${catMeta.border}`,
                    }}
                  >
                    {catMeta.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#94A3B8] dark:text-[#64748B]">
                    {patientName}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-[#2a2f3e]" />
                  <IconWithColor
                    icon={ChannelIcon}
                    size={12}
                    color={channelMeta.color}
                  />
                  <span className="text-xs text-[#94A3B8] dark:text-[#64748B]">
                    {channelMeta.label}
                  </span>
                </div>
              </div>
            </div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: status.color,
                background: status.bg,
                border: `1px solid ${status.border}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status.dotColor }}
              />
              {status.label}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 bg-[#F8F5EF] dark:bg-[#1e2335] border border-[#EDE7DA] dark:border-[#2a2f3e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                Recipient
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {log.recipient === "patient" ? (
                  <User size={13} className="text-[#94A3B8]" />
                ) : (
                  <Phone size={13} className="text-[#94A3B8]" />
                )}
                <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                  {log.recipient === "patient" ? "Patient" : "Staff"}
                </span>
              </div>
            </div>
            <div className="rounded-xl p-3 bg-[#F8F5EF] dark:bg-[#1e2335] border border-[#EDE7DA] dark:border-[#2a2f3e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                Trigger
              </p>
              <p className="text-sm font-mono font-medium text-[#1A1A2E] dark:text-[#E8E8F0] mt-1 truncate">
                {log.trigger.event}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[#F8F5EF] dark:bg-[#1e2335] border border-[#EDE7DA] dark:border-[#2a2f3e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                Triggered By
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {log.triggeredBy.type === "system" ? (
                  <Zap size={13} className="text-[#94A3B8]" />
                ) : (
                  <UserCheck size={13} className="text-[#94A3B8]" />
                )}
                <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                  {log.triggeredBy.type === "system"
                    ? "System"
                    : log.triggeredBy.userName || "User"}
                </span>
              </div>
            </div>
            <div className="rounded-xl p-3 bg-[#F8F5EF] dark:bg-[#1e2335] border border-[#EDE7DA] dark:border-[#2a2f3e]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                Log ID
              </p>
              <p className="text-sm font-mono font-medium text-[#1A1A2E] dark:text-[#E8E8F0] mt-1 truncate">
                {log._id.slice(0, 12)}...
              </p>
            </div>
          </div>

          {/* Template Preview - Full channel-specific render */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle size={14} className="text-[#94A3B8]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                Template Preview
              </span>
              <span className="ml-auto text-[10px] text-[#94A3B8] dark:text-[#64748B]">
                {channelMeta.label}
              </span>
            </div>
            <TemplatePreview log={log} />
          </div>

          {/* Timeline */}
          {timelineItems.length > 0 && (
            <div className="rounded-xl p-4 bg-[#F8F5EF] dark:bg-[#1e2335] border border-[#EDE7DA] dark:border-[#2a2f3e]">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-[#94A3B8]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-[#64748B]">
                  Timeline
                </span>
              </div>
              <div className="relative pl-6 space-y-2.5">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-[#C9A86C]/40 to-transparent" />
                {timelineItems.map((item, idx) => {
                  //   const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                          style={{
                            borderColor: item.color,
                            background: "white",
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: item.color }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#94A3B8] dark:text-[#64748B]">
                        {format(item.date, "MMM dd, HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error if any */}
          {log.error && (
            <div className="rounded-xl p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5">
              <AlertCircle
                size={16}
                className="text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5"
              />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Error
                </span>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-0.5">
                  {log.error}
                </p>
              </div>
            </div>
          )}

          {/* Meta footer */}
          <div className="flex items-center justify-between pt-2 border-t border-[#EDE7DA] dark:border-[#2a2f3e]">
            <div className="flex items-center gap-4 text-[10px] text-[#94A3B8] dark:text-[#64748B]">
              <span>
                Created {format(log.createdAt, "MMM dd, yyyy · HH:mm")}
              </span>
              {log.sourceId && (
                <>
                  <span className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-[#2a2f3e]" />
                  <span>Source: {log.sourceId}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOG ROW
// ============================================================

function LogRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: NotificationLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const channelMeta = CHANNEL_META[log.channel];
  const ChannelIcon = channelMeta.icon;
  const catMeta = CATEGORY_META[log.category] || {
    label: log.category,
    icon: Package,
    color: "#888",
    bg: "rgba(136, 136, 136, 0.12)",
    border: "rgba(136, 136, 136, 0.2)",
  };
  const CatIcon = catMeta.icon;
  const status = statusConfig[log.status];
  const StatusIcon = status.icon;
  const timeAgo = formatDistanceToNow(log.createdAt, {
    addSuffix: true,
  });

  const patientName =
    typeof log.patientId === "object" && log.patientId !== null
      ? `${log.patientId.firstName || ""} ${log.patientId.lastName || ""}`.trim() ||
        log.patientId.email ||
        log.patientId.mobileNumber ||
        "Unknown"
      : "Unknown";

  return (
    <div className="border-b border-[#F1ECE0] dark:border-[#2a2f3e]/60 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3.5 px-5 py-4 hover:bg-[#F8F5EF] dark:hover:bg-[#1e2335]/60 transition-all duration-200"
      >
        <div className="relative flex-shrink-0">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2"
            style={{
              background: catMeta.bg,
              borderColor: catMeta.color,
              color: catMeta.color,
            }}
          >
            {patientName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "P"}
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-[#111827] flex items-center justify-center"
            style={{ background: channelMeta.color }}
          >
            <IconWithColor icon={ChannelIcon} size={8} color="#ffffff" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E8E8F0] truncate">
              {patientName}
            </span>
            <span className="text-[10px] font-medium text-[#94A3B8] dark:text-[#64748B] truncate">
              {log.label}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: catMeta.bg,
                color: catMeta.color,
                border: `1px solid ${catMeta.border}`,
              }}
            >
              <IconWithColor icon={CatIcon} size={9} color={catMeta.color} />
              {catMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#94A3B8] dark:text-[#64748B] truncate flex-wrap">
            <IconWithColor
              icon={ChannelIcon}
              size={11}
              color={channelMeta.color}
            />
            <span>{channelMeta.label}</span>
            <span className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-[#2a2f3e]" />
            <span>{log.trigger.event}</span>
            <span className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-[#2a2f3e]" />
            <span>{timeAgo}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
            style={{
              color: status.color,
              background: status.bg,
              border: `1px solid ${status.border}`,
            }}
          >
            <IconWithColor icon={StatusIcon} size={10} color={status.color} />
            {status.label}
          </div>
          <div
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isExpanded
                ? "bg-[#C9A86C]/10 text-[#C9A86C] rotate-180"
                : "bg-[#F1ECE0] dark:bg-[#2a2f3e] text-[#94A3B8] hover:bg-[#E8E3D8] dark:hover:bg-[#3a3f4e]"
            }`}
          >
            <ChevronDown size={15} />
          </div>
        </div>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <ExpandedDetails log={log} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGINATION
// ============================================================

function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  limit,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
  limit: number;
}) {
  const getPageNumbers = () => {
    // const pages: (number | string)[] = [];
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (page + delta < totalPages - 1) {
      rangeWithDots.push("...", totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const from = total > 0 ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[#F1ECE0] dark:border-[#2a2f3e]/60 bg-[#FBF9F4] dark:bg-bg-surface">
      <div className="text-xs text-[#94A3B8] dark:text-[#64748B]">
        Showing{" "}
        <span className="font-semibold text-[#1A1A2E] dark:text-[#E8E8F0]">
          {from}–{to}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-[#1A1A2E] dark:text-[#E8E8F0]">
          {total}
        </span>{" "}
        logs
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#E8E3D8] dark:border-[#2a2f3e] bg-white dark:bg-[#1a1f2e] text-[#94A3B8] hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] hover:text-[#1A1A2E] dark:hover:text-[#E8E8F0] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ChevronLeft size={15} />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span
              key={`dots-${idx}`}
              className="w-9 h-9 flex items-center justify-center text-xs text-[#94A3B8] dark:text-[#64748B]"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all ${
                p === page
                  ? "bg-[#C9A86C] text-white shadow-sm shadow-[#C9A86C]/25"
                  : "border border-[#E8E3D8] dark:border-[#2a2f3e] bg-white dark:bg-[#1a1f2e] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] hover:text-[#1A1A2E] dark:hover:text-[#E8E8F0]"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#E8E3D8] dark:border-[#2a2f3e] bg-white dark:bg-[#1a1f2e] text-[#94A3B8] hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] hover:text-[#1A1A2E] dark:hover:text-[#E8E8F0] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FILTER DROPDOWN
// ============================================================

const FilterDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({
  isOpen,
  //  onClose,
  children,
}) => {
  if (!isOpen) return null;
  return (
    <div className="absolute z-20 mt-1.5 right-0 min-w-[180px] bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] rounded-xl shadow-xl overflow-hidden">
      {children}
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const NotificationLogs: React.FC = () => {
  const router = useRouter();
  const {
    logs,
    analytics,
    categories,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    // startDate,
    // setStartDate,
    // endDate,
    // setEndDate,
    // page,
    pagination,
    // nextPage,
    // prevPage,
    goToPage,
    refetch,
  } = useNotificationLogs();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<boolean>(false);
  const [channelDropdownOpen, setChannelDropdownOpen] =
    useState<boolean>(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] =
    useState<boolean>(false);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const trend =
    analytics.trend > 0
      ? `↑ ${analytics.trend}%`
      : analytics.trend < 0
        ? `↓ ${Math.abs(analytics.trend)}%`
        : "—";

  return (
    <div className="font-body text-[#1A1A2E] dark:text-[#E8E8F0] relative px-6 sm:px-10 py-6 sm:py-10 bg-[#FAFAF8] dark:bg-[#0d1117] min-h-screen">
      <style>{`
        .font-body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-mono { font-family: 'IBM Plex Mono', 'SF Mono', monospace; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #E8E3D8; border-radius: 99px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .dark ::-webkit-scrollbar-thumb { background: #2a2f3e; }

        .dropdown-enter { animation: dropdownFade 0.15s ease-out; }
        @keyframes dropdownFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        {/* Row 1: Back + eyebrow */}
        <button
          onClick={() => router.back()}
          className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-[#94A3B8] dark:text-[#64748B] hover:text-[#1A1A2E] dark:hover:text-[#E8E8F0] transition-colors mb-5"
        >
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          Back
        </button>

        {/* Row 2: Title + description (left) — Action button (right) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A86C] mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A86C]" />
              Zeva · Communications
            </div>
            <h2 className="m-0 font-display text-[clamp(26px,3.5vw,36px)] font-semibold tracking-tight text-[#1A1A2E] dark:text-[#E8E8F0] leading-tight">
              Notification Logs
            </h2>
            <p className="m-0 mt-1.5 text-sm text-[#94A3B8] dark:text-[#64748B]">
              Complete delivery history and patient engagement metrics.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] text-sm font-medium text-[#475569] dark:text-[#CBD5E1] hover:border-[#C9A86C]/50 hover:text-[#1A1A2E] dark:hover:text-[#E8E8F0] transition-colors shadow-sm disabled:opacity-60"
          >
            <Loader2 size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Row 3: Stats strip */}
        <div className="mt-6 flex items-center gap-6 px-5 py-4 rounded-2xl bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[13px] text-[#94A3B8] dark:text-[#64748B]">
              Delivered
            </span>
            <span className="text-[15px] font-semibold text-[#1A1A2E] dark:text-[#E8E8F0] tabular-nums">
              {loading ? "—" : analytics.delivered}
            </span>
          </div>
          <div className="w-px h-5 bg-[#E8E3D8] dark:bg-[#2a2f3e]" />
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
            <span className="text-[13px] text-[#94A3B8] dark:text-[#64748B]">
              Failed
            </span>
            <span className="text-[15px] font-semibold text-[#1A1A2E] dark:text-[#E8E8F0] tabular-nums">
              {loading ? "—" : analytics.failed}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        <MetricCard
          label="Total Sent"
          value={loading ? "..." : analytics.total}
          change={trend}
          icon={MessageCircle}
          trend={
            analytics.trend > 0
              ? "up"
              : analytics.trend < 0
                ? "down"
                : "neutral"
          }
          color="text-emerald-500"
          loading={loading}
        />
        <MetricCard
          label="Delivered"
          value={loading ? "..." : analytics.delivered}
          icon={CheckCircle2}
          color="text-emerald-500"
          loading={loading}
        />
        <MetricCard
          label="Delivery Rate"
          value={
            loading
              ? "..."
              : analytics.total > 0
                ? `${Math.round((analytics.delivered / analytics.total) * 100)}%`
                : "0%"
          }
          icon={TrendingUp}
          color="text-[#C9A86C]"
          loading={loading}
        />
        <MetricCard
          label="Patient Actions"
          value={loading ? "..." : analytics.opened}
          icon={Eye}
          color="text-violet-500"
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-7">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full text-sm rounded-xl pl-10 pr-4 py-2.5 bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] text-[#1A1A2E] dark:text-[#E8E8F0] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/30 shadow-sm transition-shadow"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C9A86C]/40 transition-colors shadow-sm"
          >
            <Filter size={14} />
            {statusFilter === "all"
              ? "All Status"
              : statusConfig[statusFilter as NotificationStatus]?.label ||
                statusFilter}
            <ChevronDown
              size={13}
              className={`transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          <FilterDropdown
            isOpen={statusDropdownOpen}
            onClose={() => setStatusDropdownOpen(false)}
          >
            <ul className="py-1 max-h-56 overflow-y-auto">
              <li
                onClick={() => {
                  setStatusFilter("all");
                  setStatusDropdownOpen(false);
                }}
                className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                  statusFilter === "all" ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]" : ""
                }`}
              >
                <span className="font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                  All Status
                </span>
                {statusFilter === "all" && (
                  <CheckCircle2 size={12} className="text-[#C9A86C]" />
                )}
              </li>
              {Object.entries(statusConfig).map(([key, config]) => (
                <li
                  key={key}
                  onClick={() => {
                    setStatusFilter(key as NotificationStatus);
                    setStatusDropdownOpen(false);
                  }}
                  className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                    statusFilter === key ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                    <IconWithColor
                      icon={config.icon}
                      size={12}
                      color={config.color}
                    />
                    {config.label}
                  </span>
                  {statusFilter === key && (
                    <CheckCircle2 size={12} className="text-[#C9A86C]" />
                  )}
                </li>
              ))}
            </ul>
          </FilterDropdown>
        </div>

        {/* Channel Filter */}
        <div className="relative">
          <button
            onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C9A86C]/40 transition-colors shadow-sm"
          >
            <MessageCircle size={14} />
            {channelFilter === "all"
              ? "All Channels"
              : CHANNEL_META[channelFilter as ChannelId]?.label ||
                channelFilter}
            <ChevronDown
              size={13}
              className={`transition-transform ${channelDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          <FilterDropdown
            isOpen={channelDropdownOpen}
            onClose={() => setChannelDropdownOpen(false)}
          >
            <ul className="py-1">
              <li
                onClick={() => {
                  setChannelFilter("all");
                  setChannelDropdownOpen(false);
                }}
                className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                  channelFilter === "all"
                    ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]"
                    : ""
                }`}
              >
                <span className="font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                  All Channels
                </span>
                {channelFilter === "all" && (
                  <CheckCircle2 size={12} className="text-[#C9A86C]" />
                )}
              </li>
              {Object.entries(CHANNEL_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <li
                    key={key}
                    onClick={() => {
                      setChannelFilter(key as ChannelId);
                      setChannelDropdownOpen(false);
                    }}
                    className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                      channelFilter === key
                        ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]"
                        : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                      <IconWithColor icon={Icon} size={12} color={meta.color} />
                      {meta.label}
                    </span>
                    {channelFilter === key && (
                      <CheckCircle2 size={12} className="text-[#C9A86C]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </FilterDropdown>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <button
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a1f2e] border border-[#E8E3D8] dark:border-[#2a2f3e] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C9A86C]/40 transition-colors shadow-sm"
          >
            <Package size={14} />
            {categoryFilter === "all"
              ? "All Categories"
              : CATEGORY_META[categoryFilter]?.label || categoryFilter}
            <ChevronDown
              size={13}
              className={`transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>
          <FilterDropdown
            isOpen={categoryDropdownOpen}
            onClose={() => setCategoryDropdownOpen(false)}
          >
            <ul className="py-1 max-h-56 overflow-y-auto">
              <li
                onClick={() => {
                  setCategoryFilter("all");
                  setCategoryDropdownOpen(false);
                }}
                className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                  categoryFilter === "all"
                    ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]"
                    : ""
                }`}
              >
                <span className="font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                  All Categories
                </span>
                {categoryFilter === "all" && (
                  <CheckCircle2 size={12} className="text-[#C9A86C]" />
                )}
              </li>
              {(categories || []).map((cat) => {
                const meta = CATEGORY_META[cat] || {
                  label: cat,
                  icon: Package,
                  color: "#888",
                  bg: "rgba(136, 136, 136, 0.12)",
                  border: "rgba(136, 136, 136, 0.2)",
                };
                const Icon = meta.icon;
                return (
                  <li
                    key={cat}
                    onClick={() => {
                      setCategoryFilter(cat);
                      setCategoryDropdownOpen(false);
                    }}
                    className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-[#F8F5EF] dark:hover:bg-[#2a2f3e] flex items-center justify-between ${
                      categoryFilter === cat
                        ? "bg-[#F8F5EF] dark:bg-[#2a2f3e]"
                        : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-[#1A1A2E] dark:text-[#E8E8F0]">
                      <IconWithColor icon={Icon} size={12} color={meta.color} />
                      {meta.label}
                    </span>
                    {categoryFilter === cat && (
                      <CheckCircle2 size={12} className="text-[#C9A86C]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </FilterDropdown>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-[#E8E3D8] dark:border-[#2a2f3e] shadow-sm overflow-hidden transition-colors duration-300">
        <div className="divide-y divide-[#F1ECE0] dark:divide-[#2a2f3e]/60">
          {loading && logs.length === 0 ? (
            <div className="text-center py-20">
              <Loader2
                size={32}
                className="mx-auto mb-3 text-[#C9A86C] animate-spin"
              />
              <p className="text-sm text-[#94A3B8] dark:text-[#64748B]">
                Loading logs...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertCircle size={32} className="mx-auto mb-3 text-rose-500" />
              <p className="text-sm text-rose-500">{error}</p>
              <button
                onClick={refetch}
                className="mt-4 px-4 py-2 rounded-xl bg-[#C9A86C] text-white text-sm font-semibold hover:bg-[#B89A5E] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-sm text-[#94A3B8] dark:text-[#64748B]">
              <Inbox
                size={32}
                className="mx-auto mb-3 text-[#E8E3D8] dark:text-[#2a2f3e]"
              />
              No logs match your filters.
            </div>
          ) : (
            logs.map((log) => (
              <LogRow
                key={log._id}
                log={log}
                isExpanded={expandedId === log._id}
                onToggle={() => toggleExpand(log._id)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && pagination && pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={goToPage}
            total={pagination.total}
            limit={pagination.limit}
          />
        )}
      </div>
    </div>
  );
};

// Missing Inbox icon
const Inbox = ({ size, className }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export default NotificationLogs;
