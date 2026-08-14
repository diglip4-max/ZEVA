import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

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
  appointments: { count: 0, latest: null, list: [] },
  newLeads: { count: 0, list: [] },
  followUps: { count: 0, list: [] },
  packageRenewals: { count: 0, totalRevenue: 0, list: [] },
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

export default function Priorities({ selectedDate, timePeriod, setTimePeriod, currencySymbol = "AED" }) {
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

  // Build the four cards from the live data. We pass `openModal` so
  // card-level "View" buttons can open the local detail modal.
  const cards = useMemo(
    () => buildCards(data, currencySymbol, (which) => setActiveModal(which)),
    [data, currencySymbol],
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
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 capitalize ${
                timePeriod === p
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
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-base transition-all duration-200 ${
                      btn.style === "primary"
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
                      {l.latestMessageContent ? (
                        <div className="italic max-w-[280px] truncate">
                          "{l.latestMessageContent}"
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
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
    </div>
  );
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
    {
      label: "Confirm All",
      style: "primary",
      disabled: apt.count === 0,
      onClick: () => {
        // Placeholder: wire to existing "confirm" appointment flow.
        // eslint-disable-next-line no-console
        console.info("[Priorities] Confirm All clicked", apt);
      },
    },
    {
      label: "View",
      style: "secondary",
      disabled: apt.count === 0,
      onClick: () => {
        // Lightweight inline expansion: scroll to / open the latest
        // appointment detail elsewhere in the dashboard.
        // eslint-disable-next-line no-console
        console.info("[Priorities] View appointments clicked", apt);
      },
    },
  ];

  // 2. New leads needing response
  const leadsTitle = `${leads.count} new lead${leads.count === 1 ? "" : "s"} need response`;
  let leadsDetails = "No leads are waiting on a reply in this period.";
  let leadsSub = null;
  if (leads.list[0]) {
    const top = leads.list[0];
    leadsDetails = `${top.name}`;
    leadsSub = top.waitingFor
      ? `Waiting ${top.waitingFor}${top.latestMessageContent ? ` · "${top.latestMessageContent.slice(0, 40)}${top.latestMessageContent.length > 40 ? "…" : ""}"` : ""}`
      : null;
  }
  const leadsButtons = [
    {
      label: "WhatsApp",
      style: "secondary",
      disabled: leads.count === 0,
      onClick: () => {
        // eslint-disable-next-line no-console
        console.info("[Priorities] WhatsApp clicked", leads);
      },
    },
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
