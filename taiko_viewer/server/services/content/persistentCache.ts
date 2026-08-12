import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type PersistentCacheEnvelope<T> = {
  version: 1;
  savedAt: string;
  data: T;
};

const cacheFileName = (key: string) => `${key.replace(/[^a-z0-9._-]+/gi, "-")}.json`;

export const getViewerCacheDirectory = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(
    runtimeConfig.viewerCacheDir ||
    process.env.TAIKO_VIEWER_CACHE_DIR ||
    resolve(process.cwd(), ".data", "viewer-cache")
  );
};

export const readPersistentCache = async <T>(key: string): Promise<PersistentCacheEnvelope<T> | null> => {
  try {
    const content = await readFile(resolve(getViewerCacheDirectory(), cacheFileName(key)), "utf8");
    const parsed = JSON.parse(content) as PersistentCacheEnvelope<T>;
    if (parsed?.version !== 1 || !parsed.savedAt || parsed.data === undefined) return null;
    return parsed;
  } catch (error: any) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
};

export const writePersistentCache = async <T>(key: string, data: T, savedAt = new Date().toISOString()) => {
  const directory = getViewerCacheDirectory();
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, cacheFileName(key));
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  const envelope: PersistentCacheEnvelope<T> = { version: 1, savedAt, data };
  await writeFile(temporary, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
};
