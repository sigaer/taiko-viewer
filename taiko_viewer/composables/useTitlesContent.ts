import type { TitlesPagePayload } from "~/types/content";

const createDefaultPayload = (): TitlesPagePayload => ({
  table: { attrs: {} },
  rows: []
});

export const useTitlesContent = () =>
  useAsyncData("content-titles-page", () => useViewerApiFetch()<TitlesPagePayload>("/api/content/titles"), {
    default: createDefaultPayload
  });
