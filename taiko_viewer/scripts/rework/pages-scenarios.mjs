// Slice F scenarios: /grade (2023 – 2026), /guide, /titles, /tools/* (chart-config, note-count, rt-calculator,
// tja-constants, word-cloud), /more, /about, /alias-log, /ourtaikoview/:id/:difficulty, and the shell's 曲库 / 工具 tabs.
// Environment independent; used by
//   - scripts/rework/pages-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=pages (to be added; see stage-5-progress.md "切片 F")
// Real here: every page's server render and hydration; the dan data (bundled JSON), the song catalogue, the tools'
// APIs and the alias log over synthetic files (pages-data.mjs); the title catalogue and the guide source through the
// real server code with a synthetic local upstream. Intercepted in the browser and labelled so: the signed-in word cloud
// (auth/me and the image endpoint) and one guide tag read failing. The browser never leaves the base origin.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import { accountUser } from "./account-fixtures.ts";
import { DAN_SONGS, titleCatalog } from "./pages-data.mjs";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  String(key.split(".").reduce((o, k) => o?.[k], messages) ?? `[[${key}]]`).replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
const PNG = stripedPng(480, 320, 5);
const prefix = (lang) => (lang === "ja" ? "/ja" : "");
const enc = (s) => encodeURI(s);

export async function openContext(browser, { base, width, theme = "light", lang = "zh", height }) {
  const context = await browser.newContext({ viewport: { width, height: height || (width < 500 ? 844 : 900) }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const state = { signedIn: false, user: accountUser(), wordCloud: 200, guideTagFail: false };
  const blocked = new Set();
  const outbound = [];
  const intercepted = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      if (request.isNavigationRequest()) outbound.push(url.href);
      return route.abort();
    }
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/account/auth/me") {
      intercepted.push(p);
      return json({ authenticated: state.signedIn, user: state.signedIn ? state.user : null });
    }
    if (p === "/api/account/charts/word-cloud") {
      intercepted.push(p);
      if (!state.signedIn) return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
      if (state.wordCloud === 200) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
      const messages = { 400: "请先绑定鼓众 ID", 404: "未找到本地成绩数据，请先在「多端同步」更新数据", 500: "服务暂时不可用" };
      return json({ statusCode: state.wordCloud, statusMessage: messages[state.wordCloud] }, state.wordCloud);
    }
    if (state.guideTagFail && /^\/api\/content\/guide\/\d+\/\d+\/tag\/\d+$/.test(p)) {
      intercepted.push(p);
      return json({ statusCode: 502, statusMessage: "upstream" }, 502);
    }
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
  page.setDefaultNavigationTimeout(120000);
  const faults = [];
  const warnings = [];
  const devRelay = [];
  const environment = [];
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
    // Nuxt dev relays server-side logs to the browser console ("ssr:error" for a server request that failed on purpose,
    // e.g. the upstream switched off); the practice player's runtime is not built on this machine. Both are recorded.
    if (/^%cssr:/.test(text)) devRelay.push(text.slice(0, 160));
    else if (/ourtaikoview-runtime|practice-player/.test(text)) environment.push(text.slice(0, 200));
    else if (/hydration/i.test(text)) faults.push("hydration: " + text.slice(0, 300));
    else if (m.type() === "error" && !(origin !== base || /Failed to load resource|ERR_FAILED|net::/.test(text))) faults.push("console: " + text.slice(0, 300));
    else if (m.type() === "warning" && /\[Vue warn\]/.test(text)) warnings.push(text.slice(0, 200));
  });
  const progress = { at: "" };
  return { context, page, faults, warnings, devRelay, environment, blocked, outbound, intercepted, state, step: (name) => (progress.at = name), progress };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const htmlClasses = (page) => page.evaluate(() => document.documentElement.className.split(/\s+/));
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const hydrated = (page) => page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__));
async function go(page, lang, path) {
  const target = `${prefix(lang)}${path}`;
  await push(page, target);
  const bare = decodeURI(target.split(/[?#]/)[0]);
  await page.waitForURL((u) => decodeURI(u.pathname) === bare);
}
const injectSignedIn = (page, user) =>
  page.evaluate((u) => {
    const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = u;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, user);
const touchTargets = (page) =>
  page.$$eval(
    "#viewer-main .rw-btn, #viewer-main .rw-seg > *, #viewer-main .dan-years a, #viewer-main .dan-rail a, #viewer-main .gi-level, #viewer-main .gl-levels a, #viewer-main .gl-tag__toggle, #viewer-main .mh-link, #viewer-main .dan-tabs button, #viewer-main .rte-chip, #viewer-main .pg-step, #viewer-main .practice-back",
    (els) => els.filter((el) => el.getClientRects().length).map((el) => ({ text: el.textContent.trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44)
  );
const h1Text = (page) => page.locator("#viewer-main h1").first().evaluate((el) => el.textContent.replace(/\s+/g, " ").trim());

/** Every page of the slice with a "ready" selector (after hydration). */
export const PAGES = [
  ["/grade/2026/%E4%B9%9D%E6%AE%B5", ".dan-songs"],
  ["/grade/2025/%E4%BA%94%E7%B4%9A", ".dan-songs"],
  ["/grade/2024", ".dan-songs"],
  ["/grade/2023", ".dan-songs"],
  ["/guide", ".gi-rows"],
  ["/guide/4/10", ".gl-tags"],
  ["/titles", ".tl-table"],
  ["/tools/chart-config", "#viewer-main form"],
  ["/tools/note-count", "#viewer-main form"],
  ["/tools/rt-calculator?songId=1&level=4", "#rt-good"],
  ["/tools/tja-constants", ".drop-zone"],
  ["/tools/word-cloud", ".rw-gate"],
  ["/more", ".more-hub"],
  ["/about", ".ab"],
  ["/alias-log", ".at-table"],
  ["/ourtaikoview/1/4", ".practice-controls"]
];

export async function runPagesScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "", prepared }) {
  const copy = await locales(web);
  const zh = copy.zh;
  const results = [];
  const timings = { longTaskMaxMs: 0, routeSwitchMs: [], filterMs: [] };
  const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(out, `${label}_${name}.png`), fullPage });
  const upstream = prepared?.upstream;
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
      assert.deepEqual(handle.outbound, [], "no navigation off the base origin");
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, warningsSample: handle.warnings.slice(0, 3), intercepted: [...new Set(handle.intercepted)].slice(0, 20), blockedOrigins: [...handle.blocked], devServerLogRelay: handle.devRelay.length, environmentMessages: handle.environment.slice(0, 3), ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}-${options.width}-${options.lang || "zh"}-${options.theme || "light"}`).catch(() => {});
      const main = await handle.page.evaluate(() => (document.querySelector("#viewer-main")?.innerHTML || "").slice(0, 1500)).catch(() => "");
      results.push({ name, ...options, pass: false, ms: Date.now() - started, step: handle.progress.at, error: String(error?.message || error).slice(0, 900), faults: handle.faults.slice(0, 10), warnings: handle.warnings.slice(0, 5), main });
    } finally {
      upstream?.setUpstream({ titles: "ok", guide: "ok" });
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }
  const raw = async (path, lang = "zh") => {
    const response = await fetch(`${base}${prefix(lang)}${path}`, { headers: { cookie: `viewer_locale=${lang}` }, redirect: "manual", signal: AbortSignal.timeout(120000) });
    const html = response.status === 200 ? (await response.text()).replace(/<!--[\s\S]*?-->/g, "") : "";
    return { status: response.status, location: response.headers.get("location"), html };
  };

  await scenario("warm-up", { width: 1440, warmUp: true }, async ({ page }) => {
    for (const [path, ready] of PAGES) {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 240000 });
      await page.locator(ready).first().waitFor({ timeout: 120000 });
    }
  });

  // 1. Redirects and the real server render (zh / ja): content in the server HTML, one h1, the Element Plus switch
  for (const lang of ["zh", "ja"])
    await scenario("ssr", { width: 1440, lang }, async ({ page }) => {
      const m = copy[lang];
      const P = prefix(lang);
      const redirects = [
        ["/grade", 302, `${P}/grade/2026`],
        ["/grade/2026", 302, `${P}/grade/2026/${enc("五級")}`],
        ["/grade/2025", 302, `${P}/grade/2025/${enc("五級")}`],
        ["/tools", 302, `${P}/more`],
        ["/guide?difficulty=4&level=10", 301, `${P}/guide/4/10`]
      ];
      const redirectStatus = {};
      for (const [path, status, target] of redirects) {
        const r = await raw(path, lang);
        redirectStatus[path] = r.status;
        assert.ok(status === 301 ? r.status === 301 : [302, 307].includes(r.status), `${path} status ${r.status}`);
        assert.equal(decodeURI(new URL(r.location, base).pathname), decodeURI(target), `${path} → ${target}`);
      }
      const checks = {};
      for (const [path] of PAGES) {
        const r = await raw(path, lang);
        assert.equal(r.status, 200, `${path} renders`);
        assert.equal((r.html.match(/<h1\b/g) || []).length, 1, `${path}: one h1`);
        const ep = /<html[^>]*class="[^"]*\brework-ep\b/.test(r.html);
        assert.equal(ep, path !== "/about", `${path}: rework-ep ${path !== "/about"}`);
        checks[path] = r.html;
      }
      const nine = checks["/grade/2026/%E4%B9%9D%E6%AE%B5"];
      for (const s of DAN_SONGS.slice(0, 3)) assert.ok(nine.includes(`href="${P}/songs/${s.id}?difficulty=4"`), `九段 links ${s.jp}`);
      assert.ok(nine.includes("連打数162打以上") && nine.includes("可120未満"), "九段 pass conditions");
      assert.ok(nine.includes('href="/nijiiro_2026_dan_overview.png"'), "2026 overview link");
      assert.ok(!checks["/grade/2025/%E4%BA%94%E7%B4%9A"].includes("nijiiro_2026_dan_overview"), "2025: no overview image");
      for (const year of ["2023", "2024"]) {
        const h = checks[`/grade/${year}`];
        assert.ok(h.includes(`href="${P}/songs/905?difficulty=5"`), `${year}: GO GET'EM! (ura) → song 905, inner oni`);
        assert.ok(h.includes(`href="${P}/songs/906?difficulty=4"`), `${year}: RIDGE RACER STEPS → 906`);
        assert.ok(!h.includes('/songs/907') && !h.includes('/songs/908'), `${year}: two catalogue matches → no link`);
        assert.ok(!/href="#"/.test(h), `${year}: no "#" links`);
        assert.ok(h.includes("内容待补充。") && h.includes(`虹段位道场 ${year}`), `${year}: content kept`);
      }
      assert.ok(checks["/grade/2024"].includes("ニジイロ2023") && checks["/grade/2023"].includes("ニジイロ2022"), "year rows differ");
      assert.ok((checks["/guide"].match(/href="[^"]*\/guide\/\d+\/\d+"/g) || []).length === 30, "guide index: 5 + 7 + 8 + 10 star links");
      const level = checks["/guide/4/10"];
      for (const n of ["2", "3", "45", "5", "6", "7", "68"]) assert.ok(new RegExp(`>\\s*${n}\\s*<`).test(level), `guide distribution ${n}`);
      assert.equal((checks["/titles"].match(/<tr\b/g) || []).length, 51, "titles: header + 50 rows in the server HTML");
      const more = checks["/more"];
      for (const href of ["/grade", "/guide", "/titles", "/tools/rt-calculator", "/tools/chart-config", "/tools/tja-constants", "/tools/note-count", "/tools/word-cloud", "/settings", "/about", "/account/sync", "/docs/score-token", "/account/developer", "/support", "/alias-log"])
        assert.ok(more.includes(`href="${P}${href}"`), `more → ${href}`);
      assert.ok(/v\d+\.\d+\.\d+/.test(more), "version");
      for (const key of ["teamTitle", "teamDesc", "stackTitle", "stackDesc", "linksTitle"]) assert.ok(checks["/about"].includes(msg(m, `rework.aboutPage.${key}`)), `about ${key}`);
      assert.ok(checks["/about"].includes("https://www.ourtaiko.org/") && checks["/about"].includes("Spring Boot 3"), "about link and stack");
      assert.ok(checks["/alias-log"].includes(msg(m, "rework.aliasLogPage.subtitle", { total: 45 })), "alias log total");
      assert.equal((checks["/alias-log"].match(/class="at-time/g) || []).length, 20, "alias log: 20 rows");
      assert.ok(checks["/tools/word-cloud"].includes('class="rw-gate'), "word cloud guest gate rendered by the server");
      assert.ok(!checks["/tools/word-cloud"].includes("tool-gate-alert"), "no AccountToolGate");
      // Hydration of every page (faults are asserted by the wrapper)
      const h1 = {};
      for (const [path, ready] of PAGES) {
        await page.goto(`${base}${P}${path}`, { waitUntil: "networkidle" });
        await hydrated(page);
        await page.locator(ready).first().waitFor();
        h1[path] = await h1Text(page);
        const server = (checks[path].match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        assert.equal(h1[path], server, `${path}: SSR h1 = hydrated h1`);
      }
      return { h1, redirectStatus };
    });

  // 2. Dan courses: rail, years, neighbours, tabs, links
  await scenario("dan", { width: 1440 }, async ({ page, step }) => {
    step("open 2026 九段");
    await page.goto(`${base}/grade/2026/%E4%B9%9D%E6%AE%B5`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await page.locator('.dan-rail a[aria-current="page"]').textContent(), "九段");
    assert.equal(await page.locator('.dan-years a[aria-current="page"]').textContent(), "2026");
    assert.equal(await page.locator(".dan-rail a").count(), 19);
    assert.equal(await page.locator('.desktop-tabs a[aria-current="page"]').getAttribute("href"), "/grade", "songs tab 段位 current on a course");
    assert.deepEqual(await page.locator(".desktop-tabs a").allTextContents(), ["rework.catalog", "rework.constants", "rework.grade", "rework.guide", "rework.titles"].map((k) => msg(zh, k)));
    assert.equal(await h1Text(page), msg(zh, "rework.grade"), "h1 = tab label");
    const songs = await page.$$eval(".dan-song", (els) => els.map((el) => ({ title: el.querySelector(".ds-songcell__title")?.textContent, href: el.querySelector(".dan-song__link")?.getAttribute("href") || null, wiki: el.querySelector(".dan-song__wiki")?.getAttribute("target"), diff: el.querySelector(".ds-diff")?.getAttribute("aria-label") })));
    assert.deepEqual(songs.map((s) => s.href), ["/songs/901?difficulty=4", "/songs/902?difficulty=4", "/songs/903?difficulty=4"]);
    assert.ok(songs.every((s) => s.wiki === "_blank"), "wiki links open a new window");
    const cond = await page.$$eval(".dan-cond tbody tr", (rows) => rows.map((r) => r.textContent.replace(/\s+/g, " ").trim()));
    assert.equal(cond.length, 4);
    assert.ok(/1曲目\s*連打数23打以上\s*2曲目\s*連打数162打以上\s*3曲目\s*連打数0打以上/.test(cond[3]), "per-song roll counts in song order: " + cond[3]);
    assert.equal(await page.locator(".dan-tier.is-pass").count() + (await page.locator(".dan-tier.is-gold").count()), 2);
    step("tabs keyboard");
    const tablist = page.locator('.dan-tabs[role="tablist"]').first();
    await tablist.locator('[role="tab"]').first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tablist.locator('[aria-selected="true"]').textContent().then((x) => x.trim()), "2曲目");
    assert.ok(await page.evaluate(() => document.activeElement?.getAttribute("role") === "tab" && document.activeElement.getAttribute("aria-selected") === "true"));
    await page.keyboard.press("End");
    assert.equal(await tablist.locator('[aria-selected="true"]').textContent().then((x) => x.trim()), "3曲目");
    step("rail → 八段 (client)");
    const t0 = Date.now();
    await page.locator(".dan-rail a", { hasText: "八段" }).click();
    await page.waitForURL(/%E5%85%AB%E6%AE%B5/);
    await page.locator('.dan-rail a[aria-current="page"]', { hasText: "八段" }).waitFor();
    timings.routeSwitchMs.push(Date.now() - t0);
    step("neighbours");
    assert.equal(decodeURI(await page.locator(".dan-near__item.is-nextGrade").getAttribute("href")), "/grade/2026/九段");
    assert.equal(decodeURI(await page.locator(".dan-near__item.is-prevYear").getAttribute("href")), "/grade/2025/八段");
    await page.locator(".dan-near__item.is-prevYear").click();
    await page.waitForURL(/\/grade\/2025\//);
    await page.locator('.dan-years a[aria-current="page"]', { hasText: "2025" }).waitFor();
    assert.equal(await page.locator(".dan-head__actions a", { hasText: msg(zh, "page.home.guest.danOverviewCta") }).count(), 0, "2025 has no overview image");
    step("year switch → 2023 (single course)");
    await page.locator(".dan-years a", { hasText: "2023" }).click();
    await page.waitForURL(/\/grade\/2023$/);
    await page.locator(".dan-songs").waitFor();
    assert.equal(await page.locator(".dan-rail").count(), 0);
    assert.equal(await page.locator(".dan-near__item.is-prevGrade").evaluate((el) => el.tagName), "SPAN", "2023: 八段 is text (no page)");
    step("year switch → 2026 (redirect page)");
    await page.locator(".dan-years a", { hasText: "2026" }).click();
    await page.waitForURL(/\/grade\/2026\/%E4%BA%94%E7%B4%9A$/);
    await page.locator('.dan-rail a[aria-current="page"]', { hasText: "五級" }).waitFor();
    step("song link → detail");
    await page.goto(`${base}/grade/2026/%E9%81%94%E4%BA%BA`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await page.locator(".dan-song__link").first().getAttribute("href"), "/songs/904?difficulty=5", "inner oni → difficulty 5");
    assert.ok((await page.locator(".dan-song").first().locator(".ds-diff").getAttribute("aria-label")).includes(msg(zh, "difficulty.5")));
    await page.locator(".dan-song__link").first().click();
    await page.waitForURL(/\/songs\/904\?difficulty=5/);
    await page.locator("#viewer-main h1").waitFor();
    return { songs };
  });

  // 3. Guides
  await scenario("guide", { width: 1440 }, async ({ page, state, step }) => {
    step("index → 魔王 ★10");
    await page.goto(`${base}/guide`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await h1Text(page), msg(zh, "rework.guide"));
    assert.equal(await page.locator('.desktop-tabs a[aria-current="page"]').getAttribute("href"), "/guide");
    await page.locator(`.gi-level[href="/guide/4/10"]`).click();
    await page.waitForURL(/\/guide\/4\/10$/);
    await page.locator(".gl-tags").waitFor();
    assert.equal(await page.locator('.desktop-tabs a[aria-current="page"]').getAttribute("href"), "/guide", "攻略 tab current on a star page");
    assert.equal(await page.locator('.gl-levels a[aria-current="page"]').textContent(), "★10");
    assert.deepEqual(await page.$$eval(".gl-dist td", (els) => els.map((el) => el.textContent.trim())), ["2", "3", "45", "5", "6", "7", "0", "68"]);
    assert.deepEqual(await page.$$eval(".gl-tag__count", (els) => els.map((el) => el.textContent.trim())), ["2", "3", "45", "5", "6", "7", "0"]);
    step("open 强 (45 rows)");
    const strong = page.locator(".gl-tag").nth(2);
    await strong.locator(".gl-tag__toggle").click();
    await strong.locator(".gl-items tbody tr").first().waitFor();
    assert.equal(await strong.locator(".gl-items tbody tr").count(), 30, "30 mounted at first");
    assert.equal(await strong.locator(".gl-tag__toggle").getAttribute("aria-expanded"), "true");
    await strong.locator(".gl-more .rw-btn").click();
    assert.equal(await strong.locator(".gl-items tbody tr").count(), 45);
    assert.equal(await strong.locator(".gl-more").count(), 0);
    const cells = await strong.locator(".gl-items tbody tr").first().evaluate((tr) => [...tr.children].map((c) => c.textContent.trim()));
    assert.equal(cells.length, 6, "all six columns");
    step("keyboard toggles");
    await strong.locator(".gl-tag__toggle").focus();
    await page.keyboard.press("Enter");
    assert.equal(await strong.locator(".gl-tag__toggle").getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Space");
    assert.equal(await strong.locator(".gl-tag__toggle").getAttribute("aria-expanded"), "true");
    step("empty tag");
    const last = page.locator(".gl-tag").nth(6);
    await last.locator(".gl-tag__toggle").click();
    await last.locator(".rw-state--empty").waitFor();
    step("tag read fails (intercepted) → retry");
    state.guideTagFail = true;
    const first = page.locator(".gl-tag").nth(0);
    await first.locator(".gl-tag__toggle").click();
    await first.locator('.rw-state--failed[role="alert"]').waitFor();
    state.guideTagFail = false;
    await first.locator(".rw-state--failed button").click();
    await first.locator(".gl-items tbody tr").first().waitFor();
    assert.equal(await first.locator(".gl-items tbody tr").count(), 2);
    step("star nav");
    await page.locator('.gl-levels a', { hasText: "★9" }).click();
    await page.waitForURL(/\/guide\/4\/9$/);
    await page.locator(".gl-tags").waitFor();
    step("upstream down (real server code) → failed page → retry");
    upstream.setUpstream({ guide: "fail" });
    await page.goto(`${base}/guide/1/5`, { waitUntil: "networkidle" });
    await hydrated(page);
    await page.locator('.rw-state--failed[role="alert"]').waitFor();
    assert.equal(await page.locator(`.rw-state--failed a[href="/guide"]`).count(), 1, "back to the guide index");
    await shot(page, "guide-failed-real-zh-1440-light");
    upstream.setUpstream({ guide: "ok" });
    await page.locator(".rw-state--failed button").click();
    await page.locator(".gl-tags").waitFor();
    return { interceptedTagFailure: true };
  });

  // 4. Titles
  await scenario("titles", { width: 1440 }, async ({ page, step }) => {
    await page.goto(`${base}/titles`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await h1Text(page), msg(zh, "rework.titles"));
    assert.equal(await page.locator(".tl-table tbody tr").count(), 50);
    const plates = await page.$$eval(".tl-table tbody tr", (rows) => rows.slice(0, 11).map((r) => ({ rarity: r.querySelector(".tl-rarity").textContent.trim(), plate: r.querySelector(".ds-title")?.getAttribute("data-plate") ?? null, img: Boolean(r.querySelector(".ds-title__plate-img")) })));
    for (const p of plates.filter((_, i) => i !== 4)) assert.equal(p.img, ["0", "1", "2", "41", "42", "43", "59", "60", "61"].includes(p.rarity), `plate ${p.rarity}`);
    assert.equal(await page.locator(".tl-table tbody tr").nth(4).locator(".ds-title__text").count(), 1, "a name too long for its plate falls back to the text form");
    assert.equal(await page.locator(`.tl-songs a[href="/songs/3"]`).count() >= 1, true);
    step("pager");
    assert.match(await page.locator(".tl-sum").textContent(), /130/);
    const t0 = Date.now();
    await page.locator(".pager .pg-num", { hasText: "3" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".tl-table tbody tr").length === 30);
    timings.filterMs.push(Date.now() - t0);
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains("tl-sum")), "focus to the summary");
    step("search");
    const t1 = Date.now();
    await page.locator('#viewer-main input[type="search"]').fill("合成称号");
    const expected = titleCatalog().titles.filter((x) => x.name.includes("合成称号")).length;
    await page.waitForFunction((n) => document.querySelectorAll(".tl-table tbody tr").length === n, expected);
    timings.filterMs.push(Date.now() - t1);
    assert.match(await page.locator(".tl-sum").textContent(), new RegExp(String(expected)));
    await page.locator('#viewer-main input[type="search"]').fill("zzz-none");
    await page.locator(".rw-state--empty").waitFor();
    await page.locator(".rw-state--empty button").click();
    await page.waitForFunction(() => document.querySelectorAll(".tl-table tbody tr").length === 50);
    step("upstream down → SSR failed → retry; empty");
    upstream.setUpstream({ titles: "fail" });
    await page.goto(`${base}/titles`, { waitUntil: "networkidle" });
    await hydrated(page);
    await page.locator('.rw-state--failed[role="alert"]').waitFor();
    await shot(page, "titles-failed-real-zh-1440-light");
    upstream.setUpstream({ titles: "ok" });
    await page.locator(".rw-state--failed button").click();
    await page.locator(".tl-table").waitFor();
    upstream.setUpstream({ titles: "empty" });
    await page.goto(`${base}/titles`, { waitUntil: "networkidle" });
    await hydrated(page);
    await page.locator(".rw-state--empty").waitFor();
    await shot(page, "titles-empty-real-zh-1440-light");
    return { plates };
  });

  // 5. Word cloud: guest gate (real), signed in (intercepted)
  await scenario("word-cloud", { width: 1440 }, async ({ page, state, step }) => {
    await page.goto(`${base}/tools/word-cloud`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await page.locator('.rw-gate[data-need="login"]').count(), 1);
    assert.equal(new URL(await page.locator(".rw-gate a.rw-btn--primary").getAttribute("href"), base).searchParams.get("redirect"), "/tools/word-cloud");
    assert.equal(await page.locator('.rw-gate a[href="/account/register"]').count(), 1, "register as before");
    await shot(page, "word-cloud-guest-real-zh-1440-light");
    step("signed in (intercepted)");
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    state.signedIn = true;
    await injectSignedIn(page, state.user);
    await go(page, "zh", "/tools/word-cloud");
    await page.locator("#viewer-main .rw-btn--primary", { hasText: msg(zh, "rework.toolPages.wordCloud.submit") }).click();
    await page.locator(".ir-img").waitFor();
    assert.equal(await page.locator(".ir-img").getAttribute("alt"), msg(zh, "rework.toolPages.wordCloud.imageAlt"));
    await shot(page, "word-cloud-image-intercepted-zh-1440-light");
    for (const [status, sel] of [[400, '.rw-gate[data-need="binding"]'], [404, '.ir a[href="/account/sync"]'], [500, '.ir .rw-state--failed']]) {
      state.wordCloud = status;
      await page.locator("#viewer-main .rw-form .rw-btn--primary").click();
      await page.locator(sel).waitFor();
    }
    state.wordCloud = 200;
    await page.locator(".ir .rw-state--failed button").click();
    await page.locator(".ir-img").waitFor();
    return { intercepted: true };
  });

  // 6. /more: every label is the destination page's own <h1>; shell tabs of the tools group
  await scenario("more", { width: 1440 }, async ({ page, step }) => {
    await page.goto(`${base}/more`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await h1Text(page), msg(zh, "rework.tools"));
    assert.equal(await page.locator('.more-hub a[href="/tools"]').count(), 0);
    for (const p of ["rt-calculator", "tja-constants", "chart-config", "note-count"]) assert.equal(await page.locator(`.more-hub a[href="/tools/${p}"]`).count(), 1, p);
    const links = await page.$$eval(".mh-link", (els) => els.map((el) => ({ href: el.getAttribute("href"), text: el.textContent.trim() })));
    const mismatches = [];
    for (const link of links) {
      step(link.href);
      await push(page, link.href);
      await page.waitForURL((u) => u.pathname.startsWith(link.href) || u.pathname === "/account/login");
      await page.waitForFunction((more) => location.pathname !== "/more" && document.querySelector("#viewer-main h1") && document.querySelector("#viewer-main h1").textContent.trim() !== more, msg(zh, "rework.tools"), { timeout: 60000 });
      const h1 = await h1Text(page).catch(() => "");
      const signIn = new URL(page.url()).pathname === "/account/login";
      if (!signIn && h1 !== link.text) mismatches.push({ ...link, h1 });
      await go(page, "zh", "/more");
      await page.locator(".more-hub").waitFor();
    }
    assert.deepEqual(mismatches, [], "label = destination title");
    step("tools tabs");
    const tabs = await page.$$eval(".desktop-tabs a", (els) => els.map((el) => ({ href: el.getAttribute("href"), text: el.textContent.trim() })));
    assert.equal(tabs.length, 8);
    for (const tab of tabs) {
      await go(page, "zh", tab.href.replace(/^\/ja/, ""));
      await page.locator(`.desktop-tabs a[aria-current="page"][href="${tab.href}"]`).waitFor();
      if (tab.href !== "/more") assert.equal(await h1Text(page), tab.text, `${tab.href}: tab = h1`);
    }
    step("language");
    await go(page, "zh", "/more");
    assert.equal(await page.locator('.mh-lang a[aria-current]').getAttribute("hreflang"), "zh");
    await page.locator('.mh-lang a[hreflang="ja"]').click();
    await page.waitForURL(/\/ja\/more$/);
    return { links: links.length, signInGated: links.filter((l) => ["/account/sync", "/account/developer", "/support"].includes(l.href)).length };
  });

  // 7. Alias log (real file)
  await scenario("alias-log", { width: 1440 }, async ({ page, step }) => {
    await page.goto(`${base}/alias-log`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await page.locator(".at-table tbody tr").count(), 20);
    assert.equal(await page.locator(".at-song__link").first().getAttribute("href"), "/songs/1");
    assert.equal(await page.locator(".at-group").first().textContent().then((x) => x.trim()), msg(zh, "rework.aliasLogPage.privateChat"));
    step("page 3");
    await page.locator(".pager .pg-num", { hasText: "3" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".at-table tbody tr").length === 5);
    step("search");
    await page.locator('#viewer-main input[type="search"]').fill("别名8");
    await page.locator('#viewer-main button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".at-table tbody tr").length === 1);
    assert.match(await page.locator(".rw-lead").textContent(), /1/);
    await page.locator('#viewer-main input[type="search"]').fill("");
    await page.locator('#viewer-main button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".at-table tbody tr").length === 20);
    step("empty file");
    await prepared.writeAlias([]);
    await page.goto(`${base}/alias-log`, { waitUntil: "networkidle" });
    await hydrated(page);
    await page.locator(".rw-state--empty").waitFor();
    await shot(page, "alias-log-empty-real-zh-1440-light");
    step("missing file → failed → retry");
    await prepared.removeAlias();
    await page.goto(`${base}/alias-log`, { waitUntil: "networkidle" });
    await hydrated(page);
    await page.locator('.rw-state--failed[role="alert"]').waitFor();
    await shot(page, "alias-log-failed-real-zh-1440-light");
    const { aliasLog } = await import("./pages-data.mjs");
    await prepared.writeAlias(aliasLog());
    await page.locator(".rw-state--failed button").click();
    await page.waitForFunction(() => document.querySelectorAll(".at-table tbody tr").length === 20);
  });

  // 8. Practice view controls (the player itself needs the practice-player assets; its state is recorded)
  await scenario("practice", { width: 1440 }, async ({ page }) => {
    await page.goto(`${base}/ourtaikoview/1/4`, { waitUntil: "networkidle" });
    await hydrated(page);
    assert.equal(await page.locator("main main").count(), 0, "no nested <main>");
    assert.equal(await page.locator(".rework-tabs").count(), 0, "immersive: no section tabs");
    assert.equal(await page.getByRole("link", { name: msg(zh, "rework.practice.back"), exact: true }).getAttribute("href"), "/songs/1");
    assert.equal(await page.getByRole("button", { name: msg(zh, "rework.practice.retry"), exact: true }).count(), 1);
    await page.locator('.practice-page input[type="range"]').fill("35");
    assert.equal(await page.locator(".practice-page output").textContent(), "35");
    await page.waitForTimeout(1500);
    const state = await page.locator(".practice-state").first().evaluate((el) => ({ role: el.getAttribute("role"), text: el.textContent.trim() }));
    assert.deepEqual(await touchTargets(page), []);
    await shot(page, "practice-real-zh-1440-light");
    return { playerState: state };
  });

  // 9. Element Plus mapping: off on /about (left without the flag on purpose), on for the slice pages
  await scenario("element-plus-switch", { width: 820 }, async ({ page }) => {
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    assert.ok(!(await htmlClasses(page)).includes("rework-ep"));
    await go(page, "zh", "/tools/rt-calculator?songId=1&level=4");
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"));
    const baseline = await page.evaluate(() => document.body.children.length);
    await page.locator(".song-select").click();
    await page.locator(".el-select-dropdown").first().waitFor();
    const dropdown = await page.$eval(".el-select-dropdown", (el) => getComputedStyle(el.closest(".el-popper")).backgroundColor);
    await page.keyboard.press("Escape");
    await go(page, "zh", "/about");
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"));
    const after = await page.evaluate(() => document.body.children.length);
    assert.ok(after <= baseline + 2, `body nodes ${baseline} → ${after}`);
    await page.goBack();
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"));
    return { dropdown };
  });

  // 10. Matrix: every page × widths × themes (zh) + ja samples
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const shots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light"]);
  for (const combo of combos)
    await scenario("matrix", combo, async ({ page, step }) => {
      const { width, theme, lang } = combo;
      const key = `${lang}-${width}-${theme}`;
      const report = {};
      for (const [path, ready] of PAGES) {
        step(path);
        await page.goto(`${base}${prefix(lang)}${path}`, { waitUntil: "networkidle" });
        await hydrated(page);
        await page.locator(ready).first().waitFor();
        if (path === "/guide/4/10") {
          await page.locator(".gl-tag").nth(0).locator(".gl-tag__toggle").click();
          await page.locator(".gl-tag").nth(0).locator(".gl-items").waitFor();
        }
        if (path.startsWith("/tools/rt-calculator")) await page.getByRole("button", { name: "全良", exact: true }).click();
        assert.equal((await htmlClasses(page)).includes("rework-ep"), path !== "/about", `${path}: rework-ep`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        assert.equal(await page.locator("h1").count(), 1, `${path}: one h1`);
        assert.ok(await noOverflow(page), `${path}: no horizontal overflow`);
        assert.deepEqual(await touchTargets(page), [], `${path}: touch targets`);
        if (path.startsWith("/tools/rt-calculator")) {
          // the three judgement inputs: one row of equal columns inside the panel, no overlap, one baseline
          const boxes = await page.evaluate(() => {
            const panel = document.querySelector(".rt-controls").getBoundingClientRect();
            const inputs = ["good", "ok", "bad"].map((k) => document.getElementById(`rt-${k}`).getBoundingClientRect());
            return { panel: { left: panel.left, right: panel.right }, inputs: inputs.map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width })) };
          });
          const [a, b, c] = boxes.inputs;
          assert.ok(a.right <= b.left + 0.5 && b.right <= c.left + 0.5, `${path}: judgement inputs overlap ${JSON.stringify(boxes.inputs)}`);
          assert.ok(boxes.inputs.every((r) => r.left >= boxes.panel.left - 0.5 && r.right <= boxes.panel.right + 0.5), `${path}: judgement inputs inside the panel`);
          assert.ok(Math.max(a.bottom, b.bottom, c.bottom) - Math.min(a.bottom, b.bottom, c.bottom) <= 1, `${path}: one baseline`);
          assert.ok(Math.max(a.width, b.width, c.width) - Math.min(a.width, b.width, c.width) <= 1, `${path}: equal columns`);
          report.rtInputs = boxes.inputs.map((r) => Math.round(r.width));
        }
        if (path === "/guide/4/10") {
          if (width < 768) {
            const top = await page.locator(".gl-levels").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
            assert.ok(top < 844 / 3, `${path}: star selector starts at ${Math.round(top)} (first third of 844)`);
            report.starSelectorTop = Math.round(top);
          }
          // no detail cell squeezed: the one-line columns stay on one line, the wrapping ones keep their width
          const cells = await page.$$eval(".gl-items tbody tr", (rows) =>
            rows.flatMap((tr) =>
              [...tr.children].map((cell, i) => {
                const range = document.createRange();
                range.selectNodeContents(cell);
                const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
                return { i, width: Math.round(cell.getBoundingClientRect().width), lines, wraps: i === 0 || i === 4 };
              })
            )
          );
          const bad = cells.filter((x) => (x.wraps ? x.width < 200 : x.lines > 1));
          assert.deepEqual(bad, [], `${path}: detail cells keep their minimum width`);
        }
        const scrollers = await page.$$eval(".dan-scroll, .dan-rich .h-scrollable, .gl-scroll", (els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => getComputedStyle(el).overflowX));
        assert.ok(scrollers.every((x) => x === "auto"), `${path}: wide tables scroll inside themselves`);
        const mounted = await page.evaluate(() => Math.max(document.querySelectorAll(".tl-table tbody tr").length, document.querySelectorAll(".at-table tbody tr").length, ...[...document.querySelectorAll(".gl-items")].map((t) => t.querySelectorAll("tbody tr").length), 0));
        assert.ok(mounted <= 60, `${path}: mounted rows ${mounted}`);
        report[path] = { scrollingInside: scrollers.length, mounted };
        if (shots.has(key)) await shot(page, `${path.replace(/^\//, "").replace(/[/?=&%]/g, "-")}-real-${key}`, true);
      }
      return { pages: report };
    });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
