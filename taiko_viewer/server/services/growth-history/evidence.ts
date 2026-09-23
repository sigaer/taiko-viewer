import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { GrowthSnapshot } from "~/utils/dailyProgress";
import { growthCalendarDay } from "~/utils/playerGrowth";
import { getRuntimePaths, type UserdataPayload, type UserdataSong } from "~/server/internal/account/shared";
import { GROWTH_HISTORY_FILE_LIMIT } from "./constants";

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

export type GrowthObservationExclusion = "import" | "manual" | "repair" | "content-edit" | "dispatcher-transfer" | "counter-regression" | "unknown-source" | "source-switch" | "discontinuity-baseline";

export type GrowthObservation = {
  token: string;
  orderKey: string;
  revision: string;
  contentRevision: string | null;
  observedAt: string;
  source: string;
  eventDays: string[];
  evidenceLevel: "L0" | "L1";
  excludedReason: GrowthObservationExclusion | null;
};

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
const recentTransitionFields: Array<keyof UserdataSong> = ["high_score", "best_score_rank", "good_cnt", "ok_cnt", "ng_cnt", "combo_cnt", "stage_cnt", "clear_cnt", "full_combo_cnt", "dondaful_combo_cnt", "highscore_datetime", "update_datetime"];
const hasCounterRegression = (before: Map<string, UserdataSong>, songs: UserdataSong[]) => songs.some(song => {
  const previous = before.get(chartKey(song));
  if (!previous) return false;
  return ["stage_cnt", "high_score", "clear_cnt", "full_combo_cnt", "dondaful_combo_cnt"].some(field => {
    const left = numberValue(previous[field as keyof typeof previous]);
    const right = numberValue(song[field as keyof typeof song]);
    return left !== null && right !== null && right < left;
  });
});
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

async function readGrowthScoreEvidence(taikoId: string): Promise<GrowthScoreEvidence> {
  const { userdataDir } = getRuntimePaths();
  const directory = resolve(userdataDir, taikoId);
  const allNames = (await readdir(directory).catch(() => [] as string[])).filter(name => name.startsWith("data_") && name.endsWith(".json")).sort((left, right) => fileOrder(left).localeCompare(fileOrder(right)));
  const names = allNames.slice(-GROWTH_HISTORY_FILE_LIMIT);
  const snapshots: GrowthSnapshot[] = [];
  const observations: GrowthObservation[] = [];
  let state = new Map<string, UserdataSong>();
  let lastAuthoritativeSource = "";
  let needsAuthoritativeBaseline = false;
  let invalidFiles = 0;
  for (const name of names) {
    try {
      const raw = await readFile(resolve(directory, name), "utf-8");
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
      if (!excludedReason && hasCounterRegression(state, payload.songs)) excludedReason = "counter-regression";
      const changedSongs = payload.songs.filter(song => {
        const previous = state.get(chartKey(song));
        return Boolean(previous && recentTransitionFields.some(field => previous[field] !== song[field]));
      });
      const eventDays = [...new Set(changedSongs.flatMap(song => [growthCalendarDay(song.update_datetime), growthCalendarDay(song.highscore_datetime)]).filter(Boolean))].sort();
      const full = isFullPayload(payload);
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
      const next = full ? new Map<string, UserdataSong>() : new Map(state);
      for (const song of payload.songs) next.set(chartKey(song), song);
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
  const days = snapshots.map(snapshot => growthCalendarDay(snapshot.timestamp)).filter(Boolean).sort();
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
