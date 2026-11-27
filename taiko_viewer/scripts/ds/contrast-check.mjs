#!/usr/bin/env node
// P0-07: WCAG 2.x contrast of the production design-system tokens (assets/css/ds/tokens.css).
// Method and pairs follow the prototype's src/styles/contrast-check.mjs, teal (C+) light / dark only — the fumen
// (A/B) half is not maintained (12 B2.2, B12.10). Pairs whose meaning only exists in fumen are kept because the
// tokens still exist in C+; the teal-only pairs and the stage brand pairs are included.
// Also checks the Element Plus mapping pairs that put text on mapped colours (assets/css/ds/element-plus.css).
//
//   node scripts/ds/contrast-check.mjs [--json] [--tokens <file>]
// Exit code 1 when any pair is below its minimum.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computed, contrast, over, parseColor, toHex } from "./lib/css-tokens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const TEXT = 4.5;
const UI = 3;

const tint = (c, p, on = "--surface") => `color-mix(in srgb, var(${c}) ${p}%, var(${on}))`;
const DIFFS = ["easy", "normal", "hard", "oni", "ura"];
const RANKS = ["iki1", "iki2", "iki3", "miyabi1", "miyabi2", "miyabi3"];
const SECTIONS = ["official", "events", "beginner-help", "score-guides", "dojo", "achievements", "arcade", "general", "creative"];

/** [group, fg, bg, min, element] — element "stage" resolves both sides inside .stage */
export function pairs() {
  const list = [];
  const add = (group, fg, bg, min = TEXT, el = "root") => list.push({ group, fg, bg, min, el });
  for (const ink of ["--ink", "--ink-2", "--ink-3"]) for (const bg of ["--bg", "--bg-sunk", "--surface", "--surface-2"]) add("text", ink, bg);
  for (const bg of ["--surface", "--bg", "--don-wash"]) add("note text", "--don-ink", bg);
  for (const bg of ["--surface", "--bg", "--ka-wash"]) add("note text", "--ka-ink", bg);
  for (const bg of ["--surface", "--roll-wash"]) add("note text", "--roll-ink", bg);
  for (const bg of ["--surface", "--ok-wash"]) add("status text", "--ok", bg);
  for (const bg of ["--surface", "--danger-wash", "--don-wash"]) add("status text", "--danger", bg);
  add("status text", "--warn", "--surface");
  add("status text", "--warn", "--roll-wash");
  add("solid fill", "--ink-on-solid", "--don-solid");
  add("solid fill", "--bg", "--ink");
  add("solid fill", "--toast-ink", "--toast-bg");
  for (const d of DIFFS) {
    add("difficulty text", `--diff-${d}-ink`, "--surface");
    add("difficulty text", `--diff-${d}-ink`, tint(`--diff-${d}`, 14));
    add("difficulty fill", "--ink-on-solid", `--diff-${d}`);
  }
  for (const r of RANKS) {
    add("rank text", `--rank-${r}-ink`, "--surface");
    add("rank text", `--rank-${r}-ink`, tint(`--rank-${r}`, 14));
  }
  add("rank text", "--bg", "--rank-kiwami");
  add("crown text", "--crown-fc-ink", "--surface");
  add("crown text", "--crown-fc-ink", tint("--crown-fc", 20));
  for (const t of ["--lane-ink", "--lane-ink-2", "--lane-ink-3"]) add("lane text", t, "--lane");
  add("lane text", "--lane-ink-3", tint("--lane-ink", 9, "--lane"));
  for (const bg of ["--surface", "--bg", "--surface-2", "--overlay-bg"]) add("non-text", "--ctl-border", bg, UI);
  for (const bg of ["--surface", "--bg", "--bg-sunk", "--focus-gap"]) add("focus ring", "--focus-ring", bg, UI);
  add("focus ring", "--focus-gap", "--don-solid", UI);
  add("focus ring", "--focus-gap", "--action-bg", UI);
  add("focus ring", "--lane-focus", "--lane", UI);
  add("focus ring", "--lane-focus", tint("--lane-ink", 9, "--lane"), UI);
  for (const s of ["--status-attn", "--status-fail", "--status-ok"]) for (const bg of ["--surface", "--bg"]) add("status dot", s, bg, UI);
  for (const ink of ["--stage-ink", "--stage-ink-2", "--stage-ink-3"]) for (const bg of ["--stage-bg", "--stage-sunk", "--stage-surface"]) add("stage text", ink, bg);
  for (const bg of ["--stage-bg", "--stage-ka-wash"]) add("stage text", "--stage-ka-ink", bg);
  for (const bg of ["--stage-bg", "--stage-roll-wash"]) add("stage text", "--stage-roll-ink", bg);
  for (const bg of ["--stage-bg", "--stage-don-wash"]) add("stage text", "--stage-don-ink", bg);
  add("stage text", "--stage-bg", "--stage-ink");
  for (const bg of ["--stage-bg", "--stage-surface"]) add("stage non-text", "--stage-ctl-border", bg, UI);
  for (const bg of ["--stage-bg", "--stage-surface"]) add("stage non-text", "--stage-focus", bg, UI);
  for (const ink of ["--ink", "--ink-2", "--ink-3", "--link"]) add("overlay", ink, "--overlay-bg");
  add("role", "--action-ink", "--action-bg");
  add("role", "--action-ink", "--action-bg-hover");
  for (const bg of ["--surface", "--bg", "--bg-sunk"]) add("role", "--link", bg);
  add("role", "--selected-ink", "--selected-bg");
  add("role", "--seg-on-ink", "--seg-on-bg");
  add("role", "--nav-active-ink", "--nav-active-bg");
  for (const bg of ["--surface", "--bg"]) add("role", "--nav-active-text", bg);
  add("role", "--info-ink", "--info-wash");
  add("role", "--btn-ink-ink", "--btn-ink-bg");
  add("role", "--tag-don-ink", "--tag-don-bg");
  add("role", "--tag-info-ink", "--tag-info-bg");
  add("role", "--warn", "--warn-wash");
  add("role", "--toast-text", "--toast-surface");
  add("role", "--annual-ink", "--annual-wash");
  add("role", "--role-mod-ink", "--role-mod-bg");
  add("role", "--role-admin-ink", "--role-admin-bg");
  for (const ink of ["--link", "--ink", "--ink-3"]) add("role", ink, "--row-sel-bg");
  for (const bg of ["--surface", "--bg"]) add("role", "--lock-ink", bg);
  for (const bg of ["--surface", "--bg"]) add("role", "--emph-num", bg);
  for (const fg of ["--selected-line", "--tab-line", "--series", "--input-focus-line", "--series-alt", "--row-sel-line", "--progress-line"]) add("role non-text", fg, "--surface", UI);
  add("lamp text", "--diff-ura-ink", "color-mix(in srgb, var(--crown-clear) 16%, var(--surface))");
  add("lamp text", "--diff-ura-ink", "color-mix(in srgb, var(--crown-fc) 20%, var(--surface))");
  add("lane", "--lane-ka", "--lane", UI);
  for (const s of SECTIONS) for (const bg of ["--surface", "--bg"]) add("section dot", `--section-${s}`, bg, UI);
  // Brand on the stage surface (tokens.css html.ds-preview .stage)
  add("stage brand", "--brand-primary", "--bg", TEXT, "stage");
  add("stage brand", "--brand-primary", "--surface", TEXT, "stage");
  add("stage brand", "--brand-on-primary", "--brand-primary", TEXT, "stage");
  add("stage brand", "--brand-primary", "--brand-soft", TEXT, "stage");
  add("stage role", "--action-ink", "--action-bg", TEXT, "stage");
  add("stage role", "--link", "--surface", TEXT, "stage");
  // Element Plus mapping (element-plus.css): text on the mapped colours
  add("element-plus", "--action-ink", "--action-bg"); // primary button
  add("element-plus", "--link", "--surface"); // primary plain / text button
  add("element-plus", "--link", "--selected-bg"); // primary plain hover
  add("element-plus", "--ink", "--surface"); // secondary button
  add("element-plus", "--ink", "--bg-sunk"); // secondary hover
  add("element-plus", "--danger", "--surface"); // destructive outline
  add("element-plus", "--danger", "--danger-wash"); // destructive hover
  add("element-plus", "--danger", "--surface", UI); // destructive border
  add("element-plus", "--ink-2", "--bg-sunk"); // info tag / info light-9
  add("element-plus", "--ink-3", "--surface"); // placeholder, disabled text
  add("element-plus", "--ink-3", "--bg-sunk"); // disabled text on disabled bg
  add("element-plus", "--link", "--bg-sunk"); // selected option on an overlay
  add("element-plus", "--ink", "--overlay-bg"); // dialog / dropdown / tooltip text
  add("element-plus", "--toast-text", "--toast-surface"); // message
  add("element-plus", "--ok", "--ok-wash"); // success tag
  add("element-plus", "--warn", "--warn-wash"); // warning tag
  add("element-plus", "--action-bg", "--surface", UI); // switch on, checkbox
  add("element-plus", "--ctl-border", "--surface", UI); // switch off, input border
  // Slice G tuning: the teal frame (--chrome-*), the primary fill and its states, separation of the neutral page
  for (const ink of ["--ink", "--ink-2", "--ink-3", "--link", "--nav-active-text"]) for (const bg of ["--chrome-bg", "--chrome-surface", "--chrome-sunk"]) add("chrome", ink, bg);
  add("chrome", "--nav-active-ink", "--nav-active-bg");
  for (const bg of ["--chrome-bg", "--chrome-surface"]) add("chrome non-text", "--focus-ring", bg, UI);
  add("chrome non-text", "--line-strong", "--chrome-surface", 1.2); // search field edge in the bar
  add("role", "--action-ink", "--action-bg-active");
  for (const bg of ["--surface", "--bg", "--surface-2"]) add("role non-text", "--action-bg", bg, UI); // primary fill vs its surroundings
  // Disabled text is exempt from 1.4.3; the floor keeps the label legible while it no longer reads as enabled
  add("disabled", "--disabled-ink", "--disabled-bg", 2.5);
  // Redesign palette (2026-11-27): brand-coloured text, the dark sidebar (--side-*)
  for (const bg of ["--surface", "--bg", "--bg-sunk", "--surface-2", "--brand-soft", "--chrome-bg"]) add("brand text", "--brand-ink", bg);
  add("stage brand", "--brand-ink", "--surface", TEXT, "stage");
  add("stage brand", "--brand-ink", "--brand-soft", TEXT, "stage");
  add("stage role", "--action-ink", "--action-bg-hover", TEXT, "stage");
  add("stage role", "--action-ink", "--action-bg-active", TEXT, "stage");
  for (const ink of ["--side-ink", "--side-ink-2", "--side-ink-strong"]) for (const bg of ["--side-bg", "--side-surface"]) add("sidebar", ink, bg);
  for (const fg of ["--focus-ring", "--action-bg"]) for (const bg of ["--side-bg", "--side-surface"]) add("sidebar non-text", fg, bg, UI);
  return list;
}

export function run(tokensCss) {
  const files = [{ name: "tokens", css: tokensCss }];
  const rows = [];
  for (const theme of ["light", "dark"]) {
    const c = computed(files, { classes: ["ds-preview"], attrs: { "data-theme": theme }, lang: "zh" });
    for (const p of pairs()) {
      const vars = p.el === "stage" ? c.stage : c.root;
      const resolve = (expr) => {
        const src = expr.startsWith("--") ? vars[expr] : expr.replace(/var\((--[\w-]+)\)/g, (_, n) => vars[n]);
        if (src == null) throw new Error(`undefined token ${expr} (${theme})`);
        return parseColor(src);
      };
      const base = parseColor(vars["--bg"]);
      let bg = resolve(p.bg);
      if (bg[3] < 1) bg = over(bg, base);
      let fg = resolve(p.fg);
      if (fg[3] < 1) fg = over(fg, bg);
      const ratio = contrast(fg, bg);
      rows.push({ ...p, theme, fgHex: toHex(fg), bgHex: toHex(bg), ratio, pass: ratio >= p.min });
    }
  }
  return rows;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.includes("--tokens") ? resolve(args[args.indexOf("--tokens") + 1]) : join(ROOT, "assets", "css", "ds", "tokens.css");
  const rows = run(readFileSync(file, "utf8"));
  if (args.includes("--json")) console.log(JSON.stringify(rows, null, 1));
  else {
    const light = rows.filter((r) => r.theme === "light");
    const dark = rows.filter((r) => r.theme === "dark");
    console.log("group".padEnd(16) + "fg".padEnd(22) + "bg".padEnd(30) + "light".padStart(8) + "dark".padStart(8) + "  min");
    const f = (r) => (r.pass ? "" : "x") + r.ratio.toFixed(2);
    light.forEach((l, i) => {
      const bg = l.bg.startsWith("color-mix") ? l.bg.replace(/color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)/, "$1@$2%/$3") : l.bg;
      console.log(`${l.group.padEnd(16)}${(l.el === "stage" ? "." + l.fg : l.fg).padEnd(22)}${bg.padEnd(30)}${f(l).padStart(8)}${f(dark[i]).padStart(8)}  ${l.min}`);
    });
  }
  const bad = rows.filter((r) => !r.pass);
  console.log(bad.length ? `\n${bad.length} of ${rows.length} pairs below minimum` : `\nall ${rows.length} pairs pass (${rows.length / 2} pairs × light / dark)`);
  process.exitCode = bad.length ? 1 : 0;
}
