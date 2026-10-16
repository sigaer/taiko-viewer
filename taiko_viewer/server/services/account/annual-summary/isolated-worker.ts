import { getTaikoPython } from "~/server/utils/taiko-python";
import { annualTestIsolation } from './test-isolation';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { annualAdmission, type Resource } from './admission';

// These processes never inherit an unbounded production cgroup. Failure to create
// the transient unit is an error, not permission to spawn outside the boundary.
export const spawnAnnualWorker = async (kind: Resource, id: string, config: Record<string, unknown>, timeoutMs: number) => {
  const renderer = kind === 'renderer';
  const executable = renderer ? process.execPath : getTaikoPython();
  const isolation = annualTestIsolation();
  await mkdir(annualAdmission.root, { recursive: true, mode: 0o700 });
  const path = resolve(annualAdmission.root, `${id}.config`);
  const unit = `taiko-annual-${kind}-${id}`;
  const deadline = await annualAdmission.deadline(kind, id);
  const workerTmp = resolve(isolation?.tmp || '/var/tmp/taiko-annual-workers', id);
  await mkdir(workerTmp, { recursive: true, mode: 0o700 });
  const workerDeadline = Math.min(deadline, Date.now() + timeoutMs);
  await writeFile(path, JSON.stringify({ ...config, ...(config.env ? { env: { ...config.env as Record<string, string>, TMPDIR: workerTmp } } : {}), deadlineMs: workerDeadline }), { flag: 'wx', mode: 0o600 });
  const remainingMs = workerDeadline - Date.now();
  if (remainingMs <= 0) { await unlink(path); throw new Error('worker launch deadline expired'); }
  const args = ['--quiet', `--unit=${unit}`, '--wait', '--collect', '--pipe',
    '--working-directory=' + process.cwd(), `--setenv=TMPDIR=${workerTmp}`,
    '-p', `MemoryHigh=${renderer ? '768M' : '1G'}`, '-p', `MemoryMax=${renderer ? '1G' : '1536M'}`,
    '-p', 'MemorySwapMax=128M', '-p', 'TasksMax=256', '-p', 'CPUQuota=200%',
    '-p', `RuntimeMaxSec=${Math.max(1, Math.floor(remainingMs / 1000))}`, '-p', 'TimeoutStopSec=5',
    '-p', 'KillMode=control-group', '-p', 'OOMPolicy=stop', '-p', 'UMask=0077', ...(isolation?.properties || []), '--',
    executable, ...(!renderer ? ['-I'] : []),
    resolve(process.cwd(), 'scripts', renderer ? 'annual_render_worker.mjs' : 'annual_python_worker.py'), path];
  const child = spawn('/usr/bin/systemd-run', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  // The cgroup hard lifetime remains effective even if Viewer dies. Do not kill
  // systemd-run alone and release admission while its workload is still alive.
  child.once('close', () => {
    void unlink(path).catch(() => undefined);
    void rm(workerTmp, { recursive: true, force: true }).catch(() => undefined);
  });
  child.once('error', () => {
    void unlink(path).catch(() => undefined);
    void rm(workerTmp, { recursive: true, force: true }).catch(() => undefined);
  });
  return child;
};

export const stopAnnualWorker = (kind: Resource, id: string) => {
  const control = spawn('/usr/bin/systemctl', ['kill', '--kill-who=all', '--signal=SIGKILL', `taiko-annual-${kind}-${id}.service`], { stdio: 'ignore', timeout: 10_000 });
  // Still await the worker's close event in the caller before releasing its slot.
  control.on('error', () => undefined);
};

export const cleanupAnnualWorkerTemps = async () => {
  const root = annualTestIsolation()?.tmp || '/var/tmp/taiko-annual-workers';
  const activeIds = new Set<string>();
  for (const resource of ['generator', 'renderer'] as const) {
    const ledger = await readFile(resolve(annualAdmission.root, `${resource}.json`), 'utf8')
      .then((raw) => JSON.parse(raw) as Array<{ id?: string; state?: string }>).catch(() => []);
    for (const row of ledger) {
      if (row.id && ['queued', 'running'].includes(String(row.state))) activeIds.add(row.id);
    }
  }
  let removed = 0;
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/i.test(entry.name) || activeIds.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    const info = await stat(path).catch(() => null);
    if (!info || Date.now() - info.mtimeMs < 30 * 60 * 1000) continue;
    const units = [
      `/sys/fs/cgroup/system.slice/taiko-annual-generator-${entry.name}.service`,
      `/sys/fs/cgroup/system.slice/taiko-annual-renderer-${entry.name}.service`
    ];
    if (await Promise.any(units.map((unit) => access(unit))).then(() => true, () => false)) continue;
    await rm(path, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
};
