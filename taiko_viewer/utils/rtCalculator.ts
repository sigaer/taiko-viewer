import type { V2ConstantsItem } from '../types/content';

export type Judgments = { good: number; ok: number; bad: number };
export type AutoJudgment = keyof Judgments | 'manual';
export type V1RtChart = {
  level: number; totalNotes: number; constant: number; constantScore: number;
  complex: number; averageDensity: number; peakDensity: number; separation: number; bpmChange: number;
};
export type RtCalculatorPayload = {
  song: { id: number; title: string; titleJa: string };
  v1: V1RtChart[]; v2: V2ConstantsItem[]; v2Unavailable: boolean;
};
export type RtResult = { accuracy: number; eligible: boolean; rating: number; dimensions: number[] };

/** Pure port of sakura_taiko_core rating.v1/v2 and dimension.v1.
 * V2 uses the center profile (v2-center-20261010), as the Viewer host does.
 * Keep full precision until presentation; parity is checked against installed Core.
 */
export function accuracyScore(a: number): number {
  if (a <= 0.75) return 0;
  if (a <= 0.8278) return 16730 * (a - 0.75) ** 3.805;
  if (a <= 0.9793) return 56.4468 * a - 45.7187;
  const high = (x: number) => 0.2246 * 2.718 ** (120 * (x - 0.972)) + 9.02;
  const lower = high(0.9793);
  return lower + (high(a) - lower) / (high(1) - lower) * (15.5 - lower);
}

export function singleRating(m: number, n: number): number {
  const p = 150 - Math.sqrt(Math.max(150 ** 2 - (m - n) ** 2 / 2, 0));
  const term = 25 - (m - 15.5) ** 2 / 25 - (n - 23) ** 2 / 69;
  const q = Math.max(term < 0 ? 0 : Math.sqrt(term) - 4, 0.5);
  if (Math.abs(p) < 1e-9) return Math.exp(q * Math.log(Math.max(m, 1e-9)) + (1 - q) * Math.log(Math.max(n, 1e-9)));
  return Math.max(q * m ** p + (1 - q) * n ** p, 0) ** (1 / p);
}

export function lookupConstantScore(value: number, table: [number, number][]): number {
  if (!table.length) throw new Error('Empty RT constant table');
  if (value <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [c, s] = table[i];
    if (Math.abs(c - value) < 1e-9) return s;
    if (value < c) {
      const [previous, score] = table[i - 1];
      return score + (value - previous) / (c - previous) * (s - score);
    }
  }
  return table[table.length - 1][1];
}

export function resolveJudgments(total: number, input: Judgments, auto: AutoJudgment): Judgments | null {
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  const result = { ...input };
  const keys = ['good', 'ok', 'bad'] as const;
  for (const key of keys) {
    if (key === auto) continue;
    if (!Number.isSafeInteger(result[key]) || result[key] < 0 || result[key] > total) return null;
  }
  if (auto !== 'manual') result[auto] = total - keys.reduce((sum, key) => sum + (key === auto ? 0 : result[key]), 0);
  return result.good >= 0 && result.ok >= 0 && result.bad >= 0 && result.good + result.ok + result.bad === total ? result : null;
}

const accuracy = (total: number, counts: Judgments) => {
  if (!resolveJudgments(total, counts, 'manual')) throw new Error('Invalid judgment counts');
  return (counts.good + counts.ok * 0.5) / total;
};

export function calculateV1(chart: V1RtChart, counts: Judgments): RtResult {
  const a = accuracy(chart.totalNotes, counts);
  if (a < 0.75) return { accuracy: a, eligible: false, rating: 0, dimensions: [0, 0, 0, 0, 0, 0] };
  const m = chart.constantScore, n = accuracyScore(a), rt = singleRating(m, n);
  const i = chart.averageDensity, j = chart.peakDensity, k = chart.separation, eps = 1e-9;
  const stamina = i <= eps && j <= eps ? 0 : i > j ? i + i / 100 * (1 - j / Math.max(i, eps)) * (100 - i) : i - (1 - i / Math.max(j, eps)) * i;
  const speed = i <= eps && j <= eps ? 0 : j > i ? j - (1 - i / Math.max(j, eps)) * (j - i) : j + (1 - j / Math.max(i, eps)) * (i - j);
  const rhythm = k + k / 100 * (chart.bpmChange / 100) * (100 - k);
  return { accuracy: a, eligible: true, rating: rt,
    dimensions: [m, stamina * 15.5 / 100, speed * 15.5 / 100, n, rhythm * 15.5 / 100, chart.complex * 15.5 / 100].map(value => Math.sqrt(Math.max(rt * value, 0))) };
}

export function calculateV2(chart: V2ConstantsItem, counts: Judgments): RtResult {
  const a = accuracy(chart.totalNotes, counts);
  if (a < 0.75) return { accuracy: a, eligible: false, rating: 0, dimensions: [0, 0, 0, 0, 0, 0] };
  const n = accuracyScore(a), low = chart.subConstant1, main = chart.mainConstant, high = chart.subConstant2;
  const rt90 = singleRating(low, accuracyScore(0.9));
  const rt95ref = singleRating(low, accuracyScore(0.95));
  const rt95 = singleRating(main, accuracyScore(0.95));
  const rt100ref = singleRating(main, accuracyScore(1));
  const rt100 = singleRating(high, accuracyScore(1));
  const initial = singleRating(a <= 0.95 ? low : main, n);
  let rt = initial;
  if (a > 0.9 && a <= 0.95) rt = Math.abs(rt95ref - rt90) < 1e-9 ? rt95 : rt90 + (rt95 - rt90) * (initial - rt90) / (rt95ref - rt90);
  else if (a > 0.95) rt = Math.abs(rt100ref - rt95) < 1e-9 ? rt100 : rt95 + (rt100 - rt95) * (initial - rt95) / (rt100ref - rt95);
  const speed = singleRating(chart.handspeed, n);
  const factor = chart.handspeed > 0 ? Math.min(n / chart.handspeed, 1) : 1;
  const burstCandidate = singleRating(chart.burst, n) * factor;
  let burst = burstCandidate;
  if (burstCandidate > speed) {
    const denominator = chart.burst - chart.handspeed;
    const blend = Math.abs(denominator) < 1e-9 ? (n > chart.handspeed ? 1 : 0) : Math.min(Math.max(n - chart.handspeed, 0) / denominator, 1);
    burst = speed + blend * (burstCandidate - speed);
  }
  return { accuracy: a, eligible: true, rating: rt, dimensions: [
    singleRating(chart.stamina, n), speed, burst,
    Math.min(rt, n) + Math.log(Math.max(rt, n) - Math.min(rt, n) + 1),
    singleRating(chart.rhythm, n) * factor,
    singleRating(chart.complex, n) * (5000 / 9 * Math.max(0.03 - counts.bad / chart.totalNotes, 0) ** 2 + 0.5)
  ] };
}
