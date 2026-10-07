import type { RecentGrowthAcknowledgeResponse, RecentGrowthResponse } from "~/types/player-growth";

const emptyRecent = (): RecentGrowthResponse => ({
  profileId: "",
  state: "unavailable",
  observedAt: null,
  facts: [],
  totalFacts: 0,
  boundary: { acknowledgedToken: null, currentToken: null, acknowledgeRequired: false, recovered: false }
});

export const useRecentGrowth = (enabled: MaybeRefOrGetter<boolean>, userId: MaybeRefOrGetter<number | null>) => {
  const apiFetch = useViewerApiFetch();
  const { currentBinding } = useHomeState();
  const recent = ref<RecentGrowthResponse>(emptyRecent());
  const pending = ref(false);
  const error = shallowRef<unknown>(null);
  let generation = 0;
  let acknowledgedToken = "";
  let acknowledgingToken = "";
  const identity = computed(() => `${toValue(userId) || ""}:${currentBinding.value?.id || ""}:${toValue(enabled)}`);

  const load = async (expectedIdentity = identity.value) => {
    if (expectedIdentity !== identity.value) return false;
    if (import.meta.server) { pending.value = Boolean(toValue(enabled) && toValue(userId)); return false; }
    const request = ++generation;
    if (!toValue(enabled) || !toValue(userId)) { recent.value = emptyRecent(); pending.value = false; return false; }
    pending.value = true;
    error.value = null;
    try {
      const result = await apiFetch<RecentGrowthResponse>("/api/account/growth/recent", { retry: 0 });
      if (request !== generation || expectedIdentity !== identity.value) return false;
      const profile = String(currentBinding.value?.id || "");
      if (result.profileId !== profile) throw new Error("profile-changed");
      recent.value = result;
      return true;
    } catch (cause) {
      if (request === generation) error.value = cause;
      return false;
    } finally {
      if (request === generation) pending.value = false;
    }
  };

  const acknowledge = async (token: string) => {
    const snapshot = recent.value;
    const expectedIdentity = identity.value;
    if (!snapshot.boundary.acknowledgeRequired || snapshot.boundary.currentToken !== token || acknowledgedToken === token || acknowledgingToken === token) return;
    acknowledgingToken = token;
    try {
      const result = await apiFetch<RecentGrowthAcknowledgeResponse>("/api/account/growth/recent/ack", {
        method: "POST",
        retry: 0,
        body: { profileId: snapshot.profileId, expectedBoundary: snapshot.boundary.acknowledgedToken, acknowledgeToken: token }
      });
      if (expectedIdentity !== identity.value || result.profileId !== snapshot.profileId) return;
      acknowledgedToken = result.acknowledgedToken;
    } catch (cause) {
      if (expectedIdentity === identity.value && Number((cause as { statusCode?: number }).statusCode) === 409) void load(expectedIdentity);
    } finally {
      if (acknowledgingToken === token) acknowledgingToken = "";
    }
  };

  watch(identity, () => {
    generation++;
    acknowledgedToken = "";
    acknowledgingToken = "";
    recent.value = emptyRecent();
    void load();
  }, { immediate: true, flush: "sync" });
  onScopeDispose(() => { generation++; });
  return { recent, pending, error, identity, refresh: load, acknowledge };
};
