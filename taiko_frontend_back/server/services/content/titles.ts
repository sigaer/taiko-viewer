import type { TitlesPagePayload } from "~/types/content";
import { findReadableDataFile, readCachedJsonFile } from "./runtime";

let titlesPageCache: { mtimeMs: number; data: TitlesPagePayload } | null = null;

export const getTitlesPageContent = async (): Promise<TitlesPagePayload> => {
  const filePath = await findReadableDataFile("title_wikitable_cn.json");
  if (!filePath) {
    throw createError({
      statusCode: 404,
      statusMessage: "Data file not found: title_wikitable_cn.json"
    });
  }
  const result = await readCachedJsonFile<TitlesPagePayload>(titlesPageCache, filePath);
  titlesPageCache = result.cache;
  return result.data;
};
