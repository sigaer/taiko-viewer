#!/usr/bin/env node
// P0-03 verification: the production token file against the V1.3 C+ specification.
//
//   node scripts/ds/check-tokens.mjs
//       Structure rules + compare assets/css/ds/tokens.css with the committed snapshot
//       scripts/ds/spec/tokens-v1.3-cplus.json (resolved values per context).
//   node scripts/ds/check-tokens.mjs --prototype <redesign-v1 dir> [--write-snapshot]
//       Also resolve the prototype's own cascade (src/styles/tokens.css + base.css, C+ state:
//       data-brand=teal, data-assets=authentic) and the tables in docs/04-design-system.md §2.2–§2.5,
//       compare both with the production file, and optionally rewrite the snapshot.
//
// Exit code 1 on any mismatch.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computed, declarations, norm, parseBlocks, splitTop } from "./lib/css-tokens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
export const TOKEN_FILE = join(ROOT, "assets", "css", "ds", "tokens.css");
export const SNAPSHOT = join(here, "spec", "tokens-v1.3-cplus.json");
/**
 * Deliberate differences from the frozen prototype, applied in order: the slice G colour tuning
 * (viewer-ds.md §实施调色（2026-11-18）) and the redesign palette (viewer-ds.md §改版调色（2026-11-27）).
 * The snapshot is the prototype cascade with these overlays applied; with --prototype the production file must equal
 * prototype + overlays, and production with the overlays reverted must equal the prototype and docs/04.
 * Overlay shape: changed.{both,light,dark,stage}[name] = { prototype, tuned } (prototype null = the token itself was
 * added by an earlier overlay), added.{both,light,dark,stage}[name] = value; `both` is the light and dark theme alike.
 */
export const TUNING_FILES = ["tuning-2026-11-18.json", "tuning-2026-11-27.json"].map((f) => join(here, "spec", f));
export const TUNINGS = TUNING_FILES.map((f) => JSON.parse(readFileSync(f, "utf8")));
export const TUNING_FILE = TUNING_FILES[0];
export const TUNING = TUNINGS[0];
const decls = (map) => Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(" ");
const part = (t, kind, key) => t[kind]?.[key] || {};
const tuned = (t, key) => Object.fromEntries(Object.entries(part(t, "changed", key)).map(([k, v]) => [k, v.tuned]));
const themed = (t, theme) => ({ ...tuned(t, "both"), ...tuned(t, theme), ...part(t, "added", "both"), ...part(t, "added", theme) });
/** CSS that applies the overlays on top of the prototype cascade (C+ teal selectors). */
export function prototypeTuningCss(ts = TUNINGS) {
  return ts
    .map(
      (t) => `:root[data-brand='teal']:not([data-theme='dark']) { ${decls(themed(t, "light"))} }
:root[data-brand='teal'][data-theme='dark'] { ${decls(themed(t, "dark"))} }
:root[data-brand='teal'] .stage { ${decls({ ...tuned(t, "stage"), ...part(t, "added", "stage") })} }
`
    )
    .join("");
}
/** CSS that puts the prototype values back over the production file (production selectors). */
export function productionRevertCss(ts = TUNINGS) {
  const back = (t, keys) =>
    decls(Object.fromEntries(keys.flatMap((key) => Object.entries(part(t, "changed", key))).filter(([, v]) => v.prototype != null).map(([k, v]) => [k, v.prototype])));
  return ts
    .map(
      (t) => `html.ds-preview:not([data-theme="dark"]) { ${back(t, ["both", "light"])} }
html.ds-preview[data-theme="dark"] { ${back(t, ["both", "dark"])} }
html.ds-preview .stage { ${back(t, ["stage"])} }
`
    )
    .join("");
}
const addedBy = (t) => [
  ...["both", "light", "dark", "stage"].flatMap((key) => Object.keys(part(t, "added", key))),
  ...["both", "light", "dark", "stage"].flatMap((key) => Object.entries(part(t, "changed", key)).filter(([, v]) => v.prototype == null).map(([k]) => k))
];
export const TUNING_ADDED = Object.fromEntries(TUNINGS.flatMap(addedBy).map((k) => [k, "added by a colour tuning overlay"]));
const tuningCount = (key) => TUNINGS.reduce((s, t) => s + ["both", "light", "dark", "stage"].reduce((n, k) => n + Object.keys(part(t, key, k)).length, 0), 0);

/** Prototype-only tokens that intentionally do not exist in production (name -> reason). */
export const PROTOTYPE_ONLY = {
  "--z-proto": "z-index of the prototype review panel (ProtoPanel); not part of the product"
};

const SCOPE_CLASS = "ds-preview";
const mobile = (q) => /max-width:\s*767px/.test(q);
export const PROD_CONTEXTS = {
  light: { classes: [SCOPE_CLASS], attrs: { "data-theme": "light" }, lang: "zh" },
  dark: { classes: [SCOPE_CLASS], attrs: { "data-theme": "dark" }, lang: "zh" },
  lightJa: { classes: [SCOPE_CLASS], attrs: { "data-theme": "light" }, lang: "ja" },
  lightMobile: { classes: [SCOPE_CLASS], attrs: { "data-theme": "light" }, lang: "zh", media: mobile }
};
const PROTO_CONTEXTS = {
  light: { attrs: { "data-theme": "light", "data-brand": "teal", "data-assets": "authentic" }, lang: "zh" },
  dark: { attrs: { "data-theme": "dark", "data-brand": "teal", "data-assets": "authentic" }, lang: "zh" },
  lightJa: { attrs: { "data-theme": "light", "data-brand": "teal", "data-assets": "authentic" }, lang: "ja" },
  lightMobile: { attrs: { "data-theme": "light", "data-brand": "teal", "data-assets": "authentic" }, lang: "zh", media: mobile }
};

/** Resolved values: { [context]: { root: {...}, stage: {...} } } */
export function resolveContexts(files, contexts) {
  const out = {};
  for (const [name, ctx] of Object.entries(contexts)) {
    const c = computed(files, ctx);
    out[name] = { root: c.root, stage: c.stage };
  }
  return out;
}

export function productionFiles() {
  return [{ name: "assets/css/ds/tokens.css", css: readFileSync(TOKEN_FILE, "utf8") }];
}

/** Structure rules for the production file (D0-2: everything scoped under html.ds-preview, custom properties only). */
export function structureProblems(css) {
  const problems = [];
  for (const block of parseBlocks(css)) {
    if (block.atRule) {
      problems.push(`at-rule not allowed: ${block.selector}`);
      continue;
    }
    if (block.media && !/^\(max-width:\s*767px\)$/.test(block.media)) problems.push(`unexpected media query: ${block.media}`);
    for (const sel of splitTop(block.selector)) {
      if (!/^html\.(?:ds-preview|viewer-rework)(?:\[data-theme="dark"\]|:not\(\[data-theme="dark"\]\))?(?::lang\(ja\)| :lang\(ja\))?(?: \.stage)?$/.test(sel.replace(/'/g, '"'))) {
        problems.push(`selector outside the explicit DS/shell scope rules: ${sel}`);
      }
    }
    for (const d of declarations(block.body)) {
      if (!d.prop.startsWith("--")) problems.push(`non-custom property ${d.prop} in ${block.selector}`);
    }
  }
  return problems;
}

export const EP_FILE = join(ROOT, "assets", "css", "ds", "element-plus.css");
const EP_SCOPES = ["html.ds-preview:root", "html.rework-ep:root"];

/**
 * Scope rules for the Element Plus mapping (assets/css/ds/element-plus.css): every selector starts with one of the
 * two root scopes — the sample pages (`ds-preview`) and reworked pages that opt in through route meta
 * `reworkElementPlus` (`rework-ep`, set by components/rework/Shell.vue) — and every rule lists exactly the same
 * selectors under both, so the opted-in pages get the sample pages' mapping and nothing else.
 */
export function elementPlusScopeProblems(css) {
  const problems = [];
  for (const block of parseBlocks(css)) {
    if (block.atRule || block.media) {
      problems.push(`at-rule or media query not allowed: ${block.atRule ? block.selector : block.media}`);
      continue;
    }
    const tails = { [EP_SCOPES[0]]: [], [EP_SCOPES[1]]: [] };
    for (const sel of splitTop(block.selector)) {
      const scope = EP_SCOPES.find((s) => sel === s || sel.startsWith(`${s} `));
      if (!scope) problems.push(`selector outside the Element Plus scopes: ${sel}`);
      else tails[scope].push(sel.slice(scope.length));
    }
    const [a, b] = EP_SCOPES.map((s) => tails[s].slice().sort().join(" | "));
    if (a !== b) problems.push(`rule not mirrored under both scopes: ${block.selector.replace(/\s+/g, " ").slice(0, 120)}`);
  }
  return problems;
}

function prototypeFiles(dir) {
  return [
    { name: "src/styles/tokens.css", css: readFileSync(join(dir, "src", "styles", "tokens.css"), "utf8") },
    { name: "src/styles/base.css", css: readFileSync(join(dir, "src", "styles", "base.css"), "utf8") }
  ];
}

/** Diff two resolved maps; returns lines. */
export function diffResolved(expected, actual, label, ignore = {}) {
  const lines = [];
  for (const ctx of Object.keys(expected)) {
    for (const el of ["root", "stage"]) {
      const e = expected[ctx]?.[el] || {};
      const a = actual[ctx]?.[el] || {};
      for (const name of Object.keys(e)) {
        if (ignore[name]) continue;
        if (!(name in a)) lines.push(`${label} ${ctx}/${el}: missing ${name} (expected ${e[name]})`);
        else if (norm(e[name]) !== norm(a[name])) lines.push(`${label} ${ctx}/${el}: ${name} = ${a[name]}, expected ${e[name]}`);
      }
      for (const name of Object.keys(a)) if (!(name in e) && !ignore[name]) lines.push(`${label} ${ctx}/${el}: extra ${name} = ${a[name]}`);
    }
  }
  return lines;
}

/* ---------------- docs/04 §2.2–§2.5 tables ---------------- */

/** Extract checkable rows from the doc: [{ token, light, dark, section }] with hex / var references only. */
export function parseDocTables(md) {
  const rows = [];
  const sections = md.split(/^### /m);
  for (const sec of sections) {
    const title = sec.split("\n")[0];
    if (!/^2\.[2-5]\b/.test(title)) continue;
    for (const line of sec.split("\n")) {
      if (!line.startsWith("| `--")) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      rows.push({ section: title.slice(0, 3), cells });
    }
  }
  return rows;
}

/** A single machine-readable value: `#hex`, `--token`, `var(--token)`, any back-ticked CSS value, or a bare 6px / 12%. */
const asValue = (cell) => {
  const c = cell
    .trim()
    .replace(/（[^）]*）$/, "")
    .replace(/^(?:沿用 V1\.2：|等于\s*)/, "")
    .trim();
  let m = c.match(/^`([^`]+)`$/);
  if (m) {
    const v = m[1].trim();
    if (/^--[\w-]+$/.test(v)) return `var(${v})`;
    return v;
  }
  m = c.match(/^(\d+(?:\.\d+)?(?:px|%))$/);
  return m ? m[1] : null;
};
/** `.28` → `0.28` so the doc's short decimals compare with the source. */
const decimals = (v) => String(v).replace(/(^|[\s(,/])\.(\d)/g, "$10.$2");
/** Split a cell on " / " outside back-ticks and parentheses. */
const splitValues = (cell) => {
  const out = [];
  let cur = "";
  let tick = false;
  let depth = 0;
  for (let i = 0; i < cell.length; i++) {
    const ch = cell[i];
    if (ch === "`") tick = !tick;
    else if (!tick && ch === "(") depth++;
    else if (!tick && ch === ")") depth--;
    if (!tick && !depth && cell.slice(i, i + 3) === " / ") {
      out.push(cur.trim());
      cur = "";
      i += 2;
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
};
/**
 * Prose cells the doc uses for light/dark pairs, rewritten into explicit per-theme lists:
 *   "浅 `a` / `b`；深 `c` / `d`" and "浅 `a`，深 `b`".
 */
const themedProse = (cell) => {
  const m = cell.match(/^浅\s*(.+?)\s*[；，]\s*深\s*(.+)$/);
  return m ? { light: m[1], dark: m[2] } : null;
};
/** "easy `#ff8a69`、hard `#75b7ed`、…" for a `--x-*-ink` name: [[key, value]]. */
const keyedProse = (cell) => {
  const pairs = [...cell.matchAll(/([\w-]+)\s*`([^`]+)`/g)].map((m) => [m[1], m[2]]);
  return pairs.length >= 2 ? pairs : null;
};

/**
 * Compare doc rows with resolved production values. Handles the doc's row shapes:
 *  - `| --a | light | dark | use |`            (2.2, 2.3 semantic)
 *  - `| --a / --b | v1 / v2 | v3 / v4 | use |` (pairs)
 *  - `| --a / -suffix | ... |`                  (shorthand names)
 *  - `| --a | value |` stage table and 2.4 role table (C+ single value; light and dark both)
 * Cells that are prose ("沿用 V1.2", "等于 --surface", mixes) are listed as not machine-checkable.
 */
export function checkDoc(md, resolvedProd) {
  const problems = [];
  const skipped = [];
  let checked = 0;
  const resolveIn = (expr, ctx) => {
    const lookup = resolvedProd[ctx].root;
    return expr.startsWith("var(") ? lookup[expr.slice(4, -1)] : expr;
  };
  const known = new Set(Object.keys(resolvedProd.light.root));
  const expandNames = (cell) => {
    const names = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const out = [];
    let base = null;
    for (const raw of names.join(" / ").split(/\s*\/\s*/)) {
      const n = raw.trim();
      if (!n) continue;
      if (n.startsWith("--")) {
        out.push(n);
        base = n;
      } else if (n.startsWith("-") && base) {
        // Shorthand suffixes: `--stage-ink / -ink-2` → `--stage-ink-2`, `--action-bg / -bg-hover` → `--action-bg-hover`,
        // `--vote-on / -wash` → `--vote-on-wash`. Stems are tried from one segment shorter than the base down to the
        // full base; the first name that exists wins (an unknown name is reported as missing).
        const segs = base.slice(2).split("-");
        const stems = [];
        for (let k = segs.length - 1; k >= 1; k--) stems.push("--" + segs.slice(0, k).join("-"));
        stems.push(base);
        const picked = stems.map((s) => s + n).find((c) => known.has(c));
        out.push(picked || base + n);
      }
    }
    return out;
  };
  const compare = (section, name, part, ctxs) => {
    const value = asValue(part);
    if (!value) {
      skipped.push(`${section} ${name}: "${part}"`);
      return;
    }
    for (const ctx of ctxs) {
      const expected = resolveIn(value, ctx);
      const actual = resolvedProd[ctx].root[name];
      checked++;
      if (expected == null) problems.push(`doc ${section} ${name} (${ctx}): reference ${value} is not defined in production`);
      else if (norm(decimals(expected)) !== norm(decimals(actual ?? ""))) problems.push(`doc ${section} ${name} (${ctx}): production ${actual}, doc ${part} → ${expected}`);
    }
  };
  for (const row of parseDocTables(md)) {
    const section = row.section;
    const nameCell = row.cells[0];
    const only = /（浅色）/.test(nameCell) ? ["light"] : /（深色）/.test(nameCell) ? ["dark"] : null;
    // `--diff-*-ink（深色）` | easy `#…`、hard `#…`
    if (/`--[\w-]*\*[\w-]*`/.test(nameCell)) {
      const pattern = nameCell.match(/`(--[\w-]*\*[\w-]*)`/)[1];
      const pairs = keyedProse(row.cells[1]);
      const all = row.cells[1].match(/^全部\s*(`[^`]+`)$/);
      if (pairs) {
        for (const [key, v] of pairs) compare(section, pattern.replace("*", key), `\`${v}\``, only || ["light", "dark"]);
      } else if (all) {
        const re = new RegExp(`^${pattern.replace("*", "[\\w-]+")}$`);
        for (const name of known) if (re.test(name)) compare(section, name, all[1], only || ["light", "dark"]);
      } else skipped.push(`${section} ${nameCell}: "${row.cells[1]}"`);
      continue;
    }
    const names = expandNames(nameCell);
    const twoColumns = section === "2.2" || (section === "2.3" && row.cells.length === 4);
    const columns = twoColumns ? [[row.cells[1], ["light"]], [row.cells[2], ["dark"]]] : [[row.cells[1], only || ["light", "dark"]]];
    if (!twoColumns) {
      const themed = themedProse(row.cells[1]);
      if (themed) columns.splice(0, 1, [themed.light, ["light"]], [themed.dark, ["dark"]]);
    }
    for (const [cell, ctxs] of columns) {
      const parts = splitValues(cell);
      if (parts.length !== names.length) {
        skipped.push(`${section} ${nameCell}: "${cell}"`);
        continue;
      }
      parts.forEach((part, i) => compare(section, names[i], part, ctxs));
    }
  }
  return { problems, skipped, checked };
}

/* ---------------- main ---------------- */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const protoDir = args.includes("--prototype") ? resolve(args[args.indexOf("--prototype") + 1]) : null;
  const css = readFileSync(TOKEN_FILE, "utf8");
  const problems = structureProblems(css);
  const epProblems = elementPlusScopeProblems(readFileSync(EP_FILE, "utf8"));
  problems.push(...epProblems.map((p) => `element-plus.css: ${p}`));
  if (!epProblems.length) console.log(`element-plus.css: every rule mirrored under ${EP_SCOPES.join(" and ")}`);
  const prod =resolveContexts(productionFiles(), PROD_CONTEXTS);
  let compared = 0;

  if (protoDir) {
    const strip = (resolved) => {
      for (const ctx of Object.values(resolved)) for (const el of ["root", "stage"]) for (const name of Object.keys(PROTOTYPE_ONLY)) delete ctx[el][name];
      return resolved;
    };
    // 1. production = prototype + tuning overlay (every value, both elements, four contexts)
    const proto = strip(resolveContexts([...prototypeFiles(protoDir), { name: "tuning overlay", css: prototypeTuningCss() }], PROTO_CONTEXTS));
    problems.push(...diffResolved(proto, prod, "prototype+tuning"));
    compared += Object.values(proto).reduce((s, c) => s + Object.keys(c.root).length + Object.keys(c.stage).length, 0);
    // 2. production with the tuning reverted = the untouched prototype (so the overlay is the whole difference)
    const pure = strip(resolveContexts(prototypeFiles(protoDir), PROTO_CONTEXTS));
    const reverted = resolveContexts([...productionFiles(), { name: "tuning revert", css: productionRevertCss() }], PROD_CONTEXTS);
    problems.push(...diffResolved(pure, reverted, "prototype (tuning reverted)", TUNING_ADDED));
    console.log(`tuning: ${tuningCount("changed")} changed and ${tuningCount("added")} added declarations (${TUNING_FILES.map((f) => f.split(/[\\/]/).pop()).join(" + ")})`);
    const docPath = join(protoDir, "docs", "04-design-system.md");
    if (existsSync(docPath)) {
      const doc = checkDoc(readFileSync(docPath, "utf8"), reverted);
      problems.push(...doc.problems);
      console.log(`docs/04 tables: ${doc.checked} values checked, ${doc.problems.length} mismatches, ${doc.skipped.length} prose cells not machine-checkable`);
      if (args.includes("--verbose")) for (const s of doc.skipped) console.log(`  skipped ${s}`);
    }
    if (args.includes("--write-snapshot")) {
      let commit = null;
      try {
        commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: protoDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      } catch {}
      // a prototype extracted outside git (git archive) keeps the commit recorded in the current snapshot
      if (!commit && existsSync(SNAPSHOT)) commit = JSON.parse(readFileSync(SNAPSHOT, "utf8")).commit;
      mkdirSync(dirname(SNAPSHOT), { recursive: true });
      writeFileSync(
        SNAPSHOT,
        JSON.stringify({ source: "preview/redesign-v1 src/styles/{tokens,base}.css, C+ (data-brand=teal, data-assets=authentic)", commit, prototypeOnly: PROTOTYPE_ONLY, contexts: proto }, null, 1) + "\n"
      );
      console.log(`snapshot written: ${SNAPSHOT}`);
    }
  }

  if (!existsSync(SNAPSHOT)) problems.push(`snapshot missing: ${SNAPSHOT} (run with --prototype <dir> --write-snapshot)`);
  else {
    const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    problems.push(...diffResolved(snap.contexts, prod, "snapshot"));
    compared += Object.values(snap.contexts).reduce((s, c) => s + Object.keys(c.root).length + Object.keys(c.stage).length, 0);
    console.log(`snapshot: ${snap.source} @ ${snap.commit}`);
  }

  for (const p of problems) console.log(`FAIL  ${p}`);
  console.log(problems.length ? `\n${problems.length} problem(s)` : `\ntokens OK: ${compared} resolved values compared across ${Object.keys(PROD_CONTEXTS).length} contexts × root/.stage`);
  process.exitCode = problems.length ? 1 : 0;
}
