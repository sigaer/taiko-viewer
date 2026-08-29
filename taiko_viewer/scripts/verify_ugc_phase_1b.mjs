#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
};
const baseUrl = valueOf("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const artifactDir = valueOf("artifacts", "/tmp/taiko-ugc-phase-1b");
const database = String(process.env.TAIKO_DB_NAME || "");
assert.ok(database.endsWith("_test"), "UGC E2E requires a database ending in _test");

const fixtureTokens = {
  userA: "a".repeat(64),
  userB: "b".repeat(64)
};
const applyFixture = (state) => {
  const result = spawnSync(process.execPath, ["scripts/seed_ugc_test_fixture.mjs", `--state=${state}`], {
    cwd: process.cwd(), env: process.env, encoding: "utf8"
  });
  assert.equal(result.status, 0, `fixture ${state} failed: ${result.stderr || result.stdout}`);
};
const request = async (path, { cookie, expected = 200 } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie: `stv_session=${cookie}` } : undefined,
    redirect: "manual"
  });
  const body = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(body).slice(0, 240)}`);
  return { body, headers: response.headers };
};

applyFixture("rich");
const rich = await request("/api/content/songs/1419/ugc?difficulty=4");
assert.equal(rich.body.difficulty.summary, "hard");
assert.deepEqual(rich.body.difficulty.distribution, { "0": 1, "1": 2, "2": 1, "-2": 0, "-1": 0 });
assert.equal(rich.body.difficulty.verifiedCount, 2);
assert.deepEqual(rich.body.tags.map((tag) => tag.slug), ["stamina", "high-speed", "long-compounds"]);
assert.equal(rich.body.tags.some((tag) => tag.slug === "backloaded"), false, "deprecated tag leaked publicly");
assert.deepEqual(rich.body.tips.map((tip) => tip.tipId), ["9001", "9003", "9002"]);
assert.equal(rich.body.tips[1].author.isDeleted, true);
assert.match(rich.body.tips[0].body, /<script>alert\('x'\)<\/script>.*https:\/\/.*🎵.*日本語/);
assert.doesNotMatch(JSON.stringify(rich.body), /"(?:userId|email|difficultyVote|tagSlugs|helpfulTipIds)"/);
assert.match(rich.headers.get("cache-control") || "", /^public,.*stale-while-revalidate=/);

const ura = await request("/api/content/songs/1419/ugc?difficulty=5");
assert.equal(ura.body.difficulty.summary, "easy");
const privateA = await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userA });
const privateB = await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userB });
assert.notDeepEqual(privateA.body, privateB.body, "private viewer states were shared");
assert.match(privateA.headers.get("cache-control") || "", /^private, no-store$/);
await request("/api/account/charts/1419/4/ugc/me", { expected: 401 });
await request("/api/content/songs/1419/ugc?difficulty=x", { expected: 400 });
await request("/api/content/songs/1/ugc?difficulty=5", { expected: 404 });
await request("/api/content/songs/11/ugc?difficulty=4", { expected: 410 });

applyFixture("empty");
const empty = await request("/api/content/songs/1419/ugc?difficulty=4");
assert.equal(empty.body.chart.songId, 1419, "empty existing chart was mistaken for missing");
assert.equal(empty.body.difficulty.count, 0);
assert.equal(empty.body.difficulty.summary, "insufficient");
assert.deepEqual(empty.body.tags, []);
assert.deepEqual(empty.body.tips, []);

applyFixture("small");
const small = await request("/api/content/songs/1419/ugc?difficulty=4");
assert.equal(small.body.difficulty.count, 2);
assert.equal(small.body.difficulty.summary, "insufficient");
assert.deepEqual(small.body.tags, []);

await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"]
});

const openPage = async ({ state, viewport, locale = "zh", dark = false, loggedIn = false, screenshot }) => {
  applyFixture(state);
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  if (loggedIn) {
    await context.addCookies([{ name: "stv_session", value: fixtureTokens.userA, url: baseUrl }]);
  }
  const page = await context.newPage();
  const requests = [];
  page.on("request", (requestValue) => {
    const url = new URL(requestValue.url());
    if (url.pathname.includes("/ugc")) requests.push(`${url.pathname}${url.search}`);
  });
  await page.addInitScript((useDark) => localStorage.setItem("taiko_theme", useDark ? "dark" : "light"), dark);
  const response = await page.goto(`${baseUrl}${locale === "ja" ? "/ja" : ""}/songs/1419`, {
    waitUntil: "networkidle", timeout: 60_000
  });
  assert.equal(response?.status(), 200);
  if (screenshot) await page.screenshot({ path: `${artifactDir}/${screenshot}`, fullPage: true });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dark: document.body.classList.contains("theme-dark")
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `horizontal overflow at ${viewport.width}x${viewport.height}`);
  assert.equal(dimensions.dark, dark);
  return { context, page, requests };
};

applyFixture("rich");
const mobile = await openPage({
  state: "rich", viewport: { width: 390, height: 844 }, loggedIn: true, screenshot: "rich-mobile-zh.png"
});
assert.equal(await mobile.page.locator(".chart-ugc-section").count(), 1);
assert.equal(await mobile.page.locator(".chart-ugc-section script").count(), 0, "tip text created executable markup");
assert.match(await mobile.page.locator(".chart-ugc-section").innerText(), /整体偏难.*常见标签.*玩家提示/s);
assert.equal(await mobile.page.locator(".detail-main").count(), 1);
assert.equal(await mobile.page.locator(".player-card").count(), 1);
assert.equal(await mobile.page.locator(".fumen-block").count(), 1);
assert.equal(await mobile.page.locator(".account-score-section").count(), 1);
const order = await mobile.page.evaluate(() => {
  const detail = document.querySelector(".detail-main");
  const ugc = document.querySelector(".chart-ugc-section");
  const scores = document.querySelector(".account-score-section");
  return detail && ugc && scores
    ? Boolean(detail.compareDocumentPosition(ugc) & Node.DOCUMENT_POSITION_FOLLOWING)
      && Boolean(ugc.compareDocumentPosition(scores) & Node.DOCUMENT_POSITION_FOLLOWING)
    : false;
});
assert.equal(order, true, "UGC section is not between detail-main and account scores");
await mobile.page.locator(".track-btn").filter({ hasText: "里谱" }).click();
await mobile.page.locator(".chart-ugc-section").filter({ hasText: "整体偏易" }).waitFor();
assert.equal(mobile.requests.filter((path) => path.includes("difficulty=5")).length, 1, "URA used more than one public summary request");
await mobile.context.close();

const smallPage = await openPage({ state: "small", viewport: { width: 390, height: 844 }, screenshot: "small-mobile.png" });
const smallText = await smallPage.page.locator(".chart-ugc-section").innerText();
assert.match(smallText, /样本还少.*2 位玩家/s);
assert.equal(await smallPage.page.locator(".ugc-distribution li").count(), 2, "small sample rendered zero buckets");
await smallPage.context.close();

const emptyPage = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, screenshot: "empty-mobile.png" });
assert.equal(await emptyPage.page.locator(".chart-ugc-section").count(), 0, "empty UGC section should stay hidden");
await emptyPage.context.close();

const japaneseDark = await openPage({
  state: "rich", viewport: { width: 390, height: 844 }, locale: "ja", dark: true, screenshot: "rich-mobile-ja-dark.png"
});
assert.match(await japaneseDark.page.locator(".chart-ugc-section").innerText(), /プレイヤーの譜面体験.*よく選ばれるタグ/s);
await japaneseDark.context.close();

const desktop = await openPage({
  state: "rich", viewport: { width: 1440, height: 900 }, screenshot: "rich-desktop.png"
});
assert.equal(await desktop.page.locator(".chart-ugc-grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length), 2);
assert.match(await desktop.page.locator(".ugc-tip p").first().innerText(), /https:\/\/example\.com\/path.*日本語/s);
await desktop.context.close();

const failure = await openPage({ state: "rich", viewport: { width: 390, height: 844 } });
await failure.page.route("**/api/content/songs/1419/ugc?difficulty=5", (route) =>
  route.fulfill({ status: 500, json: { message: "fixture internal failure" } }));
await failure.page.locator(".track-btn").filter({ hasText: "里谱" }).click();
await failure.page.waitForTimeout(500);
assert.doesNotMatch(await failure.page.locator("body").innerText(), /fixture internal failure|\/api\/content|\b500\b/);
await failure.context.close();

const race = await openPage({ state: "rich", viewport: { width: 390, height: 844 } });
await race.page.route("**/api/content/songs/1419/ugc?difficulty=5", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await route.continue();
});
await race.page.locator(".track-btn").filter({ hasText: "里谱" }).click();
await race.page.waitForTimeout(50);
await race.page.locator(".track-btn").filter({ hasText: /^魔王/ }).click();
await race.page.locator(".chart-ugc-section").filter({ hasText: "整体偏难" }).waitFor();
await race.page.waitForTimeout(650);
assert.match(await race.page.locator(".chart-ugc-section").innerText(), /整体偏难/);
await race.context.close();

await browser.close();
applyFixture("empty");
process.stdout.write(`${JSON.stringify({
  api: { rich: true, empty: true, small: true, resolver: true, cacheIsolation: true },
  browser: { mobile: true, desktop: true, ja: true, dark: true, error: true, slowRace: true },
  publicSummaryRequestsPerDifficultySwitch: 1,
  artifacts: artifactDir
}, null, 2)}\n`);
