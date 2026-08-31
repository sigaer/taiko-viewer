import type { SongCatalogItem } from "~/types/content";

export type DifficultyType = 1 | 2 | 3 | 4 | 5;

export const normalizeDifficultyType = (value: unknown): DifficultyType | null => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number as DifficultyType : null;
};

export const difficultyLabelKey = (value: unknown) => {
  const difficulty = normalizeDifficultyType(value);
  return difficulty ? `difficulty.${difficulty}` : "difficulty.unknown";
};

export const resolveChartStarLevel = (song: Pick<SongCatalogItem, "level_1" | "level_2" | "level_3" | "level_4" | "level_5"> | null | undefined, value: unknown) => {
  const difficulty = normalizeDifficultyType(value);
  if (!song || !difficulty) return null;
  const raw = song[`level_${difficulty}`];
  const starLevel = Number(raw);
  return Number.isFinite(starLevel) && starLevel > 0 ? Math.trunc(starLevel) : null;
};

export const resolveDifficultyPresentation = (song: SongCatalogItem | null | undefined, value: unknown) => {
  const difficultyType = normalizeDifficultyType(value);
  return {
    difficultyType,
    difficultyKey: difficultyLabelKey(difficultyType),
    starLevel: resolveChartStarLevel(song, difficultyType)
  };
};
