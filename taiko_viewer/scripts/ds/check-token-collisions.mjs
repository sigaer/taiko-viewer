#!/usr/bin/env node
// P0-04: do any existing files read a custom property that assets/css/ds/tokens.css also declares?
//
// For every name the ds token file declares, find `var(--name` reads in existing code (everything except the
// design-system directories, node_modules and build output) and decide whether the same file defines the name
// itself (CSS declaration `--name:` or an inline style binding '--name'). A read with a nearby definition is not
// affected. A read without one would pick up the ds value — but only under html.ds-preview, i.e. on the sample
// pages; existing pages never carry that class (D0-2). The run fails on reads without a local definition, so each
// new one gets looked at.
//
//   node scripts/ds/check-token-collisions.mjs [--root <dir>] [--tokens <file>]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { customDeclarations, parseBlocks } from "./lib/css-tokens.mjs";
import { DS_DIRS, lineAt, stripComments } from "./lib/ds-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const SKIP = new Set(["node_modules", ".nuxt", ".output", ".tja-runtime", "vendor", "reference", "tests", "scripts", "docs", "public", "loadtest"]);
const posix = (p) => p.split(sep).join("/");

export function declaredNames(css) {
  const names = new Set();
  for (const b of parseBlocks(css)) for (const d of customDeclarations(b.body)) names.add(d.prop);
  return names;
}

function existingFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const full = join(dir, name);
      const rel = posix(relative(root, full));
      if (DS_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(vue|css|ts|mjs|js)$/.test(name)) out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

/** Reads of ds names in one file: [{ name, line, localDefinition }] */
export function readsInFile(text, names) {
  const code = stripComments(text);
  const out = [];
  for (const m of code.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!names.has(m[1])) continue;
    const escaped = m[1].replace(/[-]/g, "\\-");
    const local = new RegExp(`(^|[\\s;{,"'\`])${escaped}\\s*["'\`]?\\s*:`, "m").test(code);
    out.push({ name: m[1], line: lineAt(code, m.index), localDefinition: local });
  }
  return out;
}

export function run(root = ROOT, tokensFile = join(root, "assets", "css", "ds", "tokens.css")) {
  const names = declaredNames(readFileSync(tokensFile, "utf8"));
  const reads = [];
  for (const file of existingFiles(root)) {
    for (const r of readsInFile(readFileSync(join(root, file), "utf8"), names)) reads.push({ file, ...r });
  }
  return { names, reads };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const root = args.includes("--root") ? resolve(args[args.indexOf("--root") + 1]) : ROOT;
  const tokens = args.includes("--tokens") ? resolve(args[args.indexOf("--tokens") + 1]) : undefined;
  const { names, reads } = run(root, tokens);
  const byName = new Map();
  for (const r of reads) byName.set(r.name, [...(byName.get(r.name) || []), r]);
  console.log(`ds tokens declared: ${names.size}; same-named reads in existing code: ${reads.length} (${byName.size} names)`);
  for (const [name, list] of byName) {
    for (const r of list) console.log(`${r.localDefinition ? "ok  " : "FAIL"}  ${name.padEnd(16)} ${r.file}:${r.line}  ${r.localDefinition ? "defined in the same file → unaffected" : "no local definition"}`);
  }
  const unresolved = reads.filter((r) => !r.localDefinition);
  console.log(
    unresolved.length
      ? `\n${unresolved.length} read(s) without a local definition (would see ds values on html.ds-preview pages only)`
      : "\nno collisions: every same-named read is defined locally; ds values only exist under html.ds-preview anyway"
  );
  if (existsSync(join(root, "server", "services", "reverse-oidc", "interaction.ts"))) {
    console.log("note  server/services/reverse-oidc/interaction.ts renders a standalone HTML page with its own --bg/--line/--accent; it never loads site stylesheets");
  }
  process.exitCode = unresolved.length ? 1 : 0;
}
