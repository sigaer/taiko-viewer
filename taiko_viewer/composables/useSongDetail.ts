import type { SongDetailPayload } from "~/types/content";

const createDefaultPayload = (): SongDetailPayload => ({
  song: null,
  ratingEntries: [],
  branchAudioTracks: []
});

export const useSongDetail = (songId: MaybeRefOrGetter<number>) =>
  useAsyncData(
    () => `content-song-detail-${toValue(songId)}`,
    () => useViewerApiFetch()<SongDetailPayload>(`/api/content/songs/${toValue(songId)}`),
    {
      default: createDefaultPayload,
      watch: [() => toValue(songId)]
    }
  );
