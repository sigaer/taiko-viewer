import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { annualAdmission, withHostFileLock } from './admission';

export type AnnualOperationalEvent = 'rejected' | 'expired' | 'worker_oom' | 'launcher_failure' | 'db_queue_failure';
type Counters = { since: string; values: Record<AnnualOperationalEvent, number>; lastAt: Partial<Record<AnnualOperationalEvent, string>> };
const emptyCounters = (): Counters => ({
  since: new Date().toISOString(),
  values: { rejected: 0, expired: 0, worker_oom: 0, launcher_failure: 0, db_queue_failure: 0 },
  lastAt: {}
});

const writeCounters = async (path: string, value: Counters) => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  try { await rename(temporary, path); } finally { await unlink(temporary).catch(() => undefined); }
};

export const recordAnnualOperationalEvent = async (event: AnnualOperationalEvent) => {
  await mkdir(annualAdmission.root, { recursive: true, mode: 0o700 });
  const path = resolve(annualAdmission.root, 'counters.json');
  await withHostFileLock(resolve(annualAdmission.root, 'counters.lock'), async () => {
    const counters = await readFile(path, 'utf8').then((raw) => JSON.parse(raw) as Counters).catch(() => emptyCounters());
    counters.lastAt ||= {};
    counters.values[event] = Math.max(0, Number(counters.values[event] || 0)) + 1;
    counters.lastAt[event] = new Date().toISOString();
    await writeCounters(path, counters);
  });
};

export const readAnnualOperationalCounters = async () => {
  const path = resolve(annualAdmission.root, 'counters.json');
  return readFile(path, 'utf8').then((raw) => JSON.parse(raw) as Counters).catch(() => emptyCounters());
};
