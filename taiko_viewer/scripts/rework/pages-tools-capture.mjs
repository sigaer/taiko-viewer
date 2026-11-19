// Slice F: the outputs of the four computing / lookup tools for a fixed set of inputs, read from the page.
// Run once on the unchanged code (variant "before") and once after the rework (variant "after"); the two JSON files
// must be equal (pages-scenarios.mjs compares them). Only the selectors that read the page differ per variant; the
// inputs, the APIs and the synthetic data (pages-data.mjs) are the same.
//   /tools/rt-calculator   real API over the synthetic files; the computation is the page's (utils/rtCalculator.ts)
//   /tools/tja-constants   client-side file checks real; the server's calculator needs Linux systemd-run + Python, so
//                          its real answer here is the "unavailable" failure; the result view uses an intercepted
//                          response (TJA_FIXTURE); the chart image is drawn in the browser for real (tja-tools)
//   /tools/chart-config, /tools/note-count   real API over the synthetic files
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CHART_CONFIG_QUERIES, NOTE_COUNT_QUERIES } from "./pages-data.mjs";

export const TJA_FIXTURE = {
  title: "Synthetic Capture",
  encoding: "utf-8",
  model: "v2-synthetic",
  calibrationSha256: "0".repeat(64),
  charts: [
    { course: "oni", branch: "master", totalNotes: 1234, constants: { sub_constant_1: 9.876, main_constant: 10.4049, sub_constant_2: 11.005, stamina: 8.125, handspeed: 9.995, burst: 10.5, complex: 7.333, rhythm: 6.0049 }, raw: { density: 12.345678, peak: 20.1, roll_ratio: 0.12345 } },
    { course: "oni", branch: "normal", totalNotes: 1001, constants: { sub_constant_1: 8.1, main_constant: 8.75, sub_constant_2: 9.2, stamina: 7, handspeed: 8.004, burst: 8.996, complex: 6.5, rhythm: 5.25 } },
    { course: "oni", branch: "expert", totalNotes: 1100, error: "calculation_failed" },
    { course: "hard", branch: "unbranched", totalNotes: 640, constants: { sub_constant_1: 5.4, main_constant: 6.15, sub_constant_2: 6.9, stamina: 5, handspeed: 6.25, burst: 6.125, complex: 4.4, rhythm: 4.04 } },
    { course: "edit_p1", branch: "unbranched", totalNotes: 1500, constants: { sub_constant_1: 10.9, main_constant: 11.45, sub_constant_2: 12.1, stamina: 10, handspeed: 11.115, burst: 11.95, complex: 9.9, rhythm: 8.8 } }
  ]
};
export const TJA_TEXT =
  "TITLE:Synthetic Capture\nBPM:150\nWAVE:capture.ogg\nOFFSET:0\nCOURSE:Oni\nLEVEL:9\n#START\n1010101010101010,\n2020102010201020,\n1111222211112222,\n#END\n" +
  "COURSE:Hard\nLEVEL:6\n#START\n1000100010001000,\n1020102010201020,\n#END\n";

const SEL = {
  before: {
    chartInput: ".el-input input",
    chartLines: "pre.result-box",
    chartError: ".el-alert__title",
    noteInput: ".el-input-number input",
    noteSummary: ".result-box > p",
    noteItems: async (page) => page.$$eval(".result-box li", (els) => els.map((el) => el.textContent.replace(/\s+/g, " ").trim())),
    noteEmpty: ".el-alert__title",
    tjaMeta: ".drop-zone p"
  },
  after: {
    chartInput: "#viewer-main input[type=search]",
    chartLines: ".rtl-pre",
    chartError: "#viewer-main .rw-alert",
    noteInput: "#viewer-main input[type=number]",
    noteSummary: "#viewer-main .rw-count",
    noteItems: async (page) => page.$$eval(".rtc li", (els) => els.map((el) => [...el.children].map((c) => c.textContent.trim()).join(" "))),
    noteEmpty: "#viewer-main .rw-state__title",
    tjaMeta: ".drop-zone__meta"
  }
};

const hydrated = (page) => page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__));
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const settle = (page, ms = 250) => page.waitForTimeout(ms);

async function rtRead(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const v = (id) => q(id)?.value ?? null;
    return {
      rating: q(".rt-output .rating strong")?.textContent.trim() ?? null,
      accuracy: q(".rt-output .accuracy strong")?.textContent.trim() ?? null,
      dimensions: [...document.querySelectorAll(".rt-output .dimensions dd")].map((el) => el.textContent.trim()),
      dimensionNames: [...document.querySelectorAll(".rt-output .dimensions dt")].map((el) => el.textContent.trim()),
      inputs: { good: v("#rt-good"), ok: v("#rt-ok"), bad: v("#rt-bad") },
      readonly: ["good", "ok", "bad"].filter((k) => q(`#rt-${k}`)?.readOnly),
      invalid: Boolean(q("#rt-validation")),
      notes: (q(".chart-heading strong")?.textContent || "").trim() || null,
      levels: [...document.querySelectorAll(".selection-row select")].map((s) => [...s.options].map((o) => o.value).join(","))
    };
  });
}

async function rtCases(page, base, prefix, songId, payload) {
  const out = [];
  const combos = [];
  for (const chart of payload.v2) combos.push({ version: "v2", level: { hard: 3, oni: 4, edit: 5 }[chart.difficulty], total: chart.totalNotes });
  for (const chart of payload.v1) combos.push({ version: "v1", level: chart.level, total: chart.totalNotes });
  for (const combo of combos) {
    await page.goto(`${base}${prefix}/tools/rt-calculator?songId=${songId}&level=${combo.level}`, { waitUntil: "networkidle" });
    await hydrated(page);
    if (combo.version === "v1") await page.locator(".selection-row select").first().selectOption("v1");
    await page.locator(".selection-row select").nth(1).selectOption(String(combo.level));
    await page.locator("#rt-good").waitFor();
    const record = async (name) => {
      await settle(page, 120);
      out.push({ songId, ...combo, case: name, ...(await rtRead(page)) });
    };
    await record("initial");
    await page.getByRole("button", { name: /^(全良)$/ }).click();
    await record("full");
    await page.locator("#rt-ok").fill("10");
    await page.locator("#rt-bad").fill("2");
    await record("auto-good ok10 bad2");
    await page.locator(".judgment-toolbar select").selectOption("bad");
    await page.locator("#rt-good").fill(String(combo.total - 20));
    await record("auto-bad good-20 ok10");
    await page.locator(".judgment-toolbar select").selectOption("ok");
    await page.locator("#rt-good").fill(String(Math.floor(combo.total * 0.8)));
    await page.locator("#rt-bad").fill("3");
    await record("auto-ok good80% bad3");
    await page.locator(".judgment-toolbar select").selectOption("manual");
    await page.locator("#rt-bad").fill("99999");
    await record("manual invalid");
    await page.getByRole("button", { name: /^(全良)$/ }).click();
    await page.locator("#rt-good").fill("1.5");
    await record("manual decimal");
    await page.getByRole("button", { name: /^(全良)$/ }).click();
    await page.locator("#rt-good").fill("0");
    await page.locator("#rt-bad").fill(String(combo.total));
    await record("manual below 75%");
    out[out.length - 1].belowNotice = await page.getByText("精度低于 75%，不计入 Rating。", { exact: true }).count();
  }
  return out;
}

async function tjaCapture(page, base, variant) {
  const out = {};
  const sel = SEL[variant];
  await page.goto(`${base}/tools/tja-constants`, { waitUntil: "networkidle" });
  await hydrated(page);
  const input = page.locator('input[type="file"]');
  out.accept = await input.getAttribute("accept");
  const errorOf = async () => (await page.locator(".error-message").count()) ? text(page, ".error-message") : null;
  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  out.wrongType = await errorOf();
  await input.setInputFiles({ name: "empty.tja", mimeType: "text/plain", buffer: Buffer.alloc(0) });
  out.emptyFile = await errorOf();
  await input.setInputFiles({ name: "big.tja", mimeType: "text/plain", buffer: Buffer.alloc(512 * 1024 + 1, 49) });
  out.tooBig = await errorOf();
  out.twoFiles = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["a"], "a.tja"));
    dt.items.add(new File(["b"], "b.tja"));
    document.querySelector(".drop-zone").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    return true;
  });
  await settle(page);
  out.twoFiles = await errorOf();
  await input.setInputFiles({ name: "capture.tja", mimeType: "text/plain", buffer: Buffer.from(TJA_TEXT) });
  await settle(page);
  out.selected = { name: await text(page, ".drop-zone h2"), meta: await text(page, sel.tjaMeta), error: await errorOf() };
  // the real server: no systemd-run / Python on Windows → "unavailable"
  const realResponse = page.waitForResponse((r) => r.url().includes("/api/tools/tja-constants"));
  await page.locator(".upload-controls button").click();
  out.realStatus = (await realResponse).status();
  await page.locator(".error-message").waitFor();
  out.realError = await errorOf();
  // intercepted answers
  let answer = { status: 200, body: TJA_FIXTURE };
  await page.route("**/api/tools/tja-constants", (route) => route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) }));
  for (const [name, status, body] of [["rateLimit", 429, { statusCode: 429, statusMessage: "Too many" }], ["noteLimit", 422, { statusCode: 422, statusMessage: "TJA calculation failed", data: { code: "note_limit" } }]]) {
    answer = { status, body };
    await page.locator(".upload-controls button").click();
    await page.waitForFunction(() => !document.querySelector(".loading-state"));
    await settle(page);
    out[name] = await errorOf();
  }
  answer = { status: 200, body: TJA_FIXTURE };
  await page.locator(".upload-controls button").click();
  await page.locator(".result-panel .constant-summary, .result-panel .error-message").first().waitFor();
  const readResult = () =>
    page.evaluate(() => {
      const all = (s) => [...document.querySelectorAll(s)].map((el) => el.textContent.replace(/\s+/g, " ").trim());
      return {
        heading: document.querySelector(".result-header h2")?.textContent.trim(),
        headingFocused: document.activeElement === document.querySelector(".result-header h2"),
        courses: [...document.querySelectorAll(".course-switch button")].map((b) => `${b.textContent.trim()}${b.getAttribute("aria-pressed") === "true" ? " *" : ""}`),
        branches: [...document.querySelectorAll(".chart-meta select option")].map((o) => `${o.value}:${o.textContent.trim()}${o.selected ? " *" : ""}`),
        meta: document.querySelector(".chart-meta")?.textContent.replace(/\s+/g, " ").trim(),
        summary: all(".constant-summary dd"),
        summaryLabels: all(".constant-summary dt"),
        metrics: all(".metrics dd"),
        metricLabels: all(".metrics dt"),
        raw: all(".raw-metrics div").map((x) => x),
        chartError: document.querySelector(".result-panel .error-message")?.textContent.trim() || null,
        status: document.querySelector(".upload-panel .status")?.textContent.trim()
      };
    });
  out.result = [await readResult()];
  const courseCount = await page.locator(".course-switch button").count();
  for (let i = 0; i < courseCount; i++) {
    await page.locator(".course-switch button").nth(i).click();
    await settle(page, 100);
    const state = await readResult();
    out.result.push(state);
    const branchSelect = page.locator(".chart-meta select");
    if (await branchSelect.count()) {
      for (const value of await branchSelect.locator("option").evaluateAll((os) => os.map((o) => o.value))) {
        await branchSelect.selectOption(value);
        await settle(page, 100);
        out.result.push({ branch: value, ...(await readResult()) });
      }
    }
  }
  const downloadEvent = page.waitForEvent("download");
  await page.locator(".result-header button").click();
  const download = await downloadEvent;
  const saved = resolve(tmpdir(), `slice-f-download-${process.pid}.json`);
  await download.saveAs(saved);
  const content = await readFile(saved, "utf8");
  await rm(saved, { force: true });
  out.download = { name: download.suggestedFilename(), equalsResponse: content === JSON.stringify(TJA_FIXTURE, null, 2) };
  // the chart image, drawn in the browser
  const image = {};
  try {
    await page.locator(".image-tool select option").first().waitFor({ timeout: 20000 });
    image.options = await page.$$eval(".image-tool select option", (os) => os.map((o) => `${o.value}:${o.textContent.replace(/\s+/g, " ").trim()}${o.selected ? " *" : ""}`));
    await page.locator(".image-controls button").click();
    await page.locator(".image-size, .image-error").first().waitFor({ timeout: 30000 });
    image.size = await text(page, ".image-size");
    image.error = await text(page, ".image-error");
    image.download = await page.locator(".image-actions a[download]").getAttribute("download").catch(() => null);
  } catch (error) {
    image.unavailable = String(error.message || error).split("\n")[0].slice(0, 160);
  }
  out.image = image;
  await page.unroute("**/api/tools/tja-constants");
  return out;
}

async function chartConfigCapture(page, base, prefix, variant) {
  const sel = SEL[variant];
  const out = [];
  await page.goto(`${base}${prefix}/tools/chart-config`, { waitUntil: "networkidle" });
  await hydrated(page);
  for (const q of CHART_CONFIG_QUERIES) {
    await page.locator(sel.chartInput).fill(q);
    const response = page.waitForResponse((r) => r.url().includes("/api/tools/chart-config"));
    await page.locator('#viewer-main button[type="submit"]').click();
    const status = (await response).status();
    await page.waitForFunction(([a, b]) => document.querySelector(a) || document.querySelector(b), [sel.chartLines, sel.chartError], { timeout: 5000 }).catch(() => {});
    await settle(page, 200);
    const lines = (await page.locator(sel.chartLines).count()) ? await page.$eval(sel.chartLines, (el) => el.textContent.split("\n")) : null;
    out.push({ q, status, lines, error: (await page.locator(sel.chartError).count()) ? await text(page, sel.chartError) : null });
  }
  return out;
}

async function noteCountCapture(page, base, prefix, variant) {
  const sel = SEL[variant];
  await page.goto(`${base}${prefix}/tools/note-count`, { waitUntil: "networkidle" });
  await hydrated(page);
  const out = { initialEmpty: (await page.locator(sel.noteEmpty).count()) ? await text(page, sel.noteEmpty) : null, queries: [] };
  for (const n of NOTE_COUNT_QUERIES) {
    await page.locator(sel.noteInput).fill(String(n));
    const response = page.waitForResponse((r) => r.url().includes("/api/tools/note-count"));
    await page.locator('#viewer-main button[type="submit"]').click();
    const status = (await response).status();
    await settle(page, 200);
    out.queries.push({
      n,
      status,
      summary: (await page.locator(sel.noteSummary).count()) ? await text(page, sel.noteSummary) : null,
      items: await sel.noteItems(page),
      empty: (await page.locator(sel.noteEmpty).count()) ? await text(page, sel.noteEmpty) : null
    });
  }
  return out;
}

/** All captures; `variant` = "before" | "after". */
export async function captureTools({ browser, base, variant }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
  await context.route("**/*", (route) => (new URL(route.request().url()).origin === base ? route.continue() : route.abort()));
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#nuxt-devtools-container{display:none!important}";
      document.head.append(style);
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${new URL(page.url()).pathname}: ${String(e.message).slice(0, 200)}`));
  const out = { variant, rt: {}, errors };
  try {
    for (const songId of [1, 6, 9]) {
      const payload = await (await fetch(`${base}/api/tools/rt-calculator?songId=${songId}`)).json();
      out.rt[songId] = await rtCases(page, base, "", songId, payload);
    }
    out.rtJa = await rtCases(page, base, "/ja", 1, { v2: [(await (await fetch(`${base}/api/tools/rt-calculator?songId=1`)).json()).v2.find((c) => c.difficulty === "oni")], v1: [] });
    await page.goto(`${base}/tools/rt-calculator`, { waitUntil: "networkidle" });
    await hydrated(page);
    out.rtEmpty = { choose: await page.getByText("请选择歌曲", { exact: true }).count(), ...(await rtRead(page)) };
    out.tja = await tjaCapture(page, base, variant);
    out.chartConfig = { zh: await chartConfigCapture(page, base, "", variant), ja: await chartConfigCapture(page, base, "/ja", variant) };
    out.noteCount = { zh: await noteCountCapture(page, base, "", variant), ja: await noteCountCapture(page, base, "/ja", variant) };
  } finally {
    await context.close();
  }
  return out;
}

/** Differences between two captures (empty when equal). Known, intended differences are listed by the caller. */
export function diffCaptures(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => diffCaptures(a[k], b[k], `${path}.${k}`));
  }
  return [{ path, before: a, after: b }];
}
