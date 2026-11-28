// Song aliases for public search. Source: the local song_alias.json next to the catalogue (the file the admin alias
// pages write, `<repoRoot>/songs/song_alias.json`). Read like the catalogue: one stat per call, the parsed index is
// reused while the file's mtime and size are unchanged. Fails open: a missing, oversized or malformed file gives an
// empty index (search then behaves as it did before aliases), and the failed state is cached for the same mtime so a
// broken file is not re-read on every request.
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { getContentRuntimePaths } from "./runtime";
import { buildSongAliasIndex, type SongAliasIndex } from "./songSearch";

const MAX_ALIAS_FILE_BYTES = 4 * 1024 * 1024;
const EMPTY: SongAliasIndex = new Map();

let aliasCache: { path: string; mtimeMs: number; size: number; index: SongAliasIndex } | null = null;

export const getSongAliasPath = () => resolve(getContentRuntimePaths().repoRoot, "songs", "song_alias.json");

export const getSongAliasIndex = async (): Promise<SongAliasIndex> => {
  let path = "";
  try {
    path = getSongAliasPath();
    const fileStat = await stat(path);
    if (aliasCache && aliasCache.path === path && aliasCache.mtimeMs === fileStat.mtimeMs && aliasCache.size === fileStat.size) {
      return aliasCache.index;
    }
    let index = EMPTY;
    if (fileStat.isFile() && fileStat.size <= MAX_ALIAS_FILE_BYTES) {
      try {
        index = buildSongAliasIndex(JSON.parse(await readFile(path, "utf8")));
      } catch {
        index = EMPTY;
      }
    }
    aliasCache = { path, mtimeMs: fileStat.mtimeMs, size: fileStat.size, index };
    return index;
  } catch {
    // No alias file (or no runtime paths): search without aliases.
    aliasCache = null;
    return EMPTY;
  }
};
