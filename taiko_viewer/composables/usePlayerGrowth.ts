import type { PlayerGrowthOverview } from '~/types/player-growth';
const emptyGrowth = (): PlayerGrowthOverview => ({
  activeGoal: null,
  playerState: { overallRating: null, skills: [], priorityDimension: null, tiedDimensions: [], dataSufficiency: 'insufficient', basis: 'insufficient-evidence', sampleCount: 0 },
  todayPlan: { targetDimension: null, items: [], usedFallback: false },
  dailyProgress: { calendarDay: '', dataMode: 'INSUFFICIENT', attendance: 'unknown', uniqueCharts: null, events: [] },
  dataStatus: { mode: 'INSUFFICIENT', timezone: 'Asia/Shanghai' }
});
export const usePlayerGrowth = (enabled: MaybeRefOrGetter<boolean>, userId: MaybeRefOrGetter<number | null>) => {
  const apiFetch = useViewerApiFetch();
  const { currentBinding } = useHomeState();
  const growth = ref<PlayerGrowthOverview>(emptyGrowth());
  const pending = ref(false);
  const error = shallowRef<unknown>(null);
  let generation = 0;
  const identity = computed(() => `${toValue(userId) || ''}:${currentBinding.value?.id || ''}:${toValue(enabled)}`);
  const load = async () => {
    const request = ++generation;
    const profile = String(currentBinding.value?.id || '');
    if (!toValue(enabled) || !toValue(userId)) { growth.value = emptyGrowth(); pending.value = false; return; }
    pending.value = true; error.value = null;
    try {
      const result = await apiFetch<PlayerGrowthOverview>('/api/account/growth/overview');
      if (request !== generation) return;
      if (result.profileId && profile && result.profileId !== profile) throw new Error('profile-changed');
      growth.value = result;
    } catch (e) { if (request === generation) error.value = e; }
    finally { if (request === generation) pending.value = false; }
  };
  watch(identity, () => { growth.value = emptyGrowth(); void load(); }, { immediate: true });
  onScopeDispose(() => { generation++; });
  return { growth, pending, error, refresh: load };
};
