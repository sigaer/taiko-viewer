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
  const refreshing = ref(false);
  const refreshError = shallowRef<unknown>(null);
  let loaded = false;
  let generation = 0;
  let disposed = false;
  let inactive = false;
  let needsLoad = false;
  const identity = computed(() => `${toValue(userId) || ''}:${currentBinding.value?.id || ''}:${toValue(enabled)}`);
  const load = async (expectedIdentity = identity.value): Promise<boolean> => {
    if (disposed || expectedIdentity !== identity.value) return false;
    if (inactive) { needsLoad = true; return false; }
    needsLoad = false;
    // This local ref is not transferred in the SSR payload. Start its load
    // on the client so hydration does not repeat a discarded server compute.
    if (import.meta.server) { pending.value = Boolean(toValue(enabled) && toValue(userId)); return false; }
    const request = ++generation;
    const profile = String(currentBinding.value?.id || '');
    if (!toValue(enabled) || !toValue(userId) || !currentBinding.value?.id) { growth.value = emptyGrowth(); pending.value = false; refreshing.value = false; return false; }
    pending.value = !loaded; refreshing.value = loaded; error.value = null; refreshError.value = null;
    try {
      const result = await apiFetch<PlayerGrowthOverview>('/api/account/growth/overview', { retry: 0 });
      if (request !== generation || expectedIdentity !== identity.value) return false;
      if (result.profileId && profile && result.profileId !== profile) throw new Error('profile-changed');
      growth.value = result; loaded = true;
      return true;
    } catch (e) { if (request === generation) { if (loaded) refreshError.value = e; else error.value = e; } return false; }
    finally { if (request === generation) { pending.value = false; refreshing.value = false; } }
  };
  watch(identity, () => { loaded = false; growth.value = emptyGrowth(); error.value = null; refreshError.value = null; void load(); }, { immediate: true, flush: 'sync' });
  onDeactivated(() => { inactive = true; needsLoad ||= pending.value || refreshing.value; generation++; pending.value = false; refreshing.value = false; });
  onActivated(() => { if (!inactive) return; inactive = false; if (needsLoad) void load(); });
  onScopeDispose(() => { disposed = true; generation++; });
  return { growth, pending, error, refreshing, refreshError, identity, refresh: load };
};
