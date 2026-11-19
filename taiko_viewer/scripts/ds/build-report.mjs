#!/usr/bin/env node
// Build-output report for the Viewer design-system stage 0 (P0-33 / P0-35).
//
//   node scripts/ds/build-report.mjs [--root <taiko_viewer dir>] [--out report.json]
//       Reads an existing build (.output/ and .nuxt/dist/) and prints / writes a JSON report.
//   node scripts/ds/build-report.mjs --compare <base.json> <current.json> [--expect-samples]
//       Compares two reports and exits 1 on any difference that stage 0 must not cause.
//
// Read-only. It never builds, never starts a server, and never touches the network or a database.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

/** Only sample implementation is excluded. Stage 1–5 ship DS components, tokens and fonts in production. */
export const SAMPLE_MARKERS = ["ds-samples/"];
export const SAMPLE_ROUTE_PREFIX = "/_ds";

const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
};
const posix = (p) => p.split(sep).join("/");
const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex");

/** Hash-free key for a client-manifest entry: source paths stay as they are, shared chunks lose their hash. */
export const normalizeManifestKey = (key) =>
  key.startsWith("_")
    ? key.replace(/[.-][\w-]{8}(?=\.(?:js|css|mjs)$)/, "")
    : key.replace(/^(?:\.\.\/)+.*?(?=node_modules\/)/, ""); // node_modules reached through a junction from another tree

/** The client manifest is .json in older Nuxt builds and an ES module (client.manifest.mjs) in Nuxt 3.21. */
async function loadClientManifest(root) {
  const dir = join(root, ".nuxt", "dist", "server");
  const json = join(dir, "client.manifest.json");
  if (existsSync(json)) return { path: json, manifest: JSON.parse(readFileSync(json, "utf8")) };
  const mjs = join(dir, "client.manifest.mjs");
  if (existsSync(mjs)) return { path: mjs, manifest: (await import(pathToFileURL(mjs).href + `?t=${Date.now()}`)).default };
  return null;
}

/** Source .vue files under pages/: the input of nuxt.config's viewerPageRoutePatterns (scripts/viewer-page-routes.ts). */
export function pageFiles(root) {
  const pages = join(root, "pages");
  return walk(pages)
    .filter((f) => f.endsWith(".vue"))
    .map((f) => posix(relative(pages, f)))
    .sort();
}

export async function buildReport(root) {
  const output = join(root, ".output");
  const publicDir = join(output, "public");
  const nuxtDir = join(publicDir, "_nuxt");
  const loaded = await loadClientManifest(root);
  if (!existsSync(publicDir) || !loaded) {
    throw new Error(`no build output under ${root} (.output/public and .nuxt/dist/server/client.manifest.{json,mjs} are required)`);
  }
  const manifestPath = loaded.path;

  // 1. _nuxt files and bytes
  const nuxtFiles = walk(nuxtDir)
    .map((file) => ({ file: posix(relative(publicDir, file)), bytes: statSync(file).size }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const byExt = {};
  for (const f of nuxtFiles) {
    const ext = f.file.split(".").pop();
    byExt[ext] = byExt[ext] || { count: 0, bytes: 0 };
    byExt[ext].count += 1;
    byExt[ext].bytes += f.bytes;
  }
  const fileBytes = Object.fromEntries(nuxtFiles.map((f) => [f.file, f.bytes]));

  // 2. Client manifest: entry CSS and per-route JS/CSS dependency lists
  const manifest = loaded.manifest;
  const collect = (key, seen = new Set()) => {
    if (!key || seen.has(key) || !manifest[key]) return seen;
    seen.add(key);
    for (const dep of manifest[key].imports || []) collect(dep, seen);
    return seen;
  };
  const filesOf = (keys) => {
    const js = [];
    const css = [];
    for (const key of keys) {
      const entry = manifest[key];
      if (entry?.file?.endsWith(".js")) js.push(entry.file);
      for (const c of entry?.css || []) css.push(c);
    }
    return { js: [...new Set(js)], css: [...new Set(css)] };
  };
  // Manifest `file` values are relative to _nuxt/ in Nuxt 3.21 ("abc123.js"); older builds include the prefix.
  const bytesOf = (files) =>
    files.reduce((sum, f) => {
      const key = f.replace(/^\//, "");
      return sum + (fileBytes[key] ?? fileBytes[`_nuxt/${key}`] ?? 0);
    }, 0);
  const entryKeys = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  const entries = entryKeys.map((key) => {
    const files = filesOf(collect(key));
    return { key, js: files.js.length, jsBytes: bytesOf(files.js), css: files.css, cssBytes: bytesOf(files.css) };
  });
  // Global CSS (nuxt.config `css`) is emitted as a standalone manifest key `entry.<hash>.css` in Nuxt 3.21
  for (const key of Object.keys(manifest).filter((k) => /^entry\.[\w-]+\.css$/.test(k))) {
    const file = manifest[key].file || key;
    entries.push({ key: "entry.css", js: 0, jsBytes: 0, css: [file], cssBytes: bytesOf([file]) });
  }
  const routeKeys = Object.keys(manifest)
    .filter((key) => /(^|\/)(pages|ds-samples|layouts)\/.*\.vue$/.test(key))
    .sort();
  const routes = Object.fromEntries(
    routeKeys.map((key) => {
      const keys = [...collect(key)];
      const files = filesOf(keys);
      return [
        key,
        {
          // Shared chunks are keyed by hash only in Nuxt 3.21 (`_B5AJGb_D.js`); compare them by their chunk name
          deps: keys.map((k) => (/^_[\w-]{8}\.(js|mjs)$/.test(k) && manifest[k].name ? `_${manifest[k].name}` : normalizeManifestKey(k))).sort(),
          js: files.js.length,
          jsBytes: bytesOf(files.js),
          css: files.css.length,
          cssBytes: bytesOf(files.css)
        }
      ];
    })
  );
  const manifestSampleKeys = Object.keys(manifest).filter((key) => SAMPLE_MARKERS.some((m) => key.includes(m)));

  // 3. Service-worker precache entries
  const swPath = join(publicDir, "sw.js");
  let precache = null;
  if (existsSync(swPath)) {
    const sw = readFileSync(swPath, "utf8");
    const urls = [...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    precache = { count: urls.length, urls: [...new Set(urls)].sort() };
  }

  // 4. Web manifest and theme-color
  const webManifestPath = join(publicDir, "manifest.webmanifest");
  const webManifest = existsSync(webManifestPath) ? JSON.parse(readFileSync(webManifestPath, "utf8")) : null;
  // Server-side bundles: the Nitro output when it exists, plus Vite's SSR bundle (holds the vue-router records)
  const serverFiles = [
    ...walk(join(output, "server")).filter((f) => /\.(mjs|js|json)$/.test(f) && !posix(f).includes("/node_modules/")),
    ...walk(join(root, ".nuxt", "dist", "server")).filter((f) => /\.mjs$/.test(f) && !/client\.(manifest|precomputed)\.mjs$/.test(f))
  ];
  const themeColors = new Set();
  let routePatterns = null;
  const serverRoutes = new Set();
  const serverSampleHits = [];
  for (const file of serverFiles) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/name:\s*"theme-color",\s*content:\s*"([^"]+)"/g)) themeColors.add(m[1]);
    for (const m of text.matchAll(/"name":"theme-color","content":"([^"]+)"/g)) themeColors.add(m[1]);
    const rp = text.match(/"viewerPageRoutePatterns":(\[[^\]]*\])/);
    if (rp && !routePatterns) routePatterns = JSON.parse(rp[1]);
    // 5. Registered routes: vue-router records in the server bundle
    for (const m of text.matchAll(/name:\s*"([^"]+)",\s*path:\s*"([^"]+)"/g)) serverRoutes.add(`${m[2]}  (${m[1]})`);
    for (const marker of [...SAMPLE_MARKERS, '"/_ds', "/_ds/"]) {
      if (text.includes(marker)) serverSampleHits.push(`${posix(relative(root, file))}: ${marker}`);
    }
  }

  // theme-color as rendered into prerendered HTML
  for (const html of walk(publicDir).filter((f) => f.endsWith(".html"))) {
    const text = readFileSync(html, "utf8");
    for (const m of text.matchAll(/<meta name="theme-color" content="([^"]+)"/g)) themeColors.add(m[1]);
  }

  // 6. Font files anywhere in the public output
  const fonts = walk(publicDir)
    .filter((f) => /\.(woff2?|ttf|otf)$/i.test(f))
    .map((f) => ({ file: posix(relative(publicDir, f)), bytes: statSync(f).size }))
    .sort((a, b) => a.file.localeCompare(b.file));

  // 7. Locale chunks (the ds key adds bytes here)
  const localeKeys = Object.keys(manifest).filter((key) => /locales\/(zh|ja)\.(json|ts)/.test(key));
  const locales = Object.fromEntries(localeKeys.map((key) => [key, { file: manifest[key].file, bytes: bytesOf([manifest[key].file]) }]));

  // 8. Public assets outside _nuxt (small icons land here)
  const publicAssets = walk(publicDir)
    .filter((f) => !posix(f).includes("/_nuxt/"))
    .map((f) => posix(relative(publicDir, f)));
  const publicDsIcons = publicAssets.filter((f) => /^icons\/(rank\/(56|80)|crown\/(36|60|96))\//.test(f));

  return {
    generatedAt: new Date().toISOString(),
    root: posix(root),
    nuxt: { totalFiles: nuxtFiles.length, totalBytes: nuxtFiles.reduce((s, f) => s + f.bytes, 0), byExt, files: nuxtFiles },
    entries,
    routes,
    manifestSampleKeys,
    precache,
    webManifest,
    webManifestMd5: existsSync(webManifestPath) ? md5(webManifestPath) : null,
    themeColors: [...themeColors].sort(),
    viewerPageRoutePatterns: routePatterns,
    pageFiles: pageFiles(root),
    nitroServerBuilt: existsSync(join(output, "server", "index.mjs")),
    manifestPath: posix(relative(root, manifestPath)),
    serverRoutes: [...serverRoutes].sort(),
    serverSampleHits,
    fonts,
    locales,
    publicFileCount: publicAssets.length,
    publicDsIcons
  };
}

/** Precache URL without its content hash, so a renamed copy of the same file compares equal. */
export const normalizePrecacheUrl = (url) =>
  url.replace(/^_nuxt\/[\w-]+\.(js|css)$/, "_nuxt/<hash>.$1").replace(/^_nuxt\/builds\/meta\/[\w-]+\.json$/, "_nuxt/builds/meta/<build-id>.json");

export function compareReports(base, cur, { expectSamples = false } = {}) {
  const problems = [];
  const notes = [];
  const sampleRoutes = cur.serverRoutes.filter((r) => r.startsWith(SAMPLE_ROUTE_PREFIX) || r.startsWith(`/ja${SAMPLE_ROUTE_PREFIX}`));
  if (expectSamples) {
    if (!sampleRoutes.length) problems.push("expected sample routes (/_ds) in this build, found none");
    else notes.push(`sample routes present: ${sampleRoutes.join(", ")}`);
  } else {
    if (sampleRoutes.length) problems.push(`sample routes in a normal build: ${sampleRoutes.join(", ")}`);
    if (cur.manifestSampleKeys.length) problems.push(`sample code in client manifest: ${cur.manifestSampleKeys.join(", ")}`);
    if (cur.serverSampleHits.length) problems.push(`sample markers in server bundle: ${cur.serverSampleHits.join(", ")}`);
  }

  // Routes: same set of existing route entries, same dependency lists, same CSS bytes
  const baseKeys = Object.keys(base.routes);
  const curKeys = Object.keys(cur.routes).filter((k) => !SAMPLE_MARKERS.some((m) => k.includes(m)));
  const missing = baseKeys.filter((k) => !cur.routes[k]);
  const added = curKeys.filter((k) => !base.routes[k]);
  if (missing.length) problems.push(`route entries missing: ${missing.join(", ")}`);
  if (added.length) problems.push(`route entries added: ${added.join(", ")}`);
  for (const key of baseKeys) {
    const a = base.routes[key];
    const b = cur.routes[key];
    if (!b) continue;
    const depsA = a.deps.join("\n");
    const depsB = b.deps.filter((d) => !SAMPLE_MARKERS.some((m) => d.includes(m))).join("\n");
    if (depsA !== depsB) {
      const onlyA = a.deps.filter((d) => !b.deps.includes(d));
      const onlyB = b.deps.filter((d) => !a.deps.includes(d));
      problems.push(`dependency list changed for ${key}: -[${onlyA.join(", ")}] +[${onlyB.join(", ")}]`);
    }
    if (a.cssBytes !== b.cssBytes || a.css !== b.css) problems.push(`CSS changed for ${key}: ${a.css} files/${a.cssBytes} B → ${b.css} files/${b.cssBytes} B`);
    if (a.jsBytes !== b.jsBytes) notes.push(`JS bytes for ${key}: ${a.jsBytes} → ${b.jsBytes} (${b.jsBytes - a.jsBytes >= 0 ? "+" : ""}${b.jsBytes - a.jsBytes})`);
  }

  // Entry CSS bytes unchanged
  const entryCss = (r) => r.entries.reduce((s, e) => s + e.cssBytes, 0);
  if (entryCss(base) !== entryCss(cur)) problems.push(`entry CSS bytes changed: ${entryCss(base)} → ${entryCss(cur)}`);
  else notes.push(`entry CSS bytes unchanged: ${entryCss(cur)}`);

  // Precache: same normalized URL multiset (hash renames allowed)
  if (base.precache && cur.precache) {
    const count = (list) => list.map(normalizePrecacheUrl).reduce((m, u) => m.set(u, (m.get(u) || 0) + 1), new Map());
    const a = count(base.precache.urls);
    const b = count(cur.precache.urls);
    const diff = [];
    for (const u of new Set([...a.keys(), ...b.keys()])) if ((a.get(u) || 0) !== (b.get(u) || 0)) diff.push(`${u}: ${a.get(u) || 0} → ${b.get(u) || 0}`);
    if (!expectSamples && diff.length) problems.push(`precache entries differ beyond hash renames: ${diff.join("; ")}`);
    else if (diff.length) notes.push(`precache differs (expected in a samples build): ${diff.join("; ")}`);
    else notes.push(`precache: ${cur.precache.urls.length} entries, identical up to hash renames`);
    const fontLike = cur.precache.urls.filter((u) => /\.(woff2?|ttf|otf)$/i.test(u));
    if (!expectSamples && fontLike.length) problems.push(`font files in precache: ${fontLike.join(", ")}`);
  } else if (base.precache || cur.precache) problems.push("service worker present in only one build");

  if (JSON.stringify(base.webManifest) !== JSON.stringify(cur.webManifest)) problems.push("web manifest content changed");
  else notes.push(`web manifest identical (theme_color ${cur.webManifest?.theme_color})`);
  if (JSON.stringify(base.themeColors) !== JSON.stringify(cur.themeColors)) problems.push(`theme-color changed: ${base.themeColors} → ${cur.themeColors}`);
  if (JSON.stringify(base.viewerPageRoutePatterns) !== JSON.stringify(cur.viewerPageRoutePatterns)) problems.push("viewerPageRoutePatterns changed");
  else if (cur.viewerPageRoutePatterns) notes.push(`viewerPageRoutePatterns identical (${cur.viewerPageRoutePatterns.length} patterns)`);
  else notes.push("viewerPageRoutePatterns not readable (no Nitro server output); compared via pages/ file list instead");
  if (JSON.stringify(base.pageFiles) !== JSON.stringify(cur.pageFiles)) problems.push("pages/ file list changed (input of viewerPageRoutePatterns)");
  else notes.push(`pages/ file list identical (${cur.pageFiles.length} files) → viewerPageRoutePatterns input unchanged`);
  if (!cur.nitroServerBuilt || !base.nitroServerBuilt) notes.push(`Nitro server output present: base ${base.nitroServerBuilt}, current ${cur.nitroServerBuilt}`);

  const fontNames = (r) => r.fonts.map((f) => f.file.replace(/\.[\w-]{8}(?=\.)/, "")).sort().join("\n");
  if (!expectSamples && fontNames(base) !== fontNames(cur)) problems.push(`font files changed: ${fontNames(base)} → ${fontNames(cur)}`);

  const routesA = base.serverRoutes.join("\n");
  const routesB = cur.serverRoutes.filter((r) => !r.includes(SAMPLE_ROUTE_PREFIX)).join("\n");
  if (routesA !== routesB) problems.push("registered (non-sample) route records differ");
  else notes.push(`registered routes identical apart from samples (${base.serverRoutes.length})`);

  notes.push(`_nuxt total: ${base.nuxt.totalFiles} files/${base.nuxt.totalBytes} B → ${cur.nuxt.totalFiles} files/${cur.nuxt.totalBytes} B (${cur.nuxt.totalBytes - base.nuxt.totalBytes >= 0 ? "+" : ""}${cur.nuxt.totalBytes - base.nuxt.totalBytes})`);
  for (const [key, value] of Object.entries(cur.locales)) {
    const before = base.locales[key];
    notes.push(`locale ${key}: ${before?.bytes ?? "?"} → ${value.bytes} B`);
  }
  notes.push(`public files: ${base.publicFileCount} → ${cur.publicFileCount}; small icons in output: ${cur.publicDsIcons.length}`);
  return { ok: problems.length === 0, problems, notes };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (args.includes("--compare")) {
    const i = args.indexOf("--compare");
    const base = JSON.parse(readFileSync(args[i + 1], "utf8"));
    const cur = JSON.parse(readFileSync(args[i + 2], "utf8"));
    const result = compareReports(base, cur, { expectSamples: args.includes("--expect-samples") });
    for (const n of result.notes) console.log(`note  ${n}`);
    for (const p of result.problems) console.log(`FAIL  ${p}`);
    console.log(result.ok ? "\nbuild comparison: OK" : `\nbuild comparison: ${result.problems.length} problem(s)`);
    process.exitCode = result.ok ? 0 : 1;
  } else {
    const root = resolve(opt("--root") || process.cwd());
    const report = await buildReport(root);
    const out = opt("--out");
    if (out) writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify(
        {
          nuxtFiles: report.nuxt.totalFiles,
          nuxtBytes: report.nuxt.totalBytes,
          entryCssBytes: report.entries.reduce((s, e) => s + e.cssBytes, 0),
          routeEntries: Object.keys(report.routes).length,
          precacheEntries: report.precache?.count ?? null,
          themeColors: report.themeColors,
          webManifestThemeColor: report.webManifest?.theme_color ?? null,
          serverRoutes: report.serverRoutes.length,
          sampleRoutes: report.serverRoutes.filter((r) => r.includes(SAMPLE_ROUTE_PREFIX)),
          manifestSampleKeys: report.manifestSampleKeys,
          fonts: report.fonts,
          viewerPageRoutePatterns: report.viewerPageRoutePatterns?.length ?? null,
          written: out || null
        },
        null,
        2
      )
    );
  }
}
