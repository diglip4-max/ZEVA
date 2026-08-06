import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface AppointmentListItem {
  id: string;
  summary: Record<string, string>;
  detail: {
    fields?: Record<string, string>;
    lineItems?: {
      label: string;
      columns: Record<string, string>;
    }[];
  };
}

export interface AppointmentListBlock {
  kind: "appointments";
  summaryColumns: string[]; // always 5: Patient, Doctor, Status, Date, Time
  items: AppointmentListItem[];
}

const T = {
  panel: "#FFFFFF",
  border: "#E8DDD0",
  borderSoft: "rgba(28,25,23,0.08)",
  text: "#1C1917",
  textSoft: "#3A332C",
  textMute: "#8A7F76",
  coralDark: "#A63A25",
  panelAlt: "#FBF7F2",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  booked: { bg: "#E4F1EA", color: "#1F4B37" },
  confirmed: { bg: "#E4F1EA", color: "#1F4B37" },
  arrived: { bg: "#FBEBD5", color: "#7A5A28" },
  completed: { bg: "#E4F1EA", color: "#1F4B37" },
  pending: { bg: "#FBEBD5", color: "#7A5A28" },
  cancelled: { bg: "#F6E1DC", color: "#7A2A1E" },
  "no-show": { bg: "#F6E1DC", color: "#7A2A1E" },
};

const statusStyle = (val: string) =>
  STATUS_COLORS[(val || "").toLowerCase().trim()] || {
    bg: T.panelAlt,
    color: T.textMute,
  };

// Fixed 5-column layout: Patient, Doctor, Status, Date, Time
const SUMMARY_GRID = "1.6fr 1.1fr 0.9fr 1.1fr 1.1fr";
const HEADER_GRID = "1.6fr 1.1fr 0.9fr 1.1fr 1.1fr 14px";

const AppointmentAccordionRow: React.FC<{
  item: AppointmentListItem;
  summaryColumns: string[];
}> = ({ item, summaryColumns }) => {
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const mergedFields: Record<string, string> = {
    ...Object.fromEntries(
      summaryColumns.map((col) => [col, item.summary[col] ?? "-"]),
    ),
    ...(item.detail?.fields ?? {}),
  };

  const hasLineItems =
    item.detail?.lineItems && item.detail.lineItems.length > 0;
  const hasDetail = Object.keys(mergedFields).length > 0 || hasLineItems;

  return (
    <div style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 10px",
          background: isHovered ? "rgba(194, 69, 45, 0.07)" : "transparent",
          border: "none",
          boxShadow: isHovered
            ? `inset 3px 0 0 ${T.coralDark}`
            : "inset 3px 0 0 transparent",
          cursor: hasDetail ? "pointer" : "default",
          textAlign: "left",
          transition: "background 0.18s ease, box-shadow 0.18s ease",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "grid",
            gridTemplateColumns: SUMMARY_GRID,
            gap: 10,
            alignItems: "center",
          }}
        >
          {summaryColumns.map((col, i) => {
            let value = item.summary[col] ?? "-";
            const colLower = col.toLowerCase();
            if (colLower === "date" && value.includes("/")) {
              const parts = value.split("/");
              if (parts.length === 3) value = `${parts[0]}/${parts[1]}`;
            }
            if (colLower === "time" && value.includes("-")) {
              value = value.split("-")[0].trim();
            }
            const isStatusCol = colLower === "status";
            if (isStatusCol) {
              const s = statusStyle(value);
              return (
                <span
                  key={col}
                  style={{
                    display: "inline-block",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: s.bg,
                    color: s.color,
                    whiteSpace: "nowrap",
                    justifySelf: "start",
                  }}
                >
                  {value}
                </span>
              );
            }
            return (
              <span
                key={col}
                style={{
                  fontSize: i === 0 ? 12.5 : 11.5,
                  fontWeight: i === 0 ? 700 : 600,
                  color: i === 0 ? T.text : T.textSoft,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {value}
              </span>
            );
          })}
        </div>
        {hasDetail && (
          <ChevronDown
            size={14}
            color={T.textMute}
            style={{
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.18s ease",
            }}
          />
        )}
      </button>

      {open && hasDetail && (
        <div style={{ padding: "2px 10px 12px 10px", background: T.panelAlt }}>
          {Object.keys(mergedFields).length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 12px",
                marginBottom: item.detail.lineItems?.length ? 8 : 0,
                padding: "8px 4px 4px",
              }}
            >
              {Object.entries(mergedFields).map(([k, v]) => (
                <div key={k} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: T.coralDark,
                      textTransform: "uppercase",
                      letterSpacing: "0.4px",
                    }}
                  >
                    {k}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text,
                      wordBreak: "break-word",
                    }}
                  >
                    {v || "-"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {item.detail.lineItems && item.detail.lineItems.length > 0 && (
            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                overflow: "hidden",
                background: T.panel,
              }}
            >
              {item.detail.lineItems.map((li, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderBottom:
                      idx < item.detail.lineItems!.length - 1
                        ? `1px solid ${T.borderSoft}`
                        : "none",
                  }}
                >
                  <span
                    style={{ fontSize: 11.5, fontWeight: 650, color: T.text }}
                  >
                    {li.label}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      gap: 10,
                      fontSize: 11,
                      color: T.textMute,
                      fontWeight: 600,
                    }}
                  >
                    {Object.entries(li.columns).map(([k, v]) => (
                      <span key={k}>
                        {v}
                        <span style={{ opacity: 0.6, marginLeft: 3 }}>{k}</span>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AppointmentAccordion: React.FC<{ block: AppointmentListBlock }> = ({
  block,
}) => {
  if (!block.items || block.items.length === 0) return null;

  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(28,25,23,0.05)",
        overflow: "hidden",
        background: T.panel,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: HEADER_GRID,
          gap: 10,
          padding: "7px 10px",
          background:
            "linear-gradient(180deg, rgba(194,69,45,0.09), rgba(194,69,45,0.05))",
        }}
      >
        {block.summaryColumns.map((col) => (
          <span
            key={col}
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: T.coralDark,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {col}
          </span>
        ))}
      </div>
      {block.items.map((item) => (
        <AppointmentAccordionRow
          key={item.id}
          item={item}
          summaryColumns={block.summaryColumns}
        />
      ))}
    </div>
  );
};

export default AppointmentAccordion;
