#!/usr/bin/env node
// Run under scripts/memory/run_qa.sh after a bounded local build.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, open, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const out = process.env.WEEKLY_BROWSER_ARTIFACTS || "/var/tmp/growth-weekly";
const base = "http://127.0.0.1:3196";
const scenarios = ["rich", "pb", "crown", "goal", "focus-change", "quiet", "no-play", "partial", "truncated", "limited", "balanced", "model-break"];
const results = [];
await mkdir(out, { recursive: true });
const log = await open(`${out}/server.log`, "w");
let server;
let browser;
const deadline = setTimeout(() => { console.error("Weekly browser deadline exceeded"); process.exit(124); }, 840000);

const dimensions = (accuracy = 9.1, rhythm = 10.2) => ({ big_song: 10.1, stamina: 10.3, speed: 9.8, accuracy_power: accuracy, rhythm, complex: 10 });
const point = (id, accuracy, focus, modelRevision = "m".repeat(64), availabilityState = "ready") => ({
  id, capturedAt: id === "start" ? "2026-09-14T01:00:00.000Z" : "2026-09-19T01:00:00.000Z",
  scoreRevision: id.padEnd(64, "a").slice(0, 64), measurementVersion: 1, algorithmVersion: "growth-v1", modelRevision,
  rating: id === "start" ? 10.1 : 10.24, dimensions: dimensions(accuracy, focus === "rhythm" ? 9 : 10.2), focus, sampleCount: 30, availabilityState
});
const highlight = (id, primaryType, songId, before, after, goalCompleted = false) => ({
  id, primaryType, factKeys: [`fact-${id}`], songId, difficultyType: 4, title: `Weekly Song ${songId}`, before, after,
  delta: before === null || after === null ? null : after - before, goalCompleted
});
const buildPayload = scenario => {
  const coverage = scenario === "partial" ? "partial" : scenario === "truncated" ? "truncated" : "complete";
  const start = point("start", 9.1, "accuracy_power");
  const endFocus = scenario === "focus-change" ? "rhythm" : scenario === "balanced" ? "balanced" : "accuracy_power";
  const end = point("end", 9.4, endFocus, scenario === "model-break" ? "n".repeat(64) : "m".repeat(64), scenario === "limited" ? "limited" : "ready");
  const reason = scenario === "model-break" ? "model-mismatch" : scenario === "limited" ? "limited" : "compatible";
  const compatible = reason === "compatible";
  const theme = {
    rich: "mixed-growth", pb: "score-breakthrough", crown: "new-crown", goal: "goal-follow-through", "focus-change": "focus-change",
    quiet: "quiet", "no-play": "no-play", partial: "limited-coverage", truncated: "limited-coverage", limited: "broad-activity",
    balanced: "balanced", "model-break": "score-breakthrough"
  }[scenario];
  const highlights = scenario === "no-play" || scenario === "quiet" || scenario === "partial" || scenario === "truncated" || scenario === "limited" || scenario === "balanced" ? []
    : scenario === "crown" ? [highlight("df", "df", 102, 1, 2)]
      : scenario === "goal" ? [highlight("goal", "ng-reduced", 103, 8, 4, true)]
        : scenario === "focus-change" ? []
          : [highlight("pb", "score-pb", 101, 900000, 907130), ...(scenario === "rich" ? [highlight("ng", "ng-reduced", 102, 8, 4), highlight("fc", "fc", 103, 0, 1, true)] : [])];
  return {
    profileId: "1", week: { from: "2026-09-14", to: "2026-09-19", timezone: "Asia/Shanghai", isCompleteWeek: false },
    coverage: { scoreHistoryFrom: coverage === "complete" ? "2026-09-13" : null, scoreHistoryTo: "2026-09-19", scoreHistoryState: coverage, measurementFrom: start.capturedAt, measurementTo: end.capturedAt, measurementState: "partial" },
    theme: { type: theme, evidenceFactKeys: highlights.flatMap(item => item.factKeys), evidenceMeasurementIds: compatible ? [start.id, end.id] : [], confidence: coverage === "complete" ? "high" : "low" },
    highlights,
    measurementChange: {
      start, end, compatible, reason, ratingDelta: compatible ? 0.14 : null,
      dimensionDeltas: compatible ? dimensions(0.3, -1.2) : null,
      primaryDimension: compatible ? { key: "accuracy_power", before: 9.1, after: 9.4, delta: 0.3 } : null,
      focusFrom: start.focus, focusTo: end.focus
    },
    totals: { distinctCharts: highlights.length, pb: highlights.filter(item => item.primaryType === "score-pb").length, fc: highlights.filter(item => item.primaryType === "fc").length, df: highlights.filter(item => item.primaryType === "df").length, rankUpgrade: 0, completedGoals: highlights.filter(item => item.goalCompleted).length },
    currentNextAction: { focus: "accuracy_power", todayPlan: { targetDimension: "accuracy_power", usedFallback: false, items: [{ songId: 101, difficultyType: 4, starLevel: 9, title: "Next Song", isUnplayed: false, targetDimension: "accuracy_power", reason: "target-dimension", currentBestScore: 880000, currentBestRank: 5 }] } }
  };
};

try {
  server = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS, TMPDIR: process.env.TMPDIR, HOST: "127.0.0.1", PORT: "3196", NUXT_REPO_ROOT: `${out}/runtime`, NUXT_DB_HOST: "127.0.0.1", NUXT_DB_PORT: "1", NUXT_DB_USER: "fixture", NUXT_DB_PASSWORD: randomBytes(20).toString("hex"), NUXT_DB_NAME: "weekly_browser_test", NUXT_ANNUAL_SHARE_SECRET: randomBytes(32).toString("hex"), NUXT_ANNUAL_RENDER_SECRET: randomBytes(32).toString("hex") },
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
      const errors = [];
      const hydration = [];
      page.on("pageerror", error => errors.push(error.message.slice(0, 180)));
      page.on("console", message => { if (/hydration/i.test(message.text())) hydration.push(message.text().slice(0, 180)); });
      await page.addInitScript(value => localStorage.setItem("taiko_theme", value ? "dark" : "light"), dark);
      await page.route("**/api/account/auth/me", route => route.fulfill({ json: { authenticated: true, user: { id: 990071, username: "Weekly Player", emailVerified: true } } }));
      await page.route("**/api/account/growth/weekly*", route => route.fulfill({ json: buildPayload(scenario) }));
      await page.goto(`${base}${locale === "ja" ? "/ja/about" : "/about"}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => {
        window.__NUXT__.state["$saccount-user"] = { id: 990071, username: "Weekly Player", email: "weekly@example.test", emailVerified: true, avatarUrl: "", createdAt: "2026-09-01T00:00:00.000Z", annualSummaryAccess: false };
        window.__NUXT__.state["$saccount-user-loaded"] = true;
      });
      const myPath = locale === "ja" ? "/ja/my" : "/my";
      const weeklyPath = locale === "ja" ? "/ja/my/weekly" : "/my/weekly";
      await page.locator(`a[href="${myPath}"]`).first().evaluate(element => element.click());
      const weeklyLink = page.locator(`.my-links a[href="${weeklyPath}"]`);
      await weeklyLink.waitFor({ timeout: 30000 });
      await weeklyLink.click();
      const root = page.locator(".weekly-page");
      await root.waitFor({ timeout: 30000 });
      try { await root.locator(".weekly-hero").waitFor({ timeout: 10000 }); }
      catch { throw new Error(`Weekly hero missing at ${page.url()}: ${(await root.innerText()).slice(0, 300)}`); }
      const text = await root.innerText();
      assert.equal(await root.locator(".weekly-hero h1").count(), 1);
      assert.ok(await root.locator(".weekly-highlight").count() <= 4);
      assert.equal(await root.locator(".weekly-metric").count(), 0);
      assert.equal(await page.locator("body").evaluate((element, expected) => element.classList.contains("theme-dark") === expected, dark), true);
      const headingColor = await root.locator(".weekly-hero h1").evaluate(element => getComputedStyle(element).color);
      assert.equal(headingColor, dark ? "rgb(242, 231, 220)" : "rgb(58, 50, 44)");
      assert.ok(!/weekly\.(?:theme|coverage|measurement|focus|next)|difficulty\.\d/.test(text));
      assert.ok(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await root.locator(".weekly-next").scrollIntoViewIfNeeded();
      const pictures = root.locator("picture");
      for (let index = 0; index < await pictures.count(); index += 1) await pictures.nth(index).scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll(".weekly-page img")].every(image => image.getAttribute("src") && image.complete), null, { timeout: 10000 });
      const brokenImages = await root.locator("img").evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src));
      assert.deepEqual(brokenImages, []);
      assert.match(text, /Next Song/);
      if (["partial", "truncated"].includes(scenario)) assert.match(text, locale === "zh" ? /只列出能确认的变化/ : /確認できた変化だけ/);
      if (scenario === "model-break") assert.match(text, locale === "zh" ? /模型发生更新/ : /測定モデルが更新/);
      if (scenario === "limited") assert.match(text, locale === "zh" ? /不足以形成稳定/ : /安定した傾向/);
      assert.deepEqual(errors, []);
      assert.deepEqual(hydration, []);
      if (scenario === "rich") await root.screenshot({ path: `${out}/${locale}-${width}-${dark ? "dark" : "light"}-rich.png` });
      row.result = "PASS";
    } catch (error) {
      row.error = String(error?.message || error).slice(0, 500);
      throw error;
    } finally {
      await context.close();
    }
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
