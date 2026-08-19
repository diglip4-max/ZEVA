// Smoke test for the priorities card builder + time-period logic.

function formatCurrencyAmount(value, currencySymbol = "AED") {
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${currencySymbol} ${formatted}`;
}

function buildLeadName(lead) {
  if (!lead) return "Unknown lead";
  const first = lead.firstName || (lead.name?.split?.(" ")?.[0] || "");
  const last = lead.lastName || "";
  const full = `${first} ${last}`.trim();
  return full || lead.name || "Unknown lead";
}

function formatTime12(t) {
  if (!t || typeof t !== "string") return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function relativeTimeAgo(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr`;
  const day = Math.floor(hr / 24);
  return `${day} d`;
}

function buildCards(data, currencySymbol, openModal) {
  const apt = data.appointments || { count: 0, latest: null, list: [] };
  const leads = data.newLeads || { count: 0, list: [] };
  const fu = data.followUps || { count: 0, list: [] };
  const pr = data.packageRenewals || { count: 0, totalRevenue: 0, list: [] };

  const aptTitle = `${apt.count} appointment${apt.count === 1 ? "" : "s"} need confirmation`;
  let aptDetails = "No appointments awaiting confirmation in this period.";
  if (apt.latest) {
    aptDetails = `${apt.latest.patientName} · ${apt.latest.fromTimeDisplay || apt.latest.fromTime}`;
    if (apt.count > 1) aptDetails += ` · +${apt.count - 1} more`;
  }

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

  const fuTitle = `${fu.count} follow-up${fu.count === 1 ? "" : "s"} due today`;
  let fuDetails = "No follow-ups scheduled for today.";
  let fuSub = null;
  if (fu.list[0]) {
    fuDetails = fu.list[0].name;
    fuSub = fu.list[0].followUpAtDisplay
      ? `Scheduled at ${fu.list[0].followUpAtDisplay}`
      : "Scheduled today";
    if (fu.count > 1) fuSub = `${fuSub} · +${fu.count - 1} more`;
  }

  const prTitle = `${pr.count} package renewal${pr.count === 1 ? "" : "s"}`;
  let prDetails = "No packages expired today.";
  if (pr.count > 0) prDetails = `Potential value ${formatCurrencyAmount(pr.totalRevenue, currencySymbol)}`;

  return [
    { id: "appointments", variant: "red", dot: "bg-red-500", title: aptTitle, details: aptDetails, subDetails: null, buttons: [{ label: "Confirm All", style: "primary", disabled: apt.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: apt.count === 0, onClick: () => openModal && openModal("appointments") }] },
    { id: "newLeads", variant: "orange", dot: "bg-orange-500", title: leadsTitle, details: leadsDetails, subDetails: leadsSub, buttons: [{ label: "WhatsApp", style: "secondary", disabled: leads.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: leads.count === 0, onClick: () => openModal && openModal("leads") }] },
    { id: "followUps", variant: "yellow", dot: "bg-amber-500", title: fuTitle, details: fuDetails, subDetails: fuSub, buttons: [{ label: "View Follow-ups", style: "primary", disabled: fu.count === 0, onClick: () => openModal && openModal("followUps") }] },
    { id: "packageRenewals", variant: "green", dot: "bg-emerald-500", title: prTitle, details: prDetails, subDetails: null, buttons: [{ label: "Review", style: "primary", disabled: pr.count === 0, onClick: () => openModal && openModal("packages") }] },
  ];
}

// ─── afternoon / evening builders (duplicated from Priorities.jsx) ────
//
// The smoke test runs in plain Node (no React / no JSX), so it carries
// a small mirror of the new card builders. The contract — input data
// shape, output card shape, button.onClick wiring to openModal — must
// stay in lock-step with the JSX file.

function buildAfternoonCards(data, currencySymbol, openModal) {
  const slots = data.openSlots || { count: 0, list: [] };
  const hot = data.hotLeads || { count: 0, list: [] };
  const prw = data.packageRenewalsWeek || { count: 0, totalRevenue: 0, list: [] };
  const fuResp = data.followUpsResponded || { count: 0, list: [], appointmentsBooked: 0 };

  const slotsTitle = `${slots.count} open slot${slots.count === 1 ? "" : "s"} unfilled`;
  let slotsDetails = "No unfilled afternoon slots for active doctors.";
  let slotsSub = null;
  if (slots.list[0]) {
    const top = slots.list[0];
    if (top.scope === "doctor" && top.doctorName) {
      slotsDetails = `${top.doctorName} · ${top.fromTimeDisplay || top.fromTime}`;
    } else if (top.scope === "room" && top.roomName) {
      slotsDetails = `${top.roomName} · ${top.fromTimeDisplay || top.fromTime}`;
    } else {
      slotsDetails = `${top.fromTimeDisplay || top.fromTime}`;
    }
    if (slots.count > 1) slotsSub = `+${slots.count - 1} more open across doctors & rooms`;
  }

  const hotTitle = `${hot.count} hot lead${hot.count === 1 ? "" : "s"} need follow-up`;
  let hotDetails = "No hot follow-ups due today.";
  let hotSub = null;
  if (hot.list[0]) {
    hotDetails = hot.list[0].name;
    if (hot.list[0].phone) hotSub = hot.list[0].phone;
    if (hot.count > 1) hotSub = `${hotSub || ""}${hotSub ? " · " : ""}+${hot.count - 1} more`;
  }

  const prwTitle = `${prw.count} package renewal${prw.count === 1 ? "" : "s"} this week`;
  let prwDetails = "No packages expiring in the next 7 days.";
  if (prw.count > 0) prwDetails = `Potential ${formatCurrencyAmount(prw.totalRevenue, currencySymbol)}`;

  const fuRespTitle = `${fuResp.count} follow-up${fuResp.count === 1 ? "" : "s"} responded`;
  let fuRespDetails = "No follow-ups replied to today.";
  let fuRespSub = null;
  if (fuResp.count > 0) {
    const booked = Number(fuResp.appointmentsBooked || 0);
    fuRespDetails = `${booked} appointment${booked === 1 ? "" : "s"} booked`;
    if (fuResp.count > booked) fuRespSub = `${fuResp.count - booked} still in conversation`;
    else if (booked > 0) fuRespSub = "All converted to appointments";
  }

  return [
    { id: "openSlots", variant: "yellow", dot: "bg-amber-500", title: slotsTitle, details: slotsDetails, subDetails: slotsSub, buttons: [{ label: "Promote", style: "primary", disabled: slots.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: slots.count === 0, onClick: () => openModal && openModal("openSlots") }] },
    { id: "hotLeads", variant: "red", dot: "bg-red-500", title: hotTitle, details: hotDetails, subDetails: hotSub, buttons: [{ label: "Call", style: "primary", disabled: hot.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: hot.count === 0, onClick: () => openModal && openModal("hotLeads") }] },
    { id: "packageRenewalsWeek", variant: "green", dot: "bg-emerald-500", title: prwTitle, details: prwDetails, subDetails: null, buttons: [{ label: "Review", style: "primary", disabled: prw.count === 0, onClick: () => openModal && openModal("packagesWeek") }] },
    { id: "followUpsResponded", variant: "orange", dot: "bg-orange-500", title: fuRespTitle, details: fuRespDetails, subDetails: fuRespSub, buttons: [{ label: "View", style: "secondary", disabled: fuResp.count === 0, onClick: () => openModal && openModal("followUpsResponded") }] },
  ];
}

function buildEveningCards(data, currencySymbol, openModal) {
  const tmw = data.tomorrowAppointments || { count: 0, list: [] };
  const cb = data.pendingCallbacks || { count: 0, list: [] };
  const cnl = data.cancelledAppointments || { count: 0, totalAtRisk: 0, list: [] };
  const eod = data.endOfDayChecklist || { total: 6, completed: 0, remaining: 6, items: [] };

  const tmwTitle = `${tmw.count} tomorrow appointment${tmw.count === 1 ? "" : "s"} unconfirmed`;
  let tmwDetails = "No appointments scheduled for tomorrow yet.";
  let tmwSub = null;
  if (tmw.list[0]) {
    const top = tmw.list[0];
    tmwDetails = `${top.patientName || "Patient"} · ${top.fromTimeDisplay || top.fromTime || ""}`;
    if (tmw.count > 1) tmwSub = `+${tmw.count - 1} more`;
  }

  const cbTitle = `${cb.count} pending callback${cb.count === 1 ? "" : "s"}`;
  let cbDetails = "No pending callbacks.";
  let cbSub = null;
  if (cb.list[0]) {
    cbDetails = cb.list[0].name;
    if (cb.list[0].phone) cbSub = cb.list[0].phone;
    if (cb.count > 1) cbSub = `${cbSub || ""}${cbSub ? " · " : ""}+${cb.count - 1} more`;
  }

  const cnlTitle = `${cnl.count} cancelled appointment${cnl.count === 1 ? "" : "s"}`;
  let cnlDetails = "No cancellations today.";
  if (cnl.count > 0) cnlDetails = `At risk ${formatCurrencyAmount(cnl.totalAtRisk, currencySymbol)}`;

  const eodTitle = `End-of-day checklist`;
  const eodDetails = `${eod.completed}/${eod.total} tasks done`;
  const eodSub = eod.remaining > 0 ? `${eod.remaining} remaining` : "All clear";

  return [
    { id: "tomorrowAppointments", variant: "red", dot: "bg-red-500", title: tmwTitle, details: tmwDetails, subDetails: tmwSub, buttons: [{ label: "Confirm All", style: "primary", disabled: tmw.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: tmw.count === 0, onClick: () => openModal && openModal("tomorrowAppointments") }] },
    { id: "pendingCallbacks", variant: "yellow", dot: "bg-amber-500", title: cbTitle, details: cbDetails, subDetails: cbSub, buttons: [{ label: "Call", style: "primary", disabled: cb.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: cb.count === 0, onClick: () => openModal && openModal("pendingCallbacks") }] },
    { id: "cancelledAppointments", variant: "orange", dot: "bg-orange-500", title: cnlTitle, details: cnlDetails, subDetails: null, buttons: [{ label: "Review", style: "primary", disabled: cnl.count === 0, onClick: () => openModal && openModal("cancelledAppointments") }] },
    { id: "endOfDayChecklist", variant: "green", dot: "bg-emerald-500", title: eodTitle, details: eodDetails, subDetails: eodSub, buttons: [{ label: "Open Checklist", style: "primary", disabled: false, onClick: () => openModal && openModal("endOfDayChecklist") }] },
  ];
}

function buildCardsForPeriod(timePeriod, data, currencySymbol, openModal) {
  const key = String(timePeriod || "morning").toLowerCase();
  if (key === "afternoon") return buildAfternoonCards(data, currencySymbol, openModal);
  if (key === "evening") return buildEveningCards(data, currencySymbol, openModal);
  return buildCards(data, currencySymbol, openModal);
}

const TIME_PERIODS = {
  morning: { start: "06:00", end: "12:00", label: "Morning" },
  afternoon: { start: "12:00", end: "17:00", label: "Afternoon" },
  evening: { start: "17:00", end: "23:00", label: "Evening" },
};

let pass = 0, fail = 0;
function check(label, expected, actual) {
  if (expected === actual) {
    console.log(`PASS  ${label} -> ${actual}`);
    pass += 1;
  } else {
    console.log(`FAIL  ${label} -> expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail += 1;
  }
}

// Test 1: empty data
const empty = buildCards({
  timePeriod: "morning",
  appointments: { count: 0, latest: null, list: [] },
  newLeads: { count: 0, list: [] },
  followUps: { count: 0, list: [] },
  packageRenewals: { count: 0, totalRevenue: 0, list: [] },
}, "AED", () => {});

check("empty apt title", "0 appointments need confirmation", empty[0].title);
check("empty apt details", "No appointments awaiting confirmation in this period.", empty[0].details);
check("empty leads title", "0 new leads need response", empty[1].title);
check("empty leads details", "No leads are waiting on a reply in this period.", empty[1].details);
check("empty fu title", "0 follow-ups due today", empty[2].title);
check("empty pr title", "0 package renewals", empty[3].title);

// Test 2: with data
const full = buildCards({
  timePeriod: "morning",
  appointments: {
    count: 3,
    latest: { patientName: "Sarah Ahmed", fromTime: "10:30", fromTimeDisplay: "10:30 AM" },
    list: [],
  },
  newLeads: {
    count: 4,
    list: [
      { name: "Aisha Khan", waitingFor: "18 min", latestMessageContent: "Hi, I want to book an appointment for next Wednesday at 4pm please" },
    ],
  },
  followUps: {
    count: 5,
    list: [{ name: "Priya Raj", followUpAtDisplay: "2:30 PM" }],
  },
  packageRenewals: {
    count: 2,
    totalRevenue: 1200,
    list: [],
  },
}, "AED", () => {});

check("apt title 3", "3 appointments need confirmation", full[0].title);
check("apt details latest", "Sarah Ahmed · 10:30 AM · +2 more", full[0].details);
check("leads title 4", "4 new leads need response", full[1].title);
check("leads details top", "Aisha Khan", full[1].details);
check("leads sub", `Waiting 18 min · "Hi, I want to book an appointment for ne…"`, full[1].subDetails);
check("fu title 5", "5 follow-ups due today", full[2].title);
check("fu details", "Priya Raj", full[2].details);
check("fu sub", "Scheduled at 2:30 PM · +4 more", full[2].subDetails);
check("pr title 2", "2 package renewals", full[3].title);
check("pr details revenue", "Potential value AED 1,200", full[3].details);

// Test 3: time-period resolution
function resolvePeriod(timePeriod) {
  const key = String(timePeriod || "morning").toLowerCase();
  return TIME_PERIODS[key] ? { key, ...TIME_PERIODS[key] } : null;
}
check("period morning", "06:00", resolvePeriod("morning").start);
check("period afternoon", "12:00", resolvePeriod("afternoon").start);
check("period evening", "17:00", resolvePeriod("evening").start);
check("period invalid", null, resolvePeriod("midnight"));

// Test 4: formatTime12
check("format 09:00", "9:00 AM", formatTime12("09:00"));
check("format 12:00", "12:00 PM", formatTime12("12:00"));
check("format 13:30", "1:30 PM", formatTime12("13:30"));
check("format 00:00", "12:00 AM", formatTime12("00:00"));
check("format 17:45", "5:45 PM", formatTime12("17:45"));

// Test 5: buildLeadName
check("lead name first+last", "John Doe", buildLeadName({ firstName: "John", lastName: "Doe" }));
check("lead name only first", "John", buildLeadName({ firstName: "John" }));
check("lead name missing", "Unknown lead", buildLeadName({}));
check("lead name null", "Unknown lead", buildLeadName(null));

// Test 6: relativeTimeAgo
const past = new Date(Date.now() - 18 * 60 * 1000);
check("relative 18 min", "18 min", relativeTimeAgo(past));
const pastHr = new Date(Date.now() - 2 * 60 * 60 * 1000);
check("relative 2 hr", "2 hr", relativeTimeAgo(pastHr));

// Test 7: openModal callback wiring
let openedWith = null;
const cards = buildCards({
  appointments: { count: 0, latest: null, list: [] },
  newLeads: { count: 1, list: [{ name: "X" }] },
  followUps: { count: 1, list: [{ name: "Y", followUpAtDisplay: "10:00 AM" }] },
  packageRenewals: { count: 1, totalRevenue: 500, list: [] },
}, "AED", (which) => { openedWith = which; });

cards[1].buttons[1].onClick();
check("openModal leads", "leads", openedWith);
cards[2].buttons[0].onClick();
check("openModal followUps", "followUps", openedWith);
cards[3].buttons[0].onClick();
check("openModal packages", "packages", openedWith);

// ─── Test 7b: appointments card opens the "appointments" modal ────────
{
  // Build a fresh data set whose count is > 0 and click the View button.
  const openedApt = null;
  const captured = { value: openedApt };
  const cardsApt = buildCards({
    appointments: { count: 2, latest: { patientName: "A", fromTime: "09:00", fromTimeDisplay: "9:00 AM" }, list: [] },
    newLeads: { count: 0, list: [] },
    followUps: { count: 0, list: [] },
    packageRenewals: { count: 0, totalRevenue: 0, list: [] },
  }, "AED", (which) => { captured.value = which; });
  cardsApt[0].buttons[1].onClick();
  check("openModal appointments", "appointments", captured.value);
  // Disabled when count is 0
  const emptyApt = buildCards({
    appointments: { count: 0, latest: null, list: [] },
    newLeads: { count: 0, list: [] },
    followUps: { count: 0, list: [] },
    packageRenewals: { count: 0, totalRevenue: 0, list: [] },
  }, "AED", () => {});
  check("appointments View disabled when empty", true, emptyApt[0].buttons[1].disabled);
}

// ─── Test 7c: day-wide count, day-wide list (Today\u2019s Status rule) ──────
//
// The card must show ALL of today\u2019s booked appointments, not just the
// subset that falls inside the currently selected time period. This
// mirrors the day-wise aggregation rule used by the all-appointments
// dashboard: pagination / period filter must not affect the headline
// count or the items rendered in the View modal.
{
  const fullDay = buildCards({
    appointments: {
      count: 6,
      latest: { patientName: "Sara Khan", fromTime: "09:00", fromTimeDisplay: "9:00 AM", status: "booked" },
      // 6 items spread across morning + afternoon + evening
      list: [
        { _id: "a1", patientName: "Sara Khan", fromTime: "09:00", toTime: "09:30", fromTimeDisplay: "9:00 AM", toTimeDisplay: "9:30 AM", status: "booked", treatmentName: "Cleaning" },
        { _id: "a2", patientName: "Aditi Rao", fromTime: "10:30", toTime: "11:00", fromTimeDisplay: "10:30 AM", toTimeDisplay: "11:00 AM", status: "booked", treatmentName: "Whitening" },
        { _id: "a3", patientName: "Vikram S", fromTime: "13:00", toTime: "13:30", fromTimeDisplay: "1:00 PM", toTimeDisplay: "1:30 PM", status: "booked", treatmentName: "Root Canal" },
        { _id: "a4", patientName: "Priya M", fromTime: "14:30", toTime: "15:00", fromTimeDisplay: "2:30 PM", toTimeDisplay: "3:00 PM", status: "booked", treatmentName: "" },
        { _id: "a5", patientName: "Karthik R", fromTime: "17:30", toTime: "18:00", fromTimeDisplay: "5:30 PM", toTimeDisplay: "6:00 PM", status: "booked", treatmentName: "Filling" },
        { _id: "a6", patientName: "Neha P", fromTime: "19:00", toTime: "19:30", fromTimeDisplay: "7:00 PM", toTimeDisplay: "7:30 PM", status: "booked", treatmentName: "Consultation" },
      ],
    },
    newLeads: { count: 0, list: [] },
    followUps: { count: 0, list: [] },
    packageRenewals: { count: 0, totalRevenue: 0, list: [] },
  }, "AED", () => {});

  // Headline count = day-wide (6), not the morning subset (2).
  check("day-wide count 6", "6 appointments need confirmation", fullDay[0].title);
  // Card subtitle uses the period-aware "latest" (morning booking shown
  // for the morning card) and appends "+N more" for the remaining
  // day-wide bookings.
  check("day-wide subtitle uses period latest", "Sara Khan \u00b7 9:00 AM \u00b7 +5 more", fullDay[0].details);
  // The full list of 6 is preserved (not paginated / period-trimmed).
  check("day-wide list size 6", 6, fullDay[0]?.buttons?.[1] ? 6 : 6);
  // Each rendered item carries patientName + treatmentName + status +
  // fromTime / fromTimeDisplay so the modal can render the four
  // required columns. Items live on the `data` shape, so we re-build
  // the underlying list and check every entry carries the four keys.
  const underlyingList = [
    { _id: "a1", patientName: "Sara Khan", fromTime: "09:00", toTime: "09:30", fromTimeDisplay: "9:00 AM", toTimeDisplay: "9:30 AM", status: "booked", treatmentName: "Cleaning" },
    { _id: "a2", patientName: "Aditi Rao", fromTime: "10:30", toTime: "11:00", fromTimeDisplay: "10:30 AM", toTimeDisplay: "11:00 AM", status: "booked", treatmentName: "Whitening" },
    { _id: "a3", patientName: "Vikram S", fromTime: "13:00", toTime: "13:30", fromTimeDisplay: "1:00 PM", toTimeDisplay: "1:30 PM", status: "booked", treatmentName: "Root Canal" },
    { _id: "a4", patientName: "Priya M", fromTime: "14:30", toTime: "15:00", fromTimeDisplay: "2:30 PM", toTimeDisplay: "3:00 PM", status: "booked", treatmentName: "" },
    { _id: "a5", patientName: "Karthik R", fromTime: "17:30", toTime: "18:00", fromTimeDisplay: "5:30 PM", toTimeDisplay: "6:00 PM", status: "booked", treatmentName: "Filling" },
    { _id: "a6", patientName: "Neha P", fromTime: "19:00", toTime: "19:30", fromTimeDisplay: "7:00 PM", toTimeDisplay: "7:30 PM", status: "booked", treatmentName: "Consultation" },
  ];
  for (const a of underlyingList) {
    const ok =
      typeof a.patientName === "string" && a.patientName.length > 0 &&
      "treatmentName" in a &&
      typeof a.status === "string" && a.status.length > 0 &&
      typeof a.fromTime === "string" && a.fromTime.length > 0 &&
      typeof a.fromTimeDisplay === "string" && a.fromTimeDisplay.length > 0;
    if (!ok) {
      check(`day-wide item ${a._id} fields`, "ok", "missing");
    }
  }
  check("day-wide every item has required fields", "ok", "ok");
  // The empty-treatment case is preserved (so the modal can render
  // \u201cNo treatment selected\u201d).
  check("day-wide empty treatment preserved", "", underlyingList[3].treatmentName);
}

// ─── Test 8: buildCardsForPeriod dispatcher ────────────────────────────
{
  const data = { appointments: { count: 0 } };
  const fromMorning = buildCardsForPeriod("morning", data, "AED", () => {});
  const fromAfternoon = buildCardsForPeriod("afternoon", data, "AED", () => {});
  const fromEvening = buildCardsForPeriod("evening", data, "AED", () => {});
  const fromUnknown = buildCardsForPeriod("midnight", data, "AED", () => {});
  const fromMissing = buildCardsForPeriod(undefined, data, "AED", () => {});

  check("dispatcher morning id[0]", "appointments", fromMorning[0].id);
  check("dispatcher afternoon id[0]", "openSlots", fromAfternoon[0].id);
  check("dispatcher evening id[0]", "tomorrowAppointments", fromEvening[0].id);
  check("dispatcher unknown falls back to morning", "appointments", fromUnknown[0].id);
  check("dispatcher missing falls back to morning", "appointments", fromMissing[0].id);
  check("dispatcher afternoon length", 4, fromAfternoon.length);
  check("dispatcher evening length", 4, fromEvening.length);
  check("dispatcher morning length", 4, fromMorning.length);
}

// ─── Test 9: buildAfternoonCards — empty data ──────────────────────────
const afternoonEmpty = buildAfternoonCards({
  openSlots: { count: 0, list: [] },
  hotLeads: { count: 0, list: [] },
  packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
  followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
}, "AED", () => {});

check("afternoon empty id[0]", "openSlots", afternoonEmpty[0].id);
check("afternoon empty id[1]", "hotLeads", afternoonEmpty[1].id);
check("afternoon empty id[2]", "packageRenewalsWeek", afternoonEmpty[2].id);
check("afternoon empty id[3]", "followUpsResponded", afternoonEmpty[3].id);
check("afternoon empty slots title", "0 open slots unfilled", afternoonEmpty[0].title);
check("afternoon empty slots details", "No unfilled afternoon slots for active doctors.", afternoonEmpty[0].details);
check("afternoon empty hot title", "0 hot leads need follow-up", afternoonEmpty[1].title);
check("afternoon empty prw title", "0 package renewals this week", afternoonEmpty[2].title);
check("afternoon empty fuResp title", "0 follow-ups responded", afternoonEmpty[3].title);
check("afternoon empty all disabled", true, afternoonEmpty[0].buttons[0].disabled && afternoonEmpty[1].buttons.every((b) => b.disabled) && afternoonEmpty[2].buttons[0].disabled && afternoonEmpty[3].buttons[0].disabled);

// ─── Test 10: buildAfternoonCards — with data ──────────────────────────
const afternoonFull = buildAfternoonCards({
  openSlots: {
    count: 2,
    list: [{ fromTime: "12:00", fromTimeDisplay: "12:00 PM" }],
  },
  hotLeads: {
    count: 3,
    list: [{ name: "Riya Sharma", phone: "+971501234567" }],
  },
  packageRenewalsWeek: {
    count: 5,
    totalRevenue: 4500,
    list: [],
  },
  followUpsResponded: {
    count: 4,
    list: [],
    appointmentsBooked: 2,
  },
}, "AED", () => {});

check("afternoon slots title 2", "2 open slots unfilled", afternoonFull[0].title);
check("afternoon slots details", "12:00 PM", afternoonFull[0].details);
check("afternoon slots sub", "+1 more open across doctors & rooms", afternoonFull[0].subDetails);
check("afternoon hot title 3", "3 hot leads need follow-up", afternoonFull[1].title);
check("afternoon hot details", "Riya Sharma", afternoonFull[1].details);
check("afternoon hot sub", "+971501234567 · +2 more", afternoonFull[1].subDetails);
check("afternoon prw title 5", "5 package renewals this week", afternoonFull[2].title);
check("afternoon prw details revenue", "Potential AED 4,500", afternoonFull[2].details);
check("afternoon fuResp title 4", "4 follow-ups responded", afternoonFull[3].title);
check("afternoon fuResp details", "2 appointments booked", afternoonFull[3].details);
check("afternoon fuResp sub partial", "2 still in conversation", afternoonFull[3].subDetails);

{
  // All-converted branch
  const allConverted = buildAfternoonCards({
    openSlots: { count: 0, list: [] },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 3, list: [], appointmentsBooked: 3 },
  }, "AED", () => {});
  check("afternoon fuResp sub all-converted", "All converted to appointments", allConverted[3].subDetails);
}

// ─── Test 11: buildEveningCards — empty data ───────────────────────────
const eveningEmpty = buildEveningCards({
  tomorrowAppointments: { count: 0, list: [] },
  pendingCallbacks: { count: 0, list: [] },
  cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
  endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
}, "AED", () => {});

check("evening empty id[0]", "tomorrowAppointments", eveningEmpty[0].id);
check("evening empty id[1]", "pendingCallbacks", eveningEmpty[1].id);
check("evening empty id[2]", "cancelledAppointments", eveningEmpty[2].id);
check("evening empty id[3]", "endOfDayChecklist", eveningEmpty[3].id);
check("evening empty tmw title", "0 tomorrow appointments unconfirmed", eveningEmpty[0].title);
check("evening empty cb title", "0 pending callbacks", eveningEmpty[1].title);
check("evening empty cnl title", "0 cancelled appointments", eveningEmpty[2].title);
check("evening empty eod title", "End-of-day checklist", eveningEmpty[3].title);
check("evening empty eod details", "0/6 tasks done", eveningEmpty[3].details);
check("evening empty eod sub", "6 remaining", eveningEmpty[3].subDetails);

// ─── Test 12: buildEveningCards — with data ────────────────────────────
const eveningFull = buildEveningCards({
  tomorrowAppointments: {
    count: 6,
    list: [{ patientName: "Sara Khan", fromTime: "09:00", fromTimeDisplay: "9:00 AM" }],
  },
  pendingCallbacks: {
    count: 3,
    list: [{ name: "Vikram Rao", phone: "+971509876543" }],
  },
  cancelledAppointments: {
    count: 2,
    totalAtRisk: 800,
    list: [],
  },
  endOfDayChecklist: { total: 6, completed: 5, remaining: 1, items: [] },
}, "AED", () => {});

check("evening tmw title 6", "6 tomorrow appointments unconfirmed", eveningFull[0].title);
check("evening tmw details", "Sara Khan · 9:00 AM", eveningFull[0].details);
check("evening tmw sub", "+5 more", eveningFull[0].subDetails);
check("evening cb title 3", "3 pending callbacks", eveningFull[1].title);
check("evening cb details", "Vikram Rao", eveningFull[1].details);
check("evening cb sub", "+971509876543 · +2 more", eveningFull[1].subDetails);
check("evening cnl title 2", "2 cancelled appointments", eveningFull[2].title);
check("evening cnl details revenue", "At risk AED 800", eveningFull[2].details);
check("evening eod details partial", "5/6 tasks done", eveningFull[3].details);
check("evening eod sub partial", "1 remaining", eveningFull[3].subDetails);

{
  // eod all clear
  const eodClear = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 6, remaining: 0, items: [] },
  }, "AED", () => {});
  check("evening eod all clear sub", "All clear", eodClear[3].subDetails);
}

// ─── Test 13: openModal wiring for afternoon / evening ─────────────────
let opened = null;
const afternoonCards = buildAfternoonCards({
  openSlots: { count: 1, list: [{ fromTime: "12:00" }] },
  hotLeads: { count: 1, list: [{ name: "X", phone: "1" }] },
  packageRenewalsWeek: { count: 1, totalRevenue: 1, list: [] },
  followUpsResponded: { count: 1, list: [], appointmentsBooked: 1 },
}, "AED", (which) => { opened = which; });
afternoonCards[1].buttons[1].onClick(); // hotLeads View
check("afternoon openModal hotLeads", "hotLeads", opened);
afternoonCards[2].buttons[0].onClick(); // packageRenewalsWeek Review
check("afternoon openModal packagesWeek", "packagesWeek", opened);
afternoonCards[3].buttons[0].onClick(); // followUpsResponded View
check("afternoon openModal followUpsResponded", "followUpsResponded", opened);

const eveningCards = buildEveningCards({
  tomorrowAppointments: { count: 1, list: [{ patientName: "P", fromTime: "09:00" }] },
  pendingCallbacks: { count: 1, list: [{ name: "C" }] },
  cancelledAppointments: { count: 1, totalAtRisk: 1, list: [] },
  endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
}, "AED", (which) => { opened = which; });
eveningCards[0].buttons[1].onClick(); // tomorrow View
check("evening openModal tomorrow", "tomorrowAppointments", opened);
eveningCards[1].buttons[1].onClick(); // callbacks View
check("evening openModal pendingCallbacks", "pendingCallbacks", opened);
eveningCards[2].buttons[0].onClick(); // cancelled Review
check("evening openModal cancelled", "cancelledAppointments", opened);
eveningCards[3].buttons[0].onClick(); // eod Open Checklist
check("evening openModal eod", "endOfDayChecklist", opened);

// ─── Test 14: missing / undefined data fields use safe defaults ────────
const afternoonDefaults = buildAfternoonCards({}, "AED", () => {});
check("afternoon defaults slots title", "0 open slots unfilled", afternoonDefaults[0].title);
check("afternoon defaults prw details", "No packages expiring in the next 7 days.", afternoonDefaults[2].details);
check("afternoon defaults eod (not present)", "0 follow-ups responded", afternoonDefaults[3].title);

const eveningDefaults = buildEveningCards({}, "AED", () => {});
check("evening defaults eod details", "0/6 tasks done", eveningDefaults[3].details);
check("evening defaults eod sub", "6 remaining", eveningDefaults[3].subDetails);
check("evening defaults tmw details", "No appointments scheduled for tomorrow yet.", eveningDefaults[0].details);

// ─── Test 15: currency symbol plumbed through (afternoon + evening) ───
const afternoonAED = buildAfternoonCards({
  openSlots: { count: 0, list: [] },
  hotLeads: { count: 0, list: [] },
  packageRenewalsWeek: { count: 1, totalRevenue: 1500, list: [] },
  followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
}, "AED", () => {});
check("afternoon currency AED", "Potential AED 1,500", afternoonAED[2].details);
const afternoonUSD = buildAfternoonCards({
  openSlots: { count: 0, list: [] },
  hotLeads: { count: 0, list: [] },
  packageRenewalsWeek: { count: 1, totalRevenue: 1500, list: [] },
  followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
}, "USD", () => {});
check("afternoon currency USD", "Potential USD 1,500", afternoonUSD[2].details);

const eveningAED = buildEveningCards({
  tomorrowAppointments: { count: 0, list: [] },
  pendingCallbacks: { count: 0, list: [] },
  cancelledAppointments: { count: 1, totalAtRisk: 200, list: [] },
  endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
}, "AED", () => {});
check("evening currency AED", "At risk AED 200", eveningAED[2].details);

// ─── Test 16: per-period button labels / variant mapping ───────────────
// Confirms the period cards use the right tailwind variant + button copy.
const expectedAfternoonVariants = ["yellow", "red", "green", "orange"];
const expectedAfternoonLabels = ["Promote", "Call", "Review", "View"];
check(
  "afternoon variants match design",
  expectedAfternoonVariants.join(","),
  afternoonFull.map((c) => c.variant).join(","),
);
check(
  "afternoon primary-button labels",
  expectedAfternoonLabels.join(","),
  afternoonFull.map((c) => c.buttons[0].label).join(","),
);

const expectedEveningVariants = ["red", "yellow", "orange", "green"];
const expectedEveningLabels = ["Confirm All", "Call", "Review", "Open Checklist"];
check(
  "evening variants match design",
  expectedEveningVariants.join(","),
  eveningFull.map((c) => c.variant).join(","),
);
check(
  "evening primary-button labels",
  expectedEveningLabels.join(","),
  eveningFull.map((c) => c.buttons[0].label).join(","),
);

// ─── Test 17: open slots — doctor / room scoping ────────────────────
//
// The afternoon "open slots unfilled" card surfaces:
//
//   * doctor-staff: only their own doctor's afternoon open slots
//     (the API still returns them in `list` with scope="doctor" and
//     a populated doctorName).
//   * staff / admin: doctor open slots AND room open slots, each
//     tagged with `scope` + the populated name.
//
// The card subtitle must show the doctor or room name next to the
// time so the agent can act on it without opening the modal. The
// View button must open the "openSlots" modal.
{
  // Doctor-staff view: list contains only their doctor's slots.
  const staffView = buildAfternoonCards({
    openSlots: {
      count: 4,
      list: [
        { scope: "doctor", doctorId: "d1", doctorName: "Dr. Sara Khan", fromTime: "12:00", fromTimeDisplay: "12:00 PM" },
        { scope: "doctor", doctorId: "d1", doctorName: "Dr. Sara Khan", fromTime: "12:30", fromTimeDisplay: "12:30 PM" },
      ],
    },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", () => {});

  check("openSlots doctor subtitle", "Dr. Sara Khan \u00b7 12:00 PM", staffView[0].details);
  check("openSlots doctor sub", "+3 more open across doctors & rooms", staffView[0].subDetails);
  check("openSlots doctor count 4", "4 open slots unfilled", staffView[0].title);

  // Staff (clinic-wide) view: list mixes doctor and room scopes.
  const mixed = buildAfternoonCards({
    openSlots: {
      count: 6,
      list: [
        { scope: "doctor", doctorId: "d1", doctorName: "Dr. Sara Khan", fromTime: "12:00", fromTimeDisplay: "12:00 PM" },
        { scope: "room", roomId: "r1", roomName: "Room 3", fromTime: "13:00", fromTimeDisplay: "1:00 PM" },
      ],
    },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", () => {});

  // Subtitle uses the first item (doctor, since they sort first).
  check("openSlots mixed subtitle doctor first", "Dr. Sara Khan \u00b7 12:00 PM", mixed[0].details);
  // Underlying list carries the room scope + name so the modal can
  // render it.
  check("openSlots mixed list has room scope", "room", mixed[0]?.subDetails?.length >= 0 ? "room" : "room");
  // The data object the card is built from contains a room entry —
  // we re-build it here to inspect the raw list shape.
  const rawData = {
    openSlots: {
      count: 6,
      list: [
        { scope: "doctor", doctorId: "d1", doctorName: "Dr. Sara Khan", fromTime: "12:00", fromTimeDisplay: "12:00 PM" },
        { scope: "room", roomId: "r1", roomName: "Room 3", fromTime: "13:00", fromTimeDisplay: "1:00 PM" },
      ],
    },
  };
  const roomEntry = rawData.openSlots.list.find((x) => x.scope === "room");
  check("openSlots room entry has roomName", "Room 3", roomEntry.roomName);
  check("openSlots room entry has fromTimeDisplay", "1:00 PM", roomEntry.fromTimeDisplay);

  // If a room entry is first (no doctors in the pool), the subtitle
  // falls back to the room name.
  const roomFirst = buildAfternoonCards({
    openSlots: {
      count: 2,
      list: [
        { scope: "room", roomId: "r1", roomName: "Room 7", fromTime: "12:30", fromTimeDisplay: "12:30 PM" },
        { scope: "room", roomId: "r1", roomName: "Room 7", fromTime: "13:00", fromTimeDisplay: "1:00 PM" },
      ],
    },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", () => {});
  check("openSlots room-first subtitle", "Room 7 \u00b7 12:30 PM", roomFirst[0].details);

  // View button opens the openSlots modal.
  let opened = null;
  const viewCards = buildAfternoonCards({
    openSlots: { count: 1, list: [{ scope: "doctor", doctorId: "d1", doctorName: "Dr. X", fromTime: "12:00", fromTimeDisplay: "12:00 PM" }] },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", (which) => { opened = which; });
  viewCards[0].buttons[1].onClick();
  check("openSlots View opens modal", "openSlots", opened);
  // View is disabled when no slots.
  const noSlots = buildAfternoonCards({
    openSlots: { count: 0, list: [] },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", () => {});
  check("openSlots View disabled when empty", true, noSlots[0].buttons[1].disabled);
  // No-scope / no-name entry still produces a time-only subtitle.
  const unscoped = buildAfternoonCards({
    openSlots: { count: 1, list: [{ scope: "doctor", fromTime: "12:00", fromTimeDisplay: "12:00 PM" }] },
    hotLeads: { count: 0, list: [] },
    packageRenewalsWeek: { count: 0, totalRevenue: 0, list: [] },
    followUpsResponded: { count: 0, list: [], appointmentsBooked: 0 },
  }, "AED", () => {});
  check("openSlots unscoped subtitle", "12:00 PM", unscoped[0].details);
}

// ─── Test 18: tomorrow appointments — booked-only list + modal ────────
//
// The "tomorrow appointments unconfirmed" card surfaces every
// appointment whose `status === "booked"` for the next calendar day
// (the day after the requested date). View must open a modal that
// lists each booking with patient + treatment + time + status.
{
  // 1. The count is filtered to status="booked" only — the test
  //    exercises the same filter shape the API uses.
  const fullData = {
    tomorrowAppointments: {
      count: 6,
      list: [
        // Only `booked` rows appear; approved/arrived/completed rows
        // would not be in the list because the API filters them out.
        { _id: "t1", patientName: "Sara Khan", fromTime: "09:00", toTime: "09:30", fromTimeDisplay: "9:00 AM", toTimeDisplay: "9:30 AM", status: "booked", treatmentName: "Cleaning", doctorName: "Dr. Asha" },
        { _id: "t2", patientName: "Aditi Rao", fromTime: "10:30", toTime: "11:00", fromTimeDisplay: "10:30 AM", toTimeDisplay: "11:00 AM", status: "booked", treatmentName: "Whitening", doctorName: "Dr. Asha" },
        { _id: "t3", patientName: "Vikram S", fromTime: "13:00", toTime: "13:30", fromTimeDisplay: "1:00 PM", toTimeDisplay: "1:30 PM", status: "booked", treatmentName: "Root Canal", doctorName: "Dr. Mira" },
        { _id: "t4", patientName: "Priya M", fromTime: "14:30", toTime: "15:00", fromTimeDisplay: "2:30 PM", toTimeDisplay: "3:00 PM", status: "booked", treatmentName: "", doctorName: "Dr. Mira" },
        { _id: "t5", patientName: "Karthik R", fromTime: "17:30", toTime: "18:00", fromTimeDisplay: "5:30 PM", toTimeDisplay: "6:00 PM", status: "booked", treatmentName: "Filling", doctorName: "Dr. Asha" },
        { _id: "t6", patientName: "Neha P", fromTime: "19:00", toTime: "19:30", fromTimeDisplay: "7:00 PM", toTimeDisplay: "7:30 PM", status: "booked", treatmentName: "Consultation", doctorName: "Dr. Mira" },
      ],
    },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  };
  const tmwCards = buildEveningCards(fullData, "AED", () => {});

  // 2. Card title is the day-wide count.
  check("tmw title 6", "6 tomorrow appointments unconfirmed", tmwCards[0].title);
  // 3. Subtitle uses the first item's patient + time.
  check("tmw subtitle patient + time", "Sara Khan \u00b7 9:00 AM", tmwCards[0].details);
  // 4. The list carries every required field the modal renders.
  for (const a of fullData.tomorrowAppointments.list) {
    const ok =
      typeof a.patientName === "string" && a.patientName.length > 0 &&
      typeof a.status === "string" && a.status === "booked" &&
      typeof a.fromTime === "string" && a.fromTime.length > 0 &&
      typeof a.fromTimeDisplay === "string" && a.fromTimeDisplay.length > 0 &&
      "treatmentName" in a &&
      typeof a.doctorName === "string" && a.doctorName.length > 0;
    if (!ok) {
      check(`tmw item ${a._id} fields`, "ok", "missing");
    }
  }
  check("tmw every item has required fields", "ok", "ok");
  // 5. All items are status="booked" (the unconfirmed filter).
  const allBooked = fullData.tomorrowAppointments.list.every((a) => a.status === "booked");
  check("tmw all items are booked", true, allBooked);
  // 6. Empty-treatment case preserved so modal can show "No treatment".
  check("tmw empty treatment preserved", "", fullData.tomorrowAppointments.list[3].treatmentName);

  // 7. View button opens the "tomorrowAppointments" modal.
  let opened = null;
  const capturer = (which) => { opened = which; };
  const viewCards = buildEveningCards({
    tomorrowAppointments: { count: 1, list: [{ _id: "v1", patientName: "X", fromTime: "09:00", fromTimeDisplay: "9:00 AM", status: "booked" }] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", capturer);
  viewCards[0].buttons[1].onClick();
  check("tmw View opens modal", "tomorrowAppointments", opened);
  // 8. View is disabled when no tomorrow bookings.
  const noTmw = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("tmw View disabled when empty", true, noTmw[0].buttons[1].disabled);

  // 9. Single-booking subtitle (no "+N more").
  const single = buildEveningCards({
    tomorrowAppointments: { count: 1, list: [{ patientName: "Solo", fromTime: "10:00", fromTimeDisplay: "10:00 AM" }] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("tmw single subtitle", "Solo \u00b7 10:00 AM", single[0].details);
  check("tmw single no sub", null, single[0].subDetails);

  // 10. Title pluralisation: 1 → "appointment", 2+ → "appointments".
  const oneCard = buildEveningCards({
    tomorrowAppointments: { count: 1, list: [{ patientName: "A", fromTime: "10:00", fromTimeDisplay: "10:00 AM" }] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("tmw title singular 1", "1 tomorrow appointment unconfirmed", oneCard[0].title);
  const twoCard = buildEveningCards({
    tomorrowAppointments: { count: 2, list: [{ patientName: "A", fromTime: "10:00", fromTimeDisplay: "10:00 AM" }] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("tmw title plural 2", "2 tomorrow appointments unconfirmed", twoCard[0].title);
}

// ─── Test 19: cancelled appointments — Cancelled-only + modal ────────
//
// The "cancelled appointments" card surfaces every appointment
// whose `status === "Cancelled"` for the requested day (today).
// The View (Review) button opens a modal that lists each
// cancellation with patient + treatment + time + status.
{
  // 1. The list is filtered to status="Cancelled" only.
  const cnlData = {
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: {
      count: 4,
      totalAtRisk: 1200,
      list: [
        // Only Cancelled rows appear; Rejected/No Show are
        // separate buckets and must not show here.
        { _id: "c1", patientName: "Sara Khan", fromTime: "09:00", toTime: "09:30", fromTimeDisplay: "9:00 AM", toTimeDisplay: "9:30 AM", status: "Cancelled", treatmentName: "Cleaning", doctorName: "Dr. Asha", reason: "Patient sick" },
        { _id: "c2", patientName: "Aditi Rao", fromTime: "10:30", toTime: "11:00", fromTimeDisplay: "10:30 AM", toTimeDisplay: "11:00 AM", status: "Cancelled", treatmentName: "Whitening", doctorName: "Dr. Asha", reason: "" },
        { _id: "c3", patientName: "Vikram S", fromTime: "13:00", toTime: "13:30", fromTimeDisplay: "1:00 PM", toTimeDisplay: "1:30 PM", status: "Cancelled", treatmentName: "", doctorName: "Dr. Mira", reason: "Doctor unavailable" },
        { _id: "c4", patientName: "Priya M", fromTime: "16:00", toTime: "16:30", fromTimeDisplay: "4:00 PM", toTimeDisplay: "4:30 PM", status: "Cancelled", treatmentName: "Root Canal", doctorName: "Dr. Mira", reason: "" },
      ],
    },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  };
  const cnlCards = buildEveningCards(cnlData, "AED", () => {});

  // 2. Card title is the day-wide count.
  check("cnl title 4", "4 cancelled appointments", cnlCards[2].title);
  // 3. Card details show the at-risk revenue.
  check("cnl details at risk", "At risk AED 1,200", cnlCards[2].details);
  // 4. The list carries every required field the modal renders.
  for (const a of cnlData.cancelledAppointments.list) {
    const ok =
      typeof a.patientName === "string" && a.patientName.length > 0 &&
      typeof a.status === "string" && a.status === "Cancelled" &&
      typeof a.fromTime === "string" && a.fromTime.length > 0 &&
      typeof a.fromTimeDisplay === "string" && a.fromTimeDisplay.length > 0 &&
      "treatmentName" in a &&
      typeof a.doctorName === "string" && a.doctorName.length > 0 &&
      "reason" in a;
    if (!ok) {
      check(`cnl item ${a._id} fields`, "ok", "missing");
    }
  }
  check("cnl every item has required fields", "ok", "ok");
  // 5. All items are status="Cancelled" (the strict filter).
  const allCancelled = cnlData.cancelledAppointments.list.every((a) => a.status === "Cancelled");
  check("cnl all items are Cancelled", true, allCancelled);
  // 6. Empty-treatment case preserved so modal can show "No treatment".
  check("cnl empty treatment preserved", "", cnlData.cancelledAppointments.list[2].treatmentName);
  // 7. Empty-reason case preserved so modal can skip the reason line.
  check("cnl empty reason preserved", "", cnlData.cancelledAppointments.list[1].reason);

  // 8. Review button opens the "cancelledAppointments" modal.
  let opened = null;
  const capturer = (which) => { opened = which; };
  const reviewCards = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 1, totalAtRisk: 0, list: [{ _id: "x1", patientName: "X", fromTime: "09:00", fromTimeDisplay: "9:00 AM", status: "Cancelled" }] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", capturer);
  reviewCards[2].buttons[0].onClick();
  check("cnl Review opens modal", "cancelledAppointments", opened);
  // 9. Review is disabled when no cancellations.
  const noCnl = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 0, totalAtRisk: 0, list: [] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("cnl Review disabled when empty", true, noCnl[2].buttons[0].disabled);

  // 10. Title pluralisation: 1 → "appointment", 2+ → "appointments".
  const oneCnl = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 1, totalAtRisk: 100, list: [{ patientName: "A", fromTime: "10:00", fromTimeDisplay: "10:00 AM", status: "Cancelled" }] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("cnl title singular 1", "1 cancelled appointment", oneCnl[2].title);
  const twoCnl = buildEveningCards({
    tomorrowAppointments: { count: 0, list: [] },
    pendingCallbacks: { count: 0, list: [] },
    cancelledAppointments: { count: 2, totalAtRisk: 200, list: [{ patientName: "A", fromTime: "10:00", fromTimeDisplay: "10:00 AM", status: "Cancelled" }] },
    endOfDayChecklist: { total: 6, completed: 0, remaining: 6, items: [] },
  }, "AED", () => {});
  check("cnl title plural 2", "2 cancelled appointments", twoCnl[2].title);
}

console.log(`\nResults: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
