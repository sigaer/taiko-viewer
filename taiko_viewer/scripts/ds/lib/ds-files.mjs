// Files that make up the new design-system code (the scope of check-ds-usage and check-ds-copy).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const DS_DIRS = ["components/ds", "ds-samples", "assets/css/ds", "utils/ds"];
const EXT = /\.(vue|css|ts|mjs|js)$/;

const posix = (p) => p.split(sep).join("/");

export function dsFiles(root) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (EXT.test(name)) out.push(posix(relative(root, full)));
    }
  };
  for (const d of DS_DIRS) walk(join(root, d));
  return out.sort();
}

/** 1-based line of an index in a string. */
export const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/** Remove /* *\/ and // comments, keeping line breaks so line numbers stay valid. */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

/** CJK ideographs, kana and full-width punctuation used in copy. */
export const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿！-｠]/u;
