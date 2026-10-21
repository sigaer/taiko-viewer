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
  let identityGeneration = 0;
  let disposed = false;
  let inactive = false;
  let needsLoad = false;
  let ackRequest = 0;
  let acknowledgedToken = "";
  const acknowledging = new Map<string, number>();
  const identity = computed(() => `${toValue(userId) || ""}:${currentBinding.value?.id || ""}:${toValue(enabled)}`);

  const load = async (expectedIdentity = identity.value) => {
    if (disposed || expectedIdentity !== identity.value) return false;
    if (inactive) { needsLoad = true; return false; }
    needsLoad = false;
    if (import.meta.server) { pending.value = Boolean(toValue(enabled) && toValue(userId)); return false; }
    const request = ++generation;
    if (!toValue(enabled) || !toValue(userId) || !currentBinding.value?.id) { recent.value = emptyRecent(); pending.value = false; error.value = null; return false; }
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
    const epoch = identityGeneration;
    if (disposed || inactive || !toValue(enabled) || !toValue(userId) || snapshot.profileId !== String(currentBinding.value?.id || "") || !token || !snapshot.boundary.acknowledgeRequired || snapshot.boundary.currentToken !== token || acknowledgedToken === token || acknowledging.has(token)) return;
    const request = ++ackRequest;
    acknowledging.set(token, request);
    const current = () => !disposed && !inactive && epoch === identityGeneration && expectedIdentity === identity.value && recent.value.boundary.currentToken === token;
    try {
      const result = await apiFetch<RecentGrowthAcknowledgeResponse>("/api/account/growth/recent/ack", {
        method: "POST",
        retry: 0,
        body: { profileId: snapshot.profileId, expectedBoundary: snapshot.boundary.acknowledgedToken, acknowledgeToken: token }
      });
      if (!current() || result.profileId !== snapshot.profileId) return;
      acknowledgedToken = result.acknowledgedToken;
    } catch (cause) {
      if (current() && Number((cause as { statusCode?: number; status?: number }).statusCode || (cause as { status?: number }).status) === 409) void load(expectedIdentity);
    } finally {
      if (acknowledging.get(token) === request) acknowledging.delete(token);
    }
  };

  watch(identity, () => {
    generation++;
    identityGeneration++;
    acknowledgedToken = "";
    acknowledging.clear();
    recent.value = emptyRecent();
    error.value = null;
    void load();
  }, { immediate: true, flush: "sync" });
  onDeactivated(() => { inactive = true; needsLoad ||= pending.value; generation++; identityGeneration++; acknowledging.clear(); pending.value = false; });
  onActivated(() => { if (!inactive) return; inactive = false; if (needsLoad) void load(); });
  onScopeDispose(() => { disposed = true; generation++; identityGeneration++; acknowledging.clear(); });
  return { recent, pending, error, identity, refresh: load, acknowledge };
};
