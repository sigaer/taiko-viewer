#!/usr/bin/env node
// P0-30: copy rules for the new design-system code (12 B8.1, B8.4; AGENTS.md "UI Copy and Specification Leakage").
//
//   1. components/ds/: no visible Chinese / Japanese literals in templates, attributes or scripts — text comes from
//      locale keys (t / $t). ds-samples/: the same, except inside an element marked `data-ds-specimen`
//      (type specimens); sample labels are component, token and state names.
//   2. no inline bilingual code: `locale === 'ja'`-style branches or { zh: …, ja: … } literals
//   3. every t('key') / $t('key') used in those files exists in both locales/zh.json and locales/ja.json
//   4. the `ds` key of zh.json and ja.json have the same key paths, with non-empty strings
//
// Reviewing the wording itself (no spec language or design rationale) stays a human step; this script lists
// every ds.* string so the review has a complete list (--list).
//
//   node scripts/ds/check-ds-copy.mjs [--list]     exit 1 on any finding
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { CJK, dsFiles, lineAt, stripComments } from "./lib/ds-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");

const flatten = (obj, prefix = "") =>
  Object.entries(obj || {}).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Walk a Vue template AST; report CJK text and static attribute values outside data-ds-specimen elements. */
function templateFindings(file, text) {
  const out = [];
  const { descriptor } = parse(text, { filename: file });
  const ast = descriptor.template?.ast;
  if (!ast) return out;
  const visit = (node, specimen) => {
    if (node.type === 1) {
      const isSpecimen = specimen || node.props.some((p) => p.type === 6 && p.name === "data-ds-specimen");
      for (const p of node.props) {
        if (p.type === 6 && p.value && CJK.test(p.value.content) && !isSpecimen) out.push({ line: p.loc.start.line, rule: "CJK literal in attribute", detail: `${p.name}="${p.value.content}"` });
        if (p.type === 7 && p.exp && CJK.test(p.exp.content) && !isSpecimen) out.push({ line: p.loc.start.line, rule: "CJK literal in binding", detail: p.exp.content.slice(0, 80) });
      }
      for (const c of node.children || []) visit(c, isSpecimen);
    } else if (node.type === 2) {
      if (CJK.test(node.content) && !specimen) out.push({ line: node.loc.start.line, rule: "CJK text in template", detail: node.content.trim().slice(0, 80) });
    } else if (node.type === 5 && node.content?.content && CJK.test(node.content.content) && !specimen) {
      out.push({ line: node.loc.start.line, rule: "CJK literal in interpolation", detail: node.content.content.slice(0, 80) });
    } else if (node.children) for (const c of node.children) visit(c, specimen);
  };
  visit(ast, false);
  return out;
}

export function checkFile(file, text, locales) {
  const findings = [];
  const add = (line, rule, detail) => findings.push({ file, line, rule, detail });
  const code = stripComments(text);
  const isSample = file.startsWith("ds-samples/");
  if (file.endsWith(".vue")) for (const f of templateFindings(file, text)) add(f.line, f.rule, f.detail);
  // Script blocks / ts files: CJK string literals
  const scripts = file.endsWith(".vue") ? [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => ({ src: m[1], at: m.index + m[0].indexOf(m[1]) })) : /\.(ts|mjs|js)$/.test(file) ? [{ src: code, at: 0 }] : [];
  for (const { src, at } of scripts) {
    for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      if (CJK.test(m[2])) add(lineAt(code, at + m.index), "CJK string literal in script", m[0].slice(0, 80));
    }
  }
  for (const m of code.matchAll(/\blocale(?:\.value)?\s*={2,3}\s*["'](?:ja|zh)["']|["'](?:ja|zh)["']\s*={2,3}\s*locale\b|\blocale(?:\.value)?\.startsWith\(\s*["']ja/g)) {
    if ((file.startsWith("utils/ds/") || file.startsWith("utils/rework/"))) continue; // pure helpers may take a locale argument (rankName)
    add(lineAt(code, m.index), "inline language branch", m[0]);
  }
  for (const m of code.matchAll(/\{\s*zh\s*:\s*["'`][^}]*\bja\s*:/g)) add(lineAt(code, m.index), "inline bilingual literal", m[0].slice(0, 80));
  for (const m of code.matchAll(/(?<![\w.$])\$?t\(\s*["'`]([\w.-]+)["'`]/g)) {
    const key = m[1];
    for (const [code_, messages] of Object.entries(locales)) {
      if (typeof get(messages, key) !== "string") add(lineAt(code, m.index), `locale key missing in ${code_}.json`, key);
    }
  }
  if (!isSample) {
    for (const m of code.matchAll(/(?<![\w.$])\$?t\(\s*`([^`]*\$\{[^`]*)`/g)) {
      if (!/^ds\.|^difficulty\.|^rework\./.test(m[1])) add(lineAt(code, m.index), "dynamic locale key outside ds.* / difficulty.* / rework.*", m[1]);
    }
  }
  return findings;
}

export function localeFindings(zh, ja) {
  const findings = [];
  const a = new Map([...flatten(zh.ds, "ds."), ...flatten(zh.rework, "rework.")]);
  const b = new Map([...flatten(ja.ds, "ds."), ...flatten(ja.rework, "rework.")]);
  for (const [k, v] of a) {
    if (!b.has(k)) findings.push({ file: "locales/ja.json", line: 0, rule: "ds key missing", detail: k });
    if (typeof v !== "string" || !v.trim()) findings.push({ file: "locales/zh.json", line: 0, rule: "empty ds string", detail: k });
  }
  for (const [k, v] of b) {
    if (!a.has(k)) findings.push({ file: "locales/zh.json", line: 0, rule: "ds key missing", detail: k });
    if (typeof v !== "string" || !v.trim()) findings.push({ file: "locales/ja.json", line: 0, rule: "empty ds string", detail: k });
  }
  return findings;
}

export function run(root = ROOT) {
  const zh = JSON.parse(readFileSync(resolve(root, "locales/zh.json"), "utf8"));
  const ja = JSON.parse(readFileSync(resolve(root, "locales/ja.json"), "utf8"));
  const files = dsFiles(root).filter((f) => /\.(vue|ts|mjs|js)$/.test(f));
  const findings = [...localeFindings(zh, ja), ...files.flatMap((f) => checkFile(f, readFileSync(resolve(root, f), "utf8"), { zh, ja }))];
  return { files, findings, zh, ja };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { files, findings, zh, ja } = run();
  if (process.argv.includes("--list")) {
    const jaMap = new Map([...flatten(ja.ds, "ds."), ...flatten(ja.rework, "rework.")]);
    for (const [k, v] of [...flatten(zh.ds, "ds."), ...flatten(zh.rework, "rework.")]) console.log(`${k.padEnd(28)} ${v}  |  ${jaMap.get(k)}`);
  }
  for (const f of findings) console.log(`FAIL  ${f.file}${f.line ? `:${f.line}` : ""}  ${f.rule}: ${f.detail}`);
  console.log(findings.length ? `\n${findings.length} finding(s)` : `\nds copy OK: ${files.length} files, ${flatten(zh.ds).length} ds keys in both locales`);
  process.exitCode = findings.length ? 1 : 0;
}
