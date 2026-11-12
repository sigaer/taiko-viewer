import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSongIdentityMap, normalizeScoreSongIds, type SongIdentityMap } from "../domain/catalog-identity.ts";

let cache: { path: string; revision: string; identities: SongIdentityMap } | null = null;
export async function getSongIdentities(repoRoot: string): Promise<SongIdentityMap> {
  const path = process.env.TAIKO_SONG_DATA_PATH || resolve(repoRoot, "songs/song_data.json");
  let info;
  try { info = await stat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map(); throw error; }
  const revision = `${info.mtimeMs}:${info.size}`;
  if (cache?.path === path && cache.revision === revision) return cache.identities;
  const identities = buildSongIdentityMap(JSON.parse(await readFile(path, "utf8")));
  cache = { path, revision, identities };
  return identities;
}

export async function normalizeCatalogScores<T>(payload: T, repoRoot: string): Promise<T> {
  return normalizeScoreSongIds(payload, await getSongIdentities(repoRoot));
}
