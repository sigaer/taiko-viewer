import type { ChartDifficultyCode, ChartDifficultyVoteValue } from "../../../types/ugc";

export const UGC_DIFFICULTY_CODES = [1, 2, 3, 4, 5] as const satisfies readonly ChartDifficultyCode[];
export const UGC_DIFFICULTY_VOTE_VALUES = [-2, -1, 0, 1, 2] as const satisfies readonly ChartDifficultyVoteValue[];
export const UGC_DIFFICULTY_MINIMUM_SAMPLE = 3;
export const UGC_DIFFICULTY_STRONG_THRESHOLD = 0.5;
export const UGC_TAG_COMMON_MINIMUM = 2;
export const UGC_PUBLIC_MAX_TAGS = 6;
export const UGC_INITIAL_TIP_LIMIT = 3;
export const UGC_ANONYMOUS_DISPLAY_NAME = "已注销用户";
export const UGC_ANONYMOUS_AVATAR_URL = "https://viewer.sakura-bot.cn/miku.png";

export const isChartDifficultyCode = (value: unknown): value is ChartDifficultyCode =>
  UGC_DIFFICULTY_CODES.includes(Number(value) as ChartDifficultyCode);
