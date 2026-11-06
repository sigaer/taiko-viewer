import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createError } from 'h3';
import type { TjaResult } from '../../../types/tja-calculator';

const cache = new Map<string, { expires: number; result: TjaResult }>();
let active = false;
export const calculatorError = (code: string, statusCode = 422) => createError({ statusCode, statusMessage: 'TJA calculation failed', data: { code } });

export async function calculateTja(bytes: Buffer, encoding: string): Promise<TjaResult> {
  const key = createHash('sha256').update(encoding).update(bytes).digest('hex');
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  if (active) throw calculatorError('busy', 503);
  active = true;
  // The fixed unit name is host-wide admission, including across Viewer replicas.
  // The service lifetime kills descendants even if the HTTP process disappears.
  const runtime = resolve(process.cwd(), process.env.NODE_ENV === 'production' ? '.output/server/tja-runtime' : '.tja-runtime');
  try {
    const result = await new Promise<TjaResult>((accept, reject) => {
      const child = execFile('/usr/bin/systemd-run', [
        '--quiet', '--pipe', '--wait', '--collect', '--unit=taiko-tja-calculator',
        '-p', 'MemoryHigh=384M', '-p', 'MemoryMax=512M', '-p', 'MemorySwapMax=0',
        '-p', 'CPUQuota=100%', '-p', 'TasksMax=32', '-p', 'RuntimeMaxSec=25',
        '-p', 'TimeoutStopSec=2', '-p', 'KillMode=control-group', '-p', 'OOMPolicy=stop',
        '-p', 'PrivateNetwork=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=read-only',
        '-p', 'NoNewPrivileges=yes', '-p', 'PrivateTmp=yes',
        '--setenv=PYTHONDONTWRITEBYTECODE=1',
        '/usr/bin/python3', '-B', resolve(runtime, 'calculate.py'), process.execPath, encoding
      ], { timeout: 30_000, maxBuffer: 128 * 1024, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } }, (error, stdout) => {
        if (error) return reject(calculatorError(error.killed ? 'timeout' : 'unavailable', 503));
        try {
          const payload = JSON.parse(stdout);
          if (payload.error) return reject(calculatorError(payload.error, payload.error === 'timeout' ? 504 : 422));
          if (!Array.isArray(payload.charts) || !payload.charts.length) throw new Error('invalid result');
          accept(payload);
        } catch { reject(calculatorError('unavailable', 503)); }
      });
      child.stdin?.on('error', () => {});
      child.stdin?.end(bytes);
    });
    for (const [hash, entry] of cache) if (entry.expires <= Date.now()) cache.delete(hash);
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(key, { result, expires: Date.now() + 5 * 60_000 });
    return result;
  } finally { active = false; }
}
