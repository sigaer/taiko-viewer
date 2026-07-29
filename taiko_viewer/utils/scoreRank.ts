export type ScoreRankLocale = "zh" | "ja";

export const SCORE_RANK_DEFINITIONS = [
  { value: 0, zhName: "未设置", jaName: "未設定", zhOption: "未设置评价", jaOption: "評価未設定" },
  { value: 1, zhName: "未取得", jaName: "未取得", zhOption: "未取得评价", jaOption: "評価未取得" },
  { value: 2, zhName: "白粹", jaName: "白粋", zhOption: "白粹（50万分以上）", jaOption: "白粋（50万点以上）" },
  { value: 3, zhName: "铜粹", jaName: "銅粋", zhOption: "铜粹（60万分以上）", jaOption: "銅粋（60万点以上）" },
  { value: 4, zhName: "银粹", jaName: "銀粋", zhOption: "银粹（70万分以上）", jaOption: "銀粋（70万点以上）" },
  { value: 5, zhName: "金雅", jaName: "金雅", zhOption: "金雅（80万分以上）", jaOption: "金雅（80万点以上）" },
  { value: 6, zhName: "粉雅", jaName: "桃雅", zhOption: "粉雅（90万分以上）", jaOption: "桃雅（90万点以上）" },
  { value: 7, zhName: "紫雅", jaName: "紫雅", zhOption: "紫雅（95万分以上）", jaOption: "紫雅（95万点以上）" },
  { value: 8, zhName: "极", jaName: "極", zhOption: "极（100万分）", jaOption: "極（100万点）" }
] as const;

const normalizeLocale = (locale: string): ScoreRankLocale => (locale.startsWith("ja") ? "ja" : "zh");

export const getScoreRankOptions = (locale: string) => {
  const language = normalizeLocale(locale);
  return SCORE_RANK_DEFINITIONS.map((item) => ({
    value: item.value,
    label: language === "ja" ? item.jaOption : item.zhOption
  }));
};

export const formatScoreRank = (value: unknown, locale: string) => {
  const language = normalizeLocale(locale);
  const rank = SCORE_RANK_DEFINITIONS.find((item) => item.value === Number(value));
  if (!rank) return language === "ja" ? "不明" : "未知";
  return language === "ja" ? rank.jaName : rank.zhName;
};
