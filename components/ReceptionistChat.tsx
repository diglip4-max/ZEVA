import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Sparkles,
  User,
  Users,
  FileText,
  Package,
  CalendarPlus,
  Search,
  Download,
  Loader2,
  Check,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppointmentAccordion, {
  AppointmentListBlock,
} from "./Appointmentaccordion";
import BillingAccordion, { BillingListBlock } from "./BillingAccordion";

const BotFace: React.FC<{ size?: number; color?: string }> = ({
  size = 19,
  color = "#ffffff",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* antenna */}
    <path d="M12 8V4H8" />
    {/* head */}
    <rect x="4" y="8" width="16" height="12" rx="2" />
    {/* side ears */}
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    {/* eyes — these blink */}
    <g
      className="fd-bot-eyes"
      style={{ transformOrigin: "center", transformBox: "fill-box" }}
    >
      <line x1="9" y1="13" x2="9" y2="15" />
      <line x1="15" y1="13" x2="15" y2="15" />
    </g>
  </svg>
);
type ListBlock = AppointmentListBlock | BillingListBlock;
const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// ─── Export payload the backend attaches to a turn when a tool produced
// list-shaped, downloadable data (billing rows, patient matches, etc). ────
interface ExportBlock {
  kind: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  export?: ExportBlock | null;
  listBlock?: ListBlock | null;
  /** true while this assistant message is still receiving streamed tokens */
  streaming?: boolean;
}
interface ReceptionistChatProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// ─── DESIGN TOKENS — "KAKA" system. Warm boutique-clinic palette:
// cream paper surfaces, burnt-coral primary, sage for success. Deliberately
// light, never dark mode. ─────────────────────────────────────────────────
const T = {
  bg: "#FBF6F0",
  bgGrain: "#F5EEE5",
  panel: "#FFFFFF",
  panelAlt: "#FBF7F2",
  border: "#E8DDD0",
  borderSoft: "rgba(28,25,23,0.08)",
  text: "#1C1917",
  textSoft: "#3A332C",
  textMute: "#8A7F76",

  coral: "#C2452D",
  coralDark: "#A63A25",
  coralLight: "#E8674A",
  coralBg: "rgba(194,69,45,0.09)",
  coralBgStrong: "rgba(194,69,45,0.14)",
  coralBorder: "rgba(194,69,45,0.28)",

  gold: "#B8873F",
  goldBg: "rgba(184,135,63,0.12)",
  goldBorder: "rgba(184,135,63,0.32)",

  sage: "#2F6B4F",
  sageBg: "rgba(47,107,79,0.10)",
  sageBorder: "rgba(47,107,79,0.28)",

  rust: "#A6392A",
  rustBg: "rgba(166,57,42,0.09)",
  rustBorder: "rgba(166,57,42,0.28)",

  shadow: "0 2px 4px rgba(28,25,23,0.06), 0 20px 48px rgba(28,25,23,0.16)",
  shadowSm: "0 1px 2px rgba(28,25,23,0.05), 0 3px 10px rgba(28,25,23,0.07)",
  shadowLift: "0 6px 20px rgba(194,69,45,0.22)",
};

const DISPLAY_FONT = "'Fraunces', Georgia, 'Times New Roman', serif";
const BODY_FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// const MARKER_LINE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const MARKER_TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

const KNOWN_HEADERS: Record<string, string[]> = {
  PACKAGES: ["Package", "Treatments", "Price", "Validity"],
  BILLING: ["Patient", "Invoice/Date", "Amount", "Status"],
  PATIENTS: ["Name", "Phone"],
  PATIENT_LIST: ["Name", "Phone"],
  DOCTORS_LIST: ["Doctor"],
  BOOKING_CONFIRM_START: ["Field", "Value"],
  REGISTER_CONFIRM_START: ["Field", "Value"],
  RESCHEDULE_CONFIRM_START: ["Field", "Value"],
  SERVICES_SUMMARY_START: ["Department", "Count"],
  SERVICES_DETAIL_START: ["Service", "Price", "Duration"],
};

interface TextSegment {
  type: "text";
  content: string;
}
interface TableSegment {
  type: "table";
  header: string[];
  rows: string[][];
}
type ContentSegment = TextSegment | TableSegment;

// Matches a markdown table separator line, e.g. "|---|:---:|---|" or
// "-----------|-------------" (with or without leading/trailing pipes).
const MD_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function splitPipeRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// True markdown pipe tables: a header line, a "---|---" separator line,
// then data lines. Distinguished from the bullet-row format by the
// presence of that separator line.
function extractMarkdownTableRows(body: string): string[][] | null {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes("|"));

  if (lines.length < 2) return null;

  const sepIdx = lines.findIndex((l) => MD_SEPARATOR_RE.test(l));
  if (sepIdx === -1) return null; // no header separator → not a pipe table

  const headerLine = lines[sepIdx - 1];
  const rows = lines
    .filter((l, idx) => idx !== sepIdx && l !== headerLine)
    .map(splitPipeRow)
    .filter((r) => r.length > 0);

  return rows.length > 0 ? rows : null;
}
function extractRows(body: string): string[][] {
  const clean = body.replace(/\*\*(.*?)\*\*/g, "$1"); // strip bold markers

  // Try markdown pipe-table format first (header + "---" separator row).
  const mdRows = extractMarkdownTableRows(clean);
  if (mdRows) return mdRows;

  // Fall back to the bullet-row format: "- Field | Value" per line.
  const parts = clean
    .split(/\s+[-*]\s+(?=[^|]*\|)/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts
    .filter((p) => p.includes("|"))
    .map((p) =>
      p
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    );
}
function parseAgentContent(raw: string): ContentSegment[] {
  if (!raw) return [{ type: "text", content: raw }];

  const segments: ContentSegment[] = [];
  const blockRe = /([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)_START([\s\S]*?)\1_END/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const pushText = (chunk: string) => {
    const cleaned = chunk
      .replace(MARKER_TOKEN_RE, "")
      // Collapse horizontal whitespace runs (spaces/tabs) but never touch
      // newlines — markdown block structure (lists, paragraphs) depends on them.
      .replace(/[ \t]{2,}/g, " ")
      // Trim trailing horizontal whitespace on each line, and collapse 3+
      // consecutive blank lines down to a max of one blank line (cosmetic only).
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleaned.length > 0) segments.push({ type: "text", content: cleaned });
  };

  while ((m = blockRe.exec(raw)) !== null) {
    pushText(raw.slice(lastIndex, m.index));

    const marker = m[1];
    const body = m[2];
    const rows = extractRows(body);

    if (rows.length > 0) {
      const colCount = Math.max(...rows.map((r) => r.length));
      const known = KNOWN_HEADERS[marker];
      const header =
        known && known.length === colCount
          ? known
          : Array.from({ length: colCount }, (_, idx) => `Col ${idx + 1}`);
      const dataRows = rows.map((r) => {
        const padded = [...r];
        while (padded.length < colCount) padded.push("");
        return padded;
      });
      segments.push({ type: "table", header, rows: dataRows });
    } else {
      pushText(body);
    }

    lastIndex = blockRe.lastIndex;
  }

  pushText(raw.slice(lastIndex));

  return segments.length > 0 ? segments : [{ type: "text", content: raw }];
}

// Kept for any external callers expecting flattened text (e.g. plain
// error/success tone detection runs against joined text).
// function normalizeAgentContent(raw: string): string {
//   return parseAgentContent(raw)
//     .map((seg) => (seg.type === "text" ? seg.content : ""))
//     .join("\n\n")
//     .trim();
// }

const MarkdownComponents: React.ComponentProps<
  typeof ReactMarkdown
>["components"] = {
  h1: ({ children }) => (
    <h1
      style={{
        fontFamily: DISPLAY_FONT,
        fontSize: 16,
        fontWeight: 700,
        color: T.text,
        margin: "10px 0 5px",
        letterSpacing: "-0.2px",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: DISPLAY_FONT,
        fontSize: 14.5,
        fontWeight: 700,
        color: T.text,
        margin: "8px 0 4px",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: T.coral,
        margin: "6px 0 3px",
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        margin: "0 0 5px",
        fontSize: 13.5,
        lineHeight: 1.65,
        color: T.textSoft,
        fontWeight: 550,
      }}
    >
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 800, color: T.text }}>{children}</strong>
  ),
  hr: () => (
    <hr
      style={{
        border: "none",
        borderTop: `1px dashed ${T.border}`,
        margin: "10px 0",
      }}
    />
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "4px 0 6px", paddingLeft: 0, listStyle: "none" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "4px 0 6px", paddingLeft: 18 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 4,
        fontSize: 13.5,
        color: T.textSoft,
        fontWeight: 550,
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 6,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: T.coralLight,
          display: "inline-block",
        }}
      />
      <span>{children}</span>
    </li>
  ),
  table: ({ children }) => (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(28,25,23,0.05)",
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          tableLayout: "fixed",
        }}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead
      style={{
        background:
          "linear-gradient(180deg, rgba(194,69,45,0.09), rgba(194,69,45,0.05))",
      }}
    >
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr
      style={{
        borderBottom: `1px solid ${T.borderSoft}`,
      }}
      className="fd-row"
    >
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th
      style={{
        padding: "8px 8px",
        textAlign: "left",
        fontWeight: 800,
        fontSize: 9.5,
        color: T.coralDark,
        textTransform: "uppercase",
        letterSpacing: "0.4px",
        wordBreak: "break-word",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: "7px 8px",
        color: T.text,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.5,
        wordBreak: "break-word",
      }}
    >
      {children}
    </td>
  ),
  code: ({ children, className }: any) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre
        style={{
          background: "#241E1A",
          color: "#F0E8DE",
          borderRadius: 10,
          padding: "10px 13px",
          fontSize: 11,
          overflowX: "auto",
          margin: "6px 0",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <code>{children}</code>
      </pre>
    ) : (
      <code
        style={{
          background: T.coralBg,
          color: T.coralDark,
          fontSize: 12,
          padding: "1px 5px",
          borderRadius: 4,
        }}
      >
        {children}
      </code>
    );
  },
};
const StyledTable: React.FC<{ header: string[]; rows: string[][] }> = ({
  header,
  rows,
}) => {
  const colCount = header.length;

  const widths: string[] =
    colCount === 4
      ? ["20%", "38%", "21%", "21%"]
      : colCount === 3
        ? ["28%", "44%", "28%"]
        : colCount === 2
          ? ["50%", "50%"]
          : header.map(() => `${Math.floor(100 / colCount)}%`);

  const isStatusVal = (val: string) =>
    /^(paid|pending|confirmed|cancelled|booked|arrived|completed|no-show)$/i.test(
      (val || "").trim(),
    );
  const statusStyle = (val: string): React.CSSProperties => {
    const isPaid = /paid|confirmed/i.test(val);
    return isPaid
      ? { background: "#E4F1EA", color: "#1F4B37" }
      : { background: "#FBEBD5", color: "#7A5A28" };
  };

  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(28,25,23,0.05)",
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr
            style={{
              background:
                "linear-gradient(180deg, rgba(194,69,45,0.09), rgba(194,69,45,0.05))",
            }}
          >
            {header.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "8px 8px",
                  textAlign: i === 0 ? "left" : "left",
                  fontWeight: 800,
                  fontSize: 9.5,
                  color: T.coralDark,
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="fd-row"
              style={{
                borderTop: `1px solid ${T.borderSoft}`,
              }}
            >
              {row.map((cell, ci) => {
                const isFirst = ci === 0;
                const isLast = ci === colCount - 1;
                const value = cell || "\u2014";

                if (isLast && isStatusVal(value)) {
                  return (
                    <td key={ci} style={{ padding: "7px 8px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          whiteSpace: "nowrap",
                          ...statusStyle(value),
                        }}
                      >
                        {value}
                      </span>
                    </td>
                  );
                }

                return (
                  <td
                    key={ci}
                    style={{
                      padding: "7px 8px",
                      color: isFirst ? T.text : T.textSoft,
                      fontSize: isFirst ? 12.5 : 12,
                      fontWeight: isFirst ? 700 : 600,
                      fontFamily: "inherit",
                      lineHeight: 1.45,
                      wordBreak: "break-word",
                      fontVariantNumeric: isLast ? undefined : "tabular-nums",
                    }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
// ─── Paper-grain textured bubble — the tactile "premium stationery" feel ──
const TextBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: "4px 16px 16px 16px",
      padding: "11px 14px",
      boxShadow: T.shadowSm,
      position: "relative",
    }}
  >
    {children}
  </div>
);

const SkeletonBubble: React.FC = () => (
  <div
    style={{
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: "4px 16px 16px 16px",
      padding: "13px 15px",
      boxShadow: T.shadowSm,
      display: "flex",
      flexDirection: "column",
      gap: 7,
      minWidth: 160,
    }}
  >
    {["88%", "62%", "74%"].map((w, i) => (
      <div
        key={i}
        style={{
          height: 10,
          width: w,
          borderRadius: 5,
          background:
            "linear-gradient(90deg, #EFE5D8 25%, #FAF4EC 37%, #EFE5D8 63%)",
          backgroundSize: "400% 100%",
          animation: "fdShimmer 1.4s ease infinite",
        }}
      />
    ))}
  </div>
);

const isErrorContent = (c: string) =>
  /error|failed|missing|not found|went wrong/i.test(c) &&
  !/successfully|confirmed/i.test(c);

const isSuccessContent = (c: string) =>
  /successfully|confirmed|registered|booked|completed|rescheduled/i.test(c);

function isTabularExport(
  block: ExportBlock | null | undefined,
): block is ExportBlock {
  if (!block) return false;
  if (!Array.isArray(block.columns) || block.columns.length === 0) return false;
  if (!Array.isArray(block.rows) || block.rows.length === 0) return false;
  return block.rows.length >= 2 || block.columns.length >= 2;
}

function toCsv(block: ExportBlock): string {
  const isPhoneColumn = (column: string) => {
    const normalized = String(column ?? "").replace(/([a-z])([A-Z])/g, "$1_$2");

    return /(^|[\s_-])(phone|mobile|telephone|contact|whatsapp|tel)([\s_-]|$)/i.test(
      normalized,
    );
  };

  const escapeCell = (val: unknown, column = "") => {
    let s = val === null || val === undefined ? "" : String(val);

    // Prevent Excel from displaying phone numbers in scientific notation.
    if (s && isPhoneColumn(column)) {
      s = `="${s.replace(/"/g, '""')}"`;
    }

    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }

    return s;
  };

  const headerLine = block.columns.map((col) => escapeCell(col)).join(",");

  // Remove duplicate rows based on the visible CSV columns.
  const uniqueRows = Array.from(
    new Map(
      block.rows.map((row) => {
        const key = JSON.stringify(
          block.columns.map((col) => {
            const value = row[col];

            return value === null || value === undefined
              ? ""
              : String(value).trim();
          }),
        );

        return [key, row] as const;
      }),
    ).values(),
  );

  const dataLines = uniqueRows.map((row) =>
    block.columns.map((col) => escapeCell(row[col], col)).join(","),
  );

  return [headerLine, ...dataLines].join("\r\n");
}
function downloadCsv(block: ExportBlock) {
  const csv = toCsv(block);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${block.kind || "export"}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const DownloadCsvButton: React.FC<{ block: ExportBlock }> = ({ block }) => (
  <button
    onClick={() => downloadCsv(block)}
    className="fd-csv-btn"
    style={{
      marginTop: 9,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11.5,
      fontWeight: 700,
      color: T.coralDark,
      background: T.coralBg,
      border: `1px solid ${T.coralBorder}`,
      borderRadius: 8,
      padding: "6px 11px",
      cursor: "pointer",
    }}
    title={`Download ${block.rows.length} row(s) as CSV`}
  >
    <Download size={12} />
    Download
  </button>
);

const StatusBubble: React.FC<{
  content: string;
  exportBlock?: ExportBlock | null;
  listBlock?: ListBlock | null;
  streaming?: boolean;
}> = ({ content, exportBlock, listBlock, streaming }) => {
  const segments = parseAgentContent(content);

  // Only run tone detection against prose, never table/list data — a
  // "Booked"/"Confirmed" status value must never trigger the success bubble
  // meant for real action-result messages.
  const textOnly = segments
    .filter((seg) => seg.type === "text")
    .map((seg) => seg.content)
    .join(" ");

  const isError = !streaming && isErrorContent(textOnly);
  const isSuccess = !streaming && !isError && isSuccessContent(textOnly);
  const tone = isError
    ? { bg: T.rustBg, border: T.rustBorder, color: "#7A2A1E", icon: null }
    : isSuccess
      ? {
          bg: T.sageBg,
          border: T.sageBorder,
          color: "#1F4B37",
          icon: <Check size={13} />,
        }
      : null;

  const cursor = streaming ? (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 13,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        background: T.coralLight,
        animation: "fdCaretBlink 0.9s steps(1) infinite",
        borderRadius: 1,
      }}
    />
  ) : null;

  const renderSegments = (textColor?: string) =>
    segments.map((seg, idx) => {
      if (seg.type === "table") {
        if (seg.type === "table") {
          return <StyledTable key={idx} header={seg.header} rows={seg.rows} />;
        }
      }
      return (
        <ReactMarkdown
          key={idx}
          remarkPlugins={[remarkGfm]}
          components={
            textColor
              ? {
                  ...MarkdownComponents,
                  p: ({ children }) => (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        color: textColor,
                        fontWeight: 650,
                      }}
                    >
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ color: textColor, fontWeight: 800 }}>
                      {children}
                    </strong>
                  ),
                }
              : MarkdownComponents
          }
        >
          {seg.content || "\u00A0"}
        </ReactMarkdown>
      );
    });

  if (!tone) {
    return (
      <TextBubble>
        {segments.length > 0 ? renderSegments() : "\u00A0"}
        {cursor}
        {listBlock &&
          listBlock.items?.length > 0 &&
          (listBlock.kind === "billing" ? (
            <BillingAccordion block={listBlock} />
          ) : (
            <AppointmentAccordion block={listBlock} />
          ))}
        {isTabularExport(exportBlock) && (
          <DownloadCsvButton block={exportBlock} />
        )}
      </TextBubble>
    );
  }

  return (
    <div>
      <div
        className="fd-msg-in"
        style={{
          borderRadius: "4px 16px 16px 16px",
          border: `1px solid ${tone.border}`,
          background: tone.bg,
          boxShadow: T.shadowSm,
          padding: "12px 15px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {tone.icon && (
            <span
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: tone.color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
                animation: "fdPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              {tone.icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderSegments(tone.color)}
          </div>
        </div>
      </div>
      {listBlock &&
        listBlock.items?.length > 0 &&
        (listBlock.kind === "billing" ? (
          <BillingAccordion block={listBlock} />
        ) : (
          <AppointmentAccordion block={listBlock} />
        ))}
      {isTabularExport(exportBlock) && (
        <DownloadCsvButton block={exportBlock} />
      )}
    </div>
  );
};

// ─── ANIMATION TIMING ──────────────────────────────────────────────────
const DRAWER_MS = 340;

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Good day — I'm **KAKA**, your AI Receptionist Agent ✨\n\nHere to help with:\n- Search for or register a patient\n- Book an appointment\n- Look up billing info\n- Check available packages\n\nHow may I assist you?",
};

let persistentThreadId: string | null = null;

// Tool → icon + simple, direct status phrasing shown in the live receipt-style chip
const TOOL_META: Record<
  string,
  { label: string; verb: string; icon: React.ReactNode }
> = {
  fetch_billings_tool: {
    label: "Pulling up billing records",
    verb: "Fetching billing details…",
    icon: <FileText size={12} />,
  },
  fetch_packages_tool: {
    label: "Checking available packages",
    verb: "Fetching packages…",
    icon: <Package size={12} />,
  },
  get_clinic_services_tool: {
    label: "Looking up services",
    verb: "Looking up services…",
    icon: <Sparkles size={12} />,
  },
  find_doctors_for_treatment_tool: {
    label: "Finding available doctors",
    verb: "Finding available doctors…",
    icon: <Users size={12} />,
  },
  search_patient_tool: {
    label: "Searching patient records",
    verb: "Searching patients…",
    icon: <Search size={12} />,
  },
  register_patient_tool: {
    label: "Registering a patient",
    verb: "Registering a patient…",
    icon: <User size={12} />,
  },
  get_appointments_tool: {
    label: "Fetching appointments",
    verb: "Fetching appointments…",
    icon: <CalendarPlus size={12} />,
  },
  reschedule_appointment_tool: {
    label: "Rescheduling appointment",
    verb: "Rescheduling appointment…",
    icon: <CalendarPlus size={12} />,
  },
  book_appointment_tool: {
    label: "Booking appointment",
    verb: "Booking appointment…",
    icon: <CalendarPlus size={12} />,
  },
};

function describeTool(toolName: string): string {
  return TOOL_META[toolName]?.verb || "Working on it…";
}

const ReceptionistChat: React.FC<ReceptionistChatProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rafScrollRef = useRef<number | null>(null);

  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setEntered(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (rafScrollRef.current !== null) {
      cancelAnimationFrame(rafScrollRef.current);
    }
    rafScrollRef.current = requestAnimationFrame(() => {
      const isStreaming = messages[messages.length - 1]?.streaming;
      messagesEndRef.current?.scrollIntoView({
        behavior: isStreaming ? "auto" : "smooth",
      });
    });
    return () => {
      if (rafScrollRef.current !== null) {
        cancelAnimationFrame(rafScrollRef.current);
      }
    };
  }, [messages, toolStatus]);

  const handleClose = () => {
    setEntered(false);
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false); // <-- ADD THIS: reset closing after animating out
      onClose();
    }, DRAWER_MS);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const [threadId] = useState(() => {
    if (!persistentThreadId) persistentThreadId = uuidv4();
    return persistentThreadId;
  });

  useEffect(() => {
    if (!isOpen || historyLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${AGENT_URL}/receptionist/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId }),
        });
        if (!res.ok) throw new Error(`history fetch failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const restored: Message[] = Array.isArray(data?.messages)
          ? data.messages
          : [];
        setMessages(restored.length > 0 ? restored : [WELCOME_MESSAGE]);
      } catch {
        if (!cancelled) setMessages([WELCOME_MESSAGE]);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, historyLoaded, threadId]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !isOpen) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
  }, [input, isOpen]);

  const getClinicToken = () =>
    localStorage.getItem("agentToken") || localStorage.getItem("userToken");

  // Decodes a JWT's payload (base64url) without verifying the signature —
  // fine here since we're only reading userId for a request param, not
  // trusting this client-side value for anything security-sensitive
  // (the backend independently re-fetches permissions for whatever
  // agentId it's given).
  const decodeJwtPayload = (
    token: string | null,
  ): Record<string, any> | null => {
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        "=",
      );
      const json = decodeURIComponent(
        atob(padded)
          .split("")
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const getAgentId = (): string => {
    const token = getClinicToken();
    const payload = decodeJwtPayload(token);
    return payload?.userId || "";
  };
  const streamMessage = useCallback(
    async (trimmed: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true },
      ]);

      const clinicToken = getClinicToken();
      const agentId = getAgentId();
      let sawAnyToken = false;

      try {
        const response = await fetch(`${AGENT_URL}/receptionist/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: trimmed,
            threadId,
            clinicToken,
            agentId,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            let eventName = "message";
            let dataLine = "";
            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLine += line.slice(5).trim();
              }
            }
            if (!dataLine) continue;

            let payload: any;
            try {
              payload = JSON.parse(dataLine);
            } catch {
              continue;
            }

            if (eventName === "token" && typeof payload.text === "string") {
              sawAnyToken = true;
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: next[lastIdx].content + payload.text,
                  };
                }
                return next;
              });
            } else if (eventName === "tool_start") {
              setActiveToolName(payload.tool);
              setToolStatus(describeTool(payload.tool));
            } else if (eventName === "tool_end") {
              setToolStatus(null);
              setActiveToolName(null);
            } else if (eventName === "done") {
              setToolStatus(null);
              setActiveToolName(null);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    role: "assistant",
                    content:
                      typeof payload.response === "string" &&
                      payload.response.length > 0
                        ? payload.response
                        : next[lastIdx].content,
                    export: payload.export ?? null,
                    listBlock: payload.listBlock ?? null,
                    streaming: false,
                  };
                }
                return next;
              });
            } else if (eventName === "error") {
              throw new Error(payload.message || "stream error");
            }
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = { ...next[lastIdx], streaming: false };
          }
          return next;
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setToolStatus(null);
        setActiveToolName(null);

        if (sawAnyToken) {
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
              next[lastIdx] = { ...next[lastIdx], streaming: false };
            }
            return next;
          });
          return;
        }

        setMessages((prev) => prev.slice(0, -1));
        await sendMessageFallback(trimmed);
      }
    },
    [threadId],
  );

  const sendMessageFallback = async (trimmed: string) => {
    try {
      const clinicToken = getClinicToken();
      const agentId = getAgentId();
      const response = await fetch(`${AGENT_URL}/receptionist/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: trimmed,
          threadId,
          clinicToken,
          agentId,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.response || "Sorry, I couldn't process that.",
          export: data?.export ?? null,
          listBlock: data?.listBlock ?? null,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);
    try {
      await streamMessage(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendMessage(input);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800;9..144,900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
@keyframes fdBotBlink {
  0%, 90%, 100% { transform: scaleY(1); }
  93%, 96% { transform: scaleY(0.15); }
}
.fd-bot-eyes {
  animation: fdBotBlink 4s ease-in-out infinite;
}
        @keyframes fdPulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.45); }
          70%  { box-shadow: 0 0 0 9px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes fdSlideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fdShimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fdCaretBlink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        @keyframes fdPopIn {
          0% { transform: scale(0.4); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fdSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fdDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes fdSheen {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes fdFloatIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fd-msg-in { animation: fdSlideUp 0.32s cubic-bezier(0.22,1,0.36,1) forwards; }

        .fd-scroll::-webkit-scrollbar { width: 5px; }
        .fd-scroll::-webkit-scrollbar-track { background: transparent; }
        .fd-scroll::-webkit-scrollbar-thumb { background: rgba(194,69,45,0.22); border-radius: 4px; }
        .fd-scroll::-webkit-scrollbar-thumb:hover { background: rgba(194,69,45,0.38); }
        .fd-styled-row:hover { background: #FDF8F3; }

        .fd-quick-btn {
          transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .fd-quick-btn:hover {
          background: ${T.coralBgStrong} !important;
          border-color: ${T.coralBorder} !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(194,69,45,0.16);
        }
        .fd-quick-btn:active { transform: translateY(0); }

        .fd-send { transition: all 0.18s cubic-bezier(0.22,1,0.36,1); position: relative; overflow: hidden; }
        .fd-send:hover:not(:disabled) { transform: scale(1.06) rotate(-4deg); }
        .fd-send:active:not(:disabled) { transform: scale(0.96); }

        .fd-close { transition: all 0.18s ease; }
        .fd-close:hover { background: rgba(255,255,255,0.24) !important; transform: rotate(90deg); }

        .fd-csv-btn { transition: all 0.16s ease; }
        .fd-csv-btn:hover {
          background: ${T.coralBgStrong} !important;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(194,69,45,0.18);
        }

       .fd-row { transition: background 0.12s ease; }
.fd-row:hover { background: rgba(194,69,45,0.045); }

        .fd-avatar-assistant {
          background: linear-gradient(150deg, #FFFFFF, #FBF3EA);
        }

        .fd-widget {
          transform: translateY(28px) scale(0.94);
          opacity: 0;
          transform-origin: bottom right;
          transition:
            transform ${DRAWER_MS}ms cubic-bezier(0.34, 1.35, 0.64, 1),
            opacity ${DRAWER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .fd-widget.fd-widget-open {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        .fd-backdrop {
          opacity: 0;
          transition: opacity ${DRAWER_MS}ms ease;
        }
        .fd-backdrop.fd-backdrop-open {
          opacity: 1;
        }

        .fd-input-wrap {
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .fd-tool-chip {
          animation: fdFloatIn 0.3s cubic-bezier(0.22,1,0.36,1);
        }
@media (prefers-reduced-motion: reduce) {
  .fd-msg-in, .fd-tool-chip { animation: none !important; }
  .fd-bot-eyes { animation: none !important; }
  .fd-widget { transition: opacity ${DRAWER_MS}ms ease !important; transform: none !important; }
}
        @media (max-width: 480px) {
          .fd-widget {
            right: 10px !important;
            left: 10px !important;
            bottom: 10px !important;
            top: 10px !important;
            width: auto !important;
            height: auto !important;
            max-width: none !important;
            max-height: none !important;
          }
        }
      `}</style>
      {/* Anchor for widget-open animation origin; keep out of layout */}

      <div
        onClick={handleClose}
        className={`fd-backdrop${entered ? " fd-backdrop-open" : ""}`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(28,20,15,0.38)",
          backdropFilter: "blur(2px)",
          display: isOpen || closing ? "block" : "none",
          pointerEvents: isOpen || closing ? "auto" : "none",
        }}
      />

      {/* ── WIDGET PANEL — floating card inset from all 4 edges, rounded
           corners throughout, anchored bottom-right like a chat widget ── */}
      <div
        ref={panelRef}
        className={`fd-widget${entered ? " fd-widget-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="KAKA AI Receptionist Agent"
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          bottom: 24,
          zIndex: 9999,
          width: "min(420px, calc(100vw - 48px))",
          maxWidth: "calc(100vw - 48px)",
          height: "calc(100vh - 48px)",
          maxHeight: 760,
          background: T.bg,
          boxShadow: T.shadow,
          border: `1px solid ${T.border}`,
          borderRadius: 24,
          display: isOpen || closing ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: BODY_FONT,
          pointerEvents: isOpen || closing ? "auto" : "none",
        }}
      >
        {/* ── HEADER — warm coral gradient with a subtle grain + ringing bell signature ── */}
        <div
          style={{
            background:
              "linear-gradient(120deg, #A63A25 0%, #C2452D 55%, #E8674A 100%)",
            padding: "17px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -10,
              top: -40,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              filter: "blur(26px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 60,
              bottom: -50,
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              zIndex: 1,
            }}
          >
            <div style={{ position: "relative" }}>
              <BotFace size={35} color="#ffffff" />
              <span
                style={{
                  position: "absolute",
                  bottom: 1,
                  right: 1,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#8FD4A8",
                  border: "2px solid #A63A25",
                  display: "block",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontFamily: DISPLAY_FONT,
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.2px",
                }}
              >
                KAKA
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.88)",
                  letterSpacing: "0.3px",
                  fontWeight: 650,
                }}
              >
                AI Receptionist Agent
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="fd-close"
            aria-label="Close KAKA AI Receptionist Agent"
            style={{
              zIndex: 1,
              background: "rgba(255,255,255,0.20)",
              border: "1px solid rgba(255,255,255,0.32)",
              borderRadius: 10,
              padding: "6px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#ffffff",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── MESSAGES ── */}
        <div
          className="fd-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "16px 14px",
            background: `radial-gradient(circle at 100% 0%, ${T.bgGrain} 0%, ${T.bg} 55%)`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {!historyLoaded && (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}>
                <div
                  className="fd-avatar-assistant"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${T.border}`,
                    flexShrink: 0,
                  }}
                />
                <SkeletonBubble />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row-reverse",
                  alignItems: "flex-end",
                  gap: 7,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: T.coral,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    background:
                      "linear-gradient(90deg, #E8674A 25%, #F0906F 37%, #E8674A 63%)",
                    backgroundSize: "400% 100%",
                    animation: "fdShimmer 1.4s ease infinite",
                    borderRadius: "16px 4px 16px 16px",
                    width: 140,
                    height: 34,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}>
                <div
                  className="fd-avatar-assistant"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${T.border}`,
                    flexShrink: 0,
                  }}
                />
                <SkeletonBubble />
              </div>
            </>
          )}
          {historyLoaded &&
            messages.map((msg, i) => {
              if (
                msg.role === "assistant" &&
                msg.streaming &&
                msg.content === ""
              ) {
                return null;
              }
              return (
                <div
                  key={i}
                  className="fd-msg-in"
                  style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: 7,
                  }}
                >
                  <div
                    className={
                      msg.role === "assistant"
                        ? "fd-avatar-assistant"
                        : undefined
                    }
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: msg.role === "user" ? T.coral : undefined,
                      border:
                        msg.role === "assistant"
                          ? `1px solid ${T.border}`
                          : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 2,
                      boxShadow:
                        msg.role === "user"
                          ? "0 3px 8px rgba(194,69,45,0.32)"
                          : T.shadowSm,
                    }}
                  >
                    {msg.role === "user" ? (
                      <User size={12} color="#fff" />
                    ) : (
                      <Sparkles size={12} color={T.coral} />
                    )}
                  </div>

                  <div
                    style={{
                      maxWidth: msg.role === "assistant" ? "98%" : "82%",
                      minWidth: 0,
                      borderRadius:
                        msg.role === "user"
                          ? "16px 4px 16px 16px"
                          : "4px 16px 16px 16px",
                      overflow: "hidden",
                      background:
                        msg.role === "user"
                          ? "linear-gradient(135deg, #A63A25, #C2452D)"
                          : "transparent",
                      boxShadow:
                        msg.role === "user"
                          ? "0 4px 16px rgba(194,69,45,0.28)"
                          : "none",
                    }}
                  >
                    {msg.role === "user" ? (
                      <div style={{ padding: "9px 13px" }}>
                        <span
                          style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: "#ffffff",
                            fontWeight: 600,
                          }}
                        >
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <StatusBubble
                        content={msg.content}
                        exportBlock={msg.export}
                        listBlock={msg.listBlock}
                        streaming={msg.streaming}
                      />
                    )}
                  </div>
                </div>
              );
            })}

          {/* ── LIVE TOOL-CALL RECEIPT — feels like KAKA is working at a real terminal
               ticking through an action, not a generic spinner ── */}
          {toolStatus && (
            <div
              className="fd-tool-chip"
              style={{ display: "flex", alignItems: "flex-end", gap: 7 }}
            >
              <div
                className="fd-avatar-assistant"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: T.shadowSm,
                }}
              >
                <Loader2
                  size={12}
                  color={T.coral}
                  style={{ animation: "fdSpin 0.9s linear infinite" }}
                />
              </div>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(180deg, #FFF9F4, #FDF0E6)",
                  border: `1px solid ${T.goldBorder}`,
                  borderRadius: "4px 16px 16px 16px",
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  boxShadow: T.shadowSm,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)",
                    width: "40%",
                    animation: "fdSheen 1.8s ease-in-out infinite",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    color: T.gold,
                    display: "flex",
                    alignItems: "center",
                    zIndex: 1,
                  }}
                >
                  {(activeToolName && TOOL_META[activeToolName]?.icon) || (
                    <Sparkles size={12} />
                  )}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 650,
                    color: "#7A5A28",
                    zIndex: 1,
                    fontFamily: DISPLAY_FONT,
                  }}
                >
                  {toolStatus}
                </span>
                <span style={{ display: "inline-flex", gap: 2.5, zIndex: 1 }}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 3.5,
                        height: 3.5,
                        borderRadius: "50%",
                        background: T.gold,
                        display: "inline-block",
                        animation: `fdDotBounce 1s ease-in-out ${d * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          {isLoading &&
            !toolStatus &&
            messages[messages.length - 1]?.streaming &&
            messages[messages.length - 1]?.content === "" && (
              <div
                className="fd-msg-in"
                style={{ display: "flex", alignItems: "flex-end", gap: 7 }}
              >
                <div
                  className="fd-avatar-assistant"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: T.shadowSm,
                  }}
                >
                  <Sparkles size={12} color={T.coral} />
                </div>
                <SkeletonBubble />
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div
          style={{
            padding: "10px 14px 6px",
            background: "#ffffff",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          {[
            {
              icon: <Search size={11} />,
              label: "Search patient",
              value: "Search for patient ",
            },
            {
              icon: <CalendarPlus size={11} />,
              label: "Book appointment",
              value: "Book an appointment for ",
            },
            {
              icon: <FileText size={11} />,
              label: "Billings",
              value: "Show me the billing information",
            },
            {
              icon: <Package size={11} />,
              label: "Packages",
              value: "Show me available packages",
            },
          ].map((item) => (
            <button
              key={item.label}
              className="fd-quick-btn"
              onClick={() => {
                setInput(item.value);
                textareaRef.current?.focus();
              }}
              style={{
                fontSize: 11,
                padding: "5px 11px",
                borderRadius: 20,
                border: `1px solid ${T.coralBorder}`,
                background: T.coralBg,
                color: T.coralDark,
                cursor: "pointer",
                fontWeight: 650,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ── INPUT ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "10px 14px 16px",
            background: "#ffffff",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div
            className="fd-input-wrap"
            style={{
              flex: 1,
              borderRadius: 13,
              border: `1.5px solid ${inputFocused ? T.coralLight : T.border}`,
              background: T.panelAlt,
              boxShadow: inputFocused
                ? "0 0 0 4px rgba(194,69,45,0.10)"
                : "none",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask KAKA…"
              rows={1}
              style={{
                width: "100%",
                fontSize: 13,
                border: "none",
                borderRadius: 13,
                padding: "9px 12px",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                color: T.text,
                background: "transparent",
                lineHeight: 1.5,
                maxHeight: 96,
                overflowY: "auto",
                display: "block",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="fd-send"
            style={
              {
                width: 39,
                height: 39,
                borderRadius: 12,
                background:
                  !input.trim() || isLoading
                    ? "#EDE3D6"
                    : "linear-gradient(135deg, #A63A25, #C2452D)",
                cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: !input.trim() || isLoading ? "none" : T.shadowLift,
                border: "none",
              } as React.CSSProperties
            }
          >
            <Send
              size={14}
              color={!input.trim() || isLoading ? T.textMute : "#fff"}
            />
          </button>
        </form>
      </div>
    </>
  );
};

export default ReceptionistChat;
