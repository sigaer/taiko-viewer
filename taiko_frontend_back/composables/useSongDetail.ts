import type { SongDetailPayload } from "~/types/content";

const createDefaultPayload = (): SongDetailPayload => ({
  song: null,
  ratingEntries: []
});

export const useSongDetail = (songId: MaybeRefOrGetter<number>) =>
  useAsyncData(
    () => `content-song-detail-${toValue(songId)}`,
    () => $fetch<SongDetailPayload>(`/api/content/songs/${toValue(songId)}`),
    {
      default: createDefaultPayload,
      watch: [() => toValue(songId)]
    }
  );
