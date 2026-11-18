// Song library scenarios (Stage 1). One synthetic dataset, one set of browser scenarios, used by
//   - scripts/rework/catalog-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - scripts/rework/catalog-check.mjs      (Linux acceptance on production Nitro, via shell-sql.mjs --check=catalog)
// Standalone: node scripts/rework/catalog-scenarios.mjs --base http://127.0.0.1:<port> --out <dir> [--stub] [--chrome <exe>]
//   (expects a server that already serves buildDataset() as its song data file)
// The browser never leaves the base origin: every other request is aborted. With --stub, the browser's
// /api/content/songs requests are answered by serveCatalog(), a port of getSongCatalogPagePayload.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Synthetic dataset ----------
const GENRES = ["南梦宫原创音乐", "流行音乐", "儿童音乐", "古典音乐", "综合音乐", "游戏音乐", "博歌乐音乐", "动漫音乐"];
export const KEYWORD = "Lantern"; // matches in every shelf, more than the panel shows
export const NO_MATCH = "zzqx-none";
export const SHELF_SIZES = { available: 60, removed: 50, other: 30 };
const STATUS = { available: 0, removed: 1, other: 2 };

export function buildDataset() {
  const songs = [];
  let id = 1;
  for (const [shelf, count] of Object.entries(SHELF_SIZES)) {
    for (let i = 0; i < count; i++, id++) {
      const n = id;
      const lantern = i % 5 === 0;
      const status = STATUS[shelf];
      songs.push({
        id: n,
        song_name: `${lantern ? KEYWORD + " " : ""}合成曲目 ${n}${n % 9 === 0 ? " 很长很长的标题用于检查截断 Extended Long Mix Version" : ""}`,
        ...(n % 4 === 3 ? {} : { song_name_jp: `${lantern ? KEYWORD + " " : ""}テスト楽曲 ${n}${n % 9 === 0 ? " とても長いタイトルの省略表示確認用 Extended Long Mix" : ""}` }),
        type: GENRES[n % GENRES.length],
        // mixed encodings of the shelf status, as the real file has them
        shelf_status: status === 0 ? (n % 10 === 0 ? "" : 0) : n % 3 ? status : String(status),
        ...(n % 13 === 0 ? {} : { bpm: String(100 + ((n * 7) % 120)) }),
        ...(n % 17 === 0 ? {} : { open_day: `${((n * 11) % 12) + 1}/${((n * 37) % 28) + 1}/${2018 + ((n * 7) % 8)}` }),
        level_1: n % 11 === 0 ? "-" : 2 + (n % 3),
        level_2: 4 + (n % 3),
        level_3: 6 + (n % 3),
        level_4: 8 + (n % 3),
        ...(n % 3 === 0 ? { level_5: 9 + (n % 2) } : {})
      });
    }
  }
  // File order (= "catalog" order) differs from id order and from release order.
  return songs.map((song, index) => ({ song, key: (index * 37) % songs.length })).sort((a, b) => a.key - b.key).map((x) => x.song);
}

// ---------- Port of server/services/content/songs.ts getSongCatalogPagePayload (stub + expectations) ----------
const categorySearchAliases = {
  南梦宫原创音乐: "ナムコオリジナル", 流行音乐: "ポップス", 儿童音乐: "キッズ", 古典音乐: "クラシック",
  综合音乐: "バラエティ", 游戏音乐: "ゲームミュージック", 博歌乐音乐: "ボーカロイド", 动漫音乐: "アニメ"
};
const parseOpenDay = (input) => {
  if (!input) return 0;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2])).getTime() : 0;
};
const normalizeShelfStatus = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
export function serveCatalog(dataset, params) {
  const get = (k) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  const shelfRaw = get("shelfStatus");
  const shelfStatus = shelfRaw === undefined || shelfRaw === null || shelfRaw === "" ? undefined : Number(shelfRaw);
  const page = Math.max(1, Math.floor(Number(get("page") || 1) || 1));
  const pageSize = Math.min(60, Math.max(12, Math.floor(Number(get("pageSize") || 24) || 24)));
  const keyword = String(get("keyword") || "").trim().toLocaleLowerCase();
  let filtered = dataset.filter((s) => shelfStatus === undefined || !Number.isFinite(shelfStatus) || normalizeShelfStatus(s.shelf_status) === shelfStatus);
  if (keyword) filtered = filtered.filter((s) => [s.song_name, s.song_name_jp, s.type, categorySearchAliases[String(s.type || "")], s.id].some((v) => String(v ?? "").toLocaleLowerCase().includes(keyword)));
  if (get("sort") === "open-day-desc") filtered = [...filtered].sort((a, b) => parseOpenDay(b.open_day) - parseOpenDay(a.open_day) || Number(b.id) - Number(a.id));
  const start = (page - 1) * pageSize;
  return { total: filtered.length, page, pageSize, songs: filtered.slice(start, start + pageSize).map((s) => ({ ...s, id: Number(s.id) })) };
}
const SHELF_STATUS = { available: 0, removed: 1, other: 2 };
/** Expected ids for a library URL query (catalogState semantics, page size 24). */
export function expectedPage(dataset, query) {
  const shelf = ["available", "removed", "other", "all"].includes(query.shelf) ? query.shelf : "available";
  const sort = ["open-day-desc", "catalog"].includes(query.sort) ? query.sort : shelf === "available" ? "open-day-desc" : "catalog";
  const page = /^\d+$/.test(String(query.page || "")) && Number(query.page) > 0 ? Number(query.page) : 1;
  const result = serveCatalog(dataset, { view: "list", page, pageSize: 24, keyword: query.q || "", sort, ...(shelf === "all" ? {} : { shelfStatus: SHELF_STATUS[shelf] }) });
  return { ...result, ids: result.songs.map((s) => s.id), pages: Math.ceil(result.total / 24) };
}

// ---------- Copy (from the locale files, so scenarios follow the real strings) ----------
async function locales(web) {
  const { readFile } = await import("node:fs/promises");
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key.split(".").reduce((o, k) => o?.[k], messages).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));

// ---------- Raw HTTP: legacy redirects ----------
export async function rawHttpChecks(base) {
  const { legacyCatalogHref } = await import("../../utils/rework/catalog.ts");
  const results = [];
  const cases = [];
  for (const prefix of ["", "/ja"])
    for (const path of ["/songs/available", "/songs/removed", "/songs/other", "/songs/v2-constants"])
      for (const slash of ["", "/"])
        for (const search of ["", "?q=%E5%8D%83%E6%9C%AC%E6%A1%9C&list=x&page=2", "?shelf=all&sort=catalog&x=1&x=2"]) cases.push(prefix + path + slash + search);
  for (const url of cases) {
    const response = await fetch(base + url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    const parsed = new URL(base + url);
    const query = {};
    for (const key of new Set(parsed.searchParams.keys())) {
      const all = parsed.searchParams.getAll(key);
      query[key] = all.length > 1 ? all : all[0];
    }
    const expected = legacyCatalogHref(parsed.pathname, query);
    const location = response.headers.get("location");
    await response.arrayBuffer().catch(() => {});
    results.push({ url, status: response.status, location, expected, pass: response.status === 302 && location === expected });
  }
  for (const url of ["/songs/1", "/songs/1?list=removed", "/ja/songs/2?list=other&difficulty=5", "/songs/1/", "/songs/constants", "/ja/songs/constants", "/songs", "/ja/songs", "/songs?shelf=all&q=x"]) {
    const response = await fetch(base + url, { redirect: "manual", signal: AbortSignal.timeout(60000) });
    await response.arrayBuffer().catch(() => {});
    results.push({ url, status: response.status, location: response.headers.get("location"), mustNotRedirect: true, pass: response.status < 300 || response.status >= 400 ? !response.headers.get("location") : false });
  }
  return results;
}

// ---------- Browser helpers ----------
export async function openContext(browser, { base, width, theme = "light", lang = "zh", stub, dataset }) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const blocked = new Set();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      return route.abort();
    }
    if (stub && url.pathname === "/api/content/songs")
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(serveCatalog(dataset, url.searchParams)) });
    return route.continue();
  });
  await context.addInitScript(() => {
    // the Nuxt DevTools badge (dev server only) sits over the mobile centre button
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#nuxt-devtools-container{display:none!important}";
      document.head.append(style);
    });
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const faults = [];
  const warnings = [];
  const apiRequests = [];
  page.on("pageerror", (e) => faults.push("pageerror: " + String(e.message).slice(0, 300)));
  page.on("console", (m) => {
    const text = m.text();
    const origin = (() => { try { return new URL(m.location().url).origin; } catch { return base; } })();
    if (/hydration/i.test(text)) faults.push("hydration: " + text.slice(0, 300));
    else if (m.type() === "error" && !(origin !== base || /Failed to load resource/.test(text))) faults.push("console: " + text.slice(0, 300));
    else if (m.type() === "warning" && /\[Vue warn\]/.test(text)) warnings.push(text.slice(0, 200));
  });
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/content/songs") apiRequests.push(r.url());
  });
  return { context, page, faults, warnings, apiRequests, blocked };
}
const rowIds = (page) =>
  page.$$eval(".rows > li .row-link", (links) => links.map((a) => Number(new URL(a.href).pathname.split("/").pop())));
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const mountedRows = (page) => page.evaluate(() => document.querySelectorAll(".rows > li").length);
const waitRows = (page, ids) =>
  page.waitForFunction(
    (expected) => {
      const list = document.querySelector(".rows:not(.is-stale)");
      if (!list) return false;
      const got = [...list.querySelectorAll(".row-link")].map((a) => Number(new URL(a.href).pathname.split("/").pop()));
      return got.length === expected.length && got.every((v, i) => v === expected[i]);
    },
    ids
  );
const libUrl = (base, lang, search = "") => base + (lang === "ja" ? "/ja" : "") + "/songs" + search;
const ssrTitles = (html) => [...html.matchAll(/class="ds-songcell__title"[^>]*>([^<]*)</g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'));

// ---------- Scenarios ----------
export async function runScenarios({ browser, base, out, dataset, stub = false, web, label = "self-check", widths = [360, 390, 820, 1440] }) {
  const copy = await locales(web);
  const results = [];
  const timings = { filterSortMs: [], routeSwitchMs: [], longTaskMaxMs: 0 };
  const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(out, `${label}_${name}.png`), fullPage });
  async function scenario(name, options, body) {
    const started = Date.now();
    const handle = await openContext(browser, { base, stub, dataset, ...options });
    try {
      const detail = (await body(handle)) || {};
      if (options.warmUp) return; // compiles dev routes; not a check
      const longTasks = await handle.page.evaluate(() => window.__longTasks || []).catch(() => []);
      timings.longTaskMaxMs = Math.max(timings.longTaskMaxMs, ...longTasks, 0);
      assert.deepEqual(handle.faults, [], "console / hydration faults");
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, blockedOrigins: [...handle.blocked], ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}`).catch(() => {});
      results.push({ name, ...options, pass: false, ms: Date.now() - started, error: String(error?.message || error).slice(0, 600), faults: handle.faults.slice(0, 10) });
    } finally {
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }
  // warm up dev compilation (does not count)
  await scenario("warm-up", { width: 1440, warmUp: true }, async ({ page }) => {
    await page.goto(libUrl(base, "zh"), { waitUntil: "networkidle", timeout: 180000 });
    await page.goto(base + "/songs/1", { waitUntil: "networkidle", timeout: 180000 });
    await page.goto(base + "/songs/constants", { waitUntil: "domcontentloaded", timeout: 180000 });
  });

  // 1. Widths × themes × languages: SSR = hydrated, layout, controls
  const first = expectedPage(dataset, {});
  const shots = new Set(["zh-1440-light", "zh-1440-dark", "zh-390-light", "zh-390-dark", "zh-820-light", "zh-360-light", "ja-390-light"]);
  for (const lang of ["zh", "ja"])
    for (const theme of ["light", "dark"])
      for (const width of widths)
        await scenario("matrix", { width, theme, lang }, async ({ page, context }) => {
          const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
          const html = await (await fetch(libUrl(base, lang), { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
          const response = await page.goto(libUrl(base, lang), { waitUntil: "networkidle" });
          assert.equal(response.status(), 200);
          await waitRows(page, first.ids);
          const titles = await page.$$eval(".rows .ds-songcell__title", (els) => els.map((e) => e.textContent));
          assert.deepEqual(ssrTitles(html).slice(0, titles.length), titles, "SSR titles = hydrated titles");
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
          assert.ok(await page.locator("html.viewer-rework").count());
          assert.ok(await noOverflow(page), "no horizontal overflow");
          assert.ok((await mountedRows(page)) <= 60);
          const current = await page.$$eval('.lib-filters a[aria-current="page"]', (els) => els.map((e) => e.textContent.trim()));
          assert.deepEqual(current, [msg(copy[lang], "rework.library.shelf.available"), msg(copy[lang], "rework.library.sort.open-day-desc")]);
          assert.equal((await page.textContent(".summary")).trim(), msg(copy[lang], "rework.library.summary", { total: first.total, page: 1, pages: first.pages }));
          assert.ok(await page.locator(`link[rel="canonical"][href$="${lang === "ja" ? "/ja" : ""}/songs"]`).count(), "canonical");
          const key = `${lang}-${width}-${theme}`;
          if (shots.has(key)) await shot(page, `library-${key}`);
          return { rows: titles.length, ssrTitles: ssrTitles(html).length };
        });

  // 2. Paging: links, focus, scroll, last page, beyond the last page, stale-response guard
  await scenario("paging", { width: 1440 }, async ({ page, apiRequests }) => {
    await page.goto(libUrl(base, "zh"), { waitUntil: "networkidle" });
    await page.locator('.pager a[rel="next"]').click();
    const second = expectedPage(dataset, { page: "2" });
    await page.waitForURL(/\/songs\?page=2$/);
    await waitRows(page, second.ids);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "H1", "focus on results heading");
    const top = await page.evaluate(() => document.querySelector(".lib-head h1").getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 200, "results top in view: " + top);
    assert.equal(await page.locator('.pager a[aria-current="page"]').textContent(), "2");
    assert.ok(await page.locator('.pager a[rel="prev"]').count());
    // last page
    const last = expectedPage(dataset, { page: String(first.pages) });
    await page.locator(`.pager a.pg-num:text-is("${first.pages}")`).click();
    await waitRows(page, last.ids);
    assert.equal(await page.locator('.pager a[rel="next"]').count(), 0);
    await shot(page, "last-page-zh-1440-light", true);
    // stale response guard: delay page 1, then ask for page 2; page 2 must win
    let delayed = false;
    await page.route("**/api/content/songs?**", async (route) => {
      if (!delayed && new URL(route.request().url()).searchParams.get("page") === "1") {
        delayed = true;
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue().catch(() => {}); // the library may have aborted it already
    });
    await page.locator('.pager a.pg-num:text-is("1")').click();
    await page.waitForURL(/\/songs$/);
    await page.locator('.pager a.pg-num:text-is("2")').click();
    await page.waitForTimeout(2000);
    await waitRows(page, second.ids);
    await page.unroute("**/api/content/songs?**");
    // beyond the last page
    await page.goto(libUrl(base, "zh", "?page=99"), { waitUntil: "networkidle" });
    await page.locator(".lib-state").waitFor();
    assert.match(await page.textContent(".lib-state p"), new RegExp(String(first.pages)));
    await page.locator(".lib-state a").click();
    await page.waitForURL(/\/songs$/);
    await waitRows(page, first.ids);
    return { apiRequests: apiRequests.length };
  });

  // 3. Shelf and sort: links keep the effective sort, timings, restoring from the address, back/forward
  await scenario("shelf-sort-history", { width: 1440 }, async ({ page }) => {
    await page.goto(libUrl(base, "zh"), { waitUntil: "networkidle" });
    let t0 = Date.now();
    await page.locator(".lib-filters a", { hasText: msg(copy.zh, "rework.library.shelf.removed") }).click();
    await page.waitForURL(/\/songs\?shelf=removed&sort=open-day-desc$/);
    await waitRows(page, expectedPage(dataset, { shelf: "removed", sort: "open-day-desc" }).ids);
    timings.filterSortMs.push(Date.now() - t0);
    t0 = Date.now();
    await page.locator(".lib-filters a", { hasText: msg(copy.zh, "rework.library.sort.catalog") }).click();
    await page.waitForURL(/\/songs\?shelf=removed$/);
    await waitRows(page, expectedPage(dataset, { shelf: "removed" }).ids);
    timings.filterSortMs.push(Date.now() - t0);
    await page.locator('.pager a[rel="next"]').click();
    await page.waitForURL(/\/songs\?shelf=removed&page=2$/);
    const p2 = expectedPage(dataset, { shelf: "removed", page: "2" }).ids;
    await waitRows(page, p2);
    await page.goBack();
    await page.waitForURL(/\/songs\?shelf=removed$/);
    await waitRows(page, expectedPage(dataset, { shelf: "removed" }).ids);
    await page.goForward();
    await page.waitForURL(/\/songs\?shelf=removed&page=2$/);
    await waitRows(page, p2);
    // shared URL / reload
    const shared = { shelf: "other", sort: "open-day-desc", page: "2" };
    await page.goto(libUrl(base, "zh", "?shelf=other&sort=open-day-desc&page=2"), { waitUntil: "networkidle" });
    await waitRows(page, expectedPage(dataset, shared).ids);
    await page.reload({ waitUntil: "networkidle" });
    await waitRows(page, expectedPage(dataset, shared).ids);
    const current = await page.$$eval('.lib-filters a[aria-current="page"]', (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(current, [msg(copy.zh, "rework.library.shelf.other"), msg(copy.zh, "rework.library.sort.open-day-desc")]);
    // invalid values: defaults, URL not rewritten
    await page.goto(libUrl(base, "zh", "?shelf=bogus&sort=x&page=-1"), { waitUntil: "networkidle" });
    await waitRows(page, first.ids);
    assert.ok(page.url().endsWith("?shelf=bogus&sort=x&page=-1"), "no URL rewriting on load");
  });

  // 4. Keyword: debounce + replace, IME, no match, all songs with keyword
  await scenario("keyword", { width: 1440 }, async ({ page }) => {
    await page.goto(libUrl(base, "zh"), { waitUntil: "networkidle" });
    const historyBefore = await page.evaluate(() => history.length);
    const input = page.locator(".lib-search input");
    await input.click();
    await input.pressSequentially(KEYWORD, { delay: 40 });
    await page.waitForURL(new RegExp(`/songs\\?q=${KEYWORD}$`));
    await waitRows(page, expectedPage(dataset, { q: KEYWORD }).ids);
    assert.equal(await page.evaluate(() => history.length), historyBefore, "keyword uses replace");
    // composition: nothing is written while composing
    const urlBefore = page.url();
    await input.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      el.value = "テスト楽曲 1";
      el.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    });
    await page.waitForTimeout(700);
    assert.equal(page.url(), urlBefore, "no write during composition");
    await input.evaluate((el) => el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "テスト楽曲 1" })));
    await page.waitForFunction(() => new URLSearchParams(location.search).get("q") === "テスト楽曲 1");
    // no match
    await page.goto(libUrl(base, "zh", `?q=${NO_MATCH}`), { waitUntil: "networkidle" });
    await page.locator(".lib-state").waitFor();
    assert.equal((await page.textContent(".summary")).trim(), msg(copy.zh, "rework.library.summaryNone"));
    const actions = await page.$$eval(".lib-state a", (els) => els.map((a) => new URL(a.href).pathname + new URL(a.href).search));
    assert.deepEqual(actions, ["/songs", `/songs?q=${NO_MATCH}&shelf=all&sort=open-day-desc`]);
    await shot(page, "no-match-zh-1440-light");
    // all songs with a keyword, shelf state column
    await page.goto(libUrl(base, "zh", `?q=${KEYWORD}&shelf=all`), { waitUntil: "networkidle" });
    const all = expectedPage(dataset, { q: KEYWORD, shelf: "all" });
    await waitRows(page, all.ids);
    assert.equal(await page.locator(".rows > li .c-shelf").count(), all.ids.length);
    await shot(page, "all-with-keyword-zh-1440-light");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await noOverflow(page));
    await shot(page, "all-with-keyword-zh-390-light");
  });

  // 5. Request failure and retry (failure injected by intercepting one browser request)
  await scenario("failure-retry", { width: 1440 }, async ({ page }) => {
    await page.goto(libUrl(base, "zh"), { waitUntil: "networkidle" });
    // Every request fails until the retry button is pressed (the fetch client itself retries a 503 once).
    const seen = [];
    let failing = true;
    await page.route("**/api/content/songs?**", async (route) => {
      seen.push(route.request().url());
      if (failing) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return route.continue();
    });
    await page.locator(".lib-filters a", { hasText: msg(copy.zh, "rework.library.sort.catalog") }).click();
    await page.locator('.lib-state[role="alert"]').waitFor();
    assert.equal((await page.textContent(".summary")).trim(), "", "no stale summary on failure");
    await shot(page, "request-failed-zh-1440-light");
    const failedCount = seen.length;
    failing = false;
    await page.getByRole("button", { name: msg(copy.zh, "rework.library.retry") }).click();
    await waitRows(page, expectedPage(dataset, { sort: "catalog" }).ids);
    assert.ok(seen.length > failedCount);
    assert.equal(new Set(seen).size, 1, "retry repeats the same request");
    await page.unroute("**/api/content/songs?**");
  });

  // 6. Search panel → all results (zh 1440, zh 390)
  for (const width of [1440, 390])
    await scenario("search-all-results", { width }, async ({ page }) => {
      await page.goto(base + "/about", { waitUntil: "networkidle" });
      await (width > 767 ? page.locator(".search-trigger") : page.locator(".don-search")).click();
      await page.locator("dialog[open] input").fill(KEYWORD);
      const all = expectedPage(dataset, { q: KEYWORD, shelf: "all" });
      const label = msg(copy.zh, "rework.viewAll", { count: all.total });
      await page.locator("dialog [role=option]", { hasText: label }).waitFor();
      const options = await page.$$eval("dialog [role=option]", (els) => els.map((e) => e.textContent.trim()));
      assert.ok(options.at(-1).startsWith(label), "all-results is the last option");
      assert.equal(options.filter((o) => o.includes(KEYWORD)).length, 8);
      await shot(page, `search-view-all-zh-${width}-light`);
      await page.keyboard.press("End");
      assert.match(await page.locator('[role=option][aria-selected="true"]').textContent(), new RegExp(String(all.total)));
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowUp");
      assert.match(await page.locator('[role=option][aria-selected="true"]').textContent(), new RegExp(String(all.total)));
      const t0 = Date.now();
      await page.keyboard.press("Enter");
      await page.waitForURL(new RegExp(`/songs\\?q=${KEYWORD}&shelf=all$`));
      await waitRows(page, all.ids);
      timings.routeSwitchMs.push(Date.now() - t0);
      await page.waitForFunction(() => document.activeElement?.id === "viewer-main");
      assert.equal((await page.textContent(".summary")).trim(), msg(copy.zh, "rework.library.summary", { total: all.total, page: 1, pages: all.pages }));
    });

  // 7. List → detail → back: filters, scroll, no refetch; detail's own way back; keepalive ignores other routes
  await scenario("detail-return", { width: 1440 }, async ({ page, apiRequests }) => {
    const query = { shelf: "removed", page: "2" };
    await page.goto(libUrl(base, "zh", "?shelf=removed&page=2"), { waitUntil: "networkidle" });
    const ids = expectedPage(dataset, query).ids;
    await waitRows(page, ids);
    await page.locator(".rows > li").nth(14).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const t0 = Date.now();
    await page.locator(".rows > li .row-link").nth(14).click();
    await page.waitForURL(new RegExp(`/songs/${ids[14]}\\?list=removed$`));
    await page.locator(".rework-bar a.back").first().waitFor();
    timings.routeSwitchMs.push(Date.now() - t0);
    await page.waitForFunction(() => /shelf=removed&page=2$/.test(document.querySelector(".rework-bar a.back")?.getAttribute("href") || ""));
    const requestsBefore = apiRequests.length;
    await page.goBack();
    await page.waitForURL(/\/songs\?shelf=removed&page=2$/);
    await waitRows(page, ids);
    await page.waitForTimeout(400);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    assert.ok(Math.abs(scrollAfter - scrollBefore) <= 60, `scroll restored ${scrollBefore} → ${scrollAfter}`);
    assert.equal(apiRequests.length, requestsBefore, "no refetch on return");
    // another route's query does not reach the kept-alive library
    await page.evaluate(() => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push("/about?shelf=all&page=3&q=x"));
    await page.waitForURL(/\/about\?/);
    await page.goBack();
    await page.waitForURL(/\/songs\?shelf=removed&page=2$/);
    await waitRows(page, ids);
    assert.equal(apiRequests.length, requestsBefore, "deactivated library ignored /about's query");
    // the detail page's own link back, then the mobile back button on the detail page
    await page.locator(".rows > li .row-link").first().click();
    await page.waitForURL(/\/songs\/\d+\?list=removed$/);
    await page.waitForFunction(() => /shelf=removed&page=2$/.test(document.querySelector(".rework-bar a.back")?.getAttribute("href") || ""));
    await page.locator(".rework-bar a.back").first().click();
    await page.waitForURL(/\/songs\?shelf=removed&page=2$/);
    await waitRows(page, ids);
    return { scrollBefore, scrollAfter };
  });

  // 8. Old links in the browser: direct (server 302) and client-side navigation (route middleware)
  await scenario("old-links", { width: 390, lang: "ja" }, async ({ page }) => {
    await page.goto(base + `/ja/songs/removed?q=${KEYWORD}`, { waitUntil: "networkidle" });
    assert.ok(page.url().endsWith(`/ja/songs?shelf=removed&q=${KEYWORD}`), page.url());
    await waitRows(page, expectedPage(dataset, { shelf: "removed", q: KEYWORD }).ids);
    const push = (to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
    await push("/ja/songs/other?page=2");
    await page.waitForURL(/\/ja\/songs\?shelf=other&page=2$/);
    await waitRows(page, expectedPage(dataset, { shelf: "other", page: "2" }).ids);
    await push("/ja/songs/available/");
    await page.waitForURL(/\/ja\/songs\?shelf=available$/);
    await waitRows(page, first.ids);
    await push("/ja/songs/v2-constants?x=1");
    await page.waitForURL(/\/ja\/songs\/constants\?x=1$/);
    await shot(page, "ja-390-light-constants-after-redirect").catch(() => {});
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}

// ---------- SSR when the API fails (real: the data file is made unreadable for the request) ----------
export async function ssrFailureCheck({ browser, base, out, dataset, breakData, restoreData, label = "self-check" }) {
  const copy = await locales(resolve(fileURLToPath(new URL("../..", import.meta.url))));
  await breakData();
  const handle = await openContext(browser, { base, width: 1440 });
  const { page } = handle;
  try {
    const html = await (await fetch(base + "/songs", { signal: AbortSignal.timeout(60000) })).text();
    assert.match(html, /class="[^"]*\blib-state\b[^"]*"[^>]*role="alert"/, "server rendered the error state");
    assert.doesNotMatch(html, /class="row-link"/);
    await page.goto(base + "/songs", { waitUntil: "networkidle" });
    await page.locator('.lib-state[role="alert"]').waitFor();
    assert.deepEqual(handle.faults, [], "hydrates without warnings or errors");
    await shot(page, `ssr-failed-zh-1440-light`);
    await restoreData();
    await page.getByRole("button", { name: msg(copy.zh, "rework.library.retry") }).click();
    await waitRows(page, expectedPage(dataset, {}).ids);
    assert.deepEqual(handle.faults, []);
    return { name: "ssr-api-failure", pass: true };
  } catch (error) {
    await restoreData().catch(() => {});
    await shot(page, "FAILED-ssr-api-failure").catch(() => {});
    return { name: "ssr-api-failure", pass: false, error: String(error?.message || error).slice(0, 600), faults: handle.faults };
  } finally {
    await page.close().catch(() => {});
    await handle.context.close().catch(() => {});
  }
  function shot(p, name) {
    return p.screenshot({ path: resolve(out, `${label}_${name}.png`) });
  }
}

// ---------- Standalone ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);
  const base = arg("base");
  const out = arg("out");
  assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base || ""), "--base=http://127.0.0.1:<port> (loopback only)");
  assert.ok(out, "--out=<dir>");
  await mkdir(out, { recursive: true });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch(arg("chrome") ? { headless: true, executablePath: arg("chrome") } : { headless: true, channel: "chrome" });
  const timer = setTimeout(() => browser.close(), 20 * 60 * 1000);
  try {
    const dataset = buildDataset();
    const http = await rawHttpChecks(base);
    const report = await runScenarios({ browser, base, out, dataset, stub: process.argv.includes("--stub"), web: resolve(fileURLToPath(new URL("../..", import.meta.url))) });
    await writeFile(resolve(out, "catalog-scenarios.json"), JSON.stringify({ http, ...report }, null, 2));
    console.log(JSON.stringify({ http: `${http.filter((x) => x.pass).length}/${http.length}`, scenarios: `${report.passed}/${report.total}` }));
    if (report.passed !== report.total || http.some((x) => !x.pass)) process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    await browser.close();
  }
}
