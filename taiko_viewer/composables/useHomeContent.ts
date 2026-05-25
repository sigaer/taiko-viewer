import type { HomeContentPayload } from "~/types/content";
import { useClientContentState } from "./useClientContentState";

const createDefaultPayload = (): HomeContentPayload => ({
  latestSongs: []
});

export const useHomeContent = () =>
  useClientContentState<HomeContentPayload>(
    () => useViewerApiFetch()<HomeContentPayload>("/api/content/home"),
    createDefaultPayload
  );
