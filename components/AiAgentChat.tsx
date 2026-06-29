import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Sparkles,
  User,
  Calendar,
  Clock,
  Stethoscope,
  UserCircle,
  CheckCircle,
  AlertCircle,
  CalendarX,
  CalendarCheck,
  MapPin,
  CreditCard,
  Phone,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | null;
}

// ─── DESIGN TOKENS — mirrors the ZEVA Clinic Panel dashboard ─────────────────
// Deepened vs. the dashboard's own off-white so the floating widget reads as
// a distinct surface against arbitrary host pages, with stronger borders/text
// contrast throughout (per feedback: previous pass was too washed out).
const T = {
  bg: "#eef2f6", // widget shell background — a clear step darker than card white
  panel: "#ffffff",
  panelAlt: "#f1f5f9", // zebra striping / sunken rows, darker than before
  border: "#cbd5e1", // stronger border than the dashboard's hairline — needed at small chat scale
  borderSoft: "rgba(15,23,42,0.10)",
  text: "#0f172a",
  textSoft: "#334155",
  textMute: "#64748b",
  teal: "#0d9488",
  tealDark: "#0f766e",
  tealSoft: "#14b8a6",
  tealBg: "rgba(13,148,136,0.14)",
  tealBorder: "rgba(13,148,136,0.38)",
  indigo: "#4f46e5",
  indigoBg: "rgba(79,70,229,0.13)",
  indigoBorder: "rgba(79,70,229,0.32)",
  amber: "#d97706",
  amberBg: "rgba(217,119,6,0.14)",
  amberBorder: "rgba(217,119,6,0.35)",
  red: "#dc2626",
  redBg: "rgba(220,38,38,0.10)",
  redBorder: "rgba(220,38,38,0.30)",
  green: "#059669",
  greenBg: "rgba(5,150,105,0.13)",
  greenBorder: "rgba(5,150,105,0.32)",
  shadow: "0 2px 4px rgba(15,23,42,0.08), 0 16px 40px rgba(15,23,42,0.18)",
  shadowSm: "0 1px 2px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.08)",
};

function parseMarkdownTable(
  content: string,
): { headers: string[]; rows: string[][] } | null {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const tableLines = lines.filter((l) => l.startsWith("|"));
  if (tableLines.length < 3) return null;
  const parse = (line: string) =>
    line
      .split("|")
      .map((c) => c.replace(/\*\*/g, "").trim())
      .filter(Boolean);
  const headers = parse(tableLines[0]);
  const rows = tableLines.slice(2).map(parse);
  return { headers, rows };
}

const SCHEDULER_LINK_TOKEN = "🔗 SCHEDULER_LINK:";

const hasSchedulerLink = (c: string) => c.includes(SCHEDULER_LINK_TOKEN);

function extractSchedulerLink(c: string): { text: string; link: string } {
  const idx = c.indexOf(SCHEDULER_LINK_TOKEN);

  const text = c.slice(0, idx).trim();

  const raw = c
    .slice(idx + SCHEDULER_LINK_TOKEN.length)
    .trim()
    .split("\n")[0]
    .trim();

  const markdownMatch = raw.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/);

  const link = markdownMatch ? markdownMatch[1] : raw;

  return { text, link };
}

const isBookingConfirmation = (c: string) =>
  c.includes("Treatment") &&
  c.includes("Doctor") &&
  c.includes("Date") &&
  c.includes("Time") &&
  (c.toLowerCase().includes("confirm") ||
    c.toLowerCase().includes("summary") ||
    c.toLowerCase().includes("appointment"));
const isAppointmentDetails = (c: string) =>
  c.includes("APT_DETAILS") && !isRescheduleConfirmation(c);
const isDateTimePicker = (c: string) =>
  c.toLowerCase().includes("please select a new date and time");
const isTimings = (c: string) =>
  c.includes("TIMINGS_START") && c.includes("TIMINGS_END");

const isRescheduleConfirmation = (c: string) =>
  (c.includes("Original Date") || c.includes("New Date")) &&
  (c.toLowerCase().includes("reschedule") ||
    c.toLowerCase().includes("update"));

const isSuccessBanner = (c: string) =>
  (c.toLowerCase().includes("confirmed") ||
    c.toLowerCase().includes("rescheduled")) &&
  (c.includes("🎉") || c.toLowerCase().includes("see you"));

const isErrorBanner = (c: string) =>
  c.toLowerCase().includes("went wrong") ||
  c.toLowerCase().includes("didn't go through") ||
  c.toLowerCase().includes("didn't go through") ||
  c.toLowerCase().includes("failed");
const isServicesSummary = (c: string) =>
  c.includes("SERVICES_SUMMARY_START") && c.includes("SERVICES_SUMMARY_END");

const isServicesDetail = (c: string) =>
  c.includes("SERVICES_DETAIL_START") && c.includes("SERVICES_DETAIL_END");
const isDoctorList = (c: string) =>
  (c.toLowerCase().includes("doctor") ||
    c.toLowerCase().includes("dr.") ||
    c.toLowerCase().includes("available for")) &&
  (c.includes("—") || c.includes(" - ")) &&
  (c.includes("- ") || c.includes("* ")) &&
  c.includes("DOCTORS_LIST_START") &&
  c.includes("DOCTORS_LIST_END") &&
  !isBookingConfirmation(c) &&
  !isRescheduleConfirmation(c);

const isFaqAnswer = (c: string) =>
  (c.includes("**Clinic") ||
    c.includes("💡") ||
    c.toLowerCase().includes("hours") ||
    c.toLowerCase().includes("location") ||
    c.toLowerCase().includes("services") ||
    c.toLowerCase().includes("payment") ||
    c.toLowerCase().includes("insurance")) &&
  !isBookingConfirmation(c) &&
  !isRescheduleConfirmation(c) &&
  !isDateTimePicker(c) &&
  !isServicesSummary(c) &&
  !isServicesDetail(c);

const avatarPalette = [
  { bg: "#ccfbf1", text: "#0f766e", glow: "#14b8a6" },
  { bg: "#e0e7ff", text: "#4338ca", glow: "#6366f1" },
  { bg: "#fce7f3", text: "#9d174d", glow: "#ec4899" },
  { bg: "#fef3c7", text: "#92400e", glow: "#f59e0b" },
  { bg: "#dbeafe", text: "#1e40af", glow: "#3b82f6" },
];

function initials(name: string): string {
  return name
    .replace("Dr.", "")
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function faqIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("hour") || t.includes("time")) return <Clock size={15} />;
  if (t.includes("location") || t.includes("address") || t.includes("find"))
    return <MapPin size={15} />;
  if (
    t.includes("payment") ||
    t.includes("insurance") ||
    t.includes("cost") ||
    t.includes("price")
  )
    return <CreditCard size={15} />;
  if (t.includes("doctor") || t.includes("specialist"))
    return <Stethoscope size={15} />;
  if (t.includes("phone") || t.includes("contact") || t.includes("call"))
    return <Phone size={15} />;
  return <ChevronRight size={15} />;
}

const MarkdownComponents: React.ComponentProps<
  typeof ReactMarkdown
>["components"] = {
  h1: ({ children }) => (
    <h1
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: T.text,
        margin: "10px 0 5px",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontSize: 13,
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
        fontSize: 12,
        fontWeight: 700,
        color: T.teal,
        margin: "6px 0 3px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        margin: "0 0 5px",
        fontSize: 13,
        lineHeight: 1.65,
        color: T.textSoft,
      }}
    >
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: T.text }}>{children}</strong>
  ),
  hr: () => (
    <hr
      style={{
        border: "none",
        borderTop: `1px solid ${T.border}`,
        margin: "8px 0",
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
        gap: 7,
        marginBottom: 4,
        fontSize: 13,
        color: T.textSoft,
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
          background: T.tealSoft,
          display: "inline-block",
        }}
      />
      <span>{children}</span>
    </li>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "6px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: T.tealBg }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: `1px solid ${T.borderSoft}` }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th
      style={{
        padding: "7px 10px",
        textAlign: "left",
        fontWeight: 700,
        fontSize: 10,
        color: T.teal,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: "7px 10px",
        color: T.textSoft,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </td>
  ),
  blockquote: ({ children }) => (
    <div
      style={{
        background: T.indigoBg,
        borderLeft: `3px solid ${T.indigo}`,
        borderRadius: "0 8px 8px 0",
        padding: "7px 12px",
        margin: "5px 0",
        color: "#4338ca",
        fontSize: 12,
      }}
    >
      {children}
    </div>
  ),
  code: ({ children, className }: any) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 11,
          overflowX: "auto",
          margin: "5px 0",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <code>{children}</code>
      </pre>
    ) : (
      <code
        style={{
          background: T.indigoBg,
          color: "#4f46e5",
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

// Wraps plain assistant markdown text in an actual bubble container, so
// follow-up lines and plain replies read as chat messages, not floating text.
const TextBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: "4px 14px 14px 14px",
      padding: "10px 13px",
      boxShadow: T.shadowSm,
    }}
  >
    {children}
  </div>
);

// Small reusable card header used across cards to keep visual rhythm consistent
const CardHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: "amber" | "green" | "red" | "teal" };
  accent?: string;
}> = ({ icon, title, subtitle, badge, accent = T.teal }) => {
  const toneMap: Record<string, { bg: string; border: string; color: string }> =
    {
      amber: { bg: T.amberBg, border: T.amberBorder, color: "#b45309" },
      green: { bg: T.greenBg, border: T.greenBorder, color: "#047857" },
      red: { bg: T.redBg, border: T.redBorder, color: "#b91c1c" },
      teal: { bg: T.tealBg, border: T.tealBorder, color: T.teal },
    };
  return (
    <div
      style={{
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: T.panel,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: `${accent}14`,
            border: `1px solid ${accent}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accent,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              fontWeight: 700,
              color: T.text,
              letterSpacing: "0.1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: 10.5,
                color: T.textMute,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 9.5,
            padding: "3px 9px",
            borderRadius: 20,
            background: toneMap[badge.tone].bg,
            border: `1px solid ${toneMap[badge.tone].border}`,
            color: toneMap[badge.tone].color,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
};

// ─── APPOINTMENT DETAILS — attractive, read-only (no action buttons) ─────────
const AppointmentDetailsCard: React.FC<{
  content: string;
  onSend: (msg: string) => void;
}> = ({ content }) => {
  const start = content.indexOf("APT_DETAILS");
  const tableSlice = start >= 0 ? content.slice(start) : content;
  const parsed = parseMarkdownTable(tableSlice);
  const rows = parsed?.rows ?? [];

  const followUp = parsed
    ? tableSlice
        .split("\n")
        .filter((l) => !l.trim().startsWith("|") && l.trim() !== "APT_DETAILS")
        .join("\n")
        .trim()
    : "";

  const fieldMap: Record<string, { icon: React.ReactNode; color: string }> = {
    patient: { icon: <User size={14} />, color: T.indigo },
    doctor: { icon: <UserCircle size={14} />, color: "#3b82f6" },
    treatment: { icon: <Stethoscope size={14} />, color: T.teal },
    date: { icon: <Calendar size={14} />, color: "#ec4899" },
    time: { icon: <Clock size={14} />, color: T.amber },
    status: { icon: <CheckCircle size={14} />, color: T.indigo },
  };

  const getField = (key: string) =>
    fieldMap[key.toLowerCase().replace(/\*\*/g, "").trim()] ?? {
      icon: <ChevronRight size={14} />,
      color: T.indigo,
    };

  const statusValue =
    rows.find(([f]) => f.toLowerCase() === "status")?.[1]?.toLowerCase() ?? "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
      }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${T.border}`,
          background: T.panel,
          boxShadow: T.shadowSm,
        }}
      >
        {/* Banner header — teal gradient to signal "this is live data", distinct from booking flow cards */}
        <div
          style={{
            background:
              "linear-gradient(120deg, #0d9488 0%, #14b8a6 55%, #2dd4bf 100%)",
            padding: "16px 18px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -24,
              top: -28,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 30,
              bottom: -30,
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ClipboardList size={16} color="#ffffff" />
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#ffffff",
                    letterSpacing: "0.3px",
                    textTransform: "uppercase",
                  }}
                >
                  Your Appointment
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10.5,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  Current booking on file
                </p>
              </div>
            </div>
            {statusValue && (
              <span
                style={{
                  fontSize: 10,
                  padding: "4px 11px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.92)",
                  color: statusValue === "booked" ? "#0d9488" : "#b45309",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                }}
              >
                {statusValue}
              </span>
            )}
          </div>
        </div>

        {/* Rows */}
        <div style={{ background: T.panel, padding: "6px 6px" }}>
          {rows.map(([field, value], i) => {
            if (field.toLowerCase() === "status") return null;
            const { icon, color } = getField(field);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  margin: "2px 4px",
                  borderRadius: 10,
                  background: i % 2 === 0 ? "transparent" : T.panelAlt,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: `${color}14`,
                      border: `1px solid ${color}33`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: T.textMute,
                      fontWeight: 600,
                    }}
                  >
                    {field.replace(/\*\*/g, "")}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quiet footer strip — informational only, no actions per design intent */}
        <div
          style={{
            padding: "9px 16px",
            background: T.panelAlt,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10.5,
              color: T.textMute,
              textAlign: "center",
            }}
          >
            Need a change? Just tell me — I can reschedule it for you.
          </p>
        </div>
      </div>

      {followUp && (
        <TextBubble>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents}
          >
            {followUp}
          </ReactMarkdown>
        </TextBubble>
      )}
    </div>
  );
};

const ServicesSummaryCard: React.FC<{
  content: string;
  onSend: (msg: string) => void;
}> = ({ content, onSend }) => {
  const start = content.indexOf("SERVICES_SUMMARY_START");
  const end = content.indexOf("SERVICES_SUMMARY_END");
  const inner = content
    .slice(start + "SERVICES_SUMMARY_START".length, end)
    .trim();

  const deptColors = [
    { bg: T.tealBg, border: T.tealBorder, color: T.teal },
    { bg: T.indigoBg, border: T.indigoBorder, color: T.indigo },
    { bg: T.amberBg, border: T.amberBorder, color: "#b45309" },
    {
      bg: "rgba(236,72,153,0.08)",
      border: "rgba(236,72,153,0.22)",
      color: "#db2777",
    },
    {
      bg: "rgba(56,189,248,0.08)",
      border: "rgba(56,189,248,0.22)",
      color: "#0284c7",
    },
    {
      bg: "rgba(167,139,250,0.08)",
      border: "rgba(167,139,250,0.22)",
      color: "#7c3aed",
    },
  ];

  const departments: { name: string; count: number }[] = [];
  inner.split("\n").forEach((line) => {
    const match = line.match(/^-\s*(.+?)\s*\|\s*(\d+)/);
    if (match)
      departments.push({ name: match[1].trim(), count: parseInt(match[2]) });
  });

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: T.panel,
        boxShadow: T.shadowSm,
      }}
    >
      <CardHeader
        icon={<Stethoscope size={15} />}
        title="Our Services"
        subtitle={`${departments.reduce((a, d) => a + d.count, 0)} treatments across ${departments.length} departments`}
        accent={T.teal}
      />

      <div
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          background: T.panel,
        }}
      >
        {departments.map((dept, i) => {
          const col = deptColors[i % deptColors.length];
          return (
            <button
              key={i}
              onClick={() => onSend(`Show me ${dept.name} services`)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                background: col.bg,
                border: `1px solid ${col.border}`,
                textAlign: "left",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: col.color,
                }}
              >
                {dept.name}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  color: T.textMute,
                }}
              >
                {dept.count} treatment{dept.count !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: "10px 16px 12px",
          borderTop: `1px solid ${T.border}`,
          background: T.panelAlt,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: T.textMute,
            textAlign: "center",
          }}
        >
          Tap a department to see treatments & pricing
        </p>
      </div>
    </div>
  );
};

const ServicesDetailCard: React.FC<{ content: string }> = ({ content }) => {
  const start = content.indexOf("SERVICES_DETAIL_START");
  const end = content.indexOf("SERVICES_DETAIL_END");
  const inner = content
    .slice(start + "SERVICES_DETAIL_START".length, end)
    .trim();
  const followUp = content.slice(end + "SERVICES_DETAIL_END".length).trim();

  const lines = inner.split("\n");
  const headerLine =
    lines
      .find((l) => l.includes("**"))
      ?.replace(/\*\*/g, "")
      .trim() ?? "Services";

  const services: { name: string; price: string; duration: string }[] = [];
  lines.forEach((line) => {
    const match = line.match(
      /^-\s*(.+?)\s*\|\s*(₹[\d,]+|[\d,]+)\s*\|\s*(\d+\s*min)/i,
    );
    if (match)
      services.push({
        name: match[1].trim(),
        price: match[2].trim(),
        duration: match[3].trim(),
      });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${T.border}`,
          background: T.panel,
          boxShadow: T.shadowSm,
        }}
      >
        <CardHeader
          icon={<Stethoscope size={14} />}
          title={headerLine}
          accent={T.teal}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            padding: "8px 14px",
            gap: 12,
            borderBottom: `1px solid ${T.border}`,
            background: T.panelAlt,
          }}
        >
          {["Treatment", "Price", "Duration"].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.teal,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {services.map((svc, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              padding: "10px 14px",
              gap: 12,
              alignItems: "center",
              borderBottom:
                i < services.length - 1 ? `1px solid ${T.borderSoft}` : "none",
              background: i % 2 === 0 ? "transparent" : T.panelAlt,
            }}
          >
            <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
              {svc.name}
            </span>
            <span
              style={{
                fontSize: 12,
                color: T.teal,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {svc.price.startsWith("₹") ? svc.price : `₹${svc.price}`}
            </span>
            <span
              style={{
                fontSize: 11,
                color: T.textMute,
                whiteSpace: "nowrap",
              }}
            >
              {svc.duration}
            </span>
          </div>
        ))}
      </div>

      {followUp && (
        <TextBubble>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents}
          >
            {followUp}
          </ReactMarkdown>
        </TextBubble>
      )}
    </div>
  );
};

const BookingLinkCard: React.FC<{ content: string }> = ({ content }) => {
  const { text, link } = extractSchedulerLink(content);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <TextBubble>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={MarkdownComponents}
        >
          {text}
        </ReactMarkdown>
      </TextBubble>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "11px 14px",
          borderRadius: 13,
          background: hovered ? "#0d9488" : T.tealBg,
          border: `1px solid ${T.tealBorder}`,
          textDecoration: "none",
          transition: "background 0.15s, transform 0.15s",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: hovered
                ? "rgba(255,255,255,0.2)"
                : "rgba(13,148,136,0.14)",
              border: `1px solid ${hovered ? "rgba(255,255,255,0.4)" : T.tealBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Calendar size={14} color={hovered ? "#ffffff" : T.teal} />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                color: hovered ? "#ffffff" : T.text,
              }}
            >
              Book Online
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: hovered ? "rgba(255,255,255,0.8)" : T.textMute,
                marginTop: 1,
              }}
            >
              Opens the booking scheduler
            </p>
          </div>
        </div>
        <ChevronRight size={14} color={hovered ? "#ffffff" : T.textMute} />
      </a>
    </div>
  );
};

const TimingsCard: React.FC<{ content: string }> = ({ content }) => {
  const start = content.indexOf("TIMINGS_START");
  const end = content.indexOf("TIMINGS_END");
  const inner = content.slice(start + "TIMINGS_START".length, end).trim();
  const followUp = content.slice(end + "TIMINGS_END".length).trim();

  const rows: { day: string; status: string; opens: string; closes: string }[] =
    [];
  inner.split("\n").forEach((line) => {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) return;
    if (cells[0].toLowerCase() === "day") return;
    if (/^[-:]+$/.test(cells[0])) return;
    rows.push({
      day: cells[0],
      status: cells[1],
      opens: cells[2] ?? "-",
      closes: cells[3] ?? "-",
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${T.border}`,
          background: T.panel,
          boxShadow: T.shadowSm,
        }}
      >
        <CardHeader
          icon={<Clock size={14} />}
          title="Clinic Hours"
          accent={T.teal}
        />

        {rows.map((row, i) => {
          const isOpen = row.status.toLowerCase() === "open";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                padding: "9px 14px",
                gap: 10,
                alignItems: "center",
                borderBottom:
                  i < rows.length - 1 ? `1px solid ${T.borderSoft}` : "none",
                background: i % 2 === 0 ? "transparent" : T.panelAlt,
              }}
            >
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
                {row.day}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 8,
                  background: isOpen ? T.greenBg : T.redBg,
                  border: isOpen
                    ? `1px solid ${T.greenBorder}`
                    : `1px solid ${T.redBorder}`,
                  color: isOpen ? "#047857" : "#b91c1c",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {isOpen ? "OPEN" : "CLOSED"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: T.textSoft,
                  whiteSpace: "nowrap",
                }}
              >
                {isOpen ? row.opens : "–"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: T.textSoft,
                  whiteSpace: "nowrap",
                }}
              >
                {isOpen ? row.closes : "–"}
              </span>
            </div>
          );
        })}
      </div>

      {followUp && (
        <TextBubble>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents}
          >
            {followUp}
          </ReactMarkdown>
        </TextBubble>
      )}
    </div>
  );
};

// ─── BOOKING SUMMARY — keeps Confirm / Cancel (this is the booking flow) ─────
const BookingCard: React.FC<{
  content: string;
  onSend: (msg: string) => void;
}> = ({ content, onSend }) => {
  const parsed = parseMarkdownTable(content);
  const rows = parsed?.rows ?? [];

  const fieldMap: Record<string, { icon: React.ReactNode; color: string }> = {
    patient: { icon: <User size={13} />, color: T.indigo },
    treatment: { icon: <Stethoscope size={13} />, color: T.teal },
    doctor: { icon: <UserCircle size={13} />, color: "#3b82f6" },
    date: { icon: <Calendar size={13} />, color: "#ec4899" },
    time: { icon: <Clock size={13} />, color: T.amber },
  };

  const getField = (key: string) =>
    fieldMap[key.toLowerCase().replace(/\*\*/g, "").trim()] ?? {
      icon: <ChevronRight size={13} />,
      color: T.indigo,
    };

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: T.panel,
        boxShadow: T.shadowSm,
      }}
    >
      <CardHeader
        icon={<Calendar size={15} />}
        title="Appointment Summary"
        subtitle="Review before confirming"
        badge={{ label: "Pending", tone: "amber" }}
        accent={T.indigo}
      />

      {/* Rows */}
      <div style={{ background: T.panel, padding: "6px 6px" }}>
        {rows.map(([field, value], i) => {
          const { icon, color } = getField(field);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                margin: "2px 4px",
                borderRadius: 10,
                background: i % 2 === 0 ? "transparent" : T.panelAlt,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: `${color}14`,
                    border: `1px solid ${color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: T.textMute,
                    fontWeight: 600,
                  }}
                >
                  {field.replace(/\*\*/g, "")}
                </span>
              </div>
              <span style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer actions — booking flow needs explicit confirmation */}
      <div
        style={{
          background: T.panelAlt,
          borderTop: `1px solid ${T.border}`,
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onSend("Confirm")}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.3px",
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
            }}
          >
            ✓ Confirm Booking
          </button>
          <button
            onClick={() => onSend("Cancel")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              background: "#ffffff",
              border: `1px solid ${T.border}`,
              color: T.textSoft,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DATE TIME PICKER CARD ────────────────────────────────────────────────────
const DateTimePicker: React.FC<{ onSend: (msg: string) => void }> = ({
  onSend,
}) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const timeSlots = [
    "09:00 AM",
    "09:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "02:00 PM",
    "02:30 PM",
    "03:00 PM",
    "03:30 PM",
    "04:00 PM",
  ];

  const today = new Date().toISOString().split("T")[0];

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const formatted = new Date(selectedDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    onSend(`Reschedule to ${formatted} at ${selectedTime}`);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: T.panel,
        boxShadow: T.shadowSm,
      }}
    >
      <CardHeader
        icon={<Calendar size={15} />}
        title="Pick New Date & Time"
        subtitle="Choose your preferred slot"
        accent={T.indigo}
      />

      {/* Date picker */}
      <div style={{ padding: "14px 16px 0", background: T.panel }}>
        <p
          style={{
            margin: "0 0 7px",
            fontSize: 10,
            fontWeight: 700,
            color: T.textMute,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
          }}
        >
          Select Date
        </p>
        <input
          type="date"
          min={today}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.panelAlt,
            color: selectedDate ? T.text : T.textMute,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Time slots */}
      <div style={{ padding: "14px 16px", background: T.panel }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            fontWeight: 700,
            color: T.textMute,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
          }}
        >
          Select Time
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
          {timeSlots.map((slot) => (
            <button
              key={slot}
              onClick={() => setSelectedTime(slot)}
              style={{
                padding: "7px 4px",
                borderRadius: 8,
                border:
                  selectedTime === slot
                    ? `1px solid ${T.indigo}`
                    : `1px solid ${T.border}`,
                background: selectedTime === slot ? T.indigoBg : T.panelAlt,
                color: selectedTime === slot ? T.indigo : T.textSoft,
                fontSize: 11,
                fontWeight: selectedTime === slot ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: T.panelAlt,
          borderTop: `1px solid ${T.border}`,
          padding: "12px 16px",
        }}
      >
        <button
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedTime}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            cursor: !selectedDate || !selectedTime ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.3px",
            background:
              !selectedDate || !selectedTime
                ? "#e2e8f0"
                : "linear-gradient(135deg, #4f46e5, #6366f1)",
            color: !selectedDate || !selectedTime ? T.textMute : "#fff",
            boxShadow:
              !selectedDate || !selectedTime
                ? "none"
                : "0 4px 14px rgba(99,102,241,0.3)",
            transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        >
          {!selectedDate || !selectedTime
            ? "Select date and time to continue"
            : "→ Confirm New Slot"}
        </button>
      </div>
    </div>
  );
};

// ─── RESCHEDULE TIMELINE CARD — keeps Confirm / Cancel (pending change) ──────
const RescheduleCard: React.FC<{
  content: string;
  onSend: (msg: string) => void;
}> = ({ content, onSend }) => {
  const parsed = parseMarkdownTable(content);
  const rows = parsed?.rows ?? [];

  const origDate =
    rows.find(([f]) => f.toLowerCase().includes("original date"))?.[1] ?? "–";
  const origTime =
    rows.find(([f]) => f.toLowerCase().includes("original time"))?.[1] ?? "–";
  const newDate =
    rows.find(([f]) => f.toLowerCase().includes("new date"))?.[1] ?? "–";
  const newTime =
    rows.find(([f]) => f.toLowerCase().includes("new time"))?.[1] ?? "–";
  const doctor =
    rows.find(([f]) => f.toLowerCase().includes("doctor"))?.[1] ?? "–";

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: T.panel,
        boxShadow: T.shadowSm,
      }}
    >
      <CardHeader
        icon={<Calendar size={15} />}
        title="Reschedule Request"
        subtitle={`Dr. ${doctor.replace("Dr.", "").trim()}`}
        badge={{ label: "Update Pending", tone: "amber" }}
        accent={T.indigo}
      />

      {/* Timeline */}
      <div style={{ padding: "20px 20px 16px", background: T.panel }}>
        {/* Old slot */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: T.redBg,
                border: `1.5px solid ${T.redBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarX size={15} color={T.red} />
            </div>
            <div
              style={{
                width: 1.5,
                height: 28,
                background:
                  "linear-gradient(to bottom, rgba(239,68,68,0.3), rgba(13,148,136,0.3))",
                margin: "4px 0",
              }}
            />
          </div>
          <div style={{ paddingTop: 6 }}>
            <p
              style={{
                margin: "0 0 2px",
                fontSize: 10,
                fontWeight: 700,
                color: T.red,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Current Appointment
            </p>
            <p
              style={{
                margin: "0 0 1px",
                fontSize: 14,
                fontWeight: 700,
                color: "#b91c1c",
              }}
            >
              {origDate}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>
              {origTime}
            </p>
          </div>
        </div>

        {/* New slot */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: T.greenBg,
                border: `1.5px solid ${T.greenBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarCheck size={15} color={T.green} />
            </div>
          </div>
          <div style={{ paddingTop: 6 }}>
            <p
              style={{
                margin: "0 0 2px",
                fontSize: 10,
                fontWeight: 700,
                color: "#047857",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              New Appointment
            </p>
            <p
              style={{
                margin: "0 0 1px",
                fontSize: 14,
                fontWeight: 700,
                color: "#047857",
              }}
            >
              {newDate}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#059669" }}>
              {newTime}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: T.panelAlt,
          borderTop: `1px solid ${T.border}`,
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onSend("Confirm")}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              background: "linear-gradient(135deg, #059669, #10b981)",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
            }}
          >
            ✓ Confirm Reschedule
          </button>
          <button
            onClick={() => onSend("Cancel")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              background: "#ffffff",
              border: `1px solid ${T.border}`,
              color: T.textSoft,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SUCCESS BANNER ───────────────────────────────────────────────────────────
const SuccessBanner: React.FC<{ content: string }> = ({ content }) => {
  const clean = content.replace(/\*\*/g, "").replace(/🎉/g, "").trim();
  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${T.greenBorder}`,
        background: T.panel,
        boxShadow: T.shadowSm,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #059669, #10b981)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -15,
            top: -15,
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            border: "1.5px solid rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          <CheckCircle size={16} color="#ffffff" />
        </div>
        <div style={{ zIndex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Appointment Confirmed! 🎉
          </p>
        </div>
      </div>
      <div style={{ padding: "12px 16px", background: T.greenBg }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "#047857",
                }}
              >
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong style={{ color: "#047857", fontWeight: 700 }}>
                {children}
              </strong>
            ),
          }}
        >
          {clean}
        </ReactMarkdown>
      </div>
    </div>
  );
};

// ─── ERROR BANNER ─────────────────────────────────────────────────────────────
const ErrorBanner: React.FC<{ content: string }> = ({ content }) => (
  <div
    style={{
      borderRadius: 14,
      overflow: "hidden",
      border: `1px solid ${T.redBorder}`,
      background: T.panel,
      boxShadow: T.shadowSm,
    }}
  >
    <div
      style={{
        background: "linear-gradient(135deg, #dc2626, #ef4444)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          border: "1.5px solid rgba(255,255,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <AlertCircle size={16} color="#ffffff" />
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
        Something went wrong
      </p>
    </div>
    <div style={{ padding: "12px 16px", background: T.redBg }}>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.7,
          color: "#b91c1c",
        }}
      >
        {content.replace(/\*\*/g, "").trim()}
      </p>
    </div>
  </div>
);

// ─── DOCTOR GRID ──────────────────────────────────────────────────────────────
const DoctorGrid: React.FC<{ content: string }> = ({ content }) => {
  const start = content.indexOf("DOCTORS_LIST_START");
  const end = content.indexOf("DOCTORS_LIST_END");
  const inner = content.slice(start + "DOCTORS_LIST_START".length, end).trim();
  const followUp = content.slice(end + "DOCTORS_LIST_END".length).trim();

  const lines = inner.split("\n");
  const doctors: { name: string; specialty: string }[] = [];

  lines.forEach((line) => {
    const cleaned = line.replace(/\*\*/g, "").trim();
    const match = cleaned.match(/^-\s*(.+?)\s*—\s*(.+)/);
    if (match) {
      doctors.push({
        name: match[1].trim(),
        specialty: match[2].trim(),
      });
    }
  });

  const headerLine =
    lines
      .find((l) => l.includes("**"))
      ?.replace(/\*\*/g, "")
      .trim() ?? "Available Doctors";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${T.border}`,
          background: T.panel,
          boxShadow: T.shadowSm,
        }}
      >
        <CardHeader
          icon={<Stethoscope size={13} />}
          title={headerLine}
          accent={T.teal}
        />

        {/* Doctor grid */}
        <div
          style={{
            padding: "12px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            background: T.panel,
          }}
        >
          {doctors.map((doc, i) => {
            const palette = avatarPalette[i % avatarPalette.length];
            return (
              <div
                key={i}
                style={{
                  background: T.panelAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: palette.bg,
                    color: palette.text,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    boxShadow: `0 0 0 2px ${palette.glow}30`,
                  }}
                >
                  {initials(doc.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 1px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {doc.name}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: T.textMute,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {doc.specialty}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {followUp && (
        <TextBubble>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents}
          >
            {followUp}
          </ReactMarkdown>
        </TextBubble>
      )}
    </div>
  );
};

// ─── FAQ CARD ─────────────────────────────────────────────────────────────────
const FaqCard: React.FC<{ content: string }> = ({ content }) => {
  const faqColors = [
    {
      bg: T.tealBg,
      border: T.tealBorder,
      icon: "rgba(13,148,136,0.14)",
      iconColor: T.teal,
    },
    {
      bg: T.indigoBg,
      border: T.indigoBorder,
      icon: "rgba(99,102,241,0.16)",
      iconColor: T.indigo,
    },
    {
      bg: T.amberBg,
      border: T.amberBorder,
      icon: "rgba(245,158,11,0.16)",
      iconColor: "#b45309",
    },
    {
      bg: "rgba(236,72,153,0.06)",
      border: "rgba(236,72,153,0.2)",
      icon: "rgba(236,72,153,0.14)",
      iconColor: "#db2777",
    },
  ];

  const sections: { title: string; body: string }[] = [];
  const lines = content.split("\n");
  let current: { title: string; body: string } | null = null;

  lines.forEach((line) => {
    const boldTitle = line.match(/^\*\*(.+)\*\*\s*$/);
    const emojiTitle = line.match(/^(💡|📍|💰|🕐|📞|ℹ️)\s+\*?\*?(.+?)\*?\*?$/);
    const hashTitle = line.match(/^#{1,3}\s+(.+)/);
    if (boldTitle || emojiTitle || hashTitle) {
      if (current) sections.push(current);
      const title = (boldTitle?.[1] ?? emojiTitle?.[2] ?? hashTitle?.[1] ?? "")
        .replace(/\*\*/g, "")
        .trim();
      current = { title, body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  });
  if (current) sections.push(current);

  if (sections.length === 0) {
    return (
      <div
        style={{
          padding: "10px 14px",
          background: T.panel,
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowSm,
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 13,
                  color: T.textSoft,
                  lineHeight: 1.65,
                }}
              >
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong style={{ color: T.text, fontWeight: 600 }}>
                {children}
              </strong>
            ),
            li: ({ children }) => (
              <li
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 4,
                  fontSize: 13,
                  color: T.textSoft,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 6,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: T.tealSoft,
                    display: "inline-block",
                  }}
                />
                <span>{children}</span>
              </li>
            ),
            ul: ({ children }) => (
              <ul style={{ padding: 0, margin: "4px 0", listStyle: "none" }}>
                {children}
              </ul>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sections.map((sec, i) => {
        const col = faqColors[i % faqColors.length];
        return (
          <div
            key={i}
            style={{
              borderRadius: 13,
              overflow: "hidden",
              border: `1px solid ${col.border}`,
              background: T.panel,
              boxShadow: T.shadowSm,
            }}
          >
            <div
              style={{
                background: col.bg,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderBottom: `1px solid ${col.border}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: col.icon,
                  border: `1px solid ${col.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: col.iconColor,
                  flexShrink: 0,
                }}
              >
                {faqIcon(sec.title)}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: col.iconColor,
                  letterSpacing: "0.2px",
                }}
              >
                {sec.title}
              </p>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: 12,
                        color: T.textSoft,
                        lineHeight: 1.7,
                      }}
                    >
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ color: T.text, fontWeight: 600 }}>
                      {children}
                    </strong>
                  ),
                  table: ({ children }) => (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {children}
                    </table>
                  ),
                  thead: ({ children }) => <thead>{children}</thead>,
                  th: ({ children }) => (
                    <th
                      style={{
                        padding: "5px 0",
                        textAlign: "left",
                        color: col.iconColor,
                        fontWeight: 600,
                        borderBottom: `1px solid ${col.border}`,
                        fontSize: 11,
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{
                        padding: "5px 0",
                        color: T.textSoft,
                        borderBottom: `1px solid ${T.borderSoft}`,
                        fontSize: 12,
                      }}
                    >
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => <tr>{children}</tr>,
                  li: ({ children }) => (
                    <li
                      style={{
                        display: "flex",
                        gap: 6,
                        marginBottom: 3,
                        fontSize: 12,
                        color: T.textSoft,
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          marginTop: 5,
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: col.iconColor,
                          display: "inline-block",
                        }}
                      />
                      <span>{children}</span>
                    </li>
                  ),
                  ul: ({ children }) => (
                    <ul
                      style={{ padding: 0, margin: "4px 0", listStyle: "none" }}
                    >
                      {children}
                    </ul>
                  ),
                }}
              >
                {sec.body.trim()}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Smart renderer ───────────────────────────────────────────────────────────
const SmartRenderer: React.FC<{
  content: string;
  onSend: (msg: string) => void;
}> = ({ content, onSend }) => {
  if (hasSchedulerLink(content)) return <BookingLinkCard content={content} />;
  if (isDateTimePicker(content)) return <DateTimePicker onSend={onSend} />;
  if (isSuccessBanner(content)) return <SuccessBanner content={content} />;
  if (isErrorBanner(content)) return <ErrorBanner content={content} />;
  if (isServicesSummary(content))
    return <ServicesSummaryCard content={content} onSend={onSend} />;
  if (isAppointmentDetails(content))
    return <AppointmentDetailsCard content={content} onSend={onSend} />;
  if (isServicesDetail(content))
    return <ServicesDetailCard content={content} />;
  if (isBookingConfirmation(content))
    return <BookingCard content={content} onSend={onSend} />;
  if (isRescheduleConfirmation(content))
    return <RescheduleCard content={content} onSend={onSend} />;
  if (isDoctorList(content)) return <DoctorGrid content={content} />;
  if (isTimings(content)) return <TimingsCard content={content} />;
  if (isFaqAnswer(content)) return <FaqCard content={content} />;
  return (
    <TextBubble>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={MarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    </TextBubble>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const AiAgentChat: React.FC<AiAgentChatProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to **ZEVA Clinic** ✨\n\nI'm KAKA, your appointment agent. I can help you:\n- Book or reschedule an appointment\n- Answer any clinic questions\n\nWhat can I help you with today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [threadId, setThreadId] = useState(() => uuidv4());

  useEffect(() => {
    setThreadId(uuidv4());
    setMessages([
      {
        role: "assistant",
        content:
          "Welcome to **ZEVA Clinic** ✨\n\nI'm KAKA, your appointment agent. I can help you:\n- Book or reschedule an appointment\n- Answer any clinic questions\n\nWhat can I help you with today?",
      },
    ]);
    setInput("");
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
  }, [input]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const clinicToken = localStorage.getItem("clinicToken");
      const response = await fetch(`${AGENT_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: trimmed,
          threadId,
          clinicToken,
          conversation_id: conversationId ?? "",
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.response || "Sorry, I couldn't process that.",
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendMessage(input);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(13,148,136,0.35); }
          70%  { box-shadow: 0 0 0 8px rgba(13,148,136,0); }
          100% { box-shadow: 0 0 0 0 rgba(13,148,136,0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .kaka-msg-in { animation: slideUp 0.25s ease forwards; }
        .kaka-scroll::-webkit-scrollbar { width: 4px; }
        .kaka-scroll::-webkit-scrollbar-track { background: transparent; }
        .kaka-scroll::-webkit-scrollbar-thumb { background: rgba(13,148,136,0.25); border-radius: 4px; }
        .kaka-quick-btn:hover { background: rgba(13,148,136,0.14) !important; border-color: rgba(13,148,136,0.4) !important; transform: translateY(-1px); }
        .kaka-quick-btn { transition: all 0.15s ease; }
        .kaka-send:hover:not(:disabled) { transform: scale(1.05); }
        .kaka-send { transition: all 0.15s ease; }
        .kaka-close:hover { background: rgba(255,255,255,0.16) !important; }
      `}</style>

      <div
        style={{
          position: "absolute",
          bottom: 84,
          left: 16,
          zIndex: 50,
          width: "clamp(320px, 90vw, 400px)",
          background: T.bg,
          borderRadius: 22,
          boxShadow: T.shadow,
          border: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            background:
              "linear-gradient(120deg, #0d9488 0%, #14b8a6 60%, #2dd4bf 100%)",
            padding: "14px 16px",
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
              right: 30,
              top: -30,
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -20,
              bottom: -20,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              filter: "blur(16px)",
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
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.2)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "pulseRing 3s infinite",
                }}
              >
                <Sparkles size={17} color="#ffffff" />
              </div>
              <span
                style={{
                  position: "absolute",
                  bottom: 1,
                  right: 1,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#4ade80",
                  border: "2px solid #0d9488",
                  display: "block",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
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
                  color: "rgba(255,255,255,0.85)",
                  letterSpacing: "0.2px",
                }}
              >
                ZEVA Clinic · AI Agent
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="kaka-close"
            style={{
              zIndex: 1,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 9,
              padding: "5px 7px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#ffffff",
              transition: "background 0.15s",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── MESSAGES ── */}
        <div
          className="kaka-scroll"
          style={{
            height: 400,
            overflowY: "auto",
            padding: "14px 12px",
            background: T.bg,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className="kaka-msg-in"
              style={{
                display: "flex",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 7,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: msg.role === "user" ? "#0d9488" : "#ffffff",
                  border:
                    msg.role === "assistant" ? `1px solid ${T.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 2,
                  boxShadow:
                    msg.role === "user"
                      ? "0 2px 6px rgba(13,148,136,0.3)"
                      : T.shadowSm,
                }}
              >
                {msg.role === "user" ? (
                  <User size={12} color="#fff" />
                ) : (
                  <Sparkles size={12} color={T.teal} />
                )}
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: msg.role === "assistant" ? "90%" : "78%",
                  minWidth: 0,
                  borderRadius:
                    msg.role === "user"
                      ? "16px 4px 16px 16px"
                      : "4px 16px 16px 16px",
                  overflow: "hidden",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #0d9488, #14b8a6)"
                      : "transparent",
                  boxShadow:
                    msg.role === "user"
                      ? "0 4px 16px rgba(13,148,136,0.25)"
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
                      }}
                    >
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  <SmartRenderer content={msg.content} onSend={sendMessage} />
                )}
              </div>
            </div>
          ))}

          {/* Typing dots */}
          {isLoading && (
            <div
              className="kaka-msg-in"
              style={{ display: "flex", alignItems: "flex-end", gap: 7 }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#ffffff",
                  border: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: T.shadowSm,
                }}
              >
                <Sparkles size={12} color={T.teal} />
              </div>
              <div
                style={{
                  background: "#ffffff",
                  border: `1px solid ${T.border}`,
                  borderRadius: "4px 16px 16px 16px",
                  padding: "11px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: T.shadowSm,
                }}
              >
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: T.tealSoft,
                      display: "inline-block",
                      animation: `bounce 1.2s ${delay}ms infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── QUICK REPLIES ── */}
        <div
          style={{
            padding: "8px 12px 4px",
            background: "#ffffff",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          {["📅 Book appointment", "🔄 Reschedule", "🔎 Appointment details"].map(
            (label) => (
              <button
                key={label}
                className="kaka-quick-btn"
                onClick={() => setInput(label.replace(/^[^\s]+\s/, ""))}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: `1px solid ${T.tealBorder}`,
                  background: T.tealBg,
                  color: T.teal,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* ── INPUT ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "10px 12px 13px",
            background: "#ffffff",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message KAKA..."
            rows={1}
            style={{
              flex: 1,
              fontSize: 13,
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: "9px 12px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              color: T.text,
              background: T.panelAlt,
              lineHeight: 1.5,
              maxHeight: 96,
              overflowY: "auto",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = T.tealSoft)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="kaka-send"
            style={
              {
                width: 38,
                height: 38,
                borderRadius: 11,
                background:
                  !input.trim() || isLoading
                    ? "#e2e8f0"
                    : "linear-gradient(135deg, #0d9488, #14b8a6)",
                cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow:
                  !input.trim() || isLoading
                    ? "none"
                    : "0 4px 14px rgba(13,148,136,0.35)",
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
export default AiAgentChat;
