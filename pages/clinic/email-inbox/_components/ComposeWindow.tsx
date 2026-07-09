import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Minus,
  Maximize2,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  X,
  Bold,
  Italic,
  Underline,
  Link2,
  Smile,
  Send,
  ChevronDown,
  Search,
  Paperclip,
  Clock,
  Calendar,
  Globe,
  Zap,
} from "lucide-react";
import { getTokenByPath } from "@/lib/helper";
import { Attachment, ComposeDraft } from "@/hooks/useEmailInbox";
import useTemplate from "@/hooks/useTemplate";
import EmojiPickerModal from "@/components/shared/EmojiPickerModal";
import { ConversationType, Provider } from "@/types/conversations";
import { Template } from "@/types/templates";
import TemplatePickerDropdown from "./TemplatePickerDropdown";

const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Write your message…",
  editorRef,
  onActiveFormatsChange,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
  onActiveFormatsChange?: (formats: Set<string>) => void;
}) => {
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "<p><br></p>";
    }
  }, [editorRef, value]);

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState("bold")) formats.add("bold");
    if (document.queryCommandState("italic")) formats.add("italic");
    if (document.queryCommandState("underline")) formats.add("underline");
    if (document.queryCommandState("insertUnorderedList")) formats.add("ul");
    if (document.queryCommandState("insertOrderedList")) formats.add("ol");

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let parent =
        selection.getRangeAt(0).commonAncestorContainer.parentElement;
      while (parent && parent !== editorRef.current) {
        const tag = parent.tagName.toLowerCase();
        if (["h1", "h2", "h3", "blockquote", "a"].includes(tag)) {
          formats.add(tag);
        }
        parent = parent.parentElement;
      }
    }

    if (onActiveFormatsChange) {
      onActiveFormatsChange(formats);
    }
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    updateActiveFormats();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveFormats();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  return (
    <div className="pi-rich-text-editor">
      <div
        ref={editorRef}
        className="pi-compose-textarea pi-compose-textarea-grow pi-rich-editable"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={handleInput}
        onMouseUp={handleInput}
        onMouseDown={handleInput}
        data-placeholder={placeholder}
      />
    </div>
  );
};

interface ComposeWindowProps {
  emailProviders: Provider[];
  selectedProvider: Provider | null;
  compose: ComposeDraft;
  setCompose: React.Dispatch<React.SetStateAction<ComposeDraft>>;
  attachedFiles: Attachment[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<Attachment[]>>;
  minimized: boolean;
  setMinimized: (b: boolean) => void;
  maximized: boolean;
  setMaximized: (b: boolean) => void;
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
  onSchedule: (schedule: {
    scheduledDate: string;
    scheduledTime: string;
    scheduledTimezone: string;
  }) => void;
}

export default function ComposeWindow({
  emailProviders,
  selectedProvider,
  compose,
  setCompose,
  attachedFiles,
  setAttachedFiles,
  minimized,
  setMinimized,
  maximized,
  setMaximized,
  sending,
  onClose,
  onSend,
  onSchedule,
}: ComposeWindowProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toSuggestions, setToSuggestions] = useState<ConversationType[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<Template | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // Preview + full screen are purely presentational, so they're kept local
  // to this component rather than lifted into useEmailInbox.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fromRef = useRef<HTMLDivElement | null>(null);
  const toRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = getTokenByPath();
  const { emailTemplates } = useTemplate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!fromRef.current?.contains(event.target as Node)) setFromOpen(false);
      if (!toRef.current?.contains(event.target as Node))
        setSuggestionsOpen(false);
    };

    if (fromOpen || suggestionsOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fromOpen, suggestionsOpen]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const query = compose.to.trim();
    if (query.length < 2) {
      setToSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      if (!token) return;
      try {
        const { data } = await axios.get("/api/conversations", {
          params: {
            search: query,
            page: 1,
            limit: 5,
            channel: "email",
            status: "all",
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data?.success && Array.isArray(data.conversations)) {
          setToSuggestions(
            data.conversations
              ?.filter((c: any) => c?.leadId && c?.leadId?.email)
              .slice(0, 3),
          );
          setSuggestionsOpen(data.conversations.length > 0);
        }
      } catch {
        setToSuggestions([]);
        setSuggestionsOpen(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [compose.to, token]);

  const handleProviderSelect = (provider: Provider) => {
    setCompose({
      ...compose,
      providerId: provider._id,
      from: provider.email || compose.from,
    });
    setFromOpen(false);
  };

  const handleToSuggestionSelect = (conversation: ConversationType) => {
    const lead = conversation.leadId as any;
    setCompose({
      ...compose,
      to: lead?.email || compose.to,
      conversationId: conversation._id,
      leadId: lead?._id,
    });
    setSuggestionsOpen(false);
  };

  const handleTemplateApplied = (
    template: Template,
    subject: string,
    body: string,
  ) => {
    setAppliedTemplate(template);
    setCompose((prev) => ({
      ...prev,
      subject: subject || prev.subject,
      body,
    }));
    setTemplatePickerOpen(false);
  };

  const handleTemplateRemove = () => {
    setAppliedTemplate(null);
    setCompose((prev) => ({
      ...prev,
      subject: "",
      body: "",
    }));
  };

  const execRichTextCommand = (command: string, arg?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, arg);
    setCompose((prev) => ({ ...prev, body: editor.innerHTML }));
  };

  const handleRemoveAttachment = (id: string) =>
    setAttachedFiles((p) => p.filter((f) => f.id !== id));

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    for (const file of arr) {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const temp: Attachment = {
        id: tempId,
        name: file.name,
        size: file.size,
        uploading: true,
        originalFile: file,
      };
      setAttachedFiles((p) => [...p, temp]);

      try {
        const form = new FormData();
        form.append("file", file);
        const headers: any = { "Content-Type": "multipart/form-data" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const { data } = await axios.post("/api/upload", form, {
          headers,
          onUploadProgress: (ev: any) => {
            const loaded = ev?.loaded ?? 0;
            const total = ev?.total ?? 0;
            const pct = total ? Math.round((loaded / total) * 100) : 0;
            setAttachedFiles((p) =>
              p.map((f) => (f.id === tempId ? { ...f, progress: pct } : f)),
            );
          },
        });
        const uploaded: any =
          data?.file || data?.uploaded || data?.data || data;
        const url =
          uploaded?.url || uploaded?.fileUrl || uploaded?.path || undefined;
        const serverId = uploaded?.id || uploaded?._id || undefined;
        setAttachedFiles((p) =>
          p.map((f) =>
            f.id === tempId
              ? { ...f, uploading: false, url, id: serverId || f.id }
              : f,
          ),
        );
      } catch (e) {
        setAttachedFiles((p) =>
          p.map((f) => (f.id === tempId ? { ...f, uploading: false } : f)),
        );
      }
    }
  };

  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    const toRevoke: string[] = [];
    attachedFiles.forEach((f) => {
      if (f.originalFile && f.originalFile.type.startsWith("image/")) {
        if (!previews[f.id]) {
          const url = URL.createObjectURL(f.originalFile);
          newPreviews[f.id] = url;
          toRevoke.push(url);
        }
      }
    });
    if (Object.keys(newPreviews).length > 0)
      setPreviews((p) => ({ ...p, ...newPreviews }));
    return () => {
      Object.values(newPreviews).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedFiles]);

  const togglePreview = () => setIsPreviewOpen((p) => !p);

  const toggleFullScreen = () => {
    setIsFullScreen((f) => {
      const next = !f;
      if (next) {
        // Full screen supersedes the other size states.
        setMaximized(false);
        setMinimized(false);
      }
      return next;
    });
  };

  return (
    <div
      className={`pi-compose ${minimized ? "pi-compose-min" : ""} ${maximized ? "pi-compose-max" : ""} ${isFullScreen ? "pi-compose-fullscreen" : ""}`}
    >
      <div
        className="pi-compose-header"
        onDoubleClick={() => setMaximized(!maximized)}
        onClick={() => minimized && setMinimized(false)}
      >
        <span className="pi-compose-title">
          {compose.subject || "New message"}
        </span>
        <div className="pi-compose-header-actions">
          <button
            className={`pi-icon-btn subtle ${isPreviewOpen ? "gold-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              togglePreview();
            }}
            aria-label={isPreviewOpen ? "Back to editing" : "Preview email"}
            title={isPreviewOpen ? "Back to editing" : "Preview email"}
          >
            {isPreviewOpen ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            className="pi-icon-btn subtle"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(!minimized);
              if (maximized) setMaximized(false);
              if (isFullScreen) setIsFullScreen(false);
            }}
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            <Minus size={15} />
          </button>
          <button
            className="pi-icon-btn subtle"
            onClick={(e) => {
              e.stopPropagation();
              setMaximized(!maximized);
              if (minimized) setMinimized(false);
              if (isFullScreen) setIsFullScreen(false);
            }}
            aria-label={maximized ? "Restore down" : "Maximize"}
            title={maximized ? "Restore down" : "Maximize"}
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="pi-icon-btn subtle"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullScreen();
            }}
            aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
            title={isFullScreen ? "Exit full screen" : "Full screen"}
          >
            {isFullScreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
          <button
            className="pi-icon-btn subtle"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="pi-compose-body">
          {isPreviewOpen ? (
            <div className="pi-compose-preview">
              <div className="pi-compose-preview-meta">
                <div className="pi-compose-preview-row">
                  <span>From</span>
                  <strong>{compose.from || "—"}</strong>
                </div>
                <div className="pi-compose-preview-row">
                  <span>To</span>
                  <strong>{compose.to || "—"}</strong>
                </div>
                <div className="pi-compose-preview-row">
                  <span>Subject</span>
                  <strong>{compose.subject || "(no subject)"}</strong>
                </div>
              </div>

              <div className="pi-gold-rule">
                <div className="pi-gold-rule-dot" />
              </div>

              <div className="pi-reading-body pi-compose-preview-body">
                {compose.body ? (
                  <div dangerouslySetInnerHTML={{ __html: compose.body }} />
                ) : (
                  <p className="pi-compose-preview-empty">
                    Nothing to preview yet — start writing your message.
                  </p>
                )}
              </div>

              {attachedFiles?.length > 0 && (
                <div className="pi-compose-preview-attachments">
                  {attachedFiles.map((f) => (
                    <div className="pi-attachment-chip" key={f.id}>
                      <Paperclip size={13} />
                      {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="pi-compose-field pi-from-field" ref={fromRef}>
                <span>From</span>
                {selectedProvider ? (
                  <div className="pi-from-select">
                    <button
                      type="button"
                      className="pi-from-select-button"
                      onClick={() => setFromOpen((o) => !o)}
                      aria-expanded={fromOpen}
                    >
                      <div className="pi-from-select-preview">
                        <div className="pi-from-badge">
                          {selectedProvider.label.slice(0, 1)}
                        </div>
                        <div className="pi-from-select-text">
                          <div className="pi-from-select-email">
                            {selectedProvider.email}
                          </div>
                        </div>
                      </div>
                      <ChevronDown size={14} />
                    </button>

                    {fromOpen && (
                      <div className="pi-from-select-menu">
                        {emailProviders.map((provider) => (
                          <button
                            key={provider._id}
                            type="button"
                            className={`pi-from-select-item ${provider._id === selectedProvider._id ? "active" : ""}`}
                            onClick={() => handleProviderSelect(provider)}
                          >
                            <div className="pi-from-item-badge">
                              {provider.label.slice(0, 1)}
                            </div>
                            <div className="pi-from-item-info">
                              <div className="pi-from-item-label">
                                {provider.label}
                              </div>
                              <div className="pi-from-item-email">
                                {provider.email}
                              </div>
                            </div>
                            {provider._id === selectedProvider._id && (
                              <span className="pi-from-item-selected">
                                Selected
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    value={compose.from}
                    onChange={(e) =>
                      setCompose({ ...compose, from: e.target.value })
                    }
                    placeholder="your@email.com"
                  />
                )}
              </div>

              <div className="pi-compose-field pi-to-field" ref={toRef}>
                <span>To</span>
                <div className="pi-to-autocomplete">
                  <input
                    value={compose.to}
                    onChange={(e) =>
                      setCompose({
                        ...compose,
                        to: e.target.value,
                        conversationId: undefined,
                        leadId: undefined,
                      })
                    }
                    placeholder="recipient@email.com"
                    onFocus={() => {
                      if (toSuggestions.length > 0) setSuggestionsOpen(true);
                    }}
                    className="w-full"
                  />
                  {suggestionsOpen && toSuggestions.length > 0 && (
                    <div className="pi-to-suggestion-list">
                      {toSuggestions.map((conversation) => {
                        const lead = (conversation as any).leadId as any;
                        return (
                          <button
                            key={conversation._id}
                            type="button"
                            className="pi-to-suggestion-item"
                            onClick={() =>
                              handleToSuggestionSelect(conversation)
                            }
                          >
                            <div className="pi-to-suggestion-content">
                              <div className="pi-to-suggestion-name">
                                {lead?.name || lead?.email || "Unknown"}
                              </div>
                            </div>
                            <div className="pi-to-suggestion-email">
                              {lead?.email || "No email"}
                            </div>
                            {/* <div className="pi-to-suggestion-subject">
                              {conversation.recentMessage?.subject ||
                                "No recent subject"}
                            </div> */}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pi-compose-field">
                <span>Subject</span>
                <input
                  value={compose.subject}
                  onChange={(e) =>
                    setCompose({ ...compose, subject: e.target.value })
                  }
                  placeholder="Subject"
                />
              </div>

              {appliedTemplate && (
                <div className="pi-compose-template-banner">
                  <div>
                    <strong>Template:</strong> {appliedTemplate.name}
                  </div>
                  <button
                    type="button"
                    className="pi-link-button"
                    onClick={handleTemplateRemove}
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="pi-compose-main">
                <div className="pi-compose-editor-area">
                  <RichTextEditor
                    value={compose.body}
                    onChange={(html) => setCompose({ ...compose, body: html })}
                    editorRef={editorRef}
                    onActiveFormatsChange={setActiveFormats}
                  />
                </div>
              </div>

              <div className="pi-compose-footer">
                {attachedFiles?.length > 0 && (
                  <div className="pi-compose-attachments">
                    {attachedFiles?.map((file) => {
                      const ext =
                        file.name.split(".").pop()?.toUpperCase() || "FILE";
                      const mime =
                        file.originalFile?.type ||
                        (file.url
                          ? new URL(file.url, window.location.href).pathname
                              .split(".")
                              .pop()
                          : "");
                      return (
                        <div
                          key={file.id}
                          className="pi-compose-attachment-card"
                        >
                          <div className="pi-attachment-icon-wrap">
                            <div className="pi-attachment-icon">{ext}</div>
                          </div>

                          <div className="pi-attachment-body">
                            <div className="pi-attachment-top">
                              <div className="pi-attachment-name">
                                {file.name}
                              </div>
                              <div className="pi-attachment-status">
                                {file.uploading
                                  ? "Uploading…"
                                  : file.url
                                    ? "Uploaded"
                                    : "Ready"}
                              </div>
                            </div>
                            <div className="pi-attachment-meta">
                              <div className="pi-attachment-size">
                                {formatBytes(file.size)}
                              </div>
                              {mime ? (
                                <div className="pi-attachment-mime">
                                  • {mime}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="pi-attachment-actions">
                            <button
                              type="button"
                              className="pi-icon-btn subtle"
                              onClick={() => handleRemoveAttachment(file.id)}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pi-compose-toolbar">
                  {!isPreviewOpen ? (
                    <div className="pi-compose-format">
                      <button
                        className={`pi-icon-btn subtle ${activeFormats.has("bold") ? "gold-active" : ""}`}
                        type="button"
                        onClick={() => execRichTextCommand("bold")}
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        className={`pi-icon-btn subtle ${activeFormats.has("italic") ? "gold-active" : ""}`}
                        type="button"
                        onClick={() => execRichTextCommand("italic")}
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        className={`pi-icon-btn subtle ${activeFormats.has("underline") ? "gold-active" : ""}`}
                        type="button"
                        onClick={() => execRichTextCommand("underline")}
                      >
                        <Underline size={14} />
                      </button>
                      <span className="pi-toolbar-divider" />
                      <button
                        className={`pi-icon-btn subtle ${activeFormats.has("a") ? "gold-active" : ""}`}
                        type="button"
                        onClick={() => {
                          const url = window.prompt(
                            "Enter the URL",
                            "https://",
                          );
                          if (url) execRichTextCommand("createLink", url);
                        }}
                      >
                        <Link2 size={14} />
                      </button>

                      <EmojiPickerModal
                        contentEditableRef={editorRef}
                        setValue={(v: React.SetStateAction<string>) => {
                          const value =
                            typeof v === "function"
                              ? (v as (p: string) => string)(compose.body)
                              : v;
                          setCompose((prev: ComposeDraft) => ({
                            ...prev,
                            body: value,
                          }));
                        }}
                        triggerButton={
                          <button className="pi-icon-btn subtle" type="button">
                            <Smile size={14} />
                          </button>
                        }
                        position="top-left"
                        autoPosition
                      />

                      <div className="pi-tpl-anchor">
                        <button
                          className="pi-icon-btn subtle"
                          type="button"
                          onClick={() => setTemplatePickerOpen((o) => !o)}
                          aria-label="Insert template"
                          title="Insert template"
                        >
                          <Search size={14} />
                        </button>
                        {templatePickerOpen && (
                          <TemplatePickerDropdown
                            templates={emailTemplates || []}
                            onApply={handleTemplateApplied}
                            onClose={() => setTemplatePickerOpen(false)}
                          />
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => uploadFiles(e.target.files)}
                      />
                      <button
                        className="pi-icon-btn subtle"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="pi-compose-preview-note">
                      Reviewing your message — click the eye icon to keep
                      editing
                    </div>
                  )}

                  <button
                    className="pi-send-btn"
                    onClick={() => setSendModalOpen(true)}
                    disabled={sending}
                  >
                    <span>{sending ? "Sending…" : "Send"}</span>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Send Options Modal ── */}
      {sendModalOpen && (
        <SendOptionsModal
          onClose={() => setSendModalOpen(false)}
          onSendNow={() => {
            setSendModalOpen(false);
            onSend();
          }}
          onSchedule={(schedule) => {
            setSendModalOpen(false);
            onSchedule(schedule);
          }}
          compose={compose}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SendOptionsModal
   ───────────────────────────────────────────────────────────── */

const TIMEZONES = [
  { label: "(UTC-12:00) International Date Line West", value: "Etc/GMT+12" },
  { label: "(UTC-11:00) Coordinated Universal Time-11", value: "Etc/GMT+11" },
  { label: "(UTC-10:00) Hawaii", value: "Pacific/Honolulu" },
  { label: "(UTC-09:00) Alaska", value: "America/Anchorage" },
  { label: "(UTC-08:00) Pacific Time (US & Canada)", value: "America/Los_Angeles" },
  { label: "(UTC-07:00) Mountain Time (US & Canada)", value: "America/Denver" },
  { label: "(UTC-06:00) Central Time (US & Canada)", value: "America/Chicago" },
  { label: "(UTC-05:00) Eastern Time (US & Canada)", value: "America/New_York" },
  { label: "(UTC-04:00) Atlantic Time (Canada)", value: "America/Halifax" },
  { label: "(UTC-03:00) Brasilia", value: "America/Sao_Paulo" },
  { label: "(UTC-02:00) Coordinated Universal Time-02", value: "Etc/GMT+2" },
  { label: "(UTC-01:00) Azores", value: "Atlantic/Azores" },
  { label: "(UTC+00:00) London, Dublin, Edinburgh", value: "Europe/London" },
  { label: "(UTC+01:00) Amsterdam, Berlin, Paris, Rome", value: "Europe/Paris" },
  { label: "(UTC+02:00) Athens, Bucharest, Istanbul", value: "Europe/Athens" },
  { label: "(UTC+03:00) Moscow, St. Petersburg", value: "Europe/Moscow" },
  { label: "(UTC+03:30) Tehran", value: "Asia/Tehran" },
  { label: "(UTC+04:00) Abu Dhabi, Muscat, Dubai", value: "Asia/Dubai" },
  { label: "(UTC+04:30) Kabul", value: "Asia/Kabul" },
  { label: "(UTC+05:00) Islamabad, Karachi, Tashkent", value: "Asia/Karachi" },
  { label: "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi", value: "Asia/Kolkata" },
  { label: "(UTC+05:45) Kathmandu", value: "Asia/Kathmandu" },
  { label: "(UTC+06:00) Astana, Dhaka", value: "Asia/Dhaka" },
  { label: "(UTC+06:30) Yangon (Rangoon)", value: "Asia/Yangon" },
  { label: "(UTC+07:00) Bangkok, Hanoi, Jakarta", value: "Asia/Bangkok" },
  { label: "(UTC+08:00) Beijing, Hong Kong, Singapore", value: "Asia/Singapore" },
  { label: "(UTC+09:00) Tokyo, Seoul, Osaka", value: "Asia/Tokyo" },
  { label: "(UTC+09:30) Adelaide, Darwin", value: "Australia/Adelaide" },
  { label: "(UTC+10:00) Sydney, Melbourne, Brisbane", value: "Australia/Sydney" },
  { label: "(UTC+11:00) Solomon Islands, New Caledonia", value: "Pacific/Guadalcanal" },
  { label: "(UTC+12:00) Auckland, Wellington, Fiji", value: "Pacific/Auckland" },
];

function guessLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTimeString(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

interface SendOptionsModalProps {
  onClose: () => void;
  onSendNow: () => void;
  onSchedule: (schedule: {
    scheduledDate: string;
    scheduledTime: string;
    scheduledTimezone: string;
  }) => void;
  compose: { to: string; subject: string; from: string };
}

function SendOptionsModal({
  onClose,
  onSendNow,
  onSchedule,
  compose,
}: SendOptionsModalProps) {
  const [tab, setTab] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState(todayDateString);
  const [scheduledTime, setScheduledTime] = useState(nowTimeString);
  const [scheduledTimezone, setScheduledTimezone] = useState(guessLocalTimezone);
  const [tzSearch, setTzSearch] = useState("");
  const [tzOpen, setTzOpen] = useState(false);
  const tzRef = useRef<HTMLDivElement | null>(null);

  const filteredTz = TIMEZONES.filter(
    (tz) =>
      tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
      tz.value.toLowerCase().includes(tzSearch.toLowerCase()),
  );

  const selectedTzLabel =
    TIMEZONES.find((t) => t.value === scheduledTimezone)?.label ||
    scheduledTimezone;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!tzRef.current?.contains(e.target as Node)) setTzOpen(false);
    };
    if (tzOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tzOpen]);

  const handleScheduleConfirm = () => {
    if (!scheduledDate || !scheduledTime || !scheduledTimezone) return;
    onSchedule({ scheduledDate, scheduledTime, scheduledTimezone });
  };

  return (
    <div
      className="pi-som-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pi-som" role="dialog" aria-modal="true" aria-labelledby="pi-som-title">

        {/* Header */}
        <div className="pi-som-header">
          <div className="pi-som-header-inner">
            <div className="pi-som-icon-ring">
              <Send size={16} />
            </div>
            <div>
              <div className="pi-som-title" id="pi-som-title">Send Message</div>
              <div className="pi-som-subtitle">
                To: <span>{compose.to || "—"}</span>
                {compose.subject ? (
                  <>
                    &nbsp;·&nbsp;<span>{compose.subject}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <button
            className="pi-icon-btn subtle"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="pi-som-tabs">
          <button
            type="button"
            className={`pi-som-tab ${tab === "now" ? "active" : ""}`}
            onClick={() => setTab("now")}
          >
            <Zap size={14} />
            Send Now
          </button>
          <button
            type="button"
            className={`pi-som-tab ${tab === "later" ? "active" : ""}`}
            onClick={() => setTab("later")}
          >
            <Clock size={14} />
            Schedule for Later
          </button>
        </div>

        {/* Body */}
        <div className="pi-som-body">
          {tab === "now" ? (
            <div className="pi-som-now-panel">
              <div className="pi-som-now-icon">
                <Zap size={32} />
              </div>
              <div className="pi-som-now-copy">
                <strong>Ready to go?</strong>
                <p>Your message will be delivered immediately to <em>{compose.to || "the recipient"}</em>.</p>
              </div>
            </div>
          ) : (
            <div className="pi-som-later-panel">
              <p className="pi-som-later-hint">
                Pick a date, time, and timezone — we'll deliver your message right on schedule.
              </p>

              {/* Date */}
              <div className="pi-som-field">
                <label className="pi-som-label" htmlFor="pi-som-date">
                  <Calendar size={13} /> Date
                </label>
                <input
                  id="pi-som-date"
                  type="date"
                  className="pi-som-input"
                  value={scheduledDate}
                  min={todayDateString()}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              {/* Time */}
              <div className="pi-som-field">
                <label className="pi-som-label" htmlFor="pi-som-time">
                  <Clock size={13} /> Time
                </label>
                <input
                  id="pi-som-time"
                  type="time"
                  className="pi-som-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>

              {/* Timezone */}
              <div className="pi-som-field">
                <label className="pi-som-label">
                  <Globe size={13} /> Timezone
                </label>
                <div className="pi-som-tz-anchor" ref={tzRef}>
                  <button
                    type="button"
                    className="pi-som-tz-btn"
                    onClick={() => setTzOpen((o) => !o)}
                    aria-expanded={tzOpen}
                  >
                    <span className="pi-som-tz-label">{selectedTzLabel}</span>
                    <ChevronDown size={13} className={tzOpen ? "open" : ""} />
                  </button>
                  {tzOpen && (
                    <div className="pi-som-tz-menu">
                      <div className="pi-som-tz-search-wrap">
                        <Search size={12} />
                        <input
                          type="text"
                          className="pi-som-tz-search"
                          placeholder="Search timezones…"
                          value={tzSearch}
                          onChange={(e) => setTzSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="pi-som-tz-list">
                        {filteredTz.length === 0 ? (
                          <div className="pi-som-tz-empty">No results</div>
                        ) : (
                          filteredTz.map((tz) => (
                            <button
                              key={tz.value}
                              type="button"
                              className={`pi-som-tz-item ${scheduledTimezone === tz.value ? "active" : ""}`}
                              onClick={() => {
                                setScheduledTimezone(tz.value);
                                setTzOpen(false);
                                setTzSearch("");
                              }}
                            >
                              {tz.label}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pi-som-footer">
          <button
            type="button"
            className="pi-secondary-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          {tab === "now" ? (
            <button
              type="button"
              className="pi-send-btn"
              onClick={onSendNow}
            >
              <span>Send Now</span>
              <Send size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="pi-som-schedule-btn"
              onClick={handleScheduleConfirm}
              disabled={!scheduledDate || !scheduledTime || !scheduledTimezone}
            >
              <Clock size={14} />
              <span>Schedule Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
