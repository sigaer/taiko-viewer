// Test harness for design-system components (not a test file itself: tests/ds*.test.* is the pattern).
// Compiles a components/ds/*.vue file with @vue/compiler-sfc for server rendering, rewrites `~/` and bare imports to
// file URLs, loads it under node --experimental-strip-types, and renders it with vue/server-renderer and vue-i18n
// using the real locales/zh.json and ja.json. No DOM: client-only behaviour (load errors, observers, measuring) is
// covered by the pure functions each component exports from its plain <script> block, and by the browser check.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileScript, parse } from "@vue/compiler-sfc";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const resolveBare = (spec) => import.meta.resolve(spec);
const BARE = { vue: resolveBare("vue"), "vue/server-renderer": resolveBare("vue/server-renderer"), "vue-i18n": resolveBare("vue-i18n") };

const tmp = mkdtempSync(join(tmpdir(), "ds-sfc-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

const cache = new Map();

async function rewrite(code) {
  // Sibling components imported for their named exports (./Diff.vue) are compiled first.
  for (const m of code.matchAll(/(["'])\.\/(\w+)\.vue\1/g)) await loadDs(m[2]);
  return code.replace(/(from\s+|import\s+)(["'])([^"']+)\2/g, (m, kw, q, spec) => {
    if (BARE[spec]) return `${kw}${q}${BARE[spec]}${q}`;
    const sibling = /^\.\/(\w+)\.vue$/.exec(spec);
    if (sibling) return `${kw}${q}${pathToFileURL(join(tmp, `${sibling[1]}.ts`)).href}${q}`;
    if (spec.startsWith("~/")) {
      const path = spec.slice(2);
      const withExt = /\.(ts|mjs|js|json)$/.test(path) ? path : `${path}.ts`;
      return `${kw}${q}${new URL(withExt, root).href}${q}`;
    }
    return m;
  });
}

/** Compile and import components/ds/<name>.vue; returns the module (default = component, plus named exports). */
export async function loadDs(name) {
  if (cache.has(name)) return cache.get(name);
  const file = join(rootPath, "components", "ds", `${name}.vue`);
  const source = readFileSync(file, "utf8");
  const { descriptor, errors } = parse(source, { filename: file });
  if (errors.length) throw errors[0];
  const id = `ds-${name.toLowerCase()}`;
  const script = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    isProd: true,
    templateOptions: { ssr: true, compilerOptions: { scopeId: descriptor.styles.some((s) => s.scoped) ? `data-v-${id}` : undefined } }
  });
  const out = join(tmp, `${name}.ts`);
  writeFileSync(out, await rewrite(script.content));
  const mod = await import(pathToFileURL(out).href);
  cache.set(name, mod);
  return mod;
}

const messages = {
  zh: JSON.parse(readFileSync(new URL("locales/zh.json", root), "utf8")),
  ja: JSON.parse(readFileSync(new URL("locales/ja.json", root), "utf8"))
};

/** Server-render a ds component with props in a locale. `components` registers children by tag name (DsCover …). */
export async function render(name, props = {}, { locale = "zh", components = {} } = {}) {
  const { createSSRApp, h } = await import(BARE.vue);
  const { renderToString } = await import(BARE["vue/server-renderer"]);
  const { createI18n } = await import(BARE["vue-i18n"]);
  const mod = await loadDs(name);
  const app = createSSRApp({ render: () => h(mod.default, props) });
  app.use(createI18n({ legacy: false, locale, fallbackLocale: "zh", messages, missingWarn: false, fallbackWarn: false }));
  for (const [tag, child] of Object.entries(components)) app.component(tag, (await loadDs(child)).default);
  let warned = "";
  app.config.warnHandler = (msg) => {
    warned += `${msg}\n`;
  };
  const html = await renderToString(app);
  if (warned) throw new Error(`Vue warning while rendering ${name}: ${warned}`);
  return html;
}

/** Attribute values of every element matching a tag (cheap HTML probe for assertions). */
export function attrs(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ""]))
  );
}

/** Visible text with tags removed and whitespace collapsed. */
export const text = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export const t = (locale, key) => key.split(".").reduce((o, k) => o?.[k], messages[locale]);
