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

export const useHomeState = () => {
  const apiFetch = useViewerApiFetch();
  const { accountUser, accountAuthError, resolveAccountUser } = useAccountAuthStatus();
  const snapshot = useState<HomeResolverSnapshot>("home-state-resolver", createSnapshot);
  const resolvedUserId = useState<number | null>("home-state-resolved-user-id", () => null);

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
    await resolveAccountUser(force);
    const currentUserId = accountUser.value?.id || null;

    if (!force && snapshot.value.status === "ready" && resolvedUserId.value === currentUserId) {
      return snapshot.value;
    }

    snapshot.value = {
      ...snapshot.value,
      status: "loading",
      error: null,
      authenticated: currentUserId !== null,
      currentBinding: null,
      hasScores: null
    };

    try {
      if (accountAuthError.value) {
        throw new Error(accountAuthError.value);
      }
      const resolution = await resolveHomeState({
        auth: async (): Promise<HomeAuthPayload> => ({
          authenticated: Boolean(accountUser.value),
          user: accountUser.value ? (accountUser.value as unknown as Record<string, unknown>) : null
        }),
        binding: () => apiFetch("/api/account/bindings"),
        scores: () =>
          apiFetch("/api/account/songs", {
            query: { page: 1, pageSize: 1, scoreOnly: "1" }
          })
      });
      resolvedUserId.value = currentUserId;
      applyResolution(resolution);
    } catch (error) {
      const errorInfo = getHomeResolverErrorInfo(
        accountAuthError.value
          ? new Error(accountAuthError.value)
          : error
      );
      snapshot.value = {
        ...snapshot.value,
        status: "error",
        homeState: null,
        error: errorInfo
      };
    }

    return snapshot.value;
  };

  return {
    status: computed(() => snapshot.value.status),
    homeState: computed(() => snapshot.value.homeState),
    authenticated: computed(() => snapshot.value.authenticated),
    currentBinding: computed(() => snapshot.value.currentBinding),
    hasScores: computed(() => snapshot.value.hasScores),
    error: computed(() => snapshot.value.error),
    resolve,
    refresh: () => resolve(true)
  };
};
