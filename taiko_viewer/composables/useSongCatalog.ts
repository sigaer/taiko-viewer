import type { SongCatalogPayload } from "~/types/content";
import { useClientContentState } from "./useClientContentState";

const createDefaultPayload = (): SongCatalogPayload => ({
  songs: []
});

export const useSongCatalog = (shelfStatus?: MaybeRefOrGetter<number | undefined>) =>
  useClientContentState<SongCatalogPayload>(
    () =>
      useViewerApiFetch()<SongCatalogPayload>("/api/content/songs", {
        query: {
          shelfStatus: toValue(shelfStatus)
        }
      }),
    createDefaultPayload
  );
