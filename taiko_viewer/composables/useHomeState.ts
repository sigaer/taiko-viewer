import { useAccountAuthStatus } from "~/composables/useAccountAuthStatus";
import {
  getHomeResolverErrorInfo,
  resolveHomeState,
  type HomeAuthPayload,
  type HomeBinding,
  type HomeResolverErrorInfo,
  type HomeResolverStatus,
  type HomeState,
  type HomeStateResolution
} from "~/utils/homeState";

type HomeResolverSnapshot = {
  status: HomeResolverStatus;
  homeState: HomeState | null;
  authenticated: boolean | null;
  currentBinding: HomeBinding | null;
  hasScores: boolean | null;
  error: HomeResolverErrorInfo | null;
};

const createSnapshot = (): HomeResolverSnapshot => ({
  status: "loading",
  homeState: null,
  authenticated: null,
  currentBinding: null,
  hasScores: null,
  error: null
});

const requests = new WeakMap<object, { generation: number; attempt: number; revision: string; identityRevision: string; pending: Promise<HomeResolverSnapshot> | null }>();

export const useHomeState = () => {
  const apiFetch = useViewerApiFetch();
  const { accountUser, accountAuthError, resolveAccountUser } = useAccountAuthStatus();
  const snapshot = useState<HomeResolverSnapshot>("home-state-resolver", createSnapshot);
  const resolvedUserId = useState<number | null>("home-state-resolved-user-id", () => null);
  const bindingGeneration = useState("account-binding-generation", () => 0);
  const homeGeneration = useState("account-home-generation", () => 0);
  const revision = computed(() => JSON.stringify([accountUser.value?.id || null, bindingGeneration.value, homeGeneration.value, accountAuthError.value]));
  const identityRevision = () => JSON.stringify([accountUser.value?.id || null, bindingGeneration.value, accountAuthError.value]);
  const app = useNuxtApp();
  if (!requests.has(app)) requests.set(app, { generation: 0, attempt: 0, revision: revision.value, identityRevision: identityRevision(), pending: null });
  const runtime = requests.get(app)!;
  let disposed = false;
  let suspended = false;
  let activation = 0;
  let ownedRequest: number | null = null;
  const invalidate = () => {
    if (runtime.revision === revision.value) return;
    runtime.revision = revision.value;
    runtime.generation++;
    runtime.pending = null;
    resolvedUserId.value = null;
    const nextIdentity = identityRevision();
    if (nextIdentity !== runtime.identityRevision) snapshot.value = createSnapshot();
    runtime.identityRevision = nextIdentity;
  };
  watch(revision, invalidate, { flush: "sync" });
  const suspend = () => {
    suspended = true;
    activation++;
    if (ownedRequest !== null && ownedRequest === runtime.generation) {
      runtime.generation++;
      runtime.pending = null;
      if (snapshot.value.status !== "ready") snapshot.value = createSnapshot();
      resolvedUserId.value = null;
    }
  };
  onScopeDispose(() => { disposed = true; suspend(); });

  const applyResolution = (resolution: HomeStateResolution) => {
    snapshot.value = {
      status: "ready",
      homeState: resolution.homeState,
      authenticated: resolution.authenticated,
      currentBinding: resolution.currentBinding,
      hasScores: resolution.hasScores,
      error: null
    };
  };

  const resolve = async (force = false): Promise<HomeResolverSnapshot> => {
    if (disposed) return snapshot.value;
    suspended = false;
    const view = activation;
    if (force) {
      runtime.attempt++;
      runtime.generation++;
      runtime.pending = null;
      resolvedUserId.value = null;
      snapshot.value = createSnapshot();
    }
    const attempt = runtime.attempt;
    await resolveAccountUser(force);
    if (disposed || suspended || view !== activation || attempt !== runtime.attempt) return snapshot.value;
    invalidate();
    const currentUserId = accountUser.value?.id || null;
    if (runtime.pending && !force) return runtime.pending;
    if (!force && snapshot.value.status === "ready" && resolvedUserId.value === currentUserId) {
      return snapshot.value;
    }

    const request = ++runtime.generation;
    ownedRequest = request;
    const expectedRevision = revision.value;
    const current = () => !disposed && !suspended && view === activation && request === runtime.generation && expectedRevision === revision.value;
    if (snapshot.value.status !== "ready") snapshot.value = createSnapshot();
    const pending = Promise.resolve().then(async () => { try {
      if (accountAuthError.value) {
        throw new Error(accountAuthError.value);
      }
      const resolution = await resolveHomeState({
        auth: async (): Promise<HomeAuthPayload> => ({
          authenticated: Boolean(accountUser.value),
          user: accountUser.value ? (accountUser.value as unknown as Record<string, unknown>) : null
        }),
        binding: () => { if (!current()) throw new Error("stale-home-request"); return apiFetch("/api/account/bindings"); },
        scores: () => {
          if (!current()) throw new Error("stale-home-request");
          return apiFetch("/api/account/songs", {
            query: { page: 1, pageSize: 1, scoreOnly: "1" }
          });
        }
      });
      if (current()) {
        resolvedUserId.value = currentUserId;
        applyResolution(resolution);
      }
    } catch (error) {
      if (!current()) return snapshot.value;
      const errorInfo = getHomeResolverErrorInfo(
        accountAuthError.value
          ? new Error(accountAuthError.value)
          : error
      );
      snapshot.value = { ...createSnapshot(), status: "error", error: errorInfo };
    } finally {
      if (request === runtime.generation) runtime.pending = null;
      if (ownedRequest === request) ownedRequest = null;
    }
    return snapshot.value;
    });
    runtime.pending = pending;
    return pending;
  };

  return {
    status: computed(() => snapshot.value.status),
    homeState: computed(() => snapshot.value.homeState),
    authenticated: computed(() => snapshot.value.authenticated),
    currentBinding: computed(() => snapshot.value.currentBinding),
    hasScores: computed(() => snapshot.value.hasScores),
    error: computed(() => snapshot.value.error),
    revision,
    suspend,
    resolve,
    refresh: () => resolve(true)
  };
};
