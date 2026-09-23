import { annualAdmission, AdmissionError, withHostFileLock } from './admission';
import { spawnAnnualWorker, stopAnnualWorker } from './isolated-worker';
import { annualBuildInputRevision } from './build-recovery';
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  unlink
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createError } from "h3";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import { getRuntimePaths } from "~/server/internal/account/shared";
import {
  ANNUAL_ALGORITHM_VERSION,
  ANNUAL_BUILD_TIMEOUT_MS,
  ANNUAL_RATING_TIMEOUT_MS,
  ANNUAL_SCHEMA_VERSION,
  ANNUAL_VERSION_KEY,
  ANNUAL_PRODUCER_REVISION,
  ANNUAL_REPORTING_WINDOW,
  getAnnualGeneratorVersion,
  getAnnualVersion
} from "./constants";
import type { AnnualCliEnvelope, AnnualObservationEvent, AnnualSummaryV4 } from "./types";
import { ANNUAL_DISK_LOW_BYTES, getAnnualDiskState } from "./hardening";

const CACHE_ROOT_SEGMENT = "annual-summary-v4";
const NORMALIZED_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NORMALIZED_CACHE_HIGH_BYTES = 6 * 1024 * 1024 * 1024;
const NORMALIZED_CACHE_TARGET_BYTES = 5 * 1024 * 1024 * 1024;
const MIN_CACHE_FREE_BYTES = ANNUAL_DISK_LOW_BYTES;
let annualCacheCleanupPromise: Promise<AnnualCacheCleanupStats> | null = null;

export type AnnualCacheCleanupStats = {
  scannedFiles: number;
  removedFiles: number;
  releasedBytes: number;
  beforeBytes: number;
  afterBytes: number;
  freeBytesBefore: number;
  freeBytesAfter: number;
  durationMs: number;
  errors: number;
};

const safeMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const value = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
  const stderr = Buffer.isBuffer(value.stderr) ? value.stderr.toString("utf-8") : String(value.stderr || "");
  const stdout = Buffer.isBuffer(value.stdout) ? value.stdout.toString("utf-8") : String(value.stdout || "");
  return (stderr || stdout || String(value.message || "")).trim().slice(0, 2000);
};

const isMissingHistoryError = (message: string) =>
  /no snapshots|no comparable|missing (?:current )?userdata|not found.*snapshot/i.test(message);

export const getAnnualCacheRoot = () => {
  const { cacheDir } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  return resolve(
    String(runtimeConfig.annualCacheDir || process.env.TAIKO_ANNUAL_CACHE_DIR || resolve(cacheDir, CACHE_ROOT_SEGMENT))
  );
};

export const ensureWithinAnnualCache = (filePath: string) => {
  const root = getAnnualCacheRoot();
  const normalized = resolve(filePath);
  if (normalized !== root && !normalized.startsWith(`${root}${sep}`)) {
    throw createError({ statusCode: 500, statusMessage: "年度总结缓存路径无效" });
  }
  return normalized;
};

export const getAnnualSummaryPaths = (userId: number, bindingId: number, summaryId: string) => {
  const ownerKey = createHash("sha256").update(`${userId}:${bindingId}`).digest("hex").slice(0, 24);
  const dir = resolve(getAnnualCacheRoot(), "summaries", ownerKey, ANNUAL_VERSION_KEY, summaryId);
  return {
    dir,
    summaryPath: join(dir, "summary.json"),
    eventsPath: join(dir, "events.json")
  };
};

export const getAnnualPosterPath = (shareId: string, posterId: string, locale: string) =>
  resolve(getAnnualCacheRoot(), "posters", shareId, `${posterId}.${locale}.png`);

const ensurePrivateDir = async (path: string) => {
  await mkdir(ensureWithinAnnualCache(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o700).catch(() => undefined);
};

export const atomicWriteFile = async (filePath: string, content: string | Buffer) => {
  const target = ensureWithinAnnualCache(filePath);
  await ensurePrivateDir(dirname(target));
  const temp = join(dirname(target), `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(temp, "wx", 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temp, target);
    await chmod(target, 0o600).catch(() => undefined);
    const directory = await open(dirname(target), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temp).catch(() => undefined);
  }
};

export const readAnnualDiskState = () => getAnnualDiskState(getAnnualCacheRoot());

export const atomicWriteJson = (filePath: string, value: unknown) =>
  atomicWriteFile(filePath, `${JSON.stringify(value)}\n`);

export const readAnnualJson = async <T>(filePath: string): Promise<T> => {
  const target = ensureWithinAnnualCache(filePath);
  const raw = await readFile(target, "utf-8");
  return JSON.parse(raw) as T;
};

export const removeAnnualPath = async (filePath: string) => {
  const target = ensureWithinAnnualCache(filePath);
  await rm(target, { recursive: true, force: true });
};

export const withAnnualFileLock = async <T>(lockKey: string, runner: () => Promise<T>): Promise<T> => {
  const lockDir = resolve(getAnnualCacheRoot(), 'locks');
  await ensurePrivateDir(lockDir);
  const safeKey = createHash('sha256').update(lockKey).digest('hex');
  return withHostFileLock(join(lockDir, `${safeKey}.lock`), runner, 25 * 60);
};

const addFileToHash = async (hash: ReturnType<typeof createHash>, filePath: string, label: string) => {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return;
  hash.update(`\0${label}\0${fileStat.size}\0`);
  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectStream);
    stream.on("end", resolveStream);
  });
};

const listDirectoryFiles = async (root: string, accepted: (path: string) => boolean): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const output: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) output.push(...(await listDirectoryFiles(path, accepted)));
    else if (entry.isFile() && accepted(path)) output.push(path);
  }
  return output;
};

const addDirectoryToHash = async (
  hash: ReturnType<typeof createHash>,
  root: string,
  label: string,
  accepted: (path: string) => boolean
) => {
  const files = await listDirectoryFiles(root, accepted);
  for (const path of files) {
    await addFileToHash(hash, path, `${label}/${relative(root, path)}`);
  }
};

export const getAnnualInputFingerprint = async (taikoId: string) => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  const songDataPath = resolve(String(runtimeConfig.songDataPath || resolve(repoRoot, "songs", "song_data.json")));
  const ratingPath = resolve(
    String(runtimeConfig.ratingStructPath || resolve(repoRoot, "songs", "rating_structured_with_ids.json"))
  );
  const currentPath = resolve(userdataDir, `${taikoId}data.json`);
  try {
    await access(currentPath);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "未找到成绩数据，请先完成同步" });
  }

  const hash = createHash("sha256");
  hash.update(JSON.stringify({
    producer: ANNUAL_PRODUCER_REVISION,
    schema: ANNUAL_SCHEMA_VERSION,
    version: ANNUAL_VERSION_KEY,
    reportingWindow: ANNUAL_REPORTING_WINDOW
  }));
  await addFileToHash(hash, currentPath, "current-userdata");

  const historyDir = resolve(userdataDir, taikoId);
  const names = (await readdir(historyDir).catch(() => []))
    .filter((name) => name.startsWith("data_") && name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    await addFileToHash(hash, resolve(historyDir, name), `history/${name}`);
  }
  await addFileToHash(hash, songDataPath, "song-data");
  await addFileToHash(hash, ratingPath, "rating-data");
  await addDirectoryToHash(
    hash,
    resolve(repoRoot, "plugins", "utils", "annual_summary"),
    "annual-algorithm",
    (path) => path.endsWith(".py")
  );
  await addFileToHash(hash, resolve(repoRoot, "schemas", "annual-summary-v4.schema.json"), "annual-schema");
  await addFileToHash(hash, resolve(process.cwd(), "package.json"), "viewer-package");
  await addFileToHash(hash, resolve(process.cwd(), "public", "logo.png"), "viewer-logo");
  await addFileToHash(
    hash,
    resolve(process.cwd(), "public", "assets", "my-don", "title-plate-slices", "manifest.json"),
    "my-don-assets-manifest"
  );
  for (const componentDir of ["annual-summary", "version-summary"]) {
    await addDirectoryToHash(
      hash,
      resolve(process.cwd(), "components", "account", componentDir),
      `viewer-components/${componentDir}`,
      (path) => /\.(?:vue|ts|json)$/.test(path)
    );
  }
  for (const [path, label] of [
    ["composables/useAnnualPages.ts", "viewer-page-registry"],
    ["utils/annualSummary.ts", "viewer-presentation"],
    ["types/annual-summary-v4.generated.ts", "viewer-generated-contract"]
  ] as const) {
    await addFileToHash(hash, resolve(process.cwd(), path), label);
  }
  await addDirectoryToHash(
    hash,
    resolve(process.cwd(), "locales"),
    "viewer-locales",
    (path) => /\.(?:ts|json)$/.test(path)
  );
  return hash.digest("hex");
};

export type AnnualRatingRankDistribution = {
  ratingMin: number;
  ratingMax: number;
  ratingStep: number;
  ranks: Array<{
    key: string;
    label: string;
    order: number;
    colorGroup?: "low" | "mid" | "high";
    bins: Array<{
      ratingMin: number;
      ratingMax: number;
      relative: number;
    }>;
  }>;
};

export type AnnualRatingDistribution = {
  fingerprint: string;
  generatedAt: string;
  ratings: number[];
  scannedCount: number;
  discardedCount: number;
  distribution?: AnnualRatingRankDistribution | null;
};

let ratingFingerprintMemo: { manifestFingerprint: string; contentFingerprint: string } | null = null;

const getAnnualRatingInputFingerprint = async () => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  const songDataPath = resolve(String(runtimeConfig.songDataPath || resolve(repoRoot, "songs", "song_data.json")));
  const ratingPath = resolve(
    String(runtimeConfig.ratingStructPath || resolve(repoRoot, "songs", "rating_structured_with_ids.json"))
  );
  const files: Array<{ path: string; label: string }> = [];
  const names = (await readdir(userdataDir).catch(() => []))
    .filter((name) => !name.startsWith("data_") && name.endsWith("data.json"))
    .sort((left, right) => left.localeCompare(right));
  for (const name of names) files.push({ path: resolve(userdataDir, name), label: `userdata/${name}` });
  files.push({ path: ratingPath, label: "rating-data" }, { path: songDataPath, label: "song-data" });
  const algorithmRoot = resolve(repoRoot, "plugins", "utils", "annual_summary");
  for (const path of await listDirectoryFiles(algorithmRoot, (item) => item.endsWith(".py"))) {
    files.push({ path, label: `annual-algorithm/${relative(algorithmRoot, path)}` });
  }
  files.sort((left, right) => left.label.localeCompare(right.label));

  const manifestHash = createHash("sha256");
  manifestHash.update(`${ANNUAL_ALGORITHM_VERSION}:rating-distribution-manifest-v1`);
  for (const file of files) {
    const fileStat = await stat(file.path, { bigint: true }).catch(() => null);
    if (!fileStat?.isFile()) continue;
    manifestHash.update(`\0${file.label}\0${fileStat.size}\0${fileStat.mtimeNs}\0`);
  }
  const manifestFingerprint = manifestHash.digest("hex");
  if (ratingFingerprintMemo?.manifestFingerprint === manifestFingerprint) {
    return ratingFingerprintMemo.contentFingerprint;
  }
  const fingerprintCachePath = resolve(getAnnualCacheRoot(), "ratings", "input-fingerprint.json");
  const persisted = await readAnnualJson<{ manifestFingerprint: string; contentFingerprint: string }>(fingerprintCachePath).catch(
    () => null
  );
  if (persisted?.manifestFingerprint === manifestFingerprint && /^[0-9a-f]{64}$/.test(persisted.contentFingerprint)) {
    ratingFingerprintMemo = persisted;
    return persisted.contentFingerprint;
  }

  const contentHash = createHash("sha256");
  contentHash.update(`${ANNUAL_ALGORITHM_VERSION}:rating-distribution-v1`);
  for (const file of files) await addFileToHash(contentHash, file.path, file.label);
  const contentFingerprint = contentHash.digest("hex");
  ratingFingerprintMemo = { manifestFingerprint, contentFingerprint };
  await atomicWriteJson(fingerprintCachePath, ratingFingerprintMemo);
  return contentFingerprint;
};

const runAnnualRatingsCli = async (): Promise<Omit<AnnualRatingDistribution, "fingerprint">> => annualAdmission.run(
  'generator', `ratings:${await getAnnualRatingInputFingerprint()}`, ANNUAL_RATING_TIMEOUT_MS, async admissionId => {
  const { repoRoot, userdataDir, configPath } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  const songDataPath = resolve(String(runtimeConfig.songDataPath || resolve(repoRoot, 'songs', 'song_data.json')));
  const ratingPath = resolve(String(runtimeConfig.ratingStructPath || resolve(repoRoot, 'songs', 'rating_structured_with_ids.json')));
  const annualCliPath = resolve(repoRoot, 'plugins', 'utils', 'annual_summary', 'standalone.py');
  const child = await spawnAnnualWorker('generator', admissionId, {
    cwd: repoRoot,
    args: [
      annualCliPath,
      "ratings",
      "--userdata-dir",
      userdataDir,
      "--rating-data",
      ratingPath,
      "--song-data",
      songDataPath,
      "--output",
      "-"
    ],
    env: { ...process.env, TMPDIR: '/var/tmp/taiko-annual-workers', TAIKO_CONFIG_PATH: configPath, TAIKO_ANNUAL_CACHE_DIR: getAnnualCacheRoot() }
  }, ANNUAL_RATING_TIMEOUT_MS);
  const started = Date.now();
  const stdout = await new Promise<string>((resolveRun, rejectRun) => {
    let output = ''; let oversized = false;
    child.stdout.setEncoding('utf8'); child.stderr.resume();
    child.stdout.on('data', chunk => {
      if (!oversized) output += chunk;
      if (Buffer.byteLength(output) > 16 * 1024 * 1024) { oversized = true; output = ''; stopAnnualWorker('generator', admissionId); }
    });
    child.on('error', rejectRun);
    child.on('close', code => code === 0 && !oversized ? resolveRun(output) : rejectRun(Date.now() - started >= ANNUAL_RATING_TIMEOUT_MS - 1000 ? new AdmissionError('ANNUAL_RUN_TIMEOUT') : new Error('annual rating worker failed')));
  });
  const parsed = JSON.parse(String(stdout || "{}")) as Record<string, unknown>;
  const ratings = Array.isArray(parsed.ratings)
    ? parsed.ratings
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Number(value.toFixed(4)))
        .sort((left, right) => right - left)
    : [];
  return {
    generatedAt: new Date(String(parsed.generatedAt || Date.now())).toISOString(),
    ratings,
    scannedCount: Math.max(0, Math.floor(Number(parsed.scannedCount) || 0)),
    discardedCount: Math.max(0, Math.floor(Number(parsed.discardedCount) || 0)),
    distribution: normalizeRatingRankDistribution(parsed.distribution)
  };
});

const normalizeRatingRankDistribution = (value: unknown): AnnualRatingRankDistribution | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const ranksRaw = Array.isArray(raw.ranks) ? raw.ranks : [];
  const ranks = ranksRaw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rank = item as Record<string, unknown>;
    const order = Math.floor(Number(rank.order) || 0);
    if (order < 1 || order > 19) return [];
    const binsRaw = Array.isArray(rank.bins) ? rank.bins : [];
    const bins = binsRaw.flatMap((binItem) => {
      if (!binItem || typeof binItem !== "object") return [];
      const bin = binItem as Record<string, unknown>;
      const ratingMin = Number(bin.ratingMin);
      const ratingMax = Number(bin.ratingMax);
      if (!Number.isFinite(ratingMin) || !Number.isFinite(ratingMax) || ratingMax <= ratingMin) return [];
      const relative = Math.min(1, Math.max(0, Number(bin.relative) || 0));
      return [{ ratingMin, ratingMax, relative }];
    });
    const colorGroup = ["low", "mid", "high"].includes(String(rank.colorGroup))
      ? String(rank.colorGroup) as "low" | "mid" | "high"
      : undefined;
    return [{
      key: String(rank.key || `grade_${order}`),
      label: String(rank.label || ""),
      order,
      colorGroup,
      bins
    }];
  });
  if (ranks.length < 19) return null;
  return {
    ratingMin: Number(raw.ratingMin) || 0,
    ratingMax: Number(raw.ratingMax) || 0,
    ratingStep: Number(raw.ratingStep) || 0,
    ranks: ranks.sort((left, right) => left.order - right.order).slice(0, 19)
  };
};

const RATING_DISTRIBUTION_MEMO_TTL_MS = 5 * 60 * 1000;
let ratingDistributionMemo: { value: AnnualRatingDistribution | null; at: number } | null = null;

export const readCachedAnnualRatingDistribution = async (): Promise<AnnualRatingDistribution | null> => {
  const now = Date.now();
  if (ratingDistributionMemo && now - ratingDistributionMemo.at < RATING_DISTRIBUTION_MEMO_TTL_MS) {
    return ratingDistributionMemo.value;
  }
  const cachePath = resolve(getAnnualCacheRoot(), "ratings", "distribution.json");
  const cached = await readAnnualJson<AnnualRatingDistribution>(cachePath).catch(() => null);
  const value = cached && Array.isArray(cached.ratings) ? cached : null;
  ratingDistributionMemo = { value, at: now };
  return value;
};

export const refreshAnnualRatingDistribution = async (): Promise<AnnualRatingDistribution | null> => {
  try {
    const cachePath = resolve(getAnnualCacheRoot(), "ratings", "distribution.json");
    const payload = await withAnnualFileLock("rating-distribution", async () => {
      const fingerprint = await getAnnualRatingInputFingerprint();
      const built = await runAnnualRatingsCli();
      const builtPayload = { ...built, fingerprint };
      await atomicWriteJson(cachePath, builtPayload);
      return builtPayload;
    });
    ratingDistributionMemo = null;
    return payload;
  } catch (error) {
    console.error("[annual-summary] rating distribution failed", safeMessage(error) || error);
    return null;
  }
};

export const getAnnualRatingDistribution = readCachedAnnualRatingDistribution;

let schemaValidatorPromise: Promise<{ summary: ValidateFunction; events: ValidateFunction }> | null = null;

const getSchemaValidators = () => {
  if (!schemaValidatorPromise) {
    schemaValidatorPromise = (async () => {
      const { repoRoot } = getRuntimePaths();
      const schemaPath = resolve(repoRoot, "schemas", "annual-summary-v4.schema.json");
      const schema = JSON.parse(await readFile(schemaPath, "utf-8")) as Record<string, unknown>;
      const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
      addFormats(ajv);
      const summary = ajv.compile(schema);
      const events = ajv.compile({
        type: "array",
        items: { $ref: "#/$defs/annualObservationEvent" },
        $defs: schema.$defs
      });
      return { summary, events };
    })();
  }
  return schemaValidatorPromise;
};

const CANONICAL_SECTION_KEYS = [
  "favoriteSong",
  "obsessionSong",
  "favoriteShift",
  "keyword",
  "ratingRank",
  "monthlyFavorites",
  "weekdayActivity",
  "calendarActivity",
  "timeOfDay",
  "lateNight",
  "speedProfile",
  "nearDondaful",
  "challenge",
  "pound",
  "highScore",
  "milestones",
  "breakthrough"
] as const;

export const validateAnnualSummaryV4 = async (summary: unknown): Promise<AnnualSummaryV4> => {
  const validators = await getSchemaValidators();
  if (!validators.summary(summary)) {
    throw new Error(`AnnualSummaryV4 cache validation failed: ${JSON.stringify(validators.summary.errors || []).slice(0, 4000)}`);
  }
  const sections = (summary as AnnualSummaryV4).sections as Record<string, unknown>;
  const missingSections = CANONICAL_SECTION_KEYS.filter((key) => !(key in sections));
  if (missingSections.length) throw new Error(`AnnualSummaryV4 cache sections are missing: ${missingSections.join(",")}`);
  return summary as AnnualSummaryV4;
};

export const validateAnnualEvents = async (events: unknown): Promise<AnnualObservationEvent[]> => {
  const validators = await getSchemaValidators();
  if (!validators.events(events)) {
    throw new Error(`Annual event cache validation failed: ${JSON.stringify(validators.events.errors || []).slice(0, 4000)}`);
  }
  return events as AnnualObservationEvent[];
};

const validateCliEnvelope = async (input: unknown): Promise<AnnualCliEnvelope> => {
  if (!input || typeof input !== "object") {
    throw new Error("CLI output is not an object");
  }
  const envelope = input as Partial<AnnualCliEnvelope>;
  if (!envelope.summary || Number(envelope.summary.schemaVersion) !== ANNUAL_SCHEMA_VERSION) {
    throw new Error("CLI output does not contain an AnnualSummaryV4");
  }
  if (!Array.isArray(envelope.events)) {
    throw new Error("CLI output does not contain an event array");
  }
  await validateAnnualSummaryV4(envelope.summary);
  await validateAnnualEvents(envelope.events);
  return envelope as AnnualCliEnvelope;
};

export type AnnualProgressUpdate = { stage: string; percent: number; detail?: Record<string, unknown> };

const runAnnualSummaryCliUnadmitted = async (
  taikoId: string,
  onProgress: ((update: AnnualProgressUpdate) => void | Promise<void>) | undefined,
  admissionId: string
): Promise<AnnualCliEnvelope> => {
  const { repoRoot, userdataDir, configPath } = getRuntimePaths();
  const runtimeConfig = useRuntimeConfig();
  const songDataPath = resolve(String(runtimeConfig.songDataPath || resolve(repoRoot, "songs", "song_data.json")));
  const ratingPath = resolve(
    String(runtimeConfig.ratingStructPath || resolve(repoRoot, "songs", "rating_structured_with_ids.json"))
  );
  const annualCliPath = resolve(repoRoot, "plugins", "utils", "annual_summary", "standalone.py");
  const args = [
    annualCliPath,
    "build",
    "--taiko-id",
    taikoId,
    "--version",
    ANNUAL_VERSION_KEY,
    "--version-json",
    JSON.stringify(getAnnualGeneratorVersion()),
    "--userdata-dir",
    userdataDir,
    "--song-data",
    songDataPath,
    "--rating-data",
    ratingPath,
    "--output",
    "-"
  ];
  try {
    const child = await spawnAnnualWorker('generator', admissionId, {
      cwd: repoRoot, args,
      env: { ...process.env, TMPDIR: '/var/tmp/taiko-annual-workers', TAIKO_CONFIG_PATH: configPath, TAIKO_ANNUAL_CACHE_DIR: getAnnualCacheRoot() }
    }, ANNUAL_BUILD_TIMEOUT_MS);
    const started = Date.now();
    const stdout = await new Promise<string>((resolveRun, rejectRun) => {
      let output = "";
      let stderr = "";
      let pending = "";
      let progressWrites = Promise.resolve();
      let oversized = false;
      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");
      child.stdout.on("data", (chunk) => {
        if (!oversized) output += chunk;
        if (Buffer.byteLength(output) > 64 * 1024 * 1024) { oversized = true; output = ""; stopAnnualWorker("generator", admissionId); }
      });
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-4000);
        pending += chunk;
        const lines = pending.split("\n");
        pending = (lines.pop() || "").slice(-65536);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            if (parsed.annualProgress === true && onProgress) {
              const update = {
                stage: String(parsed.stage || "running"),
                percent: Number(parsed.percent || 0),
                detail: parsed.detail && typeof parsed.detail === "object" ? parsed.detail as Record<string, unknown> : undefined
              };
              progressWrites = progressWrites.then(() => onProgress(update)).then(() => undefined);
            }
          } catch {}
        }
      });
      child.on("error", rejectRun);
      child.on("close", async (code) => {
        try {
          await progressWrites;
          if (code === 0 && !oversized) resolveRun(output);
          else rejectRun(Date.now() - started >= ANNUAL_BUILD_TIMEOUT_MS - 1000 ? new AdmissionError("ANNUAL_RUN_TIMEOUT") : Object.assign(new Error(stderr || `annual CLI exited with ${code}`), { stderr }));
        } catch (error) {
          rejectRun(error);
        }
      });
    });
    const trimmed = stdout.trim();
    if (!trimmed) throw new Error("CLI returned empty output");
    return await validateCliEnvelope(JSON.parse(trimmed));
  } catch (error) {
    if (error instanceof AdmissionError) throw error;
    const message = safeMessage(error);
    if (isMissingHistoryError(message)) {
      throw createError({ statusCode: 422, statusMessage: "现有数据不足以生成年度总结，请先同步更多记录" });
    }
    if (/oom|out of memory|memory pressure/i.test(message)) {
      throw Object.assign(createError({ statusCode: 503, statusMessage: "年度服务内存压力较高，请稍后重试" }), {
        code: "ANNUAL_WORKER_OOM"
      });
    }
    if (/failed to (?:start|connect)|systemd|dbus|transient unit/i.test(message)) {
      throw Object.assign(createError({ statusCode: 503, statusMessage: "年度任务暂时无法启动，请稍后重试" }), {
        code: "ANNUAL_LAUNCH_FAILED"
      });
    }
    console.error("[annual-summary] CLI build failed", message || "unknown error");
    throw createError({ statusCode: 500, statusMessage: "年度总结生成失败，请稍后重试" });
  }
};

export const annualGeneratorKey = async (taikoId: string) =>
  `build:${taikoId}:${ANNUAL_VERSION_KEY}:${await annualBuildInputRevision(getRuntimePaths().userdataDir, taikoId, ANNUAL_PRODUCER_REVISION)}`;

export const runAnnualSummaryCli = async (
  taikoId: string,
  onProgress?: (update: AnnualProgressUpdate) => void | Promise<void>,
  admission?: { key?: string; ticket?: string; onRunning?: () => Promise<void> }
): Promise<AnnualCliEnvelope> => annualAdmission.run('generator', admission?.key || await annualGeneratorKey(taikoId),
  ANNUAL_BUILD_TIMEOUT_MS, id => runAnnualSummaryCliUnadmitted(taikoId, onProgress, id), admission);

export const readAnnualSummary = async (filePath: string) => validateAnnualSummaryV4(await readAnnualJson<unknown>(filePath));
export const readAnnualEvents = async (filePath: string) => validateAnnualEvents(await readAnnualJson<unknown>(filePath));

const collectReferencedSnapshotHashes = async (root: string) => {
  const referenced = new Set<string>();
  const files = await listDirectoryFiles(
    resolve(root, "summaries"),
    (path) => path.endsWith(`${sep}summary.json`) || path.endsWith(`${sep}events.json`)
  );
  const visit = (value: unknown, key = ""): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (!value || typeof value !== "object") {
      if (
        typeof value === "string"
        && /^(?:sha256|contentHash)$/i.test(key)
        && /^[0-9a-f]{64}$/i.test(value)
      ) {
        referenced.add(value.toLowerCase());
      }
      return;
    }
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      visit(childValue, childKey);
    }
  };
  for (const path of files) {
    const payload = await readAnnualJson<unknown>(path).catch(() => null);
    if (payload) visit(payload);
  }
  return referenced;
};

const cleanupAnnualCacheUnlocked = async (): Promise<AnnualCacheCleanupStats> => {
  const startedAt = Date.now();
  const root = getAnnualCacheRoot();
  await ensurePrivateDir(root);
  const normalizedRoot = resolve(root, "normalized");
  const referencedSnapshotHashes = await collectReferencedSnapshotHashes(root);
  const normalizedCutoff = Date.now() - NORMALIZED_CACHE_TTL_MS;
  type Candidate = { path: string; size: number; mtimeMs: number; staleRevision: boolean };
  const candidates: Candidate[] = [];
  let scannedFiles = 0;
  let errors = 0;
  let beforeBytes = 0;
  const removeOldTemps = async (dir: string) => {
    await chmod(dir, 0o700).catch(() => undefined);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await removeOldTemps(path);
      } else if (entry.name.endsWith(".tmp")) {
        scannedFiles += 1;
        const itemStat = await stat(path).catch(() => null);
        if (itemStat && Date.now() - itemStat.mtimeMs > 24 * 60 * 60 * 1000) {
          await unlink(path).catch(() => { errors += 1; });
        }
      } else if (path.startsWith(`${normalizedRoot}${sep}`) && entry.name.endsWith(".json")) {
        scannedFiles += 1;
        const itemStat = await stat(path).catch(() => null);
        if (itemStat) {
          beforeBytes += itemStat.size;
          const descriptor = await open(path, "r").catch(() => null);
          let prefix = "";
          if (descriptor) {
            try {
              const buffer = Buffer.allocUnsafe(Math.min(1024, itemStat.size));
              const read = await descriptor.read(buffer, 0, buffer.length, 0);
              prefix = buffer.subarray(0, read.bytesRead).toString("utf8");
            } catch { errors += 1; }
            finally { await descriptor.close().catch(() => undefined); }
          }
          candidates.push({
            path,
            size: itemStat.size,
            mtimeMs: itemStat.mtimeMs,
            staleRevision: !prefix.includes(ANNUAL_ALGORITHM_VERSION)
          });
        }
      }
    }
  };
  await removeOldTemps(root);
  const filesystemBefore = await statfs(root);
  const freeBytesBefore = filesystemBefore.bavail * filesystemBefore.bsize;
  let currentBytes = beforeBytes;
  let currentFreeBytes = freeBytesBefore;
  let removedFiles = 0;
  let releasedBytes = 0;
  const ordered = candidates.sort((left, right) =>
    Number(right.staleRevision) - Number(left.staleRevision) || left.mtimeMs - right.mtimeMs
  );
  const isReferenced = async (candidate: Candidate) => {
    const cached = await readAnnualJson<{ contentHash?: string }>(candidate.path).catch(() => null);
    const contentHash = String(cached?.contentHash || "").toLowerCase();
    return Boolean(contentHash && referencedSnapshotHashes.has(contentHash));
  };
  const removeCandidate = async (candidate: Candidate) => {
    if (await isReferenced(candidate)) return false;
    try {
      await unlink(candidate.path);
      removedFiles += 1;
      releasedBytes += candidate.size;
      currentBytes -= candidate.size;
      currentFreeBytes += candidate.size;
      return true;
    } catch {
      errors += 1;
      return false;
    }
  };
  const removedPaths = new Set<string>();
  for (const candidate of ordered) {
    if (candidate.mtimeMs >= normalizedCutoff) continue;
    if (await removeCandidate(candidate)) removedPaths.add(candidate.path);
  }
  if (currentBytes >= NORMALIZED_CACHE_HIGH_BYTES) {
    for (const candidate of ordered) {
      if (currentBytes <= NORMALIZED_CACHE_TARGET_BYTES) break;
      if (removedPaths.has(candidate.path)) continue;
      if (await removeCandidate(candidate)) removedPaths.add(candidate.path);
    }
  }
  if (currentFreeBytes < MIN_CACHE_FREE_BYTES) {
    for (const candidate of ordered) {
      if (currentFreeBytes >= MIN_CACHE_FREE_BYTES) break;
      if (removedPaths.has(candidate.path)) continue;
      if (await removeCandidate(candidate)) removedPaths.add(candidate.path);
    }
  }
  const filesystemAfter = await statfs(root);
  return {
    scannedFiles,
    removedFiles,
    releasedBytes,
    beforeBytes,
    afterBytes: Math.max(0, currentBytes),
    freeBytesBefore,
    freeBytesAfter: filesystemAfter.bavail * filesystemAfter.bsize,
    durationMs: Date.now() - startedAt,
    errors
  };
};

export const cleanupAnnualCache = async (): Promise<AnnualCacheCleanupStats> => {
  if (annualCacheCleanupPromise) return annualCacheCleanupPromise;
  annualCacheCleanupPromise = cleanupAnnualCacheUnlocked()
    .then((stats) => {
      console.info("[annual-summary] cache cleanup", stats);
      return stats;
    })
    .finally(() => {
      annualCacheCleanupPromise = null;
    });
  return annualCacheCleanupPromise;
};

export const annualCacheRelativePath = (filePath: string) => relative(getAnnualCacheRoot(), ensureWithinAnnualCache(filePath));
