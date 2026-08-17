#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import mysql from "mysql2/promise";
import { chromium } from "playwright-core";

const parseEnvironmentFile = async (path) => {
  const values = {};
  for (const rawLine of (await readFile(path, "utf8")).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator);
    const raw = line.slice(separator + 1).trim();
    try { values[key] = raw.startsWith('"') ? JSON.parse(raw) : raw; }
    catch { values[key] = raw.replace(/^"|"$/g, ""); }
  }
  return values;
};

const environment = {
  ...(await parseEnvironmentFile(process.env.TAIKO_VIEWER_ENV_FILE || "/etc/taiko-viewer.env")),
  ...process.env
};
const userdataDir = String(environment.TAIKO_USERDATA_DIR || "/home/sigaer/taiko/userdata");
const repoRoot = String(environment.TAIKO_REPO_ROOT || "/home/sigaer/taiko");
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const reportProgress = (message) => process.stderr.write(`[annual-e2e] ${message}\n`);
const reservePort = () => new Promise((resolvePort, rejectPort) => {
  const server = createServer();
  server.once("error", rejectPort);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    server.close((error) => error ? rejectPort(error) : resolvePort(port));
  });
});

let e2eServer = null;
let e2eServerOutput = "";
let baseUrl = String(environment.ANNUAL_E2E_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  e2eServer = spawn(process.execPath, [resolve(".output/server/index.mjs")], {
    cwd: process.cwd(),
    env: {
      ...environment,
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
      PORT: String(port),
      NITRO_PORT: String(port),
      TAIKO_REPO_ROOT: repoRoot,
      TAIKO_USERDATA_DIR: userdataDir,
      TAIKO_ANNUAL_INTERNAL_BASE_URL: baseUrl,
      NUXT_ANNUAL_INTERNAL_BASE_URL: baseUrl,
      TAIKO_ANNUAL_E2E_MODE: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const capture = (chunk) => {
    e2eServerOutput = `${e2eServerOutput}${String(chunk)}`.slice(-8000);
  };
  e2eServer.stdout.on("data", capture);
  e2eServer.stderr.on("data", capture);
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    if (e2eServer.exitCode !== null) break;
    ready = await fetch(`${baseUrl}/api/account/auth/me`, { redirect: "manual" })
      .then((response) => response.status > 0)
      .catch(() => false);
    if (!ready) await wait(200);
  }
  assert.ok(ready, `annual E2E server did not start:\n${e2eServerOutput}`);
}
const nonce = randomBytes(7).toString("hex");
const implementationCopyPattern = /尚未全良|无不可且良数|读取当前最佳记录|最佳记[录錄]选项画像|站内样本中的参考位置|信赖? Wahlap|可信 Wahlap|固定优先级选择|現在のベスト記録|ベスト記録オプション|サイト内サンプルでの参考位置|信頼できる Wahlap|stage_delta|option_flg|record_updated_at|observed_at|highscore_datetime|MetricStatus|current_archive|version_observed|batch_last_play_proxy|source_highscore_time|schema\s*v?4|快照|排序规则|スナップショット/;

const db = await mysql.createConnection({
  host: environment.TAIKO_DB_HOST,
  port: Number(environment.TAIKO_DB_PORT || 3306),
  user: environment.TAIKO_DB_USER,
  password: environment.TAIKO_DB_PASSWORD,
  database: environment.TAIKO_DB_NAME || "taiko"
});

const request = async (path, options = {}) => {
  const headers = { accept: "application/json", ...(options.headers || {}) };
  if (options.cookie) headers.cookie = `stv_session=${options.cookie}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual"
  });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  if (options.expected !== undefined) assert.equal(response.status, options.expected, `${options.method || "GET"} ${path}`);
  else assert.ok(response.ok, `${options.method || "GET"} ${path} returned ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return { status: response.status, body, headers: response.headers };
};

const pollJob = async (path, cookie, initialJob, timeoutMs) => {
  let job = initialJob;
  const deadline = Date.now() + timeoutMs;
  while (!["completed", "failed"].includes(job.status) && Date.now() < deadline) {
    await wait(1000);
    const result = await request(`${path}/${encodeURIComponent(job.id)}`, { cookie });
    job = result.body.job;
    if (job.status === "completed") return result.body;
  }
  assert.equal(job.status, "completed", `job failed or timed out: ${job.error?.code || job.status}`);
};

const assertPublicSummary = (summary) => {
  const forbidden = new Set(["taikoid", "summaryid", "userid", "bindingid", "sourceaccount", "sourceref", "snapshotref", "snapshotpath", "warnings", "internalwarnings", "inputfingerprint"]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbidden.has(key.replace(/[_-]/g, "").toLowerCase()), false, `public DTO leaked ${key}`);
      visit(child);
    }
  };
  visit(summary);
  const rank = summary.sections?.ratingRank;
  if (rank && rank.status !== "unavailable") assert.deepEqual(Object.keys(rank.data || {}), ["tier"]);
};

const readPngTextMetadata = (png) => {
  const textChunks = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) break;
    const data = png.subarray(dataStart, dataEnd);
    try {
      if (type === "tEXt" || type === "eXIf") {
        textChunks.push(data.toString(type === "tEXt" ? "utf8" : "latin1"));
      } else if (type === "zTXt") {
        const keywordEnd = data.indexOf(0);
        if (keywordEnd >= 0 && keywordEnd + 2 <= data.length) {
          textChunks.push(data.subarray(0, keywordEnd).toString("latin1"));
          textChunks.push(inflateSync(data.subarray(keywordEnd + 2)).toString("utf8"));
        }
      } else if (type === "iTXt") {
        const keywordEnd = data.indexOf(0);
        if (keywordEnd >= 0 && keywordEnd + 3 <= data.length) {
          const compressed = data[keywordEnd + 1] === 1;
          let cursor = keywordEnd + 3;
          const languageEnd = data.indexOf(0, cursor);
          cursor = languageEnd < 0 ? data.length : languageEnd + 1;
          const translatedEnd = data.indexOf(0, cursor);
          cursor = translatedEnd < 0 ? data.length : translatedEnd + 1;
          const content = data.subarray(cursor);
          textChunks.push(data.subarray(0, keywordEnd).toString("latin1"));
          textChunks.push((compressed ? inflateSync(content) : content).toString("utf8"));
        }
      }
    } catch {
      textChunks.push(`[unreadable ${type} metadata]`);
    }
    offset = dataEnd + 4;
  }
  return textChunks.join("\n");
};

const assertPngHasNoPrivateIdentifiers = (png, values) => {
  const metadata = readPngTextMetadata(png);
  for (const value of values) {
    const normalized = String(value || "");
    if (normalized) assert.equal(metadata.includes(normalized), false, `PNG text metadata contains a private identifier (${normalized.length} chars)`);
  }
};

const openAnnualPage = async (page, path, timeout = 60_000) => {
  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout
  });
  assert.ok(response, `navigation returned no response: ${path}`);
  assert.ok(response.ok(), `navigation failed (${response.status()}): ${path}`);
  await page.waitForFunction(
    () => Boolean(document.querySelector("#__nuxt")?.__vue_app__),
    undefined,
    { timeout: 30_000 }
  );
};

const waitForStoryPlayerReady = async (page) => {
  await page.locator(".story-player__viewport").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    () => document.activeElement?.classList.contains("story-player__viewport"),
    undefined,
    { timeout: 30_000 }
  );
};

const auditStory = async (browser, cookie, viewport, locale, screenshotPath) => {
  reportProgress(`story ${locale} ${viewport.width}x${viewport.height}: start`);
  const context = await browser.newContext({
    viewport,
    locale: locale === "ja" ? "ja-JP" : "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce"
  });
  await context.addCookies([{ name: "stv_session", value: cookie, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await openAnnualPage(page, `${locale === "ja" ? "/ja" : ""}/account/version-summary`, 90_000);
  const entry = page.locator(".annual-entry__drum");
  if (await entry.count()) await entry.click();
  await waitForStoryPlayerReady(page);
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  const opening = page.locator(".annual-opening");
  await opening.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".annual-cover-flow__card").length > 0,
    undefined,
    { timeout: 15_000 }
  );
  assert.equal(await page.locator(".story-player__drawer-trigger, .story-player__sound-trigger, .story-player__nav").count(), 0);
  assert.ok(await page.locator(".annual-cover-flow__card:visible").count() >= 1);
  assert.ok(await page.locator(".annual-fireworks path").count() >= 20);
  assert.ok(await page.locator(".annual-beat-lane__track i").count() >= 4);
  if (viewport.width === 390 && viewport.height === 844) {
    await page.screenshot({ path: `/tmp/annual-e2e-${locale}-opening.png`, fullPage: false });
  }
  await page.locator(".annual-opening__start").click();
  await page.locator(".story-player__sound-trigger").waitFor({ state: "visible", timeout: 10_000 });
  const slideCount = await page.locator(".story-player__slide").count();
  assert.ok(slideCount >= 4 && slideCount <= 23, `unexpected slide count: ${slideCount}`);
  const sound = page.locator(".story-player__sound-trigger");
  assert.equal(await sound.getAttribute("aria-pressed"), "true");
  await sound.click();
  assert.equal(await sound.getAttribute("aria-pressed"), "false");
  await sound.click();
  assert.equal(await sound.getAttribute("aria-pressed"), "true");

  const storyIssues = [];
  for (let index = 0; index < slideCount; index += 1) {
    await page.locator(".story-player__viewport").evaluate((node, target) => {
      node.scrollTop = node.clientHeight * target;
      node.dispatchEvent(new Event("scroll"));
    }, index);
    await page.waitForFunction((target) => {
      const slide = document.querySelectorAll(".story-player__slide")[target];
      if (!slide?.querySelector(".story-slide-shell, .annual-opening, .period-overview-scene")) return false;
      return Math.abs(slide.getBoundingClientRect().top) <= 1;
    }, index, { timeout: 5_000 });
    await wait(80);
    const audit = await page.evaluate((target) => {
      const viewportNode = document.querySelector(".story-player__viewport");
      const slideNode = document.querySelectorAll(".story-player__slide")[target];
      const slideRect = slideNode?.getBoundingClientRect();
      const finalDrumRect = slideNode?.querySelector(".final-title-slide .drum-window")?.getBoundingClientRect();
      const finalBodyRect = slideNode?.querySelector(".final-title-slide__body")?.getBoundingClientRect();
      const visibleText = [...(slideNode?.querySelectorAll(".story-slide-shell p, .story-slide-shell small, .story-slide-shell span, .story-slide-shell b, .story-slide-shell strong") || [])]
        .filter((node) => !node.closest(".annual-poster--compact") && node.textContent?.trim() && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            size: Number.parseFloat(getComputedStyle(node).fontSize),
            text: node.textContent.trim().slice(0, 80),
            rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
            clipped: Boolean(slideRect && (rect.top < slideRect.top - 1 || rect.bottom > slideRect.bottom + 1 || rect.left < slideRect.left - 1 || rect.right > slideRect.right + 1))
          };
        });
      return {
        pageKey: slideNode?.getAttribute("data-page-key") || "unknown",
        slideRect: slideRect ? { top: slideRect.top, right: slideRect.right, bottom: slideRect.bottom, left: slideRect.left } : null,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        storyOverflow: viewportNode ? viewportNode.scrollWidth - viewportNode.clientWidth : 999,
        finalLayoutOverlap: Boolean(finalDrumRect && finalBodyRect && finalDrumRect.right > finalBodyRect.left + 1 && finalDrumRect.left < finalBodyRect.right - 1 && finalDrumRect.bottom > finalBodyRect.top + 1 && finalDrumRect.top < finalBodyRect.bottom - 1),
        tooSmall: visibleText.filter((item) => item.size < 10 || (item.tag === "P" && item.size < 12)),
        clippedText: visibleText.filter((item) => item.clipped),
        visibleCopy: visibleText.map((item) => item.text).join(" "),
        brokenImages: [...(slideNode?.querySelectorAll("img") || [])]
          .filter((image) => image.complete && image.naturalWidth === 0 && getComputedStyle(image).display !== "none" && image.getBoundingClientRect().width > 0)
          .map((image) => image.alt || image.getAttribute("src") || "unlabelled")
      };
    }, index);
    const hasImplementationCopy = implementationCopyPattern.test(audit.visibleCopy);
    const hasPlaceholder = /\{[A-Za-z][^}]*\}/.test(audit.visibleCopy);
    if (viewport.width === 390 && viewport.height === 844 && ["opening", "final", "poster"].includes(audit.pageKey)) {
      await page.screenshot({ path: `/tmp/annual-e2e-${locale}-${audit.pageKey}.png`, fullPage: false });
    }
    if (audit.pageOverflow > 1 || audit.storyOverflow > 1 || audit.finalLayoutOverlap || audit.tooSmall.length || audit.clippedText.length || audit.brokenImages.length || hasImplementationCopy || hasPlaceholder) {
      storyIssues.push({
        index,
        pageKey: audit.pageKey,
        slideRect: audit.slideRect,
        pageOverflow: audit.pageOverflow,
        storyOverflow: audit.storyOverflow,
        finalLayoutOverlap: audit.finalLayoutOverlap,
        tooSmall: audit.tooSmall.slice(0, 12),
        clippedText: audit.clippedText.slice(0, 12),
        brokenImages: audit.brokenImages,
        hasImplementationCopy,
        hasPlaceholder
      });
    }
  }

  if (storyIssues.length) await page.screenshot({ path: screenshotPath.replace(/\.png$/, "-issues.png"), fullPage: false });
  assert.deepEqual(storyIssues, [], `story audit failed at ${viewport.width}x${viewport.height} ${locale}`);

  await page.locator(".story-player__viewport").evaluate((node) => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); });
  await page.locator(".story-player__viewport").focus();
  await page.keyboard.press("Space");
  await wait(700);
  const keyboardIndex = await page.locator(".story-player__viewport").evaluate((node) => Math.round(node.scrollTop / node.clientHeight));
  assert.equal(keyboardIndex, 1, "Space advanced more than one page");
  await page.locator(".story-player__viewport").evaluate((node) => { node.scrollTop = node.clientHeight * 3; node.dispatchEvent(new Event("scroll")); });
  await wait(80);
  await page.screenshot({ path: screenshotPath });
  await context.close();
  reportProgress(`story ${locale} ${viewport.width}x${viewport.height}: passed`);
  return slideCount;
};

const auditOpeningMotion = async (browser, cookie) => {
  reportProgress("opening motion: start");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference"
  });
  await context.addCookies([{ name: "stv_session", value: cookie, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  reportProgress("opening motion: navigating");
  await openAnnualPage(page, "/account/version-summary", 90_000);
  reportProgress("opening motion: hydrated");
  const entry = page.locator(".annual-entry__drum");
  if (await entry.count()) await entry.click({ force: true });
  reportProgress("opening motion: entry opened");
  await page.locator(".annual-opening").waitFor({ state: "visible", timeout: 30_000 });
  reportProgress("opening motion: opening visible");
  await page.waitForFunction(
    () => [".annual-opening__drum-face", ".annual-beat-lane__don img"].every((selector) => {
      const image = document.querySelector(selector);
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 256;
    }),
    undefined,
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator(".annual-cover-flow__card .annual-artwork-fallback:visible").count(),
    0,
    "opening cover flow rendered placeholders after its preload gate"
  );
  const beatLaneAudit = await page.evaluate(() => {
    const track = document.querySelector(".annual-beat-lane__track");
    const viewport = document.querySelector(".annual-beat-lane__viewport");
    const sequences = [...document.querySelectorAll(".annual-beat-lane__sequence")];
    if (!(track instanceof HTMLElement) || !(viewport instanceof HTMLElement) || sequences.length !== 2) return null;
    const encode = (sequence) => [...sequence.children].map((beat) => {
      if (beat.querySelector(".is-don")) return "1";
      if (beat.querySelector(".is-ka")) return "2";
      return "0";
    }).join("");
    const animation = track.getAnimations()[0];
    if (!animation?.effect) return null;
    const duration = Number(animation.effect.getComputedTiming().duration);
    animation.pause();
    const visibleNotes = (sequence) => {
      const viewportRect = viewport.getBoundingClientRect();
      return [...sequence.querySelectorAll("i")]
        .map((note) => {
          const rect = note.getBoundingClientRect();
          return {
            kind: note.className,
            x: Math.round((rect.left - viewportRect.left) * 10) / 10
          };
        })
        .filter((note) => note.x >= 5 && note.x <= viewportRect.width - 5);
    };
    animation.currentTime = 0;
    const atStart = visibleNotes(sequences[0]);
    animation.currentTime = duration - 0.1;
    const atBoundary = visibleNotes(sequences[1]);
    animation.currentTime = 0;
    animation.play();
    return {
      patterns: sequences.map(encode),
      sequenceWidths: sequences.map((sequence) => sequence.getBoundingClientRect().width),
      trackWidth: track.scrollWidth,
      duration,
      atStart,
      atBoundary
    };
  });
  const expectedBeatPattern = "1110111011102220".repeat(3);
  assert.ok(beatLaneAudit, "opening beat lane is incomplete");
  assert.deepEqual(beatLaneAudit.patterns, [expectedBeatPattern, expectedBeatPattern], "opening beat lane does not match song 303 Oni measures 14–16");
  assert.equal(beatLaneAudit.sequenceWidths[0], beatLaneAudit.sequenceWidths[1]);
  assert.equal(beatLaneAudit.trackWidth, beatLaneAudit.sequenceWidths[0] * 2);
  assert.deepEqual(beatLaneAudit.atBoundary, beatLaneAudit.atStart, "opening beat lane jumps at the loop boundary");
  const coverTrack = page.locator(".annual-cover-flow__track");
  const coverAnimation = await coverTrack.evaluate((track) => {
    const animation = track.getAnimations()[0];
    const timing = animation?.effect?.getTiming();
    return {
      easing: timing?.easing,
      iterations: timing?.iterations,
      transform: getComputedStyle(track).transform
    };
  });
  await wait(600);
  const coverTransformAfter = await coverTrack.evaluate((track) => getComputedStyle(track).transform);
  assert.equal(coverAnimation.easing, "linear", "opening cover flow is not linear");
  assert.equal(coverAnimation.iterations, Infinity, "opening cover flow does not loop continuously");
  assert.notEqual(coverTransformAfter, coverAnimation.transform, "opening cover flow did not move continuously");
  reportProgress("opening motion: continuous cover flow advanced");
  const animationStates = await page.locator(".annual-fireworks path, .annual-beat-lane__track").evaluateAll(
    (nodes) => nodes.map((node) => getComputedStyle(node).animationName)
  );
  assert.ok(animationStates.some((name) => name && name !== "none"), "opening motion effects are not active");

  await page.locator(".annual-opening__start").evaluate((button) => {
    button.click();
    button.click();
    button.click();
  });
  await page.waitForFunction(() => document.querySelector(".annual-opening__start")?.hasAttribute("disabled"), undefined, { timeout: 1_000 });
  await page.locator(".story-player__sound-trigger").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector(".story-player__slide[data-page-key='profile']")?.getBoundingClientRect().top === 0,
    undefined,
    { timeout: 10_000 }
  );
  const openingPauseAudit = await page.locator(".story-player__slide[data-page-key='opening']").evaluate((slide) => ({
    hidden: slide.getAttribute("aria-hidden"),
    inert: slide.inert,
    fireworkState: getComputedStyle(slide.querySelector(".annual-fireworks path")).animationPlayState,
    beatState: getComputedStyle(slide.querySelector(".annual-beat-lane__track")).animationPlayState
  }));
  assert.equal(openingPauseAudit.hidden, "true");
  assert.equal(openingPauseAudit.inert, true);
  assert.equal(openingPauseAudit.fireworkState, "paused", "offscreen opening fireworks kept running");
  assert.equal(openingPauseAudit.beatState, "paused", "offscreen opening beat lane kept running");
  const periodIndex = await page.locator(".story-player__slide").evaluateAll((slides) =>
    slides.findIndex((slide) => slide.getAttribute("data-page-key") === "period")
  );
  assert.ok(periodIndex >= 0, "period page is missing from motion audit");
  await page.locator(".story-player__viewport").evaluate((node, target) => {
    node.scrollTop = node.clientHeight * target;
    node.dispatchEvent(new Event("scroll"));
  }, periodIndex);
  await page.waitForFunction(
    () => document.querySelector(".period-overview-scene.is-active .vertical-cover-stream__slot")?.getAnimations().length,
    undefined,
    { timeout: 10_000 }
  );
  const periodStream = page.locator(".story-player__slide[data-page-key='period'] .period-overview-scene.is-active .period-overview-scene__cover-planes .vertical-cover-stream");
  const periodMotion = await periodStream.evaluate((stream) => {
    const lowerSlot = stream.querySelector(".is-lower .vertical-cover-stream__slot");
    const upperSlot = stream.querySelector(".is-upper .vertical-cover-stream__slot");
    const lowerAnimation = lowerSlot?.getAnimations()[0];
    const upperAnimation = upperSlot?.getAnimations()[0];
    const lowerTiming = lowerAnimation?.effect?.getTiming();
    const upperTiming = upperAnimation?.effect?.getTiming();
    const inspectZone = (selector) => {
      const visibleSlots = [...stream.querySelectorAll(`${selector} .vertical-cover-stream__slot`)]
        .filter((slot) => Number(getComputedStyle(slot).opacity) > .02);
      const rects = visibleSlots.map((slot) => slot.getBoundingClientRect());
      const overlaps = rects.some((left, index) => rects.slice(index + 1).some((right) =>
        left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
      ));
      const transform = visibleSlots[0] ? getComputedStyle(visibleSlots[0]).transform : "none";
      return { count: rects.length, overlaps, pitch: new DOMMatrix(transform).m23 };
    };
    const upper = inspectZone(".is-upper");
    const lower = inspectZone(".is-lower");
    return {
      lowerEasing: lowerTiming?.easing,
      upperEasing: upperTiming?.easing,
      lowerIterations: lowerTiming?.iterations,
      upperIterations: upperTiming?.iterations,
      lowerTransform: lowerSlot ? getComputedStyle(lowerSlot).transform : "",
      upperTransform: upperSlot ? getComputedStyle(upperSlot).transform : "",
      visibleUpperCovers: upper.count,
      visibleLowerCovers: lower.count,
      upperPitch: upper.pitch,
      lowerPitch: lower.pitch,
      upperOverlaps: upper.overlaps,
      lowerOverlaps: lower.overlaps,
      visibleUpperKeys: [...stream.querySelectorAll(".is-upper .vertical-cover-stream__slot")]
        .filter((slot) => Number(getComputedStyle(slot).opacity) > .02)
        .map((slot) => slot.getAttribute("data-flow-key"))
        .filter(Boolean),
      visibleLowerKeys: [...stream.querySelectorAll(".is-lower .vertical-cover-stream__slot")]
        .filter((slot) => Number(getComputedStyle(slot).opacity) > .02)
        .map((slot) => slot.getAttribute("data-flow-key"))
        .filter(Boolean)
    };
  });
  await wait(600);
  const periodMotionAfter = await periodStream.evaluate((stream) => ({
    lowerTransform: getComputedStyle(stream.querySelector(".is-lower .vertical-cover-stream__slot")).transform,
    upperTransform: getComputedStyle(stream.querySelector(".is-upper .vertical-cover-stream__slot")).transform
  }));
  assert.equal(periodMotion.lowerEasing, "linear", "lower period cover stream is not linear");
  assert.equal(periodMotion.upperEasing, "linear", "upper period cover stream is not linear");
  assert.equal(periodMotion.lowerIterations, Infinity, "lower period cover stream does not loop continuously");
  assert.equal(periodMotion.upperIterations, Infinity, "upper period cover stream does not loop continuously");
  assert.equal(periodMotion.visibleUpperCovers, 3, `period upper stream does not match the 0.46.11 cover count: ${periodMotion.visibleUpperCovers}`);
  assert.equal(periodMotion.visibleLowerCovers, 3, `period lower stream does not match the 0.46.11 cover count: ${periodMotion.visibleLowerCovers}`);
  assert.ok(periodMotion.upperPitch < -.3, `period upper covers lost their inward perspective: ${periodMotion.upperPitch}`);
  assert.ok(periodMotion.lowerPitch > .3, `period lower covers lost their inward perspective: ${periodMotion.lowerPitch}`);
  assert.ok(periodMotion.visibleUpperCovers <= 4, `period upper stream shows too many covers: ${periodMotion.visibleUpperCovers}`);
  assert.ok(periodMotion.visibleLowerCovers <= 4, `period lower stream shows too many covers: ${periodMotion.visibleLowerCovers}`);
  assert.equal(periodMotion.upperOverlaps, false, "period upper covers overlap each other");
  assert.equal(periodMotion.lowerOverlaps, false, "period lower covers overlap each other");
  assert.deepEqual(
    periodMotion.visibleUpperKeys.filter((key) => periodMotion.visibleLowerKeys.includes(key)),
    [],
    "period upper and lower streams show the same cover"
  );
  assert.notEqual(periodMotionAfter.lowerTransform, periodMotion.lowerTransform, "lower covers did not move toward the text boundary");
  assert.notEqual(periodMotionAfter.upperTransform, periodMotion.upperTransform, "upper covers did not move away from the text boundary");
  const failedCover = periodStream.locator(".vertical-cover-stream__slot img").first();
  if (await failedCover.count()) {
    await failedCover.evaluate((image) => image.dispatchEvent(new Event("error")));
    await page.waitForFunction(() => Boolean(document.querySelector(".story-player__slide[data-page-key='period'] .vertical-cover-stream__fallback")));
  }
  const overviewIndex = await page.locator(".story-player__slide").evaluateAll((slides) =>
    slides.findIndex((slide) => slide.getAttribute("data-page-key") === "overview")
  );
  assert.equal(overviewIndex, periodIndex + 1, "overview no longer follows period directly");
  await page.locator(".story-player__viewport").focus();
  await page.keyboard.press("PageDown");
  await page.waitForFunction(() => {
    const scene = document.querySelector(".story-player__transition-overlay .period-overview-scene");
    const time = Number(scene?.getAttribute("data-transition-time"));
    return time > 0 && time < 1600;
  }, undefined, { timeout: 2_000 });
  const coversAtTransitionLock = await periodStream.evaluate((stream) => [...stream.querySelectorAll(".vertical-cover-stream__slot")]
    .filter((slot) => Number(getComputedStyle(slot).opacity) > .02)
    .map((slot) => ({ key: slot.getAttribute("data-flow-key") || "fallback", transform: getComputedStyle(slot).transform }))
  );
  const transitionStream = page.locator(".story-player__transition-overlay .vertical-cover-stream");
  const inspectTransitionPlanes = (stream) => {
    const upperTransform = getComputedStyle(stream.querySelector(".is-upper .vertical-cover-stream__plane")).transform;
    const lowerTransform = getComputedStyle(stream.querySelector(".is-lower .vertical-cover-stream__plane")).transform;
    const inspectFace = (transform) => {
      const matrix = new DOMMatrix(transform);
      return {
        transform,
        rotationZ: Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI,
        scaleX: Math.hypot(matrix.m11, matrix.m12),
        xAxisTilt: Math.max(Math.abs(matrix.m23), Math.abs(matrix.m32))
      };
    };
    return {
      covers: [...stream.querySelectorAll(".vertical-cover-stream__slot")]
        .filter((slot) => Number(getComputedStyle(slot).opacity) > .02)
        .map((slot) => ({ key: slot.getAttribute("data-flow-key") || "fallback", transform: getComputedStyle(slot).transform })),
      upperFace: inspectFace(upperTransform),
      lowerFace: inspectFace(lowerTransform)
    };
  };
  const transitionPlaneAudit = await transitionStream.evaluate(inspectTransitionPlanes);
  assert.deepEqual(transitionPlaneAudit.covers, coversAtTransitionLock, "period transition replaced or moved the visible cover planes");
  assert.ok(Math.abs(transitionPlaneAudit.upperFace.scaleX - 1) < .001, "transition rescaled the upper cover face");
  assert.ok(Math.abs(transitionPlaneAudit.lowerFace.scaleX - 1) < .001, "transition rescaled the lower cover face");
  await wait(220);
  const transitionPlaneAuditAfter = await transitionStream.evaluate(inspectTransitionPlanes);
  assert.deepEqual(transitionPlaneAuditAfter.covers, coversAtTransitionLock, "outer cover geometry changed while the nested face rotated");
  assert.ok(transitionPlaneAuditAfter.upperFace.rotationZ > transitionPlaneAudit.upperFace.rotationZ, "upper nested cover face did not rotate within its plane");
  assert.ok(transitionPlaneAuditAfter.lowerFace.rotationZ > transitionPlaneAudit.lowerFace.rotationZ, "lower nested cover face did not rotate within its plane");
  assert.ok(transitionPlaneAuditAfter.upperFace.xAxisTilt < .001, "upper nested face still rotates around the X axis");
  assert.ok(transitionPlaneAuditAfter.lowerFace.xAxisTilt < .001, "lower nested face still rotates around the X axis");
  await page.waitForFunction(
    () => {
      const slide = document.querySelector(".story-player__slide[data-page-key='overview']");
      return Boolean(slide && Math.abs(slide.getBoundingClientRect().top) <= 1 && !document.querySelector(".story-player__transition-overlay"));
    },
    undefined,
    { timeout: 4_000 }
  );
  const overviewCopy = await page.locator(".story-player__slide[data-page-key='overview']").innerText();
  for (const forbidden of ["已经通关", "已经全连", "已经全良", "已经极"]) {
    assert.equal(overviewCopy.includes(forbidden), false, `overview still includes ${forbidden}`);
  }
  const overviewPlayCount = page.locator(".story-player__slide[data-page-key='overview'] [data-overview-play-count] .animated-number");
  assert.equal(await overviewPlayCount.innerText(), await overviewPlayCount.getAttribute("aria-label"), "overview play count did not reach its real value");
  await page.keyboard.press("PageUp");
  await page.waitForFunction(
    () => {
      const slide = document.querySelector(".story-player__slide[data-page-key='period']");
      return Boolean(slide && Math.abs(slide.getBoundingClientRect().top) <= 1 && !document.querySelector(".story-player__transition-overlay"));
    },
    undefined,
    { timeout: 4_000 }
  );
  await page.screenshot({ path: "/tmp/annual-e2e-period-motion.png", fullPage: false });
  const finalIndex = await page.locator(".story-player__slide").evaluateAll((slides) =>
    slides.findIndex((slide) => slide.getAttribute("data-page-key") === "final")
  );
  const posterIndex = await page.locator(".story-player__slide").evaluateAll((slides) =>
    slides.findIndex((slide) => slide.getAttribute("data-page-key") === "poster")
  );
  assert.equal(posterIndex, finalIndex + 1, "poster no longer follows the final title directly");
  await page.locator(".story-player__viewport").evaluate((node, target) => {
    node.scrollTop = node.clientHeight * target;
    node.dispatchEvent(new Event("scroll"));
  }, finalIndex);
  await page.waitForFunction(() => document.querySelector(".story-player__slide[data-page-key='final']")?.getAttribute("aria-hidden") === "false");
  const finalTitleCharacters = page.locator(".story-player__slide[data-page-key='final'] [data-annual-character-title] .final-title-slide__char");
  assert.ok(await finalTitleCharacters.count() > 1, "final title is not split into grapheme-level reveal nodes");
  await page.waitForFunction(() => Boolean(document.querySelector(".story-player__slide[data-page-key='final'] .final-title-slide__poster-cta")));
  const finalNumbers = page.locator(".story-player__slide[data-page-key='final'] .final-title-slide__metrics .animated-number");
  for (let index = 0; index < await finalNumbers.count(); index += 1) {
    const number = finalNumbers.nth(index);
    assert.equal(await number.innerText(), await number.getAttribute("aria-label"), `final metric ${index} did not reach its real value`);
  }
  const visibleParticles = await page.locator(".story-player__slide[data-page-key='final'] .particle-layer i").evaluateAll((nodes) =>
    nodes.filter((node) => getComputedStyle(node).display !== "none").length
  );
  assert.ok(visibleParticles <= 12, "mobile particle cap exceeded 12");
  const shareMutations = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/shares|\/posters/.test(request.url())) shareMutations.push(request.url());
  });
  await page.locator(".final-title-slide__poster-cta").click();
  await page.waitForFunction(() => document.querySelector(".story-player__slide[data-page-key='poster']")?.getAttribute("aria-hidden") === "false");
  assert.deepEqual(shareMutations, [], "final CTA duplicated share or poster creation logic");
  reportProgress("period motion: full-height cover stream advanced");
  reportProgress("opening motion: closing");
  await context.close();
  reportProgress("opening motion: passed");
};

const auditSaveData = async (browser, cookie) => {
  reportProgress("save-data motion fallback: start");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference"
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
  });
  await context.addCookies([{ name: "stv_session", value: cookie, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await openAnnualPage(page, "/account/version-summary", 90_000);
  const entry = page.locator(".annual-entry__drum");
  if (await entry.count()) await entry.click();
  await waitForStoryPlayerReady(page);
  await page.locator(".annual-opening").waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.locator(".annual-opening").evaluate((node) => node.classList.contains("is-reduced")), true);
  assert.equal(await page.locator(".story-player").getAttribute("data-save-data"), "true", "save-data state was not propagated by StoryPlayer");
  assert.equal(await page.locator(".annual-opening").getAttribute("data-motion-state"), "reduced", "save-data mode did not enter the stable scene state");
  assert.equal(await page.locator(".annual-opening .particle-layer i").count(), 0, "save-data mode still rendered particles");
  await context.close();
  reportProgress("save-data motion fallback: passed");
};

const auditTransitionFrames = async (browser, cookie) => {
  reportProgress("period transition frames: start");
  const context = await browser.newContext({
    viewport: { width: 720, height: 1568 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference"
  });
  await context.addCookies([{ name: "stv_session", value: cookie, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  for (const time of [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600]) {
    await openAnnualPage(page, `/account/version-summary?transitionTime=${time}`, 90_000);
    await page.locator(`.story-player__transition-overlay .period-overview-scene[data-transition-time="${time}"]`).waitFor({ state: "visible", timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolveImage) => {
            image.addEventListener("load", resolveImage, { once: true });
            image.addEventListener("error", resolveImage, { once: true });
          })));
    });
    if (time === 0 || time === 1600) {
      const faceTransforms = await page.locator(".story-player__transition-overlay .vertical-cover-stream").evaluate((stream) =>
        [...stream.querySelectorAll(".vertical-cover-stream__plane")].map((plane) => {
          const matrix = new DOMMatrix(getComputedStyle(plane).transform);
          return {
            rotationZ: Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI,
            scaleX: Math.hypot(matrix.m11, matrix.m12),
            xAxisTilt: Math.max(Math.abs(matrix.m23), Math.abs(matrix.m32))
          };
        })
      );
      const expectedRotation = time === 0 ? 0 : 45;
      assert.ok(faceTransforms.length > 0, `transition ${time}ms has no cover faces`);
      for (const face of faceTransforms) {
        assert.ok(Math.abs(face.rotationZ - expectedRotation) < .05, `transition ${time}ms cover rotation is ${face.rotationZ}, expected ${expectedRotation}`);
        assert.ok(Math.abs(face.scaleX - 1) < .001, `transition ${time}ms rescaled a cover face`);
        assert.ok(face.xAxisTilt < .001, `transition ${time}ms tilted a nested face around the X axis`);
      }
      if (time === 1600) {
        const playCount = page.locator(".story-player__transition-overlay [data-overview-play-count] .animated-number");
        assert.equal(await playCount.innerText(), await playCount.getAttribute("aria-label"), "frozen overview frame did not reach the final play count");
      }
    }
    await page.screenshot({ path: `/tmp/annual-transition-${String(time).padStart(4, "0")}.png`, fullPage: false });
  }
  await context.close();
  reportProgress("period transition frames: passed");
};

const auditAudioLifecycle = async (browser, cookie) => {
  reportProgress("annual audio lifecycle: start");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce"
  });
  await context.addCookies([{ name: "stv_session", value: cookie, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript(() => {
    const eventKey = "annual-audio-events";
    const record = (event) => {
      let events = [];
      try { events = JSON.parse(localStorage.getItem(eventKey) || "[]"); }
      catch { events = []; }
      events.push({ ...event, at: performance.timeOrigin + performance.now() });
      localStorage.setItem(eventKey, JSON.stringify(events));
    };
    let blockedBgmAttempts = 1;
    let documentHidden = false;
    let audioInstance = 0;
    class AnnualAudioMock extends EventTarget {
      constructor(src = "") {
        super();
        this.instance = ++audioInstance;
        this.src = src;
        this.currentTime = 0;
        this.preload = "";
        this.loop = false;
        this.volume = 1;
        this.paused = true;
        record({ type: "create", src: this.src, instance: this.instance, path: location.pathname });
      }

      play() {
        const isBgm = this.src.includes("natsumatsuri-303-old.ogg");
        const blocked = isBgm && blockedBgmAttempts > 0;
        if (blocked) blockedBgmAttempts -= 1;
        record({ type: "play", src: this.src, blocked, instance: this.instance, path: location.pathname });
        if (blocked) return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
        this.paused = false;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
        record({ type: "pause", src: this.src, instance: this.instance });
      }

      load() { record({ type: "load", src: this.src }); }
      removeAttribute(name) { if (name === "src") this.src = ""; }
    }
    Object.defineProperty(window, "Audio", { configurable: true, writable: true, value: AnnualAudioMock });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => documentHidden });
    window.__setAnnualDocumentHidden = (value) => {
      documentHidden = Boolean(value);
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.__setAnnualBlockedBgmAttempts = (value) => { blockedBgmAttempts = Math.max(0, Number(value) || 0); };
  });

  const page = await context.newPage();
  await openAnnualPage(page, "/titles");
  await page.evaluate(() => localStorage.setItem("annual-audio-events", "[]"));
  await openAnnualPage(page, "/account/version-summary", 90_000);
  const entry = page.locator(".annual-entry__drum");
  if (await entry.count()) await entry.click();
  await waitForStoryPlayerReady(page);
  const bgmEvents = () => page.evaluate(() => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.filter((event) => String(event.src || "").includes("natsumatsuri-303-old.ogg"));
  });
  await page.waitForFunction(() => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.some((event) => event.type === "play" && event.blocked === true && String(event.src).includes("natsumatsuri-303-old.ogg"));
  });
  const initialEvents = await bgmEvents();
  assert.equal(initialEvents.filter((event) => event.type === "play").length, 1, "BGM was not attempted exactly once when the opening page loaded");

  await page.locator(".annual-opening__start").click();
  await page.locator(".story-player__sound-trigger").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.some((event) => event.type === "play" && event.blocked === false && String(event.src).includes("natsumatsuri-303-old.ogg"));
  });
  const startedEvents = await bgmEvents();
  assert.equal(startedEvents.filter((event) => event.type === "play" && !event.blocked).length, 1, "opening gesture issued duplicate BGM play requests");

  const sound = page.locator(".story-player__sound-trigger");
  const pauseCountBeforeMute = (await bgmEvents()).filter((event) => event.type === "pause").length;
  await sound.click();
  await page.waitForFunction((before) => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.filter((event) => event.type === "pause" && String(event.src).includes("natsumatsuri-303-old.ogg")).length > before;
  }, pauseCountBeforeMute);
  await sound.click();

  const pauseCountBeforeHidden = (await bgmEvents()).filter((event) => event.type === "pause").length;
  await page.evaluate(() => window.__setAnnualDocumentHidden(true));
  await page.waitForFunction(() => document.querySelector(".story-player")?.getAttribute("data-document-visible") === "false");
  await page.waitForFunction((before) => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.filter((event) => event.type === "pause" && String(event.src).includes("natsumatsuri-303-old.ogg")).length > before;
  }, pauseCountBeforeHidden);
  const playCountBeforeVisible = (await bgmEvents()).filter((event) => event.type === "play" && !event.blocked).length;
  await page.evaluate(() => window.__setAnnualDocumentHidden(false));
  await page.waitForFunction(() => document.querySelector(".story-player")?.getAttribute("data-document-visible") === "true");
  await page.waitForFunction((before) => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.filter((event) => event.type === "play" && !event.blocked && String(event.src).includes("natsumatsuri-303-old.ogg")).length > before;
  }, playCountBeforeVisible);

  const createCountBeforePageRestore = (await bgmEvents()).filter((event) => event.type === "create").length;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await page.waitForFunction((before) => {
    const events = JSON.parse(localStorage.getItem("annual-audio-events") || "[]");
    return events.filter((event) => event.type === "create" && String(event.src).includes("natsumatsuri-303-old.ogg")).length === before + 1;
  }, createCountBeforePageRestore);
  const restoredEvents = await bgmEvents();
  assert.equal(new Set(restoredEvents.filter((event) => event.type === "create").map((event) => event.instance)).size, createCountBeforePageRestore + 1, "page restore reused or overlapped a stale BGM instance");

  const pauseCountBeforeExit = (await bgmEvents()).filter((event) => event.type === "pause").length;
  await page.locator(".story-player__drawer-trigger").click();
  await page.locator(".story-drawer__actions button").click();
  await page.waitForURL(/\/account\/profile(?:\?|$)/, { timeout: 15_000 });
  const exitEvents = await bgmEvents();
  const allExitEvents = await page.evaluate(() => JSON.parse(localStorage.getItem("annual-audio-events") || "[]"));
  assert.ok(exitEvents.filter((event) => event.type === "pause").length > pauseCountBeforeExit, "BGM did not pause on route exit");
  assert.ok(allExitEvents.some((event) => event.type === "load"), "BGM resource was not released on route exit");

  const createCountBeforeNavigationEntry = exitEvents.filter((event) => event.type === "create").length;
  const playCountBeforeNavigationEntry = exitEvents.filter((event) => event.type === "play").length;
  await page.evaluate(() => window.__setAnnualBlockedBgmAttempts(0));
  await page.locator(".el-overlay.is-drawer").waitFor({ state: "hidden", timeout: 10_000 });
  await page.locator(".mobile-nav-toggle").click();
  const annualNav = page.locator('[data-nav-key="/account/version-summary"]');
  await annualNav.waitFor({ state: "visible", timeout: 10_000 });
  await annualNav.click();
  await page.waitForURL(/\/account\/version-summary(?:\?|$)/, { timeout: 15_000 });
  await page.locator(".annual-opening").waitFor({ state: "visible", timeout: 30_000 });
  const navigationEntryEvents = await bgmEvents();
  assert.equal(
    navigationEntryEvents.filter((event) => event.type === "create").length,
    createCountBeforeNavigationEntry + 1,
    `navigation entry did not reuse one primed BGM instance: ${JSON.stringify(navigationEntryEvents)}`
  );
  assert.equal(
    navigationEntryEvents.filter((event) => event.type === "play").length,
    playCountBeforeNavigationEntry + 1,
    `navigation entry did not issue one primed BGM play: ${JSON.stringify(navigationEntryEvents)}`
  );
  const newNavigationPlays = navigationEntryEvents.filter((event) => event.type === "play").slice(playCountBeforeNavigationEntry);
  assert.equal(newNavigationPlays.length, 1, "navigation entry started more than one BGM playback");
  assert.equal(newNavigationPlays[0].path, "/account/profile", "BGM did not start inside the navigation gesture before the annual route mounted");
  await page.locator(".annual-opening__start").click();
  await page.locator(".story-player__sound-trigger").waitFor({ state: "visible", timeout: 10_000 });
  assert.equal((await bgmEvents()).filter((event) => event.type === "play").length, playCountBeforeNavigationEntry + 1, "opening start duplicated the primed BGM playback");
  await context.close();
  reportProgress("annual audio lifecycle: passed");
};

let firstUserId = null;
let secondUserId = null;
let thirdUserId = null;
let summaryId = "";
let shareId = "";
let publicToken = "";
const summaryDirs = new Set();

try {
  const [staleFixtureResult] = await db.execute(
    "DELETE FROM web_user_accounts WHERE password_hash = 'annual-e2e' AND LEFT(username, 11) = 'annual_e2e_'"
  );
  if (staleFixtureResult.affectedRows) reportProgress(`removed ${staleFixtureResult.affectedRows} stale fixture accounts`);
  await request("/api/account/auth/me", { expected: 200 });
  const [boundRows] = await db.query("SELECT taiko_id FROM web_taiko_bindings");
  const bound = new Set(boundRows.map((row) => String(row.taiko_id)));
  const names = (await readdir(userdataDir)).filter((name) => name.endsWith("data.json") && !name.startsWith("data_"));
  let candidate = "";
  let archiveCandidate = "";
  for (const name of names.sort()) {
    const taikoId = name.slice(0, -"data.json".length);
    if (!taikoId || taikoId.length > 25 || bound.has(taikoId)) continue;
    const history = await readdir(resolve(userdataDir, taikoId)).catch(() => []);
    const historyCount = history.filter((item) => item.startsWith("data_") && item.endsWith(".json")).length;
    if (historyCount >= 2 && !candidate) candidate = taikoId;
    if (historyCount === 0 && !archiveCandidate) {
      const payload = await readFile(resolve(userdataDir, name), "utf8").then(JSON.parse).catch(() => null);
      const meta = payload?._meta && typeof payload._meta === "object" ? payload._meta : {};
      const isCredibleFull = meta.full === true || (
        meta.full !== false && payload?.profile && payload?.achievement && Array.isArray(payload?.songs)
      );
      if (isCredibleFull) archiveCandidate = taikoId;
    }
    if (candidate && archiveCandidate) break;
  }
  assert.ok(candidate, "no unbound comparable annual fixture is available");
  assert.ok(archiveCandidate, "no unbound current-archive annual fixture is available");

  const [firstResult] = await db.execute(
    "INSERT INTO web_user_accounts (username, email, password_hash, email_verified) VALUES (?, ?, ?, 1)",
    [`annual_e2e_${nonce}`, `annual-e2e-${nonce}@invalid.local`, "annual-e2e"]
  );
  firstUserId = Number(firstResult.insertId);
  const firstSession = randomBytes(32).toString("hex");
  await db.execute("INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", [firstSession, firstUserId, new Date(Date.now() + 60 * 60 * 1000)]);
  await db.execute("INSERT INTO web_taiko_bindings (user_id, taiko_id, is_current, verified_title) VALUES (?, ?, 1, ?)", [firstUserId, candidate, "Annual E2E"]);

  const [secondResult] = await db.execute(
    "INSERT INTO web_user_accounts (username, email, password_hash, email_verified) VALUES (?, ?, ?, 1)",
    [`annual_e2e_other_${nonce}`, `annual-e2e-other-${nonce}@invalid.local`, "annual-e2e"]
  );
  secondUserId = Number(secondResult.insertId);
  const secondSession = randomBytes(32).toString("hex");
  await db.execute("INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", [secondSession, secondUserId, new Date(Date.now() + 60 * 60 * 1000)]);

  const [thirdResult] = await db.execute(
    "INSERT INTO web_user_accounts (username, email, password_hash, email_verified) VALUES (?, ?, ?, 1)",
    [`annual_e2e_archive_${nonce}`, `annual-e2e-archive-${nonce}@invalid.local`, "annual-e2e"]
  );
  thirdUserId = Number(thirdResult.insertId);
  const thirdSession = randomBytes(32).toString("hex");
  await db.execute("INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", [thirdSession, thirdUserId, new Date(Date.now() + 60 * 60 * 1000)]);
  await db.execute("INSERT INTO web_taiko_bindings (user_id, taiko_id, is_current, verified_title) VALUES (?, ?, 1, ?)", [thirdUserId, archiveCandidate, "Annual E2E Archive"]);

  await request("/api/account/annual-summaries/annual_2026", { expected: 401 });
  await request("/api/account/annual-summaries/annual_2026", { cookie: firstSession });
  const queued = await request("/api/account/annual-summaries/annual_2026/build", { method: "POST", cookie: firstSession, body: { locale: "zh" } });
  const buildResult = queued.body.job.status === "completed"
    ? queued.body
    : await pollJob("/api/account/annual-summary-jobs", firstSession, queued.body.job, 8 * 60 * 1000);
  const privateSummary = buildResult.summary || (await request("/api/account/annual-summaries/annual_2026", { cookie: firstSession })).body.summary;
  assert.equal(privateSummary.schemaVersion, 4);
  assert.ok(["version_observed", "current_archive"].includes(privateSummary.mode));
  summaryId = String(privateSummary.summaryId);
  assert.match(summaryId, /^annual_[0-9a-f]{24}$/);
  const [summaryRows] = await db.execute("SELECT summary_path FROM web_annual_summaries WHERE id = ? AND user_id = ?", [summaryId, firstUserId]);
  for (const row of summaryRows) summaryDirs.add(dirname(String(row.summary_path)));
  await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}`, { cookie: secondSession, expected: 404 });
  await request(`/api/admin/annual-summaries/${encodeURIComponent(summaryId)}/events`, { expected: 401 });

  await request("/api/account/annual-summaries/annual_2026", { cookie: thirdSession });
  const archiveQueued = await request("/api/account/annual-summaries/annual_2026/build", { method: "POST", cookie: thirdSession, body: { locale: "zh" } });
  const archiveBuildResult = archiveQueued.body.job.status === "completed"
    ? archiveQueued.body
    : await pollJob("/api/account/annual-summary-jobs", thirdSession, archiveQueued.body.job, 8 * 60 * 1000);
  const archiveSummary = archiveBuildResult.summary || (await request("/api/account/annual-summaries/annual_2026", { cookie: thirdSession })).body.summary;
  assert.equal(archiveSummary.mode, "current_archive");
  for (const key of ["obsessionSong", "favoriteShift", "monthlyFavorites", "weekdayActivity", "calendarActivity", "timeOfDay", "lateNight"]) {
    assert.equal(archiveSummary.sections?.[key]?.status, "unavailable", `archive exposed timed section: ${key}`);
  }
  const [archiveRows] = await db.execute("SELECT summary_path FROM web_annual_summaries WHERE id = ? AND user_id = ?", [archiveSummary.summaryId, thirdUserId]);
  for (const row of archiveRows) summaryDirs.add(dirname(String(row.summary_path)));

  const shared = await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}/shares`, { method: "POST", cookie: firstSession, body: { locale: "zh" } });
  shareId = String(shared.body.share.id);
  const shareUrl = new URL(shared.body.share.url, baseUrl);
  publicToken = decodeURIComponent(shareUrl.pathname.split("/").at(-1));
  const publicPayload = await request(`/api/annual/shares/${encodeURIComponent(publicToken)}?locale=ja`);
  assertPublicSummary(publicPayload.body.summary);
  const renewed = await request(`/api/account/annual-shares/${encodeURIComponent(shareId)}`, { method: "PATCH", cookie: firstSession });
  assert.ok(new Date(renewed.body.share.expiresAt).getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000);

  const posterQueued = await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}/posters`, { method: "POST", cookie: firstSession, body: { shareId, locale: "zh" } });
  const posterResult = posterQueued.body.job.status === "completed"
    ? posterQueued.body
    : await pollJob("/api/account/annual-poster-jobs", firstSession, posterQueued.body.job, 2 * 60 * 1000);
  assert.ok(posterResult.poster?.url);
  const ownerPng = await request(posterResult.poster.url, { cookie: firstSession });
  assert.equal(Buffer.isBuffer(ownerPng.body), true);
  assert.equal(ownerPng.body.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(ownerPng.body.readUInt32BE(16), 1080);
  assert.equal(ownerPng.body.readUInt32BE(20), 1440);
  assertPngHasNoPrivateIdentifiers(ownerPng.body, [candidate, firstUserId, summaryId]);
  const publicPng = await request(`/api/annual/shares/${encodeURIComponent(publicToken)}/poster?locale=zh`);
  assert.equal(publicPng.body.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}/posters`, {
    method: "POST",
    cookie: firstSession,
    body: { shareId, locale: "ja" },
    expected: 429
  });
  await db.execute(
    "UPDATE web_annual_summary_jobs SET created_at = DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE user_id = ? AND job_type = 'poster'",
    [firstUserId]
  );
  const jaPosterQueued = await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}/posters`, {
    method: "POST",
    cookie: firstSession,
    body: { shareId, locale: "ja" }
  });
  const jaPosterResult = jaPosterQueued.body.job.status === "completed"
    ? jaPosterQueued.body
    : await pollJob("/api/account/annual-poster-jobs", firstSession, jaPosterQueued.body.job, 2 * 60 * 1000);
  const jaOwnerPng = await request(jaPosterResult.poster.url, { cookie: firstSession });
  assert.equal(jaOwnerPng.body.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(jaOwnerPng.body.readUInt32BE(16), 1080);
  assert.equal(jaOwnerPng.body.readUInt32BE(20), 1440);
  assertPngHasNoPrivateIdentifiers(jaOwnerPng.body, [candidate, firstUserId, summaryId]);
  const jaPublicPng = await request(`/api/annual/shares/${encodeURIComponent(publicToken)}/poster?locale=ja`);
  assert.equal(jaPublicPng.body.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");

  reportProgress("browser matrix: launching");
  const browser = await chromium.launch({
    executablePath: environment.TAIKO_ANNUAL_CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
    timeout: 30_000
  });
  reportProgress("browser matrix: launched");
  try {
    await auditAudioLifecycle(browser, firstSession);
    await auditSaveData(browser, firstSession);
    await auditOpeningMotion(browser, firstSession);
    if (environment.ANNUAL_E2E_TRANSITION_DEBUG === "1") await auditTransitionFrames(browser, firstSession);
    const viewports = [
      { width: 320, height: 568 }, { width: 360, height: 800 }, { width: 375, height: 812 },
      { width: 390, height: 844 }, { width: 844, height: 390 }
    ];
    for (const viewport of viewports) {
      await auditStory(browser, firstSession, viewport, "zh", `/tmp/annual-e2e-${viewport.width}x${viewport.height}.png`);
    }
    await auditStory(browser, firstSession, { width: 390, height: 844 }, "ja", "/tmp/annual-e2e-ja.png");
    const archiveContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN", timezoneId: "Asia/Shanghai", reducedMotion: "reduce" });
    await archiveContext.addCookies([{ name: "stv_session", value: thirdSession, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
    const archivePage = await archiveContext.newPage();
    await openAnnualPage(archivePage, "/account/version-summary");
    await waitForStoryPlayerReady(archivePage);
    await archivePage.locator(".annual-opening__start").click();
    const archivePageKeys = await archivePage.locator(".story-player__slide").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-page-key")));
    for (const key of ["obsession", "favoriteShift", "monthly", "weekday", "calendar", "timeOfDay", "lateNight"]) {
      assert.equal(archivePageKeys.includes(key), false, `archive story exposed timed page: ${key}`);
    }
    const archivePeriodIndex = archivePageKeys.indexOf("period");
    assert.ok(archivePeriodIndex >= 0, "archive story is missing the period page");
    await archivePage.locator(".story-player__viewport").evaluate((node, target) => {
      node.scrollTop = node.clientHeight * target;
      node.dispatchEvent(new Event("scroll"));
    }, archivePeriodIndex);
    await archivePage.waitForFunction((target) => Boolean(document.querySelectorAll(".story-player__slide")[target]?.querySelector(".period-overview-scene")), archivePeriodIndex);
    const archivePeriodLines = (await archivePage.locator(".story-player__slide").nth(archivePeriodIndex).innerText()).split(/\n/).map((line) => line.trim());
    assert.equal(archivePeriodLines.includes("-"), false, "archive period page exposed a raw missing-time placeholder");
    await archivePage.screenshot({ path: "/tmp/annual-e2e-archive-period.png" });
    await archivePage.locator(".story-player__viewport").evaluate((node) => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); });
    await wait(80);
    await archivePage.screenshot({ path: "/tmp/annual-e2e-archive.png" });
    await archiveContext.close();

    const emptyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
    await emptyContext.addCookies([{ name: "stv_session", value: secondSession, url: baseUrl, httpOnly: true, sameSite: "Lax" }]);
    const emptyPage = await emptyContext.newPage();
    await openAnnualPage(emptyPage, "/account/version-summary");
    await emptyPage.locator(".annual-state").waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await emptyPage.locator(".story-player").count(), 0);
    assert.ok(await emptyPage.locator('a[href*="/account/sync"], button').count());
    await emptyPage.screenshot({ path: "/tmp/annual-e2e-empty.png" });
    await emptyContext.close();

    const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
    const publicPage = await publicContext.newPage();
    await openAnnualPage(publicPage, `/annual/share/${encodeURIComponent(publicToken)}`);
    assert.ok((await publicPage.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"));
    await wait(120);
    const publicBrokenImages = await publicPage.locator("img").evaluateAll((images) => images
      .filter((image) => image.complete && image.naturalWidth === 0 && getComputedStyle(image).display !== "none" && image.getBoundingClientRect().width > 0)
      .map((image) => image.alt || image.getAttribute("src") || "unlabelled"));
    assert.deepEqual(publicBrokenImages, [], "public annual page contains a broken image");
    await publicPage.screenshot({ path: "/tmp/annual-e2e-public.png" });
    await publicContext.close();
  } finally {
    await browser.close();
  }

  await request(`/api/account/annual-shares/${encodeURIComponent(shareId)}`, { method: "DELETE", cookie: firstSession });
  await request(`/api/annual/shares/${encodeURIComponent(publicToken)}`, { expected: 404 });
  await request(`/api/annual/shares/${encodeURIComponent(publicToken)}/poster`, { expected: 404 });

  const expiring = await request(`/api/account/annual-summaries/${encodeURIComponent(summaryId)}/shares`, { method: "POST", cookie: firstSession, body: { locale: "zh" } });
  const expiringId = String(expiring.body.share.id);
  const expiringToken = decodeURIComponent(new URL(expiring.body.share.url, baseUrl).pathname.split("/").at(-1));
  await db.execute("UPDATE web_annual_shares SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ? AND user_id = ?", [expiringId, firstUserId]);
  await request(`/api/annual/shares/${encodeURIComponent(expiringToken)}`, { expected: 404 });
  const [expiredRows] = await db.execute("SELECT status FROM web_annual_shares WHERE id = ?", [expiringId]);
  assert.equal(expiredRows[0]?.status, "expired");

  process.stdout.write(JSON.stringify({ ok: true, schemaVersion: 4, modes: ["version_observed", "current_archive", "empty"], poster: "1080x1440", posterLocales: ["zh", "ja"], posterRateLimit: true, viewports: 5, locales: ["zh", "ja"], adminAuth: true, idor: true, revoke: true, expiry: true }) + "\n");
} finally {
  if (firstUserId) {
    const [posterRows] = await db.execute("SELECT file_path FROM web_annual_posters WHERE user_id = ?", [firstUserId]).catch(() => [[]]);
    for (const row of posterRows) {
      const path = String(row.file_path || "");
      if (path.includes("annual-summary-v4")) await rm(path, { force: true }).catch(() => undefined);
    }
  }
  if (firstUserId) await db.execute("DELETE FROM web_user_accounts WHERE id = ?", [firstUserId]).catch(() => undefined);
  if (secondUserId) await db.execute("DELETE FROM web_user_accounts WHERE id = ?", [secondUserId]).catch(() => undefined);
  if (thirdUserId) await db.execute("DELETE FROM web_user_accounts WHERE id = ?", [thirdUserId]).catch(() => undefined);
  for (const path of summaryDirs) {
    if (path.includes("annual-summary-v4")) await rm(path, { recursive: true, force: true }).catch(() => undefined);
  }
  await db.end();
  if (e2eServer) {
    e2eServer.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => e2eServer.once("exit", resolveExit)),
      wait(5_000)
    ]);
    if (e2eServer.exitCode === null) e2eServer.kill("SIGKILL");
  }
}
