import type { TitlesPagePayload } from "~/types/content";

const createDefaultPayload = (): TitlesPagePayload => ({
  titles: [],
  total: 0
});

// The fetcher is created in setup (slice F, as useGuideContent): refresh() from the retry works. Same request and key.
export const useTitlesContent = () => {
  const apiFetch = useViewerApiFetch();
  return useAsyncData("content-titles-page", () => apiFetch<TitlesPagePayload>("/api/content/titles"), {
    default: createDefaultPayload
  });
};
