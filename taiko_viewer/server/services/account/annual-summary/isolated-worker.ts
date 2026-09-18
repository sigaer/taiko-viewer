import { spawn } from 'node:child_process';
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { annualAdmission, type Resource } from './admission';

// These processes never inherit an unbounded production cgroup. Failure to create
// the transient unit is an error, not permission to spawn outside the boundary.
export const spawnAnnualWorker = async (kind: Resource, id: string, config: Record<string, unknown>, timeoutMs: number) => {
  await mkdir(annualAdmission.root, { recursive: true, mode: 0o700 });
  const path = resolve(annualAdmission.root, `${id}.config`);
  const unit = `taiko-annual-${kind}-${id}`;
  const renderer = kind === 'renderer';
  const deadline = await annualAdmission.deadline(kind, id);
  const workerTmp = resolve('/var/tmp/taiko-annual-workers', id);
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
    '-p', 'KillMode=control-group', '-p', 'OOMPolicy=stop', '-p', 'UMask=0077', '--',
    renderer ? process.execPath : '/usr/bin/python3',
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
