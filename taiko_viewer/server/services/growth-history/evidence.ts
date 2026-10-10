import { createHash } from "node:crypto";
import type { GrowthSnapshot } from "~/utils/dailyProgress";
import { growthCalendarDay } from "~/utils/playerGrowth";
import type { LegacyScorePayload as UserdataPayload, LegacyScoreRecord as UserdataSong, ScoreReadPort } from "../../domain/score-read-contract.ts";
import { getDomainScoreReader } from "../taiko-domain/read.ts";
import { memoizeGrowthString } from "~/utils/growthRequestMemo";
import { GROWTH_HISTORY_FILE_LIMIT } from "./constants";
import type { GrowthObservation } from "../../../../packages/sakura-taiko-contract/src/index";
export type { GrowthObservation } from "../../../../packages/sakura-taiko-contract/src/index";

export type GrowthScoreEvidence = {
  snapshots: GrowthSnapshot[];
  observations: GrowthObservation[];
  totalFiles: number;
  filesRead: number;
  invalidFiles: number;
  truncated: boolean;
  fromDay: string | null;
  toDay: string | null;
};

export type GrowthObservationExclusion = NonNullable<GrowthObservation["excludedReason"]>;

const isFullPayload = (payload: UserdataPayload) => payload._meta?.full === true || (!payload._meta && Boolean(payload.profile && payload.achievement && Array.isArray(payload.songs)));
const fileTimestamp = (name: string) => {
  const standard = name.match(/^data_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
  if (standard) return `${standard[1]}-${standard[2]}-${standard[3]} ${standard[4]}:${standard[5]}:${standard[6]}`;
  const compact = name.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}:${compact[6]}` : "";
};
const fileOrder = (name: string) => `${fileTimestamp(name).replace(/\D/g, "").padEnd(14, "0")}:${name}`;
const normalizeSource = (value: unknown) => String(value || "unknown").trim().toLowerCase().replaceAll("_", "-");
const viewerWriterSources = ["kinoko-history-current", "manual-score-delete", "web-score-import", "kinoko-import", "manual-create", "manual-rename", "manual-score", "web-account"];
const sourceFromName = (name: string) => viewerWriterSources.find(source => name.includes(`_${source}.json`)) || "";
const normalizedInstant = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text) ? `${text.replace(" ", "T")}+08:00` : text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
};
const numberValue = (value: unknown) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const chartKey = (song: UserdataSong) => `${Number(song?.song_no || 0)}:${Number(song?.level || 0)}`;
// Direct field access keeps million-row full histories off dynamic-key hot loops.
const transitionChanged = (before: UserdataSong, after: UserdataSong) =>
  before.high_score !== after.high_score || before.best_score_rank !== after.best_score_rank ||
  before.good_cnt !== after.good_cnt || before.ok_cnt !== after.ok_cnt || before.ng_cnt !== after.ng_cnt ||
  before.combo_cnt !== after.combo_cnt || before.stage_cnt !== after.stage_cnt ||
  before.clear_cnt !== after.clear_cnt || before.full_combo_cnt !== after.full_combo_cnt ||
  before.dondaful_combo_cnt !== after.dondaful_combo_cnt ||
  before.highscore_datetime !== after.highscore_datetime || before.update_datetime !== after.update_datetime;
const regressionFields: Array<keyof UserdataSong> = ["stage_cnt", "high_score", "clear_cnt", "full_combo_cnt", "dondaful_combo_cnt"];
const exclusionFor = (source: string, meta: Record<string, unknown>, filenameSource: string): GrowthObservationExclusion | null => {
  if (meta.imported_via || meta.importedVia || meta.import_marker || meta.importMarker || source.startsWith("kinoko") || filenameSource.startsWith("kinoko")) return "import";
  if (source.startsWith("manual") || filenameSource.startsWith("manual")) return "manual";
  if ([source, filenameSource].some(value => /repair|backfill|migration/.test(value))) return "repair";
  if ([source, filenameSource].some(value => value === "web-account" || value === "web-score-import")) return "content-edit";
  if (source === "sakura-bot-sync") return "dispatcher-transfer";
  return source === "wahlap" || source === "hiroba" ? null : "unknown-source";
};
const observationToken = (observedAt: string, orderKey: string, revision: string) => createHash("sha256").update(`recent-observation-v1\n${observedAt}\n${orderKey}\n${revision}`).digest("hex");

const inFlightEvidence = new Map<string, Promise<GrowthScoreEvidence>>();

/** Prefetch only eight raw files; parsing and provenance replay stay in file order. */
async function* readHistoryFiles(reader: ScoreReadPort, taikoId: string, names: string[]) {
  for (let offset = 0; offset < names.length; offset += 8) {
    const batch = await Promise.all(names.slice(offset, offset + 8).map(async name => {
      try {
        const raw = await reader.readHistory(taikoId, name);
        return { name, raw };
      } catch { return { name, raw: null }; }
    }));
    for (const file of batch) yield file;
  }
}

async function readGrowthScoreEvidence(taikoId: string): Promise<GrowthScoreEvidence> {
  const calendarDayFor = memoizeGrowthString(growthCalendarDay);
  const reader = getDomainScoreReader();
  const allNames = (await reader.listHistory(taikoId).catch(() => [] as string[])).filter(name => name.startsWith("data_") && name.endsWith(".json")).sort((left, right) => fileOrder(left).localeCompare(fileOrder(right)));
  const names = allNames.slice(-GROWTH_HISTORY_FILE_LIMIT);
  const snapshots: GrowthSnapshot[] = [];
  const observations: GrowthObservation[] = [];
  let state = new Map<string, UserdataSong>();
  let lastAuthoritativeSource = "";
  let needsAuthoritativeBaseline = false;
  let invalidFiles = 0;
  for await (const { name, raw } of readHistoryFiles(reader, taikoId, names)) {
    try {
      if (raw === null) { invalidFiles += 1; continue; }
      const payload = JSON.parse(raw) as UserdataPayload;
      if (!Array.isArray(payload.songs)) { invalidFiles += 1; continue; }
      const meta = payload._meta && typeof payload._meta === "object" ? payload._meta as Record<string, unknown> : {};
      const timestamp = String(meta.observed_at || meta.observedAt || meta.synced_at || meta.ts || fileTimestamp(name));
      const observedAt = normalizedInstant(timestamp);
      const revision = createHash("sha256").update(raw).digest("hex");
      const filenameSource = normalizeSource(sourceFromName(name));
      const declaredWriter = normalizeSource(meta.writer_source);
      const source = declaredWriter !== "unknown" ? declaredWriter : filenameSource !== "unknown" ? filenameSource : normalizeSource(meta.source);
      let excludedReason = exclusionFor(source, meta, filenameSource);
      const eventDaySet = new Set<string>();
      const full = isFullPayload(payload);
      const next = full ? new Map<string, UserdataSong>() : new Map(state);
      for (const song of payload.songs) {
        const songKey = chartKey(song);
        const previous = state.get(songKey);
        if (previous && transitionChanged(previous, song)) {
          // Every regression field is a transition field; unchanged rows cannot regress.
          if (!excludedReason) {
            for (const field of regressionFields) {
              const left = numberValue(previous[field]), right = numberValue(song[field]);
              if (left !== null && right !== null && right < left) {
                excludedReason = "counter-regression";
                break;
              }
            }
          }
          const playDay = calendarDayFor(song.update_datetime), scoreDay = calendarDayFor(song.highscore_datetime);
          if (playDay) eventDaySet.add(playDay);
          if (scoreDay) eventDaySet.add(scoreDay);
        }
        next.set(songKey, song);
      }
      const eventDays = [...eventDaySet].sort();
      if (!excludedReason && lastAuthoritativeSource && source !== lastAuthoritativeSource) {
        excludedReason = "source-switch";
        lastAuthoritativeSource = source;
        needsAuthoritativeBaseline = !full;
      } else if (!excludedReason && needsAuthoritativeBaseline) {
        excludedReason = "discontinuity-baseline";
        if (full) {
          lastAuthoritativeSource = source;
          needsAuthoritativeBaseline = false;
        }
      } else if (!excludedReason) {
        lastAuthoritativeSource = source;
      }
      if (excludedReason && !["dispatcher-transfer", "source-switch", "discontinuity-baseline"].includes(excludedReason)) needsAuthoritativeBaseline = true;
      const removed = (payload as UserdataPayload & { songs_removed?: unknown[] }).songs_removed;
      if (Array.isArray(removed)) {
        for (const item of removed) next.delete(Array.isArray(item) ? `${item[0]}:${item[1]}` : String(item));
      }
      state = next;
      const orderKey = fileOrder(name);
      snapshots.push({
        full,
        timestamp,
        songs: payload.songs,
        revision,
        source
      });
      const declaredContentRevision = String(meta.content_sha256 || meta.contentRevision || meta.content_revision || meta.revision || "");
      const contentRevision = /^[a-f0-9]{64}$/i.test(declaredContentRevision) ? declaredContentRevision.toLowerCase() : null;
      observations.push({ token: observationToken(observedAt, orderKey, revision), orderKey, revision, contentRevision, observedAt, source, eventDays, evidenceLevel: excludedReason || !observedAt ? "L0" : "L1", excludedReason: excludedReason || (!observedAt ? "unknown-source" : null) });
    } catch {
      invalidFiles += 1;
    }
  }
  const days = snapshots.map(snapshot => calendarDayFor(snapshot.timestamp)).filter(Boolean).sort();
  observations.sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.orderKey.localeCompare(right.orderKey) || left.revision.localeCompare(right.revision));
  return {
    snapshots,
    observations,
    totalFiles: allNames.length,
    filesRead: names.length,
    invalidFiles,
    truncated: allNames.length > names.length,
    fromDay: days[0] || null,
    toDay: days.at(-1) || null
  };
}

export function loadGrowthScoreEvidence(taikoId: string): Promise<GrowthScoreEvidence> {
  const existing = inFlightEvidence.get(taikoId);
  if (existing) return existing;
  const pending = readGrowthScoreEvidence(taikoId).finally(() => {
    if (inFlightEvidence.get(taikoId) === pending) inFlightEvidence.delete(taikoId);
  });
  inFlightEvidence.set(taikoId, pending);
  return pending;
}

/** Metadata validation is local to a request; no retained account/history cache.
 * ctimeNs also detects same-size rewrites with restored mtime. This preserves the
 * legacy per-file read boundary, not an atomic multi-file writer transaction.
 */
async function historyVersion(taikoId: string): Promise<string | null> {
  try {
    const reader = getDomainScoreReader();
    const directoryBefore = await reader.historyDirectoryVersion(taikoId);
    const allNames = (await reader.listHistory(taikoId)).filter(name => name.startsWith("data_") && name.endsWith(".json"));
    allNames.sort((left, right) => fileOrder(left).localeCompare(fileOrder(right)));
    const names = allNames.slice(-GROWTH_HISTORY_FILE_LIMIT);
    const versions: string[] = new Array(names.length);
    let cursor = 0;
    // Fixed pool, at most eight stat operations in flight, at most 2,000 files.
    const results = await Promise.allSettled(Array.from({ length: Math.min(8, names.length) }, async () => {
      while (cursor < names.length) {
        const index = cursor++;
        versions[index] = await reader.historyFileVersion(taikoId, names[index]);
      }
    }));
    if (results.some(result => result.status === "rejected")) return null;
    const directoryAfter = await reader.historyDirectoryVersion(taikoId);
    if (directoryBefore !== directoryAfter) return null;
    return createHash("sha256").update(`${directoryAfter}\n${allNames.length}\n${versions.join("\n")}`).digest("hex");
  } catch {
    // Unreadable/missing history may become available later in this request.
    return null;
  }
}

/** Reuse settled evidence only after checking the files again at the next call. */
export function createGrowthScoreEvidenceRequest(taikoId: string): typeof loadGrowthScoreEvidence {
  let retained: GrowthScoreEvidence | undefined;
  let retainedVersion: string | null = null;
  let pending: Promise<GrowthScoreEvidence> | undefined;
  return requestedId => {
    if (requestedId !== taikoId) return loadGrowthScoreEvidence(requestedId);
    if (!pending) {
      pending = (async () => {
        const before = await historyVersion(taikoId);
        if (retained && before !== null && before === retainedVersion) return retained;
        retained = undefined;
        retainedVersion = null;
        // A reload must not join an older global in-flight read after a change.
        const evidence = await readGrowthScoreEvidence(taikoId);
        const after = await historyVersion(taikoId);
        if (before !== null && before === after && evidence.invalidFiles === 0) {
          retained = evidence;
          retainedVersion = after;
        }
        return evidence;
      })().finally(() => { pending = undefined; });
    }
    return pending;
  };
}
