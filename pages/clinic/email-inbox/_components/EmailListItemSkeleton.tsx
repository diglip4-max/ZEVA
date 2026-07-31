import React from "react";

/**
 * Skeleton stand-in for a single EmailListItem row. Mirrors the real
 * row's structure (avatar → name/time → subject → preview) so the list
 * doesn't "jump" in size once real data arrives.
 */
export default function EmailListItemSkeleton() {
  return (
    <div className="pi-row pi-row-skeleton">
      <div className="pi-skeleton-avatar" />
      <div className="pi-row-body">
        <div className="pi-row-top">
          <div className="pi-skeleton-line sk-name" />
          <div className="pi-skeleton-line sk-time" />
        </div>
        <div className="pi-skeleton-line sk-subject" />
        <div className="pi-skeleton-line sk-preview" />
      </div>
    </div>
  );
}
