import React from "react";
import {
  Plus,
  Inbox,
  Mail,
  FolderOpen,
  Archive,
  Trash2,
  SendHorizontal,
  Star,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { EMAIL_FOLDERS, EmailFolderKey } from "@/hooks/useEmailInbox";

const ICONS: Record<EmailFolderKey, React.ReactNode> = {
  all: <Inbox size={17} strokeWidth={1.6} />,
  incoming: <Inbox size={17} strokeWidth={1.6} />,
  starred: <Star size={17} strokeWidth={1.6} />,
  outgoing: <SendHorizontal size={17} strokeWidth={1.6} />,
  unread: <Mail size={17} strokeWidth={1.6} />,
  open: <FolderOpen size={17} strokeWidth={1.6} />,
  archived: <Archive size={17} strokeWidth={1.6} />,
  trashed: <Trash2 size={17} strokeWidth={1.6} />,
};

interface EmailSidebarProps {
  folder: EmailFolderKey;
  onFolderChange: (f: EmailFolderKey) => void;
  onCompose: () => void;
  unreadCountFor: (f: EmailFolderKey) => number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function EmailSidebar({
  folder,
  onFolderChange,
  onCompose,
  unreadCountFor,
  collapsed,
  onToggleCollapse,
}: EmailSidebarProps) {
  return (
    <aside className={`pi-sidebar ${collapsed ? "pi-collapsed" : ""}`}>
      <div className="pi-logo">
        <div className="pi-logo-mark">
          <span>I</span>
        </div>
        {!collapsed && <div className="pi-logo-text">Inbox</div>}
      </div>

      <button className="pi-compose-launch" onClick={onCompose} title="Compose">
        <Plus size={16} strokeWidth={2.2} />
        {!collapsed && <span>Compose</span>}
      </button>

      <nav className="pi-nav">
        {EMAIL_FOLDERS.map((f) => (
          <button
            key={f.key}
            className={`pi-nav-item ${folder === f.key ? "active" : ""}`}
            onClick={() => onFolderChange(f.key)}
            title={collapsed ? f.label : undefined}
          >
            {ICONS[f.key]}
            {!collapsed && <span className="pi-nav-label">{f.label}</span>}
            {!collapsed && unreadCountFor(f.key) > 0 && (
              <span className="pi-nav-count">{unreadCountFor(f.key)}</span>
            )}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="pi-sidebar-toggle"
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronsRight size={18} strokeWidth={2.1} />
        ) : (
          <ChevronsLeft size={18} strokeWidth={2.1} />
        )}
      </button>
    </aside>
  );
}
