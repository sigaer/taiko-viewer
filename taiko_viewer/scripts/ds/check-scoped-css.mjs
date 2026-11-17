#!/usr/bin/env node
// P0-28: find the scoped-CSS mistake `:global(<root selector>) .x { … }` (C9, 12 B12.13, RK-56).
//
// Vue's scoped-CSS compiler keeps only the inside of :global(...) and drops everything after it, so the rule lands
// on the root element instead of `.x`. This script compiles every <style scoped> block with the installed
// @vue/compiler-sfc and, for each source selector that has text after a :global(...), checks whether that text
// survives compilation. Dropped text is reported.
//
//   node scripts/ds/check-scoped-css.mjs            design-system dirs fail the run; the rest of the repo is a report
//   node scripts/ds/check-scoped-css.mjs --json
// Design-system dirs (must be clean): components/ds/, ds-samples/, and anything listed in STRICT_DIRS.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compileStyle, parse } from "@vue/compiler-sfc";
import postcss from "postcss";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
export const STRICT_DIRS = ["components/ds", "ds-samples"];
const SKIP_DIRS = new Set(["node_modules", ".nuxt", ".output", ".tja-runtime", "vendor", "reference"]);

const posix = (p) => p.split(sep).join("/");

/** Text after the first top-level :global(...) in a selector, or null when there is none. */
export function textAfterGlobal(selector) {
  const i = selector.indexOf(":global(");
  if (i < 0) return null;
  let depth = 0;
  for (let j = i + ":global".length; j < selector.length; j++) {
    if (selector[j] === "(") depth++;
    else if (selector[j] === ")" && --depth === 0) {
      const rest = selector.slice(j + 1).trim();
      return rest || null;
    }
  }
  return null;
}

/** Last simple class / type / attribute in a compound, used to recognise the selector after compilation. */
const tailToken = (text) => {
  const parts = text.trim().split(/[\s>+~]+/).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return last.replace(/::?[\w-]+(\(.*\))?$/, "") || last;
};

/**
 * Check one CSS source as a scoped style. Returns findings: { line, selector, compiled, dropped }.
 * `dropped` is true when the text after :global(...) does not appear in the compiled selector.
 */
export function checkScopedCss(source, filename = "inline.vue") {
  const findings = [];
  let root;
  try {
    root = postcss.parse(source);
  } catch (error) {
    return [{ line: 0, selector: "", compiled: "", dropped: false, error: String(error.message || error) }];
  }
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes/i.test(rule.parent.name)) return;
    for (const selector of rule.selectors) {
      const rest = textAfterGlobal(selector);
      if (!rest) continue;
      const probe = `${selector}{--probe:1}`;
      const out = compileStyle({ source: probe, filename, id: "data-v-0000", scoped: true });
      const compiled = (out.code.match(/^([^{]+)\{/) || [, ""])[1].trim();
      const token = tailToken(rest);
      findings.push({ line: rule.source?.start?.line ?? 0, selector, compiled, dropped: !compiled.includes(token) });
    }
  });
  return findings;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".vue") ? [full] : [];
  });
}

export function scan(root = ROOT) {
  const results = [];
  for (const file of walk(root)) {
    const rel = posix(relative(root, file));
    const { descriptor } = parse(readFileSync(file, "utf8"), { filename: file });
    for (const style of descriptor.styles) {
      if (!style.scoped) continue;
      const offset = style.loc.start.line - 1;
      for (const f of checkScopedCss(style.content, file)) {
        results.push({ file: rel, ...f, line: f.line + offset, strict: STRICT_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)) });
      }
    }
  }
  return results;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const results = scan();
  const dropped = results.filter((r) => r.dropped || r.error);
  if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 1));
  else {
    console.log(`scoped :global(...) selectors with trailing text: ${results.length} checked`);
    for (const r of dropped) console.log(`${r.strict ? "FAIL" : "REPORT"}  ${r.file}:${r.line}  ${r.error || `${r.selector}  →  ${r.compiled}`}`);
    const ok = results.filter((r) => !r.dropped && !r.error).length;
    console.log(`kept: ${ok}; dropped: ${dropped.length} (design-system dirs: ${dropped.filter((r) => r.strict).length}, rest of repo, report only: ${dropped.filter((r) => !r.strict).length})`);
  }
  process.exitCode = dropped.some((r) => r.strict) ? 1 : 0;
}
