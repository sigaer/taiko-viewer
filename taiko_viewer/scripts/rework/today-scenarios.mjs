// Slice C scenarios: the home page `/` in every presentation (guest, account state loading, account state failed,
// signed in without binding, bound without data, bound with data), goals on the home page, /my/growth, /my/weekly,
// the 成长 tabs and the Element Plus switch on these pages.
// Environment independent; used by
//   - scripts/rework/today-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=today (to be added; see stage-2-progress.md "切片 C")
// Real here: the server render of the guest home, /my/growth and /my/weekly signed out (raw HTTP and hydration), the
// latest songs (/api/content/home over the synthetic song file of detail-data.mjs), the guest song search
// (/api/content/songs, same file), the Bilibili feed failing for real (no egress). Everything that needs the
// database or a signed-in user, and the filled / empty Bilibili feed, is answered in the browser from
// today-fixtures.ts (typed against the real response types) and labelled `intercepted`. The browser never leaves the
// base origin.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import { fixtureBindings } from "./scores-fixtures.ts";
import {
  fixtureCompletedGoal,
  fixtureFeed,
  fixtureGoal,
  fixtureOverview,
  fixturePassport,
  fixtureRecent,
  fixtureScorePresence,
  fixtureUser,
  fixtureWeekly
} from "./today-fixtures.ts";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key.split(".").reduce((o, k) => o?.[k], messages).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
const PNG = stripedPng(64, 64, 4);
const GROWTH_TABS = ["/my/growth", "/my/weekly"];

// ---------- Browser ----------
/**
 * One context; `state` steers the intercepted APIs while the scenario runs:
 *   signedIn, binding ("bound" | "unbound" | "empty"), overview (fixtureOverview options), recent ("new" | …),
 *   evaluate ("active" | "inconclusive" | "completed"), weekly ("full" | "quiet" | "method"), passport options,
 *   feed (null = real server, "items" | "empty" | "error"),
 *   fail: { bindings, songs, overview, recent, goal, evaluate, passport, weekly, home, catalog } → status code,
 *   hold: Set of keys whose responses wait for release() (loading states).
 */
export async function openContext(browser, { base, width, theme = "light", lang = "zh", signedIn = false }) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const state = { signedIn, binding: "bound", overview: {}, recent: "new", evaluate: "active", weekly: "full", passport: {}, feed: null, fail: {}, hold: new Set(), released: new Map() };
  const blocked = new Set();
  const intercepted = [];
  const calls = [];
  const waitHold = (key) => (state.hold.has(key) ? new Promise((r) => state.released.set(key, r)) : null);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      return route.abort();
    }
    const p = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const fail = (status) => json({ statusCode: status, statusMessage: status === 409 ? "goal-conflict" : "selfcheck failure" }, status);
    const hit = async (key) => {
      intercepted.push(p);
      let body;
      try {
        body = method !== "GET" ? request.postDataJSON() : undefined;
      } catch {}
      calls.push({ key, method, path: p, query: Object.fromEntries(url.searchParams), body });
      const held = waitHold(key);
      if (held) await held;
      return body;
    };
    if (p === "/api/bilibili/image") return intercepted.push(p), route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (p.startsWith("/api/bilibili/dynamic/") && state.feed) {
      await hit("feed");
      return json(fixtureFeed(state.feed));
    }
    if (p === "/api/content/home" && (state.fail.home || state.hold.has("home"))) {
      await hit("home");
      if (state.fail.home) return fail(state.fail.home);
      return route.continue();
    }
    if (p === "/api/content/songs" && state.fail.catalog) return intercepted.push(p), fail(state.fail.catalog);
    if (p === "/api/content/songs") calls.push({ key: "catalog", method, path: p, query: Object.fromEntries(url.searchParams) });
    if (p === "/api/account/auth/me") return intercepted.push(p), json({ authenticated: state.signedIn, user: state.signedIn ? fixtureUser : null });
    if (!state.signedIn && p.startsWith("/api/account/")) return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
    if (p === "/api/account/bindings") {
      await hit("bindings");
      if (state.fail.bindings) return fail(state.fail.bindings);
      return json(state.binding === "unbound" ? { bindings: [], currentBinding: null } : fixtureBindings(1));
    }
    if (p === "/api/account/songs") {
      await hit("songs");
      if (state.fail.songs) return fail(state.fail.songs);
      return json(fixtureScorePresence(state.binding === "bound"));
    }
    if (p === "/api/account/growth/overview") {
      await hit("overview");
      if (state.fail.overview) return fail(state.fail.overview);
      return json(fixtureOverview(state.overview));
    }
    if (p === "/api/account/growth/recent") {
      await hit("recent");
      if (state.fail.recent) return fail(state.fail.recent);
      return json(fixtureRecent(state.recent));
    }
    if (p === "/api/account/growth/recent/ack" && method === "POST") {
      const body = await hit("ack");
      return json({ profileId: "1", acknowledgedToken: body?.acknowledgeToken, acknowledgedAt: "2026-11-18T08:10:00Z", unchanged: false });
    }
    if (p === "/api/account/growth/goal" && (method === "POST" || method === "DELETE")) {
      const body = await hit(method === "POST" ? "goal" : "cancel");
      if (state.fail.goal) return fail(state.fail.goal);
      if (method === "DELETE") return json({ profileId: "1", activeGoal: null });
      const plan = fixtureOverview(state.overview).todayPlan.items.find((i) => i.songId === body.songId && i.difficultyType === body.difficultyType);
      return json({ profileId: "1", activeGoal: fixtureGoal(body.goalType, { id: `goal-new-${body.songId}`, songId: body.songId, difficultyType: body.difficultyType, title: plan?.title || "?", starLevel: plan?.starLevel ?? null }) });
    }
    if (p === "/api/account/growth/goal/evaluate" && method === "POST") {
      await hit("evaluate");
      if (state.fail.evaluate) return fail(state.fail.evaluate);
      const goal = fixtureGoal("fc");
      if (state.evaluate === "completed") return json({ profileId: "1", outcome: "completed", activeGoal: null, recentCompletedGoal: fixtureCompletedGoal("fc", 0, 1) });
      return json({ profileId: "1", outcome: state.evaluate, activeGoal: goal, recentCompletedGoal: null });
    }
    if (p === "/api/account/growth/passport") {
      await hit("passport");
      if (state.fail.passport) return fail(state.fail.passport);
      return json(fixturePassport(Number(url.searchParams.get("range")) || 90, state.passport));
    }
    if (p === "/api/account/growth/weekly") {
      await hit("weekly");
      if (state.fail.weekly) return fail(state.fail.weekly);
      return json(fixtureWeekly(state.weekly, url.searchParams.get("week") || "2026-11-16"));
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
  return { context, page, faults, warnings, blocked, intercepted, calls, state, release, step, progress };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const htmlClasses = (page) => page.evaluate(() => document.documentElement.className.split(/\s+/));
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const prefix = (lang) => (lang === "ja" ? "/ja" : "");
const lastCall = (calls, key) => [...calls].reverse().find((c) => c.key === key);
/** The server rendered a guest; the account state the app holds is set to the fixture user (what a sign-in writes). */
const injectSignedIn = (page) =>
  page.evaluate((user) => {
    const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = user;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, fixtureUser);
/** Open `path` signed in: SSR of /about (guest), the fixture user, then client navigation. */
async function enterSignedIn(page, base, lang, path, state) {
  await page.goto(`${base}${prefix(lang)}/about`, { waitUntil: "networkidle" });
  state.signedIn = true;
  await injectSignedIn(page);
  await push(page, `${prefix(lang)}${path}`);
  await page.waitForURL((u) => u.pathname + u.search === `${prefix(lang)}${path}` || u.pathname === `${prefix(lang)}${path}`);
}
/** SVG text inside its svg and not overlapping other text (charts: no clipped or colliding labels). */
const chartTextProblems = (page, selector) =>
  page.$$eval(selector, (svgs) => {
    const out = [];
    for (const svg of svgs) {
      const box = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll("text")].map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() })).filter((t) => t.r.width > 0);
      for (const t of texts) if (t.r.left < box.left - 1 || t.r.right > box.right + 1 || t.r.top < box.top - 1 || t.r.bottom > box.bottom + 1) out.push(`clipped "${t.text}"`);
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i].r;
          const b = texts[j].r;
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`overlap "${texts[i].text}" / "${texts[j].text}"`);
        }
    }
    return out;
  });
const accessibleCharts = (page) =>
  page.$$eval(".ds-line svg[role=img], .ds-line__empty[role=img], svg.ds-radar[role=img], .ds-dial[role=img]", (els) => els.map((el) => el.getAttribute("aria-label") || ""));

// ---------- Scenarios ----------
export async function runTodayScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
  const results = [];
  const timings = { routeSwitchMs: [], longTaskMaxMs: 0 };
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
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, warningsSample: handle.warnings.slice(0, 3), intercepted: [...new Set(handle.intercepted)], blockedOrigins: [...handle.blocked], ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}-${options.width}-${options.lang || "zh"}-${options.theme || "light"}`).catch(() => {});
      const main = await handle.page.evaluate(() => (document.querySelector("#viewer-main")?.innerHTML || "").slice(0, 1500)).catch(() => "");
      results.push({ name, ...options, pass: false, ms: Date.now() - started, step: handle.progress.at, error: String(error?.message || error).slice(0, 900), faults: handle.faults.slice(0, 10), warnings: handle.warnings.slice(0, 5), calls: handle.calls.slice(-6), main });
    } finally {
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }
  await scenario("warm-up", { width: 1440, warmUp: true }, async ({ page }) => {
    for (const path of ["/about", "/", "/my/growth", "/my/weekly", "/songs"]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
  });

  // 1. Real server render of the guest home and the signed-out growth pages (raw HTTP, hydration, links)
  for (const lang of ["zh", "ja"])
    await scenario("ssr-guest", { width: 1440, lang }, async ({ page, context }) => {
      const m = copy[lang];
      const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const html = await (await fetch(`${base}${prefix(lang)}/`, { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
      assert.match(html, /<html[^>]*class="[^"]*\brework-ep\b/, "/: server HTML carries rework-ep");
      assert.match(html, /data-home-presentation="guest"/);
      assert.ok(html.includes(msg(m, "page.home.guest.heroTitle")), "server rendered the guest title");
      assert.match(html, /id="guest-home-song-search"/, "server rendered the search");
      for (const path of ["/my/growth", "/my/weekly"]) {
        const raw = await (await fetch(`${base}${prefix(lang)}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
        assert.match(raw, /<html[^>]*class="[^"]*\brework-ep\b/, `${path}: rework-ep`);
        assert.match(raw, /class="[^"]*\brw-gate\b[^"]*"[^>]*data-need="login"/, `${path}: sign-in prompt in the server HTML`);
        await page.goto(`${base}${prefix(lang)}${path}`, { waitUntil: "networkidle" });
        const gate = page.locator('.rw-gate[data-need="login"]').first();
        await gate.waitFor();
        const login = new URL(base + (await gate.locator("a").first().getAttribute("href")));
        assert.equal(login.pathname, `${prefix(lang)}/account/login`);
        assert.equal(login.searchParams.get("redirect"), `${prefix(lang)}${path}`, "back to this page after sign-in");
        assert.equal((await page.locator("h1").first().textContent()).trim(), msg(m, path === "/my/growth" ? "passport.title" : "weekly.title"));
        assert.equal(await page.locator(`.desktop-tabs a[aria-current="page"]`).getAttribute("href"), `${prefix(lang)}${path}`);
        if (lang === "zh") await shot(page, `ssr-signed-out-${path.split("/").pop()}-zh-1440-light`);
      }
      await page.goto(`${base}${prefix(lang)}/`, { waitUntil: "networkidle" });
      await page.locator(".tl-row").first().waitFor();
      assert.equal(await page.locator(".tl-row").count(), 5, "five latest songs (real /api/content/home)");
      assert.equal(await page.locator(".tt-tool").count(), 4);
      assert.equal(await page.locator(".tt-more").getAttribute("href"), `${prefix(lang)}/more`);
      assert.equal(await page.locator(".tl-more").getAttribute("href"), `${prefix(lang)}/songs`);
      assert.equal(await page.locator(".te-card").count(), 2);
      for (const img of await page.locator(".te-card img").all()) assert.equal(await img.getAttribute("loading"), "lazy");
      assert.equal(await page.locator(".td-visual img").getAttribute("loading"), "lazy");
      assert.equal(await page.locator(".td-visual").getAttribute("target"), "_blank");
      assert.equal(await page.locator(".tg-actions a").first().getAttribute("href"), `${prefix(lang)}/account/login`);
      assert.equal(await page.locator(".tg-actions a").nth(1).getAttribute("href"), `${prefix(lang)}/songs`);
      assert.equal(await page.locator(".ta-cta").getAttribute("href"), `${prefix(lang)}/account/login`);
      assert.equal(await page.locator(".ta-features li").count(), 5);
      assert.equal((await page.locator("h1").count()), 1);
      assert.ok(await noOverflow(page));
      // The Bilibili feed fails for real (the dev server has no egress): the panel is removed, as before
      await page.locator(".te").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.querySelector(".te-feed"), null, { timeout: 30000 });
      if (lang === "zh") await shot(page, "ssr-guest-zh-1440-light", true);
      return { real: true };
    });

  // 2. Guest matrix (real latest songs over the synthetic file): widths × themes, first screen shows songs on phones
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const shots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-360-light", "zh-820-light"]);
  for (const combo of combos)
    await scenario("guest-matrix", combo, async ({ page }) => {
      const { width, theme, lang } = combo;
      await page.goto(`${base}${prefix(lang)}/`, { waitUntil: "networkidle" });
      await page.locator(".tl-row").first().waitFor();
      assert.ok((await htmlClasses(page)).includes("rework-ep"));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      const firstSong = await page.locator(".tl-row").first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      const viewport = width < 500 ? 844 : 900;
      if (width < 768) assert.ok(firstSong < viewport, `first latest song on the first screen (${Math.round(firstSong)} < ${viewport})`);
      assert.ok(await noOverflow(page), "no horizontal overflow");
      assert.equal(await page.locator(".desktop-tabs a, .mobile-tabs a").count(), 0, "今日 has no section tabs");
      const key = `${lang}-${width}-${theme}`;
      if (shots.has(key)) await shot(page, `guest-${key}`, width >= 1440);
      return { firstSongTop: Math.round(firstSong) };
    });

  // 3. Guest search: the global query contract and "view all" into the library (real API over the synthetic file)
  await scenario("guest-search", { width: 1440 }, async ({ page, calls, state, step }) => {
    const m = copy.zh;
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const input = page.locator("#guest-home-song-search");
    step("type");
    await input.fill("合成");
    await page.locator(".ss-option.guest-song-search__result").first().waitFor();
    const query = lastCall(calls, "catalog").query;
    assert.deepEqual({ view: query.view, page: query.page, pageSize: query.pageSize, keyword: query.keyword, sort: query.sort, shelfStatus: query.shelfStatus }, { view: "list", page: "1", pageSize: "8", keyword: "合成", sort: "catalog", shelfStatus: undefined }, "songSearchRequest contract");
    assert.equal(await page.locator(".guest-song-search__result").count(), 8);
    const total = (await (await fetch(`${base}/api/content/songs?${new URLSearchParams(query)}`, { signal: AbortSignal.timeout(30000) })).json()).total;
    const all = page.locator(".ss-all");
    await all.waitFor();
    assert.equal((await all.textContent()).trim(), msg(m, "rework.viewAll", { count: total }));
    await shot(page, "guest-search-zh-1440-light");
    step("keyboard to view all");
    for (let i = 0; i < 9; i++) await input.press("ArrowDown");
    assert.equal(await input.getAttribute("aria-activedescendant"), "guest-home-song-search-results-all");
    await input.press("Enter");
    await page.waitForURL((u) => u.pathname === "/songs");
    const u = new URL(page.url());
    assert.equal(u.searchParams.get("q"), "合成");
    assert.equal(u.searchParams.get("shelf"), "all");
    step("result opens the song");
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator("#guest-home-song-search").fill("合成曲目 1");
    await page.locator(".guest-song-search__result").first().waitFor();
    await page.locator(".guest-song-search__result").first().click();
    await page.waitForURL((u2) => /^\/songs\/\d+$/.test(u2.pathname));
    step("no match");
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator("#guest-home-song-search").fill("zzqx-none");
    await page.locator(".guest-song-search__status", { hasText: msg(m, "page.home.guest.searchEmpty") }).waitFor();
    assert.equal(await page.locator(".ss-all").count(), 0);
    step("failure");
    state.fail.catalog = 503;
    await page.locator("#guest-home-song-search").fill("合成 2");
    await page.locator(".guest-song-search__status", { hasText: msg(m, "page.home.guest.searchFailed") }).waitFor();
    await page.locator("#guest-home-song-search").press("Escape");
    assert.equal(await page.locator(".ss-results").count(), 0, "Esc closes");
    return { real: "search requests real; failure intercepted" };
  });

  // 4. Remote / file blocks: Bilibili feed filled and empty (intercepted), latest songs loading and failed (intercepted)
  await scenario("guest-feed-intercepted", { width: 1440 }, async ({ page, state }) => {
    const m = copy.zh;
    state.feed = "items";
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator(".te").scrollIntoViewIfNeeded();
    await page.locator(".fd-card").first().waitFor();
    assert.equal(await page.locator(".fd-card").count(), 1, "limit 1 as before");
    const card = page.locator(".fd-card").first();
    assert.equal(await card.getAttribute("href"), "https://t.bilibili.com/900000000000000001");
    assert.equal(await card.getAttribute("target"), "_blank");
    assert.equal(await card.locator(".fd-avatar").getAttribute("loading"), "lazy");
    assert.match(await card.locator(".fd-avatar").getAttribute("src"), /^\/api\/bilibili\/image\?url=/);
    assert.equal(await page.locator(".fd-space").getAttribute("target"), "_blank");
    await card.locator(".fd-expand").click();
    assert.ok(await card.locator(".fd-text.is-expanded").count());
    assert.equal((await card.locator(".fd-expand").textContent()).trim(), msg(m, "rework.home.feed.collapse"));
    assert.equal(await card.locator(".fd-media").count(), 4);
    await card.locator(".fd-media").first().click();
    await page.locator(".el-dialog .fd-preview").waitFor();
    assert.ok((await htmlClasses(page)).includes("rework-ep"), "dialog under the mapped Element Plus");
    await shot(page, "guest-feed-intercepted-zh-1440-light");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".el-dialog .fd-preview"), null, { timeout: 15000 });
    assert.ok(new URL(page.url()).pathname === "/", "the preview does not navigate");
    return { intercepted: "feed" };
  });
  await scenario("guest-feed-empty-intercepted", { width: 390 }, async ({ page, state }) => {
    state.feed = "empty";
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator(".te").scrollIntoViewIfNeeded();
    await page.locator(".fd .rw-state--empty", { hasText: msg(copy.zh, "rework.home.feed.empty") }).waitFor();
    assert.ok(await noOverflow(page));
  });
  await scenario("guest-latest-states", { width: 390, theme: "dark" }, async ({ page, state, release }) => {
    state.hold.add("home");
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await page.locator(".tl .rw-state--loading").waitFor();
    await release("home");
    await page.locator(".tl-row").first().waitFor();
    state.fail.home = 503;
    await page.goto(`${base}/ja`, { waitUntil: "networkidle" });
    await page.locator(".tl .rw-state--empty", { hasText: msg(copy.ja, "home.latestSongsUnavailable") }).waitFor();
    await shot(page, "guest-latest-failed-intercepted-ja-390-dark");
    return { intercepted: "home content held / failed" };
  });

  // 5. Account state while resolving and when it fails (intercepted): public blocks stay, retry recovers
  await scenario("home-account-states-intercepted", { width: 1440 }, async ({ page, state, release, step }) => {
    const m = copy.zh;
    state.hold.add("bindings");
    step("loading");
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    state.signedIn = true;
    await injectSignedIn(page);
    await push(page, "/");
    await page.locator('.home-page[data-home-presentation="loading"] .home-account-status[aria-busy="true"]').waitFor();
    assert.ok(await page.locator(".home-recovery .tl").count(), "latest songs while loading");
    assert.ok(await page.locator(".home-recovery .tt").count(), "public tools while loading");
    await shot(page, "home-loading-intercepted-zh-1440-light");
    state.fail.bindings = 503;
    await release("bindings");
    step("failed");
    await page.locator('.home-page[data-home-presentation="public_error"] .home-account-status[role="alert"]').waitFor();
    assert.equal((await page.locator(".home-account-status .rw-state__title").textContent()).trim(), msg(m, "home.recovery.binding"));
    await shot(page, "home-public-error-intercepted-zh-1440-light");
    delete state.fail.bindings;
    await page.locator(".home-account-status .rw-btn").click();
    await page.locator('.home-page[data-home-state="authenticated_ready"] .growth-surface').waitFor();
    return { intercepted: true };
  });

  // 6. Signed in without binding / without data (intercepted)
  for (const [binding, width, theme] of [["unbound", 1440, "light"], ["unbound", 390, "dark"], ["empty", 1440, "light"], ["empty", 390, "light"]])
    await scenario(`home-${binding}-intercepted`, { width, theme }, async ({ page, state }) => {
      const m = copy.zh;
      state.binding = binding;
      await enterSignedIn(page, base, "zh", "/", state);
      if (binding === "unbound") {
        const gate = page.locator('.rw-gate[data-need="binding"]');
        await gate.waitFor();
        assert.equal((await gate.locator(".rw-gate__title").textContent()).trim(), msg(m, "home.personal.unboundTitle"));
        assert.deepEqual(await gate.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), ["/account/profile", "/my"]);
      } else {
        const st = page.locator(".tsi-gate.rw-state--empty");
        await st.waitFor();
        assert.equal((await st.locator(".rw-state__title").textContent()).trim(), msg(m, "home.personal.emptyTitle"));
        assert.deepEqual(await st.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), ["/account/sync", "/my"]);
      }
      assert.equal((await page.locator(".tsi-name").textContent()).trim(), fixtureUser.username);
      assert.ok(await page.locator(".tsi .tt").count(), "public tools while there is no personal data");
      assert.equal(await page.locator(".growth-surface").count(), 0);
      assert.ok(await noOverflow(page));
      await shot(page, `home-${binding}-intercepted-zh-${width}-${theme}`);
    });

  // 7. Signed in with data: every width × theme, zh + ja sample (intercepted)
  const readyCombos = [...combos];
  for (const combo of readyCombos)
    await scenario("home-ready-intercepted", combo, async ({ page, state, calls }) => {
      const { width, theme, lang } = combo;
      const m = copy[lang];
      await enterSignedIn(page, base, lang, "/", state);
      await page.locator(".growth-surface .tpf").waitFor();
      await page.locator(".recent-growth__fact").first().waitFor();
      assert.ok((await htmlClasses(page)).includes("rework-ep"));
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("h1#growth-title").count(), 1);
      // one header: the name only in the greeting <h1>; the growth links on its row from 768 px, below it on phones
      const header = page.locator(".growth-surface header.th");
      assert.equal((await header.textContent()).split(fixtureUser.username).length - 1, 1, "account name shown once");
      const geo = await header.evaluate((el) => {
        const r = (s) => el.querySelector(s).getBoundingClientRect();
        return { h1: r("h1"), links: r(".th-links"), avatar: r(".th-avatar"), banner: r(".th-banner img") };
      });
      assert.ok(geo.avatar.right <= geo.h1.left, "avatar beside the greeting");
      // slice G: the annual banner is part of the greeting row (beside it from 1100 px, above it below that)
      assert.equal(await page.locator(".home-annual").count(), 0, "no separate banner row");
      assert.ok(geo.banner.width > 0 && geo.banner.width <= 612.5, "banner at most its natural width");
      if (width >= 1100) {
        assert.ok(geo.banner.left >= geo.h1.right - 1 && geo.banner.top < geo.h1.bottom, "banner on the right of the greeting");
        assert.ok(geo.links.top >= geo.h1.bottom - 1 && geo.links.left < geo.banner.left, "actions under the greeting");
      } else {
        assert.ok(geo.banner.bottom <= geo.h1.top + 1, "banner above the greeting");
        if (width >= 768) assert.ok(geo.links.top < geo.h1.bottom && geo.links.left >= geo.h1.right - 1, "actions on the h1 row");
        else assert.ok(geo.links.top >= geo.h1.bottom - 1, "actions below the h1 on phones");
      }
      // charts: Rating dial and six-dimension radar with accessible names, no clipped / colliding text
      const names = await accessibleCharts(page);
      assert.ok(names.some((n) => n.startsWith("Rating") && n.includes("9.27")), "dial name: " + names.join(" | "));
      assert.ok(names.some((n) => n.includes(msg(m, "passport.skillOverview"))), "radar name");
      assert.deepEqual(await chartTextProblems(page, "svg.ds-radar"), []);
      // goal: active fc on song 12 with its actions
      const goal = page.locator(".growth-goal");
      assert.equal(await goal.locator(".tgo-song").getAttribute("href"), `${prefix(lang)}/songs/12?difficulty=4`);
      assert.equal(await goal.locator(`a[href^="${prefix(lang)}/account/sync"]`).getAttribute("href"), `${prefix(lang)}/account/sync?profileId=1&from=goal`);
      assert.ok(await goal.locator(".goal-evaluate").isEnabled());
      // the goal content stays together at the top of its card (no band between the song and the actions)
      const gap = await goal.evaluate((el) => el.querySelector(".tgo-actions").getBoundingClientRect().top - el.querySelector(".tgo-song").getBoundingClientRect().bottom);
      assert.ok(gap < 72, `song → actions gap ${Math.round(gap)} px`);
      // recent: crowns with names, rank with its name
      const recent = page.locator(".recent-growth");
      assert.ok((await recent.locator(".ds-crown__text").allTextContents()).length >= 2, "crown text in recent");
      assert.ok((await recent.locator(".ds-rank__name").count()) >= 1, "rank name in recent");
      // today: four events, crowns and ranks named
      assert.equal(await page.locator(".growth-event").count(), 4);
      assert.ok(await page.locator(".growth-progress .ds-crown__text").count());
      assert.equal(await page.locator(".growth-progress .ds-rank__name").count(), 2, "rank before → after named");
      // plan: six rows, five with a goal choice
      assert.equal(await page.locator(".growth-plan__choice").count(), 6);
      assert.equal(await page.locator(".growth-plan__choose").count(), 5);
      assert.equal(await page.locator(".tpl-more").getAttribute("href"), `${prefix(lang)}/tools/recommend`);
      assert.equal(await page.locator(".tt").count(), 0, "no public tools once there is personal data");
      assert.ok(await noOverflow(page), "no horizontal overflow");
      const ack = lastCall(calls, "ack");
      assert.equal(ack?.body?.acknowledgeToken, "tok-1", "recent changes acknowledged after render");
      const key = `${lang}-${width}-${theme}`;
      if (shots.has(key)) await shot(page, `home-ready-intercepted-${key}`, true);
      return { charts: names };
    });

  // 8. Goals on the home page (intercepted): choose, replace, cancel, evaluate (every outcome), errors, variants
  await scenario("goal-flows-intercepted", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    state.overview = { goal: "none" };
    await enterSignedIn(page, base, "zh", "/", state);
    await page.locator(".growth-plan__choose").first().waitFor();
    assert.equal(await page.locator(".growth-goal").count(), 0, "no goal: no goal card");
    step("choose");
    await page.locator(".growth-plan__choose").first().click();
    const dialog = page.locator("dialog.goal-dialog[open]");
    await dialog.waitFor();
    assert.equal((await dialog.locator("#goal-dialog-title").textContent()).trim(), msg(m, "home.goal.question"));
    assert.equal(await dialog.locator("input[type=radio]").count(), 3);
    assert.ok(await dialog.locator(".rw-btn--primary").isDisabled(), "confirm needs a choice");
    await shot(page, "goal-dialog-intercepted-zh-1440-light");
    await dialog.locator(".rw-choice", { hasText: msg(m, "home.goal.types.fc") }).click();
    await dialog.locator(".rw-btn--primary").click();
    await page.locator(".growth-goal .tgo-name").waitFor();
    const post = lastCall(calls, "goal").body;
    assert.deepEqual({ ...post }, { profileId: "1", expectedActiveGoalId: null, songId: 10, difficultyType: 5, goalType: "fc", scoreRevision: "rev-2" });
    assert.equal(await page.locator("dialog.goal-dialog[open]").count(), 0, "dialog closed");
    assert.equal((await page.locator(".growth-plan__choose").first().textContent()).trim(), msg(m, "home.goal.selected"));
    step("replace");
    await page.locator(".growth-goal .rw-btn--ghost", { hasText: msg(m, "home.goal.replace") }).click();
    await dialog.waitFor();
    assert.equal((await dialog.locator("#goal-dialog-title").textContent()).trim(), msg(m, "rework.home.pickTitle"));
    assert.equal(await dialog.locator(".tgp-option").count(), 4, "other plan items that allow a goal");
    await dialog.locator(".tgp-option").first().click();
    assert.equal((await dialog.locator("#goal-dialog-title").textContent()).trim(), msg(m, "home.goal.replaceConfirm"));
    await dialog.locator(".rw-choice").first().click();
    state.fail.goal = 409;
    await dialog.locator(".rw-btn--primary").click();
    await dialog.locator(".goal-error", { hasText: msg(m, "home.goal.conflict") }).waitFor();
    delete state.fail.goal;
    await dialog.locator(".rw-btn--primary").click();
    await page.waitForFunction(() => !document.querySelector("dialog.goal-dialog[open]"));
    assert.equal(lastCall(calls, "goal").body.expectedActiveGoalId, "goal-new-10");
    step("evaluate outcomes");
    // the overview read after an evaluation is authoritative: from now on it carries the active goal
    state.overview = { goal: "active" };
    for (const [outcome, key] of [["active", "home.goal.unchanged"], ["inconclusive", "home.goal.inconclusive"]]) {
      state.evaluate = outcome;
      const before = calls.filter((c) => c.key === "overview").length;
      await page.locator(".goal-evaluate").click();
      await page.locator(".rw-note", { hasText: msg(m, key) }).waitFor();
      await page.waitForFunction(() => !document.querySelector(".goal-evaluate[disabled]"));
      assert.ok(calls.filter((c) => c.key === "overview").length > before, "overview read again after evaluation");
    }
    state.fail.evaluate = 503;
    await page.locator(".goal-evaluate").click();
    await page.locator(".goal-error", { hasText: msg(m, "home.goal.error") }).waitFor();
    delete state.fail.evaluate;
    state.evaluate = "completed";
    state.overview = { goal: "completed-fc" };
    await page.locator(".goal-evaluate").click();
    await page.locator(".growth-goal--completed").waitFor();
    assert.ok((await page.locator(".growth-goal--completed .ds-crown__text").textContent()).trim().length, "completed crown named");
    await shot(page, "goal-completed-intercepted-zh-1440-light");
    step("choose next from completed");
    await page.locator(".growth-goal--completed .rw-btn--primary").click();
    await dialog.waitFor();
    await dialog.locator(".rw-btn", { hasText: msg(m, "home.goal.cancel") }).click();
    await page.waitForFunction(() => !document.querySelector("dialog.goal-dialog[open]"));
    return { posts: calls.filter((c) => ["goal", "evaluate", "cancel"].includes(c.key)).length };
  });
  await scenario("goal-cancel-intercepted", { width: 390 }, async ({ page, state, calls }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/", state);
    await page.locator(".growth-goal .tgo-name").waitFor();
    await page.locator(".growth-goal .rw-btn--ghost", { hasText: msg(m, "home.goal.cancel") }).click();
    await page.waitForFunction(() => !document.querySelector(".growth-goal"));
    assert.equal(lastCall(calls, "cancel").method, "DELETE");
    assert.equal(lastCall(calls, "cancel").body.expectedActiveGoalId, "goal-fc");
  });
  for (const [variant, check] of [
    ["completed-score", async (page, m) => assert.match(await page.locator(".growth-goal--completed .tgo-change").textContent(), /905,120 → 931,870/)],
    ["completed-rank", async (page) => assert.equal(await page.locator(".growth-goal--completed .ds-rank__name").count(), 2)],
    ["unavailable", async (page, m) => assert.ok(await page.locator(".growth-goal .rw-note", { hasText: msg(m, "home.goal.unavailable") }).count())]
  ])
    for (const width of [820, 1440])
      await scenario(`goal-${variant}-intercepted`, { width }, async ({ page, state }) => {
        state.overview = { goal: variant };
        await enterSignedIn(page, base, "zh", "/", state);
        await page.locator(".growth-goal").waitFor();
        await check(page, copy.zh);
        // content together at the top of the card, whatever the neighbour's height
        const gap = await page.locator(".growth-goal").evaluate((el) => el.querySelector(".tgo-actions").getBoundingClientRect().top - el.querySelector(".tgo-song").getBoundingClientRect().bottom);
        assert.ok(gap < 150, `song → actions gap ${Math.round(gap)} px`);
        assert.ok(await noOverflow(page));
        await shot(page, `goal-${variant}-intercepted-zh-${width}-light`);
      });

  // 9. Ready-state blocks: empty and failed of each (intercepted)
  await scenario("home-ready-states-intercepted", { width: 1440 }, async ({ page, state, release, step }) => {
    const m = copy.zh;
    step("overview loading → failed → retry");
    state.hold.add("overview");
    await enterSignedIn(page, base, "zh", "/", state);
    await page.locator(".growth-surface .growth-loading[aria-busy=true]").waitFor();
    state.fail.overview = 503;
    await release("overview");
    await page.locator(".growth-surface .rw-state--failed", { hasText: msg(m, "home.growth.loadFailed") }).waitFor();
    await shot(page, "home-overview-failed-intercepted-zh-1440-light");
    delete state.fail.overview;
    await page.locator(".growth-surface .rw-state--failed .rw-btn").click();
    await page.locator(".growth-surface .tpf").waitFor();
    step("recent failed → retry");
    state.fail.recent = 503;
    state.overview = { goal: "none", plan: 0, daily: "not_played", sufficiency: "insufficient" };
    state.recent = "caught-up";
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/");
    await page.locator(".recent-growth__state[role=alert]").waitFor();
    // empty states of the other blocks
    await page.locator(".growth-progress__state", { hasText: msg(m, "home.growth.noPlay") }).waitFor();
    await page.locator(".growth-plan .rw-state--empty", { hasText: msg(m, "home.growth.noRecommendation") }).waitFor();
    assert.equal(await page.locator("svg.ds-radar").count(), 0, "no radar without dimension values");
    assert.ok((await page.locator(".tpf-v").textContent()).includes("—"));
    await shot(page, "home-ready-empty-intercepted-zh-1440-light", true);
    delete state.fail.recent;
    await page.locator(".recent-growth__state .rw-btn").click();
    await page.locator(".recent-growth__empty", { hasText: msg(m, "home.growth.recent.caughtUp") }).waitFor();
    step("daily unknown / quiet");
    for (const [daily, key] of [["unknown", "home.growth.progressUnavailable"], ["quiet", "rework.home.daily.quiet"]]) {
      state.overview = { daily };
      await page.goto(`${base}/about`, { waitUntil: "networkidle" });
      await injectSignedIn(page);
      await push(page, "/");
      await page.locator(".growth-progress__state", { hasText: msg(m, key) }).waitFor();
    }
    return { intercepted: true };
  });

  // 10. /my/growth and /my/weekly signed in (intercepted): widths × themes, charts, tabs, controls
  for (const combo of combos)
    await scenario("growth-matrix-intercepted", combo, async ({ page, state }) => {
      const { width, theme, lang } = combo;
      const m = copy[lang];
      const h1Left = {};
      await enterSignedIn(page, base, lang, "/my/growth", state);
      await page.locator(".passport-hero").waitFor();
      await page.locator(".gmc-chart").first().waitFor();
      assert.ok((await htmlClasses(page)).includes("rework-ep"));
      const names = await accessibleCharts(page);
      assert.equal(names.filter((n) => n.startsWith("Rating")).length, 2, "dial + Rating line: " + names.join(" | "));
      assert.ok(names.some((n) => n.includes(msg(m, "passport.skillOverview"))), "radar");
      assert.deepEqual(await chartTextProblems(page, ".ds-line svg, svg.ds-radar"), [], "chart text");
      assert.equal((await page.locator("h1").first().textContent()).trim(), msg(m, "passport.title"));
      h1Left.growth = Math.round(await page.locator("h1").first().evaluate((el) => el.getBoundingClientRect().left));
      assert.ok(await noOverflow(page), "growth: no horizontal overflow");
      const sel = width < 768 ? ".mobile-tabs" : ".desktop-tabs";
      assert.deepEqual(await page.$$eval(`${sel} a`, (as) => as.map((a) => [a.getAttribute("href"), a.textContent.trim()])), [[`${prefix(lang)}/my/growth`, msg(m, "passport.title")], [`${prefix(lang)}/my/weekly`, msg(m, "weekly.title")]]);
      const key = `${lang}-${width}-${theme}`;
      if (shots.has(key)) await shot(page, `growth-intercepted-${key}`, true);
      const t0 = Date.now();
      await page.locator(`${sel} a`).nth(1).click();
      await page.waitForURL((u) => u.pathname === `${prefix(lang)}/my/weekly`);
      await page.locator(".weekly-hero").waitFor();
      timings.routeSwitchMs.push(Date.now() - t0);
      assert.equal((await page.locator("h1").first().textContent()).trim(), msg(m, "weekly.title"));
      h1Left.weekly = Math.round(await page.locator("h1").first().evaluate((el) => el.getBoundingClientRect().left));
      assert.equal(await page.locator(`${sel} a[aria-current="page"]`).getAttribute("href"), `${prefix(lang)}/my/weekly`);
      assert.equal(await page.locator(".wh-total").count(), 6);
      assert.equal(await page.locator(".weekly-rhythm .weekly-highlight").count(), 4);
      assert.ok(await page.locator(".weekly-rhythm .ds-crown__text").count() >= 2, "crowns named");
      assert.equal(await page.locator(".weekly-rhythm .ds-rank__name").count(), 2, "ranks named");
      assert.equal(await page.locator(".wc-rows li").count(), 6);
      assert.ok(await noOverflow(page), "weekly: no horizontal overflow");
      assert.equal(h1Left.growth, h1Left.weekly, "same left edge for the 成长 tabs");
      if (shots.has(key)) await shot(page, `weekly-intercepted-${key}`, true);
      return { h1Left, charts: names.length };
    });

  await scenario("growth-functions-intercepted", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/my/growth", state);
    await page.locator(".passport-hero").waitFor();
    assert.equal(lastCall(calls, "passport").query.range, "90");
    step("range");
    // The service returns every range in `shared`; the page selects the range client side (no new request)
    const reads = calls.filter((c) => c.key === "passport").length;
    const summary90 = await page.locator(".passport-chart-summary").first().textContent();
    await page.locator('.passport-range button[data-range="30"]').click();
    await page.waitForURL((u) => u.searchParams.get("range") === "30");
    await page.waitForFunction(() => document.querySelector('.passport-range button[data-range="30"]')?.getAttribute("aria-pressed") === "true");
    await page.waitForFunction((s) => document.querySelector(".passport-chart-summary")?.textContent !== s, summary90);
    assert.equal(calls.filter((c) => c.key === "passport").length, reads);
    await page.locator('.passport-range button[data-range="90"]').click();
    await page.waitForURL((u) => u.searchParams.get("range") === "90");
    step("dimension");
    await page.locator(".passport-dimensions button", { hasText: msg(m, "rework.ratingDims.stamina") }).click();
    await page.waitForURL((u) => u.searchParams.get("dimension") === "stamina");
    await page.waitForFunction(() => document.querySelectorAll('.passport-metric[data-metric="stamina"]').length === 1);
    step("keyboard read-out");
    const chart = page.locator(".passport-metric").first();
    const before = await chart.locator(".passport-chart-detail").textContent();
    await chart.locator(".gmc-chart").focus();
    await page.keyboard.press("ArrowLeft");
    const after = await chart.locator(".passport-chart-detail").textContent();
    assert.notEqual(before, after, "← moves the read-out");
    await page.keyboard.press("Home");
    assert.ok(await chart.locator(".gmc-readout .rw-btn").first().isDisabled(), "first point: previous disabled");
    assert.equal(await chart.locator(".ds-line__mark-dot").count(), 1, "selected point marked on the line");
    step("milestones");
    assert.equal(await page.locator(".passport-milestone").count(), 8);
    await page.locator(".passport-more").click();
    assert.equal(await page.locator(".passport-milestone").count(), 11);
    assert.ok(await page.locator(".passport-milestones .ds-crown__text").count() >= 2);
    assert.equal(await page.locator(".passport-milestones .ds-rank__name").count(), 4, "two rank milestones, before → after");
    await page.locator(".passport-more").click();
    assert.equal(await page.locator(".passport-milestone").count(), 8);
    step("focus, now, next");
    assert.equal(await page.locator(".gf-run").count(), 3);
    assert.equal(await page.locator('.gf-run[aria-current="step"]').count(), 1);
    assert.ok(await page.locator(".gn-legend").count(), "dashed start point legend");
    assert.equal(await page.locator(".passport-goal").count(), 2);
    assert.equal(await page.locator(".passport-goal").first().getAttribute("href"), "/songs/12?difficulty=4");
    assert.equal(await page.locator(".passport-next__songs a").count(), 3);
    assert.equal(await page.locator(".passport-weekly-link").getAttribute("href"), "/my/weekly");
    step("failure + retry, no current");
    // A failed read of the selected range keeps the page in its failed state; retry reads again
    state.fail.passport = 503;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await push(page, "/my/growth?range=180");
    await page.locator(".passport-state[role=alert]").waitFor();
    await shot(page, "growth-failed-intercepted-zh-1440-light");
    delete state.fail.passport;
    state.passport = { current: false, milestones: 0 };
    await page.locator(".passport-state .rw-btn").first().click();
    await page.locator(".passport-limited", { hasText: msg(m, "passport.noCurrent") }).waitFor();
    await page.locator(".passport-empty", { hasText: msg(m, "passport.noMilestones") }).waitFor();
    return { intercepted: true };
  });
  await scenario("growth-states-intercepted", { width: 390, theme: "dark" }, async ({ page, state, release }) => {
    const m = copy.zh;
    state.hold.add("passport");
    await enterSignedIn(page, base, "zh", "/my/growth", state);
    await page.locator(".passport-loading[aria-busy=true]").waitFor();
    state.fail.passport = 503;
    await release("passport");
    await page.locator(".passport-state[role=alert]").waitFor();
    assert.equal(await page.locator(".passport-state a").getAttribute("href"), "/account/profile");
    await shot(page, "growth-failed-intercepted-zh-390-dark");
    delete state.fail.passport;
    await page.locator(".passport-state .rw-btn").first().click();
    await page.locator(".passport-hero").waitFor();
    assert.ok(await noOverflow(page));
    return { msg: msg(m, "passport.loadFailed") };
  });

  await scenario("weekly-functions-intercepted", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/my/weekly", state);
    await page.locator(".weekly-hero").waitFor();
    assert.equal(lastCall(calls, "weekly").query.week, undefined);
    assert.equal((await page.locator(".wh-theme").textContent()).trim(), msg(m, "weekly.theme.score-breakthrough"));
    assert.equal(await page.locator(".wh-nav a").count(), 1, "current week: only previous");
    step("previous week");
    await page.locator(".wh-nav a").first().click();
    await page.waitForURL((u) => u.searchParams.get("week") === "2026-11-09");
    await page.waitForFunction(() => document.querySelector(".wh-kicker")?.textContent?.trim().length);
    await page.waitForFunction((k) => document.querySelector(".wh-kicker")?.textContent?.trim() === k, msg(m, "weekly.completeWeek"));
    assert.equal(lastCall(calls, "weekly").query.week, "2026-11-09");
    assert.equal(await page.locator(".wh-nav a").count(), 2, "completed week: previous and next");
    step("refresh");
    const n = calls.filter((c) => c.key === "weekly").length;
    await page.locator(".weekly-refresh").click();
    await page.waitForFunction(() => true);
    await page.waitForTimeout(300);
    assert.ok(calls.filter((c) => c.key === "weekly").length > n, "refresh reads again");
    step("variants");
    for (const [kind, check] of [
      ["quiet", async () => {
        await page.locator(".weekly-measurement .wc-say", { hasText: msg(m, "weekly.measurement.insufficient") }).waitFor();
        await page.locator(".weekly-next .rw-state--empty", { hasText: msg(m, "weekly.noAdvice") }).waitFor();
        assert.equal(await page.locator(".weekly-rhythm").count(), 0);
      }],
      ["method", async () => {
        await page.locator(".weekly-measurement details summary", { hasText: msg(m, "weekly.segmentUpdated") }).waitFor();
        await page.locator(".weekly-coverage", { hasText: msg(m, "weekly.coverage.partial") }).waitFor();
      }]
    ]) {
      state.weekly = kind;
      await page.goto(`${base}/about`, { waitUntil: "networkidle" });
      await injectSignedIn(page);
      await push(page, "/my/weekly");
      await page.locator(".weekly-hero").waitFor();
      await check();
      await shot(page, `weekly-${kind}-intercepted-zh-1440-light`);
    }
    step("failure");
    state.fail.weekly = 503;
    await page.locator(".weekly-refresh").click();
    await page.locator(".weekly-state[role=alert]").waitFor();
    delete state.fail.weekly;
    await page.locator(".weekly-state .rw-btn").first().click();
    await page.locator(".weekly-hero").waitFor();
    return { intercepted: true };
  });

  // 11. Element Plus mapping on the reworked pages and off elsewhere
  // Slice G: the page without the mapping is /annual (out of scope); every reworked page has it by default.
  await scenario("element-plus-switch", { width: 820 }, async ({ page, state }) => {
    // /annual renders only for phones (middleware/annual-mobile.global.ts; a desktop browser is sent to the home page),
    // so this page presents itself as one; the shell and the reworked pages do not depend on the user agent.
    await page.setExtraHTTPHeaders({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await page.addInitScript((ua) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua }), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(`${base}/annual`, { waitUntil: "networkidle" });
    assert.ok(!(await htmlClasses(page)).includes("rework-ep"));
    state.signedIn = true;
    await injectSignedIn(page);
    for (const path of ["/", "/my/growth", "/my/weekly"]) {
      await push(page, path);
      await page.waitForURL((u) => u.pathname === path);
      await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    }
    await push(page, "/annual");
    await page.waitForURL(/\/annual$/);
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    await page.goBack();
    await page.waitForURL(/\/my\/weekly$/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
