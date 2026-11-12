import { resolve } from "node:path";
import { getContentRuntimePaths, readCachedJsonFile } from "./runtime";

type CatalogConstants = { generatedAt: string; constants: Record<string, unknown>; provenance: Record<string, unknown> };
let cache: { mtimeMs: number; data: CatalogConstants } | null = null;

export const getCatalogConstants = async (): Promise<CatalogConstants | null> => {
  try {
    const path = resolve(getContentRuntimePaths().repoRoot, "songs/catalog_constants.json");
    const result = await readCachedJsonFile(cache, path);
    cache = result.cache;
    return result.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return cache?.data || null;
    // Preserve the last successfully published generation on a bad update.
    if (cache) return cache.data;
    throw error;
  }
};
