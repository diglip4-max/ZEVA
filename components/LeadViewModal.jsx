import React, { useEffect, useMemo } from "react";
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  User,
  Users,
  Globe,
  Tag,
  Stethoscope,
  StickyNote,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  Cake,
} from "lucide-react";
import { useRouter } from "next/router";
import { ModalPortal } from "@/lib/modalPortal";

const STATUS_STYLES = {
  New: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20",
  Contacted:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
  Engaged:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
  Qualified:
    "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20",
  Booked:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  Confirmed:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  Visited:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
  "Follow-up":
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  "No-show":
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
  "Not Interested":
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
};

const AVATAR_COLORS = [
  "from-teal-400 to-teal-700",
  "from-indigo-400 to-indigo-700",
  "from-rose-400 to-rose-700",
  "from-amber-400 to-amber-700",
  "from-emerald-400 to-emerald-700",
  "from-violet-400 to-violet-700",
  "from-cyan-400 to-cyan-700",
  "from-pink-400 to-pink-700",
];

const getInitials = (name) => {
  if (!name) return "L";
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "L"
  );
};

const getAvatarColor = (name) =>
  name ? AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] : AVATAR_COLORS[0];

const formatDate = (value, opts) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", opts);
};

const formatTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getAddedBy = (addedBy) => {
  if (!addedBy) return null;
  if (typeof addedBy === "object") return addedBy.name || null;
  return String(addedBy);
};

const CARD =
  "rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60";

function Field({ icon, label, children }) {
  return (
    <div className={CARD}>
      <div className="mb-1.5 flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, count }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
        {icon}
      </span>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
      {typeof count === "number" && count > 0 && (
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      )}
    </div>
  );
}

export default function LeadViewModal({ lead, onClose }) {
  const router = useRouter()
  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!lead) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lead, onClose]);

  const followUps = useMemo(() => {
    const now = new Date();
    const list = (lead?.followUps || [])
      .filter((f) => f && f.date && !Number.isNaN(new Date(f.date).getTime()))
      .map((f) => {
        const date = new Date(f.date);
        const isToday = date.toDateString() === now.toDateString();
        const isPast = date < now && !isToday;
        return {
          date,
          isToday,
          isPast,
          dateStr: formatDate(f.date, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          timeStr: formatTime(f.date),
          addedBy: getAddedBy(f.addedBy),
        };
      });
    const upcoming = list
      .filter((f) => !f.isPast)
      .sort((a, b) => a.date - b.date);
    const past = list.filter((f) => f.isPast).sort((a, b) => b.date - a.date);
    return [...upcoming, ...past];
  }, [lead]);

  if (!lead) return null;

  const treatments = (lead.treatments || [])
    .map((t) => ({
      main: t.subTreatment || t.treatment?.name || "Unknown",
      parent: t.subTreatment ? t.treatment?.name : null,
    }))
    .filter(Boolean);

  const notes = lead.notes || [];
  const assigned = (lead.assignedTo || [])
    .map((a) => a?.user?.name)
    .filter(Boolean);

  const statusClass =
    STATUS_STYLES[lead.status] ||
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20";

  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  const waNumber = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-md sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
      >
        <div
          className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-900/25 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 flex-shrink-0 bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500" />

          {/* Header */}
          <div className="relative flex-shrink-0 overflow-hidden border-b border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-teal-300/25 blur-3xl dark:bg-teal-500/15" />
            <div className="relative flex items-start gap-4">
              <div
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarColor(lead.name)} text-lg font-bold text-white shadow-lg shadow-slate-900/15 ring-4 ring-white dark:ring-slate-900`}
              >
                {getInitials(lead.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {lead.name || "Unnamed lead"}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClass}`}
                  >
                    {lead.status || "New"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {lead.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone}
                    </span>
                  )}
                  {lead.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {lead.email}
                    </span>
                  )}
                  {lead.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Added {formatDate(lead.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {/* Facts */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Gender">
                {lead.gender || "—"}
              </Field>
              <Field icon={<Cake className="h-3.5 w-3.5" />} label="Age">
                {lead.age || "—"}
              </Field>
              <Field icon={<Globe className="h-3.5 w-3.5" />} label="Source">
                {lead.source ? (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {lead.source}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              <Field icon={<Tag className="h-3.5 w-3.5" />} label="Offer tag">
                {lead.offerTag ? (
                  <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20">
                    {lead.offerTag}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
            </div>

            {/* Treatments + Assigned */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={CARD}>
                <SectionTitle
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  title="Treatments"
                  count={treatments.length}
                />
                {treatments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {treatments.map((t, i) => (
                      <span
                        key={`${t.main}-${i}`}
                        className="inline-flex flex-col rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800"
                      >
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {t.main}
                        </span>
                        {t.parent && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t.parent}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    No treatment selected
                  </p>
                )}
              </div>

              <div className={CARD}>
                <SectionTitle
                  icon={<Users className="h-3.5 w-3.5" />}
                  title="Assigned to"
                  count={assigned.length}
                />
                {assigned.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assigned.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 dark:bg-slate-800"
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(name)} text-[9px] font-bold text-white`}
                        >
                          {getInitials(name)}
                        </span>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                          {name}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-400 dark:text-slate-500">
                    Unassigned
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className={CARD}>
              <SectionTitle
                icon={<StickyNote className="h-3.5 w-3.5" />}
                title="Notes"
                count={notes.length}
              />
              {notes.length > 0 ? (
                <ul className="space-y-2">
                  {notes.map((n, i) => {
                    const by = getAddedBy(n.addedBy);
                    return (
                      <li
                        key={i}
                        className="rounded-lg border-l-2 border-teal-500 bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                          {n.text}
                        </p>
                        {(by || n.createdAt) && (
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            {by}
                            {by && n.createdAt ? " · " : ""}
                            {n.createdAt &&
                              formatDate(n.createdAt, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">No notes yet</p>
              )}
            </div>

            {/* Follow-ups */}
            <div className={CARD}>
              <SectionTitle
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                title="Follow-ups"
                count={followUps.length}
              />
              {followUps.length > 0 ? (
                <div className="space-y-2">
                  {followUps.map((f, i) => {
                    const tone = f.isToday
                      ? {
                        wrap: "border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10",
                        icon: "text-sky-600 dark:text-sky-300",
                        title: "text-sky-900 dark:text-sky-100",
                        pill: "bg-sky-200 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
                        label: "Today",
                      }
                      : f.isPast
                        ? {
                          wrap: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40",
                          icon: "text-slate-400 dark:text-slate-500",
                          title: "text-slate-600 dark:text-slate-300",
                          pill: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
                          label: "Past",
                        }
                        : {
                          wrap: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
                          icon: "text-emerald-600 dark:text-emerald-300",
                          title: "text-emerald-900 dark:text-emerald-100",
                          pill: "bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
                          label: "Upcoming",
                        };
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-xl border p-3 ${tone.wrap}`}
                      >
                        <span className={`mt-0.5 flex-shrink-0 ${tone.icon}`}>
                          {f.isPast ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Hourglass className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-semibold ${tone.title}`}>
                              {f.dateStr}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.pill}`}
                            >
                              {tone.label}
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {f.timeStr}
                            </span>
                            {f.addedBy && <span>· Added by {f.addedBy}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No follow-ups scheduled
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              {phoneDigits && (
                <>
                  <button
                    onClick={() => {
                      if (
                        router.pathname?.includes("/clinic/")
                      ) {
                        router.push(
                          `/clinic/inbox?leadId=${lead._id}`,
                        );
                      } else if (
                        router.pathname?.includes("/staff/")
                      ) {
                        router.push(
                          `/staff/clinic_inbox?leadId=${lead._id}`,
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send WhatsApp
                  </button>
                </>
              )}
              {
                lead?.email &&
                <button
                  onClick={() => {
                    if (
                      router.pathname?.includes("/clinic/")
                    ) {
                      router.push(
                        `/clinic/email-inbox?leadId=${lead._id}`,
                      );
                    } else if (
                      router.pathname?.includes("/staff/")
                    ) {
                      router.push(
                        `/staff/clinic_email_inbox?leadId=${lead._id}`,
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm transition-all hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Send Email
                </button>
              }
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-teal-500 to-teal-700 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-teal-700/25 ring-1 ring-inset ring-white/10 transition-all hover:from-teal-500 hover:to-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}