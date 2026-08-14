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
    { id: "appointments", variant: "red", dot: "bg-red-500", title: aptTitle, details: aptDetails, subDetails: null, buttons: [{ label: "Confirm All", style: "primary", disabled: apt.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: apt.count === 0, onClick: () => {} }] },
    { id: "newLeads", variant: "orange", dot: "bg-orange-500", title: leadsTitle, details: leadsDetails, subDetails: leadsSub, buttons: [{ label: "WhatsApp", style: "secondary", disabled: leads.count === 0, onClick: () => {} }, { label: "View", style: "secondary", disabled: leads.count === 0, onClick: () => openModal && openModal("leads") }] },
    { id: "followUps", variant: "yellow", dot: "bg-amber-500", title: fuTitle, details: fuDetails, subDetails: fuSub, buttons: [{ label: "View Follow-ups", style: "primary", disabled: fu.count === 0, onClick: () => openModal && openModal("followUps") }] },
    { id: "packageRenewals", variant: "green", dot: "bg-emerald-500", title: prTitle, details: prDetails, subDetails: null, buttons: [{ label: "Review", style: "primary", disabled: pr.count === 0, onClick: () => openModal && openModal("packages") }] },
  ];
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

console.log(`\nResults: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
