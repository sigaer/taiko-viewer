import { normalizeScoreSongIds, type SongIdentityMap } from "../domain/catalog-identity.ts";
import { captureCatalogAuthority } from "../services/content/catalogAuthority.ts";

export async function getSongIdentities(_repoRoot: string): Promise<SongIdentityMap> {
  try {
    const { data } = await captureCatalogAuthority();
    return new Map(Object.entries(data.aliases).map(([alias, current]) => [Number(alias), Number(current)]).filter(([alias, current]) => alias !== current));
  } catch {
    // Unavailable association preserves historical IDs; no metadata fallback.
    return new Map();
  }
}

export async function normalizeCatalogScores<T>(payload: T, repoRoot: string): Promise<T> {
  return normalizeScoreSongIds(payload, await getSongIdentities(repoRoot));
}
