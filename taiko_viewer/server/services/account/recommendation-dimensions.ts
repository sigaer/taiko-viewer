const RECOMMEND_DIM_ALIASES: Record<string, string> = {
  rating: "rating",
  综合: "rating",
  总合: "rating",
  big_song: "big_song",
  daigouryoku: "big_song",
  大歌力: "big_song",
  大歌: "big_song",
  stamina: "stamina",
  体力: "stamina",
  speed: "speed",
  高速: "speed",
  高速处理: "speed",
  accuracy_power: "accuracy_power",
  精度: "accuracy_power",
  准度: "accuracy_power",
  良率: "accuracy_power",
  精度力: "accuracy_power",
  rhythm: "rhythm",
  节奏: "rhythm",
  节奏处理: "rhythm",
  complex: "complex",
  复合: "complex",
  复合处理: "complex"
};

const normalizeRecommendDim = (token: string) => token.replace(/\s+/g, "").trim().toLowerCase();

export const resolveRecommendDim = (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return { dimKey: "rating", dimLabel: "rating" };
  }
  const dimKey = RECOMMEND_DIM_ALIASES[trimmed] || RECOMMEND_DIM_ALIASES[normalizeRecommendDim(trimmed)];
  return dimKey ? { dimKey, dimLabel: trimmed } : null;
};

