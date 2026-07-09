import React, { useState, useEffect } from "react";
import {
  Archive,
  Trash2,
  Star,
  MoreHorizontal,
  Reply,
  Forward,
  Mail,
  Undo2,
  ArchiveRestore,
  Plus,
  X,
} from "lucide-react";
import EmailThreadMessage from "./EmailThreadMessage";
import AssignConversation from "./AssignConversation";
import { MessageType } from "@/types/conversations";
import { User } from "@/types/users";
import { getTagColor } from "@/hooks/useInbox";

interface EmailReadingPaneProps {
  messages: MessageType[];
  loading: boolean;
  starred: boolean;
  archived: boolean;
  trashed: boolean;
  onToggleStar: (id: string) => void;
  onArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onReply: (message: MessageType) => void;
  onForward: (message: MessageType) => void;
  onDelete: (id: string) => void;
  onRestoreFromTrash: (id: string) => void;
  onRestoreFromArchive: (id: string) => void;
  agents: User[];
  selectedAgent: User | null;
  onAgentSelect: (agent: User | null, conversationId: string) => void;
  agentFetchLoading: boolean;

  // Tags
  tags: string[];
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  leadId: string;
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
  archived,
  trashed,
  onToggleStar,
  onArchive,
  onTrash,
  onReply,
  onForward,
  onDelete,
  onRestoreFromTrash,
  onRestoreFromArchive,
  agents,
  selectedAgent,
  onAgentSelect,
  agentFetchLoading,
  tags,
  onAddTag,
  onRemoveTag,
  leadId,
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
        {!archived && !trashed && (
          <>
            <button
              className="pi-icon-btn"
              onClick={() => onArchive(message._id)}
              aria-label="Archivearchive"
              disabled={!message || loading}
              title="Move to Archive"
            >
              <Archive size={17} />
            </button>
            <button
              className={`pi-icon-btn ${starred ? "gold-active" : ""}`}
              onClick={() => onToggleStar(message._id)}
              aria-label="Star"
              disabled={!message || loading}
              title={starred ? "Remove Star" : "Add Star"}
            >
              <Star size={17} fill={starred ? "currentColor" : "none"} />
            </button>
          </>
        )}
        {archived && (
          <button
            className="pi-icon-btn"
            onClick={() => onRestoreFromArchive(message._id)}
            aria-label="Restore from Archive"
            disabled={!message || loading}
            title="Restore from Archive"
          >
            <ArchiveRestore size={17} />
          </button>
        )}
        {!trashed && (
          <button
            className="pi-icon-btn danger"
            onClick={() => onTrash(message._id)}
            aria-label="Delete"
            disabled={!message || loading}
            title="Move to Trash"
          >
            <Trash2 size={17} />
          </button>
        )}
        {trashed && (
          <>
            <button
              className="pi-icon-btn"
              onClick={() => onRestoreFromTrash(message._id)}
              aria-label="Restore"
              disabled={!message || loading}
              title="Restore from Trash"
            >
              <Undo2 size={17} />
            </button>
            <button
              className="pi-icon-btn danger"
              onClick={() => onDelete(message._id)}
              aria-label="Delete"
              disabled={!message || loading}
              title="Delete"
            >
              <Trash2 size={17} />
            </button>
          </>
        )}

        <div className="pi-toolbar-spacer" />

        {/* Add tag button stays in toolbar */}
        {message && leadId && (
          <button
            onClick={onAddTag}
            style={{
              paddingTop: "8px",
              paddingBottom: "8px",
              paddingLeft: "12px",
              paddingRight: "15px",
              fontSize: "13px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              textAlign: "left",
              outline: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: "1",
              transition: "all 0.12s ease",
            }}
          >
            <Plus size={14} />
            <span>Add tag</span>
          </button>
        )}

        {message && (
          <AssignConversation
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentSelect={(agent) => onAgentSelect(agent, conversationId)}
            loading={agentFetchLoading}
            placeholder="Assign to agent..."
          />
        )}
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

            {/* Tags display */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${getTagColor(tag)}`}
                  >
                    {tag}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(tag);
                      }}
                      className="ml-2 hover:opacity-70"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

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
