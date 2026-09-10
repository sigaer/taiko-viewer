import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { resolve } from "node:path";

// The real normalizer is the unit under test: a replica of the calendar helper
// cannot catch a broken call site, which is how the acceptance failure happened.
register("./support/nuxtAliasHooks.mjs", import.meta.url);
const { normalizeAnnualSummary } = await import("../utils/annualSummary.ts");

const CACHE_ROOT = resolve(import.meta.dirname, "../.data/account-cache/annual-summary-v4/summaries");
const ACCEPTANCE_SUMMARY = resolve(
  CACHE_ROOT,
  "d6b5915c46057bcb005f46f6/annual_2026/annual_8357acbcad4494b16903122a/summary.json"
);

const shanghaiDay = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

const dayNumber = (key) =>
  Math.round(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000);

const expectedDays = (firstDay, todayKey = shanghaiDay()) => dayNumber(todayKey) - dayNumber(firstDay) + 1;

const loadSummary = async (path) => JSON.parse(await readFile(path, "utf8").catch(() => "null") ?? "null");

const normalize = (raw) => normalizeAnnualSummary(raw, "zh", (key) => key);

test("period days follow the proven first play day up to today in the season time zone", async () => {
  const raw = await loadSummary(ACCEPTANCE_SUMMARY);
  if (!raw) return;
  const vm = normalize(raw);
  assert.equal(vm.period.firstActualPlayDate, "2023-11-18", "the proven first play day is missing from the view model");
  assert.equal(
    vm.period.totalDays,
    expectedDays("2023-11-18"),
    "rendered days must equal firstActualPlayDate -> today in Asia/Shanghai"
  );
  // The season window is far shorter than the account's real history, so a
  // window-capped figure is proof that the anchor regressed to the window.
  const seasonSpan = dayNumber(raw.version.effectiveEndDate) - dayNumber(raw.version.startDate) + 1;
  assert.ok(vm.period.totalDays > seasonSpan, "period days is still capped by the season window");
});

test("period days ignore the window-scoped first record when the proven day exists", async () => {
  const raw = await loadSummary(ACCEPTANCE_SUMMARY);
  if (!raw) return;
  const windowFirstDay = raw.period.firstRecordAt.slice(0, 10);
  const vm = normalize(raw);
  assert.equal(vm.period.firstActualPlayDate, "2023-11-18");
  assert.notEqual(
    vm.period.totalDays,
    expectedDays(windowFirstDay),
    "period days fell back to the window-scoped first record"
  );
});

test("a summary without the proven field keeps a sane fallback", async () => {
  const raw = await loadSummary(ACCEPTANCE_SUMMARY);
  if (!raw) return;
  const legacy = { ...raw, period: { ...raw.period } };
  delete legacy.period.firstActualPlayDate;
  const vm = normalize(legacy);
  assert.equal(vm.period.firstActualPlayDate, null);
  assert.equal(vm.period.totalDays, expectedDays(raw.period.firstRecordAt.slice(0, 10)));
  assert.ok(Number.isFinite(vm.period.totalDays) && vm.period.totalDays > 0);
});

test("period days stay on Shanghai calendar days regardless of the host time zone", async () => {
  const raw = await loadSummary(ACCEPTANCE_SUMMARY);
  if (!raw) return;
  // A late-evening moment in Shanghai already belongs to the next UTC day, so a
  // naive UTC day split would shorten the span by one.
  const lateEvening = new Date();
  lateEvening.setUTCHours(16, 30, 0, 0);
  const anchor = { ...raw, period: { ...raw.period, firstActualPlayDate: "2026-01-01" } };
  const vm = normalize(anchor);
  assert.equal(
    vm.period.totalDays,
    expectedDays("2026-01-01", shanghaiDay(lateEvening)),
    "day counting drifted away from the season time zone"
  );
});
