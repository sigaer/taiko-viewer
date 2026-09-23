#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const days = Math.max(1, Math.min(90, Number(args.get("days") || 30)));
const maxProfiles = Math.max(2, Math.min(100, Number(args.get("max-profiles") || 30)));
const now = args.has("now") ? Date.parse(args.get("now")) : Date.now();
if (!Number.isFinite(now)) throw new Error("invalid --now");
const from = now - days * 86_400_000;
const userdataDir = resolve(process.env.TAIKO_USERDATA_DIR || "/home/sigaer/taiko/userdata");
const outputPath = args.get("output") ? resolve(args.get("output")) : "";
const gapMinutes = [10, 20, 30, 45, 60, 90];
const knownSources = new Set([
  "wahlap", "hiroba", "sakura-bot-sync", "kinoko-import", "kinoko-history",
  "kinoko-history-current", "manual-create", "manual-rename", "manual-score",
  "manual-score-delete", "web-account", "web-score-import", "unknown"
]);
const viewerWriterSources = [
  "kinoko-history-current", "manual-score-delete", "web-score-import", "kinoko-import",
  "manual-create", "manual-rename", "manual-score", "web-account"
];
const sessionFieldNames = [
  "session_id", "sessionId", "play_session_id", "playSessionId", "play_batch_id",
  "playBatchId", "arcade_visit_id", "arcadeVisitId", "transaction_id", "transactionId",
  "play_cycle_id", "playCycleId"
];

const SAMPLE_LIMIT = 50_000;
const sampleState = new WeakMap();
const samples = () => {
  const values = [];
  sampleState.set(values, { seen: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, seed: 0x6d2b79f5 });
  return values;
};
const addSample = (values, value) => {
  if (!Number.isFinite(value)) return;
  const state = sampleState.get(values);
  state.seen += 1;
  state.min = Math.min(state.min, value);
  state.max = Math.max(state.max, value);
  if (values.length < SAMPLE_LIMIT) {
    values.push(value);
    return;
  }
  state.seed = (Math.imul(state.seed ^ state.seen, 1664525) + 1013904223) >>> 0;
  const index = state.seed % state.seen;
  if (index < SAMPLE_LIMIT) values[index] = value;
};
const metrics = {
  filesSeen: 0,
  filesInvalid: 0,
  profilesSkippedOutsideWindow: 0,
  profilesEligibleForSampling: 0,
  profilesSelected: 0,
  profilesWithoutWindowBaseline: 0,
  profilesWithSnapshots: 0,
  profilesWithChanges: 0,
  profilesWithEligibleActivity: 0,
  observations: 0,
  changedCharts: 0,
  canonicalScoreFacts: 0,
  authoritativeEventWindow: { total: 0, beforeWindow: 0, withinWindow: 0, afterWindow: 0 },
  dailySnapshotCounts: samples(),
  sameSourceIntervalsMinutes: samples(),
  changedChartsPerObservation: samples(),
  updateSpansMinutes: samples(),
  highscoreSpansMinutes: samples(),
  eventLagMinutes: samples(),
  sources: new Map(),
  evidence: new Map([["L0", 0], ["L1", 0], ["L2", 0], ["L3", 0]]),
  evidenceReasons: new Map(),
  fieldAvailability: {
    update_datetime: { present: 0, valid: 0, naive: 0, offsetAware: 0, secondPrecision: 0, subsecondPrecision: 0 },
    highscore_datetime: { present: 0, valid: 0, naive: 0, offsetAware: 0, secondPrecision: 0, subsecondPrecision: 0 }
  },
  observationFields: { ts: 0, observed_at: 0, synced_at: 0, schema_version: 0, import_marker: 0, source_account: 0, content_revision: 0 },
  nativeSessionFields: new Map(sessionFieldNames.map(name => [name, 0])),
  stageCounter: { comparable: 0, increased: 0, unchanged: 0, regressed: 0, totalPositiveDelta: 0, deltaGtOne: 0 },
  regressions: { observations: 0, charts: 0 },
  gap: new Map(gapMinutes.map(gap => [gap, {
    clusters: 0, events: 0, durationsMinutes: samples(), singleEventClusters: 0,
    multiObservationClusters: 0, clustersOverThreeHours: 0,
    observationsWithEvents: 0, observationsSplitIntoMultipleClusters: 0,
    activeProfileDays: 0, profileDaysWithMultipleClusters: 0
  }]))
};

const increment = (map, key, amount = 1) => map.set(key, (map.get(key) || 0) + amount);
const safeSource = value => {
  const source = String(value || "unknown").trim().toLowerCase().replaceAll("_", "-");
  return knownSources.has(source) ? source : "other";
};
const localIsoEpoch = value => {
  const text = String(value || "").trim();
  if (!text) return Number.NaN;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d{1,6}))?$/);
  if (compact) {
    const millis = String(compact[7] || "").padEnd(3, "0").slice(0, 3);
    return Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.${millis}+08:00`);
  }
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text.replace(" ", "T")}+08:00`
    : text;
  return Date.parse(normalized);
};
const timestampFromName = name => {
  const dashed = name.match(/^data_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
  if (dashed) return Date.parse(`${dashed[1]}-${dashed[2]}-${dashed[3]}T${dashed[4]}:${dashed[5]}:${dashed[6]}+08:00`);
  const compact = name.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d{1,6}))?/);
  if (!compact) return Number.NaN;
  const millis = String(compact[7] || "").padEnd(3, "0").slice(0, 3);
  return Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.${millis}+08:00`);
};
const sourceFromName = name => viewerWriterSources.find(source => name.includes(`_${source}.json`)) || "";
const chartKey = song => `${Number(song?.song_no || 0)}:${Number(song?.level || 0)}`;
const comparableSong = song => JSON.stringify(song);
const num = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const crown = song => {
  const clear = num(song?.clear_cnt);
  const fullCombo = num(song?.full_combo_cnt);
  const dondaful = num(song?.dondaful_combo_cnt);
  if ([clear, fullCombo, dondaful].some(value => value === null)) return null;
  return dondaful > 0 ? 2 : fullCombo > 0 ? 1 : clear > 0 ? 0 : -1;
};
const judgments = song => {
  const values = [num(song?.good_cnt), num(song?.ok_cnt), num(song?.ng_cnt)];
  return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
};
const percentile = (values, fraction) => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return Number(ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))].toFixed(2));
};
const distribution = values => {
  const state = sampleState.get(values) || { seen: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
  return ({
  count: state.seen,
  sampleCount: values.length,
  min: state.seen ? Number(state.min.toFixed(2)) : null,
  p50: percentile(values, 0.5),
  p90: percentile(values, 0.9),
  p95: percentile(values, 0.95),
  max: state.seen ? Number(state.max.toFixed(2)) : null
  });
};
const shanghaiDay = epoch => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
}).format(epoch);
const classifyTimestamp = (field, raw) => {
  const text = String(raw || "").trim();
  if (!text) return;
  const target = metrics.fieldAvailability[field];
  target.present += 1;
  const parsed = localIsoEpoch(text);
  if (Number.isFinite(parsed)) target.valid += 1;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) target.offsetAware += 1;
  else target.naive += 1;
  if (/\.\d+/.test(text)) target.subsecondPrecision += 1;
  else if (/\d{2}:\d{2}:\d{2}/.test(text)) target.secondPrecision += 1;
};
const isExcluded = (source, meta, filenameSource) => {
  const imported = Boolean(meta.imported_via || meta.importedVia || meta.import_marker || meta.importMarker);
  if (imported || source.startsWith("kinoko") || filenameSource.startsWith("kinoko")) return "import";
  if (source.startsWith("manual") || filenameSource.startsWith("manual")) return "manual";
  if ([source, filenameSource].some(value => value.includes("repair") || value.includes("backfill") || value.includes("migration"))) return "repair";
  if ([source, filenameSource].some(value => value === "web-account" || value === "web-score-import")) return "content-edit";
  if (source === "sakura-bot-sync") return "dispatcher-transfer";
  if (!new Set(["wahlap", "hiroba"]).has(source)) return "unknown-source";
  return "";
};
const observationTime = (meta, name) => {
  for (const value of [meta.observed_at, meta.observedAt, meta.synced_at, meta.ts]) {
    const parsed = localIsoEpoch(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return timestampFromName(name);
};
const clustersFor = (events, gap) => {
  const sorted = [...events].sort((left, right) => left.epoch - right.epoch || left.observation - right.observation);
  const result = [];
  for (const event of sorted) {
    const current = result.at(-1);
    if (!current || event.source !== current.source || event.epoch - current.to > gap * 60_000) {
      result.push({ source: event.source, from: event.epoch, to: event.epoch, events: [event] });
    } else {
      current.to = event.epoch;
      current.events.push(event);
    }
  }
  return result;
};

async function inspectProfile(directory) {
  const allNames = (await readdir(directory).catch(() => []))
    .filter(name => name.startsWith("data_") && name.endsWith(".json"))
    .sort((left, right) => timestampFromName(left) - timestampFromName(right) || left.localeCompare(right));
  if (!allNames.length) return;
  const firstWindowIndex = allNames.findIndex(name => {
    const timestamp = timestampFromName(name);
    return Number.isFinite(timestamp) && timestamp >= from && timestamp <= now;
  });
  if (firstWindowIndex < 0) {
    return;
  }
  // Match the existing Growth History 2,000-file replay boundary while
  // retaining enough pre-window evidence to reconstruct recent deltas.
  const historyStartIndex = Math.max(0, firstWindowIndex - 2_000);
  const names = allNames.slice(historyStartIndex).filter(name => {
    const timestamp = timestampFromName(name);
    return !Number.isFinite(timestamp) || timestamp <= now;
  });
  let state = new Map();
  let sawFullBeforeWindow = false;
  let profileHasSnapshot = false;
  let profileHasChange = false;
  let profileHasEligible = false;
  const daily = new Map();
  const lastSourceObservation = new Map();
  const eligibleEvents = [];
  let observationIndex = 0;

  for (const name of names) {
    metrics.filesSeen += 1;
    let payload;
    try {
      payload = JSON.parse(await readFile(resolve(directory, name), "utf8"));
    } catch {
      metrics.filesInvalid += 1;
      continue;
    }
    if (!payload || !Array.isArray(payload.songs)) {
      metrics.filesInvalid += 1;
      continue;
    }
    const meta = payload._meta && typeof payload._meta === "object" ? payload._meta : {};
    const observedAt = observationTime(meta, name);
    const filenameSource = safeSource(sourceFromName(name));
    const source = safeSource(filenameSource !== "unknown" && filenameSource !== "other" ? filenameSource : meta.source);
    const full = meta.full === true || (!Object.keys(meta).length && payload.profile && payload.achievement);
    if (full && Number.isFinite(observedAt) && observedAt <= from) sawFullBeforeWindow = true;
    const next = full ? new Map() : new Map(state);
    const changed = [];
    for (const song of payload.songs) {
      const key = chartKey(song);
      const before = state.get(key);
      if (!before || comparableSong(before) !== comparableSong(song)) changed.push({ key, before, after: song });
      next.set(key, song);
    }
    if (Array.isArray(payload.songs_removed)) {
      for (const key of payload.songs_removed) next.delete(Array.isArray(key) ? `${key[0]}:${key[1]}` : String(key));
    }
    state = next;
    if (!Number.isFinite(observedAt) || observedAt < from || observedAt > now) continue;

    profileHasSnapshot = true;
    observationIndex += 1;
    metrics.observations += 1;
    metrics.changedCharts += changed.length;
    addSample(metrics.changedChartsPerObservation, changed.length);
    if (changed.length) profileHasChange = true;
    const day = shanghaiDay(observedAt);
    daily.set(day, (daily.get(day) || 0) + 1);
    const previousObserved = lastSourceObservation.get(source);
    if (Number.isFinite(previousObserved)) addSample(metrics.sameSourceIntervalsMinutes, (observedAt - previousObserved) / 60_000);
    lastSourceObservation.set(source, observedAt);

    if (!metrics.sources.has(source)) metrics.sources.set(source, { observations: 0, changedCharts: 0 });
    metrics.sources.get(source).observations += 1;
    metrics.sources.get(source).changedCharts += changed.length;

    if (meta.ts !== undefined) metrics.observationFields.ts += 1;
    if (meta.observed_at !== undefined || meta.observedAt !== undefined) metrics.observationFields.observed_at += 1;
    if (meta.synced_at !== undefined) metrics.observationFields.synced_at += 1;
    if (meta.schema_version !== undefined) metrics.observationFields.schema_version += 1;
    if (meta.imported_via !== undefined || meta.importedVia !== undefined || meta.import_marker !== undefined || meta.importMarker !== undefined) metrics.observationFields.import_marker += 1;
    if (meta.source_account !== undefined || meta.sourceAccount !== undefined) metrics.observationFields.source_account += 1;
    if (meta.content_sha256 !== undefined || meta.revision !== undefined || meta.content_revision !== undefined) metrics.observationFields.content_revision += 1;
    for (const field of sessionFieldNames) if (meta[field] !== undefined) increment(metrics.nativeSessionFields, field);

    let excludedReason = isExcluded(source, meta, filenameSource);
    const updateTimes = [];
    const highscoreTimes = [];
    const pendingEligible = [];
    const pendingEventLags = [];
    const pendingEventWindow = { total: 0, beforeWindow: 0, withinWindow: 0, afterWindow: 0 };
    let pendingFacts = 0;
    let observationRegressed = false;
    for (const item of changed) {
      classifyTimestamp("update_datetime", item.after.update_datetime);
      classifyTimestamp("highscore_datetime", item.after.highscore_datetime);
      const updateAt = localIsoEpoch(item.after.update_datetime);
      const highscoreAt = localIsoEpoch(item.after.highscore_datetime);
      if (Number.isFinite(updateAt)) updateTimes.push(updateAt);
      if (Number.isFinite(highscoreAt)) highscoreTimes.push(highscoreAt);
      const beforeStage = num(item.before?.stage_cnt);
      const afterStage = num(item.after?.stage_cnt);
      if (beforeStage !== null && afterStage !== null) {
        metrics.stageCounter.comparable += 1;
        if (afterStage > beforeStage) {
          metrics.stageCounter.increased += 1;
          metrics.stageCounter.totalPositiveDelta += afterStage - beforeStage;
          if (afterStage - beforeStage > 1) metrics.stageCounter.deltaGtOne += 1;
        } else if (afterStage === beforeStage) metrics.stageCounter.unchanged += 1;
        else {
          metrics.stageCounter.regressed += 1;
          metrics.regressions.charts += 1;
          observationRegressed = true;
        }
      }
      const regressionFields = ["high_score", "clear_cnt", "full_combo_cnt", "dondaful_combo_cnt"];
      if (item.before && regressionFields.some(field => num(item.before[field]) !== null && num(item.after[field]) !== null && num(item.after[field]) < num(item.before[field]))) {
        metrics.regressions.charts += 1;
        observationRegressed = true;
      }

      const eventAt = Number.isFinite(updateAt) ? updateAt : highscoreAt;
      if (!excludedReason && source === "wahlap" && Number.isFinite(eventAt)) {
        const signature = createHash("sha256").update(`${source}\n${item.key}\n${eventAt}\n${item.after.stage_cnt ?? ""}\n${item.after.high_score ?? ""}`).digest("hex").slice(0, 20);
        pendingEventWindow.total += 1;
        pendingEventLags.push((observedAt - eventAt) / 60_000);
        const eventInWindow = eventAt >= from && eventAt <= now;
        if (eventAt < from) pendingEventWindow.beforeWindow += 1;
        else if (eventAt > now) pendingEventWindow.afterWindow += 1;
        else {
          pendingEventWindow.withinWindow += 1;
          pendingEligible.push({ epoch: eventAt, observedAt, observation: observationIndex, source, signature });
        }
        let chartFacts = 0;
        if (item.before) {
          const beforeScore = num(item.before.high_score);
          const afterScore = num(item.after.high_score);
          if (Number.isFinite(highscoreAt) && highscoreAt >= from && highscoreAt <= now && beforeScore !== null && afterScore !== null && afterScore > beforeScore) {
            chartFacts += 1;
            const beforeJudgments = judgments(item.before);
            const afterJudgments = judgments(item.after);
            if (beforeJudgments !== null && beforeJudgments > 0 && beforeJudgments === afterJudgments) {
              if (num(item.before.ng_cnt) !== null && num(item.after.ng_cnt) !== null && num(item.after.ng_cnt) < num(item.before.ng_cnt)) chartFacts += 1;
              if (num(item.before.combo_cnt) !== null && num(item.after.combo_cnt) !== null && num(item.after.combo_cnt) > num(item.before.combo_cnt)) chartFacts += 1;
            }
          }
          if (Number.isFinite(updateAt) && updateAt >= from && updateAt <= now) {
            const beforeCrown = crown(item.before);
            const afterCrown = crown(item.after);
            if (beforeCrown !== null && afterCrown !== null && afterCrown > beforeCrown) chartFacts += 1;
            const beforeRank = num(item.before.best_score_rank);
            const afterRank = num(item.after.best_score_rank);
            if (beforeRank !== null && afterRank !== null && beforeRank >= 1 && afterRank <= 8 && afterRank > beforeRank) chartFacts += 1;
          }
        }
        if (eventInWindow) pendingFacts += Math.max(1, chartFacts);
      }
    }
    if (observationRegressed) {
      metrics.regressions.observations += 1;
      excludedReason ||= "counter-regression";
    }
    if (excludedReason) {
      increment(metrics.evidence, "L0");
      increment(metrics.evidenceReasons, excludedReason);
    } else {
      // Neither source currently provides a source-native sequence/cursor or session id.
      increment(metrics.evidence, "L1");
      increment(metrics.evidenceReasons, source === "hiroba" ? "synthetic-chart-time" : "no-source-sequence-or-session-id");
      eligibleEvents.push(...pendingEligible);
      metrics.canonicalScoreFacts += pendingFacts;
      for (const lag of pendingEventLags) addSample(metrics.eventLagMinutes, lag);
      for (const key of Object.keys(pendingEventWindow)) metrics.authoritativeEventWindow[key] += pendingEventWindow[key];
      if (pendingEligible.length) profileHasEligible = true;
    }
    if (updateTimes.length > 1) addSample(metrics.updateSpansMinutes, (Math.max(...updateTimes) - Math.min(...updateTimes)) / 60_000);
    if (highscoreTimes.length > 1) addSample(metrics.highscoreSpansMinutes, (Math.max(...highscoreTimes) - Math.min(...highscoreTimes)) / 60_000);
  }

  if (profileHasSnapshot) metrics.profilesWithSnapshots += 1;
  if (profileHasChange) metrics.profilesWithChanges += 1;
  if (profileHasEligible) metrics.profilesWithEligibleActivity += 1;
  if (!sawFullBeforeWindow) metrics.profilesWithoutWindowBaseline += 1;
  for (const value of daily.values()) addSample(metrics.dailySnapshotCounts, value);

  const dedupedEvents = [...new Map(eligibleEvents.map(event => [event.signature, event])).values()];
  for (const gap of gapMinutes) {
    const target = metrics.gap.get(gap);
    const clusters = clustersFor(dedupedEvents, gap);
    target.clusters += clusters.length;
    target.events += dedupedEvents.length;
    for (const cluster of clusters) {
      addSample(target.durationsMinutes, (cluster.to - cluster.from) / 60_000);
      if (cluster.events.length === 1) target.singleEventClusters += 1;
      if (new Set(cluster.events.map(event => event.observation)).size > 1) target.multiObservationClusters += 1;
      if (cluster.to - cluster.from > 180 * 60_000) target.clustersOverThreeHours += 1;
    }
    const byObservation = new Map();
    for (const event of dedupedEvents) {
      const bucket = byObservation.get(event.observation) || [];
      bucket.push(event);
      byObservation.set(event.observation, bucket);
    }
    target.observationsWithEvents += byObservation.size;
    for (const bucket of byObservation.values()) if (clustersFor(bucket, gap).length > 1) target.observationsSplitIntoMultipleClusters += 1;
    const byDay = new Map();
    for (const cluster of clusters) {
      for (const day of new Set(cluster.events.map(event => shanghaiDay(event.epoch)))) {
        const key = `${cluster.source}:${day}`;
        byDay.set(key, (byDay.get(key) || 0) + 1);
      }
    }
    target.activeProfileDays += byDay.size;
    target.profileDaysWithMultipleClusters += [...byDay.values()].filter(count => count > 1).length;
  }
}

const startedAt = performance.now();
const entries = await readdir(userdataDir, { withFileTypes: true });
const candidateProfiles = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const directory = resolve(userdataDir, entry.name);
  const names = await readdir(directory).catch(() => []);
  const windowObservations = names.reduce((count, name) => {
    if (!name.startsWith("data_") || !name.endsWith(".json")) return count;
    const timestamp = timestampFromName(name);
    return Number.isFinite(timestamp) && timestamp >= from && timestamp <= now ? count + 1 : count;
  }, 0);
  if (windowObservations) candidateProfiles.push({ directory, windowObservations });
  else metrics.profilesSkippedOutsideWindow += 1;
}
candidateProfiles.sort((left, right) => right.windowObservations - left.windowObservations || left.directory.localeCompare(right.directory));
metrics.profilesEligibleForSampling = candidateProfiles.length;
const selectedProfiles = candidateProfiles.slice(0, maxProfiles);
metrics.profilesSelected = selectedProfiles.length;
for (const profile of selectedProfiles) {
  // Directory identities remain process-local and are never logged or retained in the report.
  await inspectProfile(profile.directory);
}

const sourceDistribution = Object.fromEntries([...metrics.sources.entries()].sort(([left], [right]) => left.localeCompare(right)));
const evidenceTotal = [...metrics.evidence.values()].reduce((sum, value) => sum + value, 0);
const evidenceLevels = Object.fromEntries([...metrics.evidence.entries()].map(([level, count]) => [level, {
  count,
  proportion: evidenceTotal ? Number((count / evidenceTotal).toFixed(4)) : 0
}]));
const gapAnalysis = Object.fromEntries([...metrics.gap.entries()].map(([gap, value]) => [String(gap), {
  clusters: value.clusters,
  events: value.events,
  averageEventsPerCluster: value.clusters ? Number((value.events / value.clusters).toFixed(2)) : null,
  durationMinutes: distribution(value.durationsMinutes),
  singleEventClusterProportion: value.clusters ? Number((value.singleEventClusters / value.clusters).toFixed(4)) : null,
  multiObservationClusterProportion: value.clusters ? Number((value.multiObservationClusters / value.clusters).toFixed(4)) : null,
  clustersOverThreeHoursProportion: value.clusters ? Number((value.clustersOverThreeHours / value.clusters).toFixed(4)) : null,
  observationSplitProxy: {
    denominator: value.observationsWithEvents,
    count: value.observationsSplitIntoMultipleClusters,
    proportion: value.observationsWithEvents ? Number((value.observationsSplitIntoMultipleClusters / value.observationsWithEvents).toFixed(4)) : null
  },
  sameDayMultipleClusterProxy: {
    denominator: value.activeProfileDays,
    count: value.profileDaysWithMultipleClusters,
    proportion: value.activeProfileDays ? Number((value.profileDaysWithMultipleClusters / value.activeProfileDays).toFixed(4)) : null
  }
}]));
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  window: { days, from: new Date(from).toISOString(), to: new Date(now).toISOString(), timezone: "Asia/Shanghai" },
  privacy: { identifiersEmitted: false, payloadsEmitted: false, aggregateOnly: true },
  corpus: {
    profilesWithSnapshots: metrics.profilesWithSnapshots,
    profilesWithChanges: metrics.profilesWithChanges,
    profilesWithEligibleActivity: metrics.profilesWithEligibleActivity,
    profilesSkippedOutsideWindow: metrics.profilesSkippedOutsideWindow,
    profilesEligibleForSampling: metrics.profilesEligibleForSampling,
    profilesSelected: metrics.profilesSelected,
    selection: `top-${maxProfiles}-by-window-observation-count`,
    profilesWithoutWindowBaseline: metrics.profilesWithoutWindowBaseline,
    filesSeen: metrics.filesSeen,
    invalidFiles: metrics.filesInvalid,
    observations: metrics.observations,
    changedCharts: metrics.changedCharts,
    canonicalScoreFacts: metrics.canonicalScoreFacts,
    authoritativeEventWindow: metrics.authoritativeEventWindow
  },
  distributions: {
    snapshotsPerProfileDay: distribution(metrics.dailySnapshotCounts),
    sameSourceSnapshotIntervalMinutes: distribution(metrics.sameSourceIntervalsMinutes),
    changedChartsPerObservation: distribution(metrics.changedChartsPerObservation),
    updateDatetimeSpanPerObservationMinutes: distribution(metrics.updateSpansMinutes),
    highscoreDatetimeSpanPerObservationMinutes: distribution(metrics.highscoreSpansMinutes),
    observationMinusEventMinutes: distribution(metrics.eventLagMinutes)
  },
  sourceDistribution,
  observationMetadataAvailability: metrics.observationFields,
  chartTimestampAvailability: metrics.fieldAvailability,
  nativeSessionFieldPresence: Object.fromEntries(metrics.nativeSessionFields),
  stageCounter: metrics.stageCounter,
  regressions: metrics.regressions,
  evidenceLevels,
  evidenceReasons: Object.fromEntries([...metrics.evidenceReasons.entries()].sort(([left], [right]) => left.localeCompare(right))),
  gapAnalysis,
  interpretationLimits: [
    "Cluster inputs are changed-chart timestamps, not individual play events.",
    "A stage_cnt delta greater than one still has only the row's latest update_datetime.",
    "False split and false merge labels are unavailable because production history has no ground-truth session id.",
    "Proxy rates describe ambiguity and must not be interpreted as measured classification error."
  ],
  wallTimeMs: Number((performance.now() - startedAt).toFixed(2)),
  maxRssMiB: Number((process.resourceUsage().maxRSS / 1024).toFixed(2))
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  const parent = resolve(outputPath, "..");
  const parentStat = await stat(parent).catch(() => null);
  if (!parentStat?.isDirectory()) throw new Error("output parent does not exist");
  await writeFile(outputPath, serialized, "utf8");
}
process.stdout.write(serialized);
