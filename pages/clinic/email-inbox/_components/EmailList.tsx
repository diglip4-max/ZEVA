import React, { useCallback, useRef } from "react";
import { Search, Mail, Filter } from "lucide-react";
import EmailListItem from "./EmailListItem";
import {
  EMAIL_FOLDERS,
  EmailFolderKey,
  MessageData,
} from "@/hooks/useEmailInbox";
import { getFormatedTimeForEmailMsgs } from "@/lib/helper";
import EmailListSkeleton from "./EmailListSkelton";

interface EmailListProps {
  folder: EmailFolderKey;
  messages: MessageData[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedMessageId: string | null;
  onSelect: (conversationId: string, messageId: string) => void;
  onToggleStar: (id: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  listRef: React.RefObject<HTMLDivElement>;
  onFilterClick: () => void;
  hasActiveFilters: boolean;
}

export default function EmailList({
  folder,
  messages,
  loading,
  search,
  onSearchChange,
  selectedMessageId,
  onSelect,
  onToggleStar,
  hasMore,
  onLoadMore,
  listRef,
  onFilterClick,
  hasActiveFilters,
}: EmailListProps) {
  const folderLabel =
    EMAIL_FOLDERS.find((f) => f.key === folder)?.label || "Mail";
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const el = listRef.current;
      if (!el || !hasMore || loading) return;
      const isNearBottom =
        el.scrollHeight - el.scrollTop <= el.clientHeight + 150;
      if (isNearBottom) {
        onLoadMore();
      }
    }, 200);
  }, [listRef, hasMore, loading, onLoadMore]);

  const totalEmailsLenth = messages.reduce(
    (acc, group) => acc + (group.messages?.length || 0),
    0,
  );

  return (
    <section className="pi-listcol">
      <div className="pi-list-header">
        <div className="pi-list-title-row">
          <div className="pi-list-title">{folderLabel}</div>
          <div className="pi-list-sub">{totalEmailsLenth} emails</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="pi-search" style={{ flex: 1 }}>
            <Search size={15} />
            <input
              placeholder="Search mail by name or email…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <button
            onClick={onFilterClick}
            className={`pi-filter-btn ${hasActiveFilters ? "active" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: hasActiveFilters ? "var(--primary-soft)" : "var(--panel)",
              color: hasActiveFilters ? "var(--primary-bright)" : "var(--text-dim)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              position: "relative",
              flexShrink: 0
            }}
          >
            <Filter size={18} />
            {hasActiveFilters && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "var(--primary-bright)",
                  color: "white",
                  width: "16px",
                  height: "16px",
                  fontSize: "9px",
                  fontWeight: "bold",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                1
              </span>
            )}
          </button>
        </div>
      </div>

      {/* initial load — replace the whole list */}

      <div className="pi-list-scroll" ref={listRef} onScroll={handleScroll}>
        {loading && messages.length === 0 ? (
          <EmailListSkeleton />
        ) : (
          <>
            {!loading && messages.length === 0 && (
              <div className="pi-empty">
                <Mail size={38} strokeWidth={1.2} />
                <div className="pi-empty-title">Nothing here</div>
                <div className="pi-empty-sub">
                  {search
                    ? "No conversations match your search."
                    : "This folder is empty for now."}
                </div>
              </div>
            )}
            {messages.length > 0 &&
              messages.map((g) => {
                return (
                  <div key={g.date}>
                    <div
                      style={{
                        padding: "14px 18px 8px 18px",
                        fontSize: "10.5px",
                        letterSpacing: "0.09em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      className="pi-group-label"
                    >
                      {getFormatedTimeForEmailMsgs(g.date)}
                    </div>
                    {g.messages?.length > 0 &&
                      g.messages.map((m) => (
                        <EmailListItem
                          key={m._id}
                          message={m}
                          selected={selectedMessageId === m._id}
                          starred={m.isStarred || false}
                          onSelect={onSelect}
                          onToggleStar={onToggleStar}
                        />
                      ))}
                  </div>
                );
              })}
            {/* pagination load-more, append instead of replace */}
            {loading && messages.length > 0 && <EmailListSkeleton count={3} />}
          </>
        )}
      </div>
      {/* <div className="pi-list-scroll" ref={listRef} onScroll={handleScroll}>
        {!loading && messages.length === 0 && (
          <div className="pi-empty">
            <Mail size={38} strokeWidth={1.2} />
            <div className="pi-empty-title">Nothing here</div>
            <div className="pi-empty-sub">
              {search
                ? "No conversations match your search."
                : "This folder is empty for now."}
            </div>
          </div>
        )}
        {messages.length > 0 &&
          messages.map((g) => {
            return (
              <div key={g.date}>
                <div
                  style={{
                    padding: "14px 18px 8px 18px",
                    fontSize: "10.5px",
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  className="pi-group-label"
                >
                  {getFormatedTimeForEmailMsgs(g.date)}
                </div>
                {g.messages?.length > 0 &&
                  g.messages.map((m) => (
                    <EmailListItem
                      key={m._id}
                      message={m}
                      selected={selectedMessageId === m._id}
                      starred={starredIds.has(m.conversationId)}
                      onSelect={onSelect}
                      onToggleStar={onToggleStar}
                    />
                  ))}
              </div>
            );
          })}

        {loading && (
          <div
            className="pi-empty-sub"
            style={{ textAlign: "center", padding: 16 }}
          >
            Loading…
          </div>
        )}
      </div> */}
    </section>
  );
}
