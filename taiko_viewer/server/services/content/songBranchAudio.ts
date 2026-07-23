import type {
  SongBranchAudioLabel,
  SongBranchAudioVariant,
  SongBranchAudioVariants,
  SongTrackKey
} from "~/types/content";
import { getContentRuntimePaths, readCachedJsonFile } from "./runtime";

type ManifestVariant = {
  label?: unknown;
  aliases?: unknown;
  available?: unknown;
};

type BranchAudioManifest = {
  songs?: Record<string, Partial<Record<SongTrackKey, ManifestVariant[]>>>;
};

const TRACKS = new Set<SongTrackKey>(["EASY", "NORMAL", "HARD", "ONI", "EDIT"]);
const LABELS = new Set<SongBranchAudioLabel>(["普通", "玄人", "达人"]);

let manifestCache: { mtimeMs: number; data: BranchAudioManifest } | null = null;

const toLabel = (value: unknown): SongBranchAudioLabel | null => {
  const label = String(value || "") as SongBranchAudioLabel;
  return LABELS.has(label) ? label : null;
};

const normalizeVariant = (value: ManifestVariant): SongBranchAudioVariant | null => {
  if (!value || value.available === false) return null;
  const label = toLabel(value.label);
  if (!label) return null;
  const aliases = Array.isArray(value.aliases)
    ? value.aliases
        .map(toLabel)
        .filter((item): item is SongBranchAudioLabel => !!item && item !== label)
    : [];
  return {
    label,
    aliases: Array.from(new Set(aliases))
  };
};

const loadManifest = async () => {
  const { branchAudioManifestPath } = getContentRuntimePaths();
  const result = await readCachedJsonFile<BranchAudioManifest>(manifestCache, branchAudioManifestPath);
  manifestCache = result.cache;
  return result.data;
};

export const getSongBranchAudioVariants = async (songId: number): Promise<SongBranchAudioVariants> => {
  try {
    const manifest = await loadManifest();
    const rawTracks = manifest.songs?.[String(songId)] || {};
    const variants: SongBranchAudioVariants = {};

    for (const [trackValue, rawVariants] of Object.entries(rawTracks)) {
      const track = trackValue as SongTrackKey;
      if (!TRACKS.has(track) || !Array.isArray(rawVariants)) continue;
      const normalized = rawVariants
        .map(normalizeVariant)
        .filter((item): item is SongBranchAudioVariant => !!item);
      if (normalized.length) {
        variants[track] = normalized;
      }
    }
    return variants;
  } catch {
    return {};
  }
};
