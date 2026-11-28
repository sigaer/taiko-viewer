// Song keyword matching for the public catalogue (GET /api/content/songs list mode) and the constants table.
// Pure functions only (no Nuxt imports): the alias file loader lives in songAliases.ts, node tests import this file.

/** Same normalisation as the search panel: NFKC, locale lower case, trimmed. */
export const normalizeSearchText = (value: unknown) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().trim();

export type SongAlias = { alias: string; norm: string };
/** Song id (as written in song_alias.json) → its aliases in file order. */
export type SongAliasIndex = ReadonlyMap<number, readonly SongAlias[]>;

/** Bounds shared with the developer catalogue projection (@sakura-taiko/contract/catalog). */
export const ALIAS_LIMITS = { rows: 20000, perSong: 100, length: 256 } as const;

/**
 * song_alias.json rows (`[{ id, aliases: string[] }]`) → index. Malformed rows and values are skipped, never thrown:
 * a broken alias file must not break song search. Duplicate ids are merged in file order.
 */
export function buildSongAliasIndex(rows: unknown): Map<number, SongAlias[]> {
  const index = new Map<number, SongAlias[]>();
  if (!Array.isArray(rows)) return index;
  for (const row of rows.slice(0, ALIAS_LIMITS.rows)) {
    if (!row || typeof row !== "object") continue;
    const id = Number((row as { id?: unknown }).id);
    const aliases = (row as { aliases?: unknown }).aliases;
    if (!Number.isSafeInteger(id) || id <= 0 || !Array.isArray(aliases)) continue;
    const list = index.get(id) ?? [];
    const seen = new Set(list.map((item) => item.norm));
    for (const value of aliases) {
      if (list.length >= ALIAS_LIMITS.perSong) break;
      if (typeof value !== "string") continue;
      const alias = value.trim().slice(0, ALIAS_LIMITS.length);
      const norm = normalizeSearchText(alias);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      list.push({ alias, norm });
    }
    if (list.length) index.set(id, list);
  }
  return index;
}

/** Aliases of a catalogue song: its own id first, then any legacy ids it replaced. */
export function songAliases(song: { id: unknown; legacy_ids?: unknown }, index: SongAliasIndex): SongAlias[] {
  const ids = [Number(song.id), ...(Array.isArray(song.legacy_ids) ? song.legacy_ids.map(Number) : [])];
  const out: SongAlias[] = [];
  for (const id of new Set(ids)) out.push(...(index.get(id) ?? []));
  return out;
}

/** First alias containing the normalised keyword, or null. */
export function findMatchedAlias(aliases: readonly SongAlias[], normalizedKeyword: string): string | null {
  if (!normalizedKeyword) return null;
  return aliases.find((item) => item.norm.includes(normalizedKeyword))?.alias ?? null;
}

/** Relevance tiers: lower is better. */
export const MATCH_TIER = { exact: 0, prefix: 1, substring: 2, alias: 3 } as const;
export type MatchTier = (typeof MATCH_TIER)[keyof typeof MATCH_TIER];

export type SongMatch<T> = { song: T; tier: MatchTier; matchedAlias?: string };

type MatchableSong = { id: unknown; song_name?: unknown; song_name_jp?: unknown; legacy_ids?: unknown };

/**
 * Every song the keyword matches, in input order, with its tier.
 * - exact: a title (zh or ja) equals the keyword, or the id does;
 * - prefix: a title starts with it;
 * - substring: a title, the id or one of `extraFields` (category names) contains it — today's matches;
 * - alias: none of the above, but an alias contains it (`matchedAlias` names the alias).
 */
export function matchSongs<T extends MatchableSong>(
  songs: readonly T[],
  keyword: string,
  aliases: SongAliasIndex,
  extraFields: (song: T) => unknown[] = () => []
): SongMatch<T>[] {
  const q = normalizeSearchText(keyword);
  if (!q) return songs.map((song) => ({ song, tier: MATCH_TIER.substring }));
  const out: SongMatch<T>[] = [];
  for (const song of songs) {
    const titles = [song.song_name, song.song_name_jp].map(normalizeSearchText).filter(Boolean);
    const id = normalizeSearchText(song.id);
    if (titles.includes(q) || id === q) {
      out.push({ song, tier: MATCH_TIER.exact });
    } else if (titles.some((title) => title.startsWith(q))) {
      out.push({ song, tier: MATCH_TIER.prefix });
    } else if ([...titles, id, ...extraFields(song).map(normalizeSearchText)].some((value) => value && value.includes(q))) {
      out.push({ song, tier: MATCH_TIER.substring });
    } else {
      const matchedAlias = findMatchedAlias(songAliases(song, aliases), q);
      if (matchedAlias !== null) out.push({ song, tier: MATCH_TIER.alias, matchedAlias });
    }
  }
  return out;
}

/**
 * Order matches. `relevance`: by tier, stable within a tier (input order). `direct-first`: the input order is kept
 * for direct matches and alias-only matches follow them (used when the caller asked for an explicit sort).
 */
export function orderMatches<T>(matches: readonly SongMatch<T>[], mode: "relevance" | "direct-first"): SongMatch<T>[] {
  const rank = mode === "relevance"
    ? (match: SongMatch<T>) => match.tier
    : (match: SongMatch<T>) => (match.tier === MATCH_TIER.alias ? 1 : 0);
  return [...matches].sort((left, right) => rank(left) - rank(right));
}
