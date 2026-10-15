// Diagnose the Next/webpack SWC "Expression expected" error at packages-sold.js:1336
// Run from ZEVA root: node .dbg/swc-parse-check.js
const path = require("path");
const fs = require("fs");

const file = path.join(__dirname, "..", "pages", "api", "clinic", "reports", "packages-sold.js");
const code = fs.readFileSync(file, "utf8");
const st = fs.statSync(file);
console.log("file:", file);
console.log("bytes:", Buffer.byteLength(code), "| mtime:", st.mtime.toISOString());
console.log("CRLF:", /\r\n/.test(code), "| lone CR:", /\r(?!\n)/.test(code), "| BOM:", code.charCodeAt(0) === 0xfeff);

// 1) non-ASCII / control character census
const census = new Map();
for (let i = 0; i < code.length; i++) {
  const c = code.charCodeAt(i);
  if (c === 9 || c === 10 || c === 13) continue;
  if (c < 32 || c > 126) {
    if (!census.has(c)) census.set(c, { count: 0, first: i });
    census.get(c).count++;
  }
}
const posOf = (i) => {
  const b = code.slice(0, i).split("\n");
  return `${b.length}:${b[b.length - 1].length + 1}`;
};
console.log("non-ascii/control char types:", census.size);
for (const [c, e] of census) {
  console.log(`   U+${c.toString(16).toUpperCase().padStart(4, "0")} x${e.count} first at ${posOf(e.first)}`);
}

// 2) dump reported error region with JSON escaping (reveals hidden chars)
const lines = code.split(/\r?\n/);
console.log("\nregion 1328-1345 (JSON-escaped):");
for (let i = 1327; i <= 1344 && i < lines.length; i++) console.log(`${i + 1}: ${JSON.stringify(lines[i])}`);

// 3) SWC parse attempts (same engine family as Next/webpack)
function tryParse(label, fn) {
  try {
    fn();
    console.log(`[OK]   ${label}`);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.log(`[FAIL] ${label}`);
    console.log("       " + msg.split("\n").slice(0, 16).join("\n       "));
  }
}

let binding = null;
for (const m of ["@next/swc-win32-x64-msvc", "@next/swc-windows-x64-msvc", "@swc/core"]) {
  try {
    binding = require(m);
    console.log(`\nloaded ${m}; keys: ${Object.keys(binding).slice(0, 60).join(", ")}`);
    break;
  } catch (e) {
    console.log(`not available: ${m} (${e.message.split("\n")[0]})`);
  }
}

if (binding) {
  if (typeof binding.parseSync === "function") {
    tryParse("swc parseSync ecmascript jsx:true", () => binding.parseSync(code, { syntax: "ecmascript", jsx: true, target: "es2020" }));
    tryParse("swc parseSync ecmascript (no jsx)", () => binding.parseSync(code, { syntax: "ecmascript", target: "es2020" }));
    tryParse("swc parseSync typescript", () => binding.parseSync(code, { syntax: "typescript", tsx: false }));
  } else {
    console.log("binding has no parseSync");
  }
  if (typeof binding.transformSync === "function") {
    tryParse("swc transformSync ecmascript jsx:true", () =>
      binding.transformSync(code, { filename: file, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2017" }, sourceMaps: false }));
  }
}

// 4) Next's own SWC wrapper (what the webpack loader actually calls)
try {
  const nextSwc = require("next/dist/build/swc");
  console.log("\nnext/dist/build/swc keys:", Object.keys(nextSwc).join(", "));
  if (typeof nextSwc.transformSync === "function") {
    tryParse("next transformSync ecmascript jsx:true", () =>
      nextSwc.transformSync(code, { filename: file, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2017" }, sourceMaps: false }));
  }
} catch (e) {
  console.log("next/dist/build/swc not loadable:", e.message.split("\n")[0]);
}

// 5) TypeScript transpileModule syntactic diagnostics (mirrors the IDE linter)
let ts = null;
try { ts = require("typescript"); } catch {}
if (ts) {
  const res = ts.transpileModule(code, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2019, jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, esModuleInterop: true },
  });
  const diags = res.diagnostics || [];
  console.log(`\nTS ${ts.version} transpileModule diagnostics: ${diags.length}`);
  for (const d of diags.slice(0, 15)) {
    const p = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    console.log(`   ${p ? `${p.line + 1}:${p.character + 1} ` : ""}${ts.flattenDiagnosticMessageText(d.messageText, " | ")}`);
  }
} else {
  console.log("typescript module not found");
}
