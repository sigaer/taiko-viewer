import { createHash } from "node:crypto";
import { parseKinokoTimestamp, parseKinokoMetadataTime, filterKinokoEvents } from "./kinoko-time";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createError } from "h3";
import {
  getRuntimePaths,
  rebuildUserdataAchievement,
  type UserdataPayload,
  type UserdataSong
} from "./shared";
import { getKinokoScoreFingerprint } from "./kinoko-import";

const MAX_HISTORY_FILES_PER_IMPORT = 10_000;
const HISTORY_SOURCE = "wahlap";
const IMPORTED_VIA = "kinoko-history";

type NormalizedHistoryRecord = {
  song: UserdataSong;
  timestamp: string;
  epochMs: number;
  fingerprint: string;
};

export type KinokoHistoryWriteSummary = {
  remoteRecords: number;
  uniqueRecords: number;
  importedRecords: number;
  skippedRecords: number;
  snapshotFiles: number;
  baselineCreated: boolean;
};

const normalizeTimestamp = (value: unknown, now = new Date()) => {
  try { return parseKinokoTimestamp(value, now); } catch { return null; }
};

const normalizeHistoryRecords = (records: UserdataSong[], now: Date) => {
  records = filterKinokoEvents(records, now).records;
  const unique = new Map<string, NormalizedHistoryRecord>();
  for (const song of records) {
    const timestamp = normalizeTimestamp(song.update_datetime || song.highscore_datetime, now);
    if (!timestamp) {
      throw createError({ statusCode: 502, statusMessage: "菌菌控制台返回了无效的历史成绩时间" });
    }
    const fingerprint = getKinokoScoreFingerprint(song);
    unique.set(fingerprint, { song, timestamp: timestamp.text, epochMs: timestamp.epochMs, fingerprint });
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.epochMs - right.epochMs ||
      left.song.song_no - right.song.song_no ||
      left.song.level - right.song.level ||
      left.fingerprint.localeCompare(right.fingerprint)
  );
};

const isFullSnapshot = (payload: UserdataPayload) => {
  const meta = payload._meta;
  if (meta?.full === true) return true;
  if (meta?.full === false) return false;
  const hasFullShape =
    Boolean(payload.profile && typeof payload.profile === "object") &&
    Boolean(payload.achievement && typeof payload.achievement === "object") &&
    Array.isArray(payload.songs);
  if (!hasFullShape) return false;
  if (!meta || !Object.keys(meta).length) return true;
  return (payload.songs?.length || 0) >= 500;
};

const snapshotObservedAt = (payload: UserdataPayload, fileName: string) => {
  const meta = payload._meta || {};
  for (const value of [meta.observed_at, meta.observedAt, meta.synced_at, meta.ts]) {
    const normalized = parseKinokoMetadataTime(value);
    if (normalized) return normalized.epochMs;
  }
  const compact = fileName.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/);
  if (!compact) return null;
  return normalizeTimestamp(
    `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}:${compact[6]}`
  )?.epochMs ?? null;
};

const inspectLocalHistory = async (historyDir: string) => {
  const knownRecordFingerprints = new Set<string>();
  const fullSnapshotTimes: number[] = [];
  const names = await readdir(historyDir).catch(() => [] as string[]);
  for (const name of names) {
    if (!name.startsWith("data_") || !name.endsWith(".json")) continue;
    try {
      const payload = JSON.parse(await readFile(join(historyDir, name), "utf-8")) as UserdataPayload;
      const full = isFullSnapshot(payload);
      const importedVia = String(payload._meta?.imported_via || "") === IMPORTED_VIA;
      if (full) {
        const observedAt = snapshotObservedAt(payload, name);
        if (observedAt !== null) fullSnapshotTimes.push(observedAt);
      }
      if (!full || importedVia) {
        for (const song of payload.songs || []) knownRecordFingerprints.add(getKinokoScoreFingerprint(song));
      }
    } catch {
      // Existing malformed history is ignored here and remains available for the normal history loader to report.
    }
  }
  return {
    knownRecordFingerprints,
    earliestFullSnapshotAt: fullSnapshotTimes.length ? Math.min(...fullSnapshotTimes) : null
  };
};

const compactTimestamp = (timestamp: string) => timestamp.replace(/[-: ]/g, "").replace(/^(\d{8})(\d{6})$/, "$1_$2");

const writeSnapshot = async (
  historyDir: string,
  payload: UserdataPayload,
  timestamp: string,
  sequence: number
) => {
  const serialized = JSON.stringify(payload, null, 4);
  const hash = createHash("sha256").update(serialized).digest("hex").slice(0, 12);
  const micros = String(Math.min(sequence, 999_999)).padStart(6, "0");
  const fileName = `data_${compactTimestamp(timestamp)}_${micros}_kinoko-history_${hash}.json`;
  const filePath = join(historyDir, fileName);
  try {
    await access(filePath);
    return false;
  } catch {
    // Continue with an atomic create.
  }
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, serialized, "utf-8");
  await rename(tempPath, filePath);
  return true;
};

const buildMeta = (taikoId: string, timestamp: string, full: boolean) => ({
  full,
  ts: timestamp,
  observed_at: timestamp,
  synced_at: timestamp.replace(" ", "T"),
  source: HISTORY_SOURCE,
  source_account: taikoId,
  schema_version: 2,
  imported_via: IMPORTED_VIA
});

export const writeKinokoHistorySnapshots = async (
  taikoId: string,
  remoteRecords: UserdataSong[],
  currentUserdata: UserdataPayload,
  now = new Date()
): Promise<KinokoHistoryWriteSummary> => {
  const normalized = normalizeHistoryRecords(remoteRecords, now);
  if (!normalized.length) {
    return {
      remoteRecords: remoteRecords.length,
      uniqueRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      snapshotFiles: 0,
      baselineCreated: false
    };
  }

  const { userdataDir } = getRuntimePaths();
  const historyDir = resolve(userdataDir, taikoId);
  await mkdir(historyDir, { recursive: true });
  const local = await inspectLocalHistory(historyDir);
  const missing = normalized.filter((record) => !local.knownRecordFingerprints.has(record.fingerprint));
  const needsBaseline =
    local.earliestFullSnapshotAt === null || normalized[0].epochMs < local.earliestFullSnapshotAt;
  const snapshotUpperBound = missing.length + (needsBaseline ? 1 : 0);
  if (snapshotUpperBound > MAX_HISTORY_FILES_PER_IMPORT) {
    throw createError({ statusCode: 400, statusMessage: "历史记录跨度过大，无法安全写入本地快照" });
  }

  let snapshotFiles = 0;
  let baselineCreated = false;
  if (needsBaseline) {
    const baselineDate = new Date(normalized[0].epochMs - 1000 + 8 * 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    const baselineTimestamp = `${baselineDate.getUTCFullYear()}-${pad(baselineDate.getUTCMonth() + 1)}-${pad(baselineDate.getUTCDate())} ${pad(baselineDate.getUTCHours())}:${pad(baselineDate.getUTCMinutes())}:${pad(baselineDate.getUTCSeconds())}`;
    const baseline: UserdataPayload = {
      _meta: buildMeta(taikoId, baselineTimestamp, true),
      profile: { ...(currentUserdata.profile || {}), userid: taikoId },
      songs: [],
      dojo: currentUserdata.dojo && typeof currentUserdata.dojo === "object" ? { ...currentUserdata.dojo } : {}
    };
    rebuildUserdataAchievement(baseline);
    baselineCreated = await writeSnapshot(historyDir, baseline, baselineTimestamp, 0);
    if (baselineCreated) snapshotFiles += 1;
  }

  let cursor = 0;
  while (cursor < missing.length) {
    const timestamp = missing[cursor].timestamp;
    const sameTime: NormalizedHistoryRecord[] = [];
    while (cursor < missing.length && missing[cursor].timestamp === timestamp) {
      sameTime.push(missing[cursor]);
      cursor += 1;
    }

    const lanes: UserdataSong[][] = [];
    for (const record of sameTime) {
      const key = `${record.song.song_no}:${record.song.level}`;
      let laneIndex = lanes.findIndex((lane) => !lane.some((song) => `${song.song_no}:${song.level}` === key));
      if (laneIndex < 0) {
        laneIndex = lanes.length;
        lanes.push([]);
      }
      lanes[laneIndex].push(record.song);
    }

    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      const payload: UserdataPayload = {
        _meta: buildMeta(taikoId, timestamp, false),
        songs: lanes[laneIndex]
      };
      if (await writeSnapshot(historyDir, payload, timestamp, laneIndex + 1)) snapshotFiles += 1;
    }
  }

  return {
    remoteRecords: remoteRecords.length,
    uniqueRecords: normalized.length,
    importedRecords: missing.length,
    skippedRecords: normalized.length - missing.length,
    snapshotFiles,
    baselineCreated
  };
};
