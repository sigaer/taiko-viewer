import type { GuidePagePayload, GuideTagItemsPayload } from "~/types/content";

const createGuidePageDefault = (): GuidePagePayload => ({
  difficulty: 0,
  difficultyLabel: "",
  level: 0,
  tags: [],
  summary: {
    overPlus: 0,
    over: 0,
    strong: 0,
    middle: 0,
    weak: 0,
    under: 0,
    underMinus: 0,
    total: 0
  }
});

// The fetcher is created in setup (slice F): created inside the handler it called useI18n() outside setup whenever
// refresh() or the watch ran after setup, threw, and the page could not be read again. Same request and key.
export const useGuideContent = (
  difficulty: MaybeRefOrGetter<number>,
  level: MaybeRefOrGetter<number>
) => {
  const apiFetch = useViewerApiFetch();
  return useAsyncData(
    () => `content-guide-${toValue(difficulty)}-${toValue(level)}`,
    () => apiFetch<GuidePagePayload>(`/api/content/guide/${toValue(difficulty)}/${toValue(level)}`),
    {
      default: createGuidePageDefault,
      watch: [() => toValue(difficulty), () => toValue(level)]
    }
  );
};

const createGuideTagDefault = (difficulty: number, level: number, tagId: number): GuideTagItemsPayload => ({
  difficulty,
  level,
  tagId,
  tagLabel: "",
  items: []
});

export const loadGuideTagItems = async (difficulty: number, level: number, tagId: number) =>
  useViewerApiFetch()<GuideTagItemsPayload>(`/api/content/guide/${difficulty}/${level}/tag/${tagId}`);

export const createEmptyGuideTagItems = createGuideTagDefault;
