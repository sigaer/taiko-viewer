type CatalogSong = { id: number; legacy_ids?: number[] };
export type SongIdentityMap = ReadonlyMap<number, number>;

export function buildSongIdentityMap(songs: CatalogSong[]): SongIdentityMap {
  const current = new Set(songs.map(song => Number(song.id)));
  const result = new Map<number, number>();
  for (const song of songs) for (const alias of song.legacy_ids || []) {
    const old = Number(alias), id = Number(song.id);
    if (old === id) continue;
    if (current.has(old) || (result.has(old) && result.get(old) !== id)) throw new Error("Ambiguous song identity");
    result.set(old, id);
  }
  return result;
}

export const canonicalSongId = (id: number, identities: SongIdentityMap) => identities.get(Number(id)) ?? Number(id);

type ScoreRow = Record<string, unknown> & { song_no?: number; level?: number };
const scoreKey = (row: ScoreRow) => ["high_score", "dondaful_combo_cnt", "full_combo_cnt", "clear_cnt", "good_cnt", "bad_cnt", "play_cnt"]
  .map(key => (Number(row[key]) || 0) * (key === "bad_cnt" ? -1 : 1));
const better = (left: ScoreRow, right: ScoreRow) => {
  const a = scoreKey(left), b = scoreKey(right);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

export function normalizeScoreSongIds<T>(payload: T, identities: SongIdentityMap): T {
  if (!identities.size || !payload || typeof payload !== "object") return payload;
  const object = payload as Record<string, unknown>;
  const songs = object.songs;
  let output = object;
  if (Array.isArray(songs) && songs.some(row => row && identities.has(Number(row.song_no)))) {
    const normalized: ScoreRow[] = [], indices = new Map<string, number>();
    for (const row of songs as ScoreRow[]) {
      if (!row || row.song_no === undefined) { normalized.push(row); continue; }
      const id = canonicalSongId(Number(row.song_no), identities);
      const next = id !== Number(row.song_no) ? { ...row, song_no: id } : row;
      const key = `${id}:${row.level}`, index = indices.get(key);
      if (index !== undefined) {
        if (better(next, normalized[index]!)) normalized[index] = next;
      } else { indices.set(key, normalized.length); normalized.push(next); }
    }
    output = { ...output, songs: normalized };
  }
  if (Array.isArray(object.songs_removed)) {
    const removed = object.songs_removed.map(key => {
      if (Array.isArray(key) && key.length === 2) return [canonicalSongId(Number(key[0]), identities), key[1]];
      if (key && typeof key === "object" && "song_no" in key) return { ...key, song_no: canonicalSongId(Number(key.song_no), identities) };
      if (typeof key === "string" && key.includes(":")) {
        const [id, level] = key.split(":"); return `${canonicalSongId(Number(id), identities)}:${level}`;
      }
      return key;
    });
    if (JSON.stringify(removed) !== JSON.stringify(object.songs_removed)) output = { ...output, songs_removed: removed };
  }
  return output as T;
}
