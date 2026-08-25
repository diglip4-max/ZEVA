import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

const variantStyles = {
  red: {
    bg: "bg-red-50 dark:bg-red-500/5",
    border: "border-red-200 dark:border-red-500/30",
    hoverBorder: "hover:border-red-300 dark:hover:border-red-500/50",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-500/5",
    border: "border-orange-200 dark:border-orange-500/30",
    hoverBorder: "hover:border-orange-300 dark:hover:border-orange-500/50",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/30",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-500/50",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-500/5",
    border: "border-emerald-200 dark:border-emerald-500/30",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-500/30",
  },
};

const DEFAULT_DATA = {
  timePeriod: "morning",
  period: { start: "06:00", end: "12:00", label: "Morning" },
  date: null,
  // Morning
  appointments: { count: 0, latest: null, list: [] },
  newLeads: { count: 0, list: [] },
  followUps: { count: 0, list: [] },
  packageRenewals: { count: 0, totalRevenue: 0, list: [] },
  // Afternoon
  openSlots: { count: 0, list: [] },
  hotLeads: { count: 0, list: [] },
  packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
  followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  // Evening
  tomorrowAppointments: { count: 0, list: [] },
  pendingCallbacks: { count: 0, list: [] },
  cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
  endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
};

const formatCurrencyAmount = (value, currencySymbol = "AED") => {
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${currencySymbol} ${formatted}`;
};

const formatLongDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function Priorities({ selectedDate, timePeriod, setTimePeriod }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [data, setData] = useState(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // "leads" | "followUps" | "packages" | null

  const fetchPriorities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const agentToken =
        typeof window !== "undefined"
          ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")
          : null;
      const userToken =
        typeof window !== "undefined"
          ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken")
          : null;
      const token = agentToken || userToken;

      if (!token) {
        setData(DEFAULT_DATA);
        setIsLoading(false);
        return;
      }

      const params = { timePeriod };
      if (selectedDate) {
        params.date = selectedDate;
      }

      const res = await axios.get("/api/agent/priorities", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data && res.data.success && res.data.data) {
        setData({ ...DEFAULT_DATA, ...res.data.data });
      } else {
        setData(DEFAULT_DATA);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load");
      setData(DEFAULT_DATA);
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod, selectedDate]);

  useEffect(() => {
    fetchPriorities();
    // Refresh every 2 minutes to keep counts (especially "new leads
    // needing response") reasonably fresh.
    const interval = setInterval(fetchPriorities, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPriorities]);

  const dateLabel = data.date ? formatLongDate(data.date) : "";
  const periodLabel = data.period?.label || timePeriod;

  // Build the four cards from the live data. The time period decides
  // which 4 cards to render. All data is "today" — only the layout
  // changes when the user switches tabs.
  const cards = useMemo(
    () => buildCardsForPeriod(timePeriod, data, currencySymbol, (which) => setActiveModal(which)),
    [timePeriod, data, currencySymbol],
  );

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Your Priorities
          </h2>
          <p className="mt-2 text-xl text-gray-500 dark:text-gray-400 font-medium">
            ZEVA has ranked what needs your attention
            {dateLabel ? (
              <span className="ml-2 text-base text-gray-400 dark:text-gray-500">
                · {dateLabel}
              </span>
            ) : null}
          </p>
        </div>

        <div className="inline-flex bg-gray-100 dark:bg-white/10 rounded-xl p-1 border border-gray-200 dark:border-white/10 flex-shrink-0">
          {["morning", "afternoon", "evening"].map((p) => (
            <button
              key={p}
              onClick={() => setTimePeriod(p)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 capitalize ${timePeriod === p
                  ? "bg-white dark:bg-white/20 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      ) : null}

      {/* Priority Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {cards.map((card) => {
          const styles = variantStyles[card.variant] || variantStyles.green;
          return (
            <div
              key={card.id}
              className={`${styles.bg} ${styles.border} ${styles.hoverBorder} border-2 rounded-2xl p-6 md:p-7 flex flex-col justify-between min-h-[260px] transition-all duration-200`}
            >
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-4">
                  <span className={`w-3.5 h-3.5 rounded-full ${card.dot} flex-shrink-0 mt-2`} />
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {card.title}
                  </h3>
                </div>
                <p
                  className="text-base md:text-lg text-gray-600 dark:text-gray-300 font-medium leading-relaxed ml-6.5"
                  style={{ marginLeft: "1.625rem" }}
                >
                  {card.details}
                </p>
                {card.subDetails ? (
                  <p
                    className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 ml-6.5"
                    style={{ marginLeft: "1.625rem" }}
                  >
                    {card.subDetails}
                  </p>
                ) : null}
              </div>

              <div
                className="flex flex-wrap gap-3 mt-6"
                style={{ marginLeft: "1.625rem" }}
              >
                {card.buttons.map((btn, idx) => (
                  <button
                    key={idx}
                    disabled={btn.disabled || isLoading}
                    onClick={() => btn.onClick && btn.onClick()}
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-base transition-all duration-200 ${btn.style === "primary"
                        ? "bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-800 dark:text-white border border-gray-200 dark:border-white/20 shadow-sm"
                        : "bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/20 shadow-sm"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        Modals for the cards that need a deeper list view. The simplest
        ones (Confirm All / Send / WhatsApp) are placeholders that emit a
        `console.info` so the dashboard team can wire them up to the
        existing action APIs.
      */}
      {activeModal === "leads" ? (
        <ListModal
          title="Leads needing response"
          subtitle={`${data.newLeads.count} lead${data.newLeads.count === 1 ? "" : "s"} waiting on a reply`}
          onClose={() => setActiveModal(null)}
        >
          {data.newLeads.list.length === 0 ? (
            <EmptyState message="No leads waiting on a reply for this time period." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.newLeads.list.map((l) => (
                <li key={l.conversationId} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {l.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {l.phone || l.email || "—"}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                      <div>Waiting {l.waitingFor}</div>
                      {(() => {
                        // Prefer the channel-aware display text
                        // (subject for email, body for sms/whatsapp).
                        const preview = l.latestMessageDisplay || l.latestMessageContent;
                        if (!preview) return null;
                        const isEmail = (l.latestMessageChannel || "").toLowerCase() === "email";
                        return (
                          <div className="italic max-w-[280px] truncate mt-0.5">
                            {isEmail && l.latestMessageSubject ? (
                              <>
                                <span className="not-italic font-semibold text-gray-700 dark:text-gray-200">
                                  {l.latestMessageSubject}
                                </span>
                                {preview && preview !== l.latestMessageSubject ? (
                                  <span> — {preview}</span>
                                ) : null}
                              </>
                            ) : (
                              <>"{preview}"</>
                            )}
                          </div>
                        );
                      })()}
                      {l.latestMessageChannel ? (
                        <ChannelBadge channel={l.latestMessageChannel} />
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "openSlots" ? (
        <ListModal
          title="Open slots available"
          subtitle={`${data.openSlots.count} unfilled slot${data.openSlots.count === 1 ? "" : "s"} across doctors`}
          onClose={() => setActiveModal(null)}
        >
          {data.openSlots.list.length === 0 ? (
            <EmptyState message="No unfilled slots for this date." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.openSlots.list.map((s) => {
                const label = s.doctorName || "Doctor";
                return (
                  <li
                    key={`slot-${s.doctorId || "x"}-${s.fromTime}`}
                    className="py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                            Doctor
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white truncate">
                            {label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Available slot
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-amber-600 dark:text-amber-300 whitespace-nowrap">
                          {s.fromTimeDisplay || s.fromTime}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "tomorrowAppointments" ? (
        <ListModal
          title="Tomorrow's booked appointments"
          subtitle={`${data.tomorrowAppointments.count} appointment${data.tomorrowAppointments.count === 1 ? "" : "s"} unconfirmed for tomorrow`}
          onClose={() => setActiveModal(null)}
        >
          {data.tomorrowAppointments.list.length === 0 ? (
            <EmptyState message="No booked appointments for tomorrow." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.tomorrowAppointments.list.map((a) => {
                const slot = a.fromTimeDisplay && a.toTimeDisplay
                  ? `${a.fromTimeDisplay} – ${a.toTimeDisplay}`
                  : a.fromTime || "";
                return (
                  <li key={a._id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                          {a.patientName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {a.treatmentName ? a.treatmentName : "No treatment selected"}
                        </div>
                        {a.doctorName ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            with {a.doctorName}
                          </div>
                        ) : null}
                        {a.patientMobile ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {a.patientMobile}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                          {slot}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "cancelledAppointments" ? (
        <ListModal
          title="Cancelled appointments today"
          subtitle={`${data.cancelledAppointments.count} cancelled${data.cancelledAppointments.totalAtRisk > 0 ? ` · ${formatCurrency(data.cancelledAppointments.totalAtRisk, "AED")} at risk` : ""}`}
          onClose={() => setActiveModal(null)}
        >
          {data.cancelledAppointments.list.length === 0 ? (
            <EmptyState message="No cancelled appointments for today." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.cancelledAppointments.list.map((a) => {
                const slot = a.fromTimeDisplay && a.toTimeDisplay
                  ? `${a.fromTimeDisplay} – ${a.toTimeDisplay}`
                  : a.fromTime || "";
                return (
                  <li key={a._id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                          {a.patientName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {a.treatmentName ? a.treatmentName : "No treatment selected"}
                        </div>
                        {a.doctorName ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            with {a.doctorName}
                          </div>
                        ) : null}
                        {a.reason ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
                            “{a.reason}”
                          </div>
                        ) : null}
                        {a.patientMobile ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {a.patientMobile}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-orange-600 dark:text-orange-300 whitespace-nowrap">
                          {slot}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "appointments" ? (
        <ListModal
          title="Appointments booked today"
          subtitle={`${data.appointments.count} booked appointment${data.appointments.count === 1 ? "" : "s"} · day-wide`}
          onClose={() => setActiveModal(null)}
        >
          {data.appointments.list.length === 0 ? (
            <EmptyState message="No booked appointments for today." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.appointments.list.map((a) => {
                const slot = a.fromTimeDisplay && a.toTimeDisplay
                  ? `${a.fromTimeDisplay} – ${a.toTimeDisplay}`
                  : a.fromTime || "";
                return (
                  <li key={a._id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                          {a.patientName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {a.treatmentName ? a.treatmentName : "No treatment selected"}
                        </div>
                        {a.patientMobile ? (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {a.patientMobile}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                          {slot}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "followUps" ? (
        <ListModal
          title="Follow-ups due today"
          subtitle={`${data.followUps.count} lead${data.followUps.count === 1 ? "" : "s"} to follow up with`}
          onClose={() => setActiveModal(null)}
        >
          {data.followUps.list.length === 0 ? (
            <EmptyState message="No follow-ups scheduled for today." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.followUps.list.map((l) => (
                <li key={l._id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {l.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {l.phone || l.email || "—"}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    <div className="font-semibold text-amber-600 dark:text-amber-300">
                      {l.followUpAtDisplay || "Today"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "packages" ? (
        <ListModal
          title="Package renewals"
          subtitle={`${data.packageRenewals.count} package${data.packageRenewals.count === 1 ? "" : "s"} expired today · ${formatCurrencyAmount(data.packageRenewals.totalRevenue, currencySymbol)} potential`}
          onClose={() => setActiveModal(null)}
        >
          {data.packageRenewals.list.length === 0 ? (
            <EmptyState message="No packages expired today." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.packageRenewals.list.map((p, idx) => (
                <li key={`${p.patientId}-${p.packageId}-${idx}`} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {p.patientName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {p.packageName} · {p.paymentStatus}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-300">
                        {formatCurrencyAmount(p.totalPrice, currencySymbol)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Paid {formatCurrencyAmount(p.paidAmount, currencySymbol)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ListModal>
      ) : null}

      {activeModal === "packagesWeek" ? (
        <ListModal
          title="Package renewals this week"
          subtitle={`${data.packageRenewalsWeek.count} package${data.packageRenewalsWeek.count === 1 ? "" : "s"} expiring in 7 days · ${formatCurrencyAmount(data.packageRenewalsWeek.totalRevenue, currencySymbol)} potential`}
          onClose={() => setActiveModal(null)}
        >
          {data.packageRenewalsWeek.list.length === 0 ? (
            <EmptyState message="No packages expiring in the next 7 days." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {data.packageRenewalsWeek.list.map((p, idx) => (
                <li key={`${p.patientId}-${p.packageId}-${idx}`} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {p.patientName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {p.packageName}
                      </div>
                      {p.endDate ? (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Expires {new Date(p.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-300">
                        {formatCurrencyAmount(p.totalPrice, currencySymbol)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ListModal>
      ) : null}
    </div>
  );
}

// ─── period dispatcher + afternoon / evening builders ──────────────────
//
// The morning cards live in `buildCards` (below) and are unchanged.
// Afternoon and evening use different data fields and different copy;
// each builder is self-contained and returns the same
// `{ id, variant, dot, title, details, subDetails, buttons }` shape
// the morning builder does, so the renderer doesn't care which period
// produced the cards.

function buildCardsForPeriod(timePeriod, data, currencySymbol, openModal) {
  const key = String(timePeriod || "morning").toLowerCase();
  if (key === "afternoon") {
    return buildAfternoonCards(data, currencySymbol, openModal);
  }
  if (key === "evening") {
    return buildEveningCards(data, currencySymbol, openModal);
  }
  return buildCards(data, currencySymbol, openModal);
}

function buildAfternoonCards(data, currencySymbol, openModal) {
  const slots = data.openSlots || { count: 0, list: [] };
  const hot = data.hotLeads || { count: 0, list: [] };
  const prw = data.packageRenewalsWeek || { count: 0, totalRevenue: 0, list: [] };
  const fuResp = data.followUpsResponded || { count: 0, list: [], appointmentsBooked: 0 };

  // 1. Open slots unfilled
  const slotsTitle = `${slots.count} open slot${slots.count === 1 ? "" : "s"} unfilled`;
  let slotsDetails = "No unfilled slots for this date.";
  let slotsSub = null;
  if (slots.list[0]) {
    // Surface the doctor context in the subtitle so the agent can
    // see WHICH slot is free without opening the modal.
    const top = slots.list[0];
    if (top.doctorName) {
      slotsDetails = `${top.doctorName} · ${top.fromTimeDisplay || top.fromTime}`;
    } else {
      slotsDetails = `${top.fromTimeDisplay || top.fromTime}`;
    }
    if (slots.count > 1) {
      slotsSub = `+${slots.count - 1} more open slot${slots.count - 1 === 1 ? "" : "s"}`;
    }
  }
  const slotsButtons = [
    {
      label: "Promote",
      style: "primary",
      disabled: slots.count === 0,
      onClick: () => {
        // eslint-disable-next-line no-console
        console.info("[Priorities] Promote slots clicked", slots);
      },
    },
    {
      label: "View",
      style: "secondary",
      disabled: slots.count === 0,
      onClick: () => openModal && openModal("openSlots"),
    },
  ];

  // 2. Hot leads need follow-up
  const hotTitle = `${hot.count} hot lead${hot.count === 1 ? "" : "s"} need follow-up`;
  let hotDetails = "No hot follow-ups due today.";
  let hotSub = null;
  if (hot.list[0]) {
    hotDetails = hot.list[0].name;
    if (hot.list[0].phone) hotSub = hot.list[0].phone;
    if (hot.count > 1) {
      hotSub = `${hotSub || ""}${hotSub ? " · " : ""}+${hot.count - 1} more`;
    }
  }
  const hotButtons = [
    // {
    //   label: "Call",
    //   style: "primary",
    //   disabled: hot.count === 0,
    //   onClick: () => {
    //     // eslint-disable-next-line no-console
    //     console.info("[Priorities] Call hot leads clicked", hot);
    //   },
    // },
    {
      label: "View",
      style: "secondary",
      disabled: hot.count === 0,
      onClick: () => openModal && openModal("hotLeads"),
    },
  ];

  // 3. Package renewals this week
  const prwTitle = `${prw.count} package renewal${prw.count === 1 ? "" : "s"} this week`;
  let prwDetails = "No packages expiring in the next 7 days.";
  if (prw.count > 0) {
    prwDetails = `Potential ${formatCurrencyAmount(prw.totalRevenue, currencySymbol)}`;
  }
  const prwButtons = [
    {
      label: "Review",
      style: "primary",
      disabled: prw.count === 0,
      onClick: () => openModal && openModal("packagesWeek"),
    },
  ];

  // 4. Follow-ups responded
  const fuRespTitle = `${fuResp.count} follow-up${fuResp.count === 1 ? "" : "s"} responded`;
  let fuRespDetails = "No follow-ups replied to today.";
  let fuRespSub = null;
  if (fuResp.count > 0) {
    const booked = Number(fuResp.appointmentsBooked || 0);
    fuRespDetails = `${booked} appointment${booked === 1 ? "" : "s"} booked`;
    if (fuResp.count > booked) {
      fuRespSub = `${fuResp.count - booked} still in conversation`;
    } else if (booked > 0) {
      fuRespSub = "All converted to appointments";
    }
  }
  const fuRespButtons = [
    {
      label: "View",
      style: "secondary",
      disabled: fuResp.count === 0,
      onClick: () => openModal && openModal("followUpsResponded"),
    },
  ];

  return [
    {
      id: "openSlots",
      variant: "yellow",
      dot: "bg-amber-500",
      title: slotsTitle,
      details: slotsDetails,
      subDetails: slotsSub,
      buttons: slotsButtons,
    },
    {
      id: "hotLeads",
      variant: "red",
      dot: "bg-red-500",
      title: hotTitle,
      details: hotDetails,
      subDetails: hotSub,
      buttons: hotButtons,
    },
    {
      id: "packageRenewalsWeek",
      variant: "green",
      dot: "bg-emerald-500",
      title: prwTitle,
      details: prwDetails,
      subDetails: null,
      buttons: prwButtons,
    },
    {
      id: "followUpsResponded",
      variant: "orange",
      dot: "bg-orange-500",
      title: fuRespTitle,
      details: fuRespDetails,
      subDetails: fuRespSub,
      buttons: fuRespButtons,
    },
  ];
}

function buildEveningCards(data, currencySymbol, openModal) {
  const tmw = data.tomorrowAppointments || { count: 0, list: [] };
  const cb = data.pendingCallbacks || { count: 0, list: [] };
  const cnl = data.cancelledAppointments || { count: 0, totalAtRisk: 0, list: [] };
  const eod = data.endOfDayChecklist || { total: 6, completed: 0, remaining: 6, items: [] };

  // 1. Tomorrow appointments unconfirmed
  const tmwTitle = `${tmw.count} tomorrow appointment${tmw.count === 1 ? "" : "s"} unconfirmed`;
  let tmwDetails = "No appointments scheduled for tomorrow yet.";
  let tmwSub = null;
  if (tmw.list[0]) {
    const top = tmw.list[0];
    tmwDetails = `${top.patientName || "Patient"} · ${top.fromTimeDisplay || top.fromTime || ""}`;
    if (tmw.count > 1) {
      tmwSub = `+${tmw.count - 1} more`;
    }
  }
  const tmwButtons = [
    // {
    //   label: "Confirm All",
    //   style: "primary",
    //   disabled: tmw.count === 0,
    //   onClick: () => {
    //     // eslint-disable-next-line no-console
    //     console.info("[Priorities] Confirm tomorrow clicked", tmw);
    //   },
    // },
    {
      label: "View",
      style: "secondary",
      disabled: tmw.count === 0,
      onClick: () => openModal && openModal("tomorrowAppointments"),
    },
  ];

  // 2. Pending callbacks
  const cbTitle = `${cb.count} pending callback${cb.count === 1 ? "" : "s"}`;
  let cbDetails = "No pending callbacks.";
  let cbSub = null;
  if (cb.list[0]) {
    cbDetails = cb.list[0].name;
    if (cb.list[0].phone) cbSub = cb.list[0].phone;
    if (cb.count > 1) {
      cbSub = `${cbSub || ""}${cbSub ? " · " : ""}+${cb.count - 1} more`;
    }
  }
  const cbButtons = [
    {
      label: "Call",
      style: "primary",
      disabled: cb.count === 0,
      onClick: () => {
        // eslint-disable-next-line no-console
        console.info("[Priorities] Call callbacks clicked", cb);
      },
    },
    {
      label: "View",
      style: "secondary",
      disabled: cb.count === 0,
      onClick: () => openModal && openModal("pendingCallbacks"),
    },
  ];

  // 3. Cancelled appointments
  const cnlTitle = `${cnl.count} cancelled appointment${cnl.count === 1 ? "" : "s"}`;
  let cnlDetails = "No cancellations today.";
  if (cnl.count > 0) {
    cnlDetails = `At risk ${formatCurrencyAmount(cnl.totalAtRisk, currencySymbol)}`;
  }
  const cnlButtons = [
    {
      label: "Review",
      style: "primary",
      disabled: cnl.count === 0,
      onClick: () => openModal && openModal("cancelledAppointments"),
    },
  ];

  // 4. End-of-day checklist
  const eodTitle = `End-of-day checklist`;
  const eodDetails = `${eod.completed}/${eod.total} tasks done`;
  const eodSub = eod.remaining > 0 ? `${eod.remaining} remaining` : "All clear";
  const eodButtons = [
    {
      label: "Open Checklist",
      style: "primary",
      disabled: false,
      onClick: () => openModal && openModal("endOfDayChecklist"),
    },
  ];

  return [
    {
      id: "tomorrowAppointments",
      variant: "red",
      dot: "bg-red-500",
      title: tmwTitle,
      details: tmwDetails,
      subDetails: tmwSub,
      buttons: tmwButtons,
    },
    {
      id: "pendingCallbacks",
      variant: "yellow",
      dot: "bg-amber-500",
      title: cbTitle,
      details: cbDetails,
      subDetails: cbSub,
      buttons: cbButtons,
    },
    {
      id: "cancelledAppointments",
      variant: "orange",
      dot: "bg-orange-500",
      title: cnlTitle,
      details: cnlDetails,
      subDetails: null,
      buttons: cnlButtons,
    },
    {
      id: "endOfDayChecklist",
      variant: "green",
      dot: "bg-emerald-500",
      title: eodTitle,
      details: eodDetails,
      subDetails: eodSub,
      buttons: eodButtons,
    },
  ];
}

// ─── card builder ──────────────────────────────────────────────────────

function buildCards(data, currencySymbol, openModal) {
  const apt = data.appointments || { count: 0, latest: null, list: [] };
  const leads = data.newLeads || { count: 0, list: [] };
  const fu = data.followUps || { count: 0, list: [] };
  const pr = data.packageRenewals || { count: 0, totalRevenue: 0, list: [] };

  // 1. Appointments needing confirmation
  const aptTitle = `${apt.count} appointment${apt.count === 1 ? "" : "s"} need confirmation`;
  let aptDetails = "No appointments awaiting confirmation in this period.";
  if (apt.latest) {
    aptDetails = `${apt.latest.patientName} · ${apt.latest.fromTimeDisplay || apt.latest.fromTime}`;
    if (apt.count > 1) {
      aptDetails += ` · +${apt.count - 1} more`;
    }
  }
  const aptButtons = [
    // {
    //   label: "Confirm All",
    //   style: "primary",
    //   disabled: apt.count === 0,
    //   onClick: () => {
    //     // Placeholder: wire to existing "confirm" appointment flow.
    //     // eslint-disable-next-line no-console
    //     console.info("[Priorities] Confirm All clicked", apt);
    //   },
    // },
    {
      label: "View",
      style: "secondary",
      disabled: apt.count === 0,
      onClick: () => openModal && openModal("appointments"),
    },
  ];

  // 2. New leads needing response
  const leadsTitle = `${leads.count} new lead${leads.count === 1 ? "" : "s"} need response`;
  let leadsDetails = "No leads are waiting on a reply in this period.";
  let leadsSub = null;
  if (leads.list[0]) {
    const top = leads.list[0];
    leadsDetails = `${top.name}`;
    // Use the channel-aware display (subject for email, body for
    // sms / whatsapp) instead of the raw content field. The
    // backend already computed `latestMessageDisplay` for us.
    const preview = top.latestMessageDisplay || top.latestMessageContent || "";
    const channelLabel = formatChannelLabel(top.latestMessageChannel);
    const quoted = preview
      ? `"${preview.slice(0, 40)}${preview.length > 40 ? "…" : ""}"`
      : "";
    if (top.waitingFor) {
      leadsSub = `Waiting ${top.waitingFor}${quoted ? ` · ${quoted}` : ""}`;
      if (channelLabel) leadsSub = `${leadsSub} · via ${channelLabel}`;
    } else if (channelLabel) {
      leadsSub = `via ${channelLabel}`;
    }
  }
  const leadsButtons = [
    // {
    //   label: "WhatsApp",
    //   style: "secondary",
    //   disabled: leads.count === 0,
    //   onClick: () => {
    //     // eslint-disable-next-line no-console
    //     console.info("[Priorities] WhatsApp clicked", leads);
    //   },
    // },
    {
      label: "View",
      style: "secondary",
      disabled: leads.count === 0,
      onClick: () => openModal && openModal("leads"),
    },
  ];

  // 3. Follow-ups due today
  const fuTitle = `${fu.count} follow-up${fu.count === 1 ? "" : "s"} due today`;
  let fuDetails = "No follow-ups scheduled for today.";
  let fuSub = null;
  if (fu.list[0]) {
    fuDetails = fu.list[0].name;
    fuSub = fu.list[0].followUpAtDisplay
      ? `Scheduled at ${fu.list[0].followUpAtDisplay}`
      : "Scheduled today";
    if (fu.count > 1) {
      fuSub = `${fuSub} · +${fu.count - 1} more`;
    }
  }
  const fuButtons = [
    {
      label: "View Follow-ups",
      style: "primary",
      disabled: fu.count === 0,
      onClick: () => openModal && openModal("followUps"),
    },
  ];

  // 4. Package renewals
  const prTitle = `${pr.count} package renewal${pr.count === 1 ? "" : "s"}`;
  let prDetails = "No packages expired today.";
  if (pr.count > 0) {
    prDetails = `Potential value ${formatCurrencyAmount(pr.totalRevenue, currencySymbol)}`;
  }
  const prButtons = [
    {
      label: "Review",
      style: "primary",
      disabled: pr.count === 0,
      onClick: () => openModal && openModal("packages"),
    },
  ];

  return [
    {
      id: "appointments",
      variant: "red",
      dot: "bg-red-500",
      title: aptTitle,
      details: aptDetails,
      subDetails: null,
      buttons: aptButtons,
    },
    {
      id: "newLeads",
      variant: "orange",
      dot: "bg-orange-500",
      title: leadsTitle,
      details: leadsDetails,
      subDetails: leadsSub,
      buttons: leadsButtons,
    },
    {
      id: "followUps",
      variant: "yellow",
      dot: "bg-amber-500",
      title: fuTitle,
      details: fuDetails,
      subDetails: fuSub,
      buttons: fuButtons,
    },
    {
      id: "packageRenewals",
      variant: "green",
      dot: "bg-emerald-500",
      title: prTitle,
      details: prDetails,
      subDetails: null,
      buttons: prButtons,
    },
  ];
}

// ─── modal sub-components ──────────────────────────────────────────────

function ListModal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-white/10">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="p-4 border-t border-gray-100 dark:border-white/10 text-right">
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {message}
    </div>
  );
}

// Human-readable label for the Message.channel enum
// ("sms" | "whatsapp" | "email"). Unknown channels fall through as
// the raw capitalized value.
function formatChannelLabel(channel) {
  if (!channel) return "";
  const c = String(channel).toLowerCase();
  if (c === "whatsapp") return "WhatsApp";
  if (c === "sms") return "SMS";
  if (c === "email") return "Email";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// Tiny pill that says where the latest message came from.
function ChannelBadge({ channel }) {
  const c = String(channel || "").toLowerCase();
  const label = formatChannelLabel(channel);
  if (!label) return null;
  // Pick a colour per channel so the agent can scan the modal quickly.
  const palette =
    c === "email"
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
      : c === "whatsapp"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
  return (
    <span
      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${palette}`}
    >
      {label}
    </span>
  );
}

// Pill that renders the appointment status with a colour hint.
// `booked` is the common case (this card only filters on booked), but
// the API also returns the live status so the modal can show what
// actually happened to that booking.
function StatusBadge({ status }) {
  const raw = String(status || "").trim();
  if (!raw) return null;
  const s = raw.toLowerCase();
  let palette = "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200";
  if (s === "booked") {
    palette = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  } else if (s === "approved" || s === "arrived" || s === "waiting" || s === "consultation") {
    palette = "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
  } else if (s === "completed") {
    palette = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  } else if (s === "cancelled" || s === "rejected" || s === "no show" || s === "no-show") {
    palette = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  } else if (s === "package full paid") {
    palette = "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
  } else if (s === "enquiry") {
    palette = "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${palette}`}
    >
      {raw}
    </span>
  );
}
