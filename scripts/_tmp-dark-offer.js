const fs = require("fs");
const p = "C:/Users/ADMIN/Documents/zeva360/ZEVA/components/offer/create-offer.jsx";
let t = fs.readFileSync(p, "utf8");
const reps = [
  ["bg-white rounded-lg", "bg-white dark:bg-gray-800 rounded-lg"],
  ["bg-white rounded-xl", "bg-white dark:bg-gray-800 rounded-xl"],
  ["bg-white rounded-2xl", "bg-white dark:bg-gray-800 rounded-2xl"],
  ["min-h-screen bg-gray-50 flex", "min-h-screen bg-gray-50 dark:bg-gray-900 flex"],
  ["border border-red-200 p-8", "border border-red-200 dark:border-red-900/50 p-8"],
  ["w-16 h-16 bg-red-100 rounded-full", "w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full"],
  ["text-xl font-bold text-teal-900 mb-2", "text-xl font-bold text-teal-900 dark:text-gray-100 mb-2"],
  ["text-sm text-teal-700 mb-4", "text-sm text-teal-700 dark:text-teal-300 mb-4"],
  ["text-xs text-teal-600", "text-xs text-teal-600 dark:text-teal-400"],
  ["border border-gray-200 p-3 sm:p-4", "border border-gray-200 dark:border-gray-700 p-3 sm:p-4"],
  ["text-teal-900 dark:text-white", "text-teal-900 dark:text-gray-100"],
  ["text-teal-600 dark:text-white", "text-teal-600 dark:text-teal-300"],
  ["border border-amber-200 p-6", "border border-amber-200 dark:border-amber-800 p-6"],
  ["w-12 h-12 bg-amber-100 rounded-full", "w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full"],
  ["text-lg font-bold text-teal-900 mb-2", "text-lg font-bold text-teal-900 dark:text-gray-100 mb-2"],
  ["text-sm text-teal-700 mb-3", "text-sm text-teal-700 dark:text-teal-300 mb-3"],
  ["border border-[#E9E3D8]", "border border-[#E9E3D8] dark:border-gray-700"],
  ["text-lg sm:text-xl font-bold text-gray-950", "text-lg sm:text-xl font-bold text-gray-950 dark:text-gray-100"],
  ["text-[10px] sm:text-xs text-gray-500", "text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"],
  ["bg-[#171717] hover:bg-[#303030]", "bg-[#171717] dark:bg-indigo-600 hover:bg-[#303030] dark:hover:bg-indigo-500"],
  ["text-[10px] font-semibold text-teal-600 uppercase", "text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase"],
  ["text-lg sm:text-xl font-bold text-teal-900", "text-lg sm:text-xl font-bold text-teal-900 dark:text-gray-100"],
  ["text-lg sm:text-xl font-bold text-teal-700", "text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-300"],
  ["border-b border-[#E9E3D8] bg-[#FDFCFB]", "border-b border-[#E9E3D8] dark:border-gray-700 bg-[#FDFCFB] dark:bg-gray-900/40"],
  ["h-4 w-4 text-gray-700", "h-4 w-4 text-gray-700 dark:text-gray-300"],
  ["text-sm sm:text-base font-bold text-gray-950", "text-sm sm:text-base font-bold text-gray-950 dark:text-gray-100"],
  ["text-[10px] text-gray-600 bg-[#F5F2EC]", "text-[10px] text-gray-600 dark:text-gray-300 bg-[#F5F2EC] dark:bg-gray-700"],
  ["w-10 h-10 bg-teal-100 rounded-lg", "w-10 h-10 bg-teal-100 dark:bg-teal-900/40 rounded-lg"],
  ["text-sm font-bold text-teal-900 mb-1", "text-sm font-bold text-teal-900 dark:text-gray-100 mb-1"],
  ["text-teal-600 text-xs mb-3", "text-teal-600 dark:text-teal-400 text-xs mb-3"],
  ['thead className="bg-[#FDFCFB]"', 'thead className="bg-[#FDFCFB] dark:bg-gray-900/50"'],
  ["divide-y divide-[#EEE9E1]", "divide-y divide-[#EEE9E1] dark:divide-gray-700"],
  ["hover:bg-[#FAF8F4]", "hover:bg-[#FAF8F4] dark:hover:bg-gray-700/40"],
  ["font-bold text-gray-950 text-xs", "font-bold text-gray-950 dark:text-gray-100 text-xs"],
  ["flex items-center gap-1 text-gray-600", "flex items-center gap-1 text-gray-600 dark:text-gray-300"],
  ["text-xs sm:text-sm font-bold text-gray-900", "text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100"],
  [
    "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold dark:text-white",
    "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
  ],
  [
    '? "bg-[#EFF7F1] text-[#48805C] border border-[#CFE2D4]"',
    '? "bg-[#EFF7F1] text-[#48805C] border border-[#CFE2D4] dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"',
  ],
  [
    ': "bg-[#F5F2EC] text-gray-600 border border-[#E9E3D8]"',
    ': "bg-[#F5F2EC] text-gray-600 dark:text-gray-300 border border-[#E9E3D8] dark:bg-gray-700 dark:border-gray-600"',
  ],
  [
    "bg-teal-100 text-teal-800 hover:bg-teal-200",
    "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 hover:bg-teal-200 dark:hover:bg-teal-800",
  ],
  [
    "w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-teal-200",
    "w-8 h-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center border border-teal-200 dark:border-teal-700",
  ],
  [
    "bg-teal-100 px-4 py-3 flex items-center justify-between",
    "bg-teal-100 dark:bg-teal-900/40 px-4 py-3 flex items-center justify-between",
  ],
  ["text-sm font-bold text-teal-700 dark:text-teal-100", "text-sm font-bold text-teal-700 dark:text-teal-200"],
  ["text-[10px] text-teal-700 truncate", "text-[10px] text-teal-700 dark:text-teal-300 truncate"],
  [
    "text-teal-700 hover:bg-teal-200 rounded-lg p-1.5",
    "text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800 rounded-lg p-1.5",
  ],
  [
    "flex-1 overflow-y-auto bg-gray-50 px-6 py-6 text-xs sm:text-sm text-gray-700",
    "flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-6 py-6 text-xs sm:text-sm text-gray-700 dark:text-gray-300",
  ],
  [
    "border border-teal-200 shadow-sm overflow-hidden",
    "border border-teal-200 dark:border-teal-800 shadow-sm overflow-hidden",
  ],
  [
    "bg-teal-50 px-5 py-3 border-b border-teal-200",
    "bg-teal-50 dark:bg-teal-900/30 px-5 py-3 border-b border-teal-200 dark:border-teal-800",
  ],
  [
    "text-[10px] font-semibold text-teal-700 dark:text-teal-100 mb-1.5",
    "text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-1.5",
  ],
  [
    "text-[10px] font-semibold text-teal-700 mb-1.5",
    "text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-1.5",
  ],
  [
    "text-xs text-gray-900 bg-teal-50 px-2 py-2 rounded-lg border border-teal-100",
    "text-xs text-gray-900 dark:text-gray-100 bg-teal-50 dark:bg-teal-900/20 px-2 py-2 rounded-lg border border-teal-100 dark:border-teal-800",
  ],
  [
    "text-xs text-gray-900 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100",
    "text-xs text-gray-900 dark:text-gray-100 bg-teal-50 dark:bg-teal-900/20 px-3 py-2 rounded-lg border border-teal-100 dark:border-teal-800",
  ],
  [
    "text-sm font-semibold text-gray-900 bg-teal-50 px-3 py-1 rounded-lg border border-teal-100",
    "text-sm font-semibold text-gray-900 dark:text-gray-100 bg-teal-50 dark:bg-teal-900/20 px-3 py-1 rounded-lg border border-teal-100 dark:border-teal-800",
  ],
  [
    "bg-teal-50 text-teal-800 rounded-lg text-xs border border-teal-200",
    "bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 rounded-lg text-xs border border-teal-200 dark:border-teal-800",
  ],
  [
    "text-[10px] font-semibold text-white mb-1.5",
    "text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-1.5",
  ],
  [
    "bg-green-50 text-green-700 border-green-200",
    "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  ],
  [
    "bg-gray-50 text-gray-700 border-gray-200",
    "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600",
  ],
  [
    "border-b border-gray-200 flex items-center justify-between bg-red-50",
    "border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-red-50 dark:bg-red-900/30",
  ],
  ["w-8 h-8 rounded-lg bg-red-100 flex", "w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex"],
  ["text-sm font-bold text-teal-900", "text-sm font-bold text-teal-900 dark:text-gray-100"],
  [
    "text-[10px] text-teal-700 truncate max-w-[200px]",
    "text-[10px] text-teal-700 dark:text-teal-300 truncate max-w-[200px]",
  ],
  [
    "hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 text-teal-500 hover:text-teal-700",
    "hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-500 text-teal-500 dark:text-teal-300 hover:text-teal-700 dark:hover:text-teal-200",
  ],
  [
    "p-4 text-xs sm:text-sm text-teal-700 space-y-1.5",
    "p-4 text-xs sm:text-sm text-teal-700 dark:text-teal-300 space-y-1.5",
  ],
  [
    "border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-teal-700 hover:bg-teal-50",
    "border border-gray-200 dark:border-gray-600 rounded-lg text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20",
  ],
  [
    "px-5 py-3 border-t border-gray-100 bg-gray-50",
    "px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50",
  ],
  ["sticky top-0 bg-gray-50 border-b border-gray-200", "sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"],
  ["text-[10px] font-bold text-gray-500 uppercase tracking-wider", "text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"],
  ["divide-y divide-gray-100", "divide-y divide-gray-100 dark:divide-gray-700"],
  ["text-xs font-semibold text-gray-900", "text-xs font-semibold text-gray-900 dark:text-gray-100"],
  ["text-sm font-bold text-gray-900 truncate", "text-sm font-bold text-gray-900 dark:text-gray-100 truncate"],
  ["text-xs font-bold text-gray-900", "text-xs font-bold text-gray-900 dark:text-gray-100"],
  ["text-[10px] font-semibold text-gray-800", "text-[10px] font-semibold text-gray-800 dark:text-gray-200"],
  ["px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-700", "px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-700 dark:text-gray-200"],
  ["px-2.5 py-1 rounded-lg bg-white text-xs font-semibold text-gray-700 border border-gray-200 shadow-sm", "px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm"],
  ["text-[9px] font-bold text-gray-500 uppercase tracking-wider", "text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"],
  ["rounded-xl border border-gray-200 bg-gray-50 p-3", "rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3"],
  ["w-8 h-8 rounded-lg bg-gray-200 flex", "w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex"],
  ["rounded-xl border border-green-200 bg-green-50 p-3", "rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3"],
  ["w-8 h-8 rounded-lg bg-green-100 flex", "w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex"],
  ["inline-block px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[9px] font-medium text-gray-600", "inline-block px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-[9px] font-medium text-gray-600 dark:text-gray-300"],
  ["hover:bg-green-50/50", "hover:bg-green-50/50 dark:hover:bg-green-900/20"],
  ["hover:bg-blue-50/50", "hover:bg-blue-50/50 dark:hover:bg-blue-900/20"],
  ["px-2 py-0.5 rounded-md bg-gray-100 text-[9px] font-bold text-gray-600", "px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[9px] font-bold text-gray-600 dark:text-gray-300"],
  ["text-[10px] text-gray-500 font-medium", "text-[10px] text-gray-500 dark:text-gray-400 font-medium"],
  ["bg: 'bg-blue-50', border: 'border-blue-200'", "bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800'"],
  ["bg: 'bg-cyan-50', border: 'border-cyan-200'", "bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800'"],
  ["bg: 'bg-violet-50', border: 'border-violet-200'", "bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800'"],
  ["bg: 'bg-gray-50', border: 'border-gray-200'", "bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700'"],
  ["badge: 'bg-blue-100 text-blue-700'", "badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'"],
  ["badge: 'bg-cyan-100 text-cyan-700'", "badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'"],
  ["badge: 'bg-violet-100 text-violet-700'", "badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'"],
  ["badge: 'bg-gray-100 text-gray-700'", "badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"],
  ["text: 'text-blue-700'", "text: 'text-blue-700 dark:text-blue-300'"],
  ["text: 'text-cyan-700'", "text: 'text-cyan-700 dark:text-cyan-300'"],
  ["text: 'text-violet-700'", "text: 'text-violet-700 dark:text-violet-300'"],
  ["text: 'text-gray-700'", "text: 'text-gray-700 dark:text-gray-300'"],
  ["urgency = { bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-100 text-red-700', label: 'Expires today' }", "urgency = { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Expires today' }"],
  ["urgency = { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: timeLabel }", "urgency = { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: timeLabel }"],
  ["urgency = { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', label: timeLabel }", "urgency = { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', label: timeLabel }"],
  ["urgency = { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: timeLabel }", "urgency = { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: timeLabel }"],
  ["urgency = { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', label: timeLabel }", "urgency = { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: timeLabel }"],
  ["'bg-blue-100 text-blue-700'", "'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'"],
  ["'bg-cyan-100 text-cyan-700'", "'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'"],
  ["'bg-violet-100 text-violet-700'", "'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'"],
  ["idx === 0 ? 'border-purple-300 bg-purple-50' : idx === 1 ? 'border-gray-300 bg-gray-50' : idx === 2 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'", "idx === 0 ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20' : idx === 1 ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800' : idx === 2 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'"],
  ["inline-block px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700", "inline-block px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"],
  ["inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-700", "inline-block px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"],
];
let n = 0;
for (const [a, b] of reps) {
  const c = t.split(a).length - 1;
  if (c) {
    t = t.split(a).join(b);
    n += c;
    console.log(c, a.slice(0, 90));
  } else {
    console.log("MISS", a.slice(0, 90));
  }
}
fs.writeFileSync(p, t);
console.log("TOTAL", n);
