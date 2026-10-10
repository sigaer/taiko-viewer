import { createFileScoreReader } from '../../domain/file-score-reader.ts';
import type { GrowthMeasurement } from '../../../types/player-growth.ts';
import { growthCalendarDay } from '../../../utils/playerGrowth.ts';

const dimensionNames = { big_song: '大歌力', stamina: '体力', speed: '高速处理', accuracy_power: '精度力', rhythm: '节奏处理', complex: '复合处理' } as const;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// Shared with the authoritative bot snapshot writer. The request path only
// reads final values; it never replays snapshots or computes historical skills.
export async function readDailyAbilityArchive(userdataDir: string, taikoId: string, userId: number, bindingId: number, from: string, to: string): Promise<GrowthMeasurement[]> {
  if (!/^[A-Za-z0-9_-]+$/.test(taikoId)) throw new Error('Invalid daily ability identity');
  const payload = await createFileScoreReader(userdataDir, () => '').readDailyAbility(taikoId) as Record<string, any> | undefined;
  if (payload === undefined) return [];
  if (payload.version !== 1 || payload.namespace !== 'v1-top20' || !payload.days || typeof payload.days !== 'object') throw new Error('Invalid daily ability archive');
  return Object.entries(payload.days).flatMap(([day, value]) => {
    if (day < from || day > to || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
    const row = value as Record<string, any>;
    if (!row || typeof row.capturedAt !== 'string' || !Number.isFinite(Date.parse(row.capturedAt)) || growthCalendarDay(row.capturedAt) !== day || !finite(row.rating) || !Number.isInteger(row.sampleCount) || row.sampleCount < 1) throw new Error('Invalid daily ability point');
    const dimensions = Object.fromEntries(Object.entries(dimensionNames).map(([key, name]) => [key, row.dimensions?.[name]])) as GrowthMeasurement['dimensions'];
    if (!Object.values(dimensions).every(finite)) throw new Error('Invalid daily ability dimensions');
    const sorted = Object.entries(dimensions).sort((a, b) => a[1]! - b[1]!);
    const focus = row.sampleCount < 20 ? 'limited' : sorted.every(item => Math.abs(item[1]! - sorted[0]![1]!) <= 1e-6) ? 'balanced' : sorted[0]![0];
    return [{ id: `daily:${day}`, ownerId: String(userId), bindingId: String(bindingId), capturedAt: new Date(row.capturedAt).toISOString(),
      scoreRevision: `daily:${day}`, measurementVersion: 1, algorithmVersion: 'daily-v1', modelRevision: null,
      rating: row.rating, dimensions, focus: focus as GrowthMeasurement['focus'], sampleCount: row.sampleCount,
      availabilityState: row.sampleCount < 20 ? 'limited' : 'ready' } satisfies GrowthMeasurement];
  }).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export function mergeDailyAbilityMeasurements(measurements: GrowthMeasurement[], archive: GrowthMeasurement[], today: string) {
  const days = new Map(archive.map(row => [growthCalendarDay(row.capturedAt), row]));
  // Existing Viewer records remain authoritative for past days. A newer
  // snapshot may update today's representative, never a past recorded value.
  for (const row of measurements) {
    const day = growthCalendarDay(row.capturedAt), previous = days.get(day);
    if (!previous || day !== today || row.capturedAt >= previous.capturedAt) days.set(day, row);
  }
  return [...days.values()].sort((a,b) => a.capturedAt.localeCompare(b.capturedAt));
}
