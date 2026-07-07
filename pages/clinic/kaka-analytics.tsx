"use client";
import {
  ReactElement,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "../_app";
import {
  
 
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
 
  Users,
  CalendarCheck,
  RefreshCw,
  Wifi,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Activity,
  Bot,
  CalendarDays,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "today" | "7d" | "30d";
// "date" is a 4th mode — active only while a specific calendar day is picked.
type Mode = Range | "date";

interface Summary {
  ai_interactions: number;
  patients_addressed: number;
  bookings_completed: number;
  reschedules_completed: number;
  escalations_to_staff?: number;
  channel_web: number;
  channel_whatsapp: number;
}

interface DailyRow {
  date: string;
  conversations: number;
  bookings: number;
  reschedules: number;
}

interface QueryMixRow {
  scenario_key: string;
  count: number;
  percent: number;
}

interface HourRow {
  hour: number;
  volume: number;
}

interface WeeklyRow {
  week: string;
  bookings: number;
  reschedules: number;
}

interface DayDetail {
  date: string;
  total_conversations: number;
  ai_interactions?: number;
  bookings_completed: number;
  reschedules_completed: number;
  escalations_to_staff: number;
  channel_web: number;
  channel_whatsapp: number;
  hourly: HourRow[];
  scenario_breakdown: QueryMixRow[];
}

// ─────────────────────────────────── Config ───────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_AGENT_URL ?? "";

function formatScenarioKey(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso || iso.length !== 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

const C = {
  teal: "#0E9594",
  tealLight: "#E8F7F7",
  tealMid: "#5CC8C7",
  violet: "#5B4CF5",
  violetLight: "#EEECFE",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  sky: "#0284C7",
  skyLight: "#E0F2FE",
  slate: "#0F172A",
  slateLight: "#64748B",
  border: "#E8EDF2",
  surface: "#F8FAFC",
  white: "#FFFFFF",
  mint: "#10B981",
  mintLight: "#D1FAE5",
};

const DONUT_COLORS = [
  "#0E9594",
  "#5B4CF5",
  "#D97706",
  "#0284C7",
  "#10B981",
  "#EC4899",
  "#8B5CF6",
  "#F59E0B",
];

const HOUR_LABEL: Record<number, string> = {
  0: "12 AM",
  1: "1 AM",
  2: "2 AM",
  3: "3 AM",
  4: "4 AM",
  5: "5 AM",
  6: "6 AM",
  7: "7 AM",
  8: "8 AM",
  9: "9 AM",
  10: "10 AM",
  11: "11 AM",
  12: "12 PM",
  13: "1 PM",
  14: "2 PM",
  15: "3 PM",
  16: "4 PM",
  17: "5 PM",
  18: "6 PM",
  19: "7 PM",
  20: "8 PM",
  21: "9 PM",
  22: "10 PM",
  23: "11 PM",
};

const HOUR_TICK: Record<number, string> = {
  0: "12a",
  6: "6a",
  12: "12p",
  18: "6p",
};

function useCountUp(target: number, duration = 900, delay = 0, active = true) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setVal(0);
    const t = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(Math.floor(e * target));
        if (p < 1) raf.current = requestAnimationFrame(step);
        else setVal(target);
      };
      raf.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay, active]);
  return val;
}

function SimpleLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-[#E8EDF2]" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0E9594] animate-spin"
          style={{ borderTopColor: C.teal }}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-[14px] font-medium text-[#0F172A]">{label}</p>
        <p className="text-[12px] text-[#64748B]">KAKA Agent Analytics</p>
      </div>
    </div>
  );
}

function RangeAndDateControl({
  mode,
  pickedDate,
  onRange,
  onDate,
  onClearDate,
}: {
  mode: Mode;
  pickedDate: string;
  onRange: (r: Range) => void;
  onDate: (d: string) => void;
  onClearDate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className="flex items-center gap-1 p-1 rounded-xl border"
        style={{ background: C.surface, borderColor: C.border }}
      >
        {(["today", "7d", "30d"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => onRange(r)}
            className="relative px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200"
            style={
              mode === r
                ? {
                    background: C.white,
                    color: C.slate,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }
                : { color: C.slateLight }
            }
          >
            {r === "today" ? "Today" : r === "7d" ? "7 days" : "30 days"}
          </button>
        ))}
      </div>

      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
        style={{
          background: mode === "date" ? C.violetLight : C.surface,
          borderColor: mode === "date" ? C.violet : C.border,
        }}
      >
        <CalendarDays
          size={14}
          style={{ color: mode === "date" ? C.violet : C.slateLight }}
        />
        <input
          type="date"
          value={pickedDate}
          max={todayISO()}
          onChange={(e) => onDate(e.target.value)}
          aria-label="Pick a specific date"
          className="text-[13px] bg-transparent outline-none cursor-pointer"
          style={{
            color: mode === "date" ? C.violet : C.slate,
            colorScheme: "light",
          }}
        />
        {mode === "date" && (
          <button
            onClick={onClearDate}
            aria-label="Clear date"
            className="ml-0.5"
          >
            <X size={13} style={{ color: C.violet }} />
          </button>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  accentLight,
  delay = 0,
}: {
  label: string;
  value: number;
  delta?: number;
  icon: React.ElementType;
  accent: string;
  accentLight: string;
  delay?: number;
}) {
  const animated = useCountUp(value, 1000, delay);
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className="group relative bg-white rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accentLight }}
        >
          <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
        </div>
        {delta !== undefined && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={
              up
                ? { background: C.mintLight, color: "#059669" }
                : { background: "#FEE2E2", color: "#DC2626" }
            }
          >
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p
        className="text-[11px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: C.slateLight }}
      >
        {label}
      </p>
      <p
        className="text-[30px] font-bold leading-none tracking-tight tabular-nums"
        style={{ color: C.slate }}
      >
        {animated.toLocaleString()}
      </p>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: accent }}
      />
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white rounded-xl p-3 text-sm min-w-[130px]"
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
      }}
    >
      <p
        className="font-semibold text-xs mb-2 pb-2"
        style={{ color: C.slate, borderBottom: `1px solid ${C.border}` }}
      >
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color ?? p.fill }}
          />
          <span
            className="text-[11px] capitalize"
            style={{ color: C.slateLight }}
          >
            {p.name ?? p.dataKey}:
          </span>
          <span
            className="font-bold text-[11px] ml-auto pl-2 tabular-nums"
            style={{ color: C.slate }}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
  accent = C.teal,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-6 rounded-full"
            style={{ background: accent }}
          />
          <div>
            <h3
              className="text-[14px] font-semibold"
              style={{ color: C.slate }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-[12px] mt-0.5" style={{ color: C.slateLight }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text = "No data for this period yet." }: { text?: string }) {
  return (
    <div
      className="flex items-center justify-center h-40 rounded-xl text-sm"
      style={{ background: C.surface, color: C.slateLight }}
    >
      {text}
    </div>
  );
}

// ────────────────────────────────── Main Page ──────────────────────────────────

const KakaAnalyticsPage: NextPageWithLayout = function KakaAnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [pickedDate, setPickedDate] = useState<string>(""); // "" = no date picked, range mode active
  const mode: Mode = pickedDate ? "date" : range;

  // Range-mode data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [mix, setMix] = useState<QueryMixRow[]>([]);
  const [hours, setHours] = useState<HourRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);

  // Date-mode data (kept separate from range data so toggling back doesn't refetch)
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Connecting to KAKA…");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const clinicToken =
    typeof window !== "undefined"
      ? (localStorage.getItem("clinicToken") ?? "")
      : "";

  // ── Fetch for range mode (today / 7d / 30d) ────────────────────────────────
  const fetchRange = useCallback(async () => {
    if (!clinicToken) return;
    setLoading(true);
    setVisible(false);
    setErrorMsg(null);

    const labels = [
      "Connecting to KAKA…",
      "Pulling conversation logs…",
      "Crunching numbers…",
      "Almost there…",
    ];
    let idx = 0;
    setLoadingLabel(labels[0]);
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, labels.length - 1);
      setLoadingLabel(labels[idx]);
    }, 700);

    try {
      const qs = `range=${range}`;
      const authHeaders = { Authorization: `Bearer ${clinicToken}` };
      const [s, d, q, h, w] = await Promise.all([
        fetch(`${BASE}/analytics/summary?${qs}`, { headers: authHeaders }).then(
          (r) => r.json(),
        ),
        fetch(`${BASE}/analytics/daily?${qs}`, { headers: authHeaders }).then(
          (r) => r.json(),
        ),
        fetch(`${BASE}/analytics/query-mix?${qs}`, {
          headers: authHeaders,
        }).then((r) => r.json()),
        fetch(`${BASE}/analytics/peak-hours?${qs}`, {
          headers: authHeaders,
        }).then((r) => r.json()),
        fetch(`${BASE}/analytics/weekly?${qs}`, { headers: authHeaders }).then(
          (r) => r.json(),
        ),
      ]);
      setSummary(s);
      setDaily(d.data ?? []);
      setMix(q.data ?? []);
      setHours(h.data ?? []);
      setWeekly(w.data ?? []);
    } catch (e) {
      console.error("Analytics fetch failed:", e);
      setErrorMsg("Couldn't load analytics. Try refreshing.");
    } finally {
      clearInterval(timer);
      setLoading(false);
      setHasLoadedOnce(true);
      setTimeout(() => setVisible(true), 60);
    }
  }, [clinicToken, range]);

  // ── Fetch for date mode (a single picked day) ───────────────────────────────
  const fetchDay = useCallback(
    async (date: string) => {
      if (!clinicToken || !date) return;
      setLoading(true);
      setVisible(false);
      setErrorMsg(null);
      setLoadingLabel(`Loading ${fmtDate(date)}…`);

      try {
        const qs = `date=${date}`;
        const res = await fetch(`${BASE}/analytics/day-detail?${qs}`, {
          headers: { Authorization: `Bearer ${clinicToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Request failed (${res.status})`);
        }
        const data: DayDetail = await res.json();
        setDayDetail(data);
      } catch (e: any) {
        console.error("Day detail fetch failed:", e);
        setDayDetail(null);
        setErrorMsg(e.message || "Couldn't load that date.");
      } finally {
        setLoading(false);
        setHasLoadedOnce(true);
        setTimeout(() => setVisible(true), 60);
      }
    },
    [clinicToken],
  );

  // Refetch whenever the active mode or its key input changes.
  useEffect(() => {
    if (mode === "date") {
      fetchDay(pickedDate);
    } else {
      fetchRange();
    }
  }, [mode, range, pickedDate, fetchDay, fetchRange]);

  const refresh = useCallback(() => {
    if (mode === "date") fetchDay(pickedDate);
    else fetchRange();
  }, [mode, pickedDate, fetchDay, fetchRange]);

  // ── Unify range-data and day-data into the same shapes the page renders ────
  const activeSummary: Summary | null = useMemo(() => {
    if (mode !== "date") return summary;
    if (!dayDetail) return null;
    return {
      ai_interactions:
        dayDetail.ai_interactions ?? dayDetail.total_conversations,
      patients_addressed: dayDetail.total_conversations,
      bookings_completed: dayDetail.bookings_completed,
      reschedules_completed: dayDetail.reschedules_completed,
      escalations_to_staff: dayDetail.escalations_to_staff,
      channel_web: dayDetail.channel_web,
      channel_whatsapp: dayDetail.channel_whatsapp,
    };
  }, [mode, summary, dayDetail]);

  const activeHours: HourRow[] =
    mode === "date" ? (dayDetail?.hourly ?? []) : hours;
  const activeMix: QueryMixRow[] =
    mode === "date" ? (dayDetail?.scenario_breakdown ?? []) : mix;

  const volumeChartData = mode === "date" ? (dayDetail?.hourly ?? []) : daily;
  // const volumeChartKey = mode === "date" ? "volume" : "conversations";
  // const volumeChartXKey = mode === "date" ? "hour" : "date";

  const maxHour = activeHours.length
    ? Math.max(...activeHours.map((h) => h.volume))
    : 1;
  const peakHour = activeHours.find((h) => h.volume === maxHour);
  const totalMix = activeMix.reduce((s, r) => s + r.count, 0) || 1;
  const webPct = activeSummary
    ? Math.round(
        (activeSummary.channel_web /
          (activeSummary.channel_web + activeSummary.channel_whatsapp || 1)) *
          100,
      )
    : 0;

  const heatStop = (vol: number) => {
    if (!vol) return { bg: "#F1F5F9", text: "#94A3B8" };
    const r = vol / maxHour;
    if (r > 0.75) return { bg: C.teal, text: "#fff" };
    if (r > 0.5) return { bg: "#3BBCBA", text: "#fff" };
    if (r > 0.25) return { bg: "#82D9D8", text: C.slate };
    return { bg: "#C0EEED", text: C.slate };
  };

  // Daily rows from API come as yyyy-mm-dd; reformat for display in the chart tooltip/axis
  const dailyForDisplay: DailyRow[] = daily.map((row) => ({
    ...row,
    date: fmtDate(row.date),
  }));

  // Weekly rows: week-start is yyyy-mm-dd from API; display as "dd-mm – dd-mm" range
  const weeklyForDisplay: WeeklyRow[] = weekly.map((row) => {
    if (!row.week || row.week.length !== 10) return row;
    const start = new Date(row.week);
    const end = new Date(row.week);
    end.setDate(end.getDate() + 6);
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = `${pad(start.getDate())}-${pad(start.getMonth() + 1)}`;
    const e = `${pad(end.getDate())}-${pad(end.getMonth() + 1)}`;
    return { ...row, week: `${s} – ${e}` };
  });

  if (loading && !hasLoadedOnce) {
    return <SimpleLoader label={loadingLabel} />;
  }

  const subtitleForMode =
    mode === "date"
      ? `KAKA's activity on ${fmtDate(pickedDate)}`
      : "KAKA Agent · Zeva Clinic performance insights";
  const hourVolumeData: HourRow[] =
    mode === "date" ? (volumeChartData as HourRow[]) : [];

  return (
    <div className="min-h-screen" style={{ background: C.surface }}>
      {loading && hasLoadedOnce && (
        <div
          className="fixed top-0 left-0 right-0 h-[2px] z-50 overflow-hidden"
          style={{ background: C.border }}
        >
          <div
            className="h-full animate-loading-bar"
            style={{
              width: "40%",
              background: `linear-gradient(90deg, ${C.violet}, ${C.teal})`,
            }}
          />
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="bg-white border-b px-8 py-6"
        style={{ borderColor: C.border }}
      >
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: C.tealLight }}
            >
              <Bot size={18} style={{ color: C.teal }} strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: C.slate }}
                >
                  Owner Analytics
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: C.mintLight, color: "#059669" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: "#10B981" }}
                  />
                  Live
                </span>
              </div>
              <p className="text-[13px]" style={{ color: C.slateLight }}>
                {subtitleForMode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RangeAndDateControl
              mode={mode}
              pickedDate={pickedDate}
              onRange={(r) => {
                setPickedDate("");
                setRange(r);
              }}
              onDate={(d) => setPickedDate(d)}
              onClearDate={() => setPickedDate("")}
            />
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
              style={{
                color: C.slateLight,
                borderColor: C.border,
                background: C.white,
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div
        className={`px-8 py-7 max-w-[1400px] mx-auto space-y-6 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {errorMsg && (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "#FEF2F2",
              color: "#DC2626",
              border: "1px solid #FECACA",
            }}
          >
            {errorMsg}
          </div>
        )}

        {mode === "date" &&
          activeSummary &&
          activeSummary.patients_addressed === 0 && (
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              style={{
                background: C.violetLight,
                color: C.violet,
                border: `1px solid ${C.violet}33`,
              }}
            >
              No KAKA activity recorded on {fmtDate(pickedDate)}.
            </div>
          )}

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="AI Interactions"
            value={activeSummary?.ai_interactions ?? 0}
            delta={mode === "date" ? undefined : 15}
            icon={Activity}
            accent={C.violet}
            accentLight={C.violetLight}
            delay={0}
          />
          <KpiCard
            label="Patients Addressed"
            value={activeSummary?.patients_addressed ?? 0}
            delta={mode === "date" ? undefined : 9}
            icon={Users}
            accent={C.sky}
            accentLight={C.skyLight}
            delay={60}
          />
          <KpiCard
            label="Bookings Completed"
            value={activeSummary?.bookings_completed ?? 0}
            delta={mode === "date" ? undefined : 18}
            icon={CalendarCheck}
            accent={C.teal}
            accentLight={C.tealLight}
            delay={120}
          />
          <KpiCard
            label="Reschedules Done"
            value={activeSummary?.reschedules_completed ?? 0}
            delta={mode === "date" ? undefined : -4}
            icon={RefreshCw}
            accent={C.amber}
            accentLight={C.amberLight}
            delay={180}
          />
        </div>

        {/* ── Conversation Volume / Activity by hour ───────────────────────── */}
        <Card
          title={mode === "date" ? "Activity by Hour" : "Conversation Volume"}
          subtitle={
            mode === "date"
              ? `Hour-by-hour breakdown for ${fmtDate(pickedDate)}`
              : "Daily patient conversations handled by KAKA"
          }
          accent={C.violet}
        >
          {volumeChartData.length === 0 ? (
            <Empty />
          ) : mode !== "date" && daily.length === 1 ? (
            <div className="flex flex-col items-center justify-center h-[220px] gap-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: C.violetLight }}
              >
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: C.violet }}
                >
                  {daily[0].conversations}
                </span>
              </div>
              <p className="text-[13px] font-medium" style={{ color: C.slate }}>
                {fmtDate(daily[0].date)}
              </p>
              <p className="text-[12px]" style={{ color: C.slateLight }}>
                Only 1 day of data — the line chart will appear once more days
                are recorded.
              </p>
            </div>
          ) : mode === "date" ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={hourVolumeData}
                margin={{ top: 6, right: 6, bottom: 0, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#F1F5F9"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => HOUR_TICK[h] ?? ""}
                  tick={{ fontSize: 11, fill: C.slateLight }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: C.slateLight }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTip />}
                  formatter={(v) => [Number(v ?? 0), "Events"]}
                  cursor={{ fill: C.surface }}
                />
                <Bar
                  dataKey="volume"
                  name="Events"
                  fill={C.violet}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={dailyForDisplay}
                margin={{ top: 6, right: 6, bottom: 0, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#F1F5F9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: C.slateLight }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(
                    0,
                    Math.floor(dailyForDisplay.length / 7) - 1,
                  )}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: C.slateLight }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{
                    stroke: C.violet,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  name="Conversations"
                  stroke={C.violet}
                  strokeWidth={2.5}
                  dot={{
                    r: 3.5,
                    fill: C.violet,
                    stroke: C.white,
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: C.violet,
                    stroke: C.white,
                    strokeWidth: 2.5,
                  }}
                  isAnimationActive
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── Middle row: Weekly bar (range mode only) + Query mix ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mode === "date" ? (
            <Card
              title="Channel Split"
              subtitle={`Web vs WhatsApp on ${fmtDate(pickedDate)}`}
              accent={C.sky}
            >
              <div className="flex flex-col gap-5 items-center py-2">
                <div className="flex items-center justify-center gap-8 w-full">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: C.skyLight,
                        border: "1px solid #BAE6FD",
                      }}
                    >
                      <Wifi
                        size={22}
                        style={{ color: C.sky }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <p
                      className="text-[26px] font-bold tabular-nums mt-1"
                      style={{ color: C.slate }}
                    >
                      {webPct}%
                    </p>
                    <p className="text-[12px]" style={{ color: C.slateLight }}>
                      Web
                    </p>
                    <p
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: C.sky }}
                    >
                      {activeSummary?.channel_web.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-px h-20" style={{ background: C.border }} />
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "#F0FBF4",
                        border: "1px solid #BBF7D0",
                      }}
                    >
                      <Smartphone
                        size={22}
                        className="text-[#16A34A]"
                        strokeWidth={1.8}
                      />
                    </div>
                    <p
                      className="text-[26px] font-bold tabular-nums mt-1"
                      style={{ color: C.slate }}
                    >
                      {100 - webPct}%
                    </p>
                    <p className="text-[12px]" style={{ color: C.slateLight }}>
                      WhatsApp
                    </p>
                    <p
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: "#16A34A" }}
                    >
                      {activeSummary?.channel_whatsapp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="w-full">
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: C.surface }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${webPct}%`,
                        background: `linear-gradient(90deg, ${C.sky}, ${C.teal})`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card
              title="Bookings & Reschedules"
              subtitle="Weekly comparison"
              accent={C.teal}
            >
              <div className="flex items-center gap-5 mb-4">
                <span
                  className="flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: C.slateLight }}
                >
                  <span
                    className="w-3 h-2 rounded-sm inline-block"
                    style={{ background: C.teal }}
                  />
                  Bookings
                </span>
                <span
                  className="flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: C.slateLight }}
                >
                  <span
                    className="w-3 h-2 rounded-sm inline-block"
                    style={{ background: C.amber }}
                  />
                  Reschedules
                </span>
              </div>
              {weekly.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={weeklyForDisplay}
                    margin={{ top: 4, right: 4, bottom: 0, left: -10 }}
                    barCategoryGap="35%"
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#F1F5F9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: C.slateLight }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.slateLight }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTip />}
                      cursor={{ fill: C.surface }}
                    />
                    <Bar
                      dataKey="bookings"
                      name="Bookings"
                      fill={C.teal}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="reschedules"
                      name="Reschedules"
                      fill={C.amber}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={800}
                      animationBegin={120}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}

          {/* Query mix — same card, fed by activeMix regardless of mode */}
          <Card
            title="Query Mix"
            subtitle={
              mode === "date"
                ? `Scenario breakdown for ${fmtDate(pickedDate)}`
                : "Share of conversations by scenario type"
            }
            accent={C.sky}
          >
            {activeMix.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-44 h-44 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeMix}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="count"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                        isAnimationActive
                        animationDuration={800}
                      >
                        {activeMix.map((_, i) => (
                          <Cell
                            key={i}
                            fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => [
                          `${Number(v ?? 0)} events`,
                          formatScenarioKey(String(name)),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: C.slate }}
                    >
                      {totalMix}
                    </span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                      style={{ color: C.slateLight }}
                    >
                      events
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 flex-1 w-full">
                  {activeMix.slice(0, 7).map((item, i) => (
                    <div
                      key={item.scenario_key}
                      className="flex items-center gap-2.5"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                      <span
                        className="text-[12px] flex-1 truncate"
                        style={{ color: "#374151" }}
                      >
                        {formatScenarioKey(item.scenario_key)}
                      </span>
                      <div
                        className="w-16 h-1.5 rounded-full overflow-hidden"
                        style={{ background: C.surface }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${item.percent}%`,
                            background: DONUT_COLORS[i % DONUT_COLORS.length],
                          }}
                        />
                      </div>
                      <span
                        className="text-[12px] font-semibold w-9 text-right tabular-nums"
                        style={{ color: C.slate }}
                      >
                        {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── Bottom row: Peak hours + Channel split (range mode only) ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card
            title="Peak Hours"
            subtitle={
              mode === "date"
                ? `Hour-of-day pattern for ${fmtDate(pickedDate)}`
                : "Conversation volume by hour of day (IST)"
            }
            className={mode === "date" ? "lg:col-span-3" : "lg:col-span-2"}
            accent={C.teal}
          >
            {activeHours.every((h) => h.volume === 0) ? (
              <Empty />
            ) : (
              <>
                <div className="grid grid-cols-12 gap-1.5 mb-2">
                  {activeHours.map((h) => {
                    const { bg, text } = heatStop(h.volume);
                    const isHovered = hoveredHour === h.hour;
                    return (
                      <div
                        key={h.hour}
                        className="relative aspect-square rounded-lg flex items-center justify-center cursor-default transition-transform duration-100"
                        style={{
                          background: bg,
                          transform: isHovered ? "scale(1.12)" : "scale(1)",
                          zIndex: isHovered ? 10 : 1,
                          boxShadow: isHovered
                            ? "0 4px 12px rgba(0,0,0,0.12)"
                            : "none",
                        }}
                        onMouseEnter={() => setHoveredHour(h.hour)}
                        onMouseLeave={() => setHoveredHour(null)}
                      >
                        {isHovered && h.volume > 0 && (
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: text }}
                          >
                            {h.volume}
                          </span>
                        )}
                        {isHovered && (
                          <div
                            className="absolute pointer-events-none z-20 whitespace-nowrap text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{
                              bottom: "calc(100% + 6px)",
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: C.slate,
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                            }}
                          >
                            {HOUR_LABEL[h.hour]}: {h.volume}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-12 gap-1.5 mb-4">
                  {activeHours.map((h) => (
                    <div
                      key={h.hour}
                      className="text-center text-[9px] font-medium"
                      style={{ color: C.slateLight }}
                    >
                      {HOUR_TICK[h.hour] ?? ""}
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-center gap-2 pt-3 border-t"
                  style={{ borderColor: C.border }}
                >
                  <span className="text-[11px]" style={{ color: C.slateLight }}>
                    Low
                  </span>
                  {["#F1F5F9", "#C0EEED", "#82D9D8", "#3BBCBA", C.teal].map(
                    (col) => (
                      <div
                        key={col}
                        className="w-6 h-3 rounded-sm"
                        style={{ background: col }}
                      />
                    ),
                  )}
                  <span className="text-[11px]" style={{ color: C.slateLight }}>
                    High
                  </span>
                  <span
                    className="ml-auto text-[12px] font-semibold"
                    style={{ color: C.teal }}
                  >
                    Peak: {peakHour ? HOUR_LABEL[peakHour.hour] : "—"}
                  </span>
                </div>
              </>
            )}
          </Card>

          {mode !== "date" && (
            <Card
              title="Channel Split"
              subtitle="Web vs WhatsApp"
              accent={C.sky}
            >
              <div className="flex flex-col gap-5 items-center py-2">
                <div className="flex items-center justify-center gap-8 w-full">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: C.skyLight,
                        border: "1px solid #BAE6FD",
                      }}
                    >
                      <Wifi
                        size={22}
                        style={{ color: C.sky }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <p
                      className="text-[26px] font-bold tabular-nums mt-1"
                      style={{ color: C.slate }}
                    >
                      {webPct}%
                    </p>
                    <p className="text-[12px]" style={{ color: C.slateLight }}>
                      Web
                    </p>
                    <p
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: C.sky }}
                    >
                      {activeSummary?.channel_web.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-px h-20" style={{ background: C.border }} />
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "#F0FBF4",
                        border: "1px solid #BBF7D0",
                      }}
                    >
                      <Smartphone
                        size={22}
                        className="text-[#16A34A]"
                        strokeWidth={1.8}
                      />
                    </div>
                    <p
                      className="text-[26px] font-bold tabular-nums mt-1"
                      style={{ color: C.slate }}
                    >
                      {100 - webPct}%
                    </p>
                    <p className="text-[12px]" style={{ color: C.slateLight }}>
                      WhatsApp
                    </p>
                    <p
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: "#16A34A" }}
                    >
                      {activeSummary?.channel_whatsapp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="w-full">
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: C.surface }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${webPct}%`,
                        background: `linear-gradient(90deg, ${C.sky}, ${C.teal})`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px]" style={{ color: C.sky }}>
                      Web
                    </span>
                    <span className="text-[10px]" style={{ color: "#16A34A" }}>
                      WhatsApp
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1 pb-4">
          <div
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: C.slateLight }}
          >
            <Activity size={11} />
            {mode === "date"
              ? `Showing ${fmtDate(pickedDate)}`
              : "Live — updates on refresh"}
          </div>
          <span className="text-[11px]" style={{ color: "#CBD5E1" }}>
            KAKA · Powered by Diglip7
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-250%);
          }
          100% {
            transform: translateX(350%);
          }
        }
        .animate-loading-bar {
          animation: loading-bar 1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-loading-bar,
          .animate-spin,
          .animate-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

KakaAnalyticsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedKakaAnalyticsPage = withClinicAuth(
  KakaAnalyticsPage,
) as NextPageWithLayout;
ProtectedKakaAnalyticsPage.getLayout = KakaAnalyticsPage.getLayout;

export default ProtectedKakaAnalyticsPage;
