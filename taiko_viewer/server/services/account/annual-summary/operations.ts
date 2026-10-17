import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { annualAdmission } from "./admission";
import { ANNUAL_DURABLE_QUEUE_WORK_SECONDS } from "./hardening";
import { getAnnualQueueMetrics } from "./repository";
import { getAnnualCacheRoot, readAnnualDiskState } from "./runtime";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import { readAnnualOperationalCounters } from './telemetry';

const directoryBytes = async (root: string): Promise<number> => {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(path);
    else if (entry.isFile()) total += (await stat(path).catch(() => null))?.size || 0;
  }
  return total;
};

let storageMemo: { at: number; value: { normalizedCache: number; summaries: number; posters: number; workerTemps: number } } | null = null;
const readStorageBytes = async () => {
  if (storageMemo && Date.now() - storageMemo.at < 15 * 60_000) return storageMemo.value;
  const value = {
    normalizedCache: await directoryBytes(resolve(getAnnualCacheRoot(), 'normalized')),
    summaries: await directoryBytes(resolve(getAnnualCacheRoot(), 'summaries')),
    posters: await directoryBytes(resolve(getAnnualCacheRoot(), 'posters')),
    workerTemps: await directoryBytes('/var/tmp/taiko-annual-workers')
  };
  storageMemo = { at: Date.now(), value };
  return value;
};

const readHostPressure = async () => {
  const [meminfo, memoryPsi, ioPsi] = await Promise.all([
    readFile('/proc/meminfo', 'utf8'),
    readFile('/proc/pressure/memory', 'utf8'),
    readFile('/proc/pressure/io', 'utf8')
  ]);
  const memAvailableKiB = Number(meminfo.match(/^MemAvailable:\s+(\d+)/m)?.[1] || 0);
  const fullAvg10 = (value: string) => Number(value.match(/full avg10=([\d.]+)/)?.[1] || 0);
  return { memAvailableKiB, memoryPsiFullAvg10: fullAvg10(memoryPsi), ioPsiFullAvg10: fullAvg10(ioPsi) };
};

export const collectAnnualOperationalMetrics = async () => {
  await ensureAccountSchema("annual");
  const [queue, disk, pressure, statusResult, syncResult, bytes, counters] = await Promise.all([
    getAnnualQueueMetrics(),
    readAnnualDiskState(),
    readHostPressure(),
    getAccountDb().query<DbRow<Record<string, unknown>>[]>(
      `SELECT
         SUM(job_type='build' AND status='running') AS generator_running,
         SUM(job_type='poster' AND status='running') AS renderer_running,
         SUM(job_type='build' AND status='completed' AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)) AS builds_completed_24h,
         SUM(job_type='build' AND status IN ('failed','expired') AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)) AS builds_failed_24h,
         SUM(job_type='build' AND status='completed' AND job_key IS NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)) AS cache_hits_24h,
         SUM(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)
             AND TIMESTAMPDIFF(SECOND,started_at,completed_at)<2) AS duration_lt_2s,
         SUM(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)
             AND TIMESTAMPDIFF(SECOND,started_at,completed_at) BETWEEN 2 AND 4) AS duration_2_5s,
         SUM(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)
             AND TIMESTAMPDIFF(SECOND,started_at,completed_at) BETWEEN 5 AND 14) AS duration_5_15s,
         SUM(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)
             AND TIMESTAMPDIFF(SECOND,started_at,completed_at) BETWEEN 15 AND 29) AS duration_15_30s,
         SUM(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)
             AND TIMESTAMPDIFF(SECOND,started_at,completed_at)>=30) AS duration_gte_30s,
         AVG(IF(job_type='build' AND status='completed' AND job_key IS NOT NULL AND completed_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR),
                TIMESTAMPDIFF(MICROSECOND,started_at,completed_at)/1000000,NULL)) AS cold_duration_avg_seconds
       FROM web_annual_summary_jobs`
    ),
    getAccountDb().query<DbRow<Record<string, unknown>>[]>(
      `SELECT COUNT(*) AS syncs_24h,
              SUM(EXISTS(SELECT 1 FROM web_annual_summary_jobs j
                         WHERE j.user_id=s.user_id AND j.job_type='build'
                           AND j.created_at BETWEEN s.created_at AND DATE_ADD(s.created_at,INTERVAL 15 MINUTE))) AS syncs_followed_by_annual_15m,
              AVG((SELECT TIMESTAMPDIFF(SECOND,s.created_at,j.created_at) FROM web_annual_summary_jobs j
                   WHERE j.user_id=s.user_id AND j.job_type='build'
                     AND j.created_at BETWEEN s.created_at AND DATE_ADD(s.created_at,INTERVAL 15 MINUTE)
                   ORDER BY j.created_at LIMIT 1)) AS sync_to_annual_avg_seconds
       FROM web_data_sync_logs s WHERE s.created_at >= DATE_SUB(NOW(),INTERVAL 24 HOUR)`
    ),
    readStorageBytes(),
    readAnnualOperationalCounters()
  ]);
  const status = statusResult[0][0] || {};
  const sync = syncResult[0][0] || {};
  const oldestQueuedAgeSeconds = queue.oldestQueuedAt
    ? Math.max(0, (Date.now() - new Date(queue.oldestQueuedAt).getTime()) / 1000)
    : 0;
  const metrics = {
    generatedAt: new Date().toISOString(),
    queue: { ...queue, oldestQueuedAgeSeconds },
    jobs: Object.fromEntries(Object.entries(status).map(([key, value]) => [key, Number(value || 0)])),
    counters,
    syncCorrelation: Object.fromEntries(Object.entries(sync).map(([key, value]) => [key, Number(value || 0)])),
    disk,
    bytes,
    host: pressure
  };
  const recentEvent = (key: keyof typeof counters.values) => {
    const value = counters.lastAt?.[key];
    return Boolean(value && Date.now() - new Date(value).getTime() < 10 * 60_000);
  };
  const alerts = [
    ...(queue.queuedWorkSeconds >= ANNUAL_DURABLE_QUEUE_WORK_SECONDS * 0.8 ? ['queue_work_80pct'] : []),
    ...(oldestQueuedAgeSeconds >= 480 ? ['oldest_queue_8m'] : []),
    ...(disk.level !== 'NORMAL' ? [`disk_${disk.level.toLowerCase()}`] : []),
    ...(pressure.memoryPsiFullAvg10 >= 2 ? ['memory_psi_full'] : []),
    ...(bytes.normalizedCache > 6 * 1024 ** 3 ? ['normalized_cache_over_quota'] : []),
    ...(bytes.workerTemps > 512 * 1024 ** 2 ? ['annual_temp_growth'] : []),
    ...(recentEvent('worker_oom') ? ['worker_oom'] : []),
    ...(recentEvent('launcher_failure') ? ['launcher_failure'] : []),
    ...(recentEvent('db_queue_failure') ? ['db_queue_failure'] : []),
    ...(Number(status.generator_running || 0) > 2 ? ['generator_limit'] : []),
    ...(Number(status.renderer_running || 0) > 1 ? ['renderer_limit'] : [])
  ];
  if (alerts.length) console.warn('[annual-summary] operational alerts', alerts);
  await mkdir(annualAdmission.root, { recursive: true, mode: 0o700 });
  const target = resolve(annualAdmission.root, 'metrics.json');
  const temporary = `${target}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify({ ...metrics, alerts })}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try { await rename(temporary, target); } finally { await unlink(temporary).catch(() => undefined); }
  return { ...metrics, alerts };
};
