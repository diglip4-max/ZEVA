import React, { useState, useEffect } from "react";
import {
  Archive,
  Trash2,
  Star,
  MoreHorizontal,
  Reply,
  Forward,
  Mail,
} from "lucide-react";
import EmailThreadMessage from "./EmailThreadMessage";
import { MessageType } from "@/types/conversations";

interface EmailReadingPaneProps {
  messages: MessageType[];
  loading: boolean;
  starred: boolean;
  onToggleStar: (id: string) => void;
  onArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onReply: (message: MessageType) => void;
  onForward: (message: MessageType) => void;
}

function EmailReadingSkeleton() {
  return (
    <div className="pi-reading-inner pi-skeleton-card">
      <div className="pi-skeleton-header">
        <div className="pi-skeleton-line title" />
        <div className="pi-skeleton-line short" />
      </div>

      <div className="pi-gold-rule">
        <div className="pi-gold-rule-dot" />
      </div>

      <div className="pi-skeleton-row">
        <div className="pi-skeleton-avatar" />
        <div className="pi-skeleton-row-body">
          <div className="pi-skeleton-line medium" />
          <div className="pi-skeleton-line short" />
        </div>
      </div>

      <div className="pi-skeleton-chips">
        <div className="pi-skeleton-pill" />
        <div className="pi-skeleton-pill small" />
        <div className="pi-skeleton-pill small" />
      </div>

      <div className="pi-skeleton-box content" />
      <div className="pi-skeleton-group">
        <div className="pi-skeleton-line full" />
        <div className="pi-skeleton-line wide" />
        <div className="pi-skeleton-line medium" />
        <div className="pi-skeleton-line short" />
      </div>

      <div className="pi-skeleton-actions">
        <div className="pi-skeleton-line button" />
        <div className="pi-skeleton-line button" />
      </div>
    </div>
  );
}

export default function EmailReadingPane({
  messages,
  loading,
  starred,
  onToggleStar,
  onArchive,
  onTrash,
  onReply,
  onForward,
}: EmailReadingPaneProps) {
  // Track which messages are expanded
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  // Initialize: only expand last message by default
  useEffect(() => {
    if (messages.length > 0) {
      const newExpanded = new Set<string>();
      // Last message is always expanded
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?._id) {
        newExpanded.add(lastMessage._id);
      }
      setExpandedMessageIds(newExpanded);
    }
  }, [messages.map((m) => m._id).join(",")]); // Re-run when messages array changes

  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  if (messages.length === 0 && !loading) {
    return (
      <section className="pi-reading">
        <div className="pi-empty" style={{ margin: "auto" }}>
          <Mail size={44} strokeWidth={1.1} />
          <div className="pi-empty-title">Select an email</div>
          <div className="pi-empty-sub">
            Choose an email from the list to read it here.
          </div>
        </div>
      </section>
    );
  }
  const message = messages[0];
  const conversationId = message?.conversationId ?? "";
  const lead = message?.recipientId as any;

  return (
    <section className="pi-reading">
      <div className="pi-reading-toolbar">
        <button
          className="pi-icon-btn"
          onClick={() => onArchive(conversationId)}
          aria-label="Archive"
          disabled={!message || loading}
        >
          <Archive size={17} />
        </button>
        <button
          className="pi-icon-btn danger"
          onClick={() => onTrash(conversationId)}
          aria-label="Delete"
          disabled={!message || loading}
        >
          <Trash2 size={17} />
        </button>
        <button
          className={`pi-icon-btn ${starred ? "gold-active" : ""}`}
          onClick={() => onToggleStar(conversationId)}
          aria-label="Star"
          disabled={!message || loading}
        >
          <Star size={17} fill={starred ? "currentColor" : "none"} />
        </button>
        <div className="pi-toolbar-spacer" />
        <button className="pi-icon-btn" aria-label="More" disabled={loading}>
          <MoreHorizontal size={17} />
        </button>
      </div>

      <div className="pi-reading-scroll">
        {loading ? (
          <EmailReadingSkeleton />
        ) : (
          <div className="pi-reading-inner">
            <div className="pi-reading-subject">
              {message?.subject || "(no subject)"}
            </div>
            <div className="pi-gold-rule">
              <div className="pi-gold-rule-dot" />
            </div>

            {messages?.length == 0 ? (
              <div className="pi-empty-sub">No email selected.</div>
            ) : (
              messages?.map((msg, index) => (
                <EmailThreadMessage
                  key={msg._id}
                  message={msg}
                  leadName={lead?.name}
                  isExpanded={expandedMessageIds.has(msg._id!)}
                  onToggleExpand={() => toggleMessageExpansion(msg._id!)}
                  isLast={index === messages.length - 1}
                />
              ))
            )}

            {message && (
              <div className="pi-reading-actions">
                <button
                  className="pi-reply-btn"
                  onClick={() => onReply(message)}
                >
                  <Reply size={15} /> Reply
                </button>
                <button
                  className="pi-reply-btn"
                  onClick={() => onForward(message)}
                >
                  <Forward size={15} /> Forward
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
