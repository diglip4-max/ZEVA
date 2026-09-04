import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronDown,
  CheckCircle2,
  Upload,
  FileText,
  Eye,
  X,
  AlertTriangle,
  ExternalLink,
  Phone,
  Reply,
  Mail,
  MessageSquare,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "react-toastify";
import { Toggle, CH_META } from "./NotificationSettingsTab"; // adjust path to your existing Toggle
import type { ChannelId, Recipient } from "./NotificationSettingsTab"; // adjust to your actual types file
import {
  handleUpload,
  getMediaTypeFromFile,
  capitalize,
  formatFileSize,
} from "@/lib/helper";
import VariableMappingDropdown from "@/pages/clinic/automation/_components/VariableMappingDropdown";
import { Attachment } from "@/types/campaigns";

// ── Types ────────────────────────────────────────────────────────────
export interface NotificationChannel {
  channel: ChannelId;
  recipient: Recipient;
  isEnabled: boolean;
  priority: number;
  templateId: string | null;
  providerId: string | null;
  // Filled in once a template with a media header / variables is picked
  mediaUrl?: string | null;
  mediaType?: string | null;
  attachments?: Attachment[];
  variableMappings?: Record<string, string>;
  headerVariableMappings?: Record<string, string>;
  buttonVariableMappings?: Record<string, string>;
}

interface ProviderLite {
  _id: string;
  label: string;
  type?: string[]; // e.g. ["whatsapp"], ["sms"], ["email"]
  phone?: string;
  email?: string;
}

interface TemplateButtonLite {
  type?: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "CALL_TO_ACTION" | string;
  text?: string;
  label?: string;
  url?: string;
  phone_number?: string;
  reply?: { id?: string; title?: string };
}

interface TemplateLite {
  _id: string;
  name: string;
  content: string;
  templateType: string;
  status: string;
  provider?: { _id: string };
  category?: string;
  language?: string;
  headerType?: string; // "" | "text" | "image" | "video" | "document"
  headerText?: string;
  headerFileUrl?: string;
  headerVariables?: string[];
  variables?: string[];
  footer?: string;
  isHeader?: boolean;
  isFooter?: boolean;
  isButton?: boolean;
  templateButtons?: TemplateButtonLite[];
  buttons?: TemplateButtonLite[];
  subject?: string;
  preheader?: string;
}

interface NotificationChannelCardProps {
  ch: NotificationChannel;
  index: number;
  total: number;
  providers: ProviderLite[];
  templates: TemplateLite[];
  sample: Record<string, any>;
  fallbackTemplate: string; // draft.template — used when no per-channel template picked
  onChange: (patch: Partial<NotificationChannel>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const RECIPIENT_OPTIONS: { value: Recipient; label: string }[] = [
  { value: "patient" as Recipient, label: "Patient" },
  { value: "staff" as Recipient, label: "Staff" },
];

export default function NotificationChannelCard({
  ch,
  index,
  total,
  providers,
  templates,
  sample,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: NotificationChannelCardProps) {
  const meta = CH_META[ch.channel];
  const Icon = meta.icon;

  const [isRecipientOpen, setIsRecipientOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const recipientRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        recipientRef.current &&
        !recipientRef.current.contains(e.target as Node)
      ) {
        setIsRecipientOpen(false);
      }
      if (
        providerRef.current &&
        !providerRef.current.contains(e.target as Node)
      ) {
        setIsProviderOpen(false);
      }
      if (
        templateRef.current &&
        !templateRef.current.contains(e.target as Node)
      ) {
        setIsTemplateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Providers scoped to this channel's type
  const channelProviders = useMemo(
    () => providers.filter((p) => !p.type || p.type.includes(ch.channel)),
    [providers, ch.channel],
  );

  const filteredProviders = useMemo(
    () =>
      channelProviders.filter(
        (p) =>
          providerSearch === "" ||
          p.label.toLowerCase().includes(providerSearch.toLowerCase()) ||
          (p.phone &&
            p.phone.toLowerCase().includes(providerSearch.toLowerCase())) ||
          (p.email &&
            p.email.toLowerCase().includes(providerSearch.toLowerCase())),
      ),
    [channelProviders, providerSearch],
  );

  const selectedProvider = channelProviders.find(
    (p) => p._id === ch.providerId,
  );

  // Templates scoped to this channel's type + approved status,
  // and (for whatsapp) further scoped to the chosen provider if one is set
  const templatesForProvider = (providerId: string | null) =>
    templates.filter((t) => {
      const typeMatch = t.templateType === ch.channel;
      const statusMatch = t.status === "approved";
      const providerMatch =
        ch.channel !== "whatsapp" ||
        !providerId ||
        !t.provider ||
        t.provider._id === providerId;
      return typeMatch && statusMatch && providerMatch;
    });

  const channelTemplates = useMemo(
    () => templatesForProvider(ch.providerId),
    [templates, ch.channel, ch.providerId],
  );

  const filteredTemplates = useMemo(
    () =>
      channelTemplates.filter(
        (t) =>
          templateSearch === "" ||
          t.name.toLowerCase().includes(templateSearch.toLowerCase()),
      ),
    [channelTemplates, templateSearch],
  );

  const selectedTemplate = channelTemplates.find(
    (t) => t._id === ch.templateId,
  );

  const hasProvider = !!ch.providerId;

  // Fill {{var}} placeholders: per-channel mapping first, then the sample
  // lead data, otherwise leave the placeholder in place.
  const fillVariables = (
    text: string | undefined,
    mappings?: Record<string, string>,
  ): string => {
    if (!text) return "";
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return mappings?.[trimmedKey] || sample?.[trimmedKey] || match;
    });
  };

  const previewBodyText = selectedTemplate
    ? fillVariables(selectedTemplate.content, ch.variableMappings)
    : "Select a template to preview";

  const previewHeaderText = selectedTemplate
    ? fillVariables(selectedTemplate.headerText, ch.headerVariableMappings)
    : "";

  const previewMediaUrl = ch.mediaUrl || selectedTemplate?.headerFileUrl || "";
  const previewMediaType =
    ch.mediaType ||
    (selectedTemplate?.headerType !== "text"
      ? selectedTemplate?.headerType
      : "");

  const previewButtons: TemplateButtonLite[] = selectedTemplate?.templateButtons
    ?.length
    ? selectedTemplate.templateButtons
    : selectedTemplate?.buttons?.length
      ? selectedTemplate.buttons
      : [];

  // ── Validation: what's missing before this channel can be enabled ──
  // Computed on every render (not just on toggle) so we can show a
  // persistent red alert banner whenever something is incomplete.
  const missingRequirements = useMemo((): string[] => {
    const missing: string[] = [];
    if (!ch.providerId) missing.push("Select a provider");
    if (ch.providerId && !ch.templateId) missing.push("Select a template");

    if (ch.providerId && ch.templateId && selectedTemplate) {
      selectedTemplate.headerVariables?.forEach((key, i) => {
        if (!ch.headerVariableMappings?.[key]) {
          missing.push(`Fill header variable {{${i + 1}}}`);
        }
      });
      selectedTemplate.variables?.forEach((key, i) => {
        if (!ch.variableMappings?.[key]) {
          missing.push(`Fill body variable {{${i + 1}}}`);
        }
      });
      if (
        selectedTemplate.isHeader &&
        selectedTemplate.headerType &&
        selectedTemplate.headerType !== "text" &&
        !ch.mediaUrl
      ) {
        missing.push(`Upload the ${selectedTemplate.headerType} attachment`);
      }
    }
    return missing;
  }, [
    ch.providerId,
    ch.templateId,
    ch.headerVariableMappings,
    ch.variableMappings,
    ch.mediaUrl,
    selectedTemplate,
  ]);

  const handleToggleEnable = () => {
    if (!ch.isEnabled && missingRequirements.length > 0) {
      toast.warning(
        `Before enabling ${meta.label}: ${missingRequirements
          .map((m) => m.charAt(0).toLowerCase() + m.slice(1))
          .join(", ")}.`,
      );
      return;
    }
    onChange({ isEnabled: !ch.isEnabled });
  };

  // ── Handlers ───────────────────────────────────────────────────────
  const handleProviderSelect = (id: string) => {
    const stillValid = templatesForProvider(id).some(
      (t) => t._id === ch.templateId,
    );
    onChange({
      providerId: id || null,
      ...(stillValid
        ? {}
        : {
            templateId: null,
            mediaUrl: null,
            mediaType: null,
            variableMappings: {},
            headerVariableMappings: {},
          }),
    });
    setIsProviderOpen(false);
    setProviderSearch("");
  };

  const handleTemplateSelect = (t: TemplateLite) => {
    onChange({
      templateId: t._id,
      mediaUrl: t.headerFileUrl || null,
      mediaType: t.headerType && t.headerType !== "text" ? t.headerType : null,
      variableMappings: {},
      headerVariableMappings: {},
    });
    setAttachedFile(null);
    setIsTemplateOpen(false);
    setTemplateSearch("");
  };

  const handleVarChange = (key: string, value: string) => {
    onChange({
      variableMappings: { ...(ch.variableMappings || {}), [key]: value },
    });
  };

  const handleHeaderVarChange = (key: string, value: string) => {
    onChange({
      headerVariableMappings: {
        ...(ch.headerVariableMappings || {}),
        [key]: value,
      },
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = file.type.startsWith("image/")
      ? 5 * 1024 * 1024
      : file.type.startsWith("video/")
        ? 16 * 1024 * 1024
        : 100 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.warning(
        `File size exceeds the limit of ${maxSize / (1024 * 1024)}MB`,
      );
      e.target.value = "";
      return;
    }

    setAttachedFile(file);
    setIsUploading(true);
    try {
      const res = await handleUpload(file);
      if (res?.success) {
        onChange({
          mediaUrl: res.url,
          mediaType: getMediaTypeFromFile(file),
          attachments: [
            {
              fileName: file.name,
              fileSize: formatFileSize(file.size),
              mimeType: file.type,
              mediaUrl: res.url,
              mediaType: getMediaTypeFromFile(file),
            },
          ],
        });
      } else {
        toast.error("Failed to upload file");
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const renderVariableInput = (
    key: string,
    varIndex: number,
    isHeader: boolean,
  ) => (
    <div key={key} className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wide text-text-lo">
        {isHeader ? "Header" : "Body"} var {"{{"}
        {varIndex + 1}
        {"}}"}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={
            isHeader
              ? ch.headerVariableMappings?.[key] || ""
              : ch.variableMappings?.[key] || ""
          }
          onChange={(e) =>
            isHeader
              ? handleHeaderVarChange(key, e.target.value)
              : handleVarChange(key, e.target.value)
          }
          placeholder={`Value for {{${varIndex + 1}}}`}
          className={fieldSelectClass}
        />
        <VariableMappingDropdown
          entity="Lead"
          onSelect={(value: string) =>
            isHeader
              ? handleHeaderVarChange(key, value)
              : handleVarChange(key, value)
          }
          nodeId={""}
          align="right"
        />
      </div>
    </div>
  );

  // ── Button icon helper (mirrors WhatsApp template button types) ────
  const buttonIcon = (type?: string) => {
    switch (type) {
      case "URL":
        return <ExternalLink size={11} />;
      case "PHONE_NUMBER":
        return <Phone size={11} />;
      case "CALL_TO_ACTION":
        return <ExternalLink size={11} />;
      case "QUICK_REPLY":
      default:
        return <Reply size={11} className="rotate-180" />;
    }
  };

  const buttonLabel = (btn: TemplateButtonLite) =>
    btn.text || btn.label || btn.reply?.title || "Button";

  // ── Channel-specific rich previews ──────────────────────────────────
  const renderWhatsappPreview = () => (
    <div className="relative mx-auto w-full max-w-[300px] h-[500px] rounded-[2rem] border-[8px] border-surface-4 bg-surface-4 shadow-2xl overflow-hidden">
      {/* Android-style status bar with punch-hole camera */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-black flex items-center justify-between px-4 z-20">
        <span className="text-[9px] text-white font-semibold">9:41</span>
        <div className="w-1.5 h-1.5 rounded-full bg-black ring-1 ring-white/20" />
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-[1px] border border-white/80" />
        </div>
      </div>

      <div className="absolute inset-0 pt-6 bg-[#e5ddd5] flex flex-col">
        {/* App header */}
        <div className="px-3.5 py-3 flex items-center gap-2.5 text-white bg-[#075e54] flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <FaWhatsapp size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">
              {selectedProvider?.label || "WhatsApp"}
            </p>
            <p className="text-[9px] opacity-75">online</p>
          </div>
        </div>

        {/* Chat area — first (and only) message anchored at the top */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          <div className="bg-white rounded-xl rounded-tl-none p-2.5 shadow-sm max-w-[92%]">
            {previewMediaUrl &&
              previewMediaType &&
              previewMediaType !== "text" && (
                <div className="mb-2 rounded-lg overflow-hidden bg-surface-3">
                  {previewMediaType === "image" ? (
                    <img
                      src={previewMediaUrl}
                      alt="Header"
                      className="w-full h-36 object-cover"
                    />
                  ) : previewMediaType === "video" ? (
                    <video
                      src={previewMediaUrl}
                      className="w-full h-36 object-cover bg-black"
                      controls
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <a
                      href={previewMediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 flex items-center gap-2 bg-surface-3 hover:bg-surface-4 transition-colors"
                    >
                      <FileText
                        size={14}
                        className="text-primary flex-shrink-0"
                      />
                      <span className="text-[10px] text-text-md truncate">
                        {capitalize(previewMediaType)} attachment
                      </span>
                    </a>
                  )}
                </div>
              )}

            {previewHeaderText && (
              <p className="text-[12px] font-bold text-gray-900 mb-1 leading-snug">
                {previewHeaderText}
              </p>
            )}

            <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">
              {previewBodyText || "Type your message..."}
            </p>

            {selectedTemplate?.isFooter && selectedTemplate?.footer && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                {selectedTemplate.footer}
              </p>
            )}

            <span className="block text-right text-[9px] text-gray-400 mt-1.5">
              10:30 AM
            </span>
          </div>

          {/* Template buttons */}
          {selectedTemplate?.isButton && previewButtons.length > 0 && (
            <div className="max-w-[92%] space-y-1.5">
              {previewButtons.map((btn, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl py-2 shadow-sm text-center text-[11px] font-semibold text-primary flex items-center justify-center gap-2"
                >
                  {buttonIcon(btn.type)}
                  {buttonLabel(btn)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-white px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 h-8 text-xs text-[#808080] flex items-center px-3 bg-[#f5f5f5] rounded-full">
            Type your message...
          </div>
          <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
            <Reply size={13} className="text-white rotate-180" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSmsPreview = () => (
    <div className="mx-auto w-full max-w-[300px] h-[420px] rounded-2xl border border-border bg-surface-1 overflow-hidden shadow-xl flex flex-col">
      {/* Messages app header */}
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} />
          <span className="text-xs font-bold">Messages</span>
        </div>
        <span className="text-[10px] opacity-80 truncate max-w-[120px]">
          {selectedProvider?.label || "Recipient"}
        </span>
      </div>

      {/* Thread area */}
      <div className="flex-1 bg-surface-2 p-3.5 flex flex-col justify-end overflow-y-auto">
        <div className="max-w-[85%] ml-auto">
          <div className="bg-primary rounded-2xl rounded-br-sm px-3.5 py-2.5 shadow-sm">
            <p className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">
              {previewBodyText || "Your SMS message will appear here..."}
            </p>
          </div>
          <p className="text-[9px] text-text-lo text-right mt-1.5 mr-1">
            Delivered • 12:00 PM
          </p>
        </div>
      </div>
    </div>
  );

  const renderEmailPreview = () => {
    const bodyHtml = selectedTemplate
      ? selectedTemplate.content.replace(/\{\{(.*?)\}\}/g, (match, key) => {
          const trimmedKey = key.trim();
          const val = ch.variableMappings?.[trimmedKey] || sample?.[trimmedKey];
          return (
            val ||
            `<span class="bg-yellow-100 text-yellow-800 px-1 rounded">${match}</span>`
          );
        })
      : "";

    return (
      <div className="w-full border border-border rounded-xl">
        {/* Inbox notification row — no outer box, blends with the card */}
        <div className="flex items-start gap-3 p-3 border-b border-border">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow">
            {selectedProvider?.label?.[0]?.toUpperCase() || "M"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center mb-0.5 gap-2">
              <span className="text-xs font-bold text-text-hi truncate">
                {selectedProvider?.label || "Sender Name"}
              </span>
              <span className="text-[9px] text-text-lo flex-shrink-0">
                10:30 AM
              </span>
            </div>
            <p className="text-xs font-bold text-text-hi truncate">
              {fillVariables(selectedTemplate?.subject, ch.variableMappings) ||
                "Email subject"}
            </p>
            {selectedTemplate?.preheader && (
              <p className="text-[10px] text-text-lo truncate">
                {fillVariables(selectedTemplate.preheader, ch.variableMappings)}
              </p>
            )}
          </div>
        </div>

        {/* Email body — open, no surrounding box */}
        <div className="max-h-[420px] overflow-y-auto pt-4">
          {selectedTemplate ? (
            <div
              className="prose-sm text-[13px] text-text-md leading-relaxed [&_*]:text-[13px]"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div className="text-center py-16">
              <Mail size={32} className="text-text-lo mx-auto mb-3" />
              <p className="text-xs text-text-lo font-medium">
                Select a template to preview content
              </p>
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="pt-4 border-t border-border text-center">
            <p className="text-[9px] text-text-lo mb-2 leading-relaxed">
              Sent by {selectedProvider?.label || "Your Clinic"}
              <br />
              {selectedProvider?.email || "contact@zeva.app"}
            </p>
            <div className="flex justify-center gap-4">
              <span className="text-[9px] text-primary">Unsubscribe</span>
              <span className="text-[9px] text-primary">Privacy Policy</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGenericPreview = () => (
    <div className="rounded-lg p-2.5 bg-surface-1 border border-border">
      <div className="text-xs text-text-md leading-relaxed whitespace-pre-wrap line-clamp-4">
        {previewBodyText || "Select a template to preview"}
      </div>
    </div>
  );

  const renderChannelPreview = () => {
    if (!selectedTemplate) {
      return (
        <div className="rounded-lg p-4 bg-surface-1 border border-border text-center">
          <p className="text-[11px] text-text-lo">
            Select a template to preview
          </p>
        </div>
      );
    }
    if (ch.channel === "whatsapp") return renderWhatsappPreview();
    if (ch.channel === "sms") return renderSmsPreview();
    if (ch.channel === "email") return renderEmailPreview();
    return renderGenericPreview();
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2 flex flex-col shadow-xs">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3.5 border-b border-border bg-surface-3 rounded-t-xl">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-4 text-text-md">
          <Icon size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text-hi truncate">
            {meta.label}
          </div>
        </div>
        <Toggle on={ch.isEnabled} onClick={handleToggleEnable} size="sm" />
      </div>

      {/* Incomplete-setup alert — always visible until everything is mapped */}
      {missingRequirements.length > 0 && (
        <div className="mx-3.5 mt-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle
            size={14}
            className="text-danger flex-shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-danger">
              Complete setup to enable this channel
            </p>
            <ul className="mt-1 space-y-0.5">
              {missingRequirements.map((item) => (
                <li
                  key={item}
                  className="text-[11px] text-danger/90 leading-relaxed"
                >
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="p-3.5 space-y-3">
        {/* Recipient — same styled dropdown as Provider / Template */}
        <Field label="Send to" required>
          <div className="relative" ref={recipientRef}>
            <div
              onClick={() => setIsRecipientOpen(!isRecipientOpen)}
              className={fieldSelectClass}
            >
              <span className="truncate">
                {RECIPIENT_OPTIONS.find((o) => o.value === ch.recipient)
                  ?.label ?? "Choose recipient"}
              </span>
              <ChevronDown
                size={13}
                className={`flex-shrink-0 transition-transform ${isRecipientOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isRecipientOpen && (
              <div className="absolute z-20 w-full mt-1.5 bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden">
                <ul className="py-1">
                  {RECIPIENT_OPTIONS.map((opt) => (
                    <li
                      key={opt.value}
                      onClick={() => {
                        onChange({ recipient: opt.value });
                        setIsRecipientOpen(false);
                      }}
                      className={`px-3 py-2 text-xs cursor-pointer hover:bg-surface-3 flex items-center justify-between gap-2 ${
                        ch.recipient === opt.value ? "bg-surface-4" : ""
                      }`}
                    >
                      <span className="font-semibold text-text-hi">
                        {opt.label}
                      </span>
                      {ch.recipient === opt.value && (
                        <CheckCircle2
                          size={13}
                          className="text-primary flex-shrink-0"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Field>

        {/* Provider — searchable dropdown */}
        <Field label="Provider" required>
          <div className="relative" ref={providerRef}>
            <div
              onClick={() => setIsProviderOpen(!isProviderOpen)}
              className={fieldSelectClass}
            >
              <span className="truncate">
                {selectedProvider ? selectedProvider.label : "Choose provider"}
              </span>
              <ChevronDown
                size={13}
                className={`flex-shrink-0 transition-transform ${isProviderOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isProviderOpen && (
              <div className="absolute z-20 w-full mt-1.5 bg-surface-2 border border-border rounded-xl shadow-2xl max-h-64 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border bg-surface-3">
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-lo"
                    />
                    <input
                      type="text"
                      autoFocus
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Search providers..."
                      className="w-full pl-7 pr-2 py-1.5 bg-surface-1 border border-border rounded-lg text-xs text-text-hi focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredProviders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text-lo italic">
                      No providers found
                    </div>
                  ) : (
                    <ul className="py-1">
                      {filteredProviders.map((p) => (
                        <li
                          key={p._id}
                          onClick={() => handleProviderSelect(p._id)}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-surface-3 flex items-center justify-between gap-2 ${
                            ch.providerId === p._id ? "bg-surface-4" : ""
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-text-hi truncate">
                              {p.label}
                            </span>
                            {(p.phone || p.email) && (
                              <span className="text-[10px] text-text-lo truncate">
                                {p.phone || p.email}
                              </span>
                            )}
                          </div>
                          {ch.providerId === p._id && (
                            <CheckCircle2
                              size={13}
                              className="text-primary flex-shrink-0"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </Field>

        {/* Template — searchable dropdown, locked until a provider is picked */}
        <Field
          label="Template"
          required
          hint={!hasProvider ? "Select a provider first" : undefined}
        >
          <div className="relative" ref={templateRef}>
            <div
              onClick={() => {
                if (!hasProvider) return;
                setIsTemplateOpen(!isTemplateOpen);
              }}
              className={`${fieldSelectClass} ${
                !hasProvider ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span className="truncate">
                {selectedTemplate
                  ? selectedTemplate.name
                  : hasProvider
                    ? "Choose template"
                    : "Select a provider first"}
              </span>
              <ChevronDown
                size={13}
                className={`flex-shrink-0 transition-transform ${isTemplateOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isTemplateOpen && hasProvider && (
              <div className="absolute z-20 w-full mt-1.5 bg-surface-2 border border-border rounded-xl shadow-2xl max-h-64 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border bg-surface-3">
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-lo"
                    />
                    <input
                      type="text"
                      autoFocus
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Search templates..."
                      className="w-full pl-7 pr-2 py-1.5 bg-surface-1 border border-border rounded-lg text-xs text-text-hi focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredTemplates.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text-lo italic">
                      No templates found
                    </div>
                  ) : (
                    <ul className="py-1">
                      {filteredTemplates.map((t) => (
                        <li
                          key={t._id}
                          onClick={() => handleTemplateSelect(t)}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-surface-3 flex items-center justify-between gap-2 ${
                            ch.templateId === t._id ? "bg-surface-4" : ""
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-text-hi truncate">
                              {t.name}
                            </span>
                            {(t.category || t.language) && (
                              <span className="text-[10px] text-text-lo truncate">
                                {(t.category || "").toUpperCase()}
                                {t.category && t.language ? " • " : ""}
                                {t.language || ""}
                              </span>
                            )}
                          </div>
                          {ch.templateId === t._id && (
                            <CheckCircle2
                              size={13}
                              className="text-primary flex-shrink-0"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </Field>

        {/* Template details: media header + variables, mirrors CampaignEditPage */}
        {selectedTemplate && (
          <div className="space-y-3 pt-1">
            {/* Text header preview */}
            {selectedTemplate.headerType === "text" &&
              selectedTemplate.headerText && (
                <div className="rounded-lg p-2.5 bg-surface-1 border border-border">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-text-lo">
                    Header
                  </div>
                  <p className="text-xs text-text-md">
                    {selectedTemplate.headerText}
                  </p>
                </div>
              )}

            {/* Existing media header attachment */}
            {selectedTemplate.headerType &&
              selectedTemplate.headerType !== "text" &&
              (ch.mediaUrl || selectedTemplate.headerFileUrl) &&
              !attachedFile && (
                <div className="rounded-lg p-2.5 bg-surface-1 border border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText
                      size={13}
                      className="text-text-lo flex-shrink-0"
                    />
                    <span className="text-xs text-text-md truncate">
                      {capitalize(selectedTemplate.headerType)} attachment
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        ch.mediaUrl || selectedTemplate.headerFileUrl,
                        "_blank",
                      )
                    }
                    className="w-6 h-6 rounded-md flex items-center justify-center bg-surface-4 border border-border text-text-md flex-shrink-0"
                  >
                    <Eye size={11} />
                  </button>
                </div>
              )}

            {/* Upload replacement media for the header */}
            {selectedTemplate.isHeader &&
              selectedTemplate.headerType &&
              selectedTemplate.headerType !== "text" && (
                <div className="rounded-lg border border-dashed border-border p-3 text-center">
                  {attachedFile ? (
                    <div className="flex items-center justify-between gap-2 bg-surface-1 rounded-lg p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText
                          size={13}
                          className="text-text-lo flex-shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-medium text-text-hi truncate">
                            {attachedFile.name}
                          </p>
                          <p className="text-[10px] text-text-lo">
                            {(attachedFile.size / 1024 / 1024).toFixed(2)} MB
                            {isUploading ? " • uploading..." : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFile(null);
                          onChange({ mediaUrl: null, mediaType: null });
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-danger flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-1.5 py-1">
                      <Upload size={16} className="text-text-lo" />
                      <span className="text-[11px] font-semibold text-text-md">
                        Upload {capitalize(selectedTemplate.headerType)}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept={
                          selectedTemplate.headerType === "image"
                            ? "image/jpeg,image/jpg,image/png"
                            : selectedTemplate.headerType === "video"
                              ? "video/mp4,video/3gp"
                              : ".pdf,.doc,.docx,.pptx,.xlsx"
                        }
                      />
                    </label>
                  )}
                </div>
              )}

            {/* Header variables */}
            {selectedTemplate.headerVariables &&
              selectedTemplate.headerVariables.length > 0 && (
                <div className="space-y-2.5">
                  {selectedTemplate.headerVariables.map((key, i) =>
                    renderVariableInput(key, i, true),
                  )}
                </div>
              )}

            {/* Body variables */}
            {selectedTemplate.variables &&
              selectedTemplate.variables.length > 0 && (
                <div className="space-y-2.5">
                  {selectedTemplate.variables.map((key, i) =>
                    renderVariableInput(key, i, false),
                  )}
                </div>
              )}
          </div>
        )}

        {/* Preview — channel-accurate rendering (WhatsApp bubble w/ buttons,
            SMS thread, or Email inbox card) instead of a plain text block */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 text-text-lo">
            <MessageCircle size={11} /> Preview
          </div>
          {renderChannelPreview()}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-border bg-surface-3 rounded-b-xl">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-4 border border-border text-text-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-2 transition-colors"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-4 border border-border text-text-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-2 transition-colors"
          >
            <ArrowDown size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-4 border border-border text-danger hover:bg-danger-bg transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-text-lo">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-text-lo">{hint}</p>}
    </div>
  );
}

// Shared style for every select-like field (native or custom dropdown trigger)
// so Send to / Provider / Template all look identical.
const fieldSelectClass =
  "w-full text-xs font-semibold rounded-lg px-2.5 py-2 bg-surface-3 border border-border text-text-hi flex items-center justify-between gap-2 cursor-pointer hover:border-primary/40 transition-colors min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/40";
