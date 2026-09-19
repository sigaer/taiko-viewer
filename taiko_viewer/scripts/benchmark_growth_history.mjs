import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { deriveProgressForRange } from "../utils/dailyProgress.ts";
import { projectScoreFacts } from "../utils/growthHistory.ts";
import { growthCalendarDay } from "../utils/playerGrowth.ts";

const userdataDir = resolve(String(process.env.TAIKO_USERDATA_DIR || resolve(process.cwd(), "../userdata")));
const historyNameTime = name => {
  const standard = name.match(/^data_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
  if (standard) return `${standard[1]}-${standard[2]}-${standard[3]} ${standard[4]}:${standard[5]}:${standard[6]}`;
  const compact = name.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}:${compact[6]}` : "";
};
const historyNameOrder = name => `${historyNameTime(name).replace(/\D/g, "").padEnd(14, "0")}:${name}`;
const entries = await readdir(userdataDir, { withFileTypes: true });
let candidate = null;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const names = (await readdir(resolve(userdataDir, entry.name)).catch(() => [])).filter(name => name.startsWith("data_") && name.endsWith(".json")).sort((left, right) => historyNameOrder(left).localeCompare(historyNameOrder(right)));
  if (!candidate || names.length > candidate.names.length) candidate = { name: entry.name, names };
}
if (!candidate || !candidate.names.length) throw new Error("No score history candidate available");
const selected = candidate.names.slice(-2000);
const loadStarted = performance.now();
const snapshots = [];
let invalidFiles = 0;
for (const name of selected) {
  try {
    const raw = await readFile(resolve(userdataDir, candidate.name, name), "utf8");
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.songs)) { invalidFiles += 1; continue; }
    const fallback = historyNameTime(name);
    snapshots.push({ full: payload._meta?.full === true || (!payload._meta && payload.profile && payload.achievement), timestamp: String(payload._meta?.observed_at || payload._meta?.observedAt || payload._meta?.synced_at || payload._meta?.ts || fallback), songs: payload.songs, revision: createHash("sha256").update(raw).digest("hex") });
  } catch { invalidFiles += 1; }
}
const current = JSON.parse(await readFile(resolve(userdataDir, `${candidate.name}data.json`), "utf8").catch(() => "{\"songs\":[]}"));
const loadMs = performance.now() - loadStarted;
const dated = snapshots.map(snapshot => growthCalendarDay(snapshot.timestamp)).filter(Boolean).sort();
const lastDay = dated.at(-1) || growthCalendarDay(new Date());
const firstDay = dated[0] || lastDay;
const ranges = [7, 30, 90].map(days => ({ label: `${days}d`, from: new Date(Date.parse(`${lastDay}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10), to: lastDay }));
ranges.push({ label: "full-history", from: firstDay, to: lastDay });
const results = [];
for (const range of ranges) {
  const before = process.memoryUsage();
  const started = performance.now();
  const days = deriveProgressForRange(current.songs || [], snapshots, range.from, range.to, song => String(song.song_no || ""));
  const facts = projectScoreFacts(1, 1, days);
  const elapsed = performance.now() - started;
  const after = process.memoryUsage();
  results.push({ range: range.label, days: days.length, replayMs: Number(elapsed.toFixed(2)), rssDeltaMiB: Number(((after.rss - before.rss) / 1048576).toFixed(2)), heapDeltaMiB: Number(((after.heapUsed - before.heapUsed) / 1048576).toFixed(2)), facts: facts.length });
}
console.log(JSON.stringify({ historyFilesAvailable: candidate.names.length, historyFilesRead: selected.length, snapshotsParsed: snapshots.length, invalidFiles, truncated: candidate.names.length > selected.length, loadMs: Number(loadMs.toFixed(2)), results }, null, 2));
