import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { register } from "node:module";
import { resolve } from "node:path";

// The real normalizer is the unit under test: a replica of the calendar helper
// cannot catch a broken call site, which is how the acceptance failure happened.
register("./support/nuxtAliasHooks.mjs", import.meta.url);
const { normalizeAnnualSummary } = await import("../utils/annualSummary.ts");

// Only summaries produced by the current algorithm may be audited; older cached
// files can legitimately carry earlier presentation contracts.
const CURRENT_ALGORITHM = "annual-observation-v4.5.3";

const listSummaryFiles = async () => {
  const found = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === "summary.json") found.push(path);
    }
  };
  await walk(resolve(import.meta.dirname, "../.data/account-cache/annual-summary-v4/summaries"));
  return found;
};

const shanghaiDay = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

const dayNumber = (key) =>
  Math.round(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000);

// Inclusive calendar-day span, exactly like the renderer computes it.
const expectedDays = (firstDay, generatedDay) => dayNumber(generatedDay) - dayNumber(firstDay) + 1;

const loadSummary = async (path) => JSON.parse(await readFile(path, "utf8").catch(() => "null") ?? "null");

const normalize = (raw) => normalizeAnnualSummary(raw, "zh", (key) => key);
const periodSceneSource = await readFile(
  resolve(import.meta.dirname, "../components/account/version-summary/AnnualPeriodOverviewScene.vue"),
  "utf8"
);

// The acceptance account (taiko id 2258735) is the case that shipped the wrong
// number online. Its game archive reaches back to 2023-11-18, while the sync
// pipeline only ever observed the account from 2026-01-16 on. The period anchor
// has to be the second one.
const ACCEPTANCE_FIXTURE = {
  schemaVersion: 4,
  summaryId: "annual_fixture_2258735",
  generatedAt: "2026-09-11T20:48:00+08:00",
  mode: "version_observed",
  version: {
    key: "annual_2026",
    name: "2026 太鼓年度回顾",
    startDate: "2025-10-09",
    endDate: "2026-09-11",
    effectiveEndDate: "2026-09-11",
    isOngoing: false,
    timezone: "Asia/Shanghai"
  },
  coverage: {
    snapshotCount: 138,
    firstSnapshotAt: "2026-01-16T21:43:20+08:00",
    lastSnapshotAt: "2026-09-05T21:36:52+08:00",
    partialStart: true
  },
  profileCard: { nickname: "tester" },
  period: {
    status: "proxy",
    firstActualPlayDate: "2026-01-16",
    firstRecordAt: "2026-01-16T21:43:20+08:00",
    lastRecordAt: "2026-09-05T21:35:28+08:00",
    totalDays: 338,
    activeDays: 92
  },
  overview: { status: "proxy", data: { playCount: 2426, uniqueSongs: 400, uniqueCharts: 900 } },
  sections: {}
};

test("period days run from the user's first observable day inside the version window", () => {
  const vm = normalize(ACCEPTANCE_FIXTURE);
  assert.equal(vm.period.firstObservedDate, "2026-01-16");
  assert.equal(vm.period.firstActualPlayDate, "2026-01-16");
  assert.equal(vm.period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
  assert.equal(vm.period.totalDays, 239);
});

test("the game's own historical score timestamp can never become the period anchor", () => {
  const vm = normalize(ACCEPTANCE_FIXTURE);
  // 2023-11-18 is the earliest highscore_datetime in the account archive. Using
  // it produced the reported 1029 days.
  const legacyScoreAnchor = expectedDays("2023-11-18", "2026-09-11");
  assert.equal(legacyScoreAnchor, 1029);
  assert.notEqual(vm.period.totalDays, legacyScoreAnchor);
  assert.equal(vm.period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
});

test("period days follow report generation but stop at the declared window end", () => {
  const later = { ...ACCEPTANCE_FIXTURE, generatedAt: "2026-09-21T20:48:00+08:00" };
  const earlier = { ...ACCEPTANCE_FIXTURE, generatedAt: "2026-09-01T20:48:00+08:00" };
  assert.equal(normalize(later).period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
  assert.equal(normalize(earlier).period.totalDays, expectedDays("2026-01-16", "2026-09-01"));
  assert.equal(normalize(later).period.totalDays - normalize(earlier).period.totalDays, 10);
});

test("coverage remains the display anchor when first-play provenance is absent", () => {
  const legacy = { ...ACCEPTANCE_FIXTURE, period: { ...ACCEPTANCE_FIXTURE.period } };
  delete legacy.period.firstActualPlayDate;
  const vm = normalize(legacy);
  assert.equal(vm.period.firstObservedDate, "2026-01-16");
  assert.equal(vm.period.firstActualPlayDate, null);
  assert.equal(vm.period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
  assert.ok(Number.isFinite(vm.period.totalDays) && vm.period.totalDays > 0);
});

test("period days stay on Shanghai calendar days regardless of the host time zone", () => {
  // Changing older provenance must not override the stronger coverage timestamp.
  const anchor = { ...ACCEPTANCE_FIXTURE, period: { ...ACCEPTANCE_FIXTURE.period, firstActualPlayDate: "2026-01-01" } };
  const vm = normalize(anchor);
  assert.equal(vm.period.firstObservedDate, "2026-01-16");
  assert.equal(vm.period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
});

test("a pre-window observation never leaks into the Period page", () => {
  const regression = {
    ...ACCEPTANCE_FIXTURE,
    generatedAt: "2026-09-23T17:00:15+08:00",
    version: {
      ...ACCEPTANCE_FIXTURE.version,
      endDate: "2026-09-30",
      effectiveEndDate: "2026-09-30"
    },
    coverage: {
      ...ACCEPTANCE_FIXTURE.coverage,
      firstSnapshotAt: "2025-10-09T13:00:53+08:00"
    },
    period: {
      ...ACCEPTANCE_FIXTURE.period,
      firstActualPlayDate: "2025-10-06",
      firstRecordAt: "2025-10-06T16:38:43+08:00",
      totalDays: 350
    }
  };
  const vm = normalize(regression);
  assert.equal(vm.period.firstActualPlayDate, "2025-10-06", "provenance remains available");
  assert.equal(vm.period.firstObservedDate, "2025-10-09");
  assert.equal(vm.period.totalDays, 350);
  assert.equal(vm.period.totalDays, expectedDays("2025-10-09", "2026-09-23"));
});

test("the Period scene uses the first in-window observation and accurate copy", () => {
  assert.match(periodSceneSource, /anchorDate = computed\(\(\) => props\.summary\.period\.firstObservedDate \|\| props\.summary\.version\.startDate\)/);
  assert.match(periodSceneSource, /first: "这个版本里首次留下记录"/);
  assert.match(periodSceneSource, /first: "このバージョンで最初に記録された日"/);
  assert.doesNotMatch(periodSceneSource, /这个版本的第一天|このバージョンの初日/);
  assert.doesNotMatch(periodSceneSource, /我们第一次相遇|私たちが初めて出会った日/);
});

test("current cached summaries render a reporting-window duration", async () => {
  // Opportunistic audit: the cached file is a local artifact and may still hold
  // a summary produced by an older algorithm, so only current-version files are inspected.
  const candidates = await listSummaryFiles();
  for (const path of candidates) {
    const raw = await loadSummary(path);
    if (!raw || raw.provenance?.algorithmVersion !== CURRENT_ALGORITHM) continue;
    const vm = normalize(raw);
    const firstObservedSource = raw.coverage?.firstSnapshotAt
      ? shanghaiDay(raw.coverage.firstSnapshotAt)
      : raw.period?.firstActualPlayDate || shanghaiDay(raw.period?.firstRecordAt);
    const firstObservedDate = [raw.version.startDate, firstObservedSource].filter(Boolean).sort().at(-1);
    const endDay = [
      shanghaiDay(raw.generatedAt),
      raw.version?.effectiveEndDate,
      raw.version?.endDate
    ].filter(Boolean).sort()[0];
    assert.equal(vm.period.firstObservedDate, firstObservedDate, `${path} resolved the wrong first observable day`);
    assert.equal(vm.period.totalDays, expectedDays(firstObservedDate, endDay), `${path} escaped its observable window`);
  }
});
