import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { GrowthSnapshot } from "~/utils/dailyProgress";
import { growthCalendarDay } from "~/utils/playerGrowth";
import { getRuntimePaths, type UserdataPayload } from "~/server/internal/account/shared";
import { GROWTH_HISTORY_FILE_LIMIT } from "./constants";

export type GrowthScoreEvidence = {
  snapshots: GrowthSnapshot[];
  totalFiles: number;
  filesRead: number;
  invalidFiles: number;
  truncated: boolean;
  fromDay: string | null;
  toDay: string | null;
};

const isFullPayload = (payload: UserdataPayload) => payload._meta?.full === true || (!payload._meta && Boolean(payload.profile && payload.achievement && Array.isArray(payload.songs)));
const fileTimestamp = (name: string) => {
  const standard = name.match(/^data_(\d{4})-(\d{2})-(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
  if (standard) return `${standard[1]}-${standard[2]}-${standard[3]} ${standard[4]}:${standard[5]}:${standard[6]}`;
  const compact = name.match(/^data_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}:${compact[6]}` : "";
};
const fileOrder = (name: string) => `${fileTimestamp(name).replace(/\D/g, "").padEnd(14, "0")}:${name}`;

export async function loadGrowthScoreEvidence(taikoId: string): Promise<GrowthScoreEvidence> {
  const { userdataDir } = getRuntimePaths();
  const directory = resolve(userdataDir, taikoId);
  const allNames = (await readdir(directory).catch(() => [] as string[])).filter(name => name.startsWith("data_") && name.endsWith(".json")).sort((left, right) => fileOrder(left).localeCompare(fileOrder(right)));
  const names = allNames.slice(-GROWTH_HISTORY_FILE_LIMIT);
  const snapshots: GrowthSnapshot[] = [];
  let invalidFiles = 0;
  for (const name of names) {
    try {
      const raw = await readFile(resolve(directory, name), "utf-8");
      const payload = JSON.parse(raw) as UserdataPayload;
      if (!Array.isArray(payload.songs)) { invalidFiles += 1; continue; }
      const timestamp = String(payload._meta?.observed_at || payload._meta?.observedAt || payload._meta?.synced_at || payload._meta?.ts || fileTimestamp(name));
      snapshots.push({
        full: isFullPayload(payload),
        timestamp,
        songs: payload.songs,
        revision: createHash("sha256").update(raw).digest("hex"),
        source: String(payload._meta?.source || "unknown")
      });
    } catch {
      invalidFiles += 1;
    }
  }
  const days = snapshots.map(snapshot => growthCalendarDay(snapshot.timestamp)).filter(Boolean).sort();
  return {
    snapshots,
    totalFiles: allNames.length,
    filesRead: names.length,
    invalidFiles,
    truncated: allNames.length > names.length,
    fromDay: days[0] || null,
    toDay: days.at(-1) || null
  };
}
