import type { GuidePagePayload, GuideTagItemsPayload } from "~/types/content";

const createGuidePageDefault = (): GuidePagePayload => ({
  difficulty: 0,
  difficultyLabel: "",
  level: 0,
  tags: [],
  summary: {
    "诈称+": 0,
    诈称: 0,
    强: 0,
    中: 0,
    弱: 0,
    "逆诈称": 0,
    "逆诈称-": 0,
    合计: 0
  }
});

export const useGuideContent = (
  difficulty: MaybeRefOrGetter<number>,
  level: MaybeRefOrGetter<number>
) =>
  useAsyncData(
    () => `content-guide-${toValue(difficulty)}-${toValue(level)}`,
    () => $fetch<GuidePagePayload>(`/api/content/guide/${toValue(difficulty)}/${toValue(level)}`),
    {
      default: createGuidePageDefault,
      watch: [() => toValue(difficulty), () => toValue(level)]
    }
  );

const createGuideTagDefault = (difficulty: number, level: number, tagId: number): GuideTagItemsPayload => ({
  difficulty,
  level,
  tagId,
  tagLabel: "",
  items: []
});

export const loadGuideTagItems = async (difficulty: number, level: number, tagId: number) =>
  $fetch<GuideTagItemsPayload>(`/api/content/guide/${difficulty}/${level}/tag/${tagId}`);

export const createEmptyGuideTagItems = createGuideTagDefault;
