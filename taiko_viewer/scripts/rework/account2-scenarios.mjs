// Slice E2 scenarios: /account/sync (and the shell's sync control), /account/developer, /grants, /review,
// /docs/score-token, /support and /account/support/review.
// Environment independent; used by
//   - scripts/rework/account2-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=account2 (to be added; see stage-4-progress.md "切片 E2")
// Real here: the server render without a database (the public /docs/score-token renders for real; every signed-in
// page redirects to sign-in, as before), hydration, client-side validation and every client-side guard.
// Everything that needs the database or a session — every /api/account/* and /api/support/* read and write — is
// answered in the browser from account2-fixtures.ts and labelled `intercepted`; responses can be held to observe the
// pending state, failed with a status, or scripted per request. No request reaches any write on a server. Every token,
// key and address is synthetic (SYNTHETIC-…, tk_synthetic…, *.example.invalid). The browser never leaves the base origin.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import { accountUser } from "./account-fixtures.ts";
import {
  LONG,
  SYNTHETIC_DEVELOPER_TOKEN,
  SYNTHETIC_KINOKO_KEY,
  SYNTHETIC_SCORE_TOKEN,
  fixtureDeveloper,
  fixtureDeveloperReview,
  fixtureGrants,
  fixtureOwnClients,
  fixtureSupportReview,
  fixtureSyncOverview,
  fixtureTicketDetail,
  fixtureTickets,
  supportTicket,
  syncLog
} from "./account2-fixtures.ts";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
async function locales(web) {
  const load = async (lang) => JSON.parse(await readFile(resolve(web, "locales", lang + ".json"), "utf8"));
  return { zh: await load("zh"), ja: await load("ja") };
}
const msg = (messages, key, values = {}) =>
  key
    .split(".")
    .reduce((o, k) => o?.[k], messages)
    .replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
const PNG = stripedPng(64, 48, 3);

// ---------- Browser ----------
/**
 * One context; `state` steers the intercepted APIs:
 *   signedIn, user, sync (overview variant or object), developer, review, grantsPage, tickets, supportReview,
 *   respond: { key: fn(body, query) → { status?, json } } scripted answers (one-shot when fn.once),
 *   fail: { key → status | { status, message } }, hold: Set of keys whose responses wait for release().
 */
export async function openContext(browser, { base, width, theme = "light", lang = "zh", height }) {
  const context = await browser.newContext({ viewport: { width, height: height || (width < 500 ? 844 : 900) }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const state = {
    signedIn: false,
    user: accountUser(),
    sync: "ready",
    developer: "none",
    review: "full",
    tickets: "full",
    fail: {},
    respond: {},
    hold: new Set(),
    released: new Map()
  };
  const blocked = new Set();
  const outbound = [];
  const intercepted = [];
  const calls = [];
  const waitHold = (key) => (state.hold.has(key) ? new Promise((r) => state.released.set(key, r)) : null);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      blocked.add(url.origin);
      if (request.isNavigationRequest()) outbound.push(url.href);
      return route.abort();
    }
    const p = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p.startsWith("/selfcheck/")) return intercepted.push(p), route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (p === "/api/account/auth/me") {
      intercepted.push(p);
      return json({ authenticated: state.signedIn, user: state.signedIn ? state.user : null });
    }
    if (!p.startsWith("/api/account/") && !p.startsWith("/api/support/")) return route.continue();
    let key = null;
    const m = (re) => re.exec(p);
    if (method === "GET" && p === "/api/account/sync/targets") key = "syncTargets";
    else if (method === "POST" && p === "/api/account/sync") key = "sync";
    else if (method === "POST" && p === "/api/account/sync/kinoko-import") key = "kinoko";
    else if (method === "POST" && p === "/api/account/sync/kinoko-history-import") key = "kinokoHistory";
    else if (method === "POST" && p === "/api/account/score-token") key = "scoreToken";
    else if (method === "POST" && p === "/api/account/growth/goal/evaluate-current") key = "goalEvaluate";
    else if (method === "GET" && p === "/api/account/developer") key = "developer";
    else if (method === "POST" && p === "/api/account/developer/apply") key = "apply";
    else if (method === "GET" && p === "/api/account/developer/review") key = "developerReview";
    else if (method === "POST" && p === "/api/account/developer/review") key = "reviewDecision";
    else if (method === "GET" && p === "/api/account/developer/grants") key = "grants";
    else if (method === "POST" && p === "/api/account/developer/grants") key = "grantCreate";
    else if (method === "DELETE" && m(/^\/api\/account\/developer\/grants\/[\w-]+$/)) key = "grantRevoke";
    else if (method === "GET" && p === "/api/account/developer/clients") key = "clients";
    else if (method === "POST" && p === "/api/account/developer/clients") key = "clientCreate";
    else if (method === "DELETE" && m(/^\/api\/account\/developer\/clients\/[\w-]+$/)) key = "clientDisable";
    else if (method === "GET" && p === "/api/support/tickets") key = "tickets";
    else if (method === "POST" && p === "/api/support/tickets") key = "ticketCreate";
    else if (method === "GET" && m(/^\/api\/support\/tickets\/\d+$/)) key = "ticketDetail";
    else if (method === "POST" && m(/^\/api\/support\/tickets\/\d+\/messages$/)) key = "followUp";
    else if (method === "GET" && p === "/api/account/support/review") key = "supportReview";
    else if (method === "GET" && m(/^\/api\/account\/support\/review\/\d+$/)) key = "supportReviewDetail";
    else if (method === "POST" && m(/^\/api\/account\/support\/review\/\d+\/reply$/)) key = "supportReply";
    else if (method === "POST" && m(/^\/api\/account\/support\/review\/\d+\/close$/)) key = "supportClose";
    intercepted.push(p);
    if (!key) return json({ statusCode: 404, statusMessage: "not in fixture" }, 404);
    let body;
    if (method !== "GET") {
      const type = request.headers()["content-type"] || "";
      if (type.includes("multipart")) {
        const raw = request.postDataBuffer()?.toString("latin1") || "";
        body = { multipart: true, fields: [...raw.matchAll(/name="(\w+)"/g)].map((x) => x[1]), images: (raw.match(/name="images"/g) || []).length };
      } else {
        try {
          body = request.postDataJSON();
        } catch {
          body = undefined;
        }
      }
    }
    calls.push({ key, method, path: p, query: Object.fromEntries(url.searchParams), body, at: Date.now() });
    const held = waitHold(key);
    if (held) await held;
    if (state.fail[key]) {
      const f = state.fail[key];
      const status = typeof f === "object" ? f.status : f;
      const message = typeof f === "object" ? f.message : "selfcheck failure";
      return json({ statusCode: status, statusMessage: message }, status);
    }
    if (!state.signedIn) return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
    const scripted = state.respond[key];
    if (scripted) {
      if (scripted.once) delete state.respond[key];
      const out = scripted(body, Object.fromEntries(url.searchParams), p);
      return json(out.json, out.status || 200);
    }
    switch (key) {
      case "syncTargets":
        return json(typeof state.sync === "string" ? fixtureSyncOverview(state.sync) : state.sync);
      case "developer":
        return json(fixtureDeveloper(state.developer));
      case "developerReview":
        return state.review === "forbidden" ? json({ statusCode: 403, statusMessage: "无权访问开发者审批台" }, 403) : json(fixtureDeveloperReview(state.review));
      case "grants":
        return json(fixtureGrants(url.searchParams.get("before") ? 1 : 0));
      case "clients":
        return json(fixtureOwnClients());
      case "tickets":
        return json(fixtureTickets(state.tickets));
      case "ticketDetail": {
        const id = Number(p.split("/").pop());
        const ticket = fixtureTickets("full").items.find((t) => t.id === id) || supportTicket(id);
        return json(fixtureTicketDetail(ticket));
      }
      case "supportReview":
        return state.review === "forbidden" ? json({ statusCode: 403, statusMessage: "无权访问工单审批台" }, 403) : json(fixtureSupportReview());
      case "supportReviewDetail": {
        const id = Number(p.split("/").pop());
        const all = [...fixtureSupportReview().pending, ...fixtureSupportReview().history];
        return json(fixtureTicketDetail(all.find((t) => t.id === id) || supportTicket(id)));
      }
      case "scoreToken":
        return json({ token: body?.action === "issue" ? SYNTHETIC_SCORE_TOKEN : null, status: null });
      case "goalEvaluate":
        return json({ profileId: String(body?.profileId), outcome: "active", activeGoal: null, recentCompletedGoal: null });
      default:
        return json({ ok: true });
    }
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
  page.on("pageerror", (e) => faults.push("pageerror: " + String(e.message).slice(0, 300)));
  page.on("console", (msg) => {
    const text = msg.text();
    const origin = (() => {
      try {
        return new URL(msg.location().url).origin;
      } catch {
        return base;
      }
    })();
    if (/hydration/i.test(text)) faults.push("hydration: " + text.slice(0, 300));
    else if (msg.type() === "error" && !(origin !== base || /Failed to load resource|ERR_FAILED|net::/.test(text))) faults.push("console: " + text.slice(0, 300));
    else if (msg.type() === "warning" && /\[Vue warn\]/.test(text)) warnings.push(text.slice(0, 200));
  });
  const release = async (key) => {
    while (!state.released.has(key)) await page.waitForTimeout(25);
    state.hold.delete(key);
    state.released.get(key)();
    state.released.delete(key);
  };
  const progress = { at: "" };
  const step = (name) => (progress.at = name);
  return { context, page, faults, warnings, blocked, outbound, intercepted, calls, state, release, step, progress };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const htmlClasses = (page) => page.evaluate(() => document.documentElement.className.split(/\s+/));
const push = (page, to) => page.evaluate((x) => document.getElementById("__nuxt").__vue_app__.config.globalProperties.$router.push(x), to);
const prefix = (lang) => (lang === "ja" ? "/ja" : "");
const lastCall = (calls, key) => [...calls].reverse().find((c) => c.key === key);
const countCalls = (calls, key) => calls.filter((c) => c.key === key).length;
const injectSignedIn = (page, user) =>
  page.evaluate((u) => {
    const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
    nuxt.payload.state["$saccount-user"] = u;
    nuxt.payload.state["$saccount-user-loaded"] = true;
  }, user);
async function go(page, lang, path) {
  const target = `${prefix(lang)}${path}`;
  await push(page, target);
  const bare = target.split(/[?#]/)[0];
  await page.waitForURL((u) => u.pathname === bare);
}
/** Open `path` signed in: SSR of /about (guest), the fixture user, then client navigation. */
async function enterSignedIn(page, base, lang, path, state) {
  await page.goto(`${base}${prefix(lang)}/about`, { waitUntil: "networkidle" });
  state.signedIn = true;
  await injectSignedIn(page, state.user);
  await go(page, lang, path);
}
/** Leave and come back (keepalive: the page re-reads on activation). */
async function revisit(page, lang, path) {
  await go(page, lang, "/about");
  await go(page, lang, path);
}
async function message(page, text) {
  await page.locator(".el-message", { hasText: text }).last().waitFor({ timeout: 10000 });
}
const waitCall = async (page, calls, key, count) => {
  for (let i = 0; i < 200 && countCalls(calls, key) < count; i++) await page.waitForTimeout(25);
  assert.ok(countCalls(calls, key) >= count, `${key} request #${count}`);
  return calls.filter((c) => c.key === key)[count - 1];
};
const touchTargets = (page) =>
  page.$$eval("#viewer-main .rw-btn, #viewer-main .target-item, #viewer-main summary, #viewer-main .rsr__item, #viewer-main .rw-seg > *", (els) =>
    els.filter((el) => el.getClientRects().length).map((el) => ({ text: el.textContent.trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44)
  );
async function tabTo(page, selector, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return i + 1;
  }
  throw new Error(`keyboard never reached ${selector}`);
}
const syncControl = (page) =>
  page.evaluate(() => {
    const a = document.querySelector("[data-sync-control]");
    return { state: a?.getAttribute("data-sync-state") || null, label: a?.getAttribute("aria-label") || "", dot: a?.querySelector(".sync-dot")?.className.replace("sync-dot", "").trim() || null };
  });
/** Every place a secret could leak outside the page body: the address, storage and the document title. */
const secretLeaks = (page, secret) =>
  page.evaluate((s) => {
    const out = [];
    if (location.href.includes(s)) out.push("url");
    for (const store of [localStorage, sessionStorage]) for (let i = 0; i < store.length; i++) if ((store.getItem(store.key(i)) || "").includes(s)) out.push("storage:" + store.key(i));
    if (document.title.includes(s)) out.push("title");
    if (document.cookie.includes(s)) out.push("cookie");
    return out;
  }, secret);

// ---------- Scenarios ----------
export async function runAccount2Scenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
  const zh = copy.zh;
  const S = (key, values) => msg(zh, `rework.account.sync.${key}`, values);
  const results = [];
  const timings = { longTaskMaxMs: 0 };
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
      assert.deepEqual(handle.outbound, [], "no navigation off the base origin");
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
    for (const path of ["/about", "/docs/score-token", "/ja/docs/score-token"]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
    await enterSignedIn(page, base, "zh", "/account/sync", state);
    await page.locator(".rs-over").waitFor({ timeout: 120000 });
    for (const path of ["/account/developer", "/account/developer/grants", "/account/developer/review", "/support", "/account/support/review"]) {
      await go(page, "zh", path);
      await page.locator("#viewer-main h1").waitFor({ timeout: 120000 });
    }
  });

  // 1. Real server render without a database, and hydration of it
  for (const lang of ["zh", "ja"])
    await scenario("ssr", { width: 1440, lang }, async ({ page, context }) => {
      const m = copy[lang];
      const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const raw = async (path) => {
        const response = await fetch(`${base}${prefix(lang)}${path}`, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(90000) });
        return { status: response.status, location: response.headers.get("location"), html: response.status === 200 ? await response.text() : "" };
      };
      const docs = await raw("/docs/score-token");
      assert.equal(docs.status, 200, "public docs render");
      const html = docs.html.replace(/<!--[\s\S]*?-->/g, "");
      assert.match(html, /<html[^>]*class="[^"]*\brework-ep\b/);
      assert.match(html, new RegExp(`<h1[^>]*>\\s*${msg(m, "rework.account.scoreTokenDocs.title")}\\s*</h1>`));
      assert.equal((html.match(/<h1\b/g) || []).length, 1, "one h1");
      assert.equal((html.match(/class="rtd-code"/g) || []).length, 2, "both code blocks in the server HTML");
      for (const code of ["400", "401", "404", "502"]) assert.ok(html.includes(msg(m, `rework.account.scoreTokenDocs.error${code}`)), `error ${code} text`);
      assert.ok(html.includes(msg(m, "rework.account.scoreTokenDocs.tokenPlaceholder")), "placeholder in the request example");
      assert.ok(html.includes(`${prefix(lang)}/account/sync`), "back link");
      for (const path of ["/account/sync", "/account/developer", "/account/developer/grants", "/account/developer/review", "/support", "/account/support/review"]) {
        const r = await raw(path);
        assert.equal(r.status, 302, `${path} signed out → sign-in`);
        const location = new URL(r.location, base);
        assert.equal(location.pathname, `${prefix(lang)}/account/login`);
        assert.equal(location.searchParams.get("redirect"), `${prefix(lang)}${path}`);
      }
      await page.goto(`${base}${prefix(lang)}/docs/score-token`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__));
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(await noOverflow(page));
      const pre = await page.$$eval(".rtd-code", (els) => els.map((el) => ({ overflowX: getComputedStyle(el).overflowX, tab: el.tabIndex })));
      assert.ok(pre.every((p) => p.overflowX === "auto" && p.tab === 0), "code blocks scroll in place and take focus");
      await shot(page, `docs-real-${lang}-1440-light`, true);
      await page.goto(`${base}${prefix(lang)}/support`, { waitUntil: "networkidle" });
      await page.waitForURL((u) => u.pathname === `${prefix(lang)}/account/login`);
      return { real: true };
    });

  // 2. Sync: every state the overview distinguishes (intercepted), and the shell's control for each
  await scenario("sync-states", { width: 1440 }, async ({ page, state, step }) => {
    const expect = {
      ready: { tag: S("ready"), start: true, dot: null, control: "ok", last: "success" },
      cooldown: { tag: S("remaining", { seconds: 95 }), start: false, dot: null, control: "ok", last: "success" },
      unbound: { gate: true, dot: "is-warn", control: "unbound" },
      manual: { alert: S("manualSaved"), noTargets: true, dot: null, control: "manual" },
      reverify: { alert: S("reverifyBinding"), link: true, start: false, dot: "is-warn", control: "attention" },
      unavailable: { alert: S("serviceUnavailable"), start: false, dot: "is-warn", control: "attention" },
      noTargets: { empty: S("noTargets"), start: false, dot: null, control: "ok" },
      never: { lastEmpty: true, start: true, dot: "is-warn", control: "never" },
      partial: { last: "partial", why: true, start: true, dot: "is-warn", control: "partial" },
      failed: { last: "failed", why: true, start: true, dot: "is-danger", control: "failed" }
    };
    state.signedIn = true;
    step("before the sync page: the plain control");
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page, state.user);
    assert.deepEqual(await syncControl(page), { state: null, label: msg(zh, "rework.sync"), dot: null });
    let first = true;
    for (const [variant, e] of Object.entries(expect)) {
      step(variant);
      state.sync = variant;
      if (first) await go(page, "zh", "/account/sync");
      else await revisit(page, "zh", "/account/sync");
      first = false;
      if (e.gate) {
        await page.locator(".rw-gate[data-need=binding]").waitFor();
        assert.equal(await page.locator(".rw-gate a").getAttribute("href"), "/account/profile");
        assert.equal(await page.locator("[data-sync-start]").count(), 0);
        assert.equal(await page.locator("[data-kinoko-import]").isDisabled(), true, "imports need a binding");
        assert.equal(await page.locator("[data-token-issue]").isDisabled(), true, "the token needs a binding");
      } else {
        await page.locator(".rs-over").waitFor();
        assert.equal(await page.locator("#sync-binding-title").innerText().then((t) => t.includes("鼓众自检") || t.includes("手动账号")), true);
        if (e.tag) assert.equal((await page.locator("[data-sync-readiness]").innerText()).trim(), e.tag);
        if (e.alert) await page.locator(".rs-over .rw-alert[role=note]", { hasText: e.alert }).waitFor();
        if (e.link) assert.equal(await page.locator(".rs-over .rw-alert a").getAttribute("href"), "/account/profile");
        if (e.noTargets) {
          assert.equal(await page.locator(".rs-over__targets").count(), 0);
          assert.equal(await page.locator("[data-sync-start]").count(), 0);
          await page.locator(".rs-token .rw-alert", { hasText: S("scoreTokenManual") }).waitFor();
        }
        if (e.empty) await page.locator(".rs-over__empty", { hasText: e.empty }).waitFor();
        if (e.start !== undefined) assert.equal(await page.locator("[data-sync-start]").isEnabled(), e.start, `${variant}: start enabled`);
        if (e.last) await page.locator("[data-sync-last] .rw-tag", { hasText: S(`outcome.${e.last}`) }).waitFor();
        if (e.lastEmpty) {
          await page.locator("[data-sync-last]", { hasText: S("noHistory") }).waitFor();
          await page.locator(".rs-last__empty", { hasText: S("noHistory") }).waitFor();
        }
        if (e.why) assert.ok((await page.locator("[data-sync-why]").innerText()).length > 0);
        if (variant === "cooldown") {
          assert.equal((await page.locator("[data-sync-start]").innerText()).trim(), S("coolingDown", { seconds: 95 }));
          assert.equal(await page.locator("[data-kinoko-import]").isDisabled(), true);
          await page.waitForFunction(() => /9[0-4]/.test(document.querySelector("[data-sync-start]").textContent), null, { timeout: 5000 });
        }
        if (variant === "failed") {
          const tags = await page.locator(".result-item .rw-tag").allInnerTexts();
          assert.deepEqual(tags.map((x) => x.trim()), [S("failed"), S("failed")]);
          await page.locator(".rs-last__overall.is-failed").waitFor();
        }
      }
      const control = await syncControl(page);
      assert.equal(control.state, e.control, `${variant}: shell control state`);
      assert.equal(control.dot, e.dot, `${variant}: shell control mark`);
      assert.equal(control.label, msg(zh, "rework.account.sync.indicator.label", { state: S(`indicator.${e.control}`) }));
      if (["ready", "unbound", "failed"].includes(variant)) await shot(page, `sync-${variant}-intercepted-zh-1440-light`, true);
    }
    step("the control keeps the state on other pages and drops it for another account");
    await go(page, "zh", "/about");
    assert.equal((await syncControl(page)).state, "failed");
    await page.evaluate(() => {
      const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
      nuxt.payload.state["$saccount-binding-generation"]++;
    });
    await page.waitForFunction(() => !document.querySelector("[data-sync-control]").hasAttribute("data-sync-state"));
    return { intercepted: true, variants: Object.keys(expect).length };
  });

  // 3. Sync requests: pending, outcomes, failures, cancellation (scripted responses)
  await scenario("sync-run", { width: 390, theme: "dark" }, async ({ page, state, calls, step, release }) => {
    const respondSync = (log, after) => {
      const fn = () => {
        if (after) state.sync = after;
        return { json: { ok: true, goalEvaluation: { profileId: "1", outcome: "no-active-goal", activeGoal: null, recentCompletedGoal: null }, currentBinding: null, log } };
      };
      fn.once = true;
      state.respond.sync = fn;
    };
    state.sync = "never";
    await enterSignedIn(page, base, "zh", "/account/sync", state);
    await page.locator(".rs-over").waitFor();
    step("no target chosen: warning beside the button, no request");
    await page.click("[data-sync-start]");
    await page.locator("[data-sync-notice][role=status]", { hasText: S("selectTarget") }).waitFor();
    assert.equal(countCalls(calls, "sync"), 0);
    step("pending: button busy, targets locked, shell control running, a second click sends nothing");
    await page.locator(".target-item", { hasText: "Viewer" }).locator("input").check();
    state.hold.add("sync");
    respondSync(syncLog("success", 12), { ...fixtureSyncOverview("ready"), cooldownRemainingSeconds: 1800, lastSync: syncLog("success", 12) });
    await page.click("[data-sync-start]");
    await page.waitForFunction(() => document.querySelector("[data-sync-start]").disabled && document.querySelector("[data-sync-start]").getAttribute("aria-busy") === "true");
    assert.equal(await page.locator(".rs-over__targets").evaluate((f) => f.disabled), true);
    assert.equal((await syncControl(page)).state, "running");
    await page.locator("[data-sync-start]").click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
    assert.equal(countCalls(calls, "sync"), 1);
    assert.deepEqual(lastCall(calls, "sync").body, { profileId: "1", targetIds: ["viewer"] });
    await shot(page, "sync-pending-intercepted-zh-390-dark");
    await release("sync");
    step("success: the result line, toast, next steps, cooldown, the control");
    await page.locator("[data-sync-notice].rw-alert--ok", { hasText: S("syncSuccess", { success: 2, total: 2 }) }).waitFor();
    await message(page, S("syncSuccess", { success: 2, total: 2 }));
    await page.locator(".sync-next[aria-labelledby]").waitFor();
    assert.deepEqual(await page.locator(".sync-next nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), ["/account/songs", "/my/growth", "/tools/recommend"]);
    await page.waitForFunction(() => document.querySelector("[data-sync-start]").textContent.includes("1800") || document.querySelector("[data-sync-start]").textContent.includes("179"));
    assert.equal((await syncControl(page)).state, "ok");
    await shot(page, "sync-success-intercepted-zh-390-dark", true);
    const outcomes = [
      ["partial", syncLog("partial", 13), "warning", S("syncPartial", { success: 1, total: 2, failed: "，OurTaiko" }), true],
      ["failed", syncLog("failed", 14), "alert", "Viewer：上游暂时无响应；OurTaiko：目标服务维护中", false],
      ["missing", null, "status", S("noResult"), false]
    ];
    for (const [name, log, kind, text, next] of outcomes) {
      step(`outcome ${name}`);
      state.sync = { ...fixtureSyncOverview(name === "missing" ? "ready" : name === "partial" ? "partial" : "failed"), lastSync: log ? { ...log } : syncLog("failed", 14) };
      await revisit(page, "zh", "/account/sync");
      await page.locator(".rs-over").waitFor();
      await page.locator(".target-item", { hasText: "Viewer" }).locator("input").check();
      respondSync(log);
      await page.click("[data-sync-start]");
      const notice = page.locator(`[data-sync-notice][role=${kind === "alert" ? "alert" : "status"}]`, { hasText: text });
      await notice.waitFor();
      if (name === "partial") assert.ok((await notice.getAttribute("class")).includes("rw-alert--warn"));
      assert.equal(await page.locator(".sync-next").count(), next ? 1 : 0, `${name}: next steps`);
      if (name === "failed") await shot(page, "sync-failed-intercepted-zh-390-dark");
    }
    step("transport failures: server message, same retry (the button)");
    for (const [status, message] of [[500, "同步服务异常"], [504, "Gateway Timeout"], [409, "profile-changed"], [503, "服务端暂未配置鼓众广场访问凭据，暂时无法拉取成绩，请联系管理员"]]) {
      state.sync = "ready";
      await revisit(page, "zh", "/account/sync");
      await page.locator(".target-item", { hasText: "Viewer" }).locator("input").check();
      state.fail.sync = { status, message };
      await page.click("[data-sync-start]");
      await page.locator("[data-sync-notice][role=alert]", { hasText: message }).waitFor();
      assert.equal(await page.locator("[data-sync-start]").isEnabled(), true, "retry is the same button");
      delete state.fail.sync;
    }
    step("cancellation: leaving while the request runs — the late answer is ignored");
    await page.waitForFunction(() => !document.querySelector(".el-message"), null, { timeout: 15000 });
    state.sync = "ready";
    await revisit(page, "zh", "/account/sync");
    await page.locator(".target-item", { hasText: "Viewer" }).locator("input").check();
    state.hold.add("sync");
    respondSync(syncLog("success", 20));
    const before = countCalls(calls, "sync");
    await page.click("[data-sync-start]");
    await waitCall(page, calls, "sync", before + 1);
    await go(page, "zh", "/about");
    assert.equal((await syncControl(page)).state === "running", false, "leaving ends the page's request state");
    await release("sync");
    await page.waitForTimeout(400);
    assert.equal(await page.locator(".el-message", { hasText: S("syncSuccess", { success: 2, total: 2 }) }).count(), 0, "no late toast");
    await go(page, "zh", "/account/sync");
    await page.locator(".rs-over").waitFor();
    assert.equal(await page.locator("[data-sync-notice]").count(), 0, "no late result line");
    assert.equal(await page.locator("[data-sync-start]").getAttribute("aria-busy"), null);
    step("goal context changed: warning, no request");
    state.sync = "ready";
    const n = countCalls(calls, "sync");
    await go(page, "zh", "/about");
    await go(page, "zh", "/account/sync?from=goal&profileId=2");
    await page.locator(".goal-sync-result [role=alert]", { hasText: S("goal.changed") }).waitFor();
    await page.locator(".target-item", { hasText: "Viewer" }).locator("input").check();
    await page.click("[data-sync-start]");
    await page.locator("[data-sync-notice]", { hasText: S("goal.changed") }).waitFor();
    assert.equal(countCalls(calls, "sync"), n);
    assert.equal(await page.locator(".goal-return").getAttribute("href"), "/#current-goal");
    assert.ok(await noOverflow(page));
    return { intercepted: true };
  });

  // 4. Score token: issue (one-time display, copy), rotate, revoke with confirmation, failure; secrets stay put
  await scenario("sync-token", { width: 1440 }, async ({ page, context, state, calls, step }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    state.sync = "ready";
    await enterSignedIn(page, base, "zh", "/account/sync", state);
    await page.locator(".rs-token").waitFor();
    assert.equal((await page.locator("[data-token-mask]").innerText()).trim(), S("scoreTokenEmpty"));
    assert.equal(await page.locator("[data-token-revoke]").count(), 0);
    step("issue → the plaintext once, in the one-time block");
    const issued = () => {
      state.sync = "token";
      return { json: { token: SYNTHETIC_SCORE_TOKEN, status: null } };
    };
    issued.once = true;
    state.respond.scoreToken = issued;
    await page.click("[data-token-issue]");
    await page.locator(".token-reveal[role=status] [data-token-value]", { hasText: SYNTHETIC_SCORE_TOKEN }).waitFor();
    assert.deepEqual(lastCall(calls, "scoreToken").body, { action: "issue" });
    await message(page, S("scoreTokenIssued"));
    assert.equal(await page.locator(`text=${SYNTHETIC_SCORE_TOKEN}`).count(), 1, "rendered once");
    assert.deepEqual(await secretLeaks(page, SYNTHETIC_SCORE_TOKEN), []);
    const valueBox = await page.locator("[data-token-value]").evaluate((el) => ({ overflowX: getComputedStyle(el).overflowX, nowrap: getComputedStyle(el).whiteSpace }));
    assert.deepEqual(valueBox, { overflowX: "auto", nowrap: "nowrap" });
    await page.locator(".token-reveal .rw-btn").click();
    await message(page, S("scoreTokenCopied"));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), SYNTHETIC_SCORE_TOKEN);
    await page.locator(".rs-token").screenshot({ path: resolve(out, `${label}_sync-token-revealed-SYNTHETIC-intercepted-zh-1440-light.png`) });
    step("rotate label, mask shown; revoke is outlined danger");
    assert.equal((await page.locator("[data-token-issue]").innerText()).trim(), S("scoreTokenRotate"));
    assert.ok((await page.locator("[data-token-mask]").innerText()).includes("SYNTHETIC"));
    assert.ok((await page.locator("[data-token-revoke]").getAttribute("class")).includes("rw-btn--danger"));
    step("revoke: confirmation first; Esc cancels without a request");
    const before = countCalls(calls, "scoreToken");
    await page.click("[data-token-revoke]");
    const dialog = page.locator(".el-message-box");
    await dialog.waitFor();
    assert.ok(await dialog.locator("text=" + S("scoreTokenConfirm")).count());
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest(".el-message-box, .el-overlay"))), true, "focus inside the dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(countCalls(calls, "scoreToken"), before);
    assert.equal(await page.locator("[data-token-value]").count(), 1, "cancel keeps the shown token");
    step("revoke confirmed → request, plaintext gone");
    const revoked = () => {
      state.sync = "ready";
      return { json: { token: null, status: null } };
    };
    revoked.once = true;
    state.respond.scoreToken = revoked;
    await page.click("[data-token-revoke]");
    await dialog.waitFor();
    await dialog.locator(".el-button--primary").click();
    await message(page, S("scoreTokenRevoked"));
    assert.deepEqual(lastCall(calls, "scoreToken").body, { action: "revoke" });
    await page.waitForFunction(() => !document.querySelector("[data-token-value]"));
    assert.equal(await page.locator(`text=${SYNTHETIC_SCORE_TOKEN}`).count(), 0);
    step("failure: the service message beside the actions");
    state.fail.scoreToken = { status: 503, message: S("scoreTokenUnavailable") };
    await page.click("[data-token-issue]");
    await page.locator(".rs-token .rw-alert[role=alert]", { hasText: S("scoreTokenUnavailable") }).waitFor();
    delete state.fail.scoreToken;
    step("the token is not kept: leaving the page clears it");
    state.respond.scoreToken = issued;
    await page.click("[data-token-issue]");
    await page.locator("[data-token-value]").waitFor();
    await revisit(page, "zh", "/account/sync");
    await page.locator(".rs-token").waitFor();
    assert.equal(await page.locator("[data-token-value]").count(), 0, "no plaintext after leaving");
    assert.deepEqual(await secretLeaks(page, SYNTHETIC_SCORE_TOKEN), []);
    step("unavailable service: the warning instead of the controls");
    state.sync = "tokenOff";
    await revisit(page, "zh", "/account/sync");
    await page.locator(".rs-token .rw-alert--warn", { hasText: S("scoreTokenUnavailable") }).waitFor();
    assert.equal(await page.locator("[data-token-issue]").count(), 0);
    return { intercepted: true, syntheticTokenOnly: true };
  });

  // 5. Kinoko import: validation, show toggle, Enter submits, partial / history / cooldown answers
  await scenario("sync-kinoko", { width: 390 }, async ({ page, state, calls, step, release }) => {
    state.sync = "ready";
    await enterSignedIn(page, base, "zh", "/account/sync", state);
    await page.locator(".rs-kinoko").waitFor();
    assert.equal(await page.getAttribute("#sync-kinoko-key", "type"), "password");
    assert.equal(await page.getAttribute("#sync-kinoko-key", "autocomplete"), "off");
    step("empty key: the error under the field, focus there, no request");
    await page.click("[data-kinoko-import]");
    await page.locator("#sync-kinoko-key-error[role=alert]", { hasText: S("kinokoNeedKey") }).waitFor();
    assert.equal(await page.getAttribute("#sync-kinoko-key", "aria-invalid"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "sync-kinoko-key");
    assert.equal(countCalls(calls, "kinoko") + countCalls(calls, "kinokoHistory"), 0);
    step("show toggle; Enter submits the current-score import");
    await page.fill("#sync-kinoko-key", ` ${SYNTHETIC_KINOKO_KEY} `);
    await page.click(".rs-kinoko .rw-pw button");
    assert.equal(await page.getAttribute("#sync-kinoko-key", "type"), "text");
    const partial = () => ({ json: { partial: true, message: "部分记录未导入（合成）", summary: { added: 1, updated: 0, unchanged: 0, total: 1 } } });
    partial.once = true;
    state.respond.kinoko = partial;
    await page.press("#sync-kinoko-key", "Enter");
    await page.locator("[data-kinoko-notice].rw-alert--warn", { hasText: "部分记录未导入（合成）" }).waitFor();
    assert.deepEqual(lastCall(calls, "kinoko").body, { apiKey: SYNTHETIC_KINOKO_KEY });
    assert.equal(await page.inputValue("#sync-kinoko-key"), "", "key cleared after an accepted import");
    await page.locator(".sync-next").waitFor();
    step("full history import");
    await page.fill("#sync-kinoko-key", SYNTHETIC_KINOKO_KEY);
    const history = () => ({ json: { summary: { history: { importedRecords: 5, skippedRecords: 2, snapshotFiles: 3 } } } });
    history.once = true;
    state.respond.kinokoHistory = history;
    await page.click("[data-kinoko-history]");
    await page.locator("[data-kinoko-notice].rw-alert--ok", { hasText: S("kinokoHistoryDone", { imported: 5, skipped: 2, files: 3 }) }).waitFor();
    assert.deepEqual(lastCall(calls, "kinokoHistory").body, { apiKey: SYNTHETIC_KINOKO_KEY });
    step("server refusal (cooldown) and pending state");
    await page.fill("#sync-kinoko-key", SYNTHETIC_KINOKO_KEY);
    state.hold.add("kinoko");
    state.fail.kinoko = { status: 429, message: "同步冷却中，请在 120 秒后重试" };
    await page.click("[data-kinoko-import]");
    await page.waitForFunction(() => document.querySelector("[data-kinoko-import]").disabled && document.querySelector("[data-kinoko-history]").disabled && document.querySelector("#sync-kinoko-key").disabled);
    assert.equal((await syncControl(page)).state, "running");
    await release("kinoko");
    await page.locator("[data-kinoko-notice][role=alert]", { hasText: "同步冷却中" }).waitFor();
    assert.equal(await page.inputValue("#sync-kinoko-key"), SYNTHETIC_KINOKO_KEY, "a refused key stays for a retry");
    delete state.fail.kinoko;
    assert.deepEqual(await secretLeaks(page, SYNTHETIC_KINOKO_KEY), []);
    assert.ok(await noOverflow(page));
    await shot(page, "sync-kinoko-intercepted-zh-390-light");
    return { intercepted: true };
  });

  // 6. Developer page: application states, form, guide (reading), code blocks, copy
  await scenario("developer", { width: 1440 }, async ({ page, context, state, calls, step, release }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    const D = (key, values) => msg(zh, `rework.account.developer.${key}`, values);
    state.developer = "none";
    await enterSignedIn(page, base, "zh", "/account/developer", state);
    await page.locator("[data-developer-guide]").waitFor();
    step("not applied: one form, status, guide notice");
    assert.equal(await page.locator("#viewer-main form").count(), 1);
    assert.equal((await page.locator("[data-developer-status]").innerText()).trim(), D("notApplied"));
    assert.equal(await page.locator('a[href*="/account/developer/grants"]').count(), 0);
    step("validation: reason first, then e-mail; no request");
    await page.fill("#developer-reply-email", "");
    await page.click("[data-developer-submit]");
    await page.locator("#developer-reason-error[role=alert]", { hasText: D("needReason") }).waitFor();
    await page.fill("#developer-reason", "合成申请理由");
    await page.click("[data-developer-submit]");
    await page.locator("#developer-reply-email-error[role=alert]", { hasText: D("needEmail") }).waitFor();
    assert.equal(countCalls(calls, "apply"), 0);
    step("five images chosen → the first four kept; multipart request");
    await page.fill("#developer-reply-email", "developer-selfcheck@example.invalid");
    await page.locator(".rd-apply__file").setInputFiles([1, 2, 3, 4, 5].map((n) => ({ name: `synthetic-${n}.png`, mimeType: "image/png", buffer: PNG })));
    assert.equal(await page.locator(".rd-apply__files li").count(), 4);
    await page.locator("#developer-images-state", { hasText: D("selectedImages", { count: 4 }) }).waitFor();
    state.hold.add("apply");
    await page.click("[data-developer-submit]");
    await page.waitForFunction(() => document.querySelector("[data-developer-submit]").disabled);
    await page.locator("[data-developer-submit]").click({ force: true }).catch(() => {});
    state.developer = "pending";
    await release("apply");
    await message(page, D("submitSuccess"));
    const apply = lastCall(calls, "apply");
    assert.equal(countCalls(calls, "apply"), 1);
    assert.equal(apply.body.multipart, true);
    assert.deepEqual([...new Set(apply.body.fields)].sort(), ["images", "reason", "replyEmail"]);
    assert.equal(apply.body.images, 4);
    await page.locator("[data-developer-status]", { hasText: D("statusLabel.pending") }).waitFor();
    assert.equal(await page.locator("#viewer-main form").count(), 0, "pending: no form");
    step("guide: overview opens and focuses the panel; code scrolls in place; copy");
    const guideCopy = await page.evaluate(() => null);
    await page.locator('.api-overview-item[href="#developer-api-catalog"]').click();
    const panel = page.locator('[data-api="catalog"]');
    assert.notEqual(await panel.getAttribute("open"), null);
    assert.equal(await panel.locator(":scope > summary").evaluate((el) => document.activeElement === el), true);
    const pre = await panel.locator('[data-example="curl"] pre').evaluate((el) => ({ overflowX: getComputedStyle(el).overflowX, scrolls: el.scrollWidth >= el.clientWidth }));
    assert.equal(pre.overflowX, "auto");
    await panel.locator('[data-example="curl"] button').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(copied.includes("/api/v1/taiko/catalog/songs") && !copied.includes("Authorization"));
    await panel.getByRole("tab", { name: "Python", exact: true }).click();
    assert.ok(await panel.locator('[data-example="python"] pre').isVisible());
    await shot(page, "developer-pending-intercepted-zh-1440-light", true);
    step("rejected: the form again and the review note");
    state.developer = "rejected";
    await revisit(page, "zh", "/account/developer");
    await page.locator(".review-note", { hasText: "用途描述不足" }).waitFor();
    assert.equal(await page.locator("#viewer-main form").count(), 1);
    step("approved: active token, no form, no guide notice; inactive token: notice; reviewer: review link");
    state.developer = "approved";
    await revisit(page, "zh", "/account/developer");
    await page.locator("[data-developer-status]", { hasText: D("statusLabel.approved") }).waitFor();
    assert.equal(await page.locator("#viewer-main form").count(), 0);
    assert.equal(await page.locator("[data-developer-guide] [role=status]").count(), 0);
    assert.ok((await page.locator(".rd-status__mask").innerText()).includes("SYNTHETIC"));
    state.developer = "approvedInactive";
    await revisit(page, "zh", "/account/developer");
    await page.locator("[data-developer-guide] [role=status]").waitFor();
    state.developer = "reviewer";
    await revisit(page, "zh", "/account/developer");
    assert.equal(await page.locator(".review-link").getAttribute("href"), "/account/developer/review");
    step("read failure: failed state with retry");
    state.fail.developer = 500;
    await revisit(page, "zh", "/account/developer");
    await page.locator(".rw-state--failed").waitFor();
    delete state.fail.developer;
    await page.locator(".rw-state--failed button").click();
    await page.locator("[data-developer-status]").waitFor();
    return { intercepted: true, guideCopy };
  });

  // 7. Developer review: approve (prompt → one-time token alert, synthetic), reject (required reason), forbidden
  await scenario("developer-review", { width: 1440 }, async ({ page, state, calls, step, release }) => {
    const R = (key, values) => msg(zh, `rework.account.developerReview.${key}`, values);
    await enterSignedIn(page, base, "zh", "/account/developer/review", state);
    await page.locator("[data-application-id='41']").waitFor();
    step("approve: prompt; cancel sends nothing");
    await page.locator("[data-application-id='41'] [data-review-approve]").click();
    const box = page.locator(".el-message-box");
    await box.waitFor();
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "hidden" });
    assert.equal(countCalls(calls, "reviewDecision"), 0);
    step("approve with a note → issued token shown once in the alert (synthetic)");
    const approve = () => ({ json: { issuedToken: SYNTHETIC_DEVELOPER_TOKEN, mailDelivered: false } });
    approve.once = true;
    state.respond.reviewDecision = approve;
    await page.locator("[data-application-id='41'] [data-review-approve]").click();
    await box.waitFor();
    await box.locator("input").fill("合成备注");
    state.hold.add("reviewDecision");
    await box.locator(".el-button--primary").click();
    await page.waitForFunction(() => [...document.querySelectorAll("[data-review-approve],[data-review-reject]")].every((b) => b.disabled));
    await release("reviewDecision");
    assert.deepEqual(lastCall(calls, "reviewDecision").body, { applicationId: 41, action: "approve", reviewNote: "合成备注" });
    const tokenBox = page.locator(".el-message-box", { hasText: `Token: ${SYNTHETIC_DEVELOPER_TOKEN}` });
    await tokenBox.waitFor();
    await page.waitForFunction(() => document.querySelectorAll(".el-message-box").length === 1);
    await page.screenshot({ path: resolve(out, `${label}_developer-review-token-SYNTHETIC-intercepted-zh-1440-light.png`) });
    await tokenBox.locator(".el-button--primary").click();
    await page.waitForFunction(() => !document.querySelector(".el-message-box"), null, { timeout: 10000 });
    step("reject: the reason is required");
    await page.locator("[data-application-id='42'] [data-review-reject]").click();
    await box.waitFor();
    await box.locator(".el-button--primary").click();
    await box.locator(".el-message-box__errormsg", { hasText: R("rejectValidation") }).waitFor();
    assert.equal(countCalls(calls, "reviewDecision"), 1);
    await box.locator("input").fill("合成驳回理由");
    await box.locator(".el-button--primary").click();
    await message(page, R("rejected"));
    assert.deepEqual(lastCall(calls, "reviewDecision").body, { applicationId: 42, action: "reject", reviewNote: "合成驳回理由" });
    assert.ok(await noOverflow(page));
    await shot(page, "developer-review-intercepted-zh-1440-light", true);
    step("forbidden (403) and transport failure (503) differ");
    state.review = "forbidden";
    await revisit(page, "zh", "/account/developer/review");
    await page.locator(".review-forbidden", { hasText: R("forbiddenTitle") }).waitFor();
    state.review = "full";
    state.fail.developerReview = 503;
    await revisit(page, "zh", "/account/developer/review");
    await page.locator(".rw-state--failed").waitFor();
    delete state.fail.developerReview;
    return { intercepted: true, syntheticTokenOnly: true };
  });

  // 8. Grants: records, revoke, consent, decline, paging, own apps (register, disable with confirm)
  await scenario("developer-grants", { width: 390 }, async ({ page, state, calls, step }) => {
    const G = (key) => msg(zh, `rework.account.grants.${key}`);
    state.developer = "approved";
    await enterSignedIn(page, base, "zh", "/account/developer/grants", state);
    await page.locator("[data-grant-id='g-active']").waitFor();
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("#viewer-main main").count(), 0, "no nested main landmark");
    step("labels: active, legacy scopes with expiry, revoked has no button");
    await page.locator("[data-grant-id='g-legacy']", { hasText: `${G("legacy")} · ${G("scores")}、${G("profile")}` }).waitFor();
    assert.equal(await page.locator("[data-grant-id='g-revoked'] button").count(), 0);
    step("revoke");
    await page.locator("[data-grant-id='g-active']").getByRole("button", { name: G("revoke"), exact: true }).click();
    await waitCall(page, calls, "grantRevoke", 1);
    assert.equal(lastCall(calls, "grantRevoke").path, "/api/account/developer/grants/g-active");
    await page.locator("[role=status]", { hasText: G("removed") }).waitFor();
    step("consent: needs both choices; decline clears; allow sends the consent body");
    await page.locator("details", { has: page.locator("#grant-app") }).locator("summary").click();
    const allow = page.getByRole("button", { name: G("allow"), exact: true });
    assert.equal(await allow.isDisabled(), true);
    await page.selectOption("#grant-app", "c-1");
    await page.selectOption("#grant-binding", "b-1");
    await page.getByRole("button", { name: G("decline"), exact: true }).click();
    assert.equal(await page.inputValue("#grant-app"), "");
    await page.locator("details", { has: page.locator("#grant-app") }).locator("summary").click();
    await page.selectOption("#grant-app", "c-1");
    await page.selectOption("#grant-binding", "b-1");
    await allow.click();
    await waitCall(page, calls, "grantCreate", 1);
    assert.deepEqual(lastCall(calls, "grantCreate").body, { bindingId: "b-1", clientId: "c-1", consent: true, consentVersion: "2026-01", audience: "viewer:developer-api:v1" });
    step("paging focuses the list heading");
    await page.getByRole("navigation", { name: G("grantRecords"), exact: true }).getByRole("button", { name: G("next"), exact: true }).click();
    await page.locator("[data-grant-id='g-old']").waitFor();
    assert.equal(lastCall(calls, "grants").query.before, "cursor-1");
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "H2");
    step("own apps: register; disable asks first (dismiss → nothing, accept → DELETE)");
    const apps = page.locator("details", { has: page.locator("#client-name") });
    await apps.locator("summary").click();
    await page.fill("#client-name", "  Synthetic New App  ");
    await page.getByRole("button", { name: G("register"), exact: true }).click();
    await waitCall(page, calls, "clientCreate", 1);
    assert.deepEqual(lastCall(calls, "clientCreate").body, { displayName: "Synthetic New App" });
    page.once("dialog", (d) => d.dismiss());
    await page.locator("[data-client-id='c-1']").getByRole("button", { name: G("disable"), exact: true }).click();
    await page.waitForTimeout(200);
    assert.equal(countCalls(calls, "clientDisable"), 0);
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-client-id='c-1']").getByRole("button", { name: G("disable"), exact: true }).click();
    await waitCall(page, calls, "clientDisable", 1);
    assert.equal(lastCall(calls, "clientDisable").path, "/api/account/developer/clients/c-1");
    assert.ok(await noOverflow(page));
    assert.deepEqual(await touchTargets(page), []);
    await shot(page, "developer-grants-intercepted-zh-390-light", true);
    return { intercepted: true };
  });

  // 9. Support: validation, create (mail failed → warning), list, thread, follow-up, closed, detail failure
  await scenario("support", { width: 1440 }, async ({ page, state, calls, step, release }) => {
    const T = (key, values) => msg(zh, `rework.account.support.${key}`, values);
    await enterSignedIn(page, base, "zh", "/support", state);
    await page.locator("[data-ticket-id='21']").waitFor();
    assert.equal(await page.inputValue("#support-contact"), "account-selfcheck@example.invalid", "contact defaults to the account e-mail");
    step("validation: title, then content; focus moves; no request");
    await page.click("[data-support-submit]");
    await page.locator("#support-title-error[role=alert]", { hasText: T("needTitle") }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "support-title");
    await page.fill("#support-title", "合成工单标题");
    await page.click("[data-support-submit]");
    await page.locator("#support-content-error[role=alert]", { hasText: T("needContent") }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "support-content");
    assert.equal(countCalls(calls, "ticketCreate"), 0);
    step("Enter in the title does not submit (as before)");
    await page.press("#support-title", "Enter");
    await page.waitForTimeout(150);
    assert.equal(countCalls(calls, "ticketCreate"), 0);
    step("create: exact body, pending state, mail failure is a warning, draft cleared");
    await page.selectOption("#support-category", "feature");
    await page.fill("#support-content", "合成工单内容\n第二行");
    const created = () => ({ json: { ok: true, ticket: supportTicket(77), mailDelivered: false } });
    created.once = true;
    state.respond.ticketCreate = created;
    state.hold.add("ticketCreate");
    await page.click("[data-support-submit]");
    await page.waitForFunction(() => document.querySelector("[data-support-submit]").disabled);
    await release("ticketCreate");
    await message(page, T("submitQueued").replace("{id}", "77"));
    assert.deepEqual(lastCall(calls, "ticketCreate").body, { category: "feature", title: "合成工单标题", contact: "account-selfcheck@example.invalid", content: "合成工单内容\n第二行" });
    assert.equal(await page.inputValue("#support-title"), "");
    assert.equal(await page.inputValue("#support-content"), "");
    step("thread: open, follow-up validation and send, collapse");
    const t21 = page.locator("[data-ticket-id='21']");
    await t21.locator("[data-ticket-toggle]").click();
    assert.equal(await t21.locator("[data-ticket-toggle]").getAttribute("aria-expanded"), "true");
    await t21.locator(".thread-item--staff").waitFor();
    await t21.locator("[data-follow-up]").click();
    await t21.locator(".rw-field__error[role=alert]", { hasText: T("needFollowUp") }).waitFor();
    assert.equal(countCalls(calls, "followUp"), 0);
    await t21.locator("textarea").fill("合成追加留言");
    const reply = () => ({ json: { ok: true, ticket: fixtureTicketDetail(supportTicket(21), [{ id: 3, authorRole: "user", authorUserId: 7001, content: "合成追加留言", mailStatus: "sent", createdAt: "2026-11-18T00:00:00.000Z" }]), mailDelivered: true } });
    reply.once = true;
    state.respond.followUp = reply;
    await t21.locator("[data-follow-up]").click();
    await message(page, T("followUpSuccess"));
    assert.deepEqual(lastCall(calls, "followUp").body, { content: "合成追加留言" });
    assert.equal(lastCall(calls, "followUp").path, "/api/support/tickets/21/messages");
    await t21.locator(".thread-item", { hasText: "合成追加留言" }).waitFor();
    assert.equal(await t21.locator("textarea").inputValue(), "");
    await shot(page, "support-intercepted-zh-1440-light", true);
    await t21.locator("[data-ticket-toggle]").click();
    assert.equal(await t21.locator(".ticket-thread").count(), 0);
    step("closed ticket: the closed hint, no reply box; long text wraps");
    const t20 = page.locator("[data-ticket-id='20']");
    await t20.locator("[data-ticket-toggle]").click();
    await t20.locator(".closed-hint", { hasText: T("closedHint") }).waitFor();
    assert.equal(await t20.locator("textarea").count(), 0);
    assert.ok(await noOverflow(page));
    step("detail failure: message and retry");
    state.fail.ticketDetail = 500;
    const t19 = page.locator("[data-ticket-id='19']");
    await t19.locator("[data-ticket-toggle]").click();
    await t19.locator(".rw-state--failed", { hasText: T("detailFailed") }).waitFor();
    delete state.fail.ticketDetail;
    await t19.locator(".rw-state--failed button").click();
    await t19.locator(".thread-item--staff").waitFor();
    step("list failure and empty list");
    state.fail.tickets = 500;
    await revisit(page, "zh", "/support");
    await page.locator(".rst .rw-state--failed").waitFor();
    delete state.fail.tickets;
    state.tickets = "empty";
    await page.locator(".rst .rw-state--failed button").click();
    await page.locator(".rst__empty", { hasText: T("empty") }).waitFor();
    return { intercepted: true };
  });

  // 10. Support review: select, reply, reply and close, close; required text; forbidden
  await scenario("support-review", { width: 1440 }, async ({ page, state, calls, step, release }) => {
    const V = (key) => msg(zh, `rework.account.supportReview.${key}`);
    await enterSignedIn(page, base, "zh", "/account/support/review", state);
    await page.locator("[data-review-ticket='51']").waitFor();
    await page.locator(".rsr__placeholder", { hasText: V("selectAny") }).waitFor();
    step("select → detail; reply needs text");
    await page.click("[data-review-ticket='51']");
    await page.locator(".rsr__detail-title", { hasText: "#51" }).waitFor();
    assert.equal(await page.locator("[data-review-ticket='51']").getAttribute("aria-current"), "true");
    await page.click("[data-review-reply]");
    await message(page, V("needReply"));
    assert.equal(countCalls(calls, "supportReply"), 0);
    step("reply (open stays selected)");
    await page.fill("#support-review-reply", "合成回复");
    const answer = (close) => {
      const fn = () => ({ json: { ok: true, ticket: { ...fixtureTicketDetail(supportTicket(51)), status: close ? "closed" : "open" }, mailDelivered: true } });
      fn.once = true;
      return fn;
    };
    state.respond.supportReply = answer(false);
    state.hold.add("supportReply");
    await page.click("[data-review-reply]");
    await page.waitForFunction(() => ["[data-review-reply]", "[data-review-reply-close]", "[data-review-close]"].every((s) => document.querySelector(s).disabled));
    await release("supportReply");
    await message(page, V("replySuccess"));
    assert.deepEqual(lastCall(calls, "supportReply").body, { content: "合成回复", close: false });
    assert.equal(lastCall(calls, "supportReply").path, "/api/account/support/review/51/reply");
    step("reply and close → selection cleared");
    await page.fill("#support-review-reply", "合成回复并关闭");
    state.respond.supportReply = answer(true);
    await page.click("[data-review-reply-close]");
    await page.locator(".rsr__placeholder").waitFor();
    assert.deepEqual(lastCall(calls, "supportReply").body, { content: "合成回复并关闭", close: true });
    step("close only");
    await page.click("[data-review-ticket='52']");
    await page.locator(".rsr__detail-title", { hasText: "#52" }).waitFor();
    const closed = () => ({ json: { ok: true, ticket: { ...fixtureTicketDetail(supportTicket(52)), status: "closed" } } });
    closed.once = true;
    state.respond.supportClose = closed;
    await page.click("[data-review-close]");
    await message(page, V("closeSuccess"));
    assert.equal(lastCall(calls, "supportClose").path, "/api/account/support/review/52/close");
    assert.ok(await noOverflow(page));
    await shot(page, "support-review-intercepted-zh-1440-light", true);
    return { intercepted: true };
  });

  // The review page reads once (useAsyncData, as before): a refusal is shown when the page is opened.
  await scenario("support-review-forbidden", { width: 820 }, async ({ page, state }) => {
    state.review = "forbidden";
    await enterSignedIn(page, base, "zh", "/account/support/review", state);
    await page.locator(".review-forbidden", { hasText: msg(zh, "rework.account.supportReview.forbiddenTitle") }).waitFor();
    assert.equal(await page.locator("[data-review-ticket]").count(), 0);
    await shot(page, "support-review-forbidden-intercepted-zh-820-light");
    return { intercepted: true };
  });

  await scenario("support-review-mobile", { width: 390, theme: "dark" }, async ({ page, state, step }) => {
    await enterSignedIn(page, base, "zh", "/account/support/review", state);
    await page.locator("[data-review-ticket='52']").waitFor();
    step("picking a ticket below 1100 px moves to the conversation");
    await page.click("[data-review-ticket='52']");
    await page.locator(".rsr__detail-title", { hasText: "#52" }).waitFor();
    await page.waitForFunction(() => document.activeElement?.classList.contains("rsr__detail-title"));
    assert.ok(await noOverflow(page));
    await shot(page, "support-review-intercepted-zh-390-dark");
    return { intercepted: true };
  });

  // 11. Keyboard: sync page from the targets to the start button; developer guide tabs
  await scenario("keyboard", { width: 1440 }, async ({ page, state, calls }) => {
    state.sync = "ready";
    await enterSignedIn(page, base, "zh", "/account/sync", state);
    await page.locator(".rs-over").waitFor();
    await page.locator("#viewer-main").focus();
    await tabTo(page, ".target-item input");
    await page.keyboard.press("Space");
    assert.equal(await page.locator(".target-item input").first().isChecked(), true);
    await tabTo(page, "[data-sync-start]");
    const respond = () => ({ json: { ok: true, goalEvaluation: null, log: syncLog("success", 30) } });
    respond.once = true;
    state.respond.sync = respond;
    await page.keyboard.press("Enter");
    await waitCall(page, calls, "sync", 1);
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, outline: el ? getComputedStyle(el).outlineStyle : "" };
    });
    return { intercepted: true, focusAfter: focus };
  });

  // 12. Matrix: pages × widths × themes (zh) + ja samples; long text
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const shots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-360-light"]);
  for (const combo of combos)
    await scenario("matrix", combo, async ({ page, state, step }) => {
      const { width, theme, lang } = combo;
      const key = `${lang}-${width}-${theme}`;
      step("/docs/score-token (real)");
      await page.goto(`${base}${prefix(lang)}/docs/score-token`, { waitUntil: "networkidle" });
      assert.ok((await htmlClasses(page)).includes("rework-ep"));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(await noOverflow(page), "docs: no horizontal overflow");
      if (shots.has(key)) await shot(page, `docs-real-${key}`, true);
      state.sync = "long";
      state.developer = "long";
      state.signedIn = true;
      await injectSignedIn(page, state.user);
      for (const [path, ready] of [
        ["/account/sync", ".rs-over"],
        ["/account/developer", "[data-developer-guide]"],
        ["/account/developer/grants", "[data-grant-id]"],
        ["/account/developer/review", "[data-application-id]"],
        ["/support", "[data-ticket-id]"],
        ["/account/support/review", "[data-review-ticket]"]
      ]) {
        step(path);
        await go(page, lang, path);
        await page.locator(ready).first().waitFor();
        if (path === "/support") await page.locator("[data-ticket-id='20'] [data-ticket-toggle]").click(), await page.locator("[data-ticket-id='20'] .closed-hint").waitFor();
        if (path === "/account/support/review") await page.click("[data-review-ticket='52']"), await page.locator(".rsr__detail-title").waitFor();
        assert.ok((await htmlClasses(page)).includes("rework-ep"), `${path}: rework-ep`);
        assert.equal(await page.locator("h1").count(), 1, `${path}: one h1`);
        assert.ok(await noOverflow(page), `${path}: no horizontal overflow`);
        assert.deepEqual(await touchTargets(page), [], `${path}: touch targets`);
        if (shots.has(key)) await shot(page, `${path.replace(/^\//, "").replace(/\//g, "-")}-intercepted-${key}`, true);
      }
      return { intercepted: true, longText: true };
    });

  // 13. Element Plus mapping on these pages, off elsewhere; the confirmation leaves no node behind
  // Slice G: the page without the mapping is /annual (out of scope); every reworked page has it by default.
  await scenario("element-plus-switch", { width: 820 }, async ({ page, state }) => {
    // /annual renders only for phones (middleware/annual-mobile.global.ts; a desktop browser is sent to the home page),
    // so this page presents itself as one; the shell and the reworked pages do not depend on the user agent.
    await page.setExtraHTTPHeaders({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await page.addInitScript((ua) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua }), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(`${base}/annual`, { waitUntil: "networkidle" });
    assert.ok(!(await htmlClasses(page)).includes("rework-ep"));
    const baseline = await page.evaluate(() => document.body.children.length);
    state.sync = "token";
    state.signedIn = true;
    await injectSignedIn(page, state.user);
    await go(page, "zh", "/account/sync");
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    await page.click("[data-token-revoke]");
    await page.locator(".el-message-box").waitFor();
    const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--el-color-primary").trim());
    await page.keyboard.press("Escape");
    await page.locator(".el-message-box").waitFor({ state: "hidden" });
    await go(page, "zh", "/annual");
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    const after = await page.evaluate(() => document.body.children.length);
    assert.ok(after <= baseline + 3, `body nodes ${baseline} → ${after}`);
    await page.goBack();
    await page.waitForURL(/\/account\/sync/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    return { primaryUnderMapping: primary };
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
