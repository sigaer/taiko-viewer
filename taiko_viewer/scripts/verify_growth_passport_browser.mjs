#!/usr/bin/env node
// Run under scripts/memory/run_qa.sh after a bounded local build.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, open, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const out = process.env.PASSPORT_BROWSER_ARTIFACTS || "/var/tmp/growth-passport";
const base = "http://127.0.0.1:3197";
const scenarios = ["rich", "new", "focus", "balanced", "limited", "model-break", "range-30", "range-180", "range-365-short", "milestone-rich", "no-milestones", "active-goal", "recent-goal", "profile-switch"];
const results = [];
await mkdir(out, { recursive: true });
const log = await open(`${out}/server.log`, "w");
let server;
let browser;
const deadline = setTimeout(() => { console.error("Passport browser deadline exceeded"); process.exit(124); }, 840000);

const dimensions = (baseValue = 10) => ({ big_song: baseValue + .2, stamina: baseValue + .1, speed: baseValue - .1, accuracy_power: baseValue - .4, rhythm: baseValue, complex: baseValue + .05 });
const point = (id, day, overrides = {}) => ({
  id,
  day,
  capturedAt: `${day}T04:00:00.000Z`,
  scoreRevision: id.padEnd(64, "a").slice(0, 64),
  measurementVersion: 1,
  algorithmVersion: "growth-v1",
  modelRevision: "a".repeat(64),
  rating: 10 + Number(id.replace(/\D/g, "") || 0) / 100,
  dimensions: dimensions(10 + Number(id.replace(/\D/g, "") || 0) / 100),
  focus: "accuracy_power",
  sampleCount: 60,
  availabilityState: "ready",
  ...overrides
});
const segment = (id, points, overrides = {}) => ({ id, measurementVersion: 1, algorithmVersion: "growth-v1", modelRevision: "a".repeat(64), from: points[0].day, to: points.at(-1).day, points, ...overrides });
const milestone = (id, type, songId, day, before, after, overrides = {}) => ({
  id,
  primaryType: type,
  factKeys: [`fact-${id}`],
  day,
  observedAt: `${day}T05:00:00.000Z`,
  timeSemantics: "played",
  title: `Passport Song ${songId}`,
  songId,
  difficultyType: 4,
  before,
  after,
  delta: before === null || after === null ? null : after - before,
  goalCompleted: false,
  observationOnly: false,
  ...overrides
});
const goal = status => ({ id: `goal-${status}`, profileId: "1", songId: 101, difficultyType: 4, title: status === "active" ? "Current Practice" : "Finished Practice", starLevel: 9, goalType: "score-pb", status, unavailable: false, baselineVersion: 1, baseline: {}, source: "today-plan", sourceBasis: null, sourceMode: "dimension", sourceRank: 1, sourceRevision: "r", sourceGeneratedAt: "2026-09-21T00:00:00.000Z", targetData: { comparison: "greater", field: "highScore" }, createdAt: "2026-09-20T00:00:00.000Z", cancelledAt: null });

const buildPayload = scenario => {
  const requestedDays = scenario === "range-30" ? 30 : scenario === "range-180" ? 180 : scenario === "range-365-short" ? 365 : 90;
  const first = point("p1", "2026-09-17");
  const middle = point("p2", "2026-09-19", { focus: scenario === "focus" ? "rhythm" : "accuracy_power" });
  const latestFocus = scenario === "balanced" ? "balanced" : scenario === "limited" ? "limited" : scenario === "focus" ? "rhythm" : "accuracy_power";
  const latest = point("p3", "2026-09-21", { focus: latestFocus, availabilityState: scenario === "limited" ? "limited" : "ready", dimensions: scenario === "balanced" ? dimensions(10.2) : dimensions(10.4) });
  const modelBreak = scenario === "model-break";
  const segments = scenario === "new" ? [segment("segment-1", [latest])]
    : modelBreak ? [segment("segment-1", [first, middle]), segment("segment-2", [latest], { modelRevision: "b".repeat(64) })]
      : [segment("segment-1", [first, middle, latest])];
  if (modelBreak) latest.modelRevision = "b".repeat(64);
  const richMilestones = [
    milestone("fc", "fc", 101, "2026-09-21", 0, 1, { goalCompleted: true }),
    milestone("pb", "score-pb", 102, "2026-09-20", 900000, 920000),
    milestone("ng", "ng-reduced", 103, "2026-09-19", 8, 4),
    milestone("rank", "rank-upgrade", 104, "2026-09-18", 4, 5),
    milestone("goal", "goal-completed", 105, null, null, null, { observedAt: "2026-09-17T05:00:00.000Z", timeSemantics: "observed", goalCompleted: true, observationOnly: true })
  ];
  const milestones = ["no-milestones", "new", "limited"].includes(scenario) ? [] : scenario === "milestone-rich" ? [...richMilestones, milestone("df", "df", 106, "2026-09-16", 1, 2), milestone("pb2", "score-pb", 107, "2026-09-15", 880000, 900000), milestone("pb3", "score-pb", 108, "2026-09-14", 870000, 890000)] : richMilestones.slice(0, 3);
  const points = segments.flatMap(item => item.points);
  const readiness = scenario === "limited" ? "limited" : "ready";
  return {
    profileId: scenario === "profile-switch" ? "2" : "1",
    coverage: { measurementFrom: "2026-09-17T04:00:00.000Z", measurementTo: "2026-09-21T04:00:00.000Z", measurementDays: points.length, recentFactsFrom: "2026-06-24", recentFactsTo: "2026-09-21", recentFactsState: scenario === "limited" ? "unknown" : "complete" },
    current: { rating: 10.43, dimensions: dimensions(10.4), focus: latestFocus, readiness },
    range: { requestedDays, actualFrom: points[0].day, actualTo: points.at(-1).day, timezone: "Asia/Shanghai", selectedDimension: "rating" },
    segments,
    currentSegmentChange: { start: segments.at(-1).points[0], end: segments.at(-1).points.at(-1), compatible: readiness === "ready" && segments.at(-1).points.length > 1, reason: readiness !== "ready" ? "limited" : segments.at(-1).points.length > 1 ? "compatible" : "insufficient", ratingDelta: .2, dimensionDeltas: dimensions(.2), primaryDimensionChange: { key: "accuracy_power", before: 9.6, after: 10, delta: .4 }, focusFrom: first.focus, focusTo: latestFocus },
    focusTimeline: segments.flatMap((item, segmentIndex) => scenario === "focus" && segmentIndex === 0 ? [
      { id: "focus-1", segmentId: item.id, focus: "accuracy_power", startedAt: "2026-09-17", endedAt: "2026-09-17", current: false },
      { id: "focus-2", segmentId: item.id, focus: "rhythm", startedAt: "2026-09-19", endedAt: "2026-09-21", current: true }
    ] : [{ id: `focus-${segmentIndex}`, segmentId: item.id, focus: item.points.at(-1).focus, startedAt: item.from, endedAt: item.to, current: segmentIndex === segments.length - 1 }]),
    milestones,
    activeGoal: scenario === "active-goal" ? goal("active") : null,
    recentCompletedGoal: scenario === "recent-goal" ? goal("completed") : null,
    currentNextAction: { focus: latestFocus, todayPlan: { targetDimension: "accuracy_power", usedFallback: false, items: [{ songId: 101, difficultyType: 4, starLevel: 9, title: "Next Passport Song", isUnplayed: false, targetDimension: "accuracy_power", reason: "target-dimension", currentBestScore: 900000, currentBestRank: 5 }] } }
  };
};

try {
  server = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: process.env.TMPDIR, HOST: "127.0.0.1", PORT: "3197", NUXT_REPO_ROOT: `${out}/runtime`, NUXT_DB_HOST: "127.0.0.1", NUXT_DB_PORT: "1", NUXT_DB_USER: "fixture", NUXT_DB_PASSWORD: randomBytes(20).toString("hex"), NUXT_DB_NAME: "passport_browser_test", NUXT_ANNUAL_SHARE_SECRET: randomBytes(32).toString("hex"), NUXT_ANNUAL_RENDER_SECRET: randomBytes(32).toString("hex") },
    stdio: ["ignore", log.fd, log.fd]
  });
  for (let index = 0; index < 75; index++) {
    if (server.exitCode !== null) throw new Error("Local Viewer exited");
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    if (index === 74) throw new Error("Viewer readiness timeout");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  for (const locale of ["zh", "ja"]) for (const width of [390, 1440]) for (const dark of [false, true]) for (const scenario of scenarios) {
    const row = { locale, viewport: width === 390 ? "390x844" : "1440x900", theme: dark ? "dark" : "light", scenario, result: "FAIL" };
    results.push(row);
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, serviceWorkers: "block" });
    try {
      const page = await context.newPage();
      const errors = [], hydration = [];
      page.on("pageerror", error => errors.push(error.message.slice(0, 180)));
      page.on("console", message => { if (/hydration/i.test(message.text())) hydration.push(message.text().slice(0, 180)); });
      await page.addInitScript(value => localStorage.setItem("taiko_theme", value ? "dark" : "light"), dark);
      await page.route("**/api/account/auth/me", route => route.fulfill({ json: { authenticated: true, user: { id: 990072, username: "Passport Player", emailVerified: true } } }));
      await page.route("**/api/account/growth/passport*", route => route.fulfill({ json: buildPayload(scenario) }));
      await page.goto(`${base}${locale === "ja" ? "/ja/about" : "/about"}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => {
        window.__NUXT__.state["$saccount-user"] = { id: 990072, username: "Passport Player", email: "passport@example.test", emailVerified: true, avatarUrl: "", createdAt: "2026-09-01T00:00:00.000Z", annualSummaryAccess: false };
        window.__NUXT__.state["$saccount-user-loaded"] = true;
      });
      const myPath = locale === "ja" ? "/ja/my" : "/my";
      const passportPath = locale === "ja" ? "/ja/my/growth" : "/my/growth";
      await page.locator(`a[href="${myPath}"]`).first().evaluate(element => element.click());
      const link = page.locator(`.my-links a[href="${passportPath}"]`);
      await link.waitFor({ timeout: 30000 });
      await link.click();
      const root = page.locator(".passport-page");
      await root.waitFor({ timeout: 30000 });
      await root.locator(".passport-hero").waitFor({ timeout: 30000 });
      const text = await root.innerText();
      assert.equal(await root.locator(".passport-hero h1").count(), 1);
      assert.equal(await root.locator(".passport-metric").count(), 0);
      assert.equal(await root.locator(".passport-dimensions button").count(), 7);
      assert.equal(await root.locator(".passport-chart__segment path").count() <= buildPayload(scenario).segments.length, true);
      assert.equal(await root.locator(".passport-hero .panel-card").count(), 0);
      assert.equal(await page.locator("body").evaluate((element, expected) => element.classList.contains("theme-dark") === expected, dark), true);
      const headingColor = await root.locator(".passport-hero h1").evaluate(element => getComputedStyle(element).color);
      assert.equal(headingColor, dark ? "rgb(242, 231, 220)" : "rgb(58, 50, 44)");
      assert.ok(!/[a-f0-9]{48,}/i.test(text));
      assert.ok(!/passport\.|difficulty\.\d/.test(text));
      assert.ok(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (!['new', 'limited'].includes(scenario)) {
        const speedButton = root.locator('.passport-dimensions button').nth(3);
        await speedButton.click();
        assert.equal(await speedButton.getAttribute('aria-pressed'), 'true');
        const chartPoint = root.locator('.passport-chart circle').last();
        await chartPoint.focus();
        await chartPoint.press('Enter');
        assert.ok(await root.locator('.passport-chart-detail').isVisible());
      }
      if (scenario === "model-break") assert.match(text, locale === "zh" ? /记录方式更新过/ : /記録方法が変わり/);
      if (scenario === "limited") assert.match(text, locale === "zh" ? /成绩记录还不多/ : /まだ記録が少ない/);
      if (scenario === "new") assert.match(text, locale === "zh" ? /记录还在积累/ : /記録はまだ増えて/);
      if (scenario === "active-goal") assert.match(text, /Current Practice/);
      if (scenario === "recent-goal") assert.match(text, /Finished Practice/);
      if (scenario === "profile-switch") assert.equal(buildPayload(scenario).profileId, "2");
      assert.match(text, /Next Passport Song/);
      const pictures = root.locator("picture");
      for (let index = 0; index < await pictures.count(); index += 1) await pictures.nth(index).scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll(".passport-page img")].every(image => image.getAttribute("src") && image.complete), null, { timeout: 10000 });
      const brokenImages = await root.locator("img").evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src));
      assert.deepEqual(brokenImages, []);
      assert.deepEqual(errors, []);
      assert.deepEqual(hydration, []);
      if (scenario === "rich") await root.screenshot({ path: `${out}/${locale}-${width}-${dark ? "dark" : "light"}-rich.png` });
      row.result = "PASS";
    } catch (error) {
      row.error = String(error?.message || error).slice(0, 500);
      throw error;
    } finally { await context.close(); }
  }
} finally {
  clearTimeout(deadline);
  try { await writeFile(`${out}/browser-matrix.json`, JSON.stringify(results, null, 2)); }
  finally {
    try { if (browser) await browser.close(); }
    finally {
      if (server && server.exitCode === null) { const exited = once(server, "exit"); const killer = setTimeout(() => server.kill("SIGKILL"), 8000); server.kill("SIGTERM"); await exited; clearTimeout(killer); }
      await log.close();
    }
  }
}
console.log(JSON.stringify({ passed: results.filter(row => row.result === "PASS").length, total: results.length, out }));
