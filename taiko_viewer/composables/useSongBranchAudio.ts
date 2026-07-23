import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type {
  SongBranchAudioVariant,
  SongBranchAudioVariants,
  SongTrackKey
} from "~/types/content";

type AudioMode = "drum" | "mix";

export type BranchVariant = SongBranchAudioVariant;

type UseSongBranchAudioOptions = {
  apiBase: string;
  songId: MaybeRefOrGetter<number>;
  selectedTrack: MaybeRefOrGetter<string>;
  branchVariants: MaybeRefOrGetter<SongBranchAudioVariants>;
};

const resolveTrackContext = (songId: MaybeRefOrGetter<number>, selectedTrack: MaybeRefOrGetter<string>) => {
  const id = Number(toValue(songId));
  const track = String(toValue(selectedTrack) || "");

  if (!Number.isFinite(id) || !track) {
    return null;
  }

  return { id, track };
};

export const useSongBranchAudio = ({ apiBase, songId, selectedTrack, branchVariants }: UseSongBranchAudioOptions) => {
  const activeBranchVariants = computed(() => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return [];

    return toValue(branchVariants)?.[context.track as SongTrackKey] || [];
  });

  const hasBranchVariants = computed(() => activeBranchVariants.value.length > 0);

  const getBaseAudioUrl = (mode: AudioMode) => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return "";

    return `${apiBase}/${mode}/${context.id}_${context.track}.mp3`;
  };

  const getVariantAudioUrl = (mode: AudioMode, variant: BranchVariant) => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return "";

    return `${apiBase}/${mode}/${context.id}_${context.track}_${variant.label}.mp3`;
  };

  const getVariantDisplayLabel = (variant: BranchVariant) =>
    [variant.label, ...variant.aliases].join("／");

  const getPureAudioUrl = () => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return "";

    return `${apiBase}/pure/${context.id}.mp3`;
  };

  return {
    activeBranchVariants,
    hasBranchVariants,
    getBaseAudioUrl,
    getVariantAudioUrl,
    getVariantDisplayLabel,
    getPureAudioUrl
  };
};
