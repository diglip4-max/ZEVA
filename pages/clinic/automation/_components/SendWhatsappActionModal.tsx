import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Save,
  Loader2,
  Search,
  ChevronDown,
  MessageSquare,
  Smartphone,
  Info,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { clsx, type ClassValue } from "clsx";
import useProvider from "@/hooks/useProvider";
import { Template } from "@/types/templates";

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface SendWhatsappActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | null;
  onUpdate: (updatedAction: any) => void;
}

const SendWhatsappActionModal: React.FC<SendWhatsappActionModalProps> = ({
  isOpen,
  onClose,
  actionId,
  onUpdate,
}) => {
  const { whatsappProviders } = useProvider();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variableMappings, setVariableMappings] = useState<
    Record<string, string>
  >({});
  const [headerVariableMappings, setHeaderVariableMappings] = useState<
    Record<string, string>
  >({});
  const [buttonVariableMappings, setButtonVariableMappings] = useState<
    Record<string, string>
  >({});
  const [mediaUrl, setMediaUrl] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [providerSearchTerm, setProviderSearchTerm] = useState("");
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);
  const selectedProvider = whatsappProviders.find(
    (p) => p._id === selectedProviderId,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProviderDropdownOpen(false);
      }
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = getTokenByPath();
      const { data } = await axios.get("/api/all-templates?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        // Filter only WhatsApp templates
        const whatsappTemplates = (data.templates || []).filter(
          (t: any) => t.templateType === "whatsapp",
        );
        setTemplates(whatsappTemplates);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates.");
    }
  }, []);

  const fetchAction = useCallback(async () => {
    if (!actionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/workflows/actions/update/${actionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        const params = data.data.parameters || {};
        setSelectedTemplateId(params.templateId || "");
        setSelectedProviderId(params.providerId || "");
        setVariableMappings(params.variableMappings || {});
        setHeaderVariableMappings(params.headerVariableMappings || {});
        setButtonVariableMappings(params.buttonVariableMappings || {});
        setMediaUrl(params.mediaUrl || "");
      }
    } catch (err) {
      console.error("Error fetching action:", err);
      setError("Failed to load action details.");
    } finally {
      setIsLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (actionId) {
        fetchAction();
      }
    }
  }, [isOpen, actionId, fetchTemplates, fetchAction]);

  const handleSave = async () => {
    if (!actionId || !selectedTemplateId) return;

    setIsSaving(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.put(
        `/api/workflows/actions/update/${actionId}`,
        {
          parameters: {
            providerId: selectedProviderId,
            templateId: selectedTemplateId,
            channel: "whatsapp",
            whatsappMsgType: "template-message",
            templateName: selectedTemplate?.uniqueName,
            variableMappings,
            headerVariableMappings,
            buttonVariableMappings,
            mediaUrl,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        onUpdate(data.data);
        onClose();
      }
    } catch (err) {
      console.error("Error saving action:", err);
      setError("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTemplates = templates?.filter((item: Template) => {
    const typeMatch = selectedProvider?.type?.includes(item.templateType);
    const statusMatch = item?.status === "approved";
    const providerMatch =
      item?.templateType !== "whatsapp" ||
      item?.provider?._id === selectedProvider?._id;

    // Search term condition (name or uniqueName contains search term)
    const searchMatch =
      templateSearchTerm === "" || // if search is empty, include all
      item.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
      item.uniqueName.toLowerCase().includes(templateSearchTerm.toLowerCase());

    return typeMatch && statusMatch && providerMatch && searchMatch;
  });
  const filteredProviders = whatsappProviders.filter(
    (p) =>
      p.name.toLowerCase().includes(providerSearchTerm.toLowerCase()) ||
      p.label.toLowerCase().includes(providerSearchTerm.toLowerCase()) ||
      p.phone.toLowerCase().includes(providerSearchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end text-gray-500">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <FaWhatsapp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Send WhatsApp</h3>
              <p className="text-xs text-gray-500 font-medium">
                Send an automated WhatsApp message
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Loading details...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="space-y-3 relative" ref={providerDropdownRef}>
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" /> Select Sender
                </label>
                <div
                  onClick={() =>
                    setIsProviderDropdownOpen(!isProviderDropdownOpen)
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center justify-between cursor-pointer hover:border-green-400 transition-all"
                >
                  <span className="truncate">
                    {selectedProvider
                      ? selectedProvider.label
                      : "Choose a sender"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isProviderDropdownOpen && "rotate-180",
                    )}
                  />
                </div>

                {isProviderDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search senders..."
                          value={providerSearchTerm}
                          onChange={(e) =>
                            setProviderSearchTerm(e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredProviders.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic font-medium">
                          No senders found
                        </div>
                      ) : (
                        <ul className="py-2">
                          {filteredProviders.map((p) => (
                            <li
                              key={p._id}
                              className={cn(
                                "px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors group",
                                selectedProviderId === p._id && "bg-green-50",
                              )}
                              onClick={() => {
                                setSelectedProviderId(p._id);
                                setIsProviderDropdownOpen(false);
                                setProviderSearchTerm("");
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                                    {p.label}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    {p.phone}
                                  </span>
                                </div>
                                {selectedProviderId === p._id && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Template Selection */}
              <div className="space-y-3 relative" ref={templateDropdownRef}>
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" /> Select
                  Template
                </label>
                <div
                  onClick={() =>
                    setIsTemplateDropdownOpen(!isTemplateDropdownOpen)
                  }
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center justify-between cursor-pointer hover:border-green-400 transition-all"
                >
                  <span className="truncate">
                    {selectedTemplate
                      ? selectedTemplate.name
                      : "Choose a WhatsApp template"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isTemplateDropdownOpen && "rotate-180",
                    )}
                  />
                </div>

                {isTemplateDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={templateSearchTerm}
                          onChange={(e) =>
                            setTemplateSearchTerm(e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredTemplates.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic font-medium">
                          No templates found
                        </div>
                      ) : (
                        <ul className="py-2">
                          {filteredTemplates.map((t) => (
                            <li
                              key={t._id}
                              className={cn(
                                "px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors group",
                                selectedTemplateId === t._id && "bg-green-50",
                              )}
                              onClick={() => {
                                setSelectedTemplateId(t._id);
                                setIsTemplateDropdownOpen(false);
                                setTemplateSearchTerm("");
                                // Reset mappings when template changes
                                setVariableMappings({});
                                setHeaderVariableMappings({});
                                setButtonVariableMappings({});
                                setMediaUrl("");
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                                    {t.name}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    {t.category.toUpperCase()} • {t.language}
                                  </span>
                                </div>
                                {selectedTemplateId === t._id && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  {/* Template Preview Card */}
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Template Preview
                      </span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white rotate-45 border-l border-b border-gray-100 shadow-sm" />

                      {/* Media Header Preview */}
                      {selectedTemplate.isHeader &&
                        ["image", "video", "document"].includes(
                          selectedTemplate.headerType || "",
                        ) && (
                          <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-gray-500 uppercase">
                                {selectedTemplate.headerType} Header
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {mediaUrl || "No URL provided"}
                              </p>
                            </div>
                          </div>
                        )}

                      {selectedTemplate.headerType === "text" &&
                        selectedTemplate.headerText && (
                          <div className="font-bold text-gray-900 mb-2 text-sm border-b border-gray-50 pb-2">
                            {selectedTemplate.headerText}
                          </div>
                        )}

                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedTemplate.content}
                      </p>

                      {/* Footer Preview */}
                      {selectedTemplate.isFooter && selectedTemplate.footer && (
                        <p className="mt-2 text-xs text-gray-400 italic">
                          {selectedTemplate.footer}
                        </p>
                      )}

                      <div className="mt-2 text-[10px] text-gray-400 text-right">
                        12:00 PM
                      </div>
                    </div>

                    {/* Buttons Preview */}
                    {selectedTemplate.isButton &&
                      selectedTemplate.templateButtons &&
                      selectedTemplate.templateButtons.length > 0 && (
                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                          {selectedTemplate.templateButtons.map((btn, idx) => (
                            <div
                              key={idx}
                              className="bg-white/60 py-2 px-4 rounded-xl border border-gray-100 text-center text-sm font-bold text-blue-600 shadow-sm"
                            >
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Variable Mapping */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Variable Mapping
                      </h4>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">
                          Use {"{{variable}}"} syntax
                        </span>
                      </div>
                    </div>

                    {/* Header Variables */}
                    {selectedTemplate.isHeader && (
                      <div className="space-y-4">
                        {/* Media Header URL */}
                        {["image", "video", "document"].includes(
                          selectedTemplate.headerType || "",
                        ) && (
                          <div className="grid grid-cols-1 gap-2 p-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl">
                            <label className="text-xs font-bold text-yellow-700 flex items-center gap-2 uppercase tracking-wider">
                              {selectedTemplate.headerType} Header URL
                            </label>
                            <input
                              type="text"
                              value={mediaUrl}
                              onChange={(e) => setMediaUrl(e.target.value)}
                              placeholder="e.g. {{lead.image_url}} or static https://... url"
                              className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-yellow-500 outline-none transition-all shadow-sm"
                            />
                            <p className="text-[10px] text-yellow-600 font-medium">
                              Provide a URL for the{" "}
                              {selectedTemplate.headerType} header. You can use
                              workflow variables.
                            </p>
                          </div>
                        )}

                        {selectedTemplate.headerType === "text" &&
                          selectedTemplate.headerVariables &&
                          selectedTemplate.headerVariables.length > 0 && (
                            <div className="space-y-4">
                              <div className="text-xs font-bold text-gray-400 uppercase">
                                Header Text Variables
                              </div>
                              {selectedTemplate.headerVariables.map(
                                (variable, idx) => (
                                  <div
                                    key={`header-${idx}`}
                                    className="grid grid-cols-1 gap-2"
                                  >
                                    <label className="text-xs font-bold text-gray-600">
                                      Variable {variable}
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        headerVariableMappings[variable] || ""
                                      }
                                      onChange={(e) =>
                                        setHeaderVariableMappings((prev) => ({
                                          ...prev,
                                          [variable]: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. {{lead.name}} or static text"
                                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                    />
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Button Variable Mappings */}
                    {selectedTemplate.isButton &&
                      selectedTemplate.templateButtons &&
                      selectedTemplate.templateButtons.some(
                        (btn: any) =>
                          btn.type === "URL" && btn.url?.includes("{{1}}"),
                      ) && (
                        <div className="space-y-4 pt-2">
                          <div className="text-xs font-bold text-gray-400 uppercase">
                            Button URL Variables
                          </div>
                          {selectedTemplate.templateButtons
                            .filter(
                              (btn: any) =>
                                btn.type === "URL" &&
                                btn.url?.includes("{{1}}"),
                            )
                            .map((btn: any, idx: number) => (
                              <div
                                key={`btn-${idx}`}
                                className="grid grid-cols-1 gap-2"
                              >
                                <label className="text-xs font-bold text-gray-600">
                                  Variable for Button: "{btn.text}"
                                </label>
                                <input
                                  type="text"
                                  value={buttonVariableMappings[idx] || ""}
                                  onChange={(e) =>
                                    setButtonVariableMappings((prev) => ({
                                      ...prev,
                                      [idx]: e.target.value,
                                    }))
                                  }
                                  placeholder="e.g. {{lead.id}} or custom-path"
                                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-gray-400">
                                  This value will be appended to the button's
                                  base URL.
                                </p>
                              </div>
                            ))}
                        </div>
                      )}

                    {/* Body Variables */}
                    {selectedTemplate.variables &&
                    selectedTemplate.variables.length > 0 ? (
                      <div className="space-y-4 pt-2">
                        <div className="text-xs font-bold text-gray-400 uppercase">
                          Body Variables
                        </div>
                        {selectedTemplate.variables.map((variable, idx) => (
                          <div
                            key={`body-${idx}`}
                            className="grid grid-cols-1 gap-2"
                          >
                            <label className="text-xs font-bold text-gray-600">
                              Variable {variable}
                            </label>
                            <input
                              type="text"
                              value={variableMappings[variable] || ""}
                              onChange={(e) =>
                                setVariableMappings((prev) => ({
                                  ...prev,
                                  [variable]: e.target.value,
                                }))
                              }
                              placeholder="e.g. {{lead.first_name}} or static text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      !selectedTemplate.isHeader && (
                        <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <p className="text-sm text-gray-400 font-medium italic">
                            No variables detected in this template
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading || !selectedTemplateId}
              className="flex-1 px-4 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendWhatsappActionModal;
