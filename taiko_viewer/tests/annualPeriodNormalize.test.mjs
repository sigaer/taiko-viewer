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
// files still carry the previous (wrong) anchor.
const CURRENT_ALGORITHM = "annual-observation-v4.2.0";
const ACCEPTANCE_OWNER = "d6b5915c46057bcb005f46f6";

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

test("period days run from the first observed record to the generation moment", () => {
  const vm = normalize(ACCEPTANCE_FIXTURE);
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
  // The anchor may never precede the system's own first record of the account.
  const anchorDay = dayNumber(vm.period.firstActualPlayDate);
  assert.ok(
    anchorDay >= dayNumber(shanghaiDay(ACCEPTANCE_FIXTURE.period.firstRecordAt)),
    "period anchor precedes the first observed record"
  );
});

test("period days follow the report generation moment, not the visitor clock", () => {
  const later = { ...ACCEPTANCE_FIXTURE, generatedAt: "2026-09-21T20:48:00+08:00" };
  const earlier = { ...ACCEPTANCE_FIXTURE, generatedAt: "2026-09-01T20:48:00+08:00" };
  assert.equal(normalize(later).period.totalDays, expectedDays("2026-01-16", "2026-09-21"));
  assert.equal(normalize(earlier).period.totalDays, expectedDays("2026-01-16", "2026-09-01"));
  assert.equal(normalize(later).period.totalDays - normalize(earlier).period.totalDays, 20);
});

test("a summary without the observed anchor keeps a sane window fallback", () => {
  const legacy = { ...ACCEPTANCE_FIXTURE, period: { ...ACCEPTANCE_FIXTURE.period } };
  delete legacy.period.firstActualPlayDate;
  const vm = normalize(legacy);
  assert.equal(vm.period.firstActualPlayDate, null);
  assert.equal(vm.period.totalDays, expectedDays("2026-01-16", "2026-09-11"));
  assert.ok(Number.isFinite(vm.period.totalDays) && vm.period.totalDays > 0);
});

test("period days stay on Shanghai calendar days regardless of the host time zone", () => {
  // 2026-09-11T20:48:00+08:00 already belongs to the next UTC day, so a naive
  // UTC split would shorten the span by one.
  const anchor = { ...ACCEPTANCE_FIXTURE, period: { ...ACCEPTANCE_FIXTURE.period, firstActualPlayDate: "2026-01-01" } };
  const vm = normalize(anchor);
  assert.equal(vm.period.totalDays, expectedDays("2026-01-01", "2026-09-11"));
});

test("the acceptance account cache keeps the observed anchor once regenerated", async () => {
  // Opportunistic audit: the cached file is a local artifact and may still hold
  // a summary produced by an older algorithm, so only current-version files are
  // inspected. The fixture cases above carry the contract itself.
  const candidates = (await listSummaryFiles()).filter((path) => path.includes(ACCEPTANCE_OWNER));
  for (const path of candidates) {
    const raw = await loadSummary(path);
    if (!raw || raw.provenance?.algorithmVersion !== CURRENT_ALGORITHM) continue;
    const vm = normalize(raw);
    assert.equal(
      vm.period.firstActualPlayDate,
      shanghaiDay(raw.coverage.firstSnapshotAt),
      `${path} no longer anchors on its first observed record`
    );
    assert.equal(vm.period.totalDays, expectedDays(vm.period.firstActualPlayDate, shanghaiDay(raw.generatedAt)));
    assert.ok(vm.period.totalDays < 1029, `${path} regressed to the game's historical score anchor`);
  }
});
