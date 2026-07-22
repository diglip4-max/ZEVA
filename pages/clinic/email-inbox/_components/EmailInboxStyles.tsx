import React from "react";

/**
 * All CSS for the premium email inbox, scoped under `.pi-root`.
 * Light mode version matching the analytics dashboard style.
 */
export default function EmailInboxStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

      .pi-root {
        --bg: #f1f5f9;
        --panel: #ffffff;
        --panel-2: #f8fafc;
        --panel-3: #e2e8f0;
        --border: #cbd5e1;
        --border-soft: #e2e8f0;
        --text: #0f172a;
        --text-dim: #1e293b;
        --text-faint: #64748b;
        --primary: #6366f1;
        --primary-bright: #818cf8;
        --primary-soft: rgba(99, 102, 241, 0.12);
        --primary-line: rgba(99, 102, 241, 0.25);
        --danger: #ef4444;
        --success: #10b981;
        --warning: #f59e0b;
        --sidebar-width: 248px;
        --sidebar-collapsed-width: 72px;
        --base-font-size: 14px;
        --large-font-size: 16px;

        font-family: 'Inter', system-ui, sans-serif;
        font-size: var(--base-font-size);
        background: var(--bg);
        color: var(--text);
        width: 100%;
        height: 93vh;
        min-height: 640px;
        display: flex;
        overflow: hidden;
        position: relative;
        -webkit-font-smoothing: antialiased;
      }
      .pi-root * { box-sizing: border-box; }
      .pi-root ::selection { background: var(--primary-soft); }
      .pi-root a,
      .pi-root a:visited {
        color: var(--primary);
        text-decoration: none;
      }
      .pi-root a:hover {
        color: var(--primary-bright);
        text-decoration: underline;
      }

      /* ---------- Sidebar ---------- */
      .pi-sidebar {
        width: var(--sidebar-width);
        flex-shrink: 0;
        background: var(--panel);
        border-right: 1px solid var(--border-soft);
        display: flex;
        flex-direction: column;
        padding: 20px 16px;
        transition: width .18s ease, padding .18s ease;
        position: relative;
      }
      .pi-sidebar.pi-collapsed {
        width: var(--sidebar-collapsed-width);
        padding: 20px 8px;
      }
      .pi-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 4px 18px 4px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--border-soft);
      }
      .pi-logo-mark {
        width: 32px; height: 32px;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      .pi-logo-text {
        font-family: 'Inter', sans-serif;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.2px;
        color: var(--text);
      }
      .pi-sidebar.pi-collapsed .pi-logo-text {
        display: none;
      }

      .pi-compose-launch {
        margin: 16px 4px 20px 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px 0;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white;
        font-weight: 600;
        font-size: 14px;
        border: none;
        cursor: pointer;
        box-shadow: 0 8px 24px -8px rgba(99, 102, 241, 0.4);
        transition: transform .15s ease, box-shadow .15s ease, width .18s ease, padding .18s ease;
      }
      .pi-sidebar.pi-collapsed .pi-compose-launch {
        width: 100%;
        padding: 14px 0;
        border-radius: 14px;
      }
      .pi-sidebar.pi-collapsed .pi-compose-launch span {
        display: none;
      }
      .pi-compose-launch:hover { transform: translateY(-2px); box-shadow: 0 12px 32px -8px rgba(99, 102, 241, 0.5); }
      .pi-compose-launch:active { transform: translateY(0); }

      .pi-nav { display: flex; flex-direction: column; gap: 4px; }
      .pi-nav-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        color: var(--text-dim);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        background: transparent;
        border: none;
        text-align: left;
        width: 100%;
        transition: background .12s ease, color .12s ease, transform .12s ease;
      }
      .pi-sidebar.pi-collapsed .pi-nav-item {
        justify-content: center;
        padding: 12px 0;
      }
      .pi-sidebar.pi-collapsed .pi-nav-label,
      .pi-sidebar.pi-collapsed .pi-nav-count {
        display: none;
      }
      .pi-nav-item:hover { background: var(--panel-2); color: var(--text); }
      .pi-nav-item.active {
        background: var(--primary-soft);
        color: var(--primary);
      }
      .pi-nav-item .pi-nav-label { flex: 1; }
      .pi-nav-count {
        min-width: 24px;
        text-align: center;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--panel-2);
        color: var(--text-faint);
        font-size: 12px;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
      }
      .pi-nav-item.active .pi-nav-count { background: var(--primary-soft); color: var(--primary); }

      /* ---------- Message Details ---------- */
      .pi-reading-to-row {
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
      }
      .pi-thread-details-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: var(--text-faint);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s ease;
        background: var(--panel-2);
        color: var(--text-dim);
      }
      .pi-thread-details-toggle:hover {
        background: var(--panel-3);
        color: var(--text);
      }
      .pi-thread-info-card {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 8px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        z-index: 10;
        min-width: 280px;
        box-shadow: 0 8px 24px -8px rgba(0,0,0,0.15);
      }
      .pi-thread-info-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 13px;
      }
      .pi-thread-info-row span:first-child {
        color: var(--text-faint);
        font-family: 'JetBrains Mono', monospace;
        min-width: 80px;
      }
      .pi-thread-info-row span:last-child {
        color: var(--text-dim);
        text-align: right;
        flex: 1;
        margin-left: 16px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ---------- Sidebar Toggle ---------- */
      .pi-sidebar-toggle {
        position: absolute;
        top: 28px;
        right: -14px;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--panel);
        color: var(--text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: all .15s ease;
      }
      .pi-sidebar-toggle:hover {
        background: var(--panel-2);
        color: var(--primary);
        transform: scale(1.1);
      }
      .pi-sidebar.pi-collapsed .pi-sidebar-toggle {
        right: -14px;
      }

      /* ---------- List column ---------- */
      .pi-listcol {
        width: 400px;
        flex-shrink: 0;
        border-right: 1px solid var(--border-soft);
        display: flex;
        flex-direction: column;
        background: var(--bg);
      }
      .pi-list-header { padding: 20px 20px 14px 20px; }
      .pi-list-title-row {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 16px;
      }
      .pi-list-title-container {
          display: flex; align-items: center; gap: 8px;
      }
          .pi-refresh-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            border-radius: 6px;
            color: var(--text-faint);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.12s ease;
            color: var(--text-dim);
          }
          .pi-refresh-btn:hover {
            background: var(--panel-2);
            color: var(--text);
          }
      .pi-list-title {
        font-family: 'Inter', sans-serif;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.3px;
        color: var(--text);
      }
      .pi-list-sub {
        font-size: 12px;
        color: var(--text-faint);
        font-family: 'JetBrains Mono', monospace;
      }
      .pi-search {
        display: flex; align-items: center; gap: 10px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px 14px;
        transition: border-color .15s ease, box-shadow .15s ease;
      }
      .pi-search:focus-within {
        border-color: var(--primary-line);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }
      .pi-search input {
        background: transparent; border: none; outline: none;
        color: var(--text); font-size: 14px; width: 100%;
        font-family: 'Inter', sans-serif;
      }
      .pi-search input::placeholder { color: var(--text-faint); }
      .pi-search svg { color: var(--text-faint); flex-shrink: 0; }

      .pi-list-scroll { flex: 1; overflow-y: auto; padding-bottom: 16px; }

      .pi-row {
        display: flex;
        gap: 14px;
        padding: 14px 20px;
        cursor: pointer;
        position: relative;
        border-left: 3px solid transparent;
        transition: background .12s ease, border-color .12s ease;
      }
      .pi-row:hover { background: var(--panel); }
      .pi-row.selected { background: var(--panel); border-left-color: var(--primary); }
      .pi-row.unread .pi-row-subject, .pi-row.unread .pi-row-name { font-weight: 600; color: var(--text); }

      .pi-avatar-wrap { position: relative; flex-shrink: 0; }
      .pi-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: 600; color: rgba(255,255,255,0.95);
        font-family: 'Inter', sans-serif;
        letter-spacing: 0.02em;
        background: linear-gradient(135deg, var(--panel-3), var(--border));
        font-size: 16px;
      }
      .pi-avatar-dot {
        position: absolute; top: 0; right: 0;
        width: 12px; height: 12px; border-radius: 50%;
        background: var(--primary);
        border: 3px solid var(--bg);
      }

      .pi-row-body { flex: 1; min-width: 0; }
      .pi-row-top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
      .pi-row-name { font-size: 15px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
      .pi-row-time { font-size: 12px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
      .pi-row-subject { font-size: 14px; color: var(--text-dim); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pi-row-preview { font-size: 13px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
      .pi-row-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
      .pi-row-star {
        background: none; border: none; cursor: pointer; padding: 2px;
        color: var(--text-faint); display: flex;
        opacity: 0; transition: opacity .12s ease, color .12s ease;
      }
      .pi-row:hover .pi-row-star, .pi-row-star.active { opacity: 1; }
      .pi-row-star.active { color: var(--primary); }
      .pi-clip { color: var(--text-faint); flex-shrink: 0; }

      .pi-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        height: 60%; color: var(--text-faint); gap: 12px; text-align: center; padding: 0 40px;
      }
      .pi-empty svg { color: var(--border); }
      .pi-empty-title { font-family: 'Inter', sans-serif; font-size: 16px; color: var(--text-dim); font-weight: 600; }
      .pi-empty-sub { font-size: 13px; }

      /* ---------- Reading pane ---------- */
      .pi-reading {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        min-width: 0;
      }
        .pi-reading-to-row {position: relative; flex-shrink: 0; display: flex; align-items: center; gap: 8px; }

      .pi-reading-toolbar {
        display: flex; align-items: center; gap: 6px;
        padding: 16px 28px;
        border-bottom: 1px solid var(--border-soft);
      }
      .pi-icon-btn {
        background: none; border: none; cursor: pointer;
        color: var(--text-dim);
        width: 36px; height: 36px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        transition: background .12s ease, color .12s ease, transform .12s ease;
      }
      .pi-icon-btn:hover { background: var(--panel); color: var(--text); transform: translateY(-1px); }
      .pi-icon-btn.subtle { width: 30px; height: 30px; color: var(--text-faint); }
      .pi-icon-btn.subtle:hover { color: var(--text); background: var(--panel-2); }
      .pi-icon-btn.danger:hover { color: var(--danger); background: rgba(239, 68, 68, 0.1); }
      .pi-icon-btn.gold-active {
        color: var(--primary);
        background: var(--primary-soft);
      }
      .pi-toolbar-spacer { flex: 1; }

      .pi-secondary-btn,
      .pi-danger-btn {
        padding: 12px 18px;
        border-radius: 12px;
        border: 1px solid transparent;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
      }
      .pi-secondary-btn {
        background: var(--panel);
        color: var(--text);
        border-color: var(--border-soft);
      }
      .pi-secondary-btn:hover:enabled {
        background: var(--panel-2);
      }
      .pi-secondary-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .pi-danger-btn {
        background: var(--danger);
        color: white;
      }
      .pi-danger-btn:hover:enabled {
        background: #dc2626;
      }
      .pi-danger-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .pi-delete-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 110;
        padding: 20px;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .pi-delete-modal {
        width: min(480px, 100%);
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: 24px;
        padding: 26px 26px 22px;
        box-shadow: 0 36px 100px rgba(15, 23, 42, 0.2);
      }
      .pi-delete-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }
      .pi-delete-modal-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.2;
      }
      .pi-delete-modal-body {
        color: var(--text-dim);
        font-size: 14px;
        line-height: 1.65;
        margin-bottom: 26px;
      }
      .pi-delete-modal-body p {
        margin: 0;
      }
      .pi-delete-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .pi-reading-scroll { flex: 1; overflow-y: auto; }
      .pi-reading-inner { max-width: 850px; margin: 0 auto; padding: 48px 48px 72px 48px; }

      .pi-reading-subject {
        font-family: 'Inter', sans-serif;
        font-size: 32px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.5px;
        margin-bottom: 24px;
        color: var(--text);
      }
      .pi-reading-from {
        display: flex; gap: 16px; align-items: flex-start;
        padding-bottom: 20px;
        margin-bottom: 20px;
        cursor: pointer;
      }
      .pi-reading-from-text { flex: 1; }
      .pi-reading-from-name { font-size: 16px; font-weight: 600; color: var(--text); }
      .pi-reading-to { font-size: 14px; color: var(--text-faint); margin-top: 4px; }
      .pi-reading-time { font-size: 13px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; white-space: nowrap; padding-top: 4px; }

      .pi-gold-rule { display: flex; align-items: center; gap: 12px; margin: 0 0 32px 0; }
      .pi-gold-rule::before, .pi-gold-rule::after {
        content: ''; flex: 1; height: 1px;
        background: linear-gradient(90deg, transparent, var(--primary-line), transparent);
      }
      .pi-gold-rule-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); transform: rotate(45deg); flex-shrink: 0; }

      .pi-thread-message { padding-bottom: 32px; margin-bottom: 32px; border-bottom: 1px solid var(--border-soft); }
      .pi-thread-message:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

      .pi-reading-body { font-size: 16px; line-height: 1.8; color: var(--text-dim); }
      .pi-reading-body p { margin: 0 0 20px 0; }
      .pi-attachment-chip {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 10px 16px; margin-top: 10px;
        border: 1px solid var(--border);
        background: var(--panel);
        border-radius: 10px;
        font-size: 13px; color: var(--text-dim);
        font-family: 'JetBrains Mono', monospace;
      }
      .pi-attachment-chip svg { color: var(--primary); }

      .pi-reading-actions { display: flex; gap: 12px; margin-top: 40px; }
      .pi-reply-btn {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 20px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--panel);
        color: var(--text-dim);
        font-size: 14px; font-weight: 600;
        cursor: pointer;
        transition: border-color .12s ease, color .12s ease, background .12s ease, transform .12s ease;
      }
      .pi-reply-btn:hover { border-color: var(--primary-line); color: var(--text); background: var(--panel-2); transform: translateY(-1px); }

      /* ---------- Reading pane skeleton ---------- */
      @keyframes pi-shimmer {
        0% { background-position: -320px 0; }
        100% { background-position: 320px 0; }
      }
      .pi-skeleton-card { animation: pi-skel-fade-in .25s ease; }
      @keyframes pi-skel-fade-in {
        from { opacity: 0; } to { opacity: 1; }
      }

      .pi-skeleton-line, .pi-skeleton-avatar, .pi-skeleton-pill, .pi-skeleton-box {
        background: linear-gradient(
          90deg,
          var(--panel-2) 22%,
          var(--primary-soft) 45%,
          var(--panel-2) 68%
        );
        background-size: 480px 100%;
        animation: pi-shimmer 1.7s ease-in-out infinite;
        border-radius: 8px;
      }

      .pi-skeleton-header { margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px; }
      .pi-skeleton-line.title { height: 32px; width: 68%; border-radius: 10px; }
      .pi-skeleton-line.short { height: 14px; width: 26%; }
      .pi-skeleton-line.medium { height: 14px; width: 46%; }
      .pi-skeleton-line.wide { height: 14px; width: 92%; }
      .pi-skeleton-line.full { height: 14px; width: 100%; }
      .pi-skeleton-line.button { height: 42px; width: 120px; border-radius: 10px; }

      .pi-skeleton-row { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
      .pi-skeleton-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
      .pi-skeleton-row-body { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }

      .pi-skeleton-chips { display: flex; gap: 12px; margin-bottom: 28px; }
      .pi-skeleton-pill { height: 34px; width: 180px; border-radius: 10px; }
      .pi-skeleton-pill.small { width: 100px; }

      .pi-skeleton-box.content { height: 100px; width: 100%; border-radius: 10px; margin-bottom: 24px; }

      .pi-skeleton-group { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }

      .pi-skeleton-actions { display: flex; gap: 12px; }

      /* ---------- List item skeleton ---------- */
      .pi-list-skeleton { padding-top: 4px; animation: pi-skel-fade-in .2s ease; }
      .pi-row-skeleton { cursor: default; }
      .pi-row-skeleton:hover { background: transparent; }
      .pi-row-skeleton .sk-name { height: 14px; width: 120px; }
      .pi-row-skeleton .sk-time { height: 12px; width: 44px; }
      .pi-row-skeleton .sk-subject { height: 14px; width: 74%; margin: 6px 0 6px 0; }
      .pi-row-skeleton .sk-preview { height: 12px; width: 88%; }

      /* ---------- Compose window ---------- */
      .pi-compose {
        position: absolute;
        bottom: 0px;
        right: 32px;
        width: 480px;
        height: 540px;
        min-width: 360px;
        min-height: 48px;
        max-width: 94vw;
        max-height: 88vh;
        background: var(--panel);
        border: 1px solid var(--border);
        border-bottom: none;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -16px 48px -12px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        z-index: 40;
        resize: both;
        overflow: hidden;
      }
      .pi-compose-min { height: 48px !important; min-height: 48px; cursor: pointer; resize: none; }
      .pi-compose-max {
        width: 800px !important;
        height: 84vh !important;
        right: 50%;
        transform: translateX(50%);
        resize: none;
      }
      .pi-compose-fullscreen {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        transform: none !important;
        resize: none !important;
        z-index: 90;
      }
      .pi-compose-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-soft);
        background: var(--panel-2);
        border-radius: 16px 16px 0 0;
        flex-shrink: 0;
        user-select: none;
      }
      .pi-compose-title {
        font-size: 14px; font-weight: 600; color: var(--text);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .pi-compose-header-actions { display: flex; gap: 6px; }
      .pi-compose-body { display: flex; flex-direction: column; padding: 8px 20px 0 20px; flex: 1; min-height: 0; overflow: hidden; }
      .pi-compose-main { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
      .pi-compose-editor-area { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; margin-top: 8px; }
      .pi-rich-text-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
      .pi-rich-editable { flex: 1; min-height: 0; overflow-y: auto; max-height: none; padding: 8px; border: 1px solid var(--border-soft); border-radius: 12px; background: var(--panel); }
      .pi-rich-editable a,
      .pi-reading-body a,
      .pi-compose-body a {
        color: var(--primary);
        text-decoration: underline;
      }
      .pi-rich-editable a:hover,
      .pi-reading-body a:hover,
      .pi-compose-body a:hover {
        color: var(--primary-bright);
      }
      .pi-compose-footer { display: flex; flex-direction: column; gap: 12px; padding: 14px 0 8px; flex-shrink: 0; }
      .pi-compose-field { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); }
      .pi-compose-field span { font-size: 13px; color: var(--text-faint); width: 56px; flex-shrink: 0; font-weight: 500; }
      .pi-compose-field input {
        flex: 1; background: none; border: none; outline: none;
        color: var(--text); font-size: 15px; font-family: 'Inter', sans-serif;
      }
      .pi-compose-field input::placeholder { color: var(--text-faint); }

      /* ---------- From provider select ---------- */
      .pi-from-field { position: relative; }
      .pi-from-select { position: relative; flex: 1; min-width: 0; }
      .pi-from-select-button {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        width: 100%; background: none; border: none; cursor: pointer; padding: 6px 6px;
        border-radius: 8px; transition: background .12s ease;
      }
      .pi-from-select-button:hover { background: var(--panel-2); }
      .pi-from-select-button svg { color: var(--text-faint); flex-shrink: 0; }
      .pi-from-select-preview { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .pi-from-badge, .pi-from-item-badge {
        width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.95);
        text-transform: uppercase; font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, #4a556b, #7d8fb0);
      }
      .pi-from-select-text { min-width: 0; }
      .pi-from-select-email {
        font-size: 13px; color: var(--text); font-family: 'JetBrains Mono', monospace;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-from-select-menu {
        position: absolute; top: calc(100% + 8px); left: 0; right: 0;
        background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
        box-shadow: 0 16px 40px -12px rgba(0,0,0,0.15); padding: 8px; z-index: 60;
        max-height: 240px; overflow-y: auto;
      }
      .pi-from-select-item {
        display: flex; align-items: center; gap: 12px; width: 100%;
        padding: 10px 12px; border-radius: 10px; border: none; background: none;
        cursor: pointer; text-align: left; transition: background .1s ease;
      }
      .pi-from-select-item:hover { background: var(--panel-2); }
      .pi-from-select-item.active { background: var(--primary-soft); }
      .pi-from-item-info { flex: 1; min-width: 0; }
      .pi-from-item-label {
        font-size: 14px; font-weight: 600; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-from-item-email {
        font-size: 12px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-from-item-selected {
        flex-shrink: 0; font-size: 10px; font-weight: 600; color: var(--primary);
        text-transform: uppercase; letter-spacing: .04em;
        margin-right: 8px;
      }

      /* ---------- To autocomplete ---------- */
      .pi-to-field { position: relative; }
      .pi-to-autocomplete { position: relative; flex: 1; min-width: 0; }
      .pi-to-suggestion-list {
        position: absolute; top: calc(100% + 8px); left: 0; right: 0;
        background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
        box-shadow: 0 16px 40px -12px rgba(0,0,0,0.15); padding: 8px; z-index: 60;
        max-height: 220px; overflow-y: auto;
      }
      .pi-to-suggestion-item {
        display: flex; flex-direction: column; gap: 4px; width: 100%;
        padding: 10px 12px; border-radius: 10px; border: none; background: none;
        cursor: pointer; text-align: left; transition: background .1s ease;
      }
      .pi-to-suggestion-item:hover { background: var(--panel-2); }
      .pi-to-suggestion-content { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .pi-to-suggestion-name {
        font-size: 14px; font-weight: 600; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-to-suggestion-email {
        font-size: 12px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace;
        flex-shrink: 0;
      }
      .pi-to-suggestion-subject {
        font-size: 12px; color: var(--text-faint);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      /* ---------- Attachment cards ---------- */
      .pi-compose-attachments { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
      .pi-compose-attachment-card {
        display: flex; align-items: center; gap: 14px; padding: 12px 14px;
        background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: 10px;
      }
      .pi-attachment-icon-wrap { flex-shrink: 0; }
      .pi-attachment-icon {
        width: 40px; height: 40px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        background: var(--primary-soft); color: var(--primary);
        font-size: 11px; font-weight: 700; letter-spacing: .02em;
      }
      .pi-attachment-body { flex: 1; min-width: 0; }
      .pi-attachment-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .pi-attachment-name {
        font-size: 13px; font-weight: 600; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-attachment-status { font-size: 11px; color: var(--primary); flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }
      .pi-attachment-meta { display: flex; gap: 8px; margin-top: 4px; }
      .pi-attachment-size, .pi-attachment-mime { font-size: 11px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; }
      .pi-attachment-actions { flex-shrink: 0; }

      /* ---------- Compose email preview ---------- */
      .pi-compose-preview { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 8px 4px 0 4px; overflow-y: auto; }
      .pi-compose-preview-meta { display: flex; flex-direction: column; gap: 12px; margin-bottom: 6px; }
      .pi-compose-preview-row {
        display: flex; align-items: baseline; gap: 14px; font-size: 13px;
        padding-bottom: 12px; border-bottom: 1px solid var(--border-soft);
      }
      .pi-compose-preview-row span { width: 56px; flex-shrink: 0; color: var(--text-faint); }
      .pi-compose-preview-row strong {
        font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .pi-compose-preview-body { flex: 1; min-height: 80px; }
      .pi-compose-preview-empty { color: var(--text-faint); font-style: italic; }
      .pi-compose-preview-attachments { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .pi-compose-preview-note { font-size: 12px; color: var(--text-faint); font-style: italic; }

      .pi-compose-textarea {
        margin-top: 14px;
        background: none; border: none; outline: none; resize: none;
        color: var(--text); font-size: 16px; line-height: 1.8;
        font-family: 'Inter', sans-serif;
        min-height: 180px;
      }
      .pi-compose-textarea-grow { flex: 1; max-height: none; }
      .pi-compose-textarea::placeholder { color: var(--text-faint); }
      .pi-compose-toolbar {
        display: flex; align-items: center; justify-content: space-between;
        padding-top: 14px; border-top: 1px solid var(--border-soft);
        flex-shrink: 0;
        font-size: 14px;
      }
      .pi-compose-format { display: flex; align-items: center; gap: 4px; position: relative; }
      .pi-tpl-anchor { position: relative; }

      .pi-compose-template-banner {
        display: flex; align-items: center; justify-content: space-between;
        gap: 14px; padding: 12px 16px; margin-top: 10px;
        background: var(--primary-soft); border: 1px solid var(--primary-line);
        border-radius: 10px; font-size: 13px; color: var(--text-dim);
      }
      .pi-compose-template-banner strong { color: var(--primary); font-weight: 600; }
      .pi-link-button {
        background: none; border: none; cursor: pointer; padding: 0;
        font-size: 12px; font-weight: 600; color: var(--primary);
        text-decoration: underline; text-underline-offset: 2px;
      }
      .pi-link-button:hover { color: var(--text); }

      .pi-tpl-picker {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 0;
        width: 340px;
        max-height: 400px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 -20px 56px -16px rgba(0,0,0,0.15);
        z-index: 70;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .pi-tpl-picker-search {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 18px; border-bottom: 1px solid var(--border-soft);
        flex-shrink: 0;
      }
      .pi-tpl-picker-search svg { color: var(--text-faint); flex-shrink: 0; }
      .pi-tpl-picker-search input {
        flex: 1; background: none; border: none; outline: none;
        color: var(--text); font-size: 14px; font-family: 'Inter', sans-serif;
      }
      .pi-tpl-picker-search input::placeholder { color: var(--text-faint); }

      .pi-tpl-picker-list { overflow-y: auto; padding: 10px; }
      .pi-tpl-picker-item {
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
        width: 100%; padding: 14px 16px; border-radius: 12px;
        border: none; background: none; cursor: pointer; text-align: left;
        transition: background .1s ease;
      }
      .pi-tpl-picker-item:hover { background: var(--panel-2); }
      .pi-tpl-picker-item-main { min-width: 0; }
      .pi-tpl-picker-item-name {
        font-size: 14px; font-weight: 600; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-tpl-picker-item-subject {
        font-size: 12px; color: var(--text-faint); margin-top: 4px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-tpl-picker-item-badge {
        flex-shrink: 0; font-size: 11px; padding: 4px 10px; border-radius: 999px;
        background: var(--primary-soft); color: var(--primary);
        font-family: 'JetBrains Mono', monospace;
      }
      .pi-tpl-picker-empty {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        padding: 32px 20px; color: var(--text-faint); text-align: center; font-size: 13px;
      }
      .pi-tpl-picker-empty svg { color: var(--border); }

      .pi-tpl-picker-detail { padding: 8px 0 18px 0; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
      .pi-tpl-picker-detail-header {
        display: flex; align-items: center; gap: 12px; padding: 10px 14px 16px 14px;
        border-bottom: 1px solid var(--border-soft); flex-shrink: 0;
      }
      .pi-tpl-picker-detail-title {
        flex: 1; font-size: 14px; font-weight: 600; color: var(--text);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .pi-tpl-picker-detail-subject { font-size: 13px; color: var(--text-dim); padding: 0 18px; }
      .pi-tpl-picker-vars { display: flex; flex-direction: column; gap: 16px; padding: 0 18px; }
      .pi-tpl-picker-var-row { display: flex; flex-direction: column; gap: 6px; }
      .pi-tpl-picker-var-label { font-size: 11px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; }
      .pi-tpl-picker-var-input-wrap { display: flex; align-items: center; gap: 8px; }
      .pi-tpl-picker-var-input-wrap input {
        flex: 1; background: var(--panel-2); border: 1px solid var(--border-soft);
        border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none;
      }
      .pi-tpl-picker-var-input-wrap input:focus { border-color: var(--primary-line); }

      .pi-tpl-picker-apply {
        margin: 6px 18px 0 18px; display: flex; align-items: center; justify-content: center; gap: 12px;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white; border: none; border-radius: 10px; padding: 12px 0;
        font-size: 14px; font-weight: 600; cursor: pointer;
      }
      .pi-tpl-picker-apply:disabled { opacity: .5; cursor: not-allowed; }

      /* ---------- Quick merge-field popover ---------- */
      .pi-qfp { position: relative; flex-shrink: 0; }
      .pi-qfp-menu {
        position: absolute; bottom: calc(100% + 10px); right: 0; width: 240px;
        background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
        box-shadow: 0 -16px 40px -12px rgba(0,0,0,0.15); padding: 8px; z-index: 80;
      }
      .pi-qfp-item {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        width: 100%; padding: 8px 10px; border-radius: 8px; border: none;
        background: none; cursor: pointer; text-align: left;
      }
      .pi-qfp-item:hover { background: var(--panel-2); }
      .pi-qfp-item span:first-child { font-size: 12px; color: var(--text-dim); }
      .pi-qfp-token { font-size: 11px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; }

      .pi-toolbar-divider { width: 1px; height: 18px; background: var(--border); margin: 0 8px; }
      .pi-send-btn {
        display: flex; align-items: center; gap: 10px;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white; border: none; border-radius: 10px;
        padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
        transition: transform .12s ease, box-shadow .12s ease;
      }
      .pi-send-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -8px rgba(99, 102, 241, 0.4); }
      .pi-send-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }

      /* ---------- Toast ---------- */
      .pi-toast {
        position: absolute;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--panel);
        border: 1px solid var(--primary-line);
        color: var(--text);
        padding: 14px 24px;
        border-radius: 12px;
        font-size: 14px;
        display: flex; align-items: center; gap: 12px;
        box-shadow: 0 12px 40px -12px rgba(0,0,0,0.2);
        z-index: 50;
        animation: pi-toast-in .22s ease;
      }
      .pi-toast svg { color: var(--primary); }
      @keyframes pi-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* scrollbars */
      .pi-list-scroll::-webkit-scrollbar, .pi-reading-scroll::-webkit-scrollbar { width: 10px; }
      .pi-list-scroll::-webkit-scrollbar-thumb, .pi-reading-scroll::-webkit-scrollbar-thumb {
        background: var(--border); border-radius: 10px;
      }
      .pi-list-scroll::-webkit-scrollbar-thumb:hover, .pi-reading-scroll::-webkit-scrollbar-thumb:hover {
        background: var(--panel-3);
      }
      .pi-list-scroll::-webkit-scrollbar-track, .pi-reading-scroll::-webkit-scrollbar-track { background: transparent; }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* ---------- Add Tag Modal ---------- */
      .pi-add-tag-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 110;
        padding: 20px;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .pi-add-tag-modal {
        width: min(520px, 100%);
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: 24px;
        padding: 26px;
        box-shadow: 0 36px 100px rgba(15, 23, 42, 0.2);
        max-height: 90vh;
        overflow-y: auto;
      }
      .pi-add-tag-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }
      .pi-add-tag-modal-title-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .pi-add-tag-modal-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.2;
      }
      .pi-add-tag-modal-subtitle {
        font-size: 13px;
        color: var(--text-faint);
        margin-top: 4px;
      }
      .pi-add-tag-modal-body {
        margin-bottom: 26px;
      }
      .pi-add-tag-modal-section {
        margin-bottom: 16px;
      }
      .pi-add-tag-modal-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-dim);
        margin-bottom: 8px;
        display: block;
      }
      .pi-add-tag-modal-input {
        width: 100%;
        padding: 12px 14px;
        background: var(--panel-2);
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        color: var(--text);
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .pi-add-tag-modal-input:focus {
        border-color: var(--primary-line);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }
      .pi-add-tag-modal-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .pi-add-tag-modal-input-count {
        font-size: 11px;
        color: var(--text-faint);
        text-align: right;
        margin-top: 6px;
      }
      .pi-add-tag-modal-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pi-add-tag-modal-tag {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.12s ease;
        border: 1px solid var(--border-soft);
        background: var(--panel-2);
        color: var(--text-dim);
      }
      .pi-add-tag-modal-tag:hover {
        background: var(--primary-soft);
        border-color: var(--primary-line);
        color: var(--primary);
      }
      .pi-add-tag-modal-tag.selected {
        background: var(--primary-soft);
        border-color: var(--primary-line);
        color: var(--primary);
      }
      .pi-add-tag-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .pi-add-tag-modal-primary-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .pi-add-tag-modal-primary-btn:hover:enabled {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px -8px rgba(99, 102, 241, 0.4);
      }
      .pi-add-tag-modal-primary-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      /* ---------- Send Options Modal ---------- */
      .pi-som-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pi-som-fade-in .18s ease;
      }
      @keyframes pi-som-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      .pi-som {
        width: 460px;
        max-width: 94vw;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 32px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(99,102,241,0.06);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: pi-som-slide-up .22s cubic-bezier(.22,1,.36,1);
        font-family: 'Inter', system-ui, sans-serif;
      }
      @keyframes pi-som-slide-up {
        from { opacity: 0; transform: translateY(16px) scale(.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      .pi-som-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 20px 20px 16px 20px;
        background: linear-gradient(135deg, var(--panel-2) 0%, rgba(99,102,241,.04) 100%);
        border-bottom: 1px solid var(--border-soft);
      }
      .pi-som-header-inner {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .pi-som-icon-ring {
        width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        display: flex; align-items: center; justify-content: center;
        color: #fff;
        box-shadow: 0 6px 18px -6px rgba(99,102,241,.4);
      }
      .pi-som-title {
        font-size: 16px; font-weight: 700; color: var(--text); line-height: 1.2;
      }
      .pi-som-subtitle {
        font-size: 12px; color: var(--text-faint); margin-top: 3px;
        font-family: 'JetBrains Mono', monospace;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 300px;
      }
      .pi-som-subtitle span { color: var(--text-dim); }

      .pi-som-tabs {
        display: flex;
        gap: 4px;
        padding: 14px 20px 0;
        background: var(--panel);
      }
      .pi-som-tab {
        display: flex; align-items: center; gap: 7px;
        padding: 9px 16px; border-radius: 10px; border: 1px solid transparent;
        font-size: 13px; font-weight: 500; cursor: pointer;
        color: var(--text-faint);
        background: none;
        transition: color .14s, background .14s, border-color .14s;
        font-family: 'Inter', sans-serif;
      }
      .pi-som-tab:hover { color: var(--text); background: var(--panel-2); }
      .pi-som-tab.active {
        color: var(--primary);
        background: var(--primary-soft);
        border-color: var(--primary-line);
      }
      .pi-som-tab svg { flex-shrink: 0; }

      .pi-som-body { padding: 20px; }
      .pi-som-now-panel {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 20px 22px;
        background: var(--panel-2);
        border: 1px solid var(--border-soft);
        border-radius: 14px;
      }
      .pi-som-now-icon {
        width: 60px; height: 60px; border-radius: 16px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, rgba(251,191,36,.12), rgba(251,191,36,.04));
        border: 1px solid rgba(251,191,36,.15);
        color: #f59e0b;
      }
      .pi-som-now-copy { flex: 1; }
      .pi-som-now-copy strong {
        display: block; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 6px;
      }
      .pi-som-now-copy p { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0; }
      .pi-som-now-copy em { color: var(--primary); font-style: normal; font-weight: 600; }

      .pi-som-later-panel { display: flex; flex-direction: column; gap: 16px; }
      .pi-som-later-hint {
        font-size: 13px; color: var(--text-faint); line-height: 1.6; margin: 0;
        padding: 14px 16px; background: var(--panel-2); border-radius: 10px;
        border-left: 3px solid var(--primary);
      }

      .pi-som-field {
        display: flex; align-items: center; gap: 14px;
      }
      .pi-som-label {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 600; color: var(--text-faint);
        width: 80px; flex-shrink: 0; text-transform: uppercase; letter-spacing: .04em;
      }
      .pi-som-label svg { flex-shrink: 0; }
      .pi-som-input {
        flex: 1; background: var(--panel-2); border: 1px solid var(--border-soft);
        border-radius: 10px; padding: 10px 14px;
        color: var(--text); font-size: 14px; font-family: 'Inter', sans-serif;
        outline: none; transition: border-color .14s, box-shadow .14s;
        color-scheme: light;
      }
      .pi-som-input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }

      .pi-som-tz-anchor { position: relative; flex: 1; }
      .pi-som-tz-btn {
        width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
        background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: 10px;
        padding: 10px 14px; cursor: pointer; font-family: 'Inter', sans-serif;
        transition: border-color .14s, box-shadow .14s;
        text-align: left;
      }
      .pi-som-tz-btn:hover { border-color: var(--border); }
      .pi-som-tz-btn svg { color: var(--text-faint); flex-shrink: 0; transition: transform .15s; }
      .pi-som-tz-btn svg.open { transform: rotate(180deg); }
      .pi-som-tz-label {
        font-size: 13px; color: var(--text); flex: 1; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-som-tz-menu {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 60;
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 14px; box-shadow: 0 20px 48px -12px rgba(0,0,0,.15);
        overflow: hidden;
        animation: pi-som-fade-in .14s ease;
      }
      .pi-som-tz-search-wrap {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px; border-bottom: 1px solid var(--border-soft);
        color: var(--text-faint);
      }
      .pi-som-tz-search {
        flex: 1; background: none; border: none; outline: none;
        color: var(--text); font-size: 13px; font-family: 'Inter', sans-serif;
      }
      .pi-som-tz-search::placeholder { color: var(--text-faint); }
      .pi-som-tz-list { max-height: 200px; overflow-y: auto; padding: 6px; }
      .pi-som-tz-item {
        display: block; width: 100%; text-align: left;
        padding: 9px 12px; border-radius: 8px; border: none; background: none;
        cursor: pointer; font-size: 13px; color: var(--text-dim);
        font-family: 'Inter', sans-serif;
        transition: background .1s, color .1s;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pi-som-tz-item:hover { background: var(--panel-3); color: var(--text); }
      .pi-som-tz-item.active {
        background: var(--primary-soft); color: var(--primary); font-weight: 600;
      }
      .pi-som-tz-empty { padding: 16px; text-align: center; color: var(--text-faint); font-size: 13px; }

      .pi-som-footer {
        display: flex; align-items: center; justify-content: flex-end; gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid var(--border-soft);
        background: var(--panel);
      }

      .pi-som-schedule-btn {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white; border: none; border-radius: 10px;
        padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
        transition: transform .12s ease, box-shadow .12s ease;
        font-family: 'Inter', sans-serif;
      }
      .pi-som-schedule-btn:hover:enabled {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px -8px rgba(16, 185, 129, 0.4);
      }
      .pi-som-schedule-btn:disabled {
        opacity: .45; cursor: not-allowed; transform: none; box-shadow: none;
      }

      .pi-secondary-btn {
        display: flex; align-items: center; gap: 6px;
        background: var(--panel-2); color: var(--text-dim);
        border: 1px solid var(--border-soft); border-radius: 10px;
        padding: 10px 18px; font-size: 14px; font-weight: 500; cursor: pointer;
        transition: background .12s, border-color .12s;
        font-family: 'Inter', sans-serif;
      }
      .pi-secondary-btn:hover { background: var(--panel-3); border-color: var(--border); color: var(--text); }

      /* ---------- Filter Modal ---------- */
      .pi-filter-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 110;
        padding: 20px;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .pi-filter-modal {
        width: min(480px, 100%);
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: 24px;
        padding: 26px;
        box-shadow: 0 36px 100px rgba(15, 23, 42, 0.2);
        overflow: visible;
      }
      .pi-filter-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 22px;
      }
      .pi-filter-modal-header-inner {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pi-filter-modal-icon-ring {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--primary-soft);
        color: var(--primary);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pi-filter-modal-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.2;
      }
      .pi-filter-modal-subtitle {
        font-size: 12px;
        color: var(--text-faint);
        margin-top: 4px;
      }
      .pi-filter-modal-body {
        margin-bottom: 26px;
      }
      .pi-filter-modal-section {
        margin-bottom: 18px;
      }
      .pi-filter-modal-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-dim);
        margin-bottom: 10px;
        display: flex;
        align-items: center;
      }
      .pi-filter-modal-select-wrapper {
        position: relative;
        width: 100%;
      }
      .pi-filter-modal-custom-select-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        background: var(--panel-2);
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        color: var(--text);
        font-size: 14px;
        font-family: 'Inter', sans-serif;
        cursor: pointer;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        text-align: left;
      }
      .pi-filter-modal-custom-select-btn:hover {
        border-color: var(--border);
      }
      .pi-filter-modal-custom-select-btn:focus {
        border-color: var(--primary-line);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }
      .pi-filter-modal-custom-select-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .pi-filter-modal-agent-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .pi-filter-modal-agent-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pi-filter-modal-custom-menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 16px 40px -12px rgba(0,0,0,0.15);
        padding: 6px;
        z-index: 60;
        max-height: 220px;
        overflow-y: auto;
      }
      .pi-filter-modal-custom-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: none;
        background: none;
        cursor: pointer;
        text-align: left;
        transition: background .1s ease, color .1s ease;
      }
      .pi-filter-modal-custom-item:hover {
        background: var(--panel-2);
      }
      .pi-filter-modal-custom-item.active {
        background: var(--primary-soft);
      }
      .pi-filter-modal-item-info {
        flex: 1;
        min-width: 0;
      }
      .pi-filter-modal-item-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pi-filter-modal-item-email {
        font-size: 11px;
        color: var(--text-faint);
        font-family: 'JetBrains Mono', monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pi-filter-modal-item-check {
        color: var(--primary);
        flex-shrink: 0;
      }
      .pi-filter-modal-active-box {
        background: var(--panel-2);
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        padding: 14px;
        margin-top: 16px;
      }
      .pi-filter-modal-active-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-faint);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .pi-filter-modal-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        width: 100%;
      }
      .pi-filter-modal-primary-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, var(--primary-bright), var(--primary));
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .pi-filter-modal-primary-btn:hover:enabled {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px -8px rgba(99, 102, 241, 0.4);
      }
      .pi-filter-modal-primary-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 1024px) {
        .pi-sidebar { width: var(--sidebar-collapsed-width); padding: 20px 8px; }
        .pi-logo-text, .pi-compose-launch span, .pi-nav-label, .pi-nav-count { display: none; }
        .pi-compose-launch { padding: 14px 0; }
        .pi-nav-item { justify-content: center; padding: 12px 0; }
        .pi-listcol { width: 360px; }
        .pi-compose { width: 92vw; right: 4vw; }
      }
      @media (max-width: 768px) {
        .pi-listcol { width: 100%; }
        .pi-reading { display: none; }
        .pi-sidebar { position: absolute; left: 0; top: 0; bottom: 0; z-index: 20; }
        .pi-root.mobile-sidebar-open .pi-sidebar { width: var(--sidebar-width); padding: 20px 16px; }
        .pi-root.mobile-sidebar-open .pi-logo-text,
        .pi-root.mobile-sidebar-open .pi-compose-launch span,
        .pi-root.mobile-sidebar-open .pi-nav-label,
        .pi-root.mobile-sidebar-open .pi-nav-count { display: flex; }
        .pi-root.mobile-sidebar-open .pi-compose-launch { padding: 12px 0; }
        .pi-root.mobile-sidebar-open .pi-nav-item { justify-content: flex-start; padding: 10px 12px; }
      }
    `}</style>
  );
}
