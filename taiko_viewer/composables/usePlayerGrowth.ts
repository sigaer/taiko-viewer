import type { PlayerGrowthOverview } from "~/types/player-growth";

const emptyGrowth = (): PlayerGrowthOverview => ({
  playerState: { overallRating: null, skills: [], priorityDimension: null, tiedDimensions: [], dataSufficiency: "insufficient", basis: "insufficient-evidence", sampleCount: 0 },
  todayPlan: { targetDimension: null, items: [], usedFallback: false },
  dailyProgress: { calendarDay: "", dataMode: "INSUFFICIENT", attendance: "unknown", uniqueCharts: null, scoreImprovements: null, newBestCount: null, crownChanges: null, breakthrough: null },
  dataStatus: { mode: "INSUFFICIENT", timezone: "Asia/Shanghai" }
});

export const usePlayerGrowth = (enabled: MaybeRefOrGetter<boolean>, userId: MaybeRefOrGetter<number | null>) => {
  const apiFetch = useViewerApiFetch();
  const shouldLoad = computed(() => Boolean(toValue(enabled) && toValue(userId)));
  const keySuffix = computed(() => String(toValue(userId) || "anonymous"));
  const growth = useLazyAsyncData(
    () => `player-growth-overview-${keySuffix.value}`,
    () => apiFetch<PlayerGrowthOverview>("/api/account/growth/overview"),
    { default: emptyGrowth, immediate: false, server: false }
  );
  const load = async () => { if (shouldLoad.value) await growth.execute(); };
  watch(shouldLoad, (value) => { if (value) void load(); }, { immediate: true });
  return { growth: growth.data, pending: growth.pending, error: growth.error, refresh: load };
};
