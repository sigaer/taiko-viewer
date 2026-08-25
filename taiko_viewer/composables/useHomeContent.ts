import type { HomeContentPayload } from "~/types/content";

const createDefaultPayload = (): HomeContentPayload => ({
  latestSongs: []
});

export const useHomeContent = () =>
  useLazyAsyncData<HomeContentPayload>(
    "home-content",
    () => useViewerApiFetch()<HomeContentPayload>("/api/content/home"),
    {
      default: createDefaultPayload,
      server: false
    }
  );
