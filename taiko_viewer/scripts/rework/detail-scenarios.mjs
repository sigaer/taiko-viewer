// Slice A scenarios: song detail /songs/:id and constants /songs/constants, plus the Element Plus mapping switch.
// Environment independent; used by
//   - scripts/rework/detail-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=detail (to be added; see stage-1-progress.md "切片 A")
// The server must serve the files of detail-data.mjs (real APIs, real SSR). Database / sign-in parts are answered
// in the browser from detail-fixtures.ts (typed against the real response types) and labelled `intercepted`.
// The browser never leaves the base origin: every other request is aborted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSTANT_SONGS, IDS, buildDetailData, expectedV2Rows } from "./detail-data.mjs";
import { fixtureScores, fixtureThreads, fixtureUgc, fixtureUser, fixtureViewerUgc } from "./detail-fixtures.ts";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// ---------- Copy from the locale files ----------
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key.split(".").reduce((o, k) => o?.[k], messages).replace(/\{(\w+)\}/g, (_, k) => String(values[k]));

// ---------- Expectations from the synthetic data (same rules as the server) ----------
const DIFF = { hard: 3, oni: 4, edit: 5 };
export function expectedConstants(data, { keyword = "", difficulty = "", page = 1, pageSize = 50, sortBy = "id", sortOrder = "asc" } = {}) {
  const order = ["hard", "oni", "edit"];
  let rows = expectedV2Rows(data).filter((r) => (!difficulty || r.difficulty === difficulty) && (!keyword || String(r.id).includes(keyword.toLowerCase()) || r.songName.toLowerCase().includes(keyword.toLowerCase())));
  const dir = sortOrder === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    let p = 0;
    if (sortBy === "songName") p = a.songName.localeCompare(b.songName, "zh-Hans-CN");
    else if (sortBy === "difficulty") p = order.indexOf(a.difficulty) - order.indexOf(b.difficulty);
    else p = a[sortBy] - b[sortBy];
    return p ? p * dir : a.id - b.id || order.indexOf(a.difficulty) - order.indexOf(b.difficulty);
  });
  const total = rows.length;
  rows = rows.slice((page - 1) * pageSize, page * pageSize);
  return { total, keys: rows.map((r) => `${r.id}-${r.difficulty}`), rows, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------- Browser helpers ----------
export async function openContext(browser, { base, width, theme = "light", lang = "zh", signedIn = false, data }) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const blocked = new Set();
  const intercepted = [];
  const writes = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      return route.abort();
    }
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const p = url.pathname;
    let m;
    if (p === "/api/account/auth/me") return intercepted.push(p), json({ authenticated: signedIn, user: signedIn ? fixtureUser : null });
    if ((m = p.match(/^\/api\/content\/songs\/(\d+)\/ugc$/))) return intercepted.push(p), json(fixtureUgc(Number(m[1]), Number(url.searchParams.get("difficulty")) || 4));
    if ((m = p.match(/^\/api\/account\/charts\/(\d+)\/(\d)\/ugc\/me$/))) return intercepted.push(p), signedIn ? json(fixtureViewerUgc(Number(m[1]), Number(m[2]))) : json({}, 401);
    if ((m = p.match(/^\/api\/account\/charts\/(\d+)\/(\d)\/ugc\/difficulty$/)) && request.method() === "PUT") {
      const body = request.postDataJSON();
      writes.push({ path: p, method: "PUT", body });
      return json(fixtureViewerUgc(Number(m[1]), Number(m[2]), body.value));
    }
    if ((m = p.match(/^\/api\/account\/chart-tips\/([\w-]+)\/helpful$/)) && request.method() === "PUT") {
      const body = request.postDataJSON();
      writes.push({ path: p, method: "PUT", body });
      return json({ tipId: m[1], enabled: body.enabled, helpfulCount: body.enabled ? 6 : 5 });
    }
    if ((m = p.match(/^\/api\/account\/songs\/(\d+)$/))) return intercepted.push(p), signedIn ? json(Number(m[1]) === IDS.full ? fixtureScores : { items: [] }) : json({}, 401);
    if (p === "/api/forum/threads") return intercepted.push(p), json(fixtureThreads(Number(url.searchParams.get("songId")), Number(url.searchParams.get("difficultyType")) || 4));
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
  const requests = [];
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
  page.on("request", (r) => requests.push(new URL(r.url()).pathname + new URL(r.url()).search));
  return { context, page, faults, warnings, requests, blocked, intercepted, writes, data };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const htmlClasses = (page) => page.evaluate(() => document.documentElement.className.split(/\s+/));
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const detailUrl = (base, lang, id, search = "") => `${base}${lang === "ja" ? "/ja" : ""}/songs/${id}${search}`;
const constantsUrl = (base, lang) => `${base}${lang === "ja" ? "/ja" : ""}/songs/constants`;
const selectedTab = (page) => page.$eval('[role=tab][aria-selected="true"]', (el) => Number(el.dataset.difficulty));
const chartImageSrc = (page) => page.$eval(".sheet img", (img) => new URL(img.src).pathname + new URL(img.src).search);
const ssrText = (html, re) => (html.match(re)?.[1] || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
const tableKeys = (page) =>
  page.$$eval(".ct-table tbody tr", (rows) =>
    rows.map((tr) => {
      const id = tr.querySelector(".c-id")?.textContent.trim();
      const d = tr.querySelector(".c-diff [data-difficulty]")?.getAttribute("data-difficulty");
      return `${id}-${{ 3: "hard", 4: "oni", 5: "edit" }[d]}`;
    })
  );
const waitTable = (page, keys) =>
  page.waitForFunction(
    (expected) => {
      const wrap = document.querySelector(".ct-table-wrap");
      if (!wrap || wrap.classList.contains("is-stale")) return false;
      const got = [...document.querySelectorAll(".ct-table tbody tr")].map((tr) => `${tr.querySelector(".c-id")?.textContent.trim()}-${{ 3: "hard", 4: "oni", 5: "edit" }[tr.querySelector(".c-diff [data-difficulty]")?.getAttribute("data-difficulty")]}`);
      return got.length === expected.length && got.every((v, i) => v === expected[i]);
    },
    keys,
    { timeout: 30000 }
  );
/** Signed-in state for client navigation: the server rendered a guest, so the account state the app already holds is
 *  set to the fixture user (the same state a sign-in writes); the app's own requests then go to the intercepted APIs. */
const injectSignedIn = (page) =>
  page.evaluate((user) => {
    const app = document.getElementById("__nuxt").__vue_app__;
    const nuxt = app.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = user;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, fixtureUser);

// ---------- Scenarios ----------
export async function runDetailScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
  const data = buildDetailData();
  const results = [];
  const timings = { tabSwitchMs: [], routeSwitchMs: [], filterSortMs: [], longTaskMaxMs: 0 };
  const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(out, `${label}_${name}.png`), fullPage });
  async function scenario(name, options, body) {
    if (only && !options.warmUp && !only.split(",").some((prefix) => name.startsWith(prefix))) return;
    const started = Date.now();
    const handle = await openContext(browser, { base, data, ...options });
    try {
      const detail = (await body(handle)) || {};
      if (options.warmUp) return;
      const longTasks = await handle.page.evaluate(() => window.__longTasks || []).catch(() => []);
      timings.longTaskMaxMs = Math.max(timings.longTaskMaxMs, ...longTasks, 0);
      assert.deepEqual(handle.faults, [], "console / hydration faults");
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, intercepted: [...new Set(handle.intercepted)], blockedOrigins: [...handle.blocked], ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}-${options.width}-${options.lang || "zh"}`).catch(() => {});
      results.push({ name, ...options, pass: false, ms: Date.now() - started, error: String(error?.message || error).slice(0, 700), faults: handle.faults.slice(0, 10) });
    } finally {
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }
  await scenario("warm-up", { width: 1440, warmUp: true }, async ({ page }) => {
    for (const path of ["/songs/1", "/songs/constants", "/songs", "/about"]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
  });

  const full = data.songs.find((s) => s.id === IDS.full);
  const v2 = (id, d) => expectedV2Rows(data).find((r) => r.id === id && r.difficulty === d);

  // 1. Detail matrix: SSR = hydrated, rework + Element Plus classes, tabs, no overflow
  const detailShots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-820-light", "zh-360-light", "zh-1440-dark"]);
  for (const lang of ["zh", "ja"])
    for (const theme of ["light", "dark"])
      for (const width of widths)
        await scenario("detail-matrix", { width, theme, lang }, async ({ page, context }) => {
          const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
          const html = await (await fetch(detailUrl(base, lang, IDS.full), { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
          const response = await page.goto(detailUrl(base, lang, IDS.full), { waitUntil: "networkidle" });
          assert.equal(response.status(), 200);
          const h1 = (await page.textContent("h1")).trim();
          assert.equal(h1, lang === "ja" ? full.song_name_jp : full.song_name, "title in the page language");
          assert.equal(ssrText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/), h1, "SSR h1 = hydrated h1");
          assert.match(html, /<html[^>]*class="[^"]*\brework-ep\b/, "server HTML carries rework-ep");
          const cls = await htmlClasses(page);
          assert.ok(cls.includes("viewer-rework") && cls.includes("rework-ep"), cls.join(" "));
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
          assert.equal(await page.locator("[role=tab]").count(), 5);
          assert.equal(await selectedTab(page), 4, "oni by default");
          const oniTab = (await page.locator('[role=tab][data-difficulty="4"]').textContent()).replace(/\s+/g, " ");
          assert.ok(oniTab.includes(v2(1, "oni").mainConstant.toFixed(2)), "tab shows the V2 constant: " + oniTab);
          assert.equal(await page.locator(".v2-body .is-main dd").textContent(), v2(1, "oni").mainConstant.toFixed(2));
          assert.ok(await noOverflow(page), "no horizontal overflow");
          assert.equal(await page.locator("#song-chart-workspace[role=tabpanel]").getAttribute("aria-labelledby"), "song-chart-workspace-tab-4");
          await page.waitForFunction(() => document.querySelector(".sheet img")?.naturalWidth > 0, null, { timeout: 15000 });
          // guest prompt: the side card from 1100 px; below, one row after the chart section and before the data
          assert.equal(await page.locator(".mine").isVisible(), width >= 1100, "side card only where the right column exists");
          assert.equal(await page.locator(".mine-guest").isVisible(), width < 1100, "guest row only below 1100 px");
          if (width < 1100) {
            const order = await page.evaluate(() => {
              const [chart, guest, data] = [".chart", ".mine-guest", ".v2"].map((q) => document.querySelector(q));
              return Boolean(chart.compareDocumentPosition(guest) & 4) && Boolean(guest.compareDocumentPosition(data) & 4);
            });
            assert.ok(order, "chart → guest row → data");
          }
          // the two radars share a row from 1100 px, stacked below
          const [r1, r2] = await page.$$eval(".radars > figure", (els) => els.map((el) => el.getBoundingClientRect().top));
          assert.equal(Math.abs(r1 - r2) < 2, width >= 1100, `radars side by side from 1100 px (${r1}/${r2})`);
          const key = `${lang}-${width}-${theme}`;
          if (detailShots.has(key)) await shot(page, `detail-${key}`, width >= 1440 || key === "zh-390-dark");
        });

  // 2. Difficulty switching: click, keyboard, deep links; the address is not written
  await scenario("detail-difficulty", { width: 1440 }, async ({ page, requests }) => {
    await page.goto(detailUrl(base, "zh", IDS.full), { waitUntil: "networkidle" });
    const urlBefore = page.url();
    const t0 = Date.now();
    await page.locator('[role=tab][data-difficulty="3"]').click();
    await page.waitForFunction(() => document.querySelector(".sheet img")?.src.includes("difficulty=3"));
    timings.tabSwitchMs.push(Date.now() - t0);
    assert.equal(await selectedTab(page), 3);
    assert.equal(await page.locator(".v2-body .is-main dd").textContent(), v2(1, "hard").mainConstant.toFixed(2));
    assert.match(await page.locator(".chart-id").textContent(), /7★/);
    assert.equal(page.url(), urlBefore, "switching does not write the address");
    // keyboard: focus moves with the selection; End = ura, Home = easy, ArrowLeft wraps
    await page.locator('[role=tab][data-difficulty="3"]').focus();
    await page.keyboard.press("End");
    assert.equal(await selectedTab(page), 5);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.difficulty), "5");
    assert.equal(await page.locator(".v2-body .is-main dd").textContent(), v2(1, "edit").mainConstant.toFixed(2));
    await page.keyboard.press("Home");
    assert.equal(await selectedTab(page), 1);
    await page.locator(".v2 > .rw-state").waitFor();
    assert.equal((await page.locator(".v2 > .rw-state .rw-state__title").textContent()).trim(), msg(copy.zh, "rework.songDetail.data.unsupported"), "easy: V2 unsupported");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await selectedTab(page), 5, "ArrowLeft wraps");
    // deep links: ?difficulty=5 → ura; song without ura → oni
    await page.goto(detailUrl(base, "zh", IDS.full, "?difficulty=5"), { waitUntil: "networkidle" });
    assert.equal(await selectedTab(page), 5);
    await page.goto(detailUrl(base, "zh", IDS.noEdit, "?difficulty=5"), { waitUntil: "networkidle" });
    assert.equal(await selectedTab(page), 4, "missing ura falls back to oni");
    assert.equal(await page.locator("[role=tab]").count(), 4);
    return { v2Requests: requests.filter((r) => /\/v2$/.test(r)).length };
  });

  // 3. Every action of the function list (real APIs and files; nothing intercepted here)
  await scenario("detail-actions", { width: 1440 }, async ({ page }) => {
    await page.goto(detailUrl(base, "zh", IDS.full), { waitUntil: "networkidle" });
    // header facts
    const facts = (await page.locator(".facts").textContent()).replace(/\s+/g, " ");
    for (const part of [full.artists.join(" / "), "BPM", full.bpm, "2024-02-02", "ID", "1", full.subtitle]) assert.ok(facts.includes(part), `fact ${part}: ${facts}`);
    assert.equal((await page.locator(".other-name").getAttribute("lang")), "ja");
    assert.deepEqual(await page.$$eval(".rw-head__eyebrow .tag", (els) => els.map((e) => e.textContent.trim())), [msg(copy.zh, "rework.library.shelf.available"), "v1", "nijiiro"]);
    // the shell's back button is the only way back (no remembered library location → by list=); no in-page link
    assert.equal(await page.locator(".back-link").count(), 0);
    assert.equal(await page.locator(".rework-bar a.back").getAttribute("href"), "/songs");
    // chart actions
    assert.equal(await page.locator(".chart-actions a", { hasText: msg(copy.zh, "rework.songDetail.chart.practice") }).getAttribute("href"), "/ourtaikoview/1/4");
    assert.equal(await page.locator(".chart-actions a", { hasText: msg(copy.zh, "rework.songDetail.chart.practice") }).getAttribute("target"), "_blank");
    const open = await page.locator(".chart-actions a", { hasText: msg(copy.zh, "rework.songDetail.chart.open") }).getAttribute("href");
    assert.equal(open, "/api/content/songs/1/chart-image?difficulty=4&side=single");
    const image = await fetch(base + open);
    assert.equal(image.headers.get("content-type"), "image/png");
    const download = await page.locator(".chart-actions a", { hasText: msg(copy.zh, "rework.songDetail.chart.download") }).getAttribute("href");
    assert.equal(download, "/api/content/songs/1/tja-package");
    const zip = await fetch(base + download);
    assert.equal(zip.status, 200);
    assert.equal(zip.headers.get("content-type"), "application/zip");
    await zip.arrayBuffer();
    assert.match(await page.locator(".chart-id").textContent(), new RegExp(String(full.max_combo[3])), "max notes from the catalog");
    // excerpt expand / collapse
    const toggle = page.locator(".sheet-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.ok(await page.locator(".sheet.is-expanded").count());
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    // audio: branch variants for oni, mute toggles, volume
    await page.locator(".audio summary").click();
    const variants = await page.$$eval(".variant-label", (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(variants.slice(0, 2), ["普通", "玄人／达人"]);
    const mute = page.locator(".volume button");
    await mute.click();
    assert.equal((await mute.textContent()).trim(), msg(copy.zh, "rework.songDetail.audio.unmute"));
    await page.locator(".volume-slider").fill("0.5");
    assert.match(await page.locator(".volume .num").textContent(), /50%/);
    // RT calculator and V2 source
    assert.equal(await page.locator(".more", { hasText: msg(copy.zh, "tools.rtCalculator") }).getAttribute("href"), "/tools/rt-calculator?songId=1&level=4");
    assert.equal(await page.locator("figcaption a").getAttribute("href"), "https://github.com/OurTaiko/Constants");
    // six-dimension radar with range and level
    assert.ok(await page.locator(".shape svg.ds-radar").count());
    assert.match(await page.locator(".shape-meta").textContent(), /0–50/);
    // signed out: the sign-in prompt sends back here with the difficulty
    const login = new URL(base + (await page.locator(".mine .rw-gate a").getAttribute("href")));
    assert.equal(login.pathname, "/account/login");
    assert.equal(login.searchParams.get("redirect"), "/songs/1?difficulty=4");
    // related discussions (server rendered without the database: empty + compose link)
    assert.ok(await page.locator(".related-discussions__compose").count());
    await shot(page, "detail-actions-audio-open-zh-1440-light", true);
  });

  // 4. Sides, removed / other / sparse songs, canonical id
  await scenario("detail-variants", { width: 1440 }, async ({ page }) => {
    await page.goto(detailUrl(base, "zh", IDS.sides), { waitUntil: "networkidle" });
    const seg = page.locator(".seg button");
    assert.deepEqual(await seg.allTextContents(), [msg(copy.zh, "rework.songDetail.side.single"), "P1", "P2"]);
    await seg.nth(1).click();
    await page.waitForFunction(() => document.querySelector(".sheet img")?.src.includes("side=p1"));
    assert.match(await page.locator(".chart-id").textContent(), /9★[\s\S]*—/, "P1 star 9, notes —");
    assert.ok((await page.locator('[role=tab][data-difficulty="4"]').textContent()).includes("★9"));
    await seg.nth(2).click();
    assert.ok((await page.locator('[role=tab][data-difficulty="4"]').textContent()).includes("★10"), "tab star follows the side");
    assert.equal(await page.locator(".chart-actions a", { hasText: msg(copy.zh, "rework.songDetail.chart.practice") }).count(), 0, "no TJA bundle → no practice link");
    await shot(page, "detail-sides-p2-zh-1440-light");
    // removed → list=removed added (replace)
    await page.goto(detailUrl(base, "zh", IDS.removed), { waitUntil: "networkidle" });
    await page.waitForURL(/\/songs\/3\?list=removed$/);
    assert.equal(await page.locator(".rework-bar a.back").getAttribute("href"), "/songs?shelf=removed");
    assert.equal((await page.locator(".shape .rw-state__title").textContent()).trim(), msg(copy.zh, "rework.songDetail.shape.empty"));
    // other without rating values → no six-dimension block
    await page.goto(detailUrl(base, "zh", IDS.other), { waitUntil: "networkidle" });
    // slice G: like removed songs, an "other" song adds list=other, so the shell back returns to its shelf
    await page.waitForURL(/\/songs\/4\?list=other$/);
    assert.equal(await page.locator(".shape").count(), 0);
    assert.equal(await page.locator(".rework-bar a.back").getAttribute("href"), "/songs?shelf=other", "other song: back to /songs?shelf=other");
    // sparse: suffix stays together, missing facts are "—", no image → failed image state, no V2
    await page.goto(detailUrl(base, "zh", IDS.sparse), { waitUntil: "networkidle" });
    assert.equal(await page.locator(".title-suffix").textContent(), "(Long Version)");
    assert.equal(await page.locator(".other-name").count(), 0);
    assert.match((await page.locator(".facts").textContent()).replace(/\s+/g, " "), /—BPM—/);
    await page.locator(".sheet-state", { hasText: msg(copy.zh, "rework.songDetail.chart.failed") }).waitFor();
    assert.equal((await page.locator(".v2 > .rw-state .rw-state__title").textContent()).trim(), msg(copy.zh, "rework.songDetail.data.empty"));
    assert.ok(await noOverflow(page));
    await page.setViewportSize({ width: 360, height: 800 });
    assert.ok(await noOverflow(page), "360: no overflow with the long title");
    await shot(page, "detail-sparse-zh-360-light", true);
    // canonical id: raw 301
    const legacy = await fetch(base + "/songs/99?difficulty=3", { redirect: "manual" });
    assert.equal(legacy.status, 301);
    assert.match(legacy.headers.get("location") || "", /\/songs\/100\?difficulty=3$/);
  });

  // 5. States: missing song, loading skeleton (delayed), failure + retry (client, intercepted)
  await scenario("detail-states", { width: 1440 }, async ({ page }) => {
    await page.goto(detailUrl(base, "zh", 999), { waitUntil: "networkidle" });
    assert.equal((await page.locator(".sd-state .rw-state__title").textContent()).trim(), msg(copy.zh, "rework.songDetail.missing"));
    assert.equal(await page.locator(".sd-state a").getAttribute("href"), "/songs");
    await shot(page, "detail-missing-zh-1440-light");
    // failure (client navigation, intercepted 500) → retry while the request is held (loading skeleton) → content
    let mode = "fail";
    let release;
    await page.route("**/api/content/songs/2", async (route) => {
      if (mode === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      if (mode === "delay") await new Promise((r) => (release = r));
      return route.continue();
    });
    const t0 = Date.now();
    await push(page, "/songs/2");
    await page.locator('.sd-state[role="alert"]').waitFor();
    timings.routeSwitchMs.push(Date.now() - t0);
    await shot(page, "detail-failed-zh-1440-light");
    mode = "delay";
    await page.locator(".sd-state button", { hasText: msg(copy.zh, "rework.state.retry") }).click();
    await page.locator(".sd-loading[role=status]").waitFor();
    await shot(page, "detail-loading-zh-1440-light");
    while (!release) await page.waitForTimeout(50);
    release();
    await page.locator("h1", { hasText: "合成曲目 2" }).waitFor();
    // V2 failure + retry inside the data section
    let v2Fail = true;
    await page.route("**/api/content/songs/6/v2", (route) => (v2Fail ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue()));
    await push(page, "/songs/6");
    await page.locator('.v2 > [role="alert"]').waitFor();
    v2Fail = false;
    await page.locator(".v2 > .rw-state button", { hasText: msg(copy.zh, "rework.state.retry") }).click();
    await page.locator(".v2-body .is-main dd").waitFor();
    assert.equal(await page.locator(".v2-body .is-main dd").textContent(), v2(6, "oni").mainConstant.toFixed(2));
  });

  // 6. Signed in (intercepted + account state set as a sign-in would): score panel, other difficulties, UGC, threads
  for (const [width, lang, theme] of [[1440, "zh", "light"], [390, "zh", "dark"], [390, "ja", "light"]])
    await scenario("detail-signed-in-intercepted", { width, lang, theme, signedIn: true }, async ({ page, writes }) => {
      await page.goto(detailUrl(base, lang, IDS.sides), { waitUntil: "networkidle" });
      await injectSignedIn(page);
      await push(page, (lang === "ja" ? "/ja" : "") + "/songs/1?difficulty=4&recommendation=selfcheck-token");
      await page.locator(".mine .record").waitFor();
      const record = page.locator(".mine .record");
      const crown = (await record.locator(".ds-crown__text").textContent()).trim();
      assert.equal(crown, msg(copy[lang], "ds.crown.dondaful"), "crown has visible text (P1)");
      assert.ok((await record.locator(".ds-rank__name").textContent()).trim().length > 0, "rank name beside the image");
      assert.equal(await record.locator(".ds-rank__mark").getAttribute("aria-hidden"), "true");
      assert.match((await record.locator(".score b").textContent()).replace(/\D/g, ""), /^1003210$/);
      assert.equal(await record.locator(".ds-judge__legend dd").count(), 3);
      const others = page.locator(".mine .other");
      assert.equal(await others.count(), 2);
      assert.ok((await others.nth(0).locator(".ds-crown__text").textContent()).trim().length > 0, "short crown name in the list");
      assert.equal(await page.locator(".mine a.all").getAttribute("href"), (lang === "ja" ? "/ja" : "") + "/account/songs");
      assert.ok(await page.locator(".recommendation-goal-action button").count(), "goal action with ?recommendation= on the requested difficulty");
      await page.locator("#chart-ugc").waitFor();
      await page.locator(".related-discussions__list li").first().waitFor();
      assert.equal(await page.locator(".related-discussions__list li").count(), 2);
      assert.ok(await noOverflow(page));
      await shot(page, `detail-signed-in-intercepted-${lang}-${width}-${theme}`, width >= 1440);
      // choose another difficulty from the list: tabs, panel and UGC follow
      await others.nth(0).click();
      assert.equal(await selectedTab(page), 3);
      await page.locator(".mine .record .ds-crown.is-played").waitFor();
      assert.equal(await page.locator(".recommendation-goal-action").count(), 0, "goal action only on the requested difficulty");
      if (width !== 1440) return;
      // UGC: vote, helpful (writes intercepted), tag editor opens
      await page.locator('[role=tab][data-difficulty="4"]').click();
      await page.locator(".ugc-choice").nth(3).click();
      await page.waitForFunction(() => document.querySelectorAll('.ugc-choice[aria-checked="true"]').length === 1);
      await page.locator(".ugc-helpful").first().click();
      await page.locator('.ugc-helpful[aria-pressed="true"]').waitFor();
      const tagToggle = page.locator('button[aria-controls="ugc-tag-editor"]');
      await tagToggle.click();
      assert.equal(await tagToggle.getAttribute("aria-expanded"), "true");
      assert.ok(await page.locator('.ugc-chip[aria-pressed="true"]').count());
      await shot(page, "detail-ugc-intercepted-zh-1440-light", true);
      return { writes };
    });

  // 7. Keyboard focus order (signed out, 1440): the selected tab only, score panel, chart controls, data, more
  await scenario("detail-focus-order", { width: 1440 }, async ({ page }) => {
    await page.goto(detailUrl(base, "zh", IDS.sides), { waitUntil: "networkidle" });
    await page.locator("#viewer-main").focus();
    const stops = [];
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement === document.body)) break; // past the last stop
      stops.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          const cls = el.className && typeof el.className === "string" ? el.className.split(" ")[0] : "";
          const outline = getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none";
          return { tag: el.tagName, role: el.getAttribute("role") || "", cls, text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24), visible: outline };
        })
      );
    }
    const at = (pred) => stops.findIndex(pred);
    const tab = at((s) => s.role === "tab");
    const login = at((s) => s.text === msg(copy.zh, "rework.gate.login"));
    const side = at((s) => s.text === "P1" || s.text === msg(copy.zh, "rework.songDetail.side.single"));
    const open = at((s) => s.text.startsWith(msg(copy.zh, "rework.songDetail.chart.open")));
    const sheet = at((s) => s.role === "region");
    assert.ok(tab >= 0 && login > tab && side > login && open > side && sheet > open, JSON.stringify(stops.map((s) => s.text || s.role || s.tag)));
    assert.equal(stops.filter((s) => s.role === "tab").length, 1, "one tab stop (roving tabindex)");
    assert.ok(stops.every((s) => s.visible), "focus indicator on every stop: " + JSON.stringify(stops.map((s) => [s.tag, s.text, s.visible])));
    return { stops: stops.map((s) => s.text || s.role || s.tag) };
  });

  // 8. Library → detail → back restores the library (shared files touched by this slice)
  await scenario("library-detail-return", { width: 1440 }, async ({ page, requests }) => {
    await page.goto(base + "/songs?shelf=all&page=2", { waitUntil: "networkidle" });
    const ids = await page.$$eval(".rows > li .row-link", (links) => links.map((a) => a.getAttribute("href")));
    await page.locator(".rows > li .row-link").nth(5).click();
    await page.waitForURL(/\/songs\/\d+/);
    await page.waitForFunction(() => /\/songs\?shelf=all&page=2$/.test(document.querySelector(".rework-bar a.back")?.getAttribute("href") || ""));
    const before = requests.filter((r) => r.startsWith("/api/content/songs?")).length;
    await page.goBack();
    await page.waitForURL(/\/songs\?shelf=all&page=2$/);
    await page.waitForFunction((n) => document.querySelectorAll(".rows:not(.is-stale) > li .row-link").length === n, ids.length);
    assert.deepEqual(await page.$$eval(".rows > li .row-link", (links) => links.map((a) => a.getAttribute("href"))), ids);
    assert.equal(requests.filter((r) => r.startsWith("/api/content/songs?")).length, before, "no refetch on return");
    await page.locator(".rows > li .row-link").nth(5).click();
    await page.waitForURL(/\/songs\/\d+/);
    await page.locator(".rework-bar a.back").click();
    await page.waitForURL(/\/songs\?shelf=all&page=2$/);
  });

  // 9. Element Plus mapping: on for flagged pages (SSR and client), off after leaving (also kept alive), teleports
  // Slice G: the page without the mapping is /annual (out of scope); every reworked page has it by default.
  await scenario("element-plus-switch", { width: 820 }, async ({ page }) => {
    // /annual renders only for phones (middleware/annual-mobile.global.ts; a desktop browser is sent to the home page),
    // so this page presents itself as one; the shell and the reworked pages do not depend on the user agent.
    await page.setExtraHTTPHeaders({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await page.addInitScript((ua) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua }), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    const probe = () =>
      page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const tmp = document.createElement("div");
        tmp.innerHTML = '<div class="el-message probe-msg"></div><div class="el-popper is-dark probe-tip"></div><div class="el-select-dropdown probe-dd"></div>';
        document.body.append(tmp);
        const msg = getComputedStyle(tmp.querySelector(".probe-msg")).getPropertyValue("--el-message-bg-color").trim();
        const tip = getComputedStyle(tmp.querySelector(".probe-tip")).backgroundColor;
        const dd = getComputedStyle(tmp.querySelector(".probe-dd")).backgroundColor;
        tmp.remove();
        return { cls: document.documentElement.className, primary: root.getPropertyValue("--el-color-primary").trim(), msg, tip, dd, action: root.getPropertyValue("--action-bg").trim(), overlay: root.getPropertyValue("--overlay-bg").trim() };
      });
    const popups = () => page.$$eval(".el-overlay, .el-select-dropdown, .el-popper, .el-dialog", (els) => els.map((el) => String(el.className)).sort());
    await page.goto(base + "/annual", { waitUntil: "networkidle" });
    const baseline = await probe();
    const baselinePopups = await popups();
    assert.ok(!baseline.cls.includes("rework-ep"), "unflagged page: no rework-ep");
    await push(page, "/songs/constants");
    await page.locator(".ct-table").waitFor();
    const inside = await probe();
    assert.ok(inside.cls.includes("rework-ep"), "client entry: rework-ep");
    assert.notEqual(inside.primary, baseline.primary, "primary differs from production");
    assert.ok(inside.primary.includes("action-bg") || inside.primary === inside.action, `primary is the brand action colour: ${inside.primary} / ${inside.action}`);
    assert.notEqual(inside.msg, baseline.msg, "message colours remapped");
    assert.notEqual(inside.tip, baseline.tip, "dark tooltip remapped to the overlay level");
    // real teleports: the page size select (dropdown in <body>) and the inspector dialog
    await page.locator(".ct-size-select").click();
    const dropdown = page.locator(".el-select-dropdown").last();
    await dropdown.waitFor();
    const ddBg = await dropdown.evaluate((el) => getComputedStyle(el.closest(".el-popper") || el).backgroundColor);
    assert.equal(ddBg, inside.dd, "teleported dropdown uses the mapped overlay");
    await page.keyboard.press("Escape");
    await page.locator(".ct-table tbody tr .row-btn").nth(2).click();
    const dialog = page.locator(".el-dialog.ct-dialog");
    await dialog.waitFor();
    const dlgBg = await dialog.evaluate((el) => getComputedStyle(el).getPropertyValue("--el-dialog-bg-color").trim());
    assert.ok(dlgBg.length > 0, "dialog mapped");
    assert.match(await dialog.locator(".insp a").first().getAttribute("href"), /^\/songs\/\d+\?difficulty=[345]$/);
    await page.waitForFunction(() => { const d = document.querySelector(".el-dialog.ct-dialog"); return d && getComputedStyle(d.closest(".el-overlay") || d).opacity === "1" && !(d.closest(".el-overlay")?.getAnimations?.().length); });
    await shot(page, "constants-dialog-zh-820-light");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".el-dialog.ct-dialog"));
    // leave to an unflagged page (constants stays kept alive): class gone, styles back, no popup nodes left
    await push(page, "/annual");
    await page.waitForURL(/\/annual$/);
    const after = await probe();
    assert.ok(!after.cls.includes("rework-ep"), "leave: rework-ep removed");
    assert.equal(after.primary, baseline.primary, "leave: production primary again");
    assert.equal(after.msg, baseline.msg);
    // Popups in the document after leaving = the ones an unflagged page has anyway (an existing hidden overlay)
    assert.deepEqual(await popups(), baselinePopups, "no popup nodes of the constants page left behind");
    // keepalive return
    await page.goBack();
    await page.waitForURL(/\/songs\/constants$/);
    await page.locator(".ct-table").waitFor();
    assert.ok((await probe()).cls.includes("rework-ep"), "keepalive return: rework-ep restored");
    // flagged → flagged (detail), then the library (slice G: mapped like every reworked page)
    await page.locator(".ct-table tbody tr .row-btn").first().click();
    await page.locator(".el-dialog.ct-dialog .insp a").first().click();
    await page.waitForURL(/\/songs\/\d+\?difficulty=\d$/);
    assert.ok((await probe()).cls.includes("rework-ep"));
    await push(page, "/songs");
    await page.locator(".rows").waitFor();
    assert.ok((await probe()).cls.includes("rework-ep"), "library has the mapping too (slice G default)");
    return { baselinePrimary: baseline.primary, flaggedPrimary: inside.primary };
  });

  // 10. Constants matrix
  const first = expectedConstants(data);
  const constantShots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-820-light", "zh-360-light", "zh-1440-dark"]);
  for (const lang of ["zh", "ja"])
    for (const theme of ["light", "dark"])
      for (const width of widths)
        await scenario("constants-matrix", { width, theme, lang }, async ({ page, context }) => {
          const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
          const html = await (await fetch(constantsUrl(base, lang), { headers: { cookie }, signal: AbortSignal.timeout(60000) })).text();
          await page.goto(constantsUrl(base, lang), { waitUntil: "networkidle" });
          await waitTable(page, first.keys);
          assert.equal((html.match(/<tr class="[^"]*"/g) || []).length, first.keys.length, "SSR rows");
          assert.ok((await htmlClasses(page)).includes("rework-ep"));
          assert.equal((await page.locator(".ct-meta [role=status]").textContent()).trim(), msg(copy[lang], "page.songs.v2Constants.summary", { total: first.total }));
          assert.ok(await noOverflow(page), "no horizontal overflow");
          assert.ok((await page.locator(".ct-table tbody tr").count()) <= 60);
          // generation time: fixed UTC text in the server HTML, local date and time to the minute after mount
          assert.match(html, /<time[^>]*datetime="[^"]+"[^>]*>\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC<\/time>/, "SSR: fixed UTC text");
          const stamp = (await page.locator(".ct-meta time").textContent()).trim();
          assert.match(stamp, /\d{2}:\d{2}$/);
          assert.ok(!/[TZ]|UTC|\.\d{3}/.test(stamp), "local time after mount: " + stamp);
          const headerVisible = await page.locator(".ct-table thead").isVisible();
          assert.equal(headerVisible, width >= 768, "table header from 768 px");
          assert.equal(await page.locator(".ct-aside").isVisible(), width >= 1240, "inspector column from 1240 px");
          const key = `${lang}-${width}-${theme}`;
          if (constantShots.has(key)) await shot(page, `constants-${key}`);
        });

  // 11. Constants: filters, sort, paging, page size, jump, inspector, empty, failure, stale
  await scenario("constants-functions", { width: 1440 }, async ({ page }) => {
    await page.goto(constantsUrl(base, "zh"), { waitUntil: "networkidle" });
    await waitTable(page, first.keys);
    // difficulty filter
    let t0 = Date.now();
    await page.locator(".seg").getByRole("button", { name: msg(copy.zh, "difficulty.4"), exact: true }).click();
    await waitTable(page, expectedConstants(data, { difficulty: "oni" }).keys);
    timings.filterSortMs.push(Date.now() - t0);
    // sort by main constant: descending first, then ascending
    t0 = Date.now();
    await page.locator("th.c-main button").click();
    await waitTable(page, expectedConstants(data, { difficulty: "oni", sortBy: "mainConstant", sortOrder: "desc" }).keys);
    timings.filterSortMs.push(Date.now() - t0);
    assert.equal(await page.locator("th.c-main").getAttribute("aria-sort"), "descending");
    await page.locator("th.c-main button").click();
    await waitTable(page, expectedConstants(data, { difficulty: "oni", sortBy: "mainConstant", sortOrder: "asc" }).keys);
    // keyword (debounced) on top
    await page.locator(".ct-search input").fill("合成曲目 1");
    await waitTable(page, expectedConstants(data, { keyword: "合成曲目 1", difficulty: "oni", sortBy: "mainConstant", sortOrder: "asc" }).keys);
    // clear filters
    await page.locator(".ct-tools .rw-btn", { hasText: msg(copy.zh, "rework.constantsTable.clear") }).click();
    await waitTable(page, expectedConstants(data, { sortBy: "mainConstant", sortOrder: "asc" }).keys);
    // paging: next, jump, page size (teleported select)
    await page.locator("th.c-id button").click();
    await waitTable(page, first.keys);
    await page.locator(".pager .pg-next").click();
    await waitTable(page, expectedConstants(data, { page: 2 }).keys);
    await page.locator("#ct-jump-input").fill("3");
    await page.locator(".ct-jump button").click();
    await waitTable(page, expectedConstants(data, { page: 3 }).keys);
    await page.locator(".ct-size-select").click();
    await page.locator(".el-select-dropdown__item", { hasText: msg(copy.zh, "rework.constantsTable.pageSizeOption", { n: 25 }) }).click();
    await waitTable(page, expectedConstants(data, { pageSize: 25 }).keys);
    // inspector column: second row; links to detail (with difficulty) and RT calculator
    const second = expectedConstants(data, { pageSize: 25 }).rows[1];
    await page.locator(".ct-table tbody tr .row-btn").nth(1).click();
    assert.equal(await page.locator(".ct-table tbody tr .row-btn").nth(1).getAttribute("aria-pressed"), "true");
    const links = await page.$$eval(".ct-aside .acts a", (els) => els.map((a) => a.getAttribute("href")));
    assert.deepEqual(links, [`/songs/${second.id}?difficulty=${DIFF[second.difficulty]}`, `/tools/rt-calculator?songId=${second.id}&level=${DIFF[second.difficulty]}`]);
    assert.match(await page.locator(".ct-aside .scale").getAttribute("aria-label"), new RegExp(second.mainConstant.toFixed(2)));
    await shot(page, "constants-inspector-zh-1440-light");
    // empty with the clear action
    await page.locator(".ct-search input").fill("zzqx-none");
    await page.locator(".rw-state", { hasText: msg(copy.zh, "page.songs.v2Constants.empty") }).waitFor();
    await shot(page, "constants-empty-zh-1440-light");
    await page.locator(".rw-state .rw-btn", { hasText: msg(copy.zh, "rework.constantsTable.clear") }).click();
    await waitTable(page, expectedConstants(data, { pageSize: 25 }).keys);
    // failure + retry (intercepted), then a stale snapshot notice (intercepted)
    let mode = "fail";
    await page.route("**/api/content/v2-constants?**", async (route) => {
      if (mode === "fail") return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      if (mode === "stale") {
        const real = await route.fetch();
        const body = await real.json();
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...body, stale: true }) });
      }
      return route.continue();
    });
    await page.locator(".seg").getByRole("button", { name: msg(copy.zh, "difficulty.3"), exact: true }).click();
    await page.locator('.rw-state[role="alert"]').waitFor();
    await shot(page, "constants-failed-zh-1440-light");
    mode = "stale";
    await page.locator('.rw-state[role="alert"] button').click();
    await waitTable(page, expectedConstants(data, { pageSize: 25, difficulty: "hard" }).keys);
    assert.equal((await page.locator(".ct-notice").textContent()).trim(), msg(copy.zh, "page.songs.v2Constants.stale"));
  });

  // 12. Constants on a phone: sort select + direction, dialog inspector
  await scenario("constants-phone", { width: 390, theme: "dark" }, async ({ page }) => {
    await page.goto(constantsUrl(base, "zh"), { waitUntil: "networkidle" });
    await waitTable(page, first.keys);
    await page.locator("#ct-sort").selectOption("stamina");
    await waitTable(page, expectedConstants(data, { sortBy: "stamina", sortOrder: "desc" }).keys);
    assert.match(await page.locator(".ct-table tbody tr").first().locator(".c-sorted").textContent(), new RegExp(msg(copy.zh, "page.songs.v2Constants.columns.stamina")));
    await page.locator(".ct-dir").click();
    await waitTable(page, expectedConstants(data, { sortBy: "stamina", sortOrder: "asc" }).keys);
    assert.ok(await noOverflow(page));
    await page.locator(".ct-table tbody tr .row-btn").first().click();
    await page.locator(".el-dialog.ct-dialog").waitFor();
    assert.ok(await noOverflow(page));
    await page.waitForFunction(() => { const d = document.querySelector(".el-dialog.ct-dialog"); return d && getComputedStyle(d.closest(".el-overlay") || d).opacity === "1" && !(d.closest(".el-overlay")?.getAnimations?.().length); });
    await shot(page, "constants-dialog-zh-390-dark");
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length, constantSongs: CONSTANT_SONGS };
}

// ---------- SSR failure (real: the song data file is made unreadable for the request) ----------
export async function detailSsrFailureCheck({ browser, base, out, breakData, restoreData, label = "self-check" }) {
  const copy = await locales(webRoot);
  await breakData();
  const handle = await openContext(browser, { base, width: 1440 });
  const { page } = handle;
  try {
    const html = await (await fetch(base + "/songs/1", { signal: AbortSignal.timeout(60000) })).text();
    assert.match(html, /class="[^"]*\bsd-state\b[^"]*"[^>]*role="alert"/, "server rendered the failed state");
    await page.goto(base + "/songs/1", { waitUntil: "networkidle" });
    await page.locator('.sd-state[role="alert"]').waitFor();
    assert.deepEqual(handle.faults, [], "hydrates without warnings or errors");
    await page.screenshot({ path: resolve(out, `${label}_detail-ssr-failed-zh-1440-light.png`) });
    await restoreData();
    await page.locator(".sd-state button", { hasText: msg(copy.zh, "rework.state.retry") }).click();
    await page.locator("h1", { hasText: "合成曲目 1" }).waitFor();
    assert.deepEqual(handle.faults, []);
    return { name: "detail-ssr-api-failure", pass: true };
  } catch (error) {
    await restoreData().catch(() => {});
    await page.screenshot({ path: resolve(out, `${label}_FAILED-detail-ssr.png`) }).catch(() => {});
    return { name: "detail-ssr-api-failure", pass: false, error: String(error?.message || error).slice(0, 600), faults: handle.faults };
  } finally {
    await page.close().catch(() => {});
    await handle.context.close().catch(() => {});
  }
}
