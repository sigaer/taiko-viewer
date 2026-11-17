#!/usr/bin/env node
// P0-29: colour and asset usage rules on the new design-system code (12 B2.1, B2.3, B12.2, B12.6, B12.7, B12.9).
//
// Scope: components/ds/, ds-samples/, assets/css/ds/ (tokens.css excepted — it defines the values), utils/ds/.
//   1. no hex colours and no literal rgb()/hsl() colours
//   2. no Primitive tokens (--ai-*, --shu-*, --asagi-*, --yamabuki-*)
//   3. --diff-* / --crown-* / --rank-* / --judge-* only in domain.css and the matching components
//   4. --don* / --ka* / --roll* only in note, judge, chart and lane components and domain.css
//   5. no filter / backdrop-filter / mix-blend-mode / mask / opacity on game-asset images
//   6. no dan badge or dan data; no legacy /icons/difficulty/ path
//
//   node scripts/ds/check-ds-usage.mjs [--root <dir>]     exit 1 on any finding
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { parse } from "@vue/compiler-sfc";
import { dsFiles, lineAt, stripComments } from "./lib/ds-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");

const EXEMPT = new Set(["assets/css/ds/tokens.css"]);
/** Sample pages that show every token as a swatch may name domain and note tokens. */
const TOKEN_SHOWCASE = /^ds-samples\/sections\/(\d+-)?tokens\.vue$/;
const DOMAIN = "assets/css/ds/domain.css";

/** Which files may read a domain / note token family. */
export const FAMILY_RULES = [
  { family: /--diff-[\w-]+/g, name: "--diff-*", allow: [/^components\/ds\/(Diff|DiffTabs|SongCell)\w*\.vue$/, /^components\/ds\/charts\//] },
  // components/ds/Note.vue may read exactly one crown token: --crown-dfc, the all-perfect note's rainbow ring
  // (04 V1.2 §9.12 `.note.dfc`). Any other --crown-* there, or --crown-dfc in any other file, still fails.
  {
    family: /--crown-[\w-]+/g,
    name: "--crown-*",
    allow: [/^components\/ds\/Crown\w*\.vue$/, /^components\/ds\/charts\//],
    except: [{ file: /^components\/ds\/Note\.vue$/, token: /^--crown-dfc$/ }]
  },
  { family: /--rank-[\w-]+/g, name: "--rank-*", allow: [/^components\/ds\/Rank\w*\.vue$/, /^components\/ds\/charts\//] },
  { family: /--judge-[\w-]+/g, name: "--judge-*", allow: [/^components\/ds\/(JudgeBar|Note)\w*\.vue$/, /^components\/ds\/charts\//] },
  {
    family: /--(?:don|ka|roll)(?:-[\w-]+)?(?![\w-])/g,
    name: "--don* / --ka* / --roll*",
    allow: [/^components\/ds\/(Note|JudgeBar)\w*\.vue$/, /^components\/ds\/charts\//, /^components\/ds\/\w*Lane\w*\.vue$/]
  }
];
const PRIMITIVE = /--(?:ai|shu|asagi|yamabuki)-\d+/g;
const HEX = /(?<![&\w])#[0-9a-fA-F]{3,8}(?![\w-])/g;
const LITERAL_COLOR = /\b(?:rgba?|hsla?)\(\s*[\d.]/g;
const ASSET_SELECTOR = /\b(img|picture|source)\b|(icon|asset|crown|rank|diff|plate|avatar)/i;
const ASSET_FORBIDDEN = /^(filter|backdrop-filter|-webkit-backdrop-filter|mix-blend-mode|mask|mask-[\w-]+|-webkit-mask[\w-]*|opacity)$/;

function cssOf(file, text) {
  if (file.endsWith(".css")) return [{ css: text, offset: 0 }];
  if (!file.endsWith(".vue")) return [];
  const { descriptor } = parse(text, { filename: file });
  return descriptor.styles.map((s) => ({ css: s.content, offset: s.loc.start.line - 1 }));
}

export function checkFile(file, text) {
  const findings = [];
  const add = (index, rule, detail) => findings.push({ file, line: lineAt(text, index), rule, detail });
  const code = stripComments(text);
  const isDomainCss = file === DOMAIN;
  const showcase = TOKEN_SHOWCASE.test(file);

  for (const m of code.matchAll(HEX)) {
    // `#imports`, `#app` etc. are module ids, not colours; only flag strings that parse as hex colours
    if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(m[0])) add(m.index, "hex colour", m[0]);
  }
  for (const m of code.matchAll(LITERAL_COLOR)) add(m.index, "literal colour", m[0]);
  for (const m of code.matchAll(PRIMITIVE)) add(m.index, "primitive token", m[0]);
  if (!isDomainCss && !showcase) {
    for (const rule of FAMILY_RULES) {
      if (rule.allow.some((re) => re.test(file))) continue;
      for (const m of code.matchAll(rule.family)) {
        if ((rule.except || []).some((e) => e.file.test(file) && e.token.test(m[0]))) continue;
        add(m.index, `${rule.name} outside its components`, m[0]);
      }
    }
  }
  for (const m of code.matchAll(/\bDanBadge\b|\bdanBadge\b|\bdan(?:Id|Name|Rank|Level)?\b\s*[:=]/g)) add(m.index, "dan badge / dan data", m[0]);
  for (const m of code.matchAll(/icons\/difficulty\//g)) add(m.index, "legacy icons/difficulty path", m[0]);

  for (const { css, offset } of cssOf(file, text)) {
    let root;
    try {
      root = postcss.parse(css);
    } catch {
      continue;
    }
    root.walkDecls((decl) => {
      const sel = decl.parent?.selector || "";
      if (ASSET_SELECTOR.test(sel) && ASSET_FORBIDDEN.test(decl.prop)) {
        findings.push({ file, line: (decl.source?.start?.line ?? 0) + offset, rule: "filter/blend/mask/opacity on a game asset", detail: `${sel} { ${decl.prop}: ${decl.value} }` });
      }
    });
  }
  if (file.endsWith(".vue")) {
    for (const m of code.matchAll(/<(?:img|picture|source)\b[^>]*>/g)) {
      if (/(filter|opacity|mix-blend-mode|mask)\s*:/.test(m[0])) add(m.index, "filter/blend/mask/opacity on a game asset", m[0].slice(0, 120));
    }
  }
  return findings;
}

export function run(root = ROOT) {
  return dsFiles(root)
    .filter((f) => !EXEMPT.has(f))
    .flatMap((f) => checkFile(f, readFileSync(resolve(root, f), "utf8")));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.argv.includes("--root") ? resolve(process.argv[process.argv.indexOf("--root") + 1]) : ROOT;
  const files = dsFiles(root).filter((f) => !EXEMPT.has(f));
  const findings = run(root);
  for (const f of findings) console.log(`FAIL  ${f.file}:${f.line}  ${f.rule}: ${f.detail}`);
  console.log(findings.length ? `\n${findings.length} finding(s)` : `\nds usage OK: ${files.length} files checked, 0 findings`);
  process.exitCode = findings.length ? 1 : 0;
}
