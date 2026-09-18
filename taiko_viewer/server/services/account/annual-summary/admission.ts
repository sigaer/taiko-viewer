import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// One host-wide ledger, deliberately independent of cache/version/Node instance.
// flock is kernel-owned: a crashed caller cannot leave the metadata mutex held.
export type Resource = 'generator' | 'renderer';
type Ticket = { id: string; key: string; state: 'queued' | 'running' | 'completed' | 'failed'; created: number; until: number; ready?: boolean; reservations?: number; error?: { statusCode: number; statusMessage: string; code: string } };
type Ledger = Ticket[];
export class AdmissionError extends Error {
  statusCode: number;
  statusMessage: string;
  constructor(public code: string, statusCode = 503) {
    super(code); this.statusCode = statusCode;
    this.statusMessage = code === 'ANNUAL_QUEUE_FULL' ? '年度服务繁忙，请稍后重试' : '年度任务等待超时，请稍后重试';
  }
}
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const log = (resource: Resource, state: string, id: string) => console.info('[annual-admission]', JSON.stringify({ resource, state, id }));

export const withHostFileLock = async <T>(path: string, runner: () => Promise<T>, timeoutSeconds = 5): Promise<T> => {
  const lock = spawn('/usr/bin/flock', ['-x', '-w', String(timeoutSeconds), path, '/bin/sh', '-c', 'printf "ready\\n"; read -r release'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const ended = new Promise<void>(resolve => lock.once('close', () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      lock.once('error', reject);
      lock.once('close', () => reject(new AdmissionError('ANNUAL_ADMISSION_UNAVAILABLE')));
      lock.stdout.once('data', () => resolve());
    });
    return await runner();
  } finally {
    lock.stdin.on('error', () => undefined); lock.stdin.end('release\n'); await ended;
  }
};

export class AnnualAdmission {
  constructor(readonly root: string, readonly ttl = 600_000, readonly poll = 250, readonly retention = 600_000, readonly hasHeadroom: () => Promise<boolean> = async () => true) {}
  private async transaction<T>(resource: Resource, update: (rows: Ledger) => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = join(this.root, `${resource}.json`);
    return withHostFileLock(join(this.root, `${resource}.lock`), async () => {
      const raw = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return '[]'; throw error; });
      const rows = JSON.parse(raw) as Ledger;
      const now = Date.now();
      for (const row of rows) {
        if ((row.state === 'queued' || row.state === 'running') && row.until <= now) {
          const code = row.state === 'queued' ? 'ANNUAL_QUEUE_TIMEOUT' : 'ANNUAL_RUN_TIMEOUT';
          row.state = 'failed'; row.until = now + this.retention;
          row.error = { statusCode: 503, statusMessage: new AdmissionError(code).statusMessage, code };
          log(resource, code, row.id);
        }
      }
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].until <= now) {
          await unlink(join(this.root, `${rows[i].id}.result`)).catch(() => undefined);
          await unlink(join(this.root, `${rows[i].id}.config`)).catch(() => undefined);
          rows.splice(i, 1);
        }
      }
      // Persist expiration even when capacity checks reject the new request.
      let result!: T; let failure: unknown;
      try { result = await update(rows); } catch (error) { failure = error; }
      const temp = `${path}.${randomUUID()}.tmp`;
      try { await writeFile(temp, JSON.stringify(rows), { mode: 0o600, flag: 'wx' }); await rename(temp, path); }
      finally { await unlink(temp).catch(() => undefined); }
      if (failure) throw failure;
      return result;
    });
  }
  async deadline(resource: Resource, id: string): Promise<number> {
    return this.transaction(resource, async rows => {
      const row = rows.find(row => row.id === id && row.state === 'running');
      if (!row || row.until - Date.now() < 15_000) throw new AdmissionError('ANNUAL_RUN_TIMEOUT');
      return row.until - 15_000;
    });
  }
  async reserve(resource: Resource, key: string): Promise<string> {
    return this.transaction(resource, async rows => {
      const existing = rows.find(row => row.key === hash(key) && (row.state === 'queued' || row.state === 'running'));
      if (existing) { existing.reservations = (existing.reservations || 1) + 1; return existing.id; } // Dedup BEFORE capacity, including a full queue.
      const cap = resource === 'generator' ? 20 : 8;
      if (rows.filter(row => row.state === 'queued').length >= cap) {
        log(resource, 'rejected', 'capacity'); throw new AdmissionError('ANNUAL_QUEUE_FULL', 429);
      }
      const id = randomUUID();
      rows.push({ id, key: hash(key), state: 'queued', created: Date.now(), until: Date.now() + this.ttl, reservations: 1 });
      log(resource, 'queued', id); return id;
    });
  }
  async cancel(resource: Resource, id: string) {
    await this.transaction(resource, async rows => {
      const row = rows.find(row => row.id === id);
      if (row?.state === 'queued') row.reservations = Math.max(0, (row.reservations || 1) - 1);
      if (row?.state === 'queued' && row.reservations === 0) { row.state = 'failed'; row.until = Date.now() + this.retention; row.error = { code: 'ANNUAL_CANCELLED', statusCode: 503, statusMessage: '年度任务已取消' }; }
    });
  }
  async run<T>(resource: Resource, key: string, runtimeMs: number, runner: (id: string) => Promise<T>, options: { ticket?: string; onRunning?: () => Promise<void> } = {}): Promise<T> {
    const id = options.ticket || await this.reserve(resource, key);
    for (;;) {
      const state = await this.transaction(resource, async rows => {
        const row = rows.find(row => row.id === id && row.key === hash(key));
        if (!row) throw new AdmissionError('ANNUAL_QUEUE_TIMEOUT');
        if (row.state === 'queued') row.ready = true;
        if (row.state === 'queued' && !rows.some(item => item.state === 'running') && rows.find(item => item.state === 'queued' && item.ready)?.id === id && await this.hasHeadroom()) {
          row.state = 'running';
          // Worker MUST have a shorter hard cgroup lifetime, including cleanup.
          row.until = Date.now() + runtimeMs + 30_000;
          log(resource, 'running', id); return { owner: true, row };
        }
        return { owner: false, row };
      });
      if (state.owner) {
        try {
          await options.onRunning?.();
          const result = await runner(id);
          const resultPath = join(this.root, `${id}.result`);
          await writeFile(resultPath, JSON.stringify(result), { mode: 0o600, flag: 'wx' });
          await this.transaction(resource, async rows => {
            const row = rows.find(row => row.id === id);
            if (!row || row.state !== 'running') throw new AdmissionError('ANNUAL_RUN_TIMEOUT');
            row.state = 'completed'; row.until = Date.now() + this.retention;
          });
          log(resource, 'completed', id); return result;
        } catch (error: any) {
          await this.transaction(resource, async rows => {
            const row = rows.find(row => row.id === id);
            if (row?.state === 'running') {
              row.state = 'failed'; row.until = Date.now() + this.retention;
              row.error = { statusCode: Number(error?.statusCode) || 500, statusMessage: String(error?.statusMessage || '年度任务执行失败').slice(0, 200), code: String(error?.code || 'ANNUAL_RUN_FAILED').slice(0, 80) };
            }
          });
          log(resource, error?.code === 'ANNUAL_RUN_TIMEOUT' ? 'timeout' : 'failed', id); throw error;
        }
      }
      if (state.row.state === 'failed') throw Object.assign(new Error(state.row.error?.code), state.row.error);
      if (state.row.state === 'completed') {
        await options.onRunning?.();
        return JSON.parse(await readFile(join(this.root, `${id}.result`), 'utf8')) as T;
      }
      await sleep(this.poll);
    }
  }
}
const hasAnnualHeadroom = async () => {
  const buildTasks = await readFile('/sys/fs/cgroup/development.slice/development-build.slice/pids.current', 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return '0'; throw error; });
  if (Number(buildTasks) > 0) return false;
  const mem = await readFile('/proc/meminfo', 'utf8');
  const value = (name: string) => Number(mem.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1] || 0);
  const psi = await readFile('/proc/pressure/memory', 'utf8');
  const full = Number(psi.match(/full avg10=([\d.]+)/)?.[1] ?? Infinity);
  // Reserve 30% physical RAM plus both worker maxima and Node overhead before
  // starting either domain. Distinct domain locks may admit 1 + 1 together.
  return value('MemTotal') > 0 && value('MemAvailable') >= value('MemTotal') * 0.30 + 3 * 1024 * 1024 && full < 2;
};
export const annualAdmission = new AnnualAdmission(process.env.TAIKO_ANNUAL_ADMISSION_DIR || '/var/lib/taiko/annual-admission', 600_000, 500, 600_000, hasAnnualHeadroom);
