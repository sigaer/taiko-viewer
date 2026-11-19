#!/usr/bin/env node
// P0-05: old ↔ new token table for stage 1 (aliasing). Stage 0 changes nothing with it.
//
//   node scripts/ds/token-mapping.mjs            check that docs/design-system/viewer-token-mapping.md is current
//   node scripts/ds/token-mapping.mjs --write    regenerate it
//
// The only hand-written part is OLD_TO_NEW (which new token an old one corresponds to). Every value, every
// same / differs verdict and every reader count is computed here from assets/css/tokens.css (production),
// assets/css/ds/tokens.css and assets/css/ds/element-plus.css. The check fails when a --viewer-* or --el-*
// declared in production is missing from the table, or when the committed document is stale.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { computed, customDeclarations, parseBlocks, parseColor, toHex } from "./lib/css-tokens.mjs";
import { DS_DIRS } from "./lib/ds-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
export const DOC = join(ROOT, "docs", "design-system", "viewer-token-mapping.md");

/** old --viewer-* → new token (null = no V1.3 equivalent; stays local to its feature or is retired in stage 5). */
export const OLD_TO_NEW = {
  "--viewer-font-zh": "--font-cjk-sc",
  "--viewer-font-ja": "--font-cjk-jp",
  "--viewer-font-family": "--font-ui",
  "--viewer-display-font": "--font-ui",
  "--viewer-bg": "--bg",
  "--viewer-surface": "--surface",
  "--viewer-surface-subtle": "--bg-sunk",
  "--viewer-surface-hover": "--surface-2",
  "--viewer-text": "--ink",
  "--viewer-text-muted": "--ink-3",
  "--viewer-text-disabled": "--ink-3",
  "--viewer-border": "--line",
  "--viewer-control-border": "--ctl-border",
  "--viewer-primary": "--action-bg",
  "--viewer-primary-hover": "--action-bg-hover",
  "--viewer-on-primary": "--action-ink",
  "--viewer-link": "--link",
  "--viewer-selected": "--selected-bg",
  "--viewer-primary-surface": "--selected-bg",
  "--viewer-success": "--ok",
  "--viewer-success-surface": "--ok-wash",
  "--viewer-warning": "--warn",
  "--viewer-warning-surface": "--warn-wash",
  "--viewer-error": "--danger",
  "--viewer-error-surface": "--danger-wash",
  "--viewer-info": "--ink-2",
  "--viewer-info-surface": "--bg-sunk",
  "--viewer-overlay": "--scrim",
  "--viewer-shadow": null,
  "--viewer-tooltip-bg": "--overlay-bg",
  "--viewer-tooltip-text": "--ink",
  "--viewer-media-overlay": null,
  "--viewer-media-text": null,
  "--viewer-pattern": null,
  "--viewer-chart-fill": null,
  "--viewer-constant-comprehensive": null,
  "--viewer-constant-comprehensive-surface": null,
  "--viewer-constant-star": null,
  "--viewer-constant-star-surface": null,
  "--viewer-difficulty-easy": "--diff-easy",
  "--viewer-difficulty-normal": "--diff-normal",
  "--viewer-difficulty-hard": "--diff-hard",
  "--viewer-difficulty-oni": "--diff-oni",
  "--viewer-difficulty-edit": "--diff-ura",
  "--viewer-guide-hardest": null,
  "--viewer-guide-harder": null,
  "--viewer-guide-hard": null,
  "--viewer-guide-normal": null,
  "--viewer-guide-easy": null,
  "--viewer-guide-easier": null,
  "--viewer-guide-easiest": null,
  "--viewer-radius": "--r-panel",
  "--viewer-space-group": "--sp-8",
  "--viewer-space-item": "--sp-3",
  "--viewer-content-standard": null,
  "--viewer-content-wide": null,
  "--viewer-content-reading": null,
  "--viewer-page-gutter": "--gutter",
  "--viewer-bg-top": "--bg",
  "--viewer-bg-mid": "--bg",
  "--viewer-bg-bottom": "--bg",
  "--viewer-accent": "--action-bg",
  "--viewer-accent-strong": "--link"
};

const posix = (p) => p.split(sep).join("/");
const SKIP = new Set(["node_modules", ".nuxt", ".output", ".tja-runtime", "vendor", "reference", "tests", "scripts", "docs", "public", "loadtest"]);

function readerCounts(root, names) {
  const counts = Object.fromEntries(names.map((n) => [n, 0]));
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const full = join(dir, name);
      const rel = posix(relative(root, full));
      if (DS_DIRS.some((d) => rel.startsWith(`${d}/`) || rel === d)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(vue|css|ts)$/.test(name) && rel !== "assets/css/tokens.css") {
        const text = readFileSync(full, "utf8");
        for (const n of names) if (text.includes(`var(${n})`) || text.includes(`var(${n},`)) counts[n]++;
      }
    }
  };
  walk(root);
  return counts;
}

const asColor = (v) => {
  if (v == null) return null;
  try {
    const c = parseColor(v);
    return c[3] < 1 ? `${toHex(c)}/${Math.round(c[3] * 100)}%` : toHex(c);
  } catch {
    return null;
  }
};
const verdict = (a, b) => {
  if (a == null || b == null) return "—";
  const ca = asColor(a);
  const cb = asColor(b);
  if (ca && cb) return ca === cb ? "same" : "differs";
  return a.replace(/\s+/g, "") === b.replace(/\s+/g, "") ? "same" : "differs";
};
const show = (v) => (v == null ? "—" : asColor(v) || v.replace(/\|/g, "\\|"));

export function build(root = ROOT) {
  const prodCss = readFileSync(join(root, "assets", "css", "tokens.css"), "utf8");
  const dsCss = readFileSync(join(root, "assets", "css", "ds", "tokens.css"), "utf8");
  const epCss = readFileSync(join(root, "assets", "css", "ds", "element-plus.css"), "utf8");
  const prodNames = [];
  for (const b of parseBlocks(prodCss)) for (const d of customDeclarations(b.body)) if (!prodNames.includes(d.prop)) prodNames.push(d.prop);
  const prod = {};
  const ds = {};
  for (const theme of ["light", "dark"]) {
    prod[theme] = computed([{ name: "prod", css: prodCss }], { attrs: { "data-theme": theme }, lang: "zh" }).root;
    ds[theme] = computed([{ name: "ds", css: dsCss }, { name: "ep", css: epCss }], { classes: ["ds-preview"], attrs: { "data-theme": theme }, lang: "zh" }).root;
  }
  const viewer = prodNames.filter((n) => n.startsWith("--viewer-"));
  const el = prodNames.filter((n) => n.startsWith("--el-"));
  const problems = [];
  for (const n of viewer) if (!(n in OLD_TO_NEW)) problems.push(`${n} has no row in OLD_TO_NEW`);
  for (const n of Object.keys(OLD_TO_NEW)) if (!viewer.includes(n)) problems.push(`${n} in OLD_TO_NEW is not declared in assets/css/tokens.css`);
  for (const n of el) if (!(n in ds.light)) problems.push(`${n} is mapped in production but not in assets/css/ds/element-plus.css`);
  const readers = readerCounts(root, [...viewer, ...el]);

  const rowsViewer = viewer.map((n) => {
    const target = OLD_TO_NEW[n];
    const cells = ["light", "dark"].map((t) => [prod[t][n], target ? ds[t][target] : null]);
    const v = cells.map(([a, b]) => (target ? verdict(a, b) : "—"));
    return { name: n, target, cells, verdicts: v, readers: readers[n] };
  });
  const rowsEl = el.map((n) => {
    const cells = ["light", "dark"].map((t) => [prod[t][n], ds[t][n]]);
    return { name: n, target: n, cells, verdicts: cells.map(([a, b]) => verdict(a, b)), readers: readers[n] };
  });
  const kind = (r) => (!r.target ? "no equivalent" : r.verdicts.every((v) => v === "same") ? "alias keeps the look" : "alias changes the look");
  const md = [];
  md.push("# Viewer token mapping (old → V1.3)");
  md.push("");
  md.push("Generated by `node scripts/ds/token-mapping.mjs --write` from `assets/css/tokens.css`, `assets/css/ds/tokens.css` and `assets/css/ds/element-plus.css`. Do not edit by hand; `npm run check:ds` fails when this file is stale.");
  md.push("");
  md.push("Input for stage 1 (aliasing `--viewer-*` to V1.3 tokens and switching Element Plus globally). Stage 0 applies none of it. The only hand-written part is the target column (`OLD_TO_NEW` in the script). Values are resolved; colours are shown as hex (alpha as `/NN%`). \"Readers\" counts existing files outside the design-system folders that read the token with `var()` — the places that change when an alias changes the value.");
  md.push("");
  const summary = (rows) => {
    const s = { "alias keeps the look": 0, "alias changes the look": 0, "no equivalent": 0 };
    for (const r of rows) s[kind(r)]++;
    return Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(" · ");
  };
  md.push(`## --viewer-* (${viewer.length})`);
  md.push("");
  md.push(summary(rowsViewer));
  md.push("");
  md.push("| old | new | light old → new | dark old → new | light | dark | readers | verdict |");
  md.push("|---|---|---|---|---|---|---|---|");
  for (const r of rowsViewer) {
    md.push(`| \`${r.name}\` | ${r.target ? `\`${r.target}\`` : "—"} | ${show(r.cells[0][0])} → ${show(r.cells[0][1])} | ${show(r.cells[1][0])} → ${show(r.cells[1][1])} | ${r.verdicts[0]} | ${r.verdicts[1]} | ${r.readers} | ${kind(r)} |`);
  }
  md.push("");
  md.push(`## --el-* (${el.length}): production mapping → V1.3 mapping (as on the sample pages)`);
  md.push("");
  md.push(summary(rowsEl));
  md.push("");
  md.push("| variable | light old → new | dark old → new | light | dark | readers | verdict |");
  md.push("|---|---|---|---|---|---|---|");
  for (const r of rowsEl) md.push(`| \`${r.name}\` | ${show(r.cells[0][0])} → ${show(r.cells[0][1])} | ${show(r.cells[1][0])} → ${show(r.cells[1][1])} | ${r.verdicts[0]} | ${r.verdicts[1]} | ${r.readers} | ${kind(r)} |`);
  md.push("");
  md.push("Known visible changes once aliased (02.1 / 02.2 of the stage-0 task list): the primary colour (vermilion → Viewer Teal), the dark-theme lightness ladder, difficulty colours, info (blue-grey → neutral) and tooltips (dark chip → overlay surface).");
  md.push("");
  return { markdown: md.join("\n"), problems };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { markdown, problems } = build();
  if (process.argv.includes("--write")) {
    writeFileSync(DOC, markdown);
    console.log(`written ${DOC}`);
  } else if (!existsSync(DOC) || readFileSync(DOC, "utf8").replace(/\r\n/g, "\n") !== markdown) problems.push("docs/design-system/viewer-token-mapping.md is stale (run with --write)");
  for (const p of problems) console.log(`FAIL  ${p}`);
  if (!problems.length) console.log("token mapping OK: every --viewer-* and --el-* is in the table and the document is current");
  process.exitCode = problems.length ? 1 : 0;
}
