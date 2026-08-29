import type { ChartDifficultyCode, ChartUgcSummary, ViewerChartUgcState } from "~/types/ugc";

export const useChartUgc = async (
  songId: MaybeRefOrGetter<number>,
  difficultyCode: MaybeRefOrGetter<ChartDifficultyCode>
) => {
  const apiFetch = useViewerApiFetch();
  const { accountUser, resolveAccountUser } = useAccountAuthStatus();
  const requestKey = () => `${toValue(songId)}-${toValue(difficultyCode)}`;

  const publicState = await useAsyncData<ChartUgcSummary | null>(
    () => `chart-ugc-public-${requestKey()}`,
    () => apiFetch<ChartUgcSummary>(
      `/api/content/songs/${toValue(songId)}/ugc?difficulty=${toValue(difficultyCode)}`
    ),
    {
      default: () => null,
      watch: [() => toValue(songId), () => toValue(difficultyCode)],
      dedupe: "cancel"
    }
  );

  const privateState = useLazyAsyncData<ViewerChartUgcState | null>(
    () => `chart-ugc-private-${requestKey()}`,
    async () => {
      const user = await resolveAccountUser();
      if (!user || !accountUser.value) return null;
      return apiFetch<ViewerChartUgcState>(
        `/api/account/charts/${toValue(songId)}/${toValue(difficultyCode)}/ugc/me`
      );
    },
    {
      default: () => null,
      server: false,
      watch: [() => toValue(songId), () => toValue(difficultyCode), accountUser],
      dedupe: "cancel"
    }
  );

  const hasUsefulPublicContent = computed(() => {
    const summary = publicState.data.value;
    return Boolean(summary && (summary.difficulty.count > 0 || summary.tags.length > 0 || summary.tips.length > 0));
  });

  return { publicState, privateState, hasUsefulPublicContent };
};
