// TEMP diagnostic: scan a JS file for `$cond: [ ... ]` array forms and report
// any whose top-level element count is not exactly 3.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const n = src.length;
let i = 0;
let scanned = 0;
let bad = 0;

// Return true if the slice contains any real code (ignoring strings/comments).
function hasCode(text) {
  let s = 0;
  const e = text.length;
  let instr = null;
  while (s < e) {
    const c = text[s];
    if (instr) {
      if (c === "\\") {
        s += 2;
        continue;
      }
      if (c === instr) instr = null;
      s++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      // Any string literal outside a comment means this slice has real code.
      return true;
    }
    if (c === "/" && text[s + 1] === "/") {
      while (s < e && text[s] !== "\n") s++;
      continue;
    }
    if (c === "/" && text[s + 1] === "*") {
      s += 2;
      while (s < e && !(text[s] === "*" && text[s + 1] === "/")) s++;
      s += 2;
      continue;
    }
    if (/\S/.test(c)) return true;
    s++;
  }
  return false;
}

while (i < n) {
  const idx = src.indexOf("$cond", i);
  if (idx === -1) break;
  let j = idx + 5;
  while (j < n && /\s/.test(src[j])) j++;
  if (src[j] === ":") {
    j++;
    while (j < n && /\s/.test(src[j])) j++;
    if (src[j] === "[") {
      let k = j + 1;
      let depth = 1;
      let elemStart = k;
      let count = 0;
      const elems = [];
      let inStr = null;
      let inLine = false;
      let inBlock = false;
      while (k < n && depth > 0) {
        const c = src[k];
        if (inLine) {
          if (c === "\n") inLine = false;
          k++;
          continue;
        }
        if (inBlock) {
          if (c === "*" && src[k + 1] === "/") {
            inBlock = false;
            k += 2;
            continue;
          }
          k++;
          continue;
        }
        if (inStr) {
          if (c === "\\") {
            k += 2;
            continue;
          }
          if (c === inStr) inStr = null;
          k++;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") {
          inStr = c;
          k++;
          continue;
        }
        if (c === "/" && src[k + 1] === "/") {
          inLine = true;
          k += 2;
          continue;
        }
        if (c === "/" && src[k + 1] === "*") {
          inBlock = true;
          k += 2;
          continue;
        }
        if (c === "[" || c === "{" || c === "(") {
          depth++;
          k++;
          continue;
        }
        if (c === "]" || c === "}" || c === ")") {
          depth--;
          if (depth === 0) {
            const last = src.slice(elemStart, k);
            if (hasCode(last)) {
              count++;
              elems.push(last);
            }
            k++;
            break;
          }
          k++;
          continue;
        }
        if (c === "," && depth === 1) {
          const elem = src.slice(elemStart, k);
          if (hasCode(elem)) {
            count++;
            elems.push(elem);
          }
          elemStart = k + 1;
          k++;
          continue;
        }
        k++;
      }
      scanned++;
      if (count !== 3) {
        bad++;
        const line = src.slice(0, idx).split("\n").length;
        console.log(`LINE ${line}: $cond array has ${count} top-level args`);
        elems.forEach((e, ei) => {
          const flat = e.replace(/\s+/g, " ").slice(0, 90);
          console.log(`   arg[${ei}] = ${flat}`);
        });
      }
      i = k;
      continue;
    }
  }
  i = idx + 5;
}
console.log(`scan complete: ${scanned} $cond array forms checked, ${bad} invalid`);
