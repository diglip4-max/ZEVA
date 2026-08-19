// Quick syntax check: parse Priorities.jsx with @babel/parser and
// report any errors. Run with `node scratch/check-priorities-jsx.mjs`.
import { parse } from "@babel/parser";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, "..", "components", "staff-dashboard", "Priorities.jsx");
const src = readFileSync(target, "utf8");

try {
  parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties"],
  });
  console.log("OK: Priorities.jsx parsed cleanly");
} catch (e) {
  console.error("FAIL: Priorities.jsx parse error");
  console.error(e.message);
  if (e.loc) console.error(`at line ${e.loc.line}, col ${e.loc.column}`);
  process.exit(1);
}
