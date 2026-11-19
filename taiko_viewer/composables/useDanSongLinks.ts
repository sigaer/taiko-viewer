import type { SongCatalogPagePayload } from "~/types/content";
import { matchCatalogSong, type CatalogSong } from "~/utils/rework/dan";

/**
 * Slice F: the catalogue song of each dan song, so the course can link to song detail and show the cover.
 * Reads the existing song list API (/api/content/songs, keyword search, the same request the search panel makes) once
 * per title and keeps only an exact, unique title match; anything else (no match, several, a failed request) leaves the
 * song without a link. Rendered on the server with the page; a failure never fails the page.
 */
export const useDanSongLinks = (key: () => string, titles: () => string[]) => {
  const apiFetch = useViewerApiFetch();
  return useAsyncData<Record<string, CatalogSong | null>>(
    () => `dan-song-links-${key()}`,
    async () => {
      const out: Record<string, CatalogSong | null> = {};
      await Promise.all(
        [...new Set(titles())].map(async (title) => {
          try {
            const page = await apiFetch<SongCatalogPagePayload>("/api/content/songs", {
              query: { view: "list", keyword: title, page: 1, pageSize: 60 }
            });
            const song = matchCatalogSong(title, page.songs || []);
            out[title] = song ? { id: Number(song.id), song_name: song.song_name, song_name_jp: song.song_name_jp } : null;
          } catch {
            out[title] = null;
          }
        })
      );
      return out;
    },
    { default: () => ({}) }
  );
};
