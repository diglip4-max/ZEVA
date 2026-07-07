import React, { useState } from "react";
import { Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import EmailAvatar from "./EmailAvatar";
import { MessageType } from "@/types/conversations";

interface EmailThreadMessageProps {
  message: MessageType;
  leadName?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isLast?: boolean;
}

export default function EmailThreadMessage({
  message,
  leadName,
  isExpanded = true,
  onToggleExpand,
  isLast = false,
}: EmailThreadMessageProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isOutgoing = (message as any).direction === "outgoing";
  const fromName = isOutgoing
    ? (message as any).provider?.label || "Unknown"
    : leadName || "Unknown";
  const fromEmail = isOutgoing
    ? (message as any).provider?.email || ""
    : (message as any).recipientId?.email || "";
  const senderEmail = isOutgoing
    ? (message as any).recipientId?.email || ""
    : (message as any).senderId?.email || "";
  const recipientEmail = (message as any).recipientId?.email || "";
  const attachments = (message as any).attachments as
    | { fileName: string; fileSize?: string; mediaUrl?: string }[]
    | undefined;

  const displayFrom = isOutgoing
    ? `You${senderEmail ? ` <${senderEmail}>` : ""}`
    : `${fromName}${senderEmail ? ` <${senderEmail}>` : ""}`;
  const displayTo = recipientEmail || "Unknown recipient";
  const messageDate = message?.createdAt
    ? new Date(message.createdAt).toLocaleString()
    : "";

  // Generate a short preview when collapsed
  const getPreview = () => {
    const content = (message as any).content || "";
    // Strip HTML tags for preview
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.slice(0, 100) + (text.length > 100 ? "..." : "");
  };

  return (
    <div
      className={`pi-thread-message ${!isExpanded ? "pi-thread-collapsed" : ""}`}
    >
      <div className="pi-reading-from">
        <EmailAvatar name={fromName} />
        <div className="pi-reading-from-text">
          <div className="pi-reading-from-name">{`${fromName} <${fromEmail}>`}</div>
          <div className="pi-reading-to-row">
            <div className="pi-reading-to">to {senderEmail}</div>
            <button
              type="button"
              className="pi-thread-details-toggle"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-label={
                detailsOpen ? "Hide email details" : "Show email details"
              }
            >
              {detailsOpen ? (
                <ChevronUp size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
            </button>

            {detailsOpen && (
              <div className="pi-thread-info-card">
                <div className="pi-thread-info-row">
                  <span>From</span>
                  <span>{displayFrom}</span>
                </div>
                <div className="pi-thread-info-row">
                  <span>To</span>
                  <span>{displayTo}</span>
                </div>
                <div className="pi-thread-info-row">
                  <span>Subject</span>
                  <span>{message.subject || "(no subject)"}</span>
                </div>
                <div className="pi-thread-info-row">
                  <span>Date</span>
                  <span>{messageDate}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="pi-reading-time">
          {(message as any).createdAt
            ? new Date((message as any).createdAt).toLocaleString()
            : ""}
        </div>
      </div>

      {!isLast && (
        <button
          className="pi-thread-expand-toggle"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}

      <div
        className={`pi-thread-content ${!isExpanded ? "pi-thread-content-collapsed" : ""}`}
      >
        {!isExpanded ? (
          <div className="pi-thread-preview">{getPreview()}</div>
        ) : (
          <div className="pi-reading-body">
            {/* Email content is stored as HTML server-side (see send-email-message,
                where signatures/tracking pixels are injected into `content`). */}
            <div
              dangerouslySetInnerHTML={{
                __html: (message as any).content || "",
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {!!attachments?.length &&
                attachments.map((a, i) => (
                  <div
                    onClick={() => window.open(a.mediaUrl, "_blank")}
                    className="pi-attachment-chip"
                    key={i}
                  >
                    <Paperclip size={13} />
                    {a.fileName}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
