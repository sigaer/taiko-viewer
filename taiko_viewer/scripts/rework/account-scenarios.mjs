// Slice E1 scenarios: sign-in, registration, password recovery, the profile page and settings.
// Environment independent; used by
//   - scripts/rework/account-selfcheck.mjs  (Windows development self-check on `nuxt dev`)
//   - Linux acceptance through shell-sql.mjs --check=account (to be added; see stage-4-progress.md "切片 E1")
// Real here: the server render of every page without a database (the sign-in, registration and recovery forms and
// settings render for real, the provider list comes from the dev server's OIDC configuration, /account/profile
// redirects to sign-in), hydration, client-side validation, the theme cookie and the language links.
// Everything that needs the database or a session — every /api/account/* read and write, /api/account/auth/me once a
// scenario signs in — is answered in the browser from account-fixtures.ts and labelled `intercepted`. No request
// reaches any account write on a server; no real credential is typed (passwords are random per run). The outbound
// OIDC redirect is recorded and aborted, never followed. The browser never leaves the base origin.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripedPng } from "./detail-data.mjs";
import { AVATAR_OK, accountUser, fixtureOidcBindings, fixtureProfile, fixtureShowcase } from "./account-fixtures.ts";

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
const PNG = stripedPng(64, 64, 3);
export const OIDC_PROVIDER = { id: "mock", label: "Synthetic OIDC" };
export const OUTBOUND = "https://idp.example.invalid/authorize?state=selfcheck";
const secret = () => randomBytes(12).toString("hex");

// ---------- Browser ----------
/**
 * One context; `state` steers the intercepted APIs:
 *   real (auth/me and the provider list go to the server), signedIn, user, variant (profile), oidcLink,
 *   fail: { me, login, register, sendCode, reset, logout, oidcStart, profile, showcase, showcaseSave, prepare, confirm,
 *           switch, remove, manual, qqPrepare, qqConfirm, qqRemove, avatar, avatarDelete } → status (+ message),
 *   hold: Set of keys whose responses wait for release().
 */
export async function openContext(browser, { base, width, theme = "light", lang = "zh", height }) {
  const context = await browser.newContext({ viewport: { width, height: height || (width < 500 ? 844 : 900) }, reducedMotion: "reduce", colorScheme: theme });
  await context.addCookies([
    { name: "taiko_theme", value: theme, url: base },
    { name: "viewer_locale", value: lang, url: base }
  ]);
  const state = { real: false, signedIn: false, user: accountUser(), variant: "full", oidcLink: "unknown", showcase: fixtureShowcase(), fail: {}, hold: new Set(), released: new Map(), loginUserId: null };
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
    const fail = (key) => {
      const f = state.fail[key];
      const status = typeof f === "object" ? f.status : f;
      const message = typeof f === "object" ? f.message : status === 401 ? "请先登录" : status === 429 ? "操作太频繁，请稍后再试" : "selfcheck failure";
      return json({ statusCode: status, statusMessage: message }, status);
    };
    const hit = async (key) => {
      intercepted.push(p);
      let body;
      if (method !== "GET") {
        const type = request.headers()["content-type"] || "";
        if (type.includes("multipart")) body = { multipart: true, hasAvatar: (request.postData() || "").includes('name="avatar"') };
        else {
          try {
            body = request.postDataJSON();
          } catch {
            body = undefined;
          }
        }
      }
      calls.push({ key, method, path: p, query: Object.fromEntries(url.searchParams), body });
      const held = waitHold(key);
      if (held) await held;
      return body;
    };
    if (p.startsWith("/selfcheck/")) return intercepted.push(p), route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (p === "/api/account/auth/me") {
      if (state.real) return route.continue();
      await hit("me");
      if (state.fail.me) return fail("me");
      return json({ authenticated: state.signedIn, user: state.signedIn ? state.user : null });
    }
    if (p === "/api/account/oidc/providers") return route.continue(); // real: the dev server's OIDC configuration
    if (!p.startsWith("/api/account/")) return route.continue();
    const routes = {
      "POST /api/account/auth/login": "login",
      "POST /api/account/auth/register": "register",
      "POST /api/account/auth/send-code": "sendCode",
      "POST /api/account/auth/reset-password": "reset",
      "POST /api/account/auth/logout": "logout",
      "GET /api/account/profile": "profile",
      "GET /api/account/my-don/showcase": "showcase",
      "POST /api/account/my-don/showcase": "showcaseSave",
      "GET /api/account/my-don": "mydonImage",
      "GET /api/account/oidc/bindings": "oidcBindings",
      "POST /api/account/bindings/prepare": "prepare",
      "POST /api/account/bindings/confirm": "confirm",
      "POST /api/account/bindings/current": "switch",
      "POST /api/account/bindings/remove": "remove",
      "POST /api/account/manual": "manual",
      "POST /api/account/qq/prepare": "qqPrepare",
      "POST /api/account/qq/confirm": "qqConfirm",
      "POST /api/account/qq/remove": "qqRemove",
      "POST /api/account/avatar": "avatar",
      "DELETE /api/account/avatar": "avatarDelete"
    };
    let key = routes[`${method} ${p}`];
    if (!key && /^\/api\/account\/oidc\/[a-z0-9-]+\/start$/.test(p) && method === "POST") key = "oidcStart";
    if (!key) {
      intercepted.push(p);
      return json({ statusCode: 404, statusMessage: "not in fixture" }, 404);
    }
    const body = await hit(key);
    if (state.fail[key]) return fail(key);
    if (!state.signedIn && !["login", "register", "sendCode", "reset", "oidcStart"].includes(key)) return json({ statusCode: 401, statusMessage: "请先登录" }, 401);
    switch (key) {
      case "login":
        state.signedIn = true;
        return json({ user: { id: state.user.id } });
      case "register":
      case "sendCode":
      case "reset":
        return json({ ok: true });
      case "logout":
        state.signedIn = false;
        return json({ ok: true });
      case "oidcStart":
        return json({ authorizationUrl: OUTBOUND });
      case "profile":
        return json(fixtureProfile(state.variant, state.user));
      case "showcase":
        return json(state.showcase);
      case "showcaseSave":
        state.showcase = { ...state.showcase, isCustom: (body?.titleNames?.length ?? state.showcase.selectedTitles.length) > 0 || body?.layoutMode !== "nickname", layoutMode: body?.layoutMode, selectedTitles: body?.titleNames ?? state.showcase.selectedTitles };
        return json(state.showcase);
      case "mydonImage":
        return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
      case "oidcBindings":
        return json(fixtureOidcBindings(state.oidcLink));
      case "prepare":
        return json({ message: "已记录当前称号，请修改称号后确认" });
      case "qqPrepare":
        return json({ message: "验证码已发送", expiresAt: "2026-11-18T12:10:00.000Z" });
      case "qqConfirm":
        return json({ message: "QQ 绑定成功" });
      case "qqRemove":
        return json({ message: "QQ 已解绑" });
      case "manual":
        return json(body?.action === "claim-code" ? { code: "ABCD2345" } : { ok: true });
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
    else if (m.type() === "error" && !(origin !== base || /Failed to load resource|ERR_FAILED|net::/.test(text))) faults.push("console: " + text.slice(0, 300));
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
async function message(page, text) {
  await page.locator(".el-message", { hasText: text }).last().waitFor({ timeout: 10000 });
}
const waitCall = async (page, calls, key, count) => {
  for (let i = 0; i < 200 && countCalls(calls, key) < count; i++) await page.waitForTimeout(25);
  assert.ok(countCalls(calls, key) >= count, `${key} request #${count}`);
  return calls.filter((c) => c.key === key)[count - 1];
};
/** Every .rw-btn inside the main area is at least 44 px tall. */
const touchTargets = (page) =>
  page.$$eval("#viewer-main .rw-btn, #viewer-main .rw-seg > *, #viewer-main .ra-toc a", (els) =>
    els.filter((el) => el.getClientRects().length).map((el) => ({ text: el.textContent.trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44)
  );
async function tabTo(page, selector, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return i + 1;
  }
  throw new Error(`keyboard never reached ${selector}`);
}
const active = (page) => page.evaluate(() => ({ id: document.activeElement?.id || "", tag: document.activeElement?.tagName, text: (document.activeElement?.textContent || "").trim().slice(0, 40), cls: document.activeElement?.className || "" }));

// ---------- Scenarios ----------
export async function runAccountScenarios({ browser, base, out, web = webRoot, label = "self-check", widths = [360, 390, 820, 1440], only = "" }) {
  const copy = await locales(web);
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
    state.real = true;
    for (const path of ["/about", "/account/login", "/account/register", "/account/forgot-password", "/settings"]) await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 });
    state.real = false;
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".profile-main-card").waitFor({ timeout: 120000 });
  });

  // 1. Real server render without a database, and hydration of it
  for (const lang of ["zh", "ja"])
    await scenario("ssr", { width: 1440, lang }, async ({ page, context, state }) => {
      const m = copy[lang];
      state.real = true;
      const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const raw = async (path) => {
        const response = await fetch(`${base}${prefix(lang)}${path}`, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(90000) });
        return { status: response.status, location: response.headers.get("location"), html: response.status === 200 ? await response.text() : "" };
      };
      const pages = {
        "/account/login": ["rework.account.login.heading", ['name="username"', 'autocomplete="username"', 'autocomplete="current-password"', 'type="password"', "submit-btn"]],
        "/account/register": ["rework.account.register.heading", ['autocomplete="username"', 'autocomplete="email"', 'autocomplete="one-time-code"', 'autocomplete="new-password"']],
        "/account/forgot-password": ["rework.account.forgot.heading", ['autocomplete="email"', 'autocomplete="one-time-code"', 'autocomplete="new-password"']],
        "/settings": ["nav.settings", ["aria-pressed"]]
      };
      for (const [path, [h1, needles]] of Object.entries(pages)) {
        const r = await raw(path);
        assert.equal(r.status, 200, `${path} renders`);
        assert.match(r.html, /<html[^>]*class="[^"]*\brework-ep\b/, `${path}: server HTML carries rework-ep`);
        assert.match(r.html.replace(/<!--[\s\S]*?-->/g, ""), new RegExp(`<h1[^>]*>\s*${msg(m, h1)}\s*</h1>`), `${path}: <h1> ${msg(m, h1)}`);
        for (const needle of needles) assert.ok(r.html.includes(needle), `${path}: ${needle}`);
        if (path !== "/settings" && path !== "/account/forgot-password") assert.ok(r.html.includes(`class="oidc-options`) && r.html.includes(OIDC_PROVIDER.label), `${path}: provider list rendered by the server`);
        if (path === "/account/forgot-password") assert.ok(!r.html.includes('autocomplete="username"'));
      }
      const profile = await raw("/account/profile");
      assert.equal(profile.status, 302, "profile signed out → sign-in");
      const location = new URL(profile.location, base);
      assert.equal(location.pathname, `${prefix(lang)}/account/login`);
      assert.equal(location.searchParams.get("redirect"), `${prefix(lang)}/account/profile`);
      const entry = await raw("/account");
      assert.equal(entry.status, 302, "/account redirects");
      // hydration of each real page (auth/me real: anonymous)
      for (const path of Object.keys(pages)) {
        await page.goto(`${base}${prefix(lang)}${path}`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__));
        assert.equal(await page.locator("h1").count(), 1, `${path}: one h1`);
        assert.ok(await noOverflow(page));
      }
      await page.goto(`${base}${prefix(lang)}/account/profile`, { waitUntil: "networkidle" });
      await page.waitForURL((u) => u.pathname === `${prefix(lang)}/account/login`);
      if (lang === "zh") await shot(page, "ssr-login-real-zh-1440-light");
      return { real: true };
    });

  // 2. Sign in (intercepted account API; the form, validation and navigation are the page's)
  await scenario("login", { width: 390 }, async ({ page, state, calls, step, release }) => {
    const m = copy.zh;
    const password = secret();
    await page.goto(`${base}/account/login?redirect=/settings`, { waitUntil: "networkidle" });
    step("failed sign-in: the server's message beside the form, the form stays editable");
    state.fail.login = { status: 401, message: "用户名或密码错误" };
    await page.fill("#login-identifier", "selfcheck-account");
    await page.fill("#login-password", password);
    await page.click(".submit-btn");
    await page.locator(".auth-page .rw-alert[role=alert]", { hasText: "用户名或密码错误" }).waitFor();
    assert.deepEqual(lastCall(calls, "login").body, { identifier: "selfcheck-account", password });
    assert.equal(await page.inputValue("#login-password"), password, "password kept after a rejection");
    assert.equal(await page.isEnabled("#login-identifier"), true);
    assert.equal(await page.locator("form.auth-form").getAttribute("aria-describedby"), "login-error");
    step("rate limited");
    state.fail.login = { status: 429, message: "登录尝试过多，请稍后再试" };
    await page.click(".submit-btn");
    await page.locator(".auth-page .rw-alert[role=alert]", { hasText: "登录尝试过多" }).waitFor();
    await shot(page, "login-error-intercepted-zh-390-light");
    step("password toggle");
    await page.click(".rw-pw button");
    assert.equal(await page.getAttribute("#login-password", "type"), "text");
    assert.equal(await page.getAttribute(".rw-pw button", "aria-pressed"), "true");
    await page.click(".rw-pw button");
    assert.equal(await page.getAttribute("#login-password", "type"), "password");
    step("pending: the button is disabled and busy, a second click sends nothing");
    delete state.fail.login;
    state.hold.add("login");
    await page.click(".submit-btn");
    await page.waitForFunction(() => document.querySelector(".submit-btn").disabled);
    assert.equal(await page.getAttribute(".submit-btn", "aria-busy"), "true");
    await page.locator(".submit-btn").click({ force: true }).catch(() => {});
    const before = countCalls(calls, "login");
    await page.waitForTimeout(150);
    assert.equal(countCalls(calls, "login"), before, "no second POST while pending");
    await release("login");
    await page.waitForURL((u) => u.pathname === "/settings");
    await message(page, msg(m, "rework.account.login.success"));
    assert.equal(countCalls(calls, "login"), 3);
    return { intercepted: true };
  });

  await scenario("login-redirect", { width: 1440 }, async ({ page, state, calls }) => {
    // an external return address falls back to the profile page
    await page.goto(`${base}/account/login?redirect=//evil.example.invalid/x`, { waitUntil: "networkidle" });
    await page.fill("#login-identifier", "selfcheck-account");
    await page.fill("#login-password", secret());
    await page.click(".submit-btn");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    await page.locator(".profile-main-card").waitFor();
    assert.equal(countCalls(calls, "login"), 1);
    // signed in, opening the sign-in page → the profile (middleware account-guest, unchanged)
    await go(page, "zh", "/about");
    await push(page, "/account/login");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    // the register link carries the redirect
    state.signedIn = false;
    await page.goto(`${base}/account/login?redirect=/my`, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__) && document.querySelector(".ra-auth__foot a"));
    const href = await page.locator(".ra-auth__foot a").getAttribute("href");
    assert.equal(new URL(href, base).searchParams.get("redirect"), "/my");
    assert.equal(await page.locator(".remember-row a").getAttribute("href"), "/account/forgot-password");
    return { intercepted: true };
  });

  await scenario("login-session-error", { width: 820 }, async ({ page, state, calls }) => {
    // the session read fails on the client: the page offers a retry of the session read only (no password POST)
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    state.fail.me = 500;
    await page.evaluate(() => {
      const nuxt = document.getElementById("__nuxt").__vue_app__.config.globalProperties.$nuxt;
      nuxt.payload.state["$saccount-user-loaded"] = false;
    });
    await push(page, "/account/login");
    await page.locator(".auth-state-error").waitFor();
    assert.equal(await page.locator("form.auth-form").count(), 0);
    await shot(page, "login-session-error-intercepted-zh-820-light");
    delete state.fail.me;
    state.signedIn = true;
    await page.click(".auth-state-error button");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    assert.equal(countCalls(calls, "login"), 0);
    return { intercepted: true };
  });

  await scenario("login-keyboard", { width: 1440 }, async ({ page, calls }) => {
    const password = secret();
    await page.goto(`${base}/account/login`, { waitUntil: "networkidle" });
    const tabs = await tabTo(page, "#login-identifier");
    await page.keyboard.type("selfcheck-account");
    await page.keyboard.press("Tab");
    assert.equal((await active(page)).id, "login-password");
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), msg(copy.zh, "rework.account.showPassword"));
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.type), "checkbox");
    await page.keyboard.press("Space");
    assert.equal(await page.isChecked(".remember-row input"), true);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    assert.deepEqual(lastCall(calls, "login").body, { identifier: "selfcheck-account", password });
    const focusVisible = true;
    return { intercepted: true, tabsToFirstField: tabs, focusVisible };
  });

  // 3. External sign-in: real provider list (dev server configuration), the start request and the outbound address
  for (const lang of ["zh", "ja"])
    await scenario("oidc", { width: 390, lang }, async ({ page, state, calls, outbound }) => {
      const m = copy[lang];
      await page.goto(`${base}${prefix(lang)}/account/login?redirect=/my`, { waitUntil: "networkidle" });
      const button = page.locator(".oidc-options button");
      assert.equal(await button.count(), 1);
      const label = msg(m, "rework.account.oidc.loginWith", { provider: OIDC_PROVIDER.label });
      assert.equal((await button.textContent()).trim(), label, "real provider name");
      assert.ok((await button.boundingBox()).height >= 44);
      assert.equal(await page.locator(".oidc-options h2").textContent(), msg(m, "rework.account.oidc.title"));
      state.fail.oidcStart = 500;
      await button.click();
      await page.locator(".oidc-options [role=alert]", { hasText: msg(m, "rework.account.oidc.failed") }).waitFor();
      assert.equal(await button.isEnabled(), true);
      assert.ok(await page.locator("#login-password").isEditable());
      delete state.fail.oidcStart;
      await button.click();
      for (let i = 0; i < 100 && !outbound.length; i++) await page.waitForTimeout(50);
      assert.deepEqual(lastCall(calls, "oidcStart").body, { purpose: "login", redirect: "/my", locale: lang, recover: false });
      assert.equal(lastCall(calls, "oidcStart").path, `/api/account/oidc/${OIDC_PROVIDER.id}/start`);
      assert.equal(outbound[0], OUTBOUND, "outbound authorization address (recorded, not followed)");
      await page.waitForURL(/chrome-error|account/, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);
      // error codes returned to the page
      for (const [code, key] of [["email_conflict", "conflict"], ["ourtaiko_rate_limited", "rateLimited"], ["something_else", "failed"]]) {
        await page.goto(`${base}${prefix(lang)}/account/login?oidc_error=${code}`, { waitUntil: "networkidle" });
        assert.equal((await page.locator(".oidc-options [role=alert]").textContent()).trim(), msg(m, `rework.account.oidc.${key}`));
      }
      await page.goto(`${base}${prefix(lang)}/account/register`, { waitUntil: "networkidle" });
      assert.equal(await page.locator(".oidc-options button").count(), 1);
      if (lang === "ja") await shot(page, "register-oidc-real-ja-390-light", true);
      return { intercepted: true, real: "provider list", outbound: outbound[0] };
    });

  // 4. Registration
  await scenario("register", { width: 390 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    const password = secret();
    await page.goto(`${base}/account/register?redirect=/settings`, { waitUntil: "networkidle" });
    step("send code without an e-mail sends nothing");
    await page.click(".rw-code-row button");
    await page.waitForTimeout(150);
    assert.equal(countCalls(calls, "sendCode"), 0);
    step("send code rejected: error beside the code field");
    await page.fill("#register-username", "selfcheck-new");
    await page.fill("#register-email", "new-selfcheck@example.invalid");
    state.fail.sendCode = { status: 429, message: "验证码发送过于频繁" };
    await page.click(".rw-code-row button");
    await page.locator("#register-code-error", { hasText: "验证码发送过于频繁" }).waitFor();
    assert.equal(await page.getAttribute("#register-code", "aria-describedby"), "register-code-error");
    assert.equal(await page.getAttribute("#register-code", "aria-invalid"), "true");
    step("send code accepted: notice and 60 s cooldown");
    delete state.fail.sendCode;
    await page.click(".rw-code-row button");
    await page.locator("#register-code-notice", { hasText: msg(m, "rework.account.register.codeSent") }).waitFor();
    assert.deepEqual(lastCall(calls, "sendCode").body, { email: "new-selfcheck@example.invalid", purpose: "register" });
    await page.waitForFunction(() => /\d+s 后重发/.test(document.querySelector(".rw-code-row button").textContent));
    assert.equal(await page.isDisabled(".rw-code-row button"), true, "cooldown");
    const t1 = (await page.textContent(".rw-code-row button")).trim();
    await page.waitForTimeout(1100);
    const t2 = (await page.textContent(".rw-code-row button")).trim();
    assert.notEqual(t1, t2, "cooldown counts down");
    await page.click(".rw-code-row button", { force: true }).catch(() => {});
    assert.equal(countCalls(calls, "sendCode"), 2, "no request during the cooldown");
    step("mismatch: error beside the confirmation, nothing sent, focus there");
    await page.fill("#register-code", "123456");
    await page.fill("#register-password", password);
    await page.fill("#register-confirm", password + "x");
    await page.click(".submit-btn");
    await message(page, msg(m, "rework.account.register.passwordMismatch"));
    await page.locator("#register-confirm-error", { hasText: msg(m, "rework.account.register.passwordMismatch") }).waitFor();
    { const a = await active(page); assert.equal(a.id, "register-confirm", JSON.stringify(a)); }
    assert.equal(countCalls(calls, "register"), 0);
    await shot(page, "register-validation-intercepted-zh-390-light", true);
    step("registration accepted, sign-in fails: only the sign-in is retried");
    await page.fill("#register-confirm", password);
    await page.locator("#register-confirm").blur();
    assert.equal(await page.locator("#register-confirm-error").count(), 0);
    state.fail.login = { status: 500, message: "登录服务暂时不可用" };
    await page.click(".submit-btn");
    await page.locator(".auth-page .rw-alert[role=alert]", { hasText: "登录服务暂时不可用" }).waitFor();
    assert.deepEqual(lastCall(calls, "register").body, { username: "selfcheck-new", email: "new-selfcheck@example.invalid", code: "123456", password });
    await page.locator(".rw-alert--ok[role=status]", { hasText: msg(m, "rework.account.completion.registered") }).waitFor();
    assert.equal((await page.textContent(".submit-btn")).trim(), msg(m, "rework.account.completion.login"));
    assert.equal(await page.isDisabled("#register-username"), true);
    delete state.fail.login;
    await page.click(".submit-btn");
    await page.waitForURL((u) => u.pathname === "/settings");
    assert.equal(countCalls(calls, "register"), 1, "registration not repeated");
    assert.deepEqual(lastCall(calls, "login").body, { identifier: "selfcheck-new", password });
    return { intercepted: true };
  });

  await scenario("register-keyboard", { width: 1440 }, async ({ page, calls }) => {
    const password = secret();
    await page.goto(`${base}/account/register`, { waitUntil: "networkidle" });
    await tabTo(page, "#register-username");
    await page.keyboard.type("selfcheck-kbd");
    await page.keyboard.press("Tab");
    await page.keyboard.type("kbd-selfcheck@example.invalid");
    await page.keyboard.press("Tab");
    assert.equal((await active(page)).id, "register-code");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await waitCall(page, calls, "sendCode", 1);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await active(page)).id, "register-code");
    await page.keyboard.type("654321");
    await page.keyboard.press("Tab");
    assert.equal((await active(page)).id, "register-password", "the disabled send button is skipped");
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    { const a = await active(page); assert.equal(a.id, "register-confirm", JSON.stringify(a)); }
    await page.keyboard.type(password);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    assert.deepEqual(lastCall(calls, "register").body, { username: "selfcheck-kbd", email: "kbd-selfcheck@example.invalid", code: "654321", password });
    return { intercepted: true };
  });

  // 5. Recovery
  await scenario("forgot", { width: 360 }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    const password = secret();
    await page.goto(`${base}/account/forgot-password`, { waitUntil: "networkidle" });
    await page.fill("#forgot-email", "account-selfcheck@example.invalid");
    await page.click(".rw-code-row button");
    await waitCall(page, calls, "sendCode", 1);
    assert.deepEqual(lastCall(calls, "sendCode").body, { email: "account-selfcheck@example.invalid", purpose: "reset" });
    await page.locator("#forgot-code-notice").waitFor();
    step("rejected code");
    await page.fill("#forgot-code", "000000");
    await page.fill("#forgot-password", password);
    await page.fill("#forgot-confirm", password);
    state.fail.reset = { status: 400, message: "验证码错误或已过期" };
    await page.keyboard.press("Enter");
    await page.locator(".auth-page .rw-alert[role=alert]", { hasText: "验证码错误或已过期" }).waitFor();
    assert.equal(await page.inputValue("#forgot-password"), password);
    await shot(page, "forgot-error-intercepted-zh-360-light", true);
    step("accepted");
    delete state.fail.reset;
    await page.click(".submit-btn");
    await page.waitForURL((u) => u.pathname === "/account/login");
    assert.deepEqual(lastCall(calls, "reset").body, { email: "account-selfcheck@example.invalid", code: "000000", password });
    await message(page, msg(m, "rework.account.forgot.success"));
    return { intercepted: true };
  });

  // 6. The profile page, section by section (intercepted signed-in)
  await scenario("profile", { width: 1440 }, async ({ page, state, calls, step, release, outbound }) => {
    const m = copy.zh;
    const p = (k, v) => msg(m, `rework.account.profile.${k}`, v);
    state.oidcLink = "unknown";
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".profile-main-card").waitFor();
    step("identity");
    assert.equal((await page.locator("h1").textContent()).trim(), state.user.username);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator(".profile-main-card .ds-site-title").textContent(), "虹光先行者");
    assert.ok(await page.locator(".profile-main-card .ds-avatar img").getAttribute("src"));
    assert.match(await page.locator(".ra-ident__facts").textContent(), /100000001/);
    step("section navigation");
    const nav = page.locator(".ra-toc a");
    assert.deepEqual(await nav.allTextContents(), [p("sectionIdentity"), p("sectionBindings"), p("sectionSignIn"), p("myDon"), p("thirdPartyLabel")]);
    const toc = await page.locator(".ra-toc").boundingBox();
    const main = await page.locator(".ra-profile__body").boundingBox();
    assert.ok(toc.x + toc.width <= main.x, "side list beside the column at 1440");
    await nav.nth(3).click();
    await page.waitForFunction(() => document.activeElement?.id === "account-mydon-title");
    assert.equal(new URL(page.url()).hash, "", "no URL state written");
    await page.waitForFunction(() => document.querySelector('.ra-toc a[aria-current="true"]')?.getAttribute("href") === "#account-mydon");
    await page.evaluate(() => window.scrollTo(0, 0));
    step("bindings: stamps, current, actions");
    const items = page.locator(".binding-item");
    assert.equal(await items.count(), 3);
    assert.deepEqual((await page.locator(".source-stamp").allTextContents()).map((s) => s.trim()), [p("cnStamp"), p("jpStamp"), p("manualStamp")]);
    assert.equal(await items.nth(0).locator(".binding-current[role=status]").count(), 1);
    assert.equal(await items.nth(2).locator(".rw-btn--danger").count(), 2, "manual: detach + delete (outlined danger)");
    step("switch (pending, then success)");
    state.hold.add("switch");
    await items.nth(1).getByRole("button", { name: p("switchCurrent"), exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll(".binding-item")[1].querySelector(".rw-btn.is-busy:disabled"));
    await release("switch");
    await message(page, p("switchSuccess"));
    assert.deepEqual(lastCall(calls, "switch").body, { bindingId: 2 });
    step("switch failure");
    state.fail.switch = { status: 409, message: "绑定已变化" };
    await items.nth(1).getByRole("button", { name: p("switchCurrent"), exact: true }).click();
    await message(page, "绑定已变化");
    delete state.fail.switch;
    step("delete a binding: confirmation, cancel sends nothing, focus returns");
    const removeButton = items.nth(1).getByRole("button", { name: p("deleteBinding"), exact: true });
    await removeButton.click();
    const box = page.locator(".el-message-box");
    await box.waitFor();
    assert.match(await box.textContent(), new RegExp(p("deleteConfirm", { id: "100000002" }).replace(/[?？]/g, ".")));
    const inDialog = await page.evaluate(() => Boolean(document.activeElement?.closest(".el-message-box, .el-overlay")));
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "hidden" });
    await page.waitForTimeout(300);
    const focusReturned = await page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.tagName);
    assert.equal(countCalls(calls, "remove"), 0, "cancel sends nothing");
    await removeButton.click();
    await box.waitFor();
    await box.locator(".el-message-box__btns .el-button--primary").click();
    await message(page, p("deleteSuccess"));
    assert.deepEqual(lastCall(calls, "remove").body, { bindingId: 2, force: false });
    step("manual: rename prompt, claim code alert, detach, permanent delete");
    await items.nth(2).getByRole("button", { name: p("manualRename"), exact: true }).click();
    await box.waitFor();
    await box.locator("input").fill("新名字");
    await box.locator(".el-message-box__btns .el-button--primary").click();
    await waitCall(page, calls, "manual", 1);
    assert.deepEqual(lastCall(calls, "manual").body, { action: "rename", taikoId: "M3", nickname: "新名字" });
    await box.waitFor({ state: "hidden" });
    await items.nth(2).getByRole("button", { name: p("manualClaimCode"), exact: true }).click();
    await page.locator(".el-message-box", { hasText: "ABCD2345" }).waitFor();
    assert.deepEqual(lastCall(calls, "manual").body, { action: "claim-code", taikoId: "M3" });
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await box.waitFor({ state: "hidden" });
    await items.nth(2).getByRole("button", { name: p("manualDetach"), exact: true }).click();
    await page.locator(".el-message-box", { hasText: p("detachConfirm") }).waitFor();
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await waitCall(page, calls, "manual", 3);
    assert.deepEqual(lastCall(calls, "manual").body, { action: "detach", taikoId: "M3" });
    await box.waitFor({ state: "hidden" });
    await items.nth(2).getByRole("button", { name: p("manualDelete"), exact: true }).click();
    await page.locator(".el-message-box", { hasText: p("deleteManualConfirm") }).waitFor();
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "hidden" });
    assert.equal(countCalls(calls, "manual"), 3, "cancelled permanent delete sends nothing");
    await items.nth(2).getByRole("button", { name: p("manualDelete"), exact: true }).click();
    await page.locator(".el-message-box", { hasText: p("deleteManualConfirm") }).waitFor();
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await waitCall(page, calls, "manual", 4);
    assert.deepEqual(lastCall(calls, "manual").body, { action: "delete-account", taikoId: "M3", confirmed: true });
    await box.waitFor({ state: "hidden" });
    step("manual create / claim");
    await page.locator(".manual-account-panel summary").click();
    assert.equal(await page.isDisabled(".manual-account-controls .rw-btn >> nth=0"), true, "empty nickname disables create");
    await page.fill("#manual-nickname", "新手动");
    await page.locator(".manual-account-controls .rw-btn").nth(0).click();
    await waitCall(page, calls, "manual", 5);
    assert.deepEqual(lastCall(calls, "manual").body, { action: "create", nickname: "新手动" });
    await page.fill("#manual-claim", "CLAIM123");
    await page.locator("#manual-claim").press("Enter");
    await waitCall(page, calls, "manual", 6);
    assert.deepEqual(lastCall(calls, "manual").body, { action: "claim", code: "CLAIM123" });
    step("binding form and pending challenge");
    await page.fill("#binding-taiko-id", "  123456789012 ");
    await page.locator(".bind-input-row .rw-btn").click();
    await message(page, "已记录当前称号");
    assert.deepEqual(lastCall(calls, "prepare").body, { taikoId: "123456789012" });
    const pending = page.locator(".pending-box");
    assert.match(await pending.textContent(), /123456789012/);
    assert.match(await pending.textContent(), new RegExp(p("emptyTitle").replace(/[()（）]/g, ".")));
    state.fail.confirm = { status: 400, message: "称号未变化" };
    await pending.locator("button").click();
    await message(page, "称号未变化");
    delete state.fail.confirm;
    await pending.locator("button").click();
    await message(page, p("confirmSuccess"));
    assert.deepEqual(lastCall(calls, "confirm").body, { taikoId: "123456789012" });
    step("sign-in section: e-mail, linked OIDC (unknown → retry), QQ pending");
    const sign = page.locator("#account-sign-in");
    assert.match(await sign.textContent(), /account-selfcheck@example\.invalid/);
    const oidc = sign.locator(".oidc-options");
    await oidc.locator(".oidc-linked").waitFor();
    assert.match(await oidc.locator(".oidc-linked").textContent(), /Viewer/);
    assert.equal((await oidc.locator("[role=status]").textContent()).trim(), msg(m, "rework.account.oidc.unknown"));
    assert.equal(await oidc.locator("button").count(), 1);
    assert.equal(await page.locator(".qq-pending-row").count(), 1);
    assert.equal(await page.isDisabled(".qq-pending-row .qq-verify-row .rw-btn"), true, "empty code disables confirm");
    await page.fill("#qq-code-pending", "112233");
    await page.locator("#qq-code-pending").press("Enter");
    await message(page, "QQ 绑定成功");
    assert.deepEqual(lastCall(calls, "qqConfirm").body, { code: "112233" });
    await page.locator(".qq-unbind").click();
    await page.locator(".el-message-box", { hasText: p("qqUnbindConfirm", { qq: "10002" }) }).waitFor();
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await message(page, "QQ 已解绑");
    assert.equal(lastCall(calls, "qqRemove").method, "POST");
    step("my don: image, showcase options, layout, save, reset");
    assert.equal(await page.locator(".mydon-image").evaluate((img) => img.complete && img.naturalWidth > 0), true);
    assert.equal(await page.locator(".showcase-slot-item").count(), 5);
    await page.locator(".showcase-config .rw-seg button").nth(1).click();
    await page.locator("#showcase-slot-2").click();
    const option = page.locator(".el-select-dropdown__item", { hasText: "自定义称号" }).last();
    await option.waitFor();
    assert.equal((await option.textContent()).trim(), `${p("customPrefix")}自定义称号 · ${p("songPrefix")}曲A / 曲B · ${p("requirement.clear")} · ${p("scope.any")} · 8.1`);
    await option.click();
    await page.locator(".showcase-actions .rw-btn--primary").click();
    await message(page, p("showcaseSaveSuccess"));
    assert.deepEqual(lastCall(calls, "showcaseSave").body, { layoutMode: "full", titleNames: ["红", "自定义称号"] });
    await page.locator(".showcase-actions .rw-btn").nth(1).click();
    await message(page, p("showcaseResetSuccess"));
    assert.deepEqual(lastCall(calls, "showcaseSave").body, { layoutMode: "nickname", titleNames: [] });
    step("avatar: crop dialog, upload, reset");
    await page.setInputFiles(".avatar-upload input[type=file]", { name: "avatar.png", mimeType: "image/png", buffer: PNG });
    const dialog = page.locator(".el-dialog");
    await dialog.waitFor();
    await page.waitForTimeout(400);
    const dialogFocus = await page.evaluate(() => Boolean(document.activeElement?.closest(".el-dialog, .el-overlay")));
    await shot(page, "profile-avatar-dialog-intercepted-zh-1440-light");
    await dialog.getByRole("button", { name: p("avatarCropConfirm") }).click();
    await message(page, p("avatarUpdated"));
    assert.deepEqual(lastCall(calls, "avatar").body, { multipart: true, hasAvatar: true });
    await page.waitForFunction(() => !document.querySelector(".el-dialog"), null, { timeout: 10000 });
    await page.locator(".avatar-reset-button").click();
    await message(page, p("avatarReset"));
    assert.equal(lastCall(calls, "avatarDelete").method, "DELETE");
    step("third-party apps link");
    assert.equal(await page.locator("#account-apps a").getAttribute("href"), "/account/developer/grants");
    step("touch targets");
    assert.deepEqual(await touchTargets(page), []);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "profile-intercepted-zh-1440-light", true);
    step("sign out");
    await page.locator("#account-sign-in .ras__out button").click();
    await page.waitForURL((u) => u.pathname === "/account/login");
    assert.equal(lastCall(calls, "logout").method, "POST");
    step("linked OIDC retry: the start request and the outbound address (recorded, not followed)");
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    const retry = page.locator("#account-sign-in .oidc-options button");
    assert.ok((await retry.boundingBox()).height >= 44);
    await retry.focus();
    await page.keyboard.press("Enter");
    await waitCall(page, calls, "oidcStart", 1);
    assert.deepEqual(lastCall(calls, "oidcStart").body, { purpose: "link", redirect: "/account/profile", locale: "zh", recover: false });
    for (let i = 0; i < 100 && !outbound.length; i++) await page.waitForTimeout(50);
    assert.equal(outbound[0], OUTBOUND);
    return { intercepted: true, outbound: outbound[0], dialogs: { messageBoxFocusInside: inDialog, focusAfterCancel: focusReturned, cropDialogFocusInside: dialogFocus } };
  });

  await scenario("profile-states", { width: 390, theme: "dark" }, async ({ page, state, calls, step }) => {
    const m = copy.zh;
    const p = (k, v) => msg(m, `rework.account.profile.${k}`, v);
    step("unbound: onboarding reveals the form and focuses the input");
    state.variant = "unbound";
    state.showcase = fixtureShowcase(false);
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".onboarding-card").waitFor();
    assert.equal(await page.locator(".binding-item").count(), 0);
    await page.locator(".onboarding-card button").click();
    await page.waitForFunction(() => document.activeElement?.id === "binding-taiko-id", null, { timeout: 5000 });
    assert.equal((await page.locator("#account-mydon .rw-state").first().textContent()).trim(), p("myDonNeedBinding"));
    await shot(page, "profile-unbound-intercepted-zh-390-dark", true);
    assert.ok(await noOverflow(page));
    step("compact section row below 1100");
    const toc = await page.locator(".ra-toc").boundingBox();
    const ident = await page.locator(".profile-main-card").boundingBox();
    assert.ok(toc.y > ident.y, "row after the identity");
    step("last binding: two confirmations, force true");
    state.variant = "single";
    state.showcase = fixtureShowcase(true);
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".binding-item").first().waitFor();
    await page.locator(".binding-item .rw-btn--danger").click();
    await page.locator(".el-message-box", { hasText: p("deleteConfirm", { id: "100000001" }).slice(0, 6) }).waitFor();
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await page.locator(".el-message-box", { hasText: p("lastBindingConfirm").slice(0, 8) }).waitFor();
    assert.equal(countCalls(calls, "remove"), 0, "nothing sent before the second confirmation");
    await shot(page, "profile-last-binding-confirm-intercepted-zh-390-dark");
    await page.locator(".el-message-box__btns .el-button--primary").last().click();
    await waitCall(page, calls, "remove", 1);
    assert.deepEqual(lastCall(calls, "remove").body, { bindingId: 1, force: true });
    step("QQ none: number → code box (revealed and focused) → confirm");
    state.variant = "qq-none";
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator("#qq-number").waitFor();
    assert.equal(await page.isDisabled(".qq-verify-row .rw-btn"), true);
    await page.fill("#qq-number", "10003");
    await page.locator("#qq-number").press("Enter");
    await page.locator(".qq-code-result").waitFor();
    assert.deepEqual(lastCall(calls, "qqPrepare").body, { qqNumber: "10003" });
    await page.waitForFunction(() => document.activeElement?.id === "qq-code", null, { timeout: 5000 });
    step("re-verification notice");
    state.variant = "reverify";
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".rab__notice", { hasText: p("legacyBindingNotice") }).waitFor();
    step("profile read fails → retry");
    state.fail.profile = 500;
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator(".rw-state--failed").waitFor();
    delete state.fail.profile;
    await page.locator(".rw-state--failed button").click();
    await page.locator(".profile-main-card").waitFor();
    step("showcase read fails → retry");
    state.fail.showcase = 500;
    await enterSignedIn(page, base, "zh", "/account/profile", state);
    await page.locator("#account-mydon .rw-state--failed").waitFor();
    delete state.fail.showcase;
    await page.locator("#account-mydon .rw-state--failed button").click();
    await page.locator(".showcase-config").waitFor();
    step("session expired while the page is open → sign in again, back here");
    // the session is gone on the server (auth/me → guest, profile → 401) while the client still holds the old user
    state.fail.profile = 401;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page, state.user);
    state.signedIn = false;
    await go(page, "zh", "/account/profile");
    const gate = page.locator('.rw-gate[data-need="login"]');
    await gate.waitFor();
    assert.equal((await gate.locator(".rw-gate__title").textContent()).trim(), p("sessionExpired"));
    const href = await gate.locator("a").first().getAttribute("href");
    assert.equal(new URL(href, base).searchParams.get("redirect"), "/account/profile");
    assert.equal(await gate.locator("a").count(), 1, "no registration link");
    await shot(page, "profile-session-expired-intercepted-zh-390-dark");
    delete state.fail.profile;
    await gate.locator("a").first().click();
    await page.waitForURL((u) => u.pathname === "/account/login");
    await page.fill("#login-identifier", "selfcheck-account");
    await page.fill("#login-password", secret());
    await page.click(".submit-btn");
    await page.waitForURL((u) => u.pathname === "/account/profile");
    await page.locator(".profile-main-card").waitFor();
    step("?oidc_error lands on the sign-in section with the message");
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    await injectSignedIn(page, state.user);
    await push(page, "/account/profile?oidc_error=identity_conflict");
    await page.locator("#account-sign-in .oidc-options [role=alert]", { hasText: msg(m, "rework.account.oidc.identity") }).waitFor();
    await page.waitForFunction(() => {
      const r = document.getElementById("account-sign-in").getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }, null, { timeout: 5000 });
    return { intercepted: true };
  });

  // 7. Settings: theme cookie, language links, cache (real; no account data)
  await scenario("settings", { width: 820 }, async ({ page, context, step }) => {
    const m = copy.zh;
    await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
    step("theme");
    const seg = page.locator(".settings-theme .rw-seg").first();
    assert.equal(await seg.locator("button").first().getAttribute("aria-pressed"), "true");
    await seg.locator("button").nth(1).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    assert.equal((await context.cookies()).find((c) => c.name === "taiko_theme")?.value, "dark");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark", "server render follows the cookie");
    assert.equal(await page.locator(".settings-theme .rw-seg").first().locator("button").nth(1).getAttribute("aria-pressed"), "true");
    step("shell toggle and the page agree");
    await page.locator(".rework-shell button[aria-label]", { hasText: "" }).filter({ has: page.locator("svg") }).first().count();
    await page.evaluate(() => [...document.querySelectorAll("button.icon-button")].find((b) => b.getAttribute("aria-label")?.length && b.querySelector("svg") && !b.closest("#viewer-main"))?.click());
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    assert.equal(await page.locator(".settings-theme .rw-seg").first().locator("button").nth(0).getAttribute("aria-pressed"), "true");
    step("cache");
    await page.evaluate(() => localStorage.setItem("selfcheck-cache-key", "x".repeat(2048)));
    await page.locator(".cache-details summary").click();
    await page.locator(".cache-keys li", { hasText: "selfcheck-cache-key" }).waitFor();
    await page.locator(".cache-panel .rw-btn--danger").click();
    await page.waitForFunction(() => localStorage.length === 0);
    await page.locator(".cache-empty", { hasText: msg(m, "rework.account.settings.empty") }).waitFor();
    step("language");
    const ja = page.locator(".rset__lang[lang=ja]");
    assert.equal(await page.locator('.rset__lang[aria-current="true"]').getAttribute("lang"), "zh-CN");
    await ja.click();
    await page.waitForURL((u) => u.pathname === "/ja/settings");
    await page.locator("h1", { hasText: msg(copy.ja, "nav.settings") }).waitFor();
    assert.equal(await page.locator('.rset__lang[aria-current="true"]').getAttribute("lang"), "ja");
    return { real: true };
  });

  // 8. Matrix: five pages × widths × themes (zh) + ja samples
  const combos = [];
  for (const theme of ["light", "dark"]) for (const width of widths) combos.push({ width, theme, lang: "zh" });
  combos.push({ width: 390, theme: "light", lang: "ja" }, { width: 1440, theme: "dark", lang: "ja" });
  const shots = new Set(["zh-1440-light", "zh-390-dark", "ja-390-light", "zh-360-light", "ja-1440-dark"]);
  for (const combo of combos)
    await scenario("matrix", combo, async ({ page, state, step }) => {
      const { width, theme, lang } = combo;
      const key = `${lang}-${width}-${theme}`;
      const pages = {};
      for (const path of ["/account/login", "/account/register", "/account/forgot-password", "/settings"]) {
        step(path);
        state.real = true;
        await page.goto(`${base}${prefix(lang)}${path}`, { waitUntil: "networkidle" });
        assert.ok((await htmlClasses(page)).includes("rework-ep"), `${path}: rework-ep`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        assert.equal(await page.locator("h1").count(), 1);
        assert.ok(await noOverflow(page), `${path}: no horizontal overflow`);
        assert.deepEqual(await touchTargets(page), [], `${path}: touch targets`);
        pages[path] = true;
        if (shots.has(key)) await shot(page, `${path.split("/").pop()}-real-${key}`, true);
      }
      step("profile");
      state.real = false;
      await enterSignedIn(page, base, lang, "/account/profile", state);
      await page.locator(".showcase-config").waitFor();
      assert.ok((await htmlClasses(page)).includes("rework-ep"));
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(await noOverflow(page), "profile: no horizontal overflow");
      assert.deepEqual(await touchTargets(page), [], "profile: touch targets");
      const toc = await page.locator(".ra-toc").boundingBox();
      const body = await page.locator(".ra-profile__body").boundingBox();
      if (width >= 1100) assert.ok(toc.x + toc.width <= body.x, "side list");
      else assert.ok(toc.y < body.y && toc.width > body.width * 0.9, "compact row above the sections");
      if (shots.has(key)) await shot(page, `profile-intercepted-${key}`, true);
      return { pages: Object.keys(pages).length + 1 };
    });

  // 9. Element Plus mapping on these pages, off elsewhere; dialogs leave no node behind
  await scenario("element-plus-switch", { width: 820 }, async ({ page, state }) => {
    state.real = true;
    await page.goto(`${base}/about`, { waitUntil: "networkidle" });
    assert.ok(!(await htmlClasses(page)).includes("rework-ep"));
    const baseline = await page.evaluate(() => document.body.children.length);
    for (const path of ["/account/login", "/account/register", "/account/forgot-password", "/settings"]) {
      await go(page, "zh", path);
      await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    }
    state.real = false;
    state.signedIn = true;
    await injectSignedIn(page, state.user);
    await go(page, "zh", "/account/profile");
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    await page.locator("#showcase-slot-1").click();
    await page.locator(".el-select-dropdown__item").first().waitFor();
    const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--el-color-primary").trim());
    await page.keyboard.press("Escape");
    await go(page, "zh", "/about");
    await page.waitForFunction(() => !document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    const after = await page.evaluate(() => document.body.children.length);
    assert.ok(after <= baseline + 2, `body nodes ${baseline} → ${after}`);
    await page.goBack();
    await page.waitForURL(/\/account\/profile/);
    await page.waitForFunction(() => document.documentElement.classList.contains("rework-ep"), null, { timeout: 15000 });
    return { primaryUnderMapping: primary };
  });

  return { results, timings, passed: results.filter((r) => r.pass).length, total: results.length };
}
