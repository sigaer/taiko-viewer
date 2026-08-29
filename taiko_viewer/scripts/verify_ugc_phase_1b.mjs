#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";

const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
};
const baseUrl = valueOf("base-url", "http://127.0.0.1:3100").replace(/\/$/, "");
const artifactDir = valueOf("artifacts", "/tmp/taiko-ugc-phase-1c");
const database = String(process.env.TAIKO_DB_NAME || "");
assert.ok(database.endsWith("_test"), "UGC E2E requires a database ending in _test");

const fixtureTokens = Object.fromEntries("ABCDEFG".split("").map((letter) => [`user${letter}`, letter.toLowerCase().repeat(64)]));
const db = await mysql.createConnection({
  host: process.env.TAIKO_DB_HOST,
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER,
  password: process.env.TAIKO_DB_PASSWORD,
  database
});
const applyFixture = (state) => {
  const result = spawnSync(process.execPath, ["scripts/seed_ugc_test_fixture.mjs", `--state=${state}`], {
    cwd: process.cwd(), env: process.env, encoding: "utf8"
  });
  assert.equal(result.status, 0, `fixture ${state} failed: ${result.stderr || result.stdout}`);
};
const request = async (path, options = {}) => {
  const headers = { accept: "application/json", "x-forwarded-for": options.ip || "198.51.100.10" };
  if (options.cookie) headers.cookie = `stv_session=${options.cookie}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual"
  });
  const body = await response.json();
  assert.equal(response.status, options.expected || 200, `${options.method || "GET"} ${path}: ${JSON.stringify(body).slice(0, 240)}`);
  return { body, headers: response.headers };
};
const putDifficulty = (cookie, value, options = {}) => request(
  "/api/account/charts/1419/4/ugc/difficulty",
  { method: "PUT", body: { value }, cookie, ...options }
);
const putTags = (cookie, slugs, options = {}) => request(
  "/api/account/charts/1419/4/ugc/tags",
  { method: "PUT", body: { slugs }, cookie, ...options }
);

applyFixture("empty");
const empty = await request("/api/content/songs/1419/ugc?difficulty=4");
assert.equal(empty.body.chart.songId, 1419, "empty existing chart was mistaken for missing");
assert.equal(empty.body.difficulty.count, 0);
assert.equal(empty.body.availableTags.length, 16);
assert.match(empty.headers.get("cache-control") || "", /^public, max-age=5, s-maxage=5, stale-while-revalidate=10$/);

await request("/api/account/charts/1419/4/ugc/difficulty", {
  method: "PUT", body: { value: 1 }, expected: 401
});
await request("/api/account/charts/1419/4/ugc/tags", {
  method: "PUT", body: { slugs: [] }, expected: 401
});
await putDifficulty(fixtureTokens.userA, 3, { expected: 400 });
await putDifficulty(fixtureTokens.userA, "1", { expected: 400 });
await request("/api/account/charts/11/4/ugc/difficulty", {
  method: "PUT", body: { value: 1 }, cookie: fixtureTokens.userA, expected: 410
});

assert.equal((await putDifficulty(fixtureTokens.userA, 1)).body.difficultyVote, 1);
assert.equal((await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userA })).body.difficultyVote, 1);
assert.equal((await putDifficulty(fixtureTokens.userA, -1)).body.difficultyVote, -1);
assert.equal((await putDifficulty(fixtureTokens.userA, null)).body.difficultyVote, null);
const [singleVoteRows] = await db.query("SELECT COUNT(*) AS count FROM chart_difficulty_votes WHERE user_id = 101");
assert.equal(Number(singleVoteRows[0].count), 0);

await putDifficulty(fixtureTokens.userA, 1);
await putDifficulty(fixtureTokens.userB, 1);
await putDifficulty(fixtureTokens.userC, 0);
const aggregate = await request("/api/content/songs/1419/ugc?difficulty=4", { cookie: fixtureTokens.userA });
assert.equal(aggregate.body.difficulty.count, 3);
assert.equal(aggregate.body.difficulty.verifiedCount, 2);
assert.deepEqual(aggregate.body.difficulty.distribution, { "0": 1, "1": 2, "2": 0, "-2": 0, "-1": 0 });
assert.equal(aggregate.body.difficulty.summary, "hard");
assert.equal(aggregate.headers.get("cache-control"), "private, no-store");
await putDifficulty(fixtureTokens.userD, -1);
const [verifiedRows] = await db.query(
  "SELECT user_id AS userId, verified_play AS verifiedPlay FROM chart_difficulty_votes ORDER BY user_id"
);
assert.deepEqual(verifiedRows.map((row) => [Number(row.userId), Number(row.verifiedPlay)]), [[101, 1], [102, 1], [103, 0], [104, 0]]);
for (const token of [fixtureTokens.userA, fixtureTokens.userB, fixtureTokens.userC, fixtureTokens.userD]) {
  await putDifficulty(token, null);
}

assert.deepEqual((await putTags(fixtureTokens.userA, ["stamina", "high-speed"])).body.tagSlugs, ["stamina", "high-speed"]);
assert.deepEqual((await putTags(fixtureTokens.userA, ["high-speed", "long-compounds"])).body.tagSlugs, ["long-compounds", "high-speed"]);
assert.deepEqual((await putTags(fixtureTokens.userA, [])).body.tagSlugs, []);
await putTags(fixtureTokens.userA, ["rhythm-tricky", "even-patterns", "24th-notes", "tempo-changes", "compound-patterns", "stamina"], { expected: 400 });
await putTags(fixtureTokens.userA, ["not-a-tag"], { expected: 400 });

await putTags(fixtureTokens.userA, ["stamina", "high-speed"]);
await putTags(fixtureTokens.userB, ["stamina", "high-speed"]);
await putTags(fixtureTokens.userC, ["stamina"]);
const tagAggregate = await request("/api/content/songs/1419/ugc?difficulty=4", { cookie: fixtureTokens.userA });
assert.deepEqual(tagAggregate.body.tags.map((tag) => [tag.slug, tag.count, tag.percentage]), [
  ["stamina", 3, 100], ["high-speed", 2, 66.7]
]);
const [tagVerifiedRows] = await db.query(
  "SELECT user_id AS userId, MIN(verified_play) AS verifiedPlay, COUNT(*) AS count FROM chart_tag_votes GROUP BY user_id ORDER BY user_id"
);
assert.deepEqual(tagVerifiedRows.map((row) => [Number(row.userId), Number(row.verifiedPlay), Number(row.count)]), [[101, 1, 2], [102, 1, 2], [103, 0, 1]]);
for (const token of [fixtureTokens.userA, fixtureTokens.userB, fixtureTokens.userC]) await putTags(token, []);

applyFixture("rich");
await putTags(fixtureTokens.userF, ["backloaded"], { expected: 400 });
const [chartRows] = await db.query("SELECT chart_id AS chartId FROM ugc_charts WHERE song_id = 1419 AND difficulty_code = 4");
const [deprecatedTagRows] = await db.query("SELECT tag_id AS tagId FROM ugc_tags WHERE slug = 'backloaded'");
await db.execute(
  "INSERT INTO chart_tag_votes (chart_id, tag_id, user_id, verified_play) VALUES (?, ?, 106, 0)",
  [chartRows[0].chartId, deprecatedTagRows[0].tagId]
);
const deprecatedMe = await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userF });
assert.deepEqual(deprecatedMe.body.tagSelections.map((tag) => [tag.slug, tag.status]), [["backloaded", "deprecated"]]);
assert.deepEqual((await putTags(fixtureTokens.userF, [])).body.tagSlugs, []);

applyFixture("empty");
const concurrentDifficulty = await Promise.all([
  putDifficulty(fixtureTokens.userF, -2, { ip: "198.51.100.21" }),
  putDifficulty(fixtureTokens.userF, 2, { ip: "198.51.100.22" })
]);
assert.equal(concurrentDifficulty.every((result) => [-2, 2].includes(result.body.difficultyVote)), true);
const concurrentDifficultyMe = await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userF });
assert.ok([-2, 2].includes(concurrentDifficultyMe.body.difficultyVote));
const [oneVoteRow] = await db.query("SELECT COUNT(*) AS count FROM chart_difficulty_votes WHERE user_id = 106");
assert.equal(Number(oneVoteRow[0].count), 1);

const tagSetA = ["stamina", "high-speed"];
const tagSetB = ["long-compounds", "backloaded"];
await Promise.all([
  putTags(fixtureTokens.userF, tagSetA, { ip: "198.51.100.23" }),
  putTags(fixtureTokens.userF, tagSetB, { ip: "198.51.100.24" })
]);
const concurrentTagMe = await request("/api/account/charts/1419/4/ugc/me", { cookie: fixtureTokens.userF });
assert.ok(
  [tagSetA, tagSetB].some((set) => JSON.stringify([...set].sort()) === JSON.stringify([...concurrentTagMe.body.tagSlugs].sort())),
  "concurrent tag replacements produced a mixed set"
);
await putDifficulty(fixtureTokens.userF, null, { ip: "198.51.100.25" });
await putTags(fixtureTokens.userF, [], { ip: "198.51.100.26" });

await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"]
});

const openPage = async ({ state, viewport, locale = "zh", dark = false, loggedIn = false, reducedMotion = "no-preference", screenshot }) => {
  applyFixture(state);
  const context = await browser.newContext({ viewport, serviceWorkers: "block", reducedMotion });
  if (loggedIn) await context.addCookies([{ name: "stv_session", value: fixtureTokens.userA, url: baseUrl }]);
  const page = await context.newPage();
  const requests = [];
  page.on("request", (requestValue) => {
    const url = new URL(requestValue.url());
    if (url.pathname.includes("/ugc")) requests.push({ method: requestValue.method(), path: `${url.pathname}${url.search}` });
  });
  await page.addInitScript((useDark) => localStorage.setItem("taiko_theme", useDark ? "dark" : "light"), dark);
  const response = await page.goto(`${baseUrl}${locale === "ja" ? "/ja" : ""}/songs/1419`, {
    waitUntil: "networkidle", timeout: 60_000
  });
  assert.equal(response?.status(), 200);
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dark: document.body.classList.contains("theme-dark")
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `horizontal overflow at ${viewport.width}x${viewport.height}`);
  assert.equal(dimensions.dark, dark);
  if (screenshot) await page.screenshot({ path: `${artifactDir}/${screenshot}`, fullPage: true });
  return { context, page, requests };
};

const guest = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, screenshot: "guest-empty-mobile.png" });
assert.match(await guest.page.locator(".chart-ugc-section").innerText(), /还没有人留下判断.*还没有常见标签/s);
assert.ok((await guest.page.locator(".ugc-choice").first().boundingBox()).height >= 44);
await guest.page.getByRole("radio", { name: "偏难", exact: true }).click();
await guest.page.waitForURL(/\/account\/login\?redirect=/);
assert.match(decodeURIComponent(guest.page.url()), /\/songs\/1419\?difficulty=4/);
await guest.context.close();

const logged = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, loggedIn: true, screenshot: "logged-empty-mobile.png" });
const hardChoice = logged.page.getByRole("radio", { name: "偏难", exact: true });
await hardChoice.click();
await logged.page.waitForFunction(() => document.querySelector(".ugc-choice[aria-checked='true']")?.textContent?.includes("偏难"));
await logged.page.locator(".ugc-distribution").waitFor();
assert.equal(logged.requests.filter((item) => item.method === "PUT" && item.path.endsWith("/ugc/difficulty")).length, 1);
assert.equal(logged.requests.filter((item) => item.method === "GET" && item.path.includes("difficulty=4")).length, 1);
await logged.page.getByRole("radio", { name: "偏易", exact: true }).click();
await logged.page.waitForFunction(() => document.querySelector(".ugc-choice[aria-checked='true']")?.textContent?.includes("偏易"));
await logged.page.locator(".ugc-clear").click();
await logged.page.waitForFunction(() => !document.querySelector(".ugc-choice[aria-checked='true']"));

await logged.page.locator(".ugc-tag-editor-toggle").click();
const tagOptions = logged.page.locator(".ugc-tag-option");
for (let index = 0; index < 5; index += 1) await tagOptions.nth(index).click();
await logged.page.waitForFunction(() => document.querySelectorAll(".ugc-tag-option[aria-pressed='true']").length === 5);
await tagOptions.nth(5).click();
await logged.page.locator(".ugc-inline-error").filter({ hasText: "最多选择 5 个" }).waitFor();
assert.equal(await logged.page.locator(".ugc-tag-option[aria-pressed='true']").count(), 5);
await logged.page.screenshot({ path: `${artifactDir}/logged-five-tags-mobile.png`, fullPage: true });
await logged.context.close();

const difficultyFailure = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, loggedIn: true });
await difficultyFailure.page.route("**/api/account/charts/1419/4/ugc/difficulty", (route) =>
  route.fulfill({ status: 500, json: { message: "database transaction failed" } }));
await difficultyFailure.page.getByRole("radio", { name: "偏难", exact: true }).click();
await difficultyFailure.page.locator(".ugc-inline-error").filter({ hasText: "保存失败，请重试" }).waitFor();
assert.equal(await difficultyFailure.page.locator(".ugc-choice[aria-checked='true']").count(), 0);
await difficultyFailure.page.locator(".ugc-tag-editor-toggle").click();
await difficultyFailure.page.locator(".ugc-tag-option").first().click();
await difficultyFailure.page.waitForFunction(() => document.querySelectorAll(".ugc-tag-option[aria-pressed='true']").length === 1);
assert.doesNotMatch(await difficultyFailure.page.locator("body").innerText(), /database transaction|\/api\//i);
await difficultyFailure.context.close();

const tagFailure = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, loggedIn: true });
await tagFailure.page.route("**/api/account/charts/1419/4/ugc/tags", (route) =>
  route.fulfill({ status: 500, json: { message: "duplicate key" } }));
await tagFailure.page.locator(".ugc-tag-editor-toggle").click();
await tagFailure.page.locator(".ugc-tag-option").first().click();
await tagFailure.page.locator(".ugc-inline-error").filter({ hasText: "保存失败，请重试" }).waitFor();
assert.equal(await tagFailure.page.locator(".ugc-tag-option[aria-pressed='true']").count(), 0);
await tagFailure.page.getByRole("radio", { name: "合理", exact: true }).click();
await tagFailure.page.waitForFunction(() => document.querySelector(".ugc-choice[aria-checked='true']")?.textContent?.includes("合理"));
await tagFailure.context.close();

const switchPage = await openPage({ state: "empty", viewport: { width: 390, height: 844 }, loggedIn: true });
await switchPage.page.getByRole("radio", { name: "偏难", exact: true }).click();
await switchPage.page.waitForFunction(() => document.querySelector(".ugc-choice[aria-checked='true']")?.textContent?.includes("偏难"));
await switchPage.page.locator(".track-btn").filter({ hasText: "里谱" }).click();
await switchPage.page.waitForFunction(() => document.querySelector(".chart-ugc-difficulty")?.textContent?.includes("里谱"));
assert.equal(await switchPage.page.locator(".ugc-choice[aria-checked='true']").count(), 0);
await switchPage.page.locator(".track-btn").filter({ hasText: /^魔王/ }).click();
await switchPage.page.waitForFunction(() => document.querySelector(".ugc-choice[aria-checked='true']")?.textContent?.includes("偏难"));
await switchPage.context.close();

const smallPage = await openPage({ state: "small", viewport: { width: 390, height: 844 }, screenshot: "small-mobile.png" });
assert.match(await smallPage.page.locator(".chart-ugc-section").innerText(), /样本还少.*2 位玩家/s);
assert.equal(await smallPage.page.locator(".ugc-distribution li").count(), 2);
await smallPage.context.close();

const japaneseDark = await openPage({
  state: "rich", viewport: { width: 390, height: 844 }, locale: "ja", dark: true, loggedIn: true,
  reducedMotion: "reduce", screenshot: "rich-mobile-ja-dark.png"
});
assert.match(await japaneseDark.page.locator(".chart-ugc-section").innerText(), /プレイヤーの譜面体験.*譜面タグを選ぶ.*プレイヤーのヒント/s);
assert.equal(await japaneseDark.page.locator(".ugc-choice[aria-checked='true']").count(), 1);
await japaneseDark.context.close();

const narrow = await openPage({
  state: "empty", viewport: { width: 375, height: 812 }, screenshot: "guest-empty-375.png"
});
assert.equal(await narrow.page.locator(".ugc-difficulty-choices").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 2);
await narrow.context.close();

const tablet = await openPage({
  state: "rich", viewport: { width: 768, height: 1024 }, dark: true, screenshot: "rich-tablet-dark.png"
});
assert.equal(await tablet.page.locator(".chart-ugc-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 2);
await tablet.context.close();

const desktop = await openPage({
  state: "rich", viewport: { width: 1440, height: 900 }, dark: true, loggedIn: true, screenshot: "rich-desktop-dark.png"
});
await desktop.page.locator(".ugc-tag-editor-toggle").click();
assert.equal(await desktop.page.locator(".ugc-deprecated-tags").count(), 1);
const selectedDifficulty = desktop.page.locator(".ugc-choice[aria-checked='true']");
await selectedDifficulty.focus();
await desktop.page.keyboard.press("ArrowRight");
await desktop.page.waitForFunction(() => document.activeElement?.getAttribute("aria-checked") === "true");
assert.equal(await desktop.page.locator(".ugc-choice[aria-checked='true']").count(), 1);
const keyboardTag = desktop.page.locator(".ugc-tag-option").filter({ hasText: "节奏难" });
await keyboardTag.focus();
await desktop.page.keyboard.press("Space");
await desktop.page.waitForFunction(() => document.activeElement?.getAttribute("aria-pressed") === "true");
assert.equal(await keyboardTag.getAttribute("aria-pressed"), "true");
await desktop.page.screenshot({ path: `${artifactDir}/rich-desktop-tag-editor-dark.png`, fullPage: true });
await desktop.context.close();

const landscape = await openPage({
  state: "rich", viewport: { width: 844, height: 390 }, loggedIn: true, reducedMotion: "reduce",
  screenshot: "rich-landscape-reduced-motion.png"
});
await landscape.context.close();
await browser.close();

applyFixture("empty");
let rateLimitedAt = 0;
for (let index = 1; index <= 31; index += 1) {
  const result = await request("/api/account/charts/1419/4/ugc/difficulty", {
    method: "PUT",
    body: { value: index % 2 ? 1 : -1 },
    cookie: fixtureTokens.userG,
    ip: "203.0.113.77",
    expected: index === 31 ? 429 : 200
  });
  if (result.body.statusCode === 429) rateLimitedAt = index;
}
assert.equal(rateLimitedAt, 31);

applyFixture("empty");
const [contributionRows] = await db.query(
  `SELECT
    (SELECT COUNT(*) FROM chart_difficulty_votes) AS difficultyVotes,
    (SELECT COUNT(*) FROM chart_tag_votes) AS tagVotes`
);
assert.deepEqual(contributionRows[0], { difficultyVotes: 0, tagVotes: 0 });
await db.end();
process.stdout.write(`${JSON.stringify({
  api: {
    difficultyPersistence: true, clear: true, tagsReplacement: true, maxFive: true,
    invalidDeprecated: true, verifiedSnapshot: true, aggregateRefresh: true,
    auth: true, rateLimitAt: rateLimitedAt, concurrentWrites: true
  },
  browser: {
    guestEmpty: true, loggedEmpty: true, voteModifyClear: true, tagOneToFive: true,
    sixthRejected: true, small: true, rich: true, errorsIsolated: true,
    ja: true, dark: true, oniUra: true, desktopKeyboard: true, reducedMotion: true
  },
  artifacts: artifactDir
}, null, 2)}\n`);
