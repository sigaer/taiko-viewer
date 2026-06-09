import type { GuideDifficultyOption, GuideSummaryKey } from "~/types/content";

export const GUIDE_DIFFICULTY_OPTIONS: GuideDifficultyOption[] = [
  { value: 1, label: "简单", max: 5, iconImage: "/kantan.png" },
  { value: 2, label: "普通", max: 7, iconImage: "/futsuu.png" },
  { value: 3, label: "困难", max: 8, iconImage: "/muzukashii.png" },
  { value: 4, label: "魔王", max: 10, iconImage: "/oni.png" }
];

export const GUIDE_TAGS = [
  { id: 1, label: "诈称+" },
  { id: 2, label: "诈称" },
  { id: 3, label: "强" },
  { id: 4, label: "中" },
  { id: 5, label: "弱" },
  { id: 6, label: "逆诈称" },
  { id: 7, label: "逆诈称-" }
] as const;

export const GUIDE_SUMMARY_KEY_BY_TAG_ID: Record<number, Exclude<GuideSummaryKey, "total">> = {
  1: "overPlus",
  2: "over",
  3: "strong",
  4: "middle",
  5: "weak",
  6: "under",
  7: "underMinus"
};

export const GUIDE_SUMMARY_KEYS: GuideSummaryKey[] = [
  "overPlus",
  "over",
  "strong",
  "middle",
  "weak",
  "under",
  "underMinus",
  "total"
];

export const getGuideDifficultyOption = (difficulty: number) =>
  GUIDE_DIFFICULTY_OPTIONS.find((item) => item.value === difficulty) || null;
