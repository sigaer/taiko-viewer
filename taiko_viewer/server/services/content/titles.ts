import type { TitlesPagePayload } from "~/types/content";
import { findReadableDataFile, readCachedJsonFile } from "./runtime";
import { normalizeViewerLocale } from "~/server/utils/locale";

let titlesPageCache: { mtimeMs: number; data: TitlesPagePayload } | null = null;
let titlesPageJaCache: { mtimeMs: number; data: TitlesPagePayload } | null = null;

export const getTitlesPageContent = async (locale = "zh"): Promise<TitlesPagePayload> => {
  const normalizedLocale = normalizeViewerLocale(locale);
  const fileName = normalizedLocale === "ja" ? "title_wikitable.json" : "title_wikitable_cn.json";
  const filePath = await findReadableDataFile(fileName);
  if (!filePath) {
    throw createError({
      statusCode: 404,
      statusMessage: `Data file not found: ${fileName}`
    });
  }
  const currentCache = normalizedLocale === "ja" ? titlesPageJaCache : titlesPageCache;
  const result = await readCachedJsonFile<TitlesPagePayload>(currentCache, filePath);
  if (normalizedLocale === "ja") {
    titlesPageJaCache = result.cache;
  } else {
    titlesPageCache = result.cache;
  }
  return result.data;
};
