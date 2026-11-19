// P0-15 / P0-25: pure geometry and formatting behind DsNote, DsJudgeBar and components/ds/charts/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DENSITY_HOT,
  DIAL_MAX_RIVETS,
  DS_MISSING,
  LANE_FACT_NOTE,
  LANE_FACT_TYPES,
  densityBars,
  dialRivets,
  formatCount,
  formatFixed,
  judgeParts,
  laneColumnWidth,
  laneColumns,
  laneNoteScale,
  laneTopFact,
  lineGeometry,
  labelWidth,
  nearestIndex,
  niceAxis,
  parseIsoDay,
  polar,
  radarDomain,
  radarGeometry,
  scaleLinear,
  sparkGeometry,
  stepDecimals,
  xLabelIndices
} from "../utils/ds/charts.ts";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

/* ---------------- formatting ---------------- */

test("numbers: fixed decimals, thousands separators, missing is an em dash", () => {
  assert.equal(formatFixed(11.974), "11.97");
  assert.equal(formatFixed(11.976), "11.98");
  assert.equal(formatFixed(0), "0.00");
  assert.equal(formatFixed(null), DS_MISSING);
  assert.equal(formatFixed(Number.NaN), DS_MISSING);
  assert.equal(formatCount(1004290), "1,004,290");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(undefined), DS_MISSING);
  assert.equal(DS_MISSING, "—");
});

/* ---------------- scales and axes ---------------- */

test("linear scale maps both ends and a zero-width domain to the middle", () => {
  const s = scaleLinear(0, 10, 100, 0);
  assert.equal(s(0), 100);
  assert.equal(s(10), 0);
  assert.equal(s(5), 50);
  assert.equal(scaleLinear(3, 3, 0, 200)(3), 100);
});

test("nice axis: at most 4 ticks, covers the data, steps are 1 / 2 / 2.5 / 4 / 5 × 10^k", () => {
  for (const values of [[11.2, 11.97], [0, 15.5], [0, 1_000_000], [-3, 0.1], [9.99, 10.01], [42], [0], [0, 0, 0], [-1e9, 1e9]]) {
    const axis = niceAxis(values)!;
    assert.ok(axis, `axis for ${values}`);
    assert.ok(axis.ticks.length >= 2 && axis.ticks.length <= 4, `${values}: ${axis.ticks.length} ticks`);
    assert.ok(axis.lo <= Math.min(...values) && axis.hi >= Math.max(...values), `${values} inside [${axis.lo}, ${axis.hi}]`);
    const mant = axis.step / 10 ** Math.floor(Math.log10(axis.step));
    assert.ok([1, 2, 2.5, 4, 5].some((k) => Math.abs(k - mant) < 1e-9), `step ${axis.step}`);
    for (const t of axis.ticks) assert.equal(Number(t.toFixed(axis.decimals)), t, `tick ${t} prints exactly with ${axis.decimals} decimals`);
  }
  assert.equal(niceAxis([]), null);
  assert.equal(niceAxis([null, Number.NaN, undefined]), null);
  // slice G: the upper bound is the tightest one the tick budget allows (0–10,200 → 12,000, not 15,000)
  assert.deepEqual(niceAxis([0, 10_200])!.ticks, [0, 4000, 8000, 12000]);
  assert.deepEqual(niceAxis([0, 1_000_000])!.ticks, [0, 500000, 1000000]);
  assert.equal(niceAxis([880_000, 968_310])!.hi, 1_000_000);
  assert.equal(stepDecimals(0.25), 2);
  assert.equal(stepDecimals(0.5), 1);
  assert.equal(stepDecimals(500), 0);
});

/* ---------------- LineChart ---------------- */

test("line geometry: path through every point, area closed on the baseline, y up", () => {
  const g = lineGeometry([10, 11, 12], 600, 220)!;
  assert.equal(g.points.length, 3);
  assert.match(g.line, /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
  assert.ok(g.area.endsWith("Z"));
  assert.ok(g.points[0].y > g.points[2].y, "larger values are higher");
  near(g.points[0].x, g.pad.l);
  near(g.points[2].x, 600 - g.pad.r);
  for (const p of g.points) assert.ok(p.y >= g.pad.t && p.y <= g.baseline);
  assert.ok(g.ticks.length <= 4);
});

test("line geometry: empty is null, one point is centred with no line, gaps break the line", () => {
  assert.equal(lineGeometry([], 600, 220), null);
  assert.equal(lineGeometry([null, null], 600, 220), null);
  const one = lineGeometry([11.97], 600, 220)!;
  assert.equal(one.line, "");
  assert.equal(one.area, "");
  assert.equal(one.points.length, 1);
  assert.equal(one.isolated.length, 1);
  near(one.points[0].x, (one.pad.l + 600 - one.pad.r) / 2);
  const gap = lineGeometry([1, 2, null, 3, null, 4, 5], 600, 220)!;
  assert.equal((gap.line.match(/M/g) || []).length, 2, "two runs of ≥ 2 points");
  assert.deepEqual(gap.isolated.map((p) => p.i), [3]);
});

test("line geometry: extreme values stay inside the plot and widen the y-label gutter", () => {
  const g = lineGeometry([0, 1_000_000, 3, 999_999], 390, 200)!;
  for (const p of g.points) assert.ok(p.y >= g.pad.t - 0.01 && p.y <= g.baseline + 0.01);
  const small = lineGeometry([1, 2], 390, 200)!;
  assert.ok(g.pad.l > small.pad.l);
  for (const t of g.ticks) assert.ok(labelWidth(t.text) <= g.pad.l - 8);
});

test("y labels: digit grouping from 10,000, plain below", () => {
  assert.deepEqual(lineGeometry([0, 1_000_000], 390, 200)!.ticks.map((t) => t.text), ["0", "500,000", "1,000,000"]);
  assert.deepEqual(lineGeometry([0, 10_200], 390, 200)!.ticks.map((t) => t.text), ["0", "4000", "8000", "12,000"]);
  assert.deepEqual(lineGeometry([9.2, 9.4], 390, 200)!.ticks.map((t) => t.text).slice(0, 2), ["9.2", "9.3"]);
});

test("x labels never get closer than 1.5 label widths, always include first and last", () => {
  for (const [n, width] of [[30, 330], [90, 330], [7, 330], [400, 1200], [2, 60]] as const) {
    const lw = labelWidth("10/28");
    const idx = xLabelIndices(n, width, lw);
    assert.equal(idx[0], 0);
    assert.equal(idx[idx.length - 1], n - 1);
    const step = width / (n - 1);
    for (let k = 1; k < idx.length; k += 1) assert.ok((idx[k] - idx[k - 1]) * step >= lw * 1.5 + 10 - 1e-6 || idx.length === 2, `n=${n} w=${width}`);
  }
  assert.deepEqual(xLabelIndices(1, 300, 30), [0]);
  assert.deepEqual(xLabelIndices(0, 300, 30), []);
  assert.deepEqual(xLabelIndices(4, 1000, 30), [0, 1, 2, 3]);
});

test("x labels: one even integer step, the last label anchored at the end", () => {
  for (const [n, width] of [[30, 330], [90, 330], [91, 900], [400, 1200], [13, 300], [8, 330]] as const) {
    const lw = labelWidth("10/28");
    const idx = xLabelIndices(n, width, lw);
    if (idx.length < 3) continue;
    const step = idx[1] - idx[0];
    for (let k = 1; k < idx.length - 1; k += 1) assert.equal(idx[k] - idx[k - 1], step, `n=${n} w=${width}: ${idx}`);
    assert.ok(idx[idx.length - 1] - idx[idx.length - 2] <= 2 * step, `last gap n=${n}`);
  }
  assert.deepEqual(xLabelIndices(91, 900, labelWidth("10/28")), [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 90]);
});

test("nearest index clamps to the series", () => {
  assert.equal(nearestIndex(-50, 10, 40, 400), 0);
  assert.equal(nearestIndex(5000, 10, 40, 400), 9);
  assert.equal(nearestIndex(220, 10, 40, 400), 5);
  assert.equal(nearestIndex(220, 1, 40, 400), 0);
});

/* ---------------- Spark ---------------- */

test("spark: inset path, last-point dot, single point centred, empty null", () => {
  const g = sparkGeometry([1, 3, 2], 96, 28)!;
  assert.match(g.path, /^M3 /);
  assert.deepEqual(g.last, { x: 93, y: 14 });
  const one = sparkGeometry([5], 96, 28)!;
  assert.equal(one.path, "");
  assert.deepEqual(one.last, { x: 48, y: 14 });
  assert.equal(sparkGeometry([], 96, 28), null);
  const flat = sparkGeometry([2, 2, 2], 96, 28)!;
  assert.ok(flat.path.split(/[ML]/).filter(Boolean).every((p) => p.endsWith(" 14")), "flat series sits in the middle");
});

/* ---------------- Radar ---------------- */

test("radar domain: floor(min − 0.6) … ceil(max + 0.1), never below 0, never zero-width", () => {
  assert.deepEqual(radarDomain([{ value: 11.7 }, { value: 12.49, prev: 12.1 }]), [11, 13]);
  assert.deepEqual(radarDomain([{ value: 0.2 }]), [0, 1]);
  assert.deepEqual(radarDomain([]), [0, 1]);
  assert.deepEqual(radarDomain([{ value: null }]), [0, 1]);
  const [lo, hi] = radarDomain([{ value: 5 }, { value: 5 }]);
  assert.ok(hi > lo);
});

test("radar points: first spoke at 12 o'clock, clockwise, clamped to the rings", () => {
  const [x0, y0] = polar(0, 6, 100, 150, 150);
  near(x0, 150);
  near(y0, 50);
  const [x1] = polar(1, 6, 100, 150, 150);
  assert.ok(x1 > 150, "second spoke to the right");
  const g = radarGeometry(
    [
      { key: "a", label: "a", value: 20 },
      { key: "b", label: "b", value: -5 },
      { key: "c", label: "c", value: 7.75 },
      { key: "d", label: "d", value: null }
    ],
    { domain: [0, 15.5], cx: 150, cy: 150, r: 100 }
  );
  near(g.value[0]![1], 50); // clamped to the outer ring
  near(g.value[1]![0], 150); // clamped to the centre
  near(g.value[2]![1], 200); // 50 % on the bottom spoke
  assert.equal(g.value[3], null);
  assert.equal(g.rings.length, 4);
  assert.ok(g.rings.every((r) => r.points.split(" ").length === 4));
  assert.equal(g.prev, null);
  assert.equal(g.labels[0].anchor, "middle");
  assert.equal(g.labels[0].dy, "above");
  assert.equal(g.labels[1].anchor, "start");
  assert.equal(g.labels[3].anchor, "end");
});

test("radar with fewer than 3 axes and with previous values", () => {
  const one = radarGeometry([{ key: "a", label: "a", value: 3, prev: 2 }]);
  assert.equal(one.spokes.length, 1);
  assert.ok(one.rings.every((r) => r.points === "" && r.r > 0), "rings become circles");
  assert.ok(one.prev && one.prev[0]);
  assert.equal(radarGeometry([]).valuePolygon, "");
});

/* ---------------- DrumDial ---------------- */

test("dial rivets: 31 for Rating 15.5 / 0.5, 270° from 7:30, half rivet for a remainder", () => {
  const r = dialRivets(11.97, 15.5, 0.5, { cx: 60, cy: 60, r: 52 });
  assert.equal(r.length, 31);
  assert.equal(r.filter((x) => x.state === "on").length, 23);
  assert.equal(r.filter((x) => x.state === "half").length, 1);
  near(r[0].x, 60 + Math.cos((135 * Math.PI) / 180) * 52); // 7:30
  near(r[30].x, 60 + Math.cos((45 * Math.PI) / 180) * 52); // 4:30
  assert.ok(r[15].y < 60 && Math.abs(r[15].x - 60) < 0.01, "middle rivet at 12 o'clock");
});

test("dial rivets: empty, full, over and under range, goal progress, bad input", () => {
  assert.ok(dialRivets(0, 15.5, 0.5).every((x) => x.state === "off"));
  assert.ok(dialRivets(null, 15.5, 0.5).every((x) => x.state === "off"));
  assert.ok(dialRivets(15.5, 15.5, 0.5).every((x) => x.state === "on"));
  assert.ok(dialRivets(99, 15.5, 0.5).every((x) => x.state === "on"));
  assert.ok(dialRivets(-3, 15.5, 0.5).every((x) => x.state === "off"));
  assert.equal(dialRivets(0.5, 1, 1 / 24).filter((x) => x.state === "on").length, 12);
  assert.deepEqual(dialRivets(5, 0, 0.5), []);
  assert.deepEqual(dialRivets(5, 10, 0), []);
  assert.equal(dialRivets(5, 10, 0.0001).length, DIAL_MAX_RIVETS);
  const single = dialRivets(1, 1, 1);
  assert.equal(single.length, 1);
  assert.equal(single[0].state, "on");
});

/* ---------------- DensityStrip ---------------- */

test("density bars: clamp to 0–1, hot above the threshold, missing draws nothing", () => {
  const bars = densityBars([0, 0.5, DENSITY_HOT, 0.73, 1, 1.8, -1, null]);
  assert.deepEqual(bars.map((b) => b.hot), [false, false, false, true, true, true, false, false]);
  assert.equal(bars[5].v, 1);
  assert.equal(bars[6].v, 0);
  assert.equal(bars[7].missing, true);
  assert.deepEqual(densityBars([]), []);
});

/* ---------------- JudgeBar ---------------- */

test("judge parts: shares sum to 1, zeros and all-zero handled, missing kept as null", () => {
  const a = judgeParts({ good: 688, ok: 41, ng: 3 });
  assert.equal(a.total, 732);
  near(a.parts.reduce((s, p) => s + p.share, 0), 1, 1e-9);
  assert.deepEqual(a.parts.map((p) => p.key), ["good", "ok", "ng"]);
  const z = judgeParts({ good: 900, ok: 0, ng: 0 });
  assert.deepEqual(z.parts.map((p) => p.share), [1, 0, 0]);
  const none = judgeParts({ good: 0, ok: 0, ng: 0 });
  assert.equal(none.total, 0);
  assert.ok(none.parts.every((p) => p.share === 0 && p.count === 0));
  const missing = judgeParts({ good: 10, ok: null });
  assert.equal(missing.parts[1].count, null);
  assert.equal(missing.parts[2].count, null);
  assert.equal(missing.parts[0].share, 1);
});

/* ---------------- Lane ---------------- */

test("lane fact types are exactly the contract's CanonicalFact types (RK-06)", () => {
  const src = read("../packages/sakura-taiko-contract/src/index.ts");
  const m = /export type CanonicalFact = \{[\s\S]*?\n\s*type: ([^;]+);/.exec(src);
  assert.ok(m, "CanonicalFact.type found in the contract");
  const contract = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual([...LANE_FACT_TYPES].sort(), contract);
  assert.ok(!LANE_FACT_TYPES.includes("clear-upgrade" as never), "prototype name is not used");
});

test("lane: day note is the highest-weight fact; rest, ghost, rolls, today, Monday, month start", () => {
  assert.equal(laneTopFact([{ type: "played" }, { type: "ng-reduced" }, { type: "df" }]), "df");
  assert.equal(laneTopFact([{ type: "score-pb" }, { type: "rank-upgrade" }]), "rank-upgrade");
  assert.equal(laneTopFact([{ type: "nope" as never }]), null);
  assert.equal(laneTopFact([]), null);
  const cols = laneColumns(
    [
      { date: "2026-10-31", played: true, facts: [{ type: "fc" }, { type: "played" }] },
      { date: "2026-11-01", played: true, facts: [] },
      { date: "2026-11-02", played: false, facts: [] },
      { date: "2026-11-03", played: true, facts: [{ type: "goal-completed" }] }
    ],
    "2026-11-03"
  );
  assert.deepEqual(cols.map((c) => c.kind), ["fc", "ghost", "rest", "goal"]);
  assert.deepEqual(cols.map((c) => c.count), [2, 0, 0, 1]);
  assert.deepEqual(cols.map((c) => [c.rollL, c.rollR]), [[false, true], [true, false], [false, false], [false, false]]);
  assert.deepEqual(cols.map((c) => c.today), [false, false, false, true]);
  assert.equal(cols[1].monthStart, true);
  assert.equal(cols[2].monday, true);
  assert.equal(cols[0].weekday, 6);
  assert.equal(LANE_FACT_NOTE.clear.note, "don");
  assert.deepEqual(laneColumns([]), []);
});

test("lane: ISO days are parsed in UTC; invalid days are rejected", () => {
  assert.deepEqual(parseIsoDay("2026-11-17"), { year: 2026, month: 11, day: 17, weekday: 2 });
  assert.equal(parseIsoDay("2026-02-30"), null);
  assert.equal(parseIsoDay("17/11/2026"), null);
});

test("lane column width ≥ 44 (clickable) / 36 (overview), notes fit inside column − 8", () => {
  assert.equal(laneColumnWidth(300, 21), 44);
  assert.equal(laneColumnWidth(300, 7, true), 42.8);
  assert.equal(laneColumnWidth(200, 7, true), 36);
  assert.equal(laneColumnWidth(0, 7), 44);
  assert.equal(laneColumnWidth(1000, 0), 44);
  for (const w of [36, 40, 44, 52, 80]) assert.ok(36 * 1.14 * laneNoteScale(w) <= w - 8 + 1e-6 || laneNoteScale(w) === 0.3);
  assert.equal(laneNoteScale(200), 1);
});
