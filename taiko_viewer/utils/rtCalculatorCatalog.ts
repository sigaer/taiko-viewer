import type { RatingContentItem } from '../types/content';
import type { V1RtChart } from './rtCalculator';
import { lookupConstantScore } from './rtCalculator.ts';

export type Entry = RatingContentItem & { score?: unknown };
export type RatingConfig = { songs?: Record<string, Entry> | Entry[]; const_table?: { const_to_score?: Record<string, number> } };

export function buildV1RtCharts(config: RatingConfig, songId: number): V1RtChart[] {
  const table = Object.entries(config.const_table?.const_to_score || {})
    .map(([constant, score]): [number, number] => [Number(constant), Number(score)])
    .filter(([constant, score]) => Number.isFinite(constant) && Number.isFinite(score) && score >= 0)
    .sort((a, b) => a[0] - b[0]);
  if (!table.length) return [];
  const rows = Object.values(config.songs || {});
  return rows.flatMap(row => {
    const level = Number(row.level), totalNotes = Number(row.combo), constant = Number(row.score);
    if (Number(row.id) !== songId || ![4, 5].includes(level) || !Number.isSafeInteger(totalNotes) || totalNotes <= 0 || row.score === null || row.score === undefined || !Number.isFinite(constant) || constant < 0) return [];
    const metric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
    return [{ level, totalNotes, constant, constantScore: lookupConstantScore(constant, table),
      complex: metric(row['复合处理']), averageDensity: metric(row['平均密度']), peakDensity: metric(row['瞬间密度']),
      separation: metric(row['叩き分け']), bpmChange: metric(row['BPM变化']) }];
  });
}

