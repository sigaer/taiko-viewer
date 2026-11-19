// Minimal CSS custom-property cascade for the design-system scripts.
//
// It understands just enough selector syntax for token files: an optional root compound
// (`html`, `:root`, `.class`, `[attr='v']`, `:not([attr='v'])`, `:lang(x)`) optionally followed by
// one descendant compound made of classes (for `.stage`). Blocks it cannot parse are reported, not guessed.
// Only custom properties (`--*`) are read. No dependencies; used by check-tokens, contrast-check,
// token-mapping and the collision check.

export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Top-level blocks; one level of `@media` is expanded with the media query attached. */
export function parseBlocks(css) {
  const src = stripComments(css);
  const out = [];
  const scan = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const selector = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (selector.startsWith("@media")) scan(body, selector.replace(/^@media\s*/, "").trim());
      else if (!selector.startsWith("@")) out.push({ selector, body, media: media || null });
      else out.push({ selector, body, media: media || null, atRule: true });
      i = j;
    }
  };
  scan(src, null);
  return out;
}

/** Split on a separator outside parentheses. */
export function splitTop(s, sep = ",") {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === sep && !depth && !quote) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** All declarations of a block, in order: [{ prop, value }]. */
export function declarations(body) {
  return splitTop(body, ";")
    .map((part) => {
      const k = part.indexOf(":");
      if (k < 0) return null;
      return { prop: part.slice(0, k).trim(), value: part.slice(k + 1).trim().replace(/\s+/g, " ") };
    })
    .filter(Boolean);
}
export const customDeclarations = (body) => declarations(body).filter((d) => d.prop.startsWith("--"));

const ATTR = /^\[([\w-]+)(?:=(['"]?)([^'"\]]*)\2)?\]/;

function parseCompound(text) {
  const c = { tag: null, root: false, classes: [], attrs: [], notAttrs: [], lang: null };
  let s = text;
  let spec = [0, 0, 0];
  while (s.length) {
    let m;
    if ((m = s.match(/^html/))) {
      c.tag = "html";
      spec[2]++;
    } else if ((m = s.match(/^:root/))) {
      c.root = true;
      spec[1]++;
    } else if ((m = s.match(/^\.([\w-]+)/))) {
      c.classes.push(m[1]);
      spec[1]++;
    } else if ((m = s.match(ATTR))) {
      c.attrs.push({ name: m[1], value: m[3] ?? null });
      spec[1]++;
    } else if ((m = s.match(/^:not\((\[[^\]]+\])\)/))) {
      const a = m[1].match(ATTR);
      if (!a || a[0] !== m[1]) return null; // [attr*=…] and friends are outside the supported subset
      c.notAttrs.push({ name: a[1], value: a[3] ?? null });
      spec[1]++;
    } else if ((m = s.match(/^:lang\(([\w-]+)\)/))) {
      c.lang = m[1];
      spec[1]++;
    } else return null;
    s = s.slice(m[0].length);
  }
  return { compound: c, spec };
}

/**
 * Parse one selector of a selector list. Returns { root, stage, spec } or null when the
 * selector is outside the supported subset. `root` is the compound that must match <html>
 * (null when the selector only names a descendant), `stage` is the descendant compound or null.
 */
export function parseSelector(sel) {
  const parts = sel.trim().split(/\s+/);
  if (parts.length > 2) return null;
  const parsed = parts.map(parseCompound);
  if (parsed.some((p) => !p)) return null;
  const spec = parsed.reduce((a, p) => [a[0] + p.spec[0], a[1] + p.spec[1], a[2] + p.spec[2]], [0, 0, 0]);
  if (parts.length === 2) return { root: parsed[0].compound, stage: parsed[1].compound, spec };
  const only = parsed[0].compound;
  const looksRoot = only.root || only.tag === "html" || (only.lang && !only.classes.length);
  return looksRoot ? { root: only, stage: null, spec } : { root: null, stage: only, spec };
}

/** ctx: { classes: [], attrs: { 'data-theme': 'dark', ... }, lang: 'zh' | 'ja', media: (query) => boolean } */
export function matchRoot(compound, ctx) {
  if (!compound) return true;
  if (compound.lang && compound.lang !== ctx.lang) return false;
  for (const cls of compound.classes) if (!(ctx.classes || []).includes(cls)) return false;
  for (const a of compound.attrs) {
    const v = (ctx.attrs || {})[a.name];
    if (v == null || (a.value != null && v !== a.value)) return false;
  }
  for (const a of compound.notAttrs) {
    const v = (ctx.attrs || {})[a.name];
    if (v != null && (a.value == null || v === a.value)) return false;
  }
  return true;
}
const matchStage = (compound) => compound.classes.length === 1 && compound.classes[0] === "stage" && !compound.attrs.length && !compound.root && !compound.tag;

const cmpSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Cascade custom properties for the root element and for a `.stage` element under it.
 * files: [{ name, css }] in load order. Returns { root, stage, unparsed } where root/stage are
 * Map(name -> { value, selector, file }) of the winning declared (unresolved) values.
 */
export function cascade(files, ctx) {
  const winners = { root: new Map(), stage: new Map() };
  const unparsed = [];
  let order = 0;
  for (const file of files) {
    for (const block of parseBlocks(file.css)) {
      const decls = customDeclarations(block.body);
      order++;
      if (!decls.length || block.atRule) continue;
      if (block.media && !(ctx.media ? ctx.media(block.media) : false)) continue;
      for (const sel of splitTop(block.selector)) {
        const p = parseSelector(sel);
        if (!p) {
          unparsed.push({ file: file.name, selector: sel });
          continue;
        }
        let target = null;
        if (p.stage) {
          if (matchStage(p.stage) && matchRoot(p.root, ctx)) target = "stage";
        } else if (matchRoot(p.root, ctx) && (p.root.root || p.root.tag === "html" || p.root.lang)) target = "root";
        if (!target) continue;
        for (const d of decls) {
          const prev = winners[target].get(d.prop);
          if (!prev || cmpSpec(p.spec, prev.spec) > 0 || (cmpSpec(p.spec, prev.spec) === 0 && order >= prev.order)) {
            winners[target].set(d.prop, { value: d.value, selector: sel, file: file.name, spec: p.spec, order });
          }
        }
      }
    }
  }
  return { ...winners, unparsed };
}

/** Substitute var() references. `lookup(name)` returns a resolved string or undefined. */
export function substitute(expr, lookup, depth = 0) {
  if (depth > 40) throw new Error(`var() cycle in ${expr}`);
  let out = "";
  let i = 0;
  while (i < expr.length) {
    const k = expr.indexOf("var(", i);
    if (k < 0) {
      out += expr.slice(i);
      break;
    }
    out += expr.slice(i, k);
    let depthP = 1;
    let j = k + 4;
    while (j < expr.length && depthP) {
      if (expr[j] === "(") depthP++;
      else if (expr[j] === ")") depthP--;
      j++;
    }
    const inner = expr.slice(k + 4, j - 1);
    const [name, ...fb] = splitTop(inner, ",");
    const v = lookup(name.trim());
    if (v != null) out += v;
    else if (fb.length) out += substitute(fb.join(", "), lookup, depth + 1);
    else throw new Error(`undefined token ${name.trim()}`);
    i = j;
  }
  return out;
}

/** Resolve the cascade into computed values for root and stage (custom properties inherit). */
export function computed(files, ctx) {
  const c = cascade(files, ctx);
  const rootCache = new Map();
  const stageCache = new Map();
  const resolveRoot = (name, stack = []) => {
    if (rootCache.has(name)) return rootCache.get(name);
    const w = c.root.get(name);
    if (!w) return undefined;
    if (stack.includes(name)) throw new Error(`cycle ${[...stack, name].join(" -> ")}`);
    const v = norm(substitute(w.value, (n) => resolveRoot(n, [...stack, name])));
    rootCache.set(name, v);
    return v;
  };
  const resolveStage = (name, stack = []) => {
    if (stageCache.has(name)) return stageCache.get(name);
    const w = c.stage.get(name);
    if (!w) return resolveRoot(name);
    if (stack.includes(name)) throw new Error(`cycle ${[...stack, name].join(" -> ")}`);
    const v = norm(substitute(w.value, (n) => resolveStage(n, [...stack, name])));
    stageCache.set(name, v);
    return v;
  };
  const root = {};
  for (const name of c.root.keys()) root[name] = resolveRoot(name);
  const stage = {};
  for (const name of new Set([...c.root.keys(), ...c.stage.keys()])) stage[name] = resolveStage(name);
  return { root, stage, raw: c, unparsed: c.unparsed };
}

/** Normalise a resolved value for comparison: lower-case hex, collapsed whitespace. */
export function norm(v) {
  return String(v)
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .replace(/#[0-9a-f]{3,8}\b/gi, (h) => h.toLowerCase())
    .replace(/"/g, "'")
    .trim();
}

/* ---------------- colour maths (WCAG 2.x) ---------------- */

/** [r, g, b, a] with r/g/b 0–255 and a 0–1. Supports hex, rgb()/rgba(), transparent, color-mix(in srgb, …). */
export function parseColor(input) {
  const c = input.trim();
  if (c === "transparent") return [0, 0, 0, 0];
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  let m = c.match(/^rgba?\((.*)\)$/s);
  if (m) {
    const [rgb, a] = m[1].split("/");
    const p = rgb.trim().split(/[\s,]+/).map(Number);
    return [p[0], p[1], p[2], a != null ? parseFloat(a) : p[3] ?? 1];
  }
  m = c.match(/^color-mix\(in srgb,(.*)\)$/s);
  if (m) {
    const [A, B] = splitTop(m[1]);
    const pa = A.match(/^(.*?)\s+([\d.]+)%$/);
    const pb = B.match(/^(.*?)\s+([\d.]+)%$/);
    let wa = pa ? +pa[2] / 100 : null;
    let wb = pb ? +pb[2] / 100 : null;
    if (wa == null && wb == null) wa = wb = 0.5;
    else if (wa == null) wa = 1 - wb;
    else if (wb == null) wb = 1 - wa;
    const ca = parseColor(pa ? pa[1] : A);
    const cb = parseColor(pb ? pb[1] : B);
    const t = wa + wb;
    wa /= t;
    wb /= t;
    const a = ca[3] * wa + cb[3] * wb;
    if (!a) return [0, 0, 0, 0];
    const ch = (i) => (ca[i] * ca[3] * wa + cb[i] * cb[3] * wb) / a;
    return [ch(0), ch(1), ch(2), a];
  }
  throw new Error(`cannot parse colour: ${c}`);
}
export const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
export function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export const toHex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
