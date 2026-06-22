// Static reachability analysis: from every Next.js entry point, follow imports
// (resolving @/ + shim aliases) and report source files that are never reached.
// Read-only — only prints. Deletion is a separate, reviewed step.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";

const ROOT = process.cwd();
const SRC_DIRS = ["app", "components", "hooks", "lib", "providers", "stores",
  "services", "config", "constants", "utils", "types", "validations", "shims"];
const CODE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const RESOLVE_EXT = [...CODE_EXT, ".json", ".css"];

const ALIASES = {
  "react-native": "shims/empty-module.ts",
  "@react-native-async-storage/async-storage": "shims/empty-module.ts",
};

// Next.js app-router files that are roots (auto-discovered, never imported)
const NEXT_ROOTS = /(^|\/)(page|layout|loading|error|global-error|not-found|route|template|default|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon|middleware|instrumentation)\.(ts|tsx|js|jsx|mjs)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// all source files under the tracked source dirs + root config
const allFiles = SRC_DIRS.flatMap(d => walk(join(ROOT, d)))
  .filter(f => CODE_EXT.includes(extname(f)));
const rootConfigs = ["next.config.ts", "postcss.config.mjs", "eslint.config.mjs", "tailwind.config.ts", "tailwind.config.js"]
  .map(f => join(ROOT, f)).filter(existsSync);

function resolve(spec, fromFile) {
  let base;
  if (ALIASES[spec]) base = join(ROOT, ALIASES[spec]);
  else if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null; // bare module → external
  // exact file
  if (existsSync(base) && statSync(base).isFile()) return base;
  // base + ext
  for (const e of RESOLVE_EXT) if (existsSync(base + e)) return base + e;
  // base/index + ext
  for (const e of RESOLVE_EXT) if (existsSync(join(base, "index" + e))) return join(base, "index" + e);
  return null;
}

const IMPORT_RE = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

function deps(file) {
  let txt;
  try { txt = readFileSync(file, "utf8"); } catch { return []; }
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(txt))) {
    const spec = m[1] || m[2] || m[3];
    if (!spec) continue;
    const r = resolve(spec, file);
    if (r && CODE_EXT.includes(extname(r))) out.push(r);
  }
  return out;
}

// roots: Next app-router files + root configs + the d.ts under types we keep
const roots = allFiles.filter(f => NEXT_ROOTS.test(f.replace(ROOT + "/", "")));
const seeds = [...roots, ...rootConfigs];

const reached = new Set();
const queue = [...seeds];
while (queue.length) {
  const f = queue.pop();
  if (reached.has(f)) continue;
  reached.add(f);
  for (const d of deps(f)) if (!reached.has(d)) queue.push(d);
}

const unused = allFiles.filter(f => !reached.has(f)).sort();
const byDir = {};
for (const f of unused) {
  const rel = relative(ROOT, f);
  const top = rel.split("/")[0];
  (byDir[top] ??= []).push(rel);
}

console.log(`source files: ${allFiles.length}`);
console.log(`reachable:    ${reached.size - rootConfigs.length} (from ${roots.length} next roots)`);
console.log(`UNUSED:       ${unused.length}\n`);
for (const [top, files] of Object.entries(byDir).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`── ${top}/ (${files.length}) ──`);
  for (const f of files) console.log(`  ${f}`);
}
