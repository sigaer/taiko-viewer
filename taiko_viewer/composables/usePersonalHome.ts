import type {
  PersonalRatingSummary,
  PersonalRecommendationsPayload
} from "~/types/personal-home";

const emptyRating = (): PersonalRatingSummary => ({ current: null, scoreCount: 0 });
const emptyRecommendations = (): PersonalRecommendationsPayload => ({ items: [] });

export const usePersonalHome = (enabled: MaybeRefOrGetter<boolean>, userId: MaybeRefOrGetter<number | null>) => {
  const apiFetch = useViewerApiFetch();
  const shouldLoad = computed(() => Boolean(toValue(enabled) && toValue(userId)));
  const keySuffix = computed(() => String(toValue(userId) || "anonymous"));

  const rating = useLazyAsyncData(
    () => `personal-home-rating-${keySuffix.value}`,
    () => apiFetch<PersonalRatingSummary>("/api/account/charts/summary"),
    {
      default: emptyRating,
      immediate: false,
      server: false
    }
  );
  const recommendations = useLazyAsyncData(
    () => `personal-home-recommendations-${keySuffix.value}`,
    () => apiFetch<PersonalRecommendationsPayload>("/api/account/recommendation"),
    {
      default: emptyRecommendations,
      immediate: false,
      server: false
    }
  );

  const load = async () => {
    if (!shouldLoad.value) return;
    await Promise.allSettled([rating.execute(), recommendations.execute()]);
  };

  watch(shouldLoad, (value) => {
    if (value) void load();
  }, { immediate: true });

  return {
    rating: rating.data,
    ratingPending: rating.pending,
    ratingError: rating.error,
    recommendations: recommendations.data,
    recommendationsPending: recommendations.pending,
    recommendationsError: recommendations.error,
    refresh: load
  };
};
