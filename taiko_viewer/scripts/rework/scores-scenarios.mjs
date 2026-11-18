// Slice B scenarios: the signed-in player's score pages — /account/songs, /my, /tools/b30, /tools/trend,
// /tools/progress, /tools/recommend — the 成绩 tabs and the Element Plus switch on these pages.
// Environment independent; used by
//   - scripts/rework/scores-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=scores (to be added; see stage-2-progress.md "切片 B")
// Real here: the server render of the signed-out pages (raw HTTP and hydration), the /account/songs sign-in
// redirect, the song catalog read of the score list (synthetic file of detail-data.mjs). Everything that needs the
// database or a signed-in user is answered in the browser from scores-fixtures.ts (typed against the real response
// types) and labelled `intercepted`; images are small synthetic PNGs. The browser never leaves the base origin.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import {
  fixtureBindings,
  fixtureGoalPreview,
  fixtureProgressOptions,
  fixtureRecommendations,
  fixtureScoreRows,
  fixtureTargets,
  fixtureUser,
  serveScores
} from "./scores-fixtures.ts";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key.split(".").reduce((o, k) => o?.[k], messages).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));

export const PAGES = [
  { key: "scores", path: "/account/songs", tab: "/account/songs" },
  { key: "b30", path: "/tools/b30", tab: "/tools/b30" },
  { key: "trend", path: "/tools/trend", tab: "/tools/trend" },
  { key: "progress", path: "/tools/progress", tab: "/tools/progress" },
  { key: "recommend", path: "/tools/recommend", tab: "/tools/recommend" },
  { key: "my", path: "/my", tab: null }
];
const TAB_PATHS = ["/account/songs", "/tools/b30", "/tools/trend", "/tools/progress", "/tools/recommend"];
const PNG = { b30: stripedPng(1400, 900, 1), trend: stripedPng(1200, 700, 2), progress: stripedPng(1600, 1100, 3) };
const BINDING_MESSAGE = "请先绑定鼓众 ID";
const NO_DATA_MESSAGE = "未找到本地成绩数据，请先在「多端同步」更新数据";

// ---------- Browser ----------
/**
 * One context; `state` steers the intercepted account APIs while the scenario runs:
 *   signedIn, binding ("bound" | "unbound" | "empty"), currentBinding (1 synced / 2 manual),
 *   fail: { songs, catalog, image, options, recommend, target } → status code (400 binding, 404 no data, 5xx),
 *   hold: Set of keys whose responses wait for release() (loading states).
 */
export async function openContext(browser, { base, width, theme = "light", lang = "zh", signedIn = true }) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const rows = fixtureScoreRows();
  const state = { signedIn, binding: "bound", currentBinding: 1, fail: {}, hold: new Set(), released: new Map() };
  const blocked = new Set();
  const intercepted = [];
  const calls = [];
  const writes = [];
  const waitHold = (key) => (state.hold.has(key) ? new Promise((r) => state.released.set(key, r)) : null);
  const failWith = (route, status) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ statusCode: status, statusMessage: status === 400 ? BINDING_MESSAGE : status === 404 ? NO_DATA_MESSAGE : "selfcheck failure" })
    });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      return route.abort();
    }
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const png = (body) => route.fulfill({ status: 200, contentType: "image/png", body });
    const hit = async (key) => {
      intercepted.push(p);
      calls.push({ key, method: request.method(), path: p, query: Object.fromEntries(url.searchParams), body: request.method() === "POST" ? request.postDataJSON() : undefined });
      const held = waitHold(key);
      if (held) await held;
    };
    if (p === "/api/account/auth/me") return intercepted.push(p), json({ authenticated: state.signedIn, user: state.signedIn ? fixtureUser : null });
    if (!state.signedIn && p.startsWith("/api/account/")) return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
    if (p === "/api/account/bindings") {
      await hit("bindings");
      return json(state.binding === "unbound" ? { bindings: [], currentBinding: null } : fixtureBindings(state.currentBinding));
    }
    if (p === "/api/account/bindings/current" && request.method() === "POST") {
      await hit("switch");
      state.currentBinding = Number(request.postDataJSON().bindingId);
      writes.push({ path: p, body: request.postDataJSON() });
      return json({ ok: true });
    }
    if (p === "/api/account/songs") {
      await hit("songs");
      if (state.binding === "unbound") return failWith(route, 400);
      if (state.fail.songs) return failWith(route, state.fail.songs);
      const current = fixtureBindings(state.currentBinding).currentBinding;
      return json(serveScores(state.binding === "empty" ? [] : rows, current, url.searchParams));
    }
    if (/^\/api\/account\/songs\/(lock|delete|update|create)$/.test(p) && request.method() === "POST") {
      await hit(p.split("/").pop());
      const body = request.postDataJSON();
      writes.push({ path: p, body });
      if (p.endsWith("/lock")) {
        const row = rows.find((r) => r.songNo === body.songNo && r.level === body.level);
        if (row) row.isLocked = body.locked;
      }
      return json({ ok: true });
    }
    if (p === "/api/content/songs" && state.fail.catalog) return intercepted.push(p), json({ statusCode: 503 }, 503);
    if (p === "/api/account/charts/b30" || p === "/api/account/charts/trend") {
      const key = p.endsWith("b30") ? "b30" : "trend";
      await hit(key);
      if (state.fail.image) return failWith(route, state.fail.image);
      return png(PNG[key]);
    }
    if (p === "/api/account/progress/options") {
      await hit("options");
      if (state.fail.options) return failWith(route, state.fail.options);
      return json(fixtureProgressOptions);
    }
    if (p === "/api/account/progress/image") {
      await hit("progress");
      if (state.fail.image) return failWith(route, state.fail.image);
      return png(PNG.progress);
    }
    if (p === "/api/account/recommendation/tool") {
      await hit("recommend");
      if (state.fail.recommend) return failWith(route, state.fail.recommend);
      return json(fixtureRecommendations(Number(url.searchParams.get("n")) || 20));
    }
    if (p === "/api/account/recommendation/target") {
      await hit("target");
      if (state.fail.target) return failWith(route, state.fail.target);
      return json(fixtureTargets(url.searchParams.get("target") || "goku"));
    }
    if (p === "/api/account/growth/goal/preview" && request.method() === "POST") {
      await hit("preview");
      const token = String(request.postDataJSON().recommendationToken || "");
      const item = fixtureRecommendations(20).items.find((i) => i.recommendationToken === token);
      return json(fixtureGoalPreview(item?.songId ?? 10, item?.level ?? 4));
    }
    if (p === "/api/account/growth/goal" && request.method() === "POST") {
      await hit("goal");
      writes.push({ path: p, body: request.postDataJSON() });
      return json({ profileId: "1" });
    }
    if (p.startsWith("/api/account/") || p.startsWith("/api/forum/")) return intercepted.push(p), json({}, 404);
    return route.continue();
  });
  await context.addInitScript(() => {
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
  page.on("pageerror", (e) => faults.push("pageerror: " + String(e.message).slice(0, 300)));
  page.on("console", (m) => {
    const text = m.text();
    const origin = (() => {
      try {
        return new URL(m.location().url).origin;
      } catch {
        return base;
      }
    })();
    if (/hydration/i.test(text)) faults.push("hydration: " + text.slice(0, 300));
    else if (m.type() === "error" && !(origin !== base || /Failed to load resource/.test(text))) faults.push("console: " + text.slice(0, 300));
    else if (m.type() === "warning" && /\[Vue warn\]/.test(text)) warnings.push(text.slice(0, 200));
  });
  const release = async (key) => {
    while (!state.released.has(key)) await page.waitForTimeout(25);
    state.hold.delete(key);
    state.released.get(key)();
    state.released.delete(key);
  };
  const progress = { at: "" };
  const step = (name) => (progress.at = name);
  return { context, page, faults, warnings, blocked, intercepted, calls, writes, state, rows, release, step, progress };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const htmlClasses = (page) => page.evaluate(() => document.documentElement.className.split(/\s+/));
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const prefix = (lang) => (lang === "ja" ? "/ja" : "");
/** The server rendered a guest; the account state the app holds is set to the fixture user (what a sign-in writes). */
const injectSignedIn = (page) =>
  page.evaluate((user) => {
    const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = user;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, fixtureUser);
/** Open `path` signed in: SSR of /about (guest), the fixture user, then client navigation. */
async function enterSignedIn(page, base, lang, path) {
  await page.goto(`${base}${prefix(lang)}/about`, { waitUntil: "networkidle" });
  await injectSignedIn(page);
  await push(page, `${prefix(lang)}${path}`);
  await page.waitForURL((u) => u.pathname === `${prefix(lang)}${path}`);
}
const rowKeys = (page) => page.$$eval(".sl-table tr.sr", (trs) => trs.map((tr) => tr.dataset.key));
const expectedKeys = (rows, query) => serveScores(rows, fixtureBindings(1).currentBinding, new URLSearchParams(query)).items.map((r) => `${r.songNo}:${r.level}`);
const waitRows = (page, keys) =>
  page.waitForFunction((expected) => {
    const got = [...document.querySelectorAll(".sl-table tr.sr")].map((tr) => tr.dataset.key);
    return got.length === expected.length && got.every((v, i) => v === expected[i]);
  }, keys, { timeout: 30000 });
const waitImage = (page) => page.waitForFunction(() => { const img = document.querySelector(".ir-img"); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 30000 });
const lastCall = (calls, key) => [...calls].reverse().find((c) => c.key === key);

// ---------- Scenarios ----------
export async function runScoresScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
  const results = [];
  const timings = { filterMs: [], routeSwitchMs: [], longTaskMaxMs: 0 };
  const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(out, `${label}_${name}.png`), fullPage });
  async function scenario(name, options, body) {
    if (only && !options.warmUp && !only.split(",").some((p) => name.startsWith(p))) return;
    const started = Date.now();
    const handle = await openContext(browser, { base, ...options });
    try {
      const detail = (await body(handle)) || {};
      if (options.warmUp) return;
      const longTasks = await handle.page.evaluate(() => window.__longTasks || []).catch(() => []);
      timings.longTaskMaxMs = Math.max(timings.longTaskMaxMs, ...longTasks, 0);
      assert.deepEqual(handle.faults, [], "console / hydration faults");
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, intercepted: [...new Set(handle.intercepted)], blockedOrigins: [...handle.blocked], ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}-${options.width}-${options.lang || "zh"}-${options.theme || "light"}`).catch(() => {});
      const main = await handle.page.evaluate(() => (document.querySelector("#viewer-main")?.innerHTML || "").slice(0, 1500)).catch(() => "");
      results.push({ name, ...options, pass: false, ms: Date.now() - started, step: handle.progress.at, error: String(error?.message || error).slice(0, 900), faults: handle.faults.slice(0, 10), warnings: handle.warnings.slice(0, 5), calls: handle.calls.slice(-6), main });
    } finally {
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }
  await scenario("warm-up", { width: 1440, warmUp: true, signedIn: false }, async ({ page }) => {
    for (const path of ["/about", ...PAGES.map((p) => p.path), "/account/login"]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
  });

  // 1. Real server render while signed out: tools and /my render the sign-in prompt, /account/songs redirects
  for (const lang of ["zh", "ja"])
    await scenario("ssr-signed-out", { width: 1440, lang, signedIn: false }, async ({ page, context }) => {
      const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const raw = await fetch(`${base}${prefix(lang)}/account/songs`, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(60000) });
      assert.equal(raw.status, 302, "/account/songs redirects to sign-in");
      const location = new URL(raw.headers.get("location"), base);
      assert.equal(location.pathname, `${prefix(lang)}/account/login`);
      assert.equal(location.searchParams.get("redirect"), `${prefix(lang)}/account/songs`);
      const pages = [];
      for (const item of PAGES.filter((p) => p.key !== "scores")) {
        const html = await (await fetch(`${base}${prefix(lang)}${item.path}`, { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
        assert.match(html, /<html[^>]*class="[^"]*\brework-ep\b/, `${item.path}: server HTML carries rework-ep`);
        assert.match(html, /class="[^"]*\brw-gate\b[^"]*"[^>]*data-need="login"/, `${item.path}: server rendered the sign-in prompt`);
        await page.goto(`${base}${prefix(lang)}${item.path}`, { waitUntil: "networkidle" });
        const gate = page.locator('.rw-gate[data-need="login"]').first();
        await gate.waitFor();
        const login = new URL(base + (await gate.locator("a").first().getAttribute("href")));
        assert.equal(login.pathname, `${prefix(lang)}/account/login`);
        assert.equal(login.searchParams.get("redirect"), `${prefix(lang)}${item.path}`, "back to this page after sign-in");
        assert.ok(await noOverflow(page));
        if (item.tab) assert.equal(await page.locator(`.desktop-tabs a[aria-current="page"]`).getAttribute("href"), `${prefix(lang)}${item.tab}`);
        pages.push(item.path);
        if (lang === "zh" && (item.key === "b30" || item.key === "my")) await shot(page, `ssr-signed-out-${item.key}-zh-1440-light`);
      }
      // browser entry to /account/songs while signed out ends on the sign-in page (client middleware, same rule)
      await page.goto(`${base}${prefix(lang)}/account/songs`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, `${prefix(lang)}/account/login`);
      return { pages, real: true };
    });
  await scenario("ssr-signed-out-phone", { width: 390, theme: "dark", signedIn: false }, async ({ page }) => {
    await page.goto(`${base}/tools/progress`, { waitUntil: "networkidle" });
    await page.locator('.rw-gate[data-need="login"]').waitFor();
    assert.ok(await noOverflow(page));
    assert.equal(await page.locator('.mobile-tabs a[aria-current="page"]').getAttribute("href"), "/tools/progress");
    await shot(page, "ssr-signed-out-progress-zh-390-dark");
    return { real: true };
  });

  // 2. Matrix, signed in (intercepted): every page at every width / theme, zh and a ja sample
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const matrixShots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light"]);
  for (const combo of combos)
    await scenario("matrix-intercepted", combo, async ({ page, rows }) => {
      const { width, theme, lang } = combo;
      const m = copy[lang];
      const seen = {};
      const h1Left = {};
      await enterSignedIn(page, base, lang, "/account/songs");
      for (const item of PAGES) {
        if (item.key !== "scores") {
          const t0 = Date.now();
          await push(page, `${prefix(lang)}${item.path}`);
          await page.waitForURL((u) => u.pathname === `${prefix(lang)}${item.path}`);
          timings.routeSwitchMs.push(Date.now() - t0);
        }
        const cls = await htmlClasses(page);
        assert.ok(cls.includes("rework-ep"), `${item.path}: rework-ep`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        if (item.key === "scores") {
          await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
          assert.equal((await page.locator("h1").first().textContent()).trim(), msg(m, "rework.scoreList.title"));
          const mounted = await page.locator(".sl-table tr.sr").count();
          assert.ok(mounted <= 60, "mounted rows " + mounted);
          // P1: crown with visible text (full ≥ 1100, short below), rank with its name
          const crownText = await page.locator(".sl-table tr.sr").first().locator(".c-crown .ds-crown__text:visible").first().textContent();
          assert.ok(crownText.trim().length > 0, "crown text visible");
          const fullName = msg(m, "ds.crown.dondaful");
          const shortName = msg(m, "ds.crown.short.dondaful");
          assert.equal(crownText.trim(), width >= 1100 ? fullName : shortName);
          const rankName = await page.locator(".sl-table tr.sr").first().locator(".c-rank .ds-rank__name:visible").first().textContent();
          assert.ok(rankName.trim().length > 0, "rank name beside the icon");
          const triple = await page.locator(".sl-table tr.sr").first().locator(".c-judge .sr-triple").isVisible();
          const bar = await page.locator(".sl-table tr.sr").first().locator(".c-judge .ds-judge").isVisible();
          assert.equal(bar, width >= 1100, "judge bar where the row has room");
          assert.equal(triple, width < 768 && width >= 375, "judge triple on phones from 375 px");
          assert.equal(await page.locator(".sl-table thead").isVisible(), width >= 768, "table from 768 px");
          seen.scores = { mounted, crownText: crownText.trim() };
        } else if (item.key === "b30" || item.key === "trend") {
          await page.locator(".rw-form button[type=submit]").click();
          await waitImage(page);
          const fit = await page.evaluate(() => {
            const img = document.querySelector(".ir-img");
            const panel = document.querySelector(".ir");
            return { img: img.getBoundingClientRect().width, panel: panel.getBoundingClientRect().width };
          });
          assert.ok(fit.img <= fit.panel, `image inside its panel ${fit.img}/${fit.panel}`);
          seen[item.key] = fit;
        } else if (item.key === "progress") {
          await waitImage(page); // generated on its own once the options are read (as before)
          seen.progress = true;
        } else if (item.key === "recommend") {
          await page.locator(".rw-form button[type=submit]").click();
          await page.locator(".rr").first().waitFor();
          assert.equal(await page.locator(".rr").count(), 12);
          seen.recommend = await page.locator(".rr").count();
        } else if (item.key === "my") {
          await page.locator(".hub .who").waitFor();
          assert.equal((await page.locator(".hub .who-name").textContent()).trim(), fixtureUser.username);
          // slice G: + settings, and sign out (a button) for the phone account entries
          assert.equal(await page.locator(".hub .list a").count(), 11, "9 entries + settings + annual");
          assert.equal(await page.locator(".hub [data-sign-out]").count(), 1, "sign out");
          const names = Object.fromEntries(await page.$$eval(".hub .list a", (as) => as.map((a) => [a.getAttribute("href"), a.textContent.trim()])));
          const p = prefix(lang);
          for (const [href, key] of [["/account/songs", "rework.scoreList.title"], ["/tools/b30", "tools.b30"], ["/tools/trend", "tools.trend"], ["/tools/progress", "tools.progress"], ["/tools/recommend", "tools.recommend"], ["/my/weekly", "weekly.title"], ["/my/growth", "passport.title"], ["/account/sync", "account.sync"], ["/tools/word-cloud", "tools.wordCloud"]])
            assert.equal(names[p + href], msg(m, key), "hub entry = page title: " + href);
          seen.my = true;
        }
        if (item.tab) {
          h1Left[item.key] = Math.round(await page.locator("h1").first().evaluate((el) => el.getBoundingClientRect().left));
          const sel = width < 768 ? ".mobile-tabs" : ".desktop-tabs";
          const hrefs = await page.$$eval(`${sel} a`, (as) => as.map((a) => a.getAttribute("href")));
          assert.deepEqual(hrefs, TAB_PATHS.map((x) => prefix(lang) + x), "成绩 tabs");
          assert.equal(await page.locator(`${sel} a[aria-current="page"]`).getAttribute("href"), prefix(lang) + item.tab);
        }
        assert.ok(await noOverflow(page), `${item.path}: no horizontal overflow at ${width}`);
        const key = `${lang}-${width}-${theme}`;
        if (matrixShots.has(key)) await shot(page, `${item.key}-intercepted-${key}`, width >= 1440);
      }
      // the five pages of the group share the content width: the heading does not move between tabs
      assert.equal(new Set(Object.values(h1Left)).size, 1, "same left edge for the 成绩 tabs: " + JSON.stringify(h1Left));
      return { seen, h1Left };
    });

  // 3. Score list functions (1440, intercepted): filters, search, clear, paging, page size windows, details, lock,
  //    editor / import dialogs, binding switch, manual delete, links, catalog failure
  await scenario("scores-functions", { width: 1440 }, async ({ page, rows, calls, writes, state, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/account/songs");
    await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
    assert.equal((await page.locator(".sl-summary").textContent()).trim(), msg(m, "rework.scoreList.summary", { total: 130 }));
    // links: catalog song → detail with difficulty; custom title → no link; removed tag
    const first = rows[0];
    assert.equal(await page.locator(`tr.sr[data-key="${first.songNo}:${first.level}"] .sr-link`).getAttribute("href"), `/songs/${first.songNo}?difficulty=${first.level}`);
    assert.equal(await page.locator('tr.sr[data-key="900001:4"] .sr-link').count(), 0, "custom title has no detail link");
    assert.ok(await page.locator('tr.sr[data-key="3:4"] .tag', { hasText: msg(m, "rework.scoreList.removed") }).count(), "removed tag");
    assert.ok(await page.locator('tr.sr[data-key="900001:4"] .tag', { hasText: msg(m, "rework.scoreList.custom") }).count(), "custom tag");
    // difficulty filter (applies the keyword field too, page 1)
    step("filter");
    let t0 = Date.now();
    await page.locator(".sl-tools .seg button", { hasText: msg(m, "difficulty.5") }).click();
    await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25, level: 5 }));
    timings.filterMs.push(Date.now() - t0);
    assert.equal(lastCall(calls, "songs").query.level, "5");
    assert.equal((await page.locator(".sl-summary").textContent()).trim(), msg(m, "rework.scoreList.summary", { total: 40 }));
    // keyword search on submit
    step("keyword");
    await page.locator(".sl-search input").fill("合成曲目 1");
    t0 = Date.now();
    await page.locator(".sl-tools button[type=submit]").click();
    await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25, level: 5, keyword: "合成曲目 1" }));
    timings.filterMs.push(Date.now() - t0);
    assert.equal(lastCall(calls, "songs").query.keyword, "合成曲目 1");
    // no match → empty with clear
    step("no-match");
    await page.locator(".sl-search input").fill("zzqx-none");
    await page.locator(".sl-tools button[type=submit]").click();
    await page.locator(".rw-state", { hasText: msg(m, "rework.scoreList.noMatch") }).waitFor();
    await shot(page, "scores-no-match-intercepted-zh-1440-light");
    await page.locator(".rw-state .rw-btn", { hasText: msg(m, "rework.scoreList.clear") }).click();
    await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
    assert.equal(await page.locator(".sl-search input").inputValue(), "");
    // paging: 100 per page shown in two windows of 50, next page, back to 25 (keeps the page), page 1
    step("paging");
    await page.locator(".sl-size select").selectOption("100");
    const hundred = expectedKeys(rows, { page: 1, pageSize: 100 });
    await waitRows(page, hundred.slice(0, 50));
    assert.equal(lastCall(calls, "songs").query.pageSize, "100");
    assert.equal(await page.locator(".sl-table tr.sr").count(), 50, "≤ 60 mounted rows of a 100-row page");
    assert.equal(await page.locator(".sl-windows button").count(), 2);
    await page.locator(".sl-windows button").nth(1).click();
    await waitRows(page, hundred.slice(50, 100));
    assert.equal((await page.locator(".sl-windows button").nth(1).textContent()).trim(), msg(m, "rework.scoreList.rowsRange", { from: 51, to: 100 }));
    await page.locator(".pager .pg-next").click();
    await waitRows(page, expectedKeys(rows, { page: 2, pageSize: 100 }));
    assert.equal(lastCall(calls, "songs").query.page, "2");
    assert.equal(await page.locator(".sl-windows").count(), 0, "30 rows: one window");
    await page.locator(".sl-size select").selectOption("25");
    await waitRows(page, expectedKeys(rows, { page: 2, pageSize: 25 }));
    await page.locator(".pager .pg-num", { hasText: /^1$/ }).click();
    await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
    // details row: facts, lock switch and actions
    step("details");
    const r1 = page.locator("tr.sr").nth(1);
    const r1Key = await r1.getAttribute("data-key");
    await r1.locator(".sr-toggle").click();
    assert.equal(await r1.locator(".sr-toggle").getAttribute("aria-expanded"), "true");
    const details = page.locator("tr.sd").first();
    await details.waitFor();
    assert.equal(await details.locator(".sd-facts > div").count(), 9);
    await shot(page, "scores-details-intercepted-zh-1440-light");
    // lock from the row (synced binding): POST with the row identity
    step("lock-row");
    const r2 = page.locator("tr.sr").nth(2);
    const [songNo, level] = (await r2.getAttribute("data-key")).split(":").map(Number);
    await r2.locator(".c-ops .ib[aria-pressed]").click();
    await page.waitForFunction(() => document.querySelectorAll("tr.sr")[2]?.querySelector(".c-ops .ib[aria-pressed]")?.getAttribute("aria-pressed") === "true");
    assert.deepEqual(writes.at(-1), { path: "/api/account/songs/lock", body: { songNo, level, locked: true } });
    // lock from the details switch
    step("lock-details");
    const before = writes.length;
    await details.locator(".sd-lock input").click();
    for (let i = 0; i < 100 && writes.length === before; i++) await page.waitForTimeout(50);
    assert.equal(writes.at(-1).path, "/api/account/songs/lock");
    assert.equal(`${writes.at(-1).body.songNo}:${writes.at(-1).body.level}`, r1Key);
    // editor dialog: mounted while open only
    step("editor");
    await r2.locator(".c-ops .ib").nth(1).click();
    const dialog = page.locator(".el-dialog").filter({ hasText: "编辑谱面记录" });
    await dialog.waitFor();
    const dialogBg = await dialog.evaluate((el) => getComputedStyle(el).getPropertyValue("--el-dialog-bg-color").trim());
    await page.waitForFunction(() => { const d = document.querySelector(".el-dialog"); const o = d?.closest(".el-overlay"); return d && (!o || (getComputedStyle(o).opacity === "1" && !o.getAnimations?.().length)); });
    await shot(page, "scores-editor-intercepted-zh-1440-light");
    await dialog.locator(".el-dialog__footer button").first().click();
    await page.waitForFunction(() => !document.querySelector(".el-dialog"), null, { timeout: 15000 });
    // create and import dialogs
    step("create-import");
    await page.locator(".rw-head__actions .rw-btn", { hasText: msg(m, "rework.scoreList.create") }).click();
    await page.locator(".el-dialog").filter({ hasText: "新增谱面记录" }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".el-dialog"), null, { timeout: 15000 });
    await page.locator(".rw-head__actions .rw-btn", { hasText: msg(m, "rework.scoreList.import") }).click();
    await page.locator(".el-dialog.score-import-dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".el-dialog"), null, { timeout: 15000 });
    // binding switch to the manual binding: delete appears, lock disappears; delete asks first
    step("binding-switch");
    await page.locator("#sl-binding-select").selectOption("2");
    await page.waitForFunction(() => document.querySelector("#sl-binding-select")?.value === "2" && document.querySelectorAll("tr.sr").length > 0);
    assert.deepEqual(writes.find((w) => w.path === "/api/account/bindings/current")?.body, { bindingId: 2 });
    await page.locator("tr.sr .c-ops .ib.is-danger").first().waitFor();
    assert.equal(await page.locator("tr.sr .c-ops .ib[aria-pressed]").count(), 0, "manual: no lock");
    assert.equal((await page.locator(".sl-hint").textContent()).trim(), msg(m, "rework.scoreList.hintManual"));
    const delKey = await page.locator("tr.sr").first().getAttribute("data-key");
    await page.locator("tr.sr").first().locator(".c-ops .ib.is-danger").click();
    const box = page.locator(".el-message-box");
    await box.waitFor();
    await box.locator(".el-message-box__btns button").last().click();
    for (let i = 0; i < 100 && !writes.some((w) => w.path === "/api/account/songs/delete"); i++) await page.waitForTimeout(50);
    const del = writes.find((w) => w.path === "/api/account/songs/delete");
    assert.ok(del, "delete posted after confirming");
    assert.equal(`${del.body.songNo}:${del.body.level}`, delKey);
    assert.equal(del.body.confirmed, true);
    // catalog failure: notice with retry, links fall back to plain titles; retry recovers
    step("catalog-failure");
    state.fail.catalog = 503;
    await push(page, "/about");
    await page.waitForURL(/\/about$/);
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/account/songs");
    await page.locator(".sl-notice[role=alert]").waitFor();
    state.fail.catalog = 0;
    await page.locator(".sl-notice button").click();
    await page.locator(".sl-notice").waitFor({ state: "detached" });
    return { writes: writes.map((w) => w.path), dialogBg: Boolean(dialogBg) };
  });

  // 4. Score list on phones (intercepted): rows, rank name and crown short name; the judge triple from 375 px
  for (const [width, theme] of [[360, "light"], [390, "dark"]])
    await scenario("scores-phone", { width, theme }, async ({ page, rows }) => {
      await enterSignedIn(page, base, "zh", "/account/songs");
      await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
      const first = page.locator("tr.sr").first();
      assert.ok((await first.locator(".c-rank .ds-rank__name:visible").count()) === 1, "rank name beside the icon");
      assert.ok(await first.locator(".c-crown .is-narrow .ds-crown__text").isVisible(), "crown short text");
      assert.equal(await first.locator(".sr-triple").isVisible(), width >= 375);
      // compact top: one scrollable row of difficulties, one row of actions, the first row in the upper half
      const levels = await page.locator(".sl-levels").evaluate((el) => ({ h: el.getBoundingClientRect().height, wraps: el.scrollWidth > el.clientWidth }));
      assert.ok(levels.h <= 52, "difficulty filter on one row: " + levels.h);
      const acts = await page.$$eval(".sl-act", (els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      assert.equal(new Set(acts).size, 1, "import / create on one row");
      const rowTop = (await first.boundingBox()).y;
      assert.ok(rowTop < 844 / 2, "first row in the upper half: " + rowTop);
      await page.locator(".sl-levels button").last().click();
      await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25, level: 5 }));
      const shown = await page.locator(".sl-levels").evaluate((box) => { const b = box.querySelector('[aria-pressed="true"]'); return b.offsetLeft >= box.scrollLeft - 1 && b.offsetLeft + b.offsetWidth <= box.scrollLeft + box.clientWidth + 1; });
      assert.ok(shown, "selected difficulty scrolled into view");
      assert.ok(await noOverflow(page));
      await page.locator(".sl-levels button").first().click();
      await waitRows(page, expectedKeys(rows, { page: 1, pageSize: 25 }));
      await first.locator(".sr-toggle").click();
      await page.locator("tr.sd").first().waitFor();
      assert.ok(await noOverflow(page));
      const box = await first.boundingBox();
      assert.ok(box.width <= width, "row fits");
      await shot(page, `scores-phone-details-intercepted-zh-${width}-${theme}`);
    });

  // 5. Score list states (intercepted): not bound, bound without scores, failed + retry, loading
  await scenario("scores-states", { width: 1440 }, async ({ page, state, release }) => {
    const m = copy.zh;
    state.binding = "unbound";
    await enterSignedIn(page, base, "zh", "/account/songs");
    const gate = page.locator('.rw-gate[data-need="binding"]');
    await gate.waitFor();
    assert.equal(await gate.locator("a").getAttribute("href"), "/account/profile");
    await shot(page, "scores-unbound-intercepted-zh-1440-light");
    state.binding = "empty";
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/account/songs");
    await page.locator(".rw-state", { hasText: msg(m, "rework.scoreList.empty") }).waitFor();
    assert.equal(await page.locator(".rw-state .rw-btn").count(), 2, "import and create");
    await shot(page, "scores-empty-intercepted-zh-1440-light");
    state.binding = "bound";
    state.fail.songs = 503;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/account/songs");
    await page.locator('.sl .rw-state[role="alert"]').waitFor();
    await shot(page, "scores-failed-intercepted-zh-1440-light");
    state.fail.songs = 0;
    state.hold.add("songs");
    await page.locator('.sl .rw-state[role="alert"] button').click();
    await page.locator(".sl .rw-state--loading").waitFor();
    await shot(page, "scores-loading-intercepted-zh-1440-light");
    await release("songs");
    await page.locator(".sl-table tr.sr").first().waitFor();
  });

  // 6. Image pages (intercepted): parameters, result, open / save, changed, loading, failure, binding, no data
  await scenario("b30-functions", { width: 1440 }, async ({ page, calls, state, release }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/tools/b30");
    await page.locator(".ir .rw-state", { hasText: msg(m, "rework.imageTool.ready") }).waitFor();
    await page.locator(".rw-form input[type=number]").fill("12");
    await page.locator(".rw-form .rw-seg button", { hasText: msg(m, "rework.ratingDims.stamina") }).click();
    await page.locator(".rw-form .rw-check input").check();
    state.hold.add("b30");
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator(".ir-wait[role=status]").waitFor();
    await shot(page, "b30-loading-intercepted-zh-1440-light");
    await release("b30");
    await waitImage(page);
    assert.deepEqual(lastCall(calls, "b30").query, { n: "12", dim: "体力", r: "1" });
    assert.match(await page.locator(".ir-summary").textContent(), /Top 12/);
    assert.equal(await page.locator(".ir a[target=_blank]").first().getAttribute("rel"), "noopener");
    assert.equal(await page.locator(".ir a[download]").getAttribute("download"), "taiko-b30.jpg");
    await shot(page, "b30-result-intercepted-zh-1440-light", true);
    await page.locator(".rw-form input[type=number]").fill("60");
    assert.ok(await page.locator(".rw-form button[type=submit]").isDisabled(), "out of range: no submit");
    await page.locator(".rw-form input[type=number]").fill("30");
    await page.locator(".ir .rw-state", { hasText: msg(m, "rework.imageTool.changed") }).waitFor();
    state.fail.image = 503;
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator('.ir .rw-state[role="alert"]').waitFor();
    await shot(page, "b30-failed-intercepted-zh-1440-light");
    state.fail.image = 0;
    await page.locator('.ir .rw-state[role="alert"] button').click();
    await waitImage(page);
    state.fail.image = 400;
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator('.ir-gate[data-need="binding"]').waitFor();
    await shot(page, "b30-unbound-intercepted-zh-1440-light");
    state.fail.image = 404;
    await page.locator(".rw-form button[type=submit]").click();
    const empty = page.locator(".ir .rw-state", { hasText: msg(m, "rework.imageTool.noData") });
    await empty.waitFor();
    assert.equal(await empty.locator("a").getAttribute("href"), "/account/sync");
    await shot(page, "b30-no-data-intercepted-zh-1440-light");
  });
  await scenario("trend-functions", { width: 820 }, async ({ page, calls }) => {
    await enterSignedIn(page, base, "zh", "/tools/trend");
    const inputs = page.locator(".rw-form input[type=number]");
    await inputs.nth(0).fill("15");
    await inputs.nth(1).fill("90");
    await page.locator(".rw-form .rw-seg button", { hasText: msg(copy.zh, "rework.ratingDims.overall") }).click();
    await page.locator(".rw-form .rw-check input").nth(0).check();
    await page.locator(".rw-form .rw-check input").nth(1).check();
    await page.locator(".rw-form button[type=submit]").click();
    await waitImage(page);
    assert.deepEqual(lastCall(calls, "trend").query, { n: "15", maxDays: "90", dim: "综合", bar: "1", all: "1" });
    assert.equal(await page.locator(".ir a[download]").getAttribute("download"), "taiko-trend.jpg");
    assert.ok(await noOverflow(page));
    await shot(page, "trend-result-intercepted-zh-820-light", true);
  });
  await scenario("progress-functions", { width: 1440 }, async ({ page, calls, state }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/tools/progress");
    await waitImage(page);
    // generated on its own with the newest version and 十段 (as before)
    assert.deepEqual(lastCall(calls, "progress").query, { kind: "dani", page: "1", version: "2025", grade: "十段" });
    await page.locator(".rw-seg button", { hasText: msg(m, "rework.progressTool.kinds.constant") }).click();
    await page.locator(".ir .rw-state", { hasText: msg(m, "rework.imageTool.changed") }).waitFor();
    await page.locator(".rw-form .rw-seg button", { hasText: msg(m, "rework.progressTool.comprehensive") }).click();
    await page.locator(".rw-form select").selectOption("10.0");
    await page.locator(".rw-form button[type=submit]").click();
    await waitImage(page);
    assert.deepEqual(lastCall(calls, "progress").query, { kind: "constant", page: "1", mode: "comprehensive", constant: "10.0" });
    // pager (2 pages)
    await page.locator(".ir .rw-seg button", { hasText: msg(m, "rework.library.next") }).click();
    await page.waitForFunction(() => document.querySelector(".ir-summary")?.textContent.includes("2 / 2"));
    await waitImage(page);
    assert.equal(lastCall(calls, "progress").query.page, "2");
    assert.ok(await page.locator(".ir .rw-seg button", { hasText: msg(m, "rework.library.next") }).isDisabled());
    assert.equal(await page.locator(".ir a[download]").getAttribute("download"), "taiko-progress.png");
    await shot(page, "progress-result-intercepted-zh-1440-light", true);
    // star kind
    await page.locator(".rw-seg button", { hasText: msg(m, "rework.progressTool.kinds.star") }).first().click();
    await page.locator(".rw-form select").selectOption("9");
    await page.locator(".rw-form button[type=submit]").click();
    await waitImage(page);
    assert.deepEqual(lastCall(calls, "progress").query, { kind: "star", page: "1", star: "9" });
    // options failure + retry
    state.fail.options = 503;
    await push(page, "/about");
    await page.waitForURL(/\/about$/);
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/tools/progress");
    await page.locator('.rw-state[role="alert"]').waitFor();
    await shot(page, "progress-options-failed-intercepted-zh-1440-light");
    state.fail.options = 0;
    await page.locator('.rw-state[role="alert"] button').click();
    await waitImage(page);
  });

  // 7. Recommendations (intercepted): reasons, links, goal action, target mode, failures
  await scenario("recommend-functions", { width: 1440 }, async ({ page, calls, writes, state }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/tools/recommend");
    await page.locator(".rw-form input[type=number]").fill("12");
    await page.locator(".rw-form select").selectOption("体力");
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator(".rr").first().waitFor();
    assert.deepEqual(lastCall(calls, "recommend").query, { n: "12", dim: "体力", image: "false" });
    const items = fixtureRecommendations(12).items;
    const firstRow = page.locator(".rr").first();
    assert.equal(await firstRow.locator(".rr-song").getAttribute("href"), `/songs/${items[0].songId}?difficulty=${items[0].level}&recommendation=${items[0].recommendationToken}`);
    assert.match(await firstRow.locator(".rr-fit-text").textContent(), /−2\.0%|−1\.9%|−2\.1%/);
    assert.ok(await firstRow.locator(".rr-in").count(), "in the 90–105% band");
    const unplayed = page.locator(".rr").nth(3);
    assert.ok(await unplayed.locator(".tag", { hasText: msg(m, "rework.recommendTool.unplayed") }).count());
    assert.equal(await unplayed.locator(".recommendation-goal-action").count(), 0, "no goal action where the API says it cannot");
    assert.equal(await unplayed.locator(".rr-song").getAttribute("href"), `/songs/${items[3].songId}?difficulty=${items[3].level}`, "no token without a goal");
    await shot(page, "recommend-ordinary-intercepted-zh-1440-light", true);
    // goal action: preview → choose → confirm
    await firstRow.locator(".recommendation-goal-action button").click();
    const dialog = page.locator("dialog.goal-dialog[open]");
    await dialog.waitFor();
    await shot(page, "recommend-goal-dialog-intercepted-zh-1440-light");
    await dialog.locator("input[type=radio]").first().check();
    await dialog.locator(".goal-actions button").last().click();
    await firstRow.locator(".recommendation-goal-action [role=status]").waitFor();
    const goal = writes.find((w) => w.path === "/api/account/growth/goal");
    assert.equal(goal.body.recommendationToken, items[0].recommendationToken);
    assert.equal(goal.body.goalType, "fc");
    // target mode
    await page.locator(".rw-seg button", { hasText: msg(m, "rework.recommendTool.target") }).first().click();
    await page.locator(".rw-form .rw-seg button", { hasText: msg(m, "rework.recommendTool.targets.full_combo") }).click();
    await page.locator(".rw-form select").selectOption("9");
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator(".rr").first().waitFor();
    assert.deepEqual(lastCall(calls, "target").query, { target: "full_combo", star: "9" });
    assert.equal(await page.locator(".rr").count(), 3);
    assert.ok(await page.locator(".rw-note").isVisible(), "not enough candidates notice");
    assert.match(await page.locator(".rr").nth(2).locator(".tp-facts").textContent(), new RegExp(msg(m, "rework.recommendTool.unplayed")));
    await shot(page, "recommend-target-intercepted-zh-1440-light", true);
    // failures: no bound ID, no data, other
    state.fail.target = 400;
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator('.rs-gate[data-need="binding"]').waitFor();
    state.fail.target = 404;
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator(".rw-state", { hasText: msg(m, "rework.imageTool.noData") }).waitFor();
    state.fail.target = 503;
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator('.rw-state[role="alert"]').waitFor();
    state.fail.target = 0;
    await page.locator('.rw-state[role="alert"] button').click();
    await page.locator(".rr").first().waitFor();
    state.fail.recommend = 400;
    await page.locator(".rw-seg button", { hasText: msg(m, "rework.recommendTool.ordinary") }).first().click();
    await page.locator(".rw-form button[type=submit]").click();
    await page.locator('.rs-gate[data-need="binding"]').waitFor();
    await shot(page, "recommend-unbound-intercepted-zh-1440-light");
  });

  // 8. Tabs between the pages of the group (1440 and 390), then the hub and back
  for (const width of [1440, 390])
    await scenario("play-tabs", { width }, async ({ page }) => {
      await enterSignedIn(page, base, "zh", "/account/songs");
      const sel = width < 768 ? ".mobile-tabs" : ".desktop-tabs";
      for (const to of TAB_PATHS.slice(1).concat(TAB_PATHS[0])) {
        const t0 = Date.now();
        await page.locator(`${sel} a[href="${to}"]`).click();
        await page.waitForURL((u) => u.pathname === to);
        timings.routeSwitchMs.push(Date.now() - t0);
        assert.equal(await page.locator(`${sel} a[aria-current="page"]`).getAttribute("href"), to);
        assert.equal(await page.locator(`${sel} a[aria-current="page"]`).count(), 1);
      }
      if (width < 768) {
        await page.locator('.rework-bottom a[href="/my"]').click();
        await page.waitForURL(/\/my$/);
        assert.equal(await page.locator('.rework-bottom a[aria-current="page"]').getAttribute("href"), "/my");
        await page.locator('.hub .list a[href="/tools/b30"]').click();
        await page.waitForURL(/\/tools\/b30$/);
        assert.equal(await page.locator('.mobile-tabs a[aria-current="page"]').getAttribute("href"), "/tools/b30");
      }
    });

  // 9. Element Plus mapping: on for these pages (SSR and client), teleported popups mapped, off after leaving
  // Slice G: the page without the mapping is /annual (out of scope); every reworked page has it by default.
  await scenario("element-plus-switch", { width: 820 }, async ({ page }) => {
    // /annual renders only for phones (middleware/annual-mobile.global.ts; a desktop browser is sent to the home page),
    // so this page presents itself as one; the shell and the reworked pages do not depend on the user agent.
    await page.setExtraHTTPHeaders({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await page.addInitScript((ua) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua }), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    const probe = () =>
      page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return { cls: document.documentElement.className, primary: root.getPropertyValue("--el-color-primary").trim() };
      });
    const popups = () => page.$$eval(".el-overlay, .el-select-dropdown, .el-popper, .el-dialog, .el-message-box", (els) => els.map((el) => String(el.className)).sort());
    await page.goto(`${base}/annual`, { waitUntil: "networkidle" });
    const baseline = await probe();
    const baselinePopups = await popups();
    assert.ok(!baseline.cls.includes("rework-ep"));
    await injectSignedIn(page);
    await push(page, "/account/songs");
    await page.locator(".sl-table tr.sr").first().waitFor();
    const inside = await probe();
    assert.ok(inside.cls.includes("rework-ep"));
    assert.notEqual(inside.primary, baseline.primary);
    await page.locator("tr.sr").first().locator(".sr-toggle").click();
    await page.locator("tr.sd .rw-btn", { hasText: msg(copy.zh, "rework.scoreList.edit") }).click();
    await page.locator(".el-dialog").waitFor();
    const selectBox = page.locator(".el-dialog .el-select").nth(1);
    await selectBox.click();
    const dropdown = page.locator(".el-select-dropdown").last();
    await dropdown.waitFor();
    const ddBg = await dropdown.evaluate((el) => getComputedStyle(el.closest(".el-popper") || el).backgroundColor);
    await page.keyboard.press("Escape");
    await page.locator(".el-dialog .el-dialog__footer button").first().click();
    await page.waitForFunction(() => !document.querySelector(".el-dialog"), null, { timeout: 15000 });
    await push(page, "/annual");
    await page.waitForURL(/\/annual$/);
    const after = await probe();
    assert.ok(!after.cls.includes("rework-ep"), "leave: rework-ep removed");
    assert.equal(after.primary, baseline.primary);
    assert.deepEqual(await popups(), baselinePopups, "no popup nodes left behind");
    await page.goBack();
    await page.waitForURL(/\/account\/songs$/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    assert.ok((await probe()).cls.includes("rework-ep"), "keepalive return");
    for (const path of ["/tools/b30", "/tools/recommend", "/my"]) {
      await push(page, path);
      await page.waitForURL((u) => u.pathname === path);
      await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    }
    // slice C reworked /my/growth: it carries the mapping too (was: not flagged); /annual (out of scope) does not
    await push(page, "/my/growth");
    await page.waitForURL(/\/my\/growth$/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    await push(page, "/annual");
    await page.waitForURL(/\/annual$/);
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    return { dropdownMapped: ddBg };
  });

  // 10. Hub states (intercepted): guest prompt after a sign-out, failed session check with retry
  await scenario("my-states", { width: 390, theme: "dark" }, async ({ page, state }) => {
    await enterSignedIn(page, base, "zh", "/my");
    await page.locator(".hub .who").waitFor();
    assert.equal(await page.locator(".hub .who").getAttribute("href"), "/account/profile");
    await shot(page, "my-signed-in-intercepted-zh-390-dark", true);
    state.signedIn = false;
    await page.goto(`${base}/my`, { waitUntil: "networkidle" });
    await page.locator('.hub .rw-gate[data-need="login"]').waitFor();
    assert.equal(await page.locator(".hub .list a").count(), 9, "guest: entries without sync and annual, with settings (slice G)");
    assert.equal(await page.locator(".hub [data-sign-out]").count(), 0, "guest: no sign out");
    await shot(page, "my-guest-zh-390-dark");
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
