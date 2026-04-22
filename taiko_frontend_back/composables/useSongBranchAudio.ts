import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { SongTrackKey } from "~/types/content";

type AudioMode = "drum" | "mix";

const branchVariantOptions = ["普通", "玄人", "达人"] as const;
export type BranchVariant = (typeof branchVariantOptions)[number];

type UseSongBranchAudioOptions = {
  apiBase: string;
  songId: MaybeRefOrGetter<number>;
  selectedTrack: MaybeRefOrGetter<string>;
  branchTracks: MaybeRefOrGetter<readonly SongTrackKey[]>;
};

const resolveTrackContext = (songId: MaybeRefOrGetter<number>, selectedTrack: MaybeRefOrGetter<string>) => {
  const id = Number(toValue(songId));
  const track = String(toValue(selectedTrack) || "");

  if (!Number.isFinite(id) || !track) {
    return null;
  }

  return { id, track };
};

export const useSongBranchAudio = ({ apiBase, songId, selectedTrack, branchTracks }: UseSongBranchAudioOptions) => {
  const activeBranchVariants = computed(() => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return [];

    const supportedTracks = toValue(branchTracks);
    if (!supportedTracks?.includes(context.track)) return [];

    return [...branchVariantOptions];
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

    return `${apiBase}/${mode}/${context.id}_${context.track}_${variant}.mp3`;
  };

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
    getPureAudioUrl
  };
};
