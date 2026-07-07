import React from "react";
import { Star, Paperclip } from "lucide-react";
import EmailAvatar from "./EmailAvatar";
import { MessageType } from "@/types/conversations";

interface EmailListItemProps {
  message: MessageType;
  selected: boolean;
  starred: boolean;
  onSelect: (conversationId: string, messageId: string) => void;
  onToggleStar: (id: string) => void;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function stripHtml(html?: string) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function EmailListItem({
  message,
  selected,
  starred,
  onSelect,
  onToggleStar,
}: EmailListItemProps) {
  // `leadId` and `recentMessage` are populated by the backend (see get
  // conversations / Message model). Cast loosely since ConversationType
  // in this codebase doesn't fully describe the populated shape.
  const lead = message.recipientId as any;
  const recent = message as any;
  const unread = message.status !== "sent" && message.direction === "incoming";

  return (
    <div
      className={`pi-row ${selected ? "selected" : ""} ${unread ? "unread" : ""}`}
      onClick={() => onSelect(message.conversationId, message._id)}
    >
      <EmailAvatar name={lead?.name} unread={unread} />
      <div className="pi-row-body">
        <div className="pi-row-top">
          <div className="pi-row-name">
            {lead?.name || lead?.email || "Unknown"}
          </div>
          <div className="pi-row-time">{formatTime(recent?.createdAt)}</div>
        </div>
        <div className="pi-row-subject">
          {recent?.subject || "(no subject)"}
        </div>
        <div className="pi-row-preview">
          {stripHtml(recent?.content).slice(0, 90)}
        </div>
        <div className="pi-row-meta">
          {!!recent?.attachments?.length && (
            <Paperclip size={12} className="pi-clip" />
          )}
        </div>
      </div>
      <button
        className={`pi-row-star ${starred ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(message.conversationId);
        }}
        aria-label="Toggle star"
      >
        <Star size={15} fill={starred ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
