import { readdir, stat, statfs } from "node:fs/promises";
import { resolve } from "node:path";

export const ANNUAL_DURABLE_QUEUE_TTL_SECONDS = 600;
export const ANNUAL_DURABLE_QUEUE_COUNT_LIMIT = 300;
// Phase 5A observed 102.88 jobs/min for the real mix. 270 queued worker-seconds
// is roughly 4.5 minutes of serial work (2.25 minutes at N=2), leaving a wide
// margin below the finite 10 minute queue TTL without accepting an unbounded
// heavy-tail backlog.
export const ANNUAL_DURABLE_QUEUE_WORK_SECONDS = 270;
export const ANNUAL_BUILD_LEASE_SECONDS = 45;
export const ANNUAL_BUILD_HEARTBEAT_SECONDS = 10;
export const ANNUAL_BUILD_MAX_ATTEMPTS = 3;

const GIB = 1024 ** 3;
export const ANNUAL_DISK_LOW_BYTES = 28 * GIB;
export const ANNUAL_DISK_CRITICAL_BYTES = 22 * GIB;
export const ANNUAL_DISK_EMERGENCY_BYTES = 20 * GIB;

export type AnnualDiskLevel = "NORMAL" | "LOW" | "CRITICAL" | "EMERGENCY";

export const classifyAnnualDisk = (availableBytes: number): AnnualDiskLevel => {
  if (availableBytes < ANNUAL_DISK_EMERGENCY_BYTES) return "EMERGENCY";
  if (availableBytes < ANNUAL_DISK_CRITICAL_BYTES) return "CRITICAL";
  if (availableBytes < ANNUAL_DISK_LOW_BYTES) return "LOW";
  return "NORMAL";
};

export const getAnnualDiskState = async (path: string) => {
  const value = await statfs(path);
  const availableBytes = value.bavail * value.bsize;
  return {
    level: classifyAnnualDisk(availableBytes),
    availableBytes,
    optionalCacheWrites: availableBytes >= ANNUAL_DISK_LOW_BYTES,
    acceptsNewBuilds: availableBytes >= ANNUAL_DISK_CRITICAL_BYTES
  };
};

const bucketSeconds = (snapshotCount: number) => {
  if (snapshotCount <= 5) return 0.9;
  if (snapshotCount <= 20) return 1.4;
  if (snapshotCount <= 50) return 1.7;
  if (snapshotCount <= 100) return 2.5;
  if (snapshotCount <= 250) return 8.7;
  return 30.1;
};

export type AnnualBuildCost = {
  snapshotCount: number;
  sourceCount: number;
  totalSourceBytes: number;
  largestSourceBytes: number;
  estimatedServiceSeconds: number;
};

export const estimateAnnualBuildCost = async (userdataDir: string, taikoId: string): Promise<AnnualBuildCost> => {
  const historyRoot = resolve(userdataDir, taikoId);
  const historyNames = (await readdir(historyRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  })).filter((name) => name.startsWith("data_") && name.endsWith(".json"));
  const paths = [resolve(userdataDir, `${taikoId}data.json`), ...historyNames.map((name) => resolve(historyRoot, name))];
  const sizes = (await Promise.all(paths.map(async (path) => {
    const info = await stat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    return info?.isFile() ? info.size : null;
  }))).filter((value): value is number => value !== null);
  const totalSourceBytes = sizes.reduce((sum, size) => sum + size, 0);
  const snapshotCount = historyNames.length;
  const byteFloor = 0.5 + totalSourceBytes / (12 * 1024 * 1024);
  return {
    snapshotCount,
    sourceCount: sizes.length,
    totalSourceBytes,
    largestSourceBytes: sizes.length ? Math.max(...sizes) : 0,
    estimatedServiceSeconds: Math.min(60, Math.max(bucketSeconds(snapshotCount), byteFloor))
  };
};

export const durableQueueWouldAccept = (input: {
  queuedCount: number;
  queuedWorkSeconds: number;
  estimatedServiceSeconds: number;
}) => input.queuedCount < ANNUAL_DURABLE_QUEUE_COUNT_LIMIT
  && input.queuedWorkSeconds + input.estimatedServiceSeconds <= ANNUAL_DURABLE_QUEUE_WORK_SECONDS;

export const simulateAnnualAdmission = (serviceSeconds: number[]) => {
  let queuedCount = 0;
  let queuedWorkSeconds = 0;
  let accepted = 0;
  let rejected = 0;
  for (const estimatedServiceSeconds of serviceSeconds) {
    if (durableQueueWouldAccept({ queuedCount, queuedWorkSeconds, estimatedServiceSeconds })) {
      queuedCount += 1;
      queuedWorkSeconds += estimatedServiceSeconds;
      accepted += 1;
    } else {
      rejected += 1;
    }
  }
  return { accepted, rejected, queuedCount, queuedWorkSeconds };
};

export const simulateAnnualQueueArrivals = (jobs: Array<{ arrivalSeconds: number; serviceSeconds: number }>) => {
  const lanes = [0, 0];
  const acceptedJobs: Array<{ start: number; finish: number; serviceSeconds: number; wait: number }> = [];
  let accepted = 0;
  let rejected = 0;
  let maxQueueDepth = 0;
  for (const job of jobs) {
    const queued = acceptedJobs.filter((item) => item.start > job.arrivalSeconds);
    const queuedWorkSeconds = queued.reduce((sum, item) => sum + item.serviceSeconds, 0);
    if (!durableQueueWouldAccept({
      queuedCount: queued.length,
      queuedWorkSeconds,
      estimatedServiceSeconds: job.serviceSeconds
    })) {
      rejected += 1;
      continue;
    }
    const lane = lanes[0] <= lanes[1] ? 0 : 1;
    const start = Math.max(job.arrivalSeconds, lanes[lane]);
    const finish = start + job.serviceSeconds;
    lanes[lane] = finish;
    acceptedJobs.push({ start, finish, serviceSeconds: job.serviceSeconds, wait: start - job.arrivalSeconds });
    accepted += 1;
    maxQueueDepth = Math.max(maxQueueDepth, queued.length + Number(start > job.arrivalSeconds));
  }
  const waits = acceptedJobs.map((job) => job.wait).sort((left, right) => left - right);
  const percentile = (ratio: number) => waits.length ? waits[Math.min(waits.length - 1, Math.ceil(waits.length * ratio) - 1)] : 0;
  return {
    accepted,
    rejected,
    maxQueueDepth,
    p50WaitSeconds: percentile(0.5),
    p95WaitSeconds: percentile(0.95),
    maxWaitSeconds: waits.at(-1) || 0,
    expired: waits.filter((wait) => wait >= ANNUAL_DURABLE_QUEUE_TTL_SECONDS).length,
    lastCompletionSeconds: Math.max(...lanes)
  };
};
