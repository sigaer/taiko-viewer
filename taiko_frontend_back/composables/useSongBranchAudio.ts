import { computed, type MaybeRefOrGetter, toValue } from "vue";

type AudioMode = "drum" | "mix";

const branchVariantOptions = ["普通", "玄人", "达人"] as const;
export type BranchVariant = (typeof branchVariantOptions)[number];
const branchVariantTrackMap: Record<number, readonly string[]> = {
  27: ["HARD"],
  33: ["ONI"],
  60: ["HARD"],
  61: ["HARD"],
  64: ["ONI"],
  65: ["ONI"],
  66: ["ONI"],
  67: ["ONI"],
  79: ["ONI"],
  90: ["HARD"],
  99: ["HARD"],
  109: ["ONI"],
  135: ["EDIT", "ONI"],
  153: ["EDIT"],
  156: ["EDIT"],
  173: ["ONI"],
  182: ["ONI"],
  223: ["ONI"],
  231: ["EDIT"],
  248: ["HARD"],
  269: ["HARD", "ONI"],
  281: ["ONI"],
  283: ["HARD"],
  288: ["HARD"],
  314: ["HARD"],
  343: ["ONI"],
  354: ["ONI"],
  362: ["ONI"],
  383: ["ONI"],
  386: ["ONI"],
  392: ["EASY", "NORMAL", "HARD", "ONI"],
  412: ["EASY", "NORMAL", "HARD", "ONI"],
  425: ["HARD", "ONI"],
  453: ["HARD"],
  462: ["HARD"],
  478: ["EDIT", "ONI"],
  514: ["ONI"],
  547: ["ONI"],
  554: ["ONI"],
  579: ["EDIT", "ONI"],
  617: ["ONI"],
  627: ["EASY", "NORMAL", "HARD", "ONI"],
  644: ["EASY", "NORMAL", "HARD", "ONI"],
  650: ["EASY", "NORMAL", "HARD", "ONI"],
  653: ["ONI"],
  664: ["EDIT"],
  689: ["HARD"],
  775: ["EDIT", "ONI"],
  869: ["ONI"],
  880: ["EASY", "NORMAL", "HARD", "ONI"],
  955: ["HARD"],
  1027: ["EASY", "NORMAL", "HARD", "ONI"],
  1032: ["EDIT"],
  1037: ["ONI"],
  1045: ["ONI"],
  1070: ["ONI"],
  1081: ["EDIT", "ONI"],
  1131: ["HARD"],
  1140: ["EDIT"],
  1144: ["EDIT"],
  1265: ["EDIT"],
  1270: ["HARD"],
  1272: ["ONI"],
  1289: ["HARD"],
  1321: ["ONI"],
  1352: ["ONI"],
  1356: ["ONI"]
};

type UseSongBranchAudioOptions = {
  apiBase: string;
  songId: MaybeRefOrGetter<number>;
  selectedTrack: MaybeRefOrGetter<string>;
};

const resolveTrackContext = (songId: MaybeRefOrGetter<number>, selectedTrack: MaybeRefOrGetter<string>) => {
  const id = Number(toValue(songId));
  const track = String(toValue(selectedTrack) || "");

  if (!Number.isFinite(id) || !track) {
    return null;
  }

  return { id, track };
};

export const useSongBranchAudio = ({ apiBase, songId, selectedTrack }: UseSongBranchAudioOptions) => {
  const activeBranchVariants = computed(() => {
    const context = resolveTrackContext(songId, selectedTrack);
    if (!context) return [];

    const supportedTracks = branchVariantTrackMap[context.id];
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

  return {
    activeBranchVariants,
    hasBranchVariants,
    getBaseAudioUrl,
    getVariantAudioUrl
  };
};
