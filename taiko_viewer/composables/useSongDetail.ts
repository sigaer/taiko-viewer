import type { SongDetailPayload } from "~/types/content";

const createDefaultPayload = (): SongDetailPayload => ({
  song: null,
  ratingEntries: [],
  branchAudioVariants: {},
  tjaBundleUrl: null
});

// The fetch client is created during setup: useViewerApiFetch() reads i18n and state, which a later refresh()
// (the retry of the failed state) cannot do outside a component setup.
export const useSongDetail = (songId: MaybeRefOrGetter<number>) => {
  const apiFetch = useViewerApiFetch();
  return useAsyncData(
    () => `content-song-detail-${toValue(songId)}`,
    () => apiFetch<SongDetailPayload>(`/api/content/songs/${toValue(songId)}`),
    {
      default: createDefaultPayload,
      watch: [() => toValue(songId)]
    }
  );
};
