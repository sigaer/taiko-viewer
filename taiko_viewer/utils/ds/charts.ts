// Pure geometry and formatting for the design-system charts (P0-25) and the judge bar (P0-15).
// No DOM, no Vue: every function takes prepared numbers and returns numbers / strings, so it runs the same in SSR,
// in the browser and in node:test (tests/dsCharts.test.ts).
//
// Conventions shared by the chart components in components/ds/charts/:
//   - missing values are null / non-finite numbers; they are skipped in shapes and printed as "—" (U+2014)
//   - empty input returns an explicit empty result; components render their empty state from it
//   - one point is a valid input and draws a single mark (no division by n − 1)
import type { CanonicalFact } from "@sakura-taiko/contract";

export const DS_MISSING = "—";

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Round away binary noise (0.1 + 0.2) so tick values and SVG coordinates stay stable between SSR and client. */
export const tidy = (v: number, places = 6) => {
  const r = Number(v.toFixed(places));
  return Object.is(r, -0) ? 0 : r;
};

/** Fixed decimals; missing → "—". Ratings, constants, dimensions: 2 decimals (04 V1.2 §4.6). */
export function formatFixed(v: number | null | undefined, digits = 2): string {
  return isNum(v) ? tidy(v, digits).toFixed(digits) : DS_MISSING;
}

/** Counts and scores: thousands separators, no abbreviation; missing → "—". */
export function formatCount(v: number | null | undefined): string {
  return isNum(v) ? Math.round(v).toLocaleString("en-US") : DS_MISSING;
}

/** Linear map from [d0, d1] to [r0, r1]. A zero-width domain maps everything to the middle of the range. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0;
  if (!span) return () => (r0 + r1) / 2;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

const NICE = [1, 2, 2.5, 5];

/** Decimal places needed to print every multiple of `step` exactly (0.25 → 2, 0.5 → 1, 5 → 0). */
export function stepDecimals(step: number): number {
  if (!isNum(step) || step <= 0) return 0;
  for (let d = 0; d <= 8; d += 1) if (Math.abs(tidy(step * 10 ** d, 6) - Math.round(step * 10 ** d)) < 1e-9) return d;
  return 8;
}

export interface NiceAxis {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
  decimals: number;
}

/**
 * A y axis with at most `maxTicks` reference lines (04 V1.2 §9.22: ≤ 4) covering [min, max].
 * Equal values get a band around them; returns null for no finite value.
 */
export function niceAxis(values: ReadonlyArray<number | null | undefined>, maxTicks = 4): NiceAxis | null {
  const vs = values.filter(isNum);
  if (!vs.length) return null;
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 0.5;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const ticksWanted = Math.max(2, maxTicks);
  const raw = span / (ticksWanted - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  // A larger step always means fewer ticks, so this ends within a few decades.
  for (let m = mag / 10, guard = 0; guard < 8; m *= 10, guard += 1) {
    for (const k of NICE) {
      const step = tidy(k * m, 12);
      if (step <= 0) continue;
      const lo = tidy(Math.floor(tidy(min / step, 9)) * step, 9);
      const hi = tidy(Math.ceil(tidy(max / step, 9)) * step, 9);
      const count = Math.round((hi - lo) / step) + 1;
      if (count <= ticksWanted) {
        const ticks = Array.from({ length: count }, (_, i) => tidy(lo + i * step, 9));
        return { lo, hi, step, ticks, decimals: stepDecimals(step) };
      }
    }
  }
  return null;
}

/** Approximate rendered width of a number / date label in the number font (Barlow Condensed ≈ 0.55 em per glyph). */
export const labelWidth = (text: string, fontSize = 12) => Math.ceil(text.length * fontSize * 0.58) + 2;

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

/** Conservative width of mixed text in the UI font: CJK / full-width glyphs 1 em, everything else 0.62 em. */
export function textWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += WIDE.test(ch) ? fontSize : fontSize * 0.62;
  return Math.ceil(w);
}

/**
 * Which x labels to print so neighbouring labels never touch (V1.2 §9.22; P0-25 "no colliding text at 390").
 * First is start-anchored, last end-anchored, the rest centred; the spacing rule covers the worst pair (1.5 × label).
 */
export function xLabelIndices(n: number, plotWidth: number, maxLabelPx: number, gap = 10): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const need = maxLabelPx * 1.5 + gap;
  if (plotWidth / (n - 1) >= need) return Array.from({ length: n }, (_, i) => i);
  const per = plotWidth / (n - 1);
  // Rounding indices can pull two labels closer than the even spacing; drop one label until every gap fits.
  for (let k = clamp(Math.floor(plotWidth / need) + 1, 2, n); k > 2; k -= 1) {
    const idx = [...new Set(Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1))))];
    if (idx.every((v, j) => j === 0 || (v - idx[j - 1]) * per >= need)) return idx;
  }
  return [0, n - 1];
}

/* ------------------------------------------------------------------ LineChart */

export interface ChartPad {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface LinePointGeom {
  i: number;
  x: number;
  y: number;
  v: number;
}

export interface LineGeometry {
  axis: NiceAxis;
  pad: ChartPad;
  points: LinePointGeom[];
  /** Points with no neighbour on either side (single point, or between gaps): drawn as dots. */
  isolated: LinePointGeom[];
  /** Path of the series; a missing value breaks the line. */
  line: string;
  /** Closed area under the series, one sub-path per unbroken run. */
  area: string;
  ticks: Array<{ v: number; y: number; text: string }>;
  x: (i: number) => number;
  y: (v: number) => number;
  baseline: number;
}

const f1 = (v: number) => tidy(v, 1).toString();

/**
 * Line chart geometry for `values` (one per x position) in a `width` × `height` box.
 * The left pad grows with the widest y label. Returns null when there is no finite value.
 */
export function lineGeometry(values: ReadonlyArray<number | null | undefined>, width: number, height: number, opts: { maxTicks?: number; fontSize?: number } = {}): LineGeometry | null {
  const axis = niceAxis(values, opts.maxTicks ?? 4);
  if (!axis) return null;
  const fontSize = opts.fontSize ?? 12;
  const tickTexts = axis.ticks.map((t) => t.toFixed(axis.decimals));
  const pad: ChartPad = { l: Math.max(...tickTexts.map((t) => labelWidth(t, fontSize))) + 10, r: 14, t: 14, b: 26 };
  const n = values.length;
  const x = n <= 1 ? () => (pad.l + width - pad.r) / 2 : scaleLinear(0, n - 1, pad.l, width - pad.r);
  const y = scaleLinear(axis.lo, axis.hi, height - pad.b, pad.t);
  const baseline = height - pad.b;
  const points: LinePointGeom[] = [];
  values.forEach((v, i) => {
    if (isNum(v)) points.push({ i, v, x: tidy(x(i), 2), y: tidy(y(v), 2) });
  });
  const runs: LinePointGeom[][] = [];
  let run: LinePointGeom[] = [];
  values.forEach((v, i) => {
    if (isNum(v)) run.push(points.find((p) => p.i === i)!);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  const line = runs
    .filter((r) => r.length > 1)
    .map((r) => r.map((p, k) => `${k ? "L" : "M"}${f1(p.x)} ${f1(p.y)}`).join(""))
    .join("");
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `${r.map((p, k) => `${k ? "L" : "M"}${f1(p.x)} ${f1(p.y)}`).join("")}L${f1(r[r.length - 1].x)} ${f1(baseline)}L${f1(r[0].x)} ${f1(baseline)}Z`)
    .join("");
  const ticks = axis.ticks.map((v, k) => ({ v, y: tidy(y(v), 2), text: tickTexts[k] }));
  const isolated = runs.filter((r) => r.length === 1).map((r) => r[0]);
  return { axis, pad, points, isolated, line, area, ticks, x, y, baseline };
}

/** Index of the point nearest to plot x (pointer read-out). */
export function nearestIndex(px: number, n: number, left: number, right: number): number {
  if (n <= 1) return 0;
  const i = Math.round(((px - left) / (right - left)) * (n - 1));
  return clamp(i, 0, n - 1);
}

/* ------------------------------------------------------------------ Spark */

export interface SparkGeometry {
  path: string;
  last: { x: number; y: number } | null;
}

/** Spark line in a w × h box with a 3px inset; one point is a centred dot, no point is null. */
export function sparkGeometry(values: ReadonlyArray<number | null | undefined>, w: number, h: number): SparkGeometry | null {
  const vs = values.map((v) => (isNum(v) ? v : null));
  const finite = vs.filter(isNum);
  if (!finite.length) return null;
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const n = vs.length;
  const x = n <= 1 ? () => w / 2 : scaleLinear(0, n - 1, 3, w - 3);
  const y = scaleLinear(lo, hi, h - 4, 4);
  let path = "";
  let pen = false;
  let last: { x: number; y: number } | null = null;
  vs.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    const px = tidy(x(i), 1);
    const py = tidy(y(v), 1);
    path += `${pen ? "L" : "M"}${px} ${py}`;
    pen = true;
    last = { x: px, y: py };
  });
  return { path: finite.length > 1 ? path : "", last };
}

/* ------------------------------------------------------------------ Radar */

export interface RadarAxisInput {
  key: string;
  label: string;
  value: number | null;
  prev?: number | null;
}

/** Auto domain for a radar (V1.2 §9.24): floor(min − 0.6) … ceil(max + 0.1), never below 0. */
export function radarDomain(axes: ReadonlyArray<Pick<RadarAxisInput, "value" | "prev">>): [number, number] {
  const vals = axes.flatMap((a) => [a.value, a.prev]).filter(isNum);
  if (!vals.length) return [0, 1];
  const lo = Math.max(0, Math.floor(Math.min(...vals) - 0.6));
  let hi = Math.ceil(Math.max(...vals) + 0.1);
  if (hi <= lo) hi = lo + 1;
  return [lo, hi];
}

/** Point on spoke i of n at radius r (12 o'clock first, clockwise). */
export function polar(i: number, n: number, r: number, cx: number, cy: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
  return [tidy(cx + Math.cos(a) * r, 2), tidy(cy + Math.sin(a) * r, 2)];
}

export interface RadarGeometry {
  domain: [number, number];
  /** Spoke ends at the outer ring. */
  spokes: Array<[number, number]>;
  /** Reference rings at 25 / 50 / 75 / 100 %: polygon point lists (n ≥ 3) or circle radii (n < 3). */
  rings: Array<{ points: string; r: number }>;
  value: Array<[number, number] | null>;
  prev: Array<[number, number] | null> | null;
  valuePolygon: string;
  prevPolygon: string;
  labels: Array<{ x: number; y: number; anchor: "start" | "middle" | "end"; dy: "above" | "below" | "middle" }>;
}

const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Radar geometry. Values outside the domain are clamped to the centre / outer ring; a missing value sits at the
 * centre in the polygon and gets no dot. n < 3 axes still draws (rings become circles, the polygon a point / line).
 */
export function radarGeometry(axes: ReadonlyArray<RadarAxisInput>, opts: { domain?: [number, number] | null; cx?: number; cy?: number; r?: number; labelGap?: number } = {}): RadarGeometry {
  const cx = opts.cx ?? 150;
  const cy = opts.cy ?? 150;
  const R = opts.r ?? 92;
  const gap = opts.labelGap ?? 18;
  const domain = opts.domain && opts.domain[1] > opts.domain[0] ? opts.domain : radarDomain(axes);
  const n = axes.length;
  const t = (v: number) => clamp((v - domain[0]) / (domain[1] - domain[0]), 0, 1);
  const at = (i: number, v: number | null | undefined) => (isNum(v) ? polar(i, n, t(v) * R, cx, cy) : null);
  const value = axes.map((a, i) => at(i, a.value));
  const hasPrev = axes.some((a) => isNum(a.prev));
  const prev = hasPrev ? axes.map((a, i) => at(i, a.prev)) : null;
  const centre: [number, number] = [cx, cy];
  const rings = [0.25, 0.5, 0.75, 1].map((k) => ({
    r: tidy(R * k, 2),
    points: n >= 3 ? pts(axes.map((_, i) => polar(i, n, R * k, cx, cy))) : ""
  }));
  const labels = axes.map((_, i) => {
    const [x, y] = polar(i, n, R + gap, cx, cy);
    const dx = x - cx;
    const dyv = y - cy;
    const anchor: "start" | "middle" | "end" = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    const dy: "above" | "below" | "middle" = Math.abs(dx) < 8 ? (dyv < 0 ? "above" : "below") : "middle";
    return { x, y, anchor, dy };
  });
  return {
    domain,
    spokes: axes.map((_, i) => polar(i, n, R, cx, cy)),
    rings,
    value,
    prev,
    valuePolygon: pts(value.map((p) => p ?? centre)),
    prevPolygon: prev ? pts(prev.map((p) => p ?? centre)) : "",
    labels
  };
}

/* ------------------------------------------------------------------ DrumDial */

export type RivetState = "on" | "half" | "off";

export interface Rivet {
  x: number;
  y: number;
  state: RivetState;
}

/** Hard cap on rivets so a bad `step` cannot produce thousands of nodes. */
export const DIAL_MAX_RIVETS = 64;

/**
 * Rivets around the drum rim (V1.2 §9.24): one per `step` up to `max`, from the 7:30 position clockwise over 270°.
 * Values are clamped to [0, max]; a fractional remainder lights one rivet half.
 */
export function dialRivets(value: number | null | undefined, max: number, step: number, geo: { cx?: number; cy?: number; r?: number } = {}): Rivet[] {
  if (!isNum(max) || !isNum(step) || max <= 0 || step <= 0) return [];
  const n = clamp(Math.round(max / step), 1, DIAL_MAX_RIVETS);
  const cx = geo.cx ?? 60;
  const cy = geo.cy ?? 60;
  const r = geo.r ?? 52;
  const lit = isNum(value) ? tidy(clamp(value, 0, max) / (max / n), 6) : 0;
  return Array.from({ length: n }, (_, i) => {
    const deg = n === 1 ? 270 : 135 + (270 * i) / (n - 1);
    const a = (deg * Math.PI) / 180;
    const state: RivetState = i + 1 <= lit ? "on" : i < lit ? "half" : "off";
    return { x: tidy(cx + Math.cos(a) * r, 2), y: tidy(cy + Math.sin(a) * r, 2), state };
  });
}

/* ------------------------------------------------------------------ DensityStrip */

/** Bars above this share of the chart's peak density are marked as hard sections (same threshold as ChartSheet). */
export const DENSITY_HOT = 0.72;

export interface DensityBar {
  v: number;
  hot: boolean;
  missing: boolean;
}

/** Per-measure density 0–1 → bars; values are clamped, missing values draw nothing. */
export function densityBars(values: ReadonlyArray<number | null | undefined>, threshold = DENSITY_HOT): DensityBar[] {
  return values.map((raw) => {
    if (!isNum(raw)) return { v: 0, hot: false, missing: true };
    const v = clamp(raw, 0, 1);
    return { v, hot: v > threshold, missing: false };
  });
}

/* ------------------------------------------------------------------ JudgeBar */

export type JudgeKey = "good" | "ok" | "ng";
export const JUDGE_KEYS: readonly JudgeKey[] = Object.freeze(["good", "ok", "ng"]);

export interface JudgePart {
  key: JudgeKey;
  count: number | null;
  /** 0–1 share of the bar; 0 when the total is 0. */
  share: number;
}

/** Judge counts → bar parts. Missing / negative counts draw nothing; all-zero gives an empty track. */
export function judgeParts(counts: Partial<Record<JudgeKey, number | null | undefined>>): { total: number; parts: JudgePart[] } {
  const safe = (v: unknown) => (isNum(v) && v > 0 ? v : 0);
  const total = JUDGE_KEYS.reduce((s, k) => s + safe(counts[k]), 0);
  return {
    total,
    parts: JUDGE_KEYS.map((key) => ({ key, count: isNum(counts[key]) ? (counts[key] as number) : null, share: total ? safe(counts[key]) / total : 0 }))
  };
}

/* ------------------------------------------------------------------ Lane */

/** Growth fact types come from the contract (12 RK-06): CanonicalFact["type"]; no local names. */
export type LaneFactType = CanonicalFact["type"];

export type LaneNoteKind = "dfc" | "fc" | "goal" | "ka" | "don" | "ghost";

/**
 * Note and weight for each contract fact type (V1.2 §9.12 table, with the contract's `clear` for the prototype's
 * `clear-upgrade`). The day's note is the highest-weight fact. `satisfies` keeps this exhaustive over the contract.
 */
export const LANE_FACT_NOTE = Object.freeze({
  df: { note: "dfc", weight: 6 },
  fc: { note: "fc", weight: 5 },
  "goal-completed": { note: "goal", weight: 4.5 },
  "rank-upgrade": { note: "ka", weight: 4 },
  "score-pb": { note: "don", weight: 3 },
  clear: { note: "don", weight: 3 },
  "ng-reduced": { note: "ka", weight: 2 },
  "combo-improved": { note: "ka", weight: 2 },
  played: { note: "ghost", weight: 1 }
} as const satisfies Record<LaneFactType, { note: LaneNoteKind; weight: number }>);

export const LANE_FACT_TYPES = Object.freeze(Object.keys(LANE_FACT_NOTE) as LaneFactType[]);

/** One day of the lane: a calendar day (YYYY-MM-DD, already in the player's time zone), played or not, and its facts. */
export interface LaneDay {
  date: string;
  played: boolean;
  facts: ReadonlyArray<Pick<CanonicalFact, "type">>;
}

export interface LaneColumn {
  date: string;
  month: number;
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  played: boolean;
  count: number;
  top: LaneFactType | null;
  kind: LaneNoteKind | "rest";
  rollL: boolean;
  rollR: boolean;
  monday: boolean;
  monthStart: boolean;
  today: boolean;
}

/** YYYY-MM-DD → calendar parts, computed in UTC so the result does not depend on the runtime's time zone. */
export function parseIsoDay(s: string): { year: number; month: number; day: number; weekday: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** Highest-weight fact type of a day; unknown types (not in the contract) are ignored. */
export function laneTopFact(facts: ReadonlyArray<Pick<CanonicalFact, "type">>): LaneFactType | null {
  let best: LaneFactType | null = null;
  let w = -1;
  for (const f of facts) {
    const spec = (LANE_FACT_NOTE as Record<string, { weight: number } | undefined>)[f?.type];
    if (spec && spec.weight > w) {
      w = spec.weight;
      best = f.type;
    }
  }
  return best;
}

/** Days (oldest first) → lane columns. `today` (YYYY-MM-DD) marks the judgement circle; it is passed in, never read from a clock. */
export function laneColumns(days: ReadonlyArray<LaneDay>, today?: string | null): LaneColumn[] {
  return days.map((day, i) => {
    const p = parseIsoDay(day.date) ?? { year: 0, month: 0, day: 0, weekday: -1 };
    const top = day.played ? laneTopFact(day.facts) : null;
    const kind: LaneColumn["kind"] = !day.played ? "rest" : top ? LANE_FACT_NOTE[top].note : "ghost";
    return {
      date: day.date,
      month: p.month,
      day: p.day,
      weekday: p.weekday,
      played: day.played,
      count: day.played ? day.facts.filter((f) => laneTopFact([f])).length : 0,
      top,
      kind,
      rollL: day.played && !!days[i - 1]?.played,
      rollR: day.played && !!days[i + 1]?.played,
      monday: p.weekday === 1,
      monthStart: p.day === 1,
      today: !!today && day.date === today
    };
  });
}

/** Lane column width (V1.2 §9.19 C2): fill the container, but never below 44px (clickable) / 36px (overview). */
export function laneColumnWidth(available: number, n: number, overview = false): number {
  const min = overview ? 36 : 44;
  if (!isNum(available) || available <= 0 || n <= 0) return min;
  return Math.max(min, Math.floor((available / n) * 10) / 10);
}

/** Note scale so the biggest note (36px) at 1.14× selection zoom stays within column − 8px. */
export function laneNoteScale(colW: number): number {
  // floor, not round: the note must never end up a fraction of a pixel wider than the rule allows
  return clamp(Math.floor(((colW - 8) / (36 * 1.14)) * 1000) / 1000, 0.3, 1);
}
