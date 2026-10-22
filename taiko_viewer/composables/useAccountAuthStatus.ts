export type AccountAuthUser = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
  annualSummaryAccess: boolean;
  myTaikoReadModelAccess?: boolean;
  developerApiV1Access?: boolean;
};

type AccountAuthPayload = {
  authenticated: boolean;
  user: AccountAuthUser | null;
};

// Runtime promises are scoped to one Nuxt app, never serialized or shared
// between SSR visitors. Sidebar and page consumers join the same initial read.
const requests = new WeakMap<object, { generation: number; applying: boolean; pending: Promise<AccountAuthUser | null> | null; stopWatching?: () => void }>();

export const useAccountAuthStatus = () => {
  const accountUser = useState<AccountAuthUser | null>("account-user", () => null);
  const accountLoaded = useState<boolean>("account-user-loaded", () => false);
  const accountAuthError = useState<string | null>("account-user-error", () => null);
  const accountAuthPending = useState<boolean>("account-user-pending", () => false);
  const app = useNuxtApp();
  if (!requests.has(app)) requests.set(app, { generation: 0, applying: false, pending: null });
  const runtime = requests.get(app)!;
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  if (!runtime.stopWatching) {
    // Middleware also consumes auth. Keep one app-owned observer instead of
    // accumulating an unscoped watcher on every navigation.
    const scope = effectScope(true);
    scope.run(() => watch(() => accountUser.value?.id, () => {
      if (runtime.applying) return;
      runtime.generation++;
      runtime.pending = null;
      accountAuthPending.value = false;
    }, { flush: "sync" }));
    runtime.stopWatching = () => scope.stop();
    if (import.meta.server) app.hook("app:rendered", runtime.stopWatching);
    else app.vueApp.onUnmount(runtime.stopWatching);
  }

  const fetchAccountAuthPayload = async () =>
    $fetch<AccountAuthPayload>("/api/account/auth/me", {
      headers: requestHeaders,
      retry: 0
    });

  const resolveAccountUser = async (force = false) => {
    if (runtime.pending && !force) return runtime.pending;
    if (accountLoaded.value && !force) {
      return accountUser.value;
    }

    const request = ++runtime.generation;
    accountAuthError.value = null;
    accountAuthPending.value = true;
    const pending = (async () => {
      try {
        const data = await fetchAccountAuthPayload();
        if (request !== runtime.generation) return accountUser.value;
        if (!data || typeof data.authenticated !== "boolean" || Boolean(data.user) !== data.authenticated || (data.user && !data.user.id)) throw new Error("Invalid authentication response");
        runtime.applying = true;
        accountUser.value = data.user;
      } catch (error) {
        if (request !== runtime.generation) return accountUser.value;
        runtime.applying = true;
        accountUser.value = null;
        accountAuthError.value = error instanceof Error ? error.message : "登录状态获取失败";
      } finally {
        runtime.applying = false;
        if (request === runtime.generation) {
          accountLoaded.value = true;
          accountAuthPending.value = false;
          runtime.pending = null;
        }
      }
      return accountUser.value;
    })();
    runtime.pending = pending;
    return pending;
  };

  const isAuthenticated = async (force = false) => Boolean(await resolveAccountUser(force));

  const clearResolvedAccountUser = () => {
    runtime.generation++;
    runtime.pending = null;
    accountAuthPending.value = false;
    accountUser.value = null;
    accountLoaded.value = true;
    accountAuthError.value = null;
  };

  return {
    accountUser,
    accountLoaded,
    accountAuthError,
    accountAuthPending,
    accountAuthStatus: computed(() => accountAuthPending.value || !accountLoaded.value ? "loading" : accountAuthError.value ? "error" : accountUser.value ? "authenticated" : "guest"),
    resolveAccountUser,
    isAuthenticated,
    clearResolvedAccountUser
  };
};
