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
}: ComposeWindowProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toSuggestions, setToSuggestions] = useState<ConversationType[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<Template | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

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
                    onClick={onSend}
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
    </div>
  );
}
