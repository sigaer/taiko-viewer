// Slice D scenarios: the community pages (/forum, sections, all discussions, a thread, the composer, my community,
// notifications), the shell's bell and 社区 tabs, the reply box's soft-keyboard rule (P0) and mixed avatars (P2).
// Environment independent; used by
//   - scripts/rework/community-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=community (to be added; see stage-3-progress.md "切片 D")
// Real here: the server render of every page without a database (the forum reads fail for real, the three signed-in
// pages redirect to sign-in), hydration, the song search of the composer (/api/content/songs over the synthetic song
// file of detail-data.mjs) and the composer's contextual song. Everything that needs the database or a signed-in
// user — every /api/forum/* read and write, /api/account/*, the chart activity — is answered in the browser from
// community-fixtures.ts (typed against the real response types) and labelled `intercepted`. No write reaches any
// server: POSTs are recorded and answered here. The browser never leaves the base origin.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import {
  AVATAR_FAIL,
  deepReplyId,
  fixtureActivity,
  fixtureHome,
  fixtureList,
  fixtureNotifications,
  fixtureProfile,
  fixtureSections,
  fixtureThread,
  fixtureUser,
  lateFloorId,
  meBadge
} from "./community-fixtures.ts";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key
    .split(".")
    .reduce((o, k) => o?.[k], messages)
    .replace(/\{'@'\}/g, "@")
    .replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
const PNG = stripedPng(48, 48, 2);
const WIDE = stripedPng(160, 48, 5);
const TABS = ["/forum", "/forum/me", "/forum/notifications"];
const TAB_KEYS = ["rework.community", "rework.myPosts", "rework.notifications"];
const LONG = 5100; // long thread id
const PLAIN = 5001;

// ---------- Browser ----------
/**
 * One context; `state` steers the intercepted APIs:
 *   signedIn, role (forum role of the fixture user), unread, list ({ total }), thread ({ [id]: options }),
 *   notifications ({ empty, total }), profileBound, mineTotal,
 *   fail: { home, latest, list, sections, thread, like, postLike, reply, upload, create, read, moderation (the console's read), moderationAction,
 *           notifications, profile, mine, activity } → status code (+ statusMessage),
 *   hold: Set of keys whose responses wait for release() (loading states).
 */
export async function openContext(browser, { base, width, theme = "light", lang = "zh", signedIn = false, height }) {
  const context = await browser.newContext({ viewport: { width, height: height || (width < 500 ? 844 : 900) }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const state = { signedIn, role: "moderator", unread: 3, list: {}, thread: {}, notifications: {}, profileBound: true, mineTotal: 25, fail: {}, hold: new Set(), released: new Map(), created: 0 };
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
    const fail = (key) => {
      const f = state.fail[key];
      const status = typeof f === "object" ? f.status : f;
      const message = typeof f === "object" ? f.message : status === 429 ? "操作太频繁，请稍后再试" : status === 401 ? "请先登录" : "selfcheck failure";
      return json({ statusCode: status, statusMessage: message }, status);
    };
    const hit = async (key) => {
      intercepted.push(p);
      let body;
      if (method !== "GET") {
        try {
          body = request.postDataJSON();
        } catch {
          body = (request.headers()["content-type"] || "").includes("multipart") ? "multipart" : undefined;
        }
      }
      calls.push({ key, method, path: p, query: Object.fromEntries(url.searchParams), body });
      const held = waitHold(key);
      if (held) await held;
      return body;
    };
    if (p.startsWith("/selfcheck/")) {
      intercepted.push(p);
      if (p.includes("missing")) return route.fulfill({ status: 404, contentType: "text/plain", body: "missing" });
      return route.fulfill({ status: 200, contentType: "image/png", body: p.includes("wide") ? WIDE : PNG });
    }
    // state.real: the forum and chart-activity reads go to the dev server, which has no database (real failures)
    if (state.real && (p.startsWith("/api/forum/") || p === "/api/content/community/chart-activity")) return route.continue();
    if (p === "/api/account/auth/me") return intercepted.push(p), json({ authenticated: state.signedIn, user: state.signedIn ? fixtureUser : null });
    if (p === "/api/content/community/chart-activity") {
      await hit("activity");
      if (state.fail.activity) return fail("activity");
      return json(fixtureActivity());
    }
    if (p === "/api/content/songs") calls.push({ key: "catalog", method, path: p, query: Object.fromEntries(url.searchParams) });
    if (!p.startsWith("/api/forum/") && !p.startsWith("/api/account/")) return route.continue();
    const writes = method !== "GET";
    if (!state.signedIn && (writes || ["/api/forum/notifications", "/api/forum/notifications/unread", "/api/account/profile"].includes(p))) {
      await hit(writes ? "denied" : "read-denied");
      return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
    }
    if (p === "/api/account/profile") {
      await hit("profile");
      if (state.fail.profile) return fail("profile");
      return json(fixtureProfile(state.profileBound));
    }
    if (p === "/api/forum/home") {
      await hit("home");
      if (state.fail.home) return fail("home");
      const home = fixtureHome({ unread: state.unread, signedIn: state.signedIn });
      if (state.signedIn) home.currentUser = meBadge(state.role);
      return json(home);
    }
    if (p === "/api/forum/sections") {
      await hit("sections");
      if (state.fail.sections) return fail("sections");
      return json({ items: fixtureSections() });
    }
    if (p === "/api/forum/threads" && method === "GET") {
      const q = Object.fromEntries(url.searchParams);
      const key = q.scope === "mine" ? "mine" : q.includeHidden ? "moderation" : q.songId ? "related" : q.pageSize === "12" && !q.sectionSlug && !q.keyword && !q.threadType && q.sort === "latest" && !state.listRoute ? "latest" : "list";
      await hit(key);
      if (state.fail[key]) return fail(key);
      const page = Number(q.page) || 1;
      if (key === "mine") return json(fixtureList({ total: state.mineTotal, page, pageSize: Number(q.pageSize) || 10 }));
      if (key === "moderation") {
        const list = fixtureList({ total: 10, page: 1, pageSize: 10 });
        list.items[2].status = "hidden";
        return json(list);
      }
      return json(fixtureList({ total: state.list.total ?? 30, page, pageSize: Number(q.pageSize) || 12, sort: q.sort }));
    }
    if (p === "/api/forum/threads" && method === "POST") {
      const body = await hit("create");
      if (state.fail.create) return fail("create");
      state.created = 6001;
      state.thread[6001] = { song: Boolean(body?.songId) };
      return json({ id: 6001 });
    }
    let m = p.match(/^\/api\/forum\/threads\/(\d+)$/);
    if (m && method === "GET") {
      await hit("thread");
      if (state.fail.thread) return fail("thread");
      const id = Number(m[1]);
      return json(fixtureThread(id, state.thread[id] || (id === LONG ? { long: true } : {})));
    }
    m = p.match(/^\/api\/forum\/threads\/(\d+)\/like$/);
    if (m) {
      await hit("like");
      if (state.fail.like) return fail("like");
      state.threadLiked = !state.threadLiked;
      return json({ liked: state.threadLiked, likeCount: 1234 + (state.threadLiked ? 1 : 0) });
    }
    m = p.match(/^\/api\/forum\/posts\/(\d+)\/like$/);
    if (m) {
      const body = await hit("postLike");
      void body;
      if (state.fail.postLike) return fail("postLike");
      const id = Number(m[1]);
      state.postLiked = state.postLiked || {};
      state.postLiked[id] = !state.postLiked[id];
      return json({ liked: state.postLiked[id], likeCount: state.postLiked[id] ? 42 : 41 });
    }
    m = p.match(/^\/api\/forum\/threads\/(\d+)\/replies$/);
    if (m) {
      const body = await hit("reply");
      if (state.fail.reply) return fail("reply");
      const id = Number(m[1]);
      const detail = fixtureThread(id, state.thread[id] || (id === LONG ? { long: true } : {}));
      const floorNo = detail.posts.length + 1;
      detail.posts.push({ id: id * 100 + 9999, floorNo, bodyText: body.bodyText, contentBlocks: body.contentBlocks, likeCount: 0, createdAt: new Date().toISOString(), author: meBadge(state.role), viewerHasLiked: false, isBlockedAuthor: false, replies: [] });
      detail.replyCount += 1;
      return json(detail);
    }
    if (p === "/api/forum/media/images") {
      await hit("upload");
      if (state.fail.upload) return fail("upload");
      state.uploads = (state.uploads || 0) + 1;
      return json({ imageUrl: `/selfcheck/upload-${state.uploads}.png` });
    }
    if (p === "/api/forum/notifications/unread") {
      await hit("unread");
      return json({ unreadCount: state.unread });
    }
    if (p === "/api/forum/notifications") {
      await hit("notifications");
      if (state.fail.notifications) return fail("notifications");
      const payload = fixtureNotifications(Number(url.searchParams.get("page")) || 1, state.notifications);
      if (state.readAll) payload.items.forEach((i) => (i.isRead = true));
      for (const id of state.readIds || []) payload.items.forEach((i) => i.id === id && (i.isRead = true));
      payload.unreadCount = payload.items.filter((i) => !i.isRead).length;
      return json(payload);
    }
    if (p === "/api/forum/notifications/read") {
      const body = await hit("read");
      if (state.fail.read) return fail("read");
      if (body?.ids) state.readIds = [...(state.readIds || []), ...body.ids];
      else state.readAll = true;
      state.unread = body?.ids ? Math.max(0, state.unread - body.ids.length) : 0;
      return json({ unreadCount: state.unread });
    }
    if (p === "/api/forum/moderation/action") {
      await hit("moderation-action");
      if (state.fail.moderationAction) return fail("moderationAction");
      return json({ ok: true });
    }
    intercepted.push(p);
    return json({ statusCode: 404, statusMessage: "not in fixture" }, 404);
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
const countCalls = (calls, key) => calls.filter((c) => c.key === key).length;
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
  await go(page, lang, path);
}
async function go(page, lang, path) {
  const target = `${prefix(lang)}${path}`;
  await push(page, target);
  const bare = target.split(/[?#]/)[0];
  await page.waitForURL((u) => u.pathname === bare);
}
/** Text of the latest Element Plus message (the pages' success / warning / error feedback). */
async function message(page, text) {
  await page.locator(".el-message", { hasText: text }).last().waitFor({ timeout: 10000 });
}
/** Avatars on the page: every one is the uploaded image or /default-avatar.svg; never the server's miku.png. */
const avatarAudit = (page) =>
  page.$$eval(".ds-avatar img", (imgs) =>
    imgs.map((img) => ({ src: img.getAttribute("src") || "", kind: img.closest(".ds-avatar").dataset.avatar, loaded: img.complete && img.naturalWidth > 0 }))
  );
async function waitAvatars(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll(".ds-avatar img")].every((img) => img.complete && (img.naturalWidth > 0 || img.getAttribute("src") === "/default-avatar.svg")),
    null,
    { timeout: 15000 }
  );
  const list = await avatarAudit(page);
  assert.ok(list.length > 0, "avatars present");
  assert.ok(!list.some((a) => /miku\.png/.test(a.src)), "the server default address is never shown");
  assert.ok(!list.some((a) => a.src.includes("avatar-missing")), "a failed avatar falls back to /default-avatar.svg");
  assert.ok(list.every((a) => a.loaded), "every avatar image decoded");
  return { uploaded: list.filter((a) => a.kind === "user").length, defaults: list.filter((a) => a.kind === "default").length };
}
const rect = (page, selector) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
});

// ---------- Scenarios ----------
export async function runCommunityScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
  const results = [];
  const timings = { routeSwitchMs: [], filterMs: [], longTaskMaxMs: 0, mountedReplyMax: 0 };
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
      results.push({ name, ...options, pass: true, ms: Date.now() - started, vueWarnings: handle.warnings.length, warningsSample: handle.warnings.slice(0, 3), intercepted: [...new Set(handle.intercepted)].slice(0, 40), blockedOrigins: [...handle.blocked], ...detail });
    } catch (error) {
      await shot(handle.page, `FAILED-${name}-${options.width}-${options.lang || "zh"}-${options.theme || "light"}`).catch(() => {});
      const main = await handle.page.evaluate(() => (document.querySelector("#viewer-main")?.innerHTML || "").slice(0, 1500)).catch(() => "");
      results.push({ name, ...options, pass: false, ms: Date.now() - started, step: handle.progress.at, error: String(error?.message || error).slice(0, 900), faults: handle.faults.slice(0, 10), warnings: handle.warnings.slice(0, 5), calls: handle.calls.slice(-6).map((c) => ({ ...c, body: c.body && JSON.stringify(c.body).slice(0, 200) })), main });
    } finally {
      await handle.page.close().catch(() => {});
      await handle.context.close().catch(() => {});
    }
  }

  await scenario("warm-up", { width: 1440, warmUp: true }, async ({ page, state }) => {
    for (const path of ["/about", "/forum", "/forum/discussions", "/forum/section/dojo", `/forum/thread/${PLAIN}`]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
    await enterSignedIn(page, base, "zh", "/forum/new", state);
    await page.locator(".composer-form").waitFor({ timeout: 120000 });
    for (const path of ["/forum/me", "/forum/notifications", `/forum/thread/${LONG}`]) {
      await go(page, "zh", path);
      await page.waitForTimeout(1500);
    }
  });

  // 1. Real server render without a database: the forum reads fail for real; the signed-in pages redirect.
  for (const lang of ["zh", "ja"])
    await scenario("ssr", { width: 1440, lang }, async ({ page, context, state }) => {
      const m = copy[lang];
      state.real = true;
      const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const raw = async (path) => {
        const response = await fetch(`${base}${prefix(lang)}${path}`, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(90000) });
        return { status: response.status, location: response.headers.get("location"), html: response.status === 200 ? await response.text() : "" };
      };
      for (const path of ["/forum", "/forum/discussions", "/forum/section/score-guides", `/forum/thread/${PLAIN}`]) {
        const r = await raw(path);
        assert.equal(r.status, 200, `${path} renders`);
        assert.match(r.html, /<html[^>]*class="[^"]*\brework-ep\b/, `${path}: server HTML carries rework-ep`);
        assert.match(r.html, /class="[^"]*\brw-state--failed\b|class="[^"]*\brw-state--loading\b/, `${path}: failed or loading state in the server HTML (no database)`);
      }
      for (const path of ["/forum/new", "/forum/me", "/forum/notifications"]) {
        const r = await raw(path);
        assert.equal(r.status, 302, `${path}: signed out → sign-in`);
        const location = new URL(r.location, base);
        assert.equal(location.pathname, `${prefix(lang)}/account/login`);
        assert.equal(location.searchParams.get("redirect"), `${prefix(lang)}${path}`);
      }
      // Hydration of the failed presentations, with the shell's tabs and bell
      await page.goto(`${base}${prefix(lang)}/forum`, { waitUntil: "networkidle" });
      await page.locator(".rw-state--failed").first().waitFor();
      assert.equal((await page.locator("h1").first().textContent()).trim(), msg(m, "rework.community"));
      assert.equal(await page.locator(`.desktop-tabs a[aria-current="page"]`).getAttribute("href"), `${prefix(lang)}/forum`);
      assert.deepEqual(await page.locator(".desktop-tabs a").allTextContents(), TAB_KEYS.map((k) => msg(m, k)));
      assert.equal(await page.locator(".rework-bar .bell").getAttribute("href"), `${prefix(lang)}/forum/notifications`);
      if (lang === "zh") await shot(page, "ssr-forum-failed-zh-1440-light");
      await page.goto(`${base}${prefix(lang)}/forum/thread/${PLAIN}`, { waitUntil: "networkidle" });
      await page.locator(".forum-thread-page .rw-state--failed").waitFor();
      assert.equal(await page.locator(".forum-thread-page .rw-state--failed a").getAttribute("href"), `${prefix(lang)}/forum`);
      if (lang === "zh") await shot(page, "ssr-thread-failed-zh-1440-light");
      await page.goto(`${base}${prefix(lang)}/forum/section/dojo`, { waitUntil: "networkidle" });
      await page.locator(".rw-state--failed").first().waitFor();
      await page.goto(`${base}${prefix(lang)}/forum/notifications`, { waitUntil: "networkidle" });
      await page.waitForURL((u) => u.pathname === `${prefix(lang)}/account/login`);
      return { real: true };
    });

  // 2. Matrix (intercepted, signed in): seven pages × widths × themes (zh) + ja samples
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const shots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-360-light", "zh-820-light", "ja-1440-dark"]);
  for (const combo of combos)
    await scenario("matrix", combo, async ({ page, state, step }) => {
      const { width, theme, lang } = combo;
      const m = copy[lang];
      const key = `${lang}-${width}-${theme}`;
      const detail = { pages: {} };
      await enterSignedIn(page, base, lang, "/forum", state);
      for (const [path, ready, name] of [
        ["/forum", ".community-feed .tr", "forum"],
        ["/forum/section/score-guides", ".thread-list-panel .tr", "section"],
        ["/forum/discussions", ".thread-list-panel .tr", "discussions"],
        [`/forum/thread/${LONG}`, ".cf", "thread"],
        ["/forum/new", ".composer-form", "new"],
        ["/forum/me", ".me-threads .tr", "me"],
        ["/forum/notifications", ".notification-card", "notifications"]
      ]) {
        step(name);
        const t0 = Date.now();
        await go(page, lang, path);
        await page.locator(ready).first().waitFor();
        timings.routeSwitchMs.push(Date.now() - t0);
        assert.ok((await htmlClasses(page)).includes("rework-ep"), `${name}: rework-ep`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        assert.equal(await page.locator("h1").count(), 1, `${name}: one <h1>`);
        assert.ok(await noOverflow(page), `${name}: no horizontal overflow`);
        const tabIndex = TABS.indexOf(path);
        if (tabIndex >= 0) {
          const tabs = width < 768 ? ".mobile-tabs" : ".desktop-tabs";
          assert.equal(await page.locator(`${tabs} a[aria-current="page"]`).getAttribute("href"), `${prefix(lang)}${path}`, `${name}: current tab`);
          assert.equal((await page.locator(`${tabs} a[aria-current="page"]`).textContent()).trim(), (await page.locator("h1").textContent()).trim(), `${name}: tab = <h1>`);
        }
        if (name === "thread") {
          const mounted = await page.locator(".cf__post, .cf__reply").count();
          timings.mountedReplyMax = Math.max(timings.mountedReplyMax, mounted);
          assert.ok(mounted <= 60, `mounted replies ≤ 60 (${mounted})`);
          assert.equal(await page.locator(".cr__pager").count(), 2, "window pager above and below");
          if (width >= 1240) {
            const side = await rect(page, ".tl__side");
            const main = await rect(page, ".tl__main");
            assert.ok(side.left > main.right, "chart card in the side column");
            assert.ok(main.width <= 761, "reading column ≤ 760 px");
          }
          const body = await rect(page, ".thread-content .cb");
          assert.ok(body.width <= 761, "post body line length ≤ 760 px");
          detail.avatars = await waitAvatars(page);
          if (width < 768) {
            const box = await rect(page, ".crb");
            const nav = await rect(page, ".rework-bottom");
            assert.ok(Math.abs(box.bottom - nav.top) <= 2, `reply box sits on the bottom navigation (${box.bottom} / ${nav.top})`);
          }
        }
        if (name === "notifications" || name === "forum" || name === "me") await waitAvatars(page);
        if (shots.has(key) && (key === "zh-1440-light" || key === "zh-390-dark" || ["forum", "thread", "new"].includes(name)))
          await shot(page, `${name}-intercepted-${key}`, width >= 1440 && name !== "thread");
      }
      return detail;
    });

  // 3. Community home: filters, view-all mapping, sections, tags, leaderboard, states, bell count
  await scenario("home", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/forum", state);
    await page.locator(".community-feed .tr").first().waitFor();
    step("latest");
    assert.equal(lastCall(calls, "latest").query.sort, "latest");
    assert.equal(lastCall(calls, "latest").query.pageSize, "12");
    assert.equal(await page.locator(".community-feed .tr").count(), 12);
    assert.equal(await page.locator(".community-filters button[aria-pressed=true]").textContent(), msg(m, "page.forum.index.latest"));
    assert.equal(await page.locator(".cbd__item").count(), 10, "all discussions + nine sections");
    assert.equal(await page.locator(".cbd__item").first().getAttribute("href"), "/forum/discussions");
    assert.equal(await page.locator(".cbd__item").nth(4).getAttribute("href"), "/forum/section/score-guides");
    assert.equal((await page.locator(".cbd__item").nth(4).locator(".cbd__n").textContent()).trim(), "128");
    assert.equal(await page.locator(".chs__tag").first().getAttribute("href"), "/forum/discussions?keyword=%E6%AE%B5%E4%BD%8D");
    assert.equal(await page.locator(".chs__top li").count(), 5);
    assert.equal(await page.locator(".cact").count(), 3);
    assert.equal(await page.locator(".cact").first().getAttribute("href"), "/songs/1?difficulty=4#chart-ugc");
    step("bell from home payload");
    await page.locator(".rework-bar .bell .bell-dot").waitFor();
    assert.equal((await page.locator(".rework-bar .bell .bell-dot").textContent()).trim(), "3");
    step("row");
    const row = page.locator(".community-feed .tr").first();
    assert.equal(await row.getAttribute("role"), "link");
    assert.equal(await row.locator(".tr__title").getAttribute("href"), "/forum/thread/5001");
    assert.equal(await row.locator(".tr__song").getAttribute("href"), "/songs/2?difficulty=4");
    assert.ok(await row.locator(".ds-diff").count(), "difficulty badge of the related chart");
    assert.ok((await page.locator(".community-feed .tr .tr__media").count()) >= 2, "media thumbnails (rows without a chart)");
    step("filters");
    for (const [filter, source] of [["hot", "hot"], ["guide", "guide"], ["featured", "featured"]]) {
      const t0 = Date.now();
      await page.locator(".community-filters button", { hasText: msg(m, filter === "guide" ? "forum.types.guide" : `page.forum.index.${filter}`) }).click();
      await page.waitForURL((u) => u.searchParams.get("filter") === filter);
      await page.waitForFunction((n) => document.querySelectorAll(".community-feed .tr").length === n, source === "hot" ? 3 : 2);
      timings.filterMs.push(Date.now() - t0);
    }
    assert.equal(await page.locator(".community-section-heading a").getAttribute("href"), "/forum/discussions?sort=featured");
    await page.locator(".community-filters button", { hasText: msg(m, "forum.types.guide") }).click();
    await page.waitForURL((u) => u.searchParams.get("filter") === "guide");
    assert.equal(await page.locator(".community-section-heading a").getAttribute("href"), "/forum/discussions?threadType=guide");
    await page.locator(".community-filters button", { hasText: msg(m, "page.forum.index.latest") }).click();
    await page.waitForURL((u) => !u.searchParams.get("filter"));
    step("row opens thread (click outside links, Enter)");
    await page.locator(".community-feed .tr").nth(1).locator(".tr__foot").click({ position: { x: 300, y: 5 } }).catch(async () => page.locator(".community-feed .tr").nth(1).click({ position: { x: 5, y: 5 } }));
    await page.waitForURL((u) => u.pathname === "/forum/thread/5002");
    await page.goBack();
    await page.locator(".community-feed .tr").first().waitFor();
    await page.locator(".community-feed .tr").nth(2).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/forum/thread/5003");
    await page.goBack();
    step("feed failure + retry; home failure");
    state.fail.latest = 503;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum");
    await page.locator(".community-feed .rw-state--failed").waitFor();
    await shot(page, "forum-feed-failed-intercepted-zh-1440-light");
    delete state.fail.latest;
    await page.locator(".community-feed .rw-state--failed button").click();
    await page.locator(".community-feed .tr").first().waitFor();
    state.fail.home = 500;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum");
    await page.locator(".community-feed-column > .rw-state--failed").waitFor();
    assert.equal(await page.locator(".cbd__item").count(), 1, "sections need the home payload");
    delete state.fail.home;
    step("empty");
    state.list.total = 0;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum");
    await page.locator(".community-feed .rw-state--empty").waitFor();
    assert.equal(await page.locator(".community-feed .rw-state--empty a").getAttribute("href"), "/forum/new");
    await shot(page, "forum-empty-intercepted-zh-1440-light");
    return { intercepted: true };
  });

  // 4. Section and all-discussions lists: sort, inline filters (draft until applied), paging, correction, states
  await scenario("list", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    state.listRoute = true;
    await enterSignedIn(page, base, "zh", "/forum/section/dojo", state);
    await page.locator(".thread-list-panel .tr").first().waitFor();
    assert.equal(lastCall(calls, "list").query.sectionSlug, "dojo");
    assert.equal((await page.locator("h1").textContent()).trim(), msg(m, "forum.sections.dojo.name"));
    assert.equal(await page.locator(".cbd__item[aria-current]").getAttribute("href"), "/forum/section/dojo");
    assert.equal(await page.locator(".rw-head__actions a").getAttribute("href"), "/forum/new?section=dojo");
    step("sort chip applies at once");
    await page.locator(".sort-chips button", { hasText: msg(m, "page.forum.section.sortHot") }).click();
    await page.waitForURL((u) => u.searchParams.get("sort") === "hot");
    await page.waitForFunction(() => document.querySelectorAll(".thread-list-panel .tr").length > 0);
    assert.equal(lastCall(calls, "list").query.sort, "hot");
    step("filters are a draft until applied");
    await page.locator(".filter-trigger").click();
    await page.locator(".cl-filters input").fill("连打");
    await page.locator(".cl-filters select").nth(1).selectOption("guide");
    assert.equal(new URL(page.url()).searchParams.get("keyword"), null, "not applied yet");
    const before = countCalls(calls, "list");
    await page.locator(".cl-filters button[type=submit]").click();
    await page.waitForURL((u) => u.searchParams.get("keyword") === "连打");
    await page.waitForFunction((n) => true, before);
    await page.locator(".thread-list-panel .tr").first().waitFor();
    const q = lastCall(calls, "list").query;
    assert.equal(q.keyword, "连打");
    assert.equal(q.threadType, "guide");
    assert.equal(q.sectionSlug, "dojo");
    assert.equal((await page.locator(".filter-trigger").textContent()).includes("2"), true, "two active filters");
    step("pager");
    await page.locator(".pager-panel").waitFor();
    await page.locator(".pager-panel button", { hasText: /^2$/ }).first().click().catch(async () => page.locator(".pager-panel .pg-next, .pager-panel button[rel=next]").first().click());
    await page.waitForURL((u) => u.searchParams.get("page") === "2");
    await page.locator(".thread-list-panel .tr").first().waitFor();
    assert.equal(lastCall(calls, "list").query.page, "2");
    step("clear filters from empty state");
    state.list.total = 0;
    await go(page, "zh", "/forum/section/dojo?keyword=none");
    await page.locator(".thread-list-panel .rw-state--empty").waitFor();
    await page.locator(".thread-list-panel .rw-state--empty button").click();
    await page.waitForURL((u) => !u.searchParams.get("keyword"));
    delete state.list.total;
    step("out-of-range page is corrected");
    await go(page, "zh", "/forum/discussions?page=99");
    await page.waitForURL((u) => u.searchParams.get("page") === "3");
    await page.locator(".thread-list-panel .tr").first().waitFor();
    assert.equal(await page.locator(".cbd__item[aria-current]").getAttribute("href"), "/forum/discussions");
    await shot(page, "discussions-intercepted-zh-1440-light", true);
    step("section filter on all discussions");
    await page.locator(".filter-trigger").click();
    assert.equal(await page.locator(".cl-filters select").count(), 3, "section select only without a fixed section");
    await page.locator(".cl-filters select").first().selectOption("arcade");
    await page.locator(".cl-filters button[type=submit]").click();
    await page.waitForURL((u) => u.searchParams.get("sectionSlug") === "arcade");
    assert.equal(await page.locator(".cbd__item[aria-current]").getAttribute("href"), "/forum/section/arcade");
    step("failures");
    state.fail.list = 503;
    await go(page, "zh", "/forum/discussions?sort=hot");
    await page.locator(".thread-list-panel .rw-state--failed").waitFor();
    delete state.fail.list;
    await page.locator(".thread-list-panel .rw-state--failed button").click();
    await page.locator(".thread-list-panel .tr").first().waitFor();
    state.fail.sections = 500;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum/section/general");
    await page.locator(".cc3__boards .rw-state--failed").waitFor();
    delete state.fail.sections;
    await page.locator(".cc3__boards .rw-state--failed button").click();
    await page.locator(".cbd__item").first().waitFor();
    return { intercepted: true };
  });
  await scenario("list-phone", { width: 390, theme: "dark" }, async ({ page, state }) => {
    state.listRoute = true;
    await enterSignedIn(page, base, "zh", "/forum/section/score-guides", state);
    await page.locator(".thread-list-panel .tr").first().waitFor();
    const boards = await rect(page, ".cbd__list");
    assert.ok(boards.height <= 52, "sections are one chip row on phones");
    assert.ok(await noOverflow(page));
    await page.locator(".filter-trigger").click();
    await page.locator(".cl-filters").waitFor();
    assert.ok(await noOverflow(page));
    await shot(page, "section-filters-intercepted-zh-390-dark", true);
  });

  // 5. Thread: long thread windows, deep links, every reply action, media viewer, blocked, sanitising, states
  await scenario("thread", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    const long = fixtureThread(LONG, { long: true });
    await enterSignedIn(page, base, "zh", `/forum/thread/${LONG}`, state);
    await page.locator(".cf").first().waitFor();
    step("head");
    assert.equal((await page.locator("h1").textContent()).trim(), long.title);
    assert.equal(await page.locator(".th__sec").getAttribute("href"), `/forum/section/${long.section.slug}`);
    assert.equal(await page.locator(".cc__song").getAttribute("href"), "/songs/1?difficulty=4#chart-ugc");
    assert.ok(await page.locator(".th .ds-title-plate, .th [class*='plate']").count() >= 0);
    step("windows");
    const windows = await page.locator(".cr__pager").first().locator("button, a").count();
    assert.ok(windows >= 3, "window pager");
    let mounted = await page.locator(".cf__post, .cf__reply").count();
    assert.ok(mounted <= 60);
    assert.equal(await page.locator(".cf__post").first().getAttribute("id"), `reply-${long.posts[0].id}`);
    const range0 = (await page.locator(".cr__range").textContent()).trim();
    await page.locator(".cr__pager").first().locator("button", { hasText: /^2$/ }).click();
    await page.waitForFunction((r) => document.querySelector(".cr__range")?.textContent?.trim() !== r, range0);
    mounted = await page.locator(".cf__post, .cf__reply").count();
    assert.ok(mounted <= 60, `window 2 mounts ≤ 60 (${mounted})`);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "replies-title", "focus moves to the replies heading");
    step("deep link into a later window");
    const deep = deepReplyId(long);
    await go(page, "zh", `/forum/thread/${LONG}#reply-${deep}`);
    await page.waitForFunction((id) => document.activeElement?.id === `reply-${id}`, deep, { timeout: 15000 });
    const target = await rect(page, `#reply-${deep}`);
    assert.ok(target.top >= 0 && target.bottom <= 900, "the reply is in view");
    assert.ok(await page.locator(`#reply-${deep}.is-targeted`).count(), "highlighted");
    await shot(page, "thread-deep-link-intercepted-zh-1440-light");
    step("deep link to a missing reply");
    await go(page, "zh", `/forum/thread/${LONG}#reply-1`);
    await message(page, msg(m, "rework.forum.thread.replyUnavailable"));
    step("like thread");
    await go(page, "zh", `/forum/thread/${LONG}`);
    await page.locator(".ta__act").first().click();
    await page.waitForFunction(() => document.querySelector(".ta__act")?.getAttribute("aria-pressed") === "true");
    assert.ok((await page.locator(".ta__act").first().textContent()).includes("1235"));
    await message(page, msg(m, "rework.forum.thread.likeSuccess"));
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("ta__act")), true, "focus stays on the like button");
    state.fail.like = 401;
    await page.locator(".ta__act").first().click();
    await message(page, msg(m, "rework.forum.thread.loginForLike"));
    delete state.fail.like;
    step("like a reply");
    const firstPost = page.locator(".cf__post").first();
    await firstPost.locator(".cf__act").first().click();
    await page.waitForFunction(() => document.querySelector(".cf__post .cf__act")?.getAttribute("aria-pressed") === "true");
    assert.equal(lastCall(calls, "postLike").path, `/api/forum/posts/${long.posts[0].id}/like`);
    state.fail.postLike = { status: 429, message: "操作太频繁，请稍后再试" };
    await firstPost.locator(".cf__act").first().click();
    await message(page, "操作太频繁，请稍后再试");
    delete state.fail.postLike;
    step("reply to a floor, cancel target, reply to a reply");
    await firstPost.locator(".cf__act").nth(1).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("crb__field"));
    assert.ok((await page.locator(".crb__to").textContent()).includes(long.posts[0].author.username));
    await page.locator(".crb__head button").first().click();
    assert.ok((await page.locator(".crb__to").textContent()).includes(msg(m, "rework.forum.thread.publishReply")));
    await page.locator(".cf__reply").first().locator(".cf__act").nth(1).click();
    const replyTargetId = long.posts[2].replies[0].id;
    step("validation: nothing to send");
    const before = countCalls(calls, "reply");
    await page.locator(".crb__send").click();
    await page.waitForTimeout(300);
    assert.equal(countCalls(calls, "reply"), before, "empty reply is not sent");
    step("upload: too large, 413, ok ×4 limit, remove");
    const input = page.locator(".crb__upload input[type=file]");
    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
    await message(page, msg(m, "rework.forum.thread.uploadTooLarge"));
    assert.equal(countCalls(calls, "upload"), 0, "too large: no request");
    state.fail.upload = { status: 413, message: "论坛图片过大，请控制在 20MB 以内" };
    await input.setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
    await message(page, msg(m, "rework.forum.thread.uploadTooLarge"));
    delete state.fail.upload;
    await input.setInputFiles([1, 2, 3, 4, 5].map((n) => ({ name: `${n}.png`, mimeType: "image/png", buffer: PNG })));
    await page.waitForFunction(() => document.querySelectorAll(".crb__tile").length === 4);
    assert.equal(lastCall(calls, "upload").body, "multipart");
    assert.ok(await page.locator(".crb__upload input").isDisabled(), "4 images: no more");
    await page.locator(".crb__rm").nth(3).click();
    await page.waitForFunction(() => document.querySelectorAll(".crb__tile").length === 3);
    step("send: failure, rate limit, success");
    await page.locator(".crb__field").fill("自检回复 <img src=x onerror=alert(1)>");
    state.fail.reply = { status: 500, message: "回复服务暂时不可用" };
    await page.locator(".crb__send").click();
    await message(page, "回复服务暂时不可用");
    state.fail.reply = { status: 429, message: "操作太频繁，请稍后再试" };
    await page.locator(".crb__send").click();
    await message(page, "操作太频繁，请稍后再试");
    assert.equal(await page.locator(".crb__field").inputValue(), "自检回复 <img src=x onerror=alert(1)>", "the draft stays after a failure");
    delete state.fail.reply;
    await page.locator(".crb__send").click();
    await message(page, msg(m, "rework.forum.thread.replySuccess"));
    const sent = lastCall(calls, "reply");
    assert.equal(sent.path, `/api/forum/threads/${LONG}/replies`);
    assert.equal(sent.body.parentPostId, replyTargetId);
    assert.equal(sent.body.bodyText, "自检回复 <img src=x onerror=alert(1)>");
    assert.equal(sent.body.contentBlocks.length, 4, "paragraph + three images");
    assert.equal(sent.body.contentBlocks[0].type, "paragraph");
    assert.equal(await page.locator(".crb__field").inputValue(), "", "accepted reply retires the draft");
    assert.equal(await page.locator(".crb.is-expanded").count(), 0, "box collapses");
    step("the new floor is plain text (no HTML from content)");
    const pages = (await page.locator(".cr__pager").first().locator("button").allTextContents()).map((x) => Number(x.trim())).filter(Number.isFinite);
    await page.locator(".cr__pager").first().locator("button", { hasText: new RegExp(`^${Math.max(...pages)}$`) }).click();
    const last = page.locator(".cf__post", { hasText: "自检回复" }).last();
    await last.waitFor();
    await last.scrollIntoViewIfNeeded();
    assert.ok((await last.textContent()).includes("<img src=x onerror=alert(1)>"), "rendered as text");
    assert.equal(await last.locator(".cf__body img[src='x']").count(), 0);
    step("blocked floor and reply");
    await go(page, "zh", `/forum/thread/${LONG}#reply-${long.posts[4].id}`);
    await page.waitForFunction((id) => document.activeElement?.id === `reply-${id}`, long.posts[4].id);
    await page.locator(`#reply-${long.posts[4].id} .cf__blocked`).waitFor();
    await page.locator(`#reply-${long.posts[4].id} .cf__blocked button`).click();
    await page.locator(`#reply-${long.posts[4].id} .cf__body`).waitFor();
    step("media viewer: open, Escape, focus returns");
    await go(page, "zh", `/forum/thread/${LONG}`);
    await page.locator(".thread-content .cb__trigger").first().scrollIntoViewIfNeeded();
    await page.locator(".thread-content .cb__trigger").first().click();
    await page.locator(".forum-media-viewer[role=dialog]").waitFor();
    await shot(page, "thread-media-viewer-intercepted-zh-1440-light");
    await page.keyboard.press("Escape");
    await page.locator(".forum-media-viewer").waitFor({ state: "detached" }).catch(() => page.locator(".forum-media-viewer").waitFor({ state: "hidden" }));
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("cb__trigger")), true, "focus returns to the image");
    step("hidden + locked thread (moderator view)");
    state.thread[5007] = { hidden: true, locked: true };
    await go(page, "zh", "/forum/thread/5007");
    await page.locator(".th__tag.is-hidden").waitFor();
    assert.ok(await page.locator(".th__tag.is-locked").count());
    assert.ok(await page.locator(".crb__field").isDisabled(), "locked: reply disabled");
    assert.equal(await page.locator(".crb__field").getAttribute("placeholder"), msg(m, "rework.forum.thread.locked"));
    await shot(page, "thread-locked-hidden-intercepted-zh-1440-light");
    step("thread without replies, without chart");
    state.thread[5008] = { empty: true, song: false };
    await go(page, "zh", "/forum/thread/5008");
    await page.locator(".reply-section .rw-state--empty").waitFor();
    assert.equal(await page.locator(".tl__side").count(), 0);
    step("read failure + retry");
    state.fail.thread = { status: 404, message: "帖子不存在" };
    await go(page, "zh", "/forum/thread/5009");
    await page.locator(".forum-thread-page .rw-state--failed").waitFor();
    delete state.fail.thread;
    await page.locator(".forum-thread-page .rw-state--failed button").click();
    await page.locator(".cf").first().waitFor();
    return { intercepted: true, windows };
  });

  // 5b. Failed images: a list thumbnail that fails is removed (no broken glyph, text takes the width); a content image
  //     that fails becomes a neutral placeholder (token surface, image icon, locale text), not a viewer trigger and not
  //     in the viewer; no substitute picture anywhere.
  await scenario("failed-images", { width: 1440 }, async ({ page, state, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/forum", state);
    await page.locator(".community-feed .tr").first().waitFor();
    step("list thumbnails");
    for (const row of await page.locator(".community-feed .tr").all()) await row.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('.tr[data-thread="5006"] .tr__media'), null, { timeout: 15000 });
    const failedRow = page.locator('.tr[data-thread="5006"]');
    assert.equal(await failedRow.evaluate((el) => el.classList.contains("has-media")), false);
    const rowBox = await failedRow.evaluate((el) => ({ row: el.getBoundingClientRect().width, main: el.querySelector(".tr__main").getBoundingClientRect().width }));
    assert.ok(rowBox.main >= rowBox.row - 20, `text takes the full width (${rowBox.main} / ${rowBox.row})`);
    for (const id of [5003, 5012]) {
      const thumb = page.locator(`.tr[data-thread="${id}"] .tr__media`);
      await thumb.locator("img").waitFor();
      await page.waitForFunction((x) => { const img = document.querySelector(`.tr[data-thread="${x}"] .tr__media img`); return img && img.complete && img.naturalWidth > 0; }, id);
      const size = await thumb.evaluate((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)]);
      assert.deepEqual(size, [112, 84], "loaded thumbnails keep the reserved box");
    }
    const broken = await page.$$eval(".community-feed img", (imgs) => imgs.filter((img) => !img.getAttribute("src") || (img.complete && img.naturalWidth === 0)).length);
    assert.equal(broken, 0, "no image without a source or with a failed load is left in the list");
    await failedRow.scrollIntoViewIfNeeded();
    await shot(page, "forum-failed-thumbnail-intercepted-zh-1440-light");
    step("content images");
    const long = fixtureThread(LONG, { long: true });
    await go(page, "zh", `/forum/thread/${LONG}`);
    await page.locator(".thread-content .cb").waitFor();
    for (const trigger of await page.locator(".thread-content .cb__trigger").all()) await trigger.scrollIntoViewIfNeeded();
    const bodyFailed = page.locator(".thread-content .cb__failed");
    await bodyFailed.waitFor({ timeout: 15000 });
    assert.equal(await bodyFailed.count(), 1);
    assert.equal((await bodyFailed.textContent()).trim(), msg(m, "rework.forum.imageFailed"));
    assert.equal(await bodyFailed.getAttribute("role"), "img");
    assert.equal(await bodyFailed.evaluate((el) => Boolean(el.closest("button"))), false, "not a viewer trigger");
    assert.equal(await bodyFailed.locator("img").count(), 0, "no substitute picture");
    assert.equal(await bodyFailed.locator("svg").count(), 1, "image icon");
    assert.equal(await page.locator(".thread-content .cb__trigger").count(), 2, "the loaded body images stay triggers");
    const floor6 = `#reply-${long.posts[5].id}`;
    await page.locator(floor6).scrollIntoViewIfNeeded();
    await page.locator(`${floor6} .cb__failed`).waitFor({ timeout: 15000 });
    assert.equal(await page.locator(`${floor6} .cb__trigger`).count(), 0);
    await shot(page, "thread-failed-reply-image-intercepted-zh-1440-light");
    await bodyFailed.scrollIntoViewIfNeeded();
    await shot(page, "thread-failed-body-image-intercepted-zh-1440-light");
    step("the viewer leaves the failed images out");
    await bodyFailed.click();
    assert.equal(await page.locator(".forum-media-viewer").count(), 0, "clicking the placeholder opens nothing");
    await page.locator(`#reply-${long.posts[3].id} .cb__trigger`).scrollIntoViewIfNeeded();
    await page.waitForFunction((sel) => { const img = document.querySelector(sel); return img && img.complete && img.naturalWidth > 0; }, `#reply-${long.posts[3].id} .cb__trigger img`);
    await page.locator(".thread-content .cb__trigger").first().click();
    await page.locator(".forum-media-viewer[role=dialog]").waitFor();
    assert.equal((await page.locator(".forum-media-viewer figcaption").textContent()).trim(), "1 / 3", "two body images + the floor 4 image; failed ones excluded");
    await page.keyboard.press("Escape");
    return { intercepted: true };
  });

  // 6. Signed-out attempts at each write entry (the server answers 401; the reply box asks to sign in)
  await scenario("signed-out", { width: 390 }, async ({ page, calls, step }) => {
    const m = copy.zh;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await go(page, "zh", `/forum/thread/${PLAIN}`);
    await page.locator(".cf").first().waitFor();
    step("reply box → sign in, back to this thread");
    const gate = page.locator('.crb .rw-gate[data-need="login"]');
    await gate.waitFor();
    const login = new URL(base + (await gate.locator("a").first().getAttribute("href")));
    assert.equal(login.pathname, "/account/login");
    assert.equal(login.searchParams.get("redirect"), `/forum/thread/${PLAIN}`);
    await shot(page, "thread-signed-out-intercepted-zh-390-light");
    step("like → 401 message");
    await page.locator(".ta__act").first().click();
    await message(page, msg(m, "rework.forum.thread.loginForLike"));
    await page.locator(".cf__post .cf__act").first().click();
    await message(page, msg(m, "rework.forum.thread.loginForLike"));
    assert.equal(countCalls(calls, "denied"), 2);
    step("composer, my community, notifications → sign-in");
    for (const path of ["/forum/new", "/forum/me", "/forum/notifications"]) {
      await go(page, "zh", "/forum").catch(() => {});
      await push(page, path);
      await page.waitForURL((u) => u.pathname === "/account/login" && u.searchParams.get("redirect") === path);
    }
    return { intercepted: true };
  });

  // 7. P0 gate (development aid only): the compiled rule docks the reply box on the keyboard
  await scenario("keyboard-reply", { width: 390, height: 844 }, async ({ page, state, step }) => {
    await enterSignedIn(page, base, "zh", `/forum/thread/${LONG}`, state);
    await page.locator(".crb").waitFor();
    step("compiled scoped rule matches the reply box");
    const rule = await page.evaluate(() => {
      const box = document.querySelector(".crb");
      const found = [];
      const walk = (rules, media) => {
        for (const r of rules) {
          if (r.cssRules && r.media) walk(r.cssRules, r.media.mediaText);
          else if (r.selectorText && /\[data-kb\]/.test(r.selectorText)) found.push({ selector: r.selectorText, media, bottom: r.style.bottom });
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules, "");
        } catch {}
      }
      document.documentElement.setAttribute("data-kb", "");
      const matches = found.map((f) => ({ ...f, matches: box.matches(f.selector) }));
      document.documentElement.removeAttribute("data-kb");
      return matches;
    });
    const dock = rule.find((r) => /\.crb\[data-v-[\w-]+\]$/.test(r.selector) && r.bottom);
    assert.ok(dock, `a compiled html[data-kb] .crb[data-v-…] rule exists: ${JSON.stringify(rule)}`);
    assert.ok(dock.matches, "the rule matches the reply box element while data-kb is on");
    assert.ok(!rule.some((r) => r.selector.trim() === "html[data-kb]" || r.selector.trim() === ":root[data-kb]"), "no rule collapsed to the root alone");
    step("keyboard closed: above the bottom navigation");
    const closed = await rect(page, ".crb");
    const nav = await rect(page, ".rework-bottom");
    assert.ok(Math.abs(closed.bottom - nav.top) <= 2);
    step("simulated keyboard (visualViewport stub; not a real keyboard)");
    await page.locator(".crb__field").focus();
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, "height", { configurable: true, get: () => 420 });
      Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => 0 });
      vv.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-kb"));
    const kb = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--kb-h").trim());
    assert.equal(kb, "424px", "--kb-h = innerHeight − visualViewport height − offsetTop");
    await page.waitForFunction(() => !document.querySelector(".rework-bottom"), null, { timeout: 5000 });
    const bottom = await page.evaluate(() => getComputedStyle(document.querySelector(".crb")).bottom);
    assert.equal(bottom, "424px", "the box docks on the keyboard");
    const open = await rect(page, ".crb");
    assert.ok(Math.abs(open.bottom - 420) <= 1, `box bottom = keyboard top (${open.bottom})`);
    const pad = await page.evaluate(() => getComputedStyle(document.querySelector(".crb")).paddingBottom);
    assert.equal(pad, "8px", "no safe-area inset added on the keyboard");
    await shot(page, "thread-keyboard-simulated-intercepted-zh-390-light");
    step("keyboard closes");
    await page.evaluate(() => {
      const vv = window.visualViewport;
      delete vv.height;
      delete vv.offsetTop;
      vv.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-kb"));
    await page.locator(".rework-bottom").waitFor();
    const back = await rect(page, ".crb");
    const nav2 = await rect(page, ".rework-bottom");
    assert.ok(Math.abs(back.bottom - nav2.top) <= 2, "back on the navigation, no leftover offset");
    return { compiledRule: dock.selector, media: dock.media, intercepted: true, simulated: true };
  });
  await scenario("keyboard-composer", { width: 360, height: 740 }, async ({ page, state, step }) => {
    await enterSignedIn(page, base, "zh", "/forum/new", state);
    await page.locator(".composer-form").waitFor();
    step("simulated keyboard over the body field");
    await page.locator("#composer-body").scrollIntoViewIfNeeded();
    await page.locator("#composer-body").focus();
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, "height", { configurable: true, get: () => 400 });
      vv.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-kb"));
    await page.evaluate(() => window.scrollBy(0, 120));
    const bar = await rect(page, ".cbar");
    assert.ok(bar.top >= -1 && bar.top <= 1, "the composer bar stays at the top");
    assert.ok(await page.locator(".cbar__go").isVisible(), "publish stays reachable");
    const field = await rect(page, "#composer-body");
    assert.ok(field.top < 400, "the focused field starts above the keyboard");
    assert.equal(await page.locator(".rework-bottom").count(), 0, "no bottom navigation on the composer");
    await shot(page, "composer-keyboard-simulated-intercepted-zh-360-light");
    return { simulated: true, intercepted: true };
  });

  // 8. Composer: every field, picker (real catalog API), uploads, validation, rejection, rate limit, success
  await scenario("composer", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/forum/new?section=dojo", state);
    await page.locator(".composer-form").waitFor();
    assert.equal((await page.locator("h1").textContent()).trim(), msg(m, "rework.forum.compose.heading"));
    assert.equal(await page.locator(".rework-bar").count(), 0, "the shell bar is hidden; the composer has its own");
    assert.equal(await page.locator(".composer-row select").inputValue(), "dojo", "section from ?section=");
    step("validation: no content");
    await page.locator(".cbar__go").click();
    await message(page, msg(m, "rework.forum.compose.contentRequired"));
    assert.equal(countCalls(calls, "create"), 0);
    step("fields");
    await page.locator(".type-chips button", { hasText: msg(m, "forum.types.guide") }).click();
    await page.locator(".composer-title__input").fill("自检标题");
    assert.ok((await page.locator(".composer-title .composer-counter").textContent()).includes("4 / 120"));
    await page.locator("#composer-body").fill("第一段");
    await page.locator(".block-editor__actions button").click();
    await page.locator("#composer-body").fill("第二段草稿");
    assert.equal(await page.locator(".block-list__item").count(), 1);
    step("images: too large, ok, caption, remove");
    const upload = page.locator(".composer-image-upload input[type=file]");
    await upload.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
    await message(page, msg(m, "rework.forum.compose.uploadTooLarge"));
    assert.equal(countCalls(calls, "upload"), 0);
    await upload.setInputFiles([{ name: "a.png", mimeType: "image/png", buffer: PNG }, { name: "b.png", mimeType: "image/png", buffer: PNG }]);
    await page.waitForFunction(() => document.querySelectorAll(".composer-image").length === 2);
    await page.locator(".composer-image__caption summary").first().click();
    await page.locator(".composer-image__caption textarea").first().fill("截图说明");
    await page.locator(".composer-image__remove").nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll(".composer-image").length === 1);
    step("song picker (real /api/content/songs over the synthetic catalog)");
    await page.locator(".song-picker input[type=search]").fill("合成");
    await page.locator(".song-picker input[type=search]").press("Enter");
    await page.locator(".csp__result").first().waitFor();
    const search = lastCall(calls, "catalog").query;
    assert.deepEqual(
      { view: search.view, page: search.page, pageSize: search.pageSize, keyword: search.keyword, sort: search.sort, shelfStatus: search.shelfStatus },
      { view: "list", page: "1", pageSize: "8", keyword: "合成", sort: "catalog", shelfStatus: "0" }
    );
    const results = await page.locator(".csp__result").count();
    assert.ok(results > 0 && results <= 12, `picker results ${results} (the list API serves at least 12)`);
    await page.locator(".csp__result").first().click();
    await page.locator(".csp__picked").waitFor();
    const options = await page.locator(".csp__diff select option").allTextContents();
    assert.equal(options[0], msg(m, "rework.forum.compose.noDifficulty"));
    await page.locator(".csp__diff select").selectOption("4");
    assert.ok((await page.locator(".csp__level").inputValue()).length > 0, "star level from the song");
    step("more options");
    await page.locator(".more-options summary").click();
    await page.locator(".more-options__body textarea").fill("自检摘要");
    await page.locator(".more-options__body input").fill("段位, 全良 #配速");
    step("server rejection, rate limit");
    state.fail.create = { status: 400, message: "标题过长" };
    await page.locator(".cbar__go").click();
    await message(page, "标题过长");
    state.fail.create = { status: 429, message: "发帖太频繁，请稍后再试" };
    await page.locator(".cbar__go").click();
    await message(page, "发帖太频繁，请稍后再试");
    assert.equal(await page.locator(".composer-title__input").inputValue(), "自检标题", "fields are kept after a rejection");
    delete state.fail.create;
    await shot(page, "composer-filled-intercepted-zh-1440-light", true);
    step("success → the new thread");
    await page.locator(".cbar__go").click();
    await page.waitForURL((u) => u.pathname === "/forum/thread/6001");
    const body = lastCall(calls, "create").body;
    assert.equal(body.sectionSlug, "dojo");
    assert.equal(body.threadType, "guide");
    assert.equal(body.title, "自检标题");
    assert.equal(body.locale, "zh");
    assert.equal(body.summary, "自检摘要");
    assert.deepEqual(body.tags, ["段位", "全良", "配速"]);
    assert.equal(body.difficultyType, "4");
    assert.ok(body.songId && body.level);
    assert.deepEqual(body.contentBlocks.map((b) => b.type), ["paragraph", "paragraph", "image"]);
    assert.equal(body.contentBlocks[1].text, "第二段草稿");
    assert.equal(body.contentBlocks[2].caption, "截图说明");
    await page.locator(".cf, .reply-section").first().waitFor();
    step("contextual chart from the song page");
    await go(page, "zh", "/forum/new?songId=1&difficulty=4");
    await page.locator(".csp__picked").waitFor();
    assert.equal(await page.locator(".csp__diff select").inputValue(), "4");
    return { intercepted: true, catalogReal: true };
  });
  await scenario("composer-phone", { width: 390, theme: "dark" }, async ({ page, state }) => {
    await enterSignedIn(page, base, "zh", "/forum/new", state);
    await page.locator(".composer-form").waitFor();
    assert.ok(await page.locator(".composer-title__input").isVisible(), "title field on phones");
    assert.ok(await noOverflow(page));
    await shot(page, "composer-intercepted-zh-390-dark", true);
  });

  // 9. My community: identity, counts, threads + pager, empty, failures, moderation
  await scenario("me", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/forum/me", state);
    await page.locator(".me-threads .tr").first().waitFor();
    assert.equal((await page.locator("h1").textContent()).trim(), msg(m, "rework.myPosts"));
    await page.locator(".cmh__facts dd").nth(2).waitFor();
    assert.deepEqual((await page.locator(".cmh__facts dd").allTextContents()).map((s) => s.trim()), ["123456789012", "25", "3"]);
    assert.equal(lastCall(calls, "mine").query.pageSize, "10");
    assert.equal(await page.locator(".cmh .ds-avatar").getAttribute("data-avatar"), "user");
    step("pager");
    await page.locator(".me-pager button", { hasText: /^2$/ }).click();
    await page.waitForURL((u) => u.searchParams.get("page") === "2");
    await page.waitForFunction(() => document.querySelectorAll(".me-threads .tr").length === 10);
    assert.equal(lastCall(calls, "mine").query.page, "2");
    step("moderation console");
    await page.locator(".moderation-panel summary").click();
    await page.locator(".moderation-item").first().waitFor();
    assert.ok((await page.locator(".moderation-item").nth(2).textContent()).includes(msg(m, "rework.forum.hidden")));
    await page.locator(".moderation-item").first().locator("button").first().click();
    await message(page, msg(m, "rework.forum.me.actionUpdated"));
    assert.deepEqual(lastCall(calls, "moderation-action").body, { threadId: 5001, action: "pin", enabled: false });
    await page.locator(".moderation-item").nth(2).locator("button").last().click();
    await message(page, msg(m, "rework.forum.me.actionUpdated"));
    assert.deepEqual(lastCall(calls, "moderation-action").body, { threadId: 5003, action: "hide", enabled: false });
    state.fail.moderationAction = { status: 403, message: "没有权限" };
    await page.locator(".moderation-item").first().locator("button").nth(2).click();
    await message(page, "没有权限");
    delete state.fail.moderationAction;
    await shot(page, "me-moderation-intercepted-zh-1440-light", true);
    step("unbound, empty, failures");
    state.profileBound = false;
    state.mineTotal = 0;
    state.role = "user";
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum/me");
    await page.locator(".me-threads .rw-state--empty").waitFor();
    assert.equal((await page.locator(".cmh__facts dd").first().textContent()).trim(), msg(m, "rework.forum.me.unbound"));
    assert.equal(await page.locator(".me-threads .rw-state--empty a").getAttribute("href"), "/forum/new");
    assert.equal(await page.locator(".moderation-panel").count(), 0, "members have no console");
    await shot(page, "me-empty-intercepted-zh-1440-light");
    state.fail.mine = 503;
    state.fail.profile = 500;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum/me");
    await page.locator(".me-threads .rw-state--failed").waitFor();
    await page.locator(".cmh .rw-state--failed").waitFor();
    delete state.fail.mine;
    delete state.fail.profile;
    await page.locator(".me-threads .rw-state--failed button").click();
    await page.locator(".me-threads .rw-state--empty").waitFor();
    await page.locator(".cmh .rw-state--failed button").click();
    await page.waitForFunction(() => !document.querySelector(".cmh .rw-state--failed"));
    return { intercepted: true };
  });

  // 10. Notifications: summary, actors, open (mark read + deep link), mark all, pager, empty, failure, bell
  await scenario("notifications", { width: 1440 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    await enterSignedIn(page, base, "zh", "/forum/notifications", state);
    await page.locator(".notification-card").first().waitFor();
    assert.equal((await page.locator("h1").textContent()).trim(), msg(m, "rework.notifications"));
    assert.equal(await page.locator(".notification-card").count(), 20);
    assert.equal(await page.locator(".notification-card.unread").count(), 3);
    assert.equal(await page.locator(".notification-card .cni__sys").count(), 5, "system notifications have no actor: type icon");
    const audit = await waitAvatars(page);
    assert.ok(audit.defaults > 0 && audit.uploaded > 0, "mixed avatars");
    assert.equal(await page.locator(".notification-card").nth(3).getAttribute("role"), "button", "no thread: a button");
    assert.equal(await page.locator(".notification-card").first().getAttribute("role"), "link");
    assert.ok((await page.locator(".notification-count").textContent()).includes("3"));
    await shot(page, "notifications-intercepted-zh-1440-light", true);
    step("pager");
    await page.locator(".notification-pager button", { hasText: /^2$/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".notification-card").length === 6);
    assert.equal(lastCall(calls, "notifications").query.page, "2");
    await page.locator(".notification-pager button", { hasText: /^1$/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".notification-card").length === 20);
    step("open an unread reply notification: marked read, then the reply");
    await page.locator(".notification-card").first().click();
    await page.waitForURL((u) => u.pathname === "/forum/thread/5001");
    assert.deepEqual(lastCall(calls, "read").body, { ids: [7000] });
    assert.equal(new URL(page.url()).hash, "#reply-500102");
    await page.goBack();
    await page.locator(".notification-card").first().waitFor();
    await page.waitForFunction(() => document.querySelectorAll(".notification-card.unread").length === 2);
    step("keyboard: Space on a button-row, Enter on a link-row");
    await page.locator(".notification-card").nth(3).focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelectorAll(".notification-card.unread").length <= 2);
    step("mark all");
    await page.locator(".rw-head__actions button").click();
    await message(page, msg(m, "forum.allMarkedRead"));
    assert.equal(lastCall(calls, "read").body && Object.keys(lastCall(calls, "read").body).length, 0);
    await page.waitForFunction(() => document.querySelectorAll(".notification-card.unread").length === 0);
    assert.equal(await page.locator(".rework-bar .bell .bell-dot").count(), 0, "the bell follows the confirmed count");
    step("empty, failure + retry");
    state.notifications.empty = true;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum/notifications");
    await page.locator(".forum-notifications-page .rw-state--empty").waitFor();
    state.fail.notifications = 503;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page);
    await go(page, "zh", "/forum/notifications");
    await page.locator(".forum-notifications-page .rw-state--failed").waitFor();
    await shot(page, "notifications-failed-intercepted-zh-1440-light");
    delete state.fail.notifications;
    state.notifications.empty = false;
    await page.locator(".forum-notifications-page .rw-state--failed button").click();
    await page.locator(".notification-card").first().waitFor();
    return { intercepted: true, avatars: audit };
  });
  await scenario("bell-phone", { width: 390 }, async ({ page, state, calls }) => {
    state.unread = 7;
    await enterSignedIn(page, base, "zh", "/forum/discussions", state);
    await page.locator(".rework-bar .bell .bell-dot").waitFor();
    assert.equal((await page.locator(".rework-bar .bell .bell-dot").textContent()).trim(), "7");
    assert.ok(countCalls(calls, "unread") >= 1, "the unread poll runs on phones");
    assert.equal((await page.locator(".rework-bar .bell").getAttribute("aria-label")).includes("7"), true);
    await go(page, "zh", "/forum/notifications");
    await page.locator(".notification-card").first().waitFor();
    assert.equal(await page.locator(".mobile-tabs a[aria-current]").getAttribute("href"), "/forum/notifications");
    assert.equal(await page.locator(".rework-bar .bell").getAttribute("aria-current"), "page");
    await shot(page, "notifications-intercepted-zh-390-light", true);
  });

  // 11. P2 review: mixed avatars on the list, a thread with many repliers, my community and notifications
  await scenario("avatars", { width: 820 }, async ({ page, state, step }) => {
    const out = {};
    await enterSignedIn(page, base, "zh", "/forum/discussions", state);
    for (const [path, ready, name] of [
      ["/forum/discussions", ".thread-list-panel .tr", "list"],
      [`/forum/thread/${LONG}`, ".cf", "thread"],
      ["/forum/me", ".me-threads .tr", "me"],
      ["/forum/notifications", ".notification-card", "notifications"]
    ]) {
      step(name);
      await go(page, "zh", path);
      await page.locator(ready).first().waitFor();
      out[name] = await waitAvatars(page);
      assert.ok(out[name].defaults > 0, `${name}: default avatars`);
      assert.ok(out[name].uploaded > 0, `${name}: uploaded avatars`);
      await shot(page, `avatars-${name}-intercepted-zh-820-light`, name !== "thread");
    }
    step("the default avatar is the file as is");
    const style = await page.evaluate(() => {
      const img = document.querySelector('.ds-avatar[data-avatar="default"] img');
      const s = getComputedStyle(img);
      return { filter: s.filter, opacity: s.opacity, mix: s.mixBlendMode };
    });
    assert.deepEqual(style, { filter: "none", opacity: "1", mix: "normal" });
    void AVATAR_FAIL;
    return { avatars: out, intercepted: true };
  });

  // 12. Element Plus mapping on the community pages and off elsewhere; the media viewer leaves no node behind
  // Slice G: the page without the mapping is /annual (out of scope); every reworked page has it by default.
  await scenario("element-plus-switch", { width: 820 }, async ({ page, state }) => {
    // /annual renders only for phones (middleware/annual-mobile.global.ts; a desktop browser is sent to the home page),
    // so this page presents itself as one; the shell and the reworked pages do not depend on the user agent.
    await page.setExtraHTTPHeaders({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await page.addInitScript((ua) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua }), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(`${base}/annual`, { waitUntil: "networkidle" });
    assert.ok(!(await htmlClasses(page)).includes("rework-ep"));
    const baseline = await page.evaluate(() => document.body.children.length);
    state.signedIn = true;
    await injectSignedIn(page);
    for (const path of ["/forum", "/forum/discussions", `/forum/thread/${PLAIN}`, "/forum/new", "/forum/me", "/forum/notifications"]) {
      await go(page, "zh", path);
      await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    }
    await go(page, "zh", `/forum/thread/${PLAIN}`);
    await page.locator(".thread-content .cb__trigger").first().click();
    await page.locator(".forum-media-viewer[role=dialog]").waitFor();
    await page.keyboard.press("Escape");
    await go(page, "zh", "/annual");
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    assert.equal(await page.locator(".forum-media-viewer").count(), 0, "no media viewer node after leaving");
    const after = await page.evaluate(() => document.body.children.length);
    assert.ok(after <= baseline + 2, `body nodes ${baseline} → ${after}`);
    await page.goBack();
    await page.waitForURL(/\/forum\/me|\/forum\/notifications|\/forum\/thread/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
