import type { TitlesPagePayload } from "~/types/content";

const createDefaultPayload = (): TitlesPagePayload => ({
  titles: [],
  total: 0
});

export const useTitlesContent = () =>
  useAsyncData("content-titles-page", () => useViewerApiFetch()<TitlesPagePayload>("/api/content/titles"), {
    default: createDefaultPayload
  });
