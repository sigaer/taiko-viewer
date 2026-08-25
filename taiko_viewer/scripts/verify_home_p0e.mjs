#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const baseUrl = valueOf("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const artifactDir = valueOf("artifacts", "/tmp/taiko-home-p0e");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"]
});

await mkdir(artifactDir, { recursive: true });

const defaultUser = "sigaer";
const longUser = "超長いプレイヤーネームテスト123456789";
const longSong = "超長い日本語の楽曲名（裏譜面・特別版）副題を含むテストタイトル English Extended Subtitle Edition";
const recommendation = (title = "無敵的ハピネス！(SOS団5人Ver.)") => ({
  song_id: 1455,
  title,
  level: 10,
  is_unplayed: true,
  user_indicator: 0,
  reference_indicator: 0
});

const setHomeState = async (page, state, username = defaultUser) => {
  await page.evaluate(({ nextState, displayName }) => {
    const nuxtState = window.__NUXT__.state;
    const authenticated = nextState !== "guest";
    nuxtState["$saccount-user"] = authenticated
      ? {
          id: 990001,
          username: displayName,
          email: "home-fixture@example.invalid",
          emailVerified: true,
          avatarUrl: "",
          createdAt: "2026-01-01",
          annualSummaryAccess: false
        }
      : null;
    nuxtState["$saccount-user-loaded"] = true;
    nuxtState["$saccount-user-error"] = null;
    nuxtState["$shome-state-resolved-user-id"] = authenticated ? 990001 : null;
    nuxtState["$shome-state-resolver"] = {
      status: "ready",
      homeState: nextState,
      authenticated,
      currentBinding: nextState === "authenticated_unbound"
        ? null
        : { id: 1, taikoId: "fixture", source: "manual" },
      hasScores: nextState === "authenticated_ready",
      error: null
    };
  }, { nextState: state, displayName: username });
};

const openScenario = async ({
  viewport,
  state = "guest",
  locale = "zh",
  dark = false,
  username = defaultUser,
  rating = 10.26,
  ratingFail = false,
  recommendationTitle,
  recommendationFail = false,
  recommendationEmpty = false,
  publicFail = false,
  bilibiliFail = false,
  coverFail = false,
  screenshot
}) => {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) requests.push(url.pathname);
  });
  await page.addInitScript((useDark) => {
    localStorage.setItem("taiko_theme", useDark ? "dark" : "light");
  }, dark);
  await page.route("**/api/content/home", (route) => publicFail
    ? route.fulfill({ status: 500, json: { message: "fixture" } })
    : route.continue());
  await page.route("**/api/account/charts/summary", (route) => ratingFail
    ? route.fulfill({ status: 500, json: { message: "fixture" } })
    : route.fulfill({ json: { current: rating, scoreCount: 100 } }));
  await page.route("**/api/account/recommendation", (route) => recommendationFail
    ? route.fulfill({ status: 500, json: { message: "fixture" } })
    : route.fulfill({ json: { items: recommendationEmpty ? [] : [recommendation(recommendationTitle)] } }));
  if (bilibiliFail) {
    await page.route("**/api/bilibili/dynamic/**", (route) =>
      route.fulfill({ status: 504, json: { message: "upstream timeout" } }));
  }
  if (coverFail) {
    await page.route("**/cover/**", (route) => route.fulfill({ status: 404, body: "" }));
  }

  await page.goto(`${baseUrl}${locale === "ja" ? "/ja" : "/"}`, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  if (state !== "guest") {
    await setHomeState(page, state, username);
    await page.waitForSelector(".authenticated-home", { timeout: 10_000 });
    if (state === "authenticated_ready") await page.waitForTimeout(500);
  }
  if (bilibiliFail) {
    await page.locator(".guest-events").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }
  if (screenshot) await page.screenshot({ path: `${artifactDir}/${screenshot}`, fullPage: true });

  const audit = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    h1Count: document.querySelectorAll("h1").length,
    rawKeys: [...document.querySelectorAll("body *")].some((node) =>
      /^(?:home|nav|page)\.[A-Za-z0-9_.-]+$/.test(node.textContent?.trim() || "")
    ),
    dark: document.body.classList.contains("theme-dark"),
    recommendation: Boolean(document.querySelector(".recommendation-card")),
    ratingText: document.querySelector(".personal-rating strong")?.textContent?.trim() || "",
    personalHero: Boolean(document.querySelector(".personal-status")),
    guestHero: Boolean(document.querySelector(".guest-hero")),
    latestUnavailable: Boolean(document.querySelector(".guest-latest__empty")),
    dynamics: Boolean(document.querySelector(".guest-events__dynamic")),
    coverSize: (() => {
      const rect = document.querySelector(".recommendation-card__cover")?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    })(),
    tabbarDisplay: getComputedStyle(document.querySelector(".mobile-tabbar")).display,
    activeTab: document.querySelector(".mobile-tabbar [aria-current='page']")?.textContent?.trim() || "",
    publicHeadingColor: getComputedStyle(document.querySelector(".guest-latest h2")).color
  }));

  assert.ok(audit.scrollWidth <= audit.clientWidth, `horizontal overflow at ${viewport.width}x${viewport.height}`);
  assert.equal(audit.h1Count, 1, `heading hierarchy at ${viewport.width}x${viewport.height}`);
  assert.equal(audit.rawKeys, false, "raw locale key rendered");
  assert.equal(audit.dark, dark, "stored theme was not applied");
  if (dark) assert.equal(audit.publicHeadingColor, "rgb(242, 231, 220)", "dark public heading contrast regressed");
  if (state === "guest") assert.equal(audit.guestHero, true);
  if (state === "authenticated_ready") assert.equal(audit.personalHero, true);
  if (ratingFail) assert.doesNotMatch(await page.locator("body").innerText(), /\/api\/|\b500\b|worker|timeout/i);
  if (recommendationFail || recommendationEmpty) assert.equal(audit.recommendation, false);
  if (publicFail) assert.equal(audit.latestUnavailable, true);
  if (bilibiliFail) assert.equal(audit.dynamics, false);
  if (coverFail && audit.coverSize) assert.ok(audit.coverSize.width > 80 && audit.coverSize.height > 80);

  return { context, page, requests, audit };
};

const closeScenario = async (scenario) => scenario.context.close();
const results = [];
const record = async (name, options) => {
  const scenario = await openScenario(options);
  results.push({ name, viewport: options.viewport, requests: scenario.requests, audit: scenario.audit });
  await closeScenario(scenario);
};

for (const viewport of [
  { width: 320, height: 568 }, { width: 360, height: 800 }, { width: 375, height: 667 },
  { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 667, height: 375 },
  { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1280, height: 720 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 }
]) {
  await record(`ready-${viewport.width}x${viewport.height}`, {
    viewport,
    state: "authenticated_ready",
    username: longUser,
    rating: 99.99,
    recommendationTitle: longSong,
    screenshot: viewport.width === 375 || (viewport.width === 844 && viewport.height === 390)
      ? `ready-${viewport.width}x${viewport.height}.png`
      : undefined
  });
}

await record("guest-mobile", { viewport: { width: 390, height: 844 }, screenshot: "guest-390x844.png" });
await record("ready-mobile", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", screenshot: "ready-390x844.png" });
await record("ready-ja", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", locale: "ja", screenshot: "ready-ja-390x844.png" });
await record("ready-dark", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", dark: true, screenshot: "ready-dark-390x844.png" });
await record("rating-error", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", ratingFail: true, screenshot: "rating-error-390x844.png" });
await record("recommendation-error", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", recommendationFail: true, screenshot: "recommendation-error-390x844.png" });
await record("both-personal-errors", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", ratingFail: true, recommendationFail: true });
await record("recommendation-empty", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", recommendationEmpty: true });
await record("public-error", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", publicFail: true });
await record("bilibili-error", { viewport: { width: 390, height: 844 }, bilibiliFail: true });
await record("cover-error", { viewport: { width: 390, height: 844 }, state: "authenticated_ready", coverFail: true });
await record("guest-desktop", { viewport: { width: 1440, height: 900 }, screenshot: "guest-1440x900.png" });
await record("ready-desktop", { viewport: { width: 1440, height: 900 }, state: "authenticated_ready", screenshot: "ready-1440x900.png" });
await record("long-user-desktop", { viewport: { width: 1440, height: 900 }, state: "authenticated_ready", username: longUser, screenshot: "ready-long-user-1440x900.png" });
await record("long-song-desktop", { viewport: { width: 1440, height: 900 }, state: "authenticated_ready", recommendationTitle: longSong, screenshot: "ready-long-song-1440x900.png" });

for (const state of ["authenticated_unbound", "authenticated_bound_empty"]) {
  await record(state, { viewport: { width: 390, height: 844 }, state });
}

for (const rating of [0, 9.99, 10, 10.26, 99.99, null]) {
  const scenario = await openScenario({ viewport: { width: 390, height: 844 }, state: "authenticated_ready", rating });
  assert.equal(scenario.audit.ratingText, rating === null ? "成绩已连接" : Number(rating).toFixed(2));
  await closeScenario(scenario);
}

const transition = await openScenario({ viewport: { width: 390, height: 844 } });
await setHomeState(transition.page, "authenticated_ready", longUser);
await transition.page.waitForSelector(".personal-status");
await setHomeState(transition.page, "guest");
await transition.page.waitForSelector(".guest-hero");
assert.equal(await transition.page.locator(".personal-status").count(), 0, "personal data remained after logout");
await closeScenario(transition);

const resolver = await openScenario({ viewport: { width: 390, height: 844 } });
await resolver.page.evaluate(() => {
  window.__NUXT__.state["$shome-state-resolver"] = {
    status: "error", homeState: null, authenticated: null, currentBinding: null,
    hasScores: null, error: { stage: "auth", message: "fixture" }
  };
});
await resolver.page.waitForSelector(".viewer-friendly-alert");
assert.equal(await resolver.page.locator(".guest-hero").count(), 1);
await closeScenario(resolver);

const search = await openScenario({ viewport: { width: 390, height: 844 } });
await search.page.route("**/api/content/songs?**", async (route) => {
  const keyword = new URL(route.request().url()).searchParams.get("keyword");
  if (keyword === "loading") await new Promise((resolve) => setTimeout(resolve, 700));
  if (keyword === "error") {
    await route.fulfill({ status: 500, json: { message: "fixture" } });
    return;
  }
  await route.fulfill({ json: {
    total: keyword === "empty" ? 0 : 1, page: 1, pageSize: 12,
    songs: keyword === "empty" ? [] : [{ id: 1455, song_name: "无敌的HAPPINESS", song_name_jp: "無敵的ハピネス！" }]
  } });
});
const input = search.page.locator("#guest-home-song-search");
await input.fill("loading");
await search.page.waitForSelector(".guest-song-search__status");
assert.match(await search.page.locator(".guest-song-search__status").innerText(), /加载|読み込み/);
await search.page.waitForSelector(".guest-song-search__result");
await input.fill("empty");
await search.page.waitForTimeout(400);
assert.match(await search.page.locator(".guest-song-search__status").innerText(), /没有找到|一致する/);
await input.fill("error");
await search.page.waitForTimeout(500);
assert.match(await search.page.locator(".guest-song-search__status").innerText(), /暂时不可用|利用できません/);
await input.fill("无敌");
await search.page.waitForSelector(".guest-song-search__result");
await input.press("ArrowDown");
assert.ok(await input.getAttribute("aria-activedescendant"));
await input.press("Escape");
assert.equal(await input.getAttribute("aria-expanded"), "false");
await input.fill("无敌");
await search.page.waitForSelector(".guest-song-search__result");
await search.page.locator(".guest-song-search__result").click();
await search.page.waitForURL(/\/songs\/1455/);
await closeScenario(search);

const focus = await openScenario({ viewport: { width: 390, height: 844 }, state: "authenticated_ready" });
for (const selector of [".personal-button", ".mobile-tabbar__item"]) {
  await focus.page.locator(selector).first().focus();
  const outline = await focus.page.locator(selector).first().evaluate((element) => getComputedStyle(element).outlineStyle);
  assert.notEqual(outline, "none", `${selector} has no visible focus style`);
}
await closeScenario(focus);

await browser.close();
process.stdout.write(`${JSON.stringify({ ok: true, baseUrl, artifactDir, results }, null, 2)}\n`);
