#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { deriveProgressForRange } from "../utils/dailyProgress.ts";
import { growthCalendarDay } from "../utils/playerGrowth.ts";
import { SESSIONIZATION_AUDIT_VERSION } from "../server/services/growth-session/audit.ts";

const userdataDir = resolve(process.env.TAIKO_USERDATA_DIR || "/home/sigaer/taiko/userdata");
const now = Date.now();
const from = now - 90 * 86_400_000;
const fileLimit = 2_000;

const timestampFromName = name => {
  const dashed = name.match(/^data_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
  if (dashed) return Date.parse(`${dashed[1]}-${dashed[2]}-${dashed[3]}T${dashed[4]}:${dashed[5]}:${dashed[6]}+08:00`);
  const compact = name.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d{1,6}))?/);
  if (!compact) return Number.NaN;
  const millis = String(compact[7] || "").padEnd(3, "0").slice(0, 3);
  return Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.${millis}+08:00`);
};
const normalizeTimestamp = value => {
  const text = String(value || "").trim();
  if (!text) return "";
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d{1,6}))?$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}+08:00`;
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text.replace(" ", "T")}+08:00`
    : text;
};

const startedAt = performance.now();
const entries = await readdir(userdataDir, { withFileTypes: true });
const candidates = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const directory = resolve(userdataDir, entry.name);
  const names = (await readdir(directory).catch(() => []))
    .filter(name => name.startsWith("data_") && name.endsWith(".json"))
    .sort((left, right) => timestampFromName(left) - timestampFromName(right) || left.localeCompare(right));
  const count = names.filter(name => {
    const timestamp = timestampFromName(name);
    return Number.isFinite(timestamp) && timestamp >= from && timestamp <= now;
  }).length;
  if (count) candidates.push({ directory, key: entry.name, count, names });
}
candidates.sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
const selected = candidates[0];
if (!selected) throw new Error("no eligible production history sample");
const indexMs = performance.now() - startedAt;

const loadStartedAt = performance.now();
const selectedNames = selected.names.slice(-fileLimit);
const snapshots = [];
let invalidFiles = 0;
for (const name of selectedNames) {
  try {
    const raw = await readFile(resolve(selected.directory, name), "utf8");
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.songs)) {
      invalidFiles += 1;
      continue;
    }
    const meta = payload._meta && typeof payload._meta === "object" ? payload._meta : {};
    const timestamp = normalizeTimestamp(meta.observed_at || meta.observedAt || meta.synced_at || meta.ts) || new Date(timestampFromName(name)).toISOString();
    snapshots.push({
      full: meta.full === true || (!Object.keys(meta).length && payload.profile && payload.achievement),
      timestamp,
      songs: payload.songs,
      revision: createHash("sha256").update(raw).digest("hex"),
      source: String(meta.source || "unknown")
    });
  } catch {
    invalidFiles += 1;
  }
}
let current = { songs: [] };
let currentRevision = "";
try {
  const raw = await readFile(resolve(userdataDir, `${selected.key}data.json`), "utf8");
  current = JSON.parse(raw);
  currentRevision = createHash("sha256").update(raw).digest("hex");
} catch {
  // The benchmark can still replay retained history if the current projection is absent.
}
const loadMs = performance.now() - loadStartedAt;

const fromDay = growthCalendarDay(new Date(from).toISOString());
const toDay = growthCalendarDay(new Date(now).toISOString());
const replayStartedAt = performance.now();
const days = deriveProgressForRange(current.songs || [], snapshots, fromDay, toDay, () => "[redacted]", currentRevision);
const facts = days.flatMap(day => day.events.flatMap(event => event.facts.map(fact => ({
  type: fact.type,
  occurredAt: event.factOccurredAt?.[fact.type] || event.occurredAt || ""
}))));
const replayMs = performance.now() - replayStartedAt;

const compositionStartedAt = performance.now();
const eventTimes = [...new Set(facts.map(fact => Date.parse(fact.occurredAt)).filter(Number.isFinite))].sort((left, right) => left - right);
const gapMs = 45 * 60_000;
let candidatesAt45Minutes = 0;
let previous = Number.NaN;
for (const epoch of eventTimes) {
  if (!Number.isFinite(previous) || epoch - previous > gapMs) candidatesAt45Minutes += 1;
  previous = epoch;
}
const compositionMs = performance.now() - compositionStartedAt;

const report = {
  schemaVersion: 1,
  privacy: { identifiersEmitted: false, payloadsEmitted: false, aggregateOnly: true },
  selection: "highest-90-day-observation-count",
  rangeDays: 90,
  historyFileLimit: fileLimit,
  snapshotsRead: snapshots.length,
  invalidFiles,
  facts: facts.length,
  factEventTimes: eventTimes.length,
  candidatesAt45Minutes,
  sessionizationVersion: SESSIONIZATION_AUDIT_VERSION,
  timingMs: {
    corpusIndex: Number(indexMs.toFixed(2)),
    historyLoad: Number(loadMs.toFixed(2)),
    canonicalReplay: Number(replayMs.toFixed(2)),
    sessionComposition: Number(compositionMs.toFixed(2)),
    total: Number((performance.now() - startedAt).toFixed(2))
  },
  maxRssMiB: Number((process.resourceUsage().maxRSS / 1024).toFixed(2))
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
