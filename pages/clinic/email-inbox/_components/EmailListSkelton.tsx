import React from "react";
import EmailListItemSkeleton from "./EmailListItemSkeleton";

interface EmailListSkeletonProps {
  count?: number;
}

/**
 * Drop-in replacement for the list's "Loading…" text. Usage in EmailList:
 *
 *   {loading && messages.length === 0 ? (
 *     <EmailListSkeleton />
 *   ) : (
 *     ...your existing grouped-by-date rendering...
 *   )}
 *
 * For "load more" pagination (messages.length > 0 already), keep showing
 * real rows and just append a couple of skeleton rows at the bottom
 * instead of replacing the whole list:
 *
 *   {loading && messages.length > 0 && <EmailListSkeleton count={3} />}
 */
export default function EmailListSkeleton({
  count = 9,
}: EmailListSkeletonProps) {
  return (
    <div className="pi-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <EmailListItemSkeleton key={i} />
      ))}
    </div>
  );
}
