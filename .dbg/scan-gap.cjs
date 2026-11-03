const fs = require('fs');
const props = 'bg|text|border|from|to|via|ring|shadow|placeholder|divide|fill|stroke|accent|outline';
const re = new RegExp(
  '(?:[a-zA-Z-]+:)*(?:' + props + ')-(?:\\[[^\\]]+\\]|white(?:/\\d+)?|black(?:/\\d+)?|transparent|gray-\\d+|slate-\\d+|zinc-\\d+|neutral-\\d+|blue-\\d+|teal-\\d+|cyan-\\d+|sky-\\d+|indigo-\\d+|green-\\d+|emerald-\\d+|red-\\d+|rose-\\d+|yellow-\\d+|amber-\\d+|orange-\\d+|purple-\\d+|violet-\\d+|pink-\\d+|fuchsia-\\d+|lime-\\d+)',
  'g'
);
const tokens = new Set();
const src = fs.readFileSync(process.argv[2], 'utf8');
let m;
while ((m = re.exec(src))) tokens.add(m[0]);

// which of them are already remapped under .dark in globals.css?
const css = fs.readFileSync('styles/globals.css', 'utf8');
const mapped = new Set(
  (css.match(/\.dark\s+\.[^\s,{]+/g) || []).map((x) => x.replace(/^\.dark\s+\.?/, ''))
);
const list = [...tokens].sort();
const norm = new Set([...mapped].map((m) => m.replace(/\\/g, '')));
const variants = [':hover', '::placeholder', ':focus', ':disabled'];
const covered = (t) => norm.has(t) || variants.some((v) => norm.has(t + v));
const gaps = list.filter((t) => !covered(t));
console.log('TOTAL', list.length, 'GAPS', gaps.length);
console.log('--- GAPS ---');
console.log(gaps.join('\n'));
